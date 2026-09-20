#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
点到 —— 本地服务器 + LLM 代理

运行：python3 server.py

功能：
  1. 静态文件服务（index.html 等）
  2. POST /api/chat  —— 大模型代理（支持流式 SSE）
     · 彻底规避浏览器 CORS 限制
     · API key 不出现在前端代码里
     · 兼容 DeepSeek / 通义千问 / 智谱 / Moonshot / OpenAI 等 OpenAI 格式接口

API key 两种来源（优先级从高到低）：
  1. 环境变量：  export DEEPSEEK_API_KEY=sk-xxxx
  2. 前端设置面板填写（存 localStorage，仅在你本机）
"""

import http.server
import socketserver
import os
import sys
import json
import re
import webbrowser
import urllib.request
import urllib.error
import socket

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# 各服务商默认 endpoint（均为 OpenAI 兼容格式）
PROVIDERS = {
    "deepseek": ("https://api.deepseek.com/chat/completions", "deepseek-chat"),
    "qwen":     ("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", "qwen-plus"),
    "zhipu":    ("https://open.bigmodel.cn/api/paas/v4/chat/completions", "glm-4-flash"),
    "moonshot": ("https://api.moonshot.cn/v1/chat/completions", "moonshot-v1-8k"),
    "doubao":   ("https://ark.cn-beijing.volces.com/api/v3/chat/completions", "doubao-pro-32k"),
    "openai":   ("https://api.openai.com/v1/chat/completions", "gpt-4o-mini"),
}

ENV_KEYS = {
    "deepseek": "DEEPSEEK_API_KEY",
    "qwen":     "DASHSCOPE_API_KEY",
    "zhipu":    "ZHIPU_API_KEY",
    "moonshot": "MOONSHOT_API_KEY",
    "doubao":   "ARK_API_KEY",
    "openai":   "OPENAI_API_KEY",
}


def _rank_ip(ip):
    """给候选 IP 打分：普通家用/办公 Wi-Fi 网段优先，VPN / CGNAT 网段靠后"""
    if ip.startswith("192.168."):
        return 0
    if ip.startswith("10."):
        return 1
    try:
        a, b = ip.split(".")[:2]
        if a == "172" and 16 <= int(b) <= 31:
            return 2
        if a == "100" and 64 <= int(b) <= 127:   # CGNAT / Tailscale，手机通常连不上
            return 9
    except Exception:
        pass
    if ip.startswith("169.254."):                # 自动专用地址，不可用
        return 10
    return 5


def get_lan_ip():
    """获取本机在局域网中的 IPv4 地址（供手机同 Wi-Fi 访问），优先 Wi-Fi/以太网网段"""
    candidates = []

    # 1) 直接读取 macOS 的 Wi-Fi(en0) / 以太网(en1) 接口地址，最贴近真实 Wi-Fi
    try:
        import subprocess
        for iface in ("en0", "en1", "en2"):
            try:
                out = subprocess.run(["ipconfig", "getifaddr", iface],
                                     capture_output=True, text=True, timeout=1)
                ip = (out.stdout or "").strip()
                if ip and not ip.startswith("127."):
                    candidates.append(ip)
            except Exception:
                continue
    except Exception:
        pass

    # 2) UDP 出口网卡探测（不真正发包）
    try:
        sk = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sk.settimeout(0.4)
        sk.connect(("8.8.8.8", 80))
        ip = sk.getsockname()[0]
        sk.close()
        if ip and not ip.startswith("127."):
            candidates.append(ip)
    except Exception:
        pass

    # 3) 主机名解析兜底
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127."):
                candidates.append(ip)
    except Exception:
        pass

    if not candidates:
        return ""
    # 去重并按网段优先级排序
    uniq = list(dict.fromkeys(candidates))
    uniq.sort(key=_rank_ip)
    best = uniq[0]
    return "" if _rank_ip(best) >= 10 else best


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, fmt, *args):
        # 静音静态资源日志，只保留 API 调用
        if '/api/' in str(args[0] if args else ''):
            super().log_message(fmt, *args)

    def do_GET(self):
        if self.path.split('?')[0].rstrip('/') == '/api/lan-info':
            ip = get_lan_ip()
            port = self.server.server_address[1]
            payload = {
                "ip": ip,
                "port": port,
                "url": (f"http://{ip}:{port}/index.html" if ip else f"http://localhost:{port}/index.html"),
                "lan_available": bool(ip),
            }
            body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path.rstrip('/') != '/api/chat':
            self.send_error(404, "Not Found")
            return
        try:
            self._handle_chat()
        except Exception as e:
            self._json_error(500, f"代理内部错误：{e}")

    # ------------------------------------------------------------------
    def _json_error(self, code, msg):
        try:
            body = json.dumps({"error": msg}, ensure_ascii=False).encode('utf-8')
            self.send_response(code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _handle_chat(self):
        length = int(self.headers.get('Content-Length', 0))
        if length <= 0:
            return self._json_error(400, "空请求体")
        payload = json.loads(self.rfile.read(length).decode('utf-8'))

        provider = (payload.get('provider') or 'deepseek').lower()
        default_url, default_model = PROVIDERS.get(provider, PROVIDERS['deepseek'])

        url = payload.get('endpoint') or default_url
        model = payload.get('model') or default_model
        messages = payload.get('messages') or []
        temperature = payload.get('temperature')      # 推理模型不传这个字段
        is_reasoner = bool(re.search(
            r'reasoner|reasoning|deepseek-r1|(^|[^a-z])r1([^a-z]|$)|qwq|-z1|thinking',
            str(model), re.I))
        stream = bool(payload.get('stream', True))

        # key 优先取环境变量，其次取前端传入
        api_key = os.environ.get(ENV_KEYS.get(provider, ''), '') or payload.get('apiKey', '')
        if not api_key:
            return self._json_error(400,
                f"未配置 API key。请在右侧设置面板填写，或设置环境变量 "
                f"{ENV_KEYS.get(provider, 'DEEPSEEK_API_KEY')}")
        if not messages:
            return self._json_error(400, "messages 为空")

        upstream = {
            "model": model,
            "messages": messages,
            "stream": stream
        }
        if temperature is not None and not is_reasoner:
            upstream["temperature"] = temperature
        req_body = json.dumps(upstream, ensure_ascii=False).encode('utf-8')

        req = urllib.request.Request(
            url,
            data=req_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "Accept": "text/event-stream" if stream else "application/json",
            },
            method="POST",
        )

        try:
            upstream = urllib.request.urlopen(req, timeout=120)
        except urllib.error.HTTPError as e:
            detail = e.read().decode('utf-8', 'ignore')[:600]
            return self._json_error(e.code, f"{provider} 接口返回 {e.code}：{detail}")
        except urllib.error.URLError as e:
            return self._json_error(502, f"无法连接 {provider}：{e.reason}")

        if not stream:
            data = upstream.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # ---- 流式透传（零缓冲极速转发 + 结束立即断开防止前端卡死） ----
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
        self.send_header('Connection', 'close')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Accel-Buffering', 'no')
        self.end_headers()
        self.close_connection = True
        try:
            while True:
                chunk = upstream.read1(1024) if hasattr(upstream, "read1") else upstream.read(128)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass  # 用户中途关闭页面
        finally:
            upstream.close()


class ThreadingServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    """多线程：流式响应期间不阻塞其它请求"""
    daemon_threads = True
    allow_reuse_address = True


def run_server():
    os.chdir(DIRECTORY)
    port = PORT
    while port < 8100:
        try:
            with ThreadingServer(("", port), Handler) as httpd:
                url = f"http://localhost:{port}/index.html"
                configured = [p for p, k in ENV_KEYS.items() if os.environ.get(k)]
                print("=" * 58, flush=True)
                print(" ✨ 点到 已启动")
                lan_ip = get_lan_ip()
                lan_url = f"http://{lan_ip}:{port}/index.html" if lan_ip else ""
                print(f" 🌐 本机访问 : {url}")
                if lan_url:
                    print(f" 📱 手机访问 : {lan_url}")
                    print("             （手机需与本电脑连同一个 Wi-Fi；Safari 打开后可「添加到主屏幕」全屏使用）")
                else:
                    print(" 📱 手机访问 : 未检测到局域网 IP，请先连接 Wi-Fi")
                print(f" 🔌 LLM 代理 : POST http://localhost:{port}/api/chat")
                print(f" 🔑 环境变量 : {('已配置 ' + ', '.join(configured)) if configured else '未配置（可在页面设置面板填 key）'}")
                print(" ⌨️  Ctrl+C 退出", flush=True)
                print("=" * 58, flush=True)
                try:
                    webbrowser.open(url)
                except Exception:
                    pass
                httpd.serve_forever()
        except OSError:
            port += 1


if __name__ == '__main__':
    try:
        run_server()
    except KeyboardInterrupt:
        print("\n 服务已停止。")
        sys.exit(0)
