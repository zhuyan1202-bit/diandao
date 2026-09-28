#!/usr/bin/env python3
# =============================================================
#  点到 · 生成朋友邀请链接
#
#  把你的 DeepSeek Key 用一个邀请码加密，写进 invite.js。
#  朋友打开 https://…/diandao/#i=邀请码 就能直接用，不用自己申请 Key。
#
#  用法：
#    python3 mkinvite.py                    # 交互输入 Key；邀请码沿用上次的（没有就新生成）
#    python3 mkinvite.py --key-file 路径     # 从文件读 Key
#    python3 mkinvite.py --new-code         # 换一个新邀请码 → 旧链接全部作废
#  换 Key（比如余额用完换了一把）：直接重跑，邀请码不变，朋友无感。
#  跑完之后 ./publish.sh 发布才会生效。
#
#  邀请码存在本目录 .invite_code（已加入 .gitignore，不会进仓库，也不会被发布）。
#  仓库是公开的：Key 只能以密文形式进 invite.js，千万别把明文 Key 提交上去。
# =============================================================
import argparse, base64, getpass, hashlib, hmac, json, os, re, secrets, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"     # 去掉了容易看错的 I L O 0 1
ITERS = 10000
SITE = "https://zhuyan1202-bit.github.io/diandao/"
MARK = re.compile(r"/\*BLOB\*/.*?/\*BLOB\*/", re.S)


def norm(code):
    return re.sub(r"[^A-Z0-9]", "", code.upper())


def encrypt(key, code, salt=None, iters=ITERS):
    salt = salt or secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", norm(code).encode(), salt, iters, 32)
    enc_k = hmac.new(dk, b"enc", hashlib.sha256).digest()
    mac_k = hmac.new(dk, b"mac", hashlib.sha256).digest()
    pt = key.encode()
    ks = b"".join(hmac.new(enc_k, salt + j.to_bytes(4, "big"), hashlib.sha256).digest()
                  for j in range((len(pt) + 31) // 32))
    ct = bytes(a ^ b for a, b in zip(pt, ks))
    tag = hmac.new(mac_k, salt + ct, hashlib.sha256).digest()[:16]
    b64 = lambda b: base64.b64encode(b).decode()
    return {"v": 1, "i": iters, "s": b64(salt), "c": b64(ct), "t": b64(tag)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key-file")
    ap.add_argument("--new-code", action="store_true")
    ap.add_argument("--code-file", default=os.path.join(HERE, ".invite_code"))
    ap.add_argument("--target", default=os.path.join(HERE, "invite.js"))
    a = ap.parse_args()

    if a.key_file:
        key = open(a.key_file).read().strip()
    else:
        key = getpass.getpass("粘贴 DeepSeek Key（不会显示）：").strip()
    if not re.fullmatch(r"sk-[A-Za-z0-9]{8,}", key):
        sys.exit("❌ 这不像一把 DeepSeek Key（应以 sk- 开头）")

    code = ""
    if not a.new_code and os.path.exists(a.code_file):
        code = norm(open(a.code_file).read())
    if len(code) < 6:
        code = "".join(secrets.choice(ALPHABET) for _ in range(10))
        with open(a.code_file, "w") as f:
            f.write(code + "\n")
        os.chmod(a.code_file, 0o600)

    blob = encrypt(key, code)
    src = open(a.target, encoding="utf-8").read()
    if len(MARK.findall(src)) != 1:
        sys.exit("❌ invite.js 里找不到 /*BLOB*/ 标记")
    src = MARK.sub(lambda m: "/*BLOB*/" + json.dumps(blob, separators=(",", ":")) + "/*BLOB*/", src)
    assert key not in src
    with open(a.target, "w", encoding="utf-8") as f:
        f.write(src)

    print("✅ 已写入", os.path.relpath(a.target, HERE))
    print("   邀请码：", code[:5] + "-" + code[5:])
    print("   链接：  ", SITE + "#i=" + code)
    print("   下一步：./publish.sh 发布后，把链接发给朋友。")


if __name__ == "__main__":
    main()
