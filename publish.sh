#!/bin/bash
# =============================================================
#  点到 · 一键发布到 GitHub Pages
#  用法：  ./publish.sh
#  作用：  重新打包 dist/ → 自动打缓存版本号 → 推送 gh-pages → 线上更新
# =============================================================
set -e
cd "$(dirname "$0")"

BRANCH="gh-pages"
WORKTREE=".gh-pages-tmp"

echo "▶ 1/5 检查远程仓库…"
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "❌ 还没有配置远程仓库。请先执行："
  echo "   git remote add origin https://github.com/zhuyan1202-bit/diandao.git"
  exit 1
fi
echo "   远程：$(git remote get-url origin)"

echo "▶ 2/5 打包静态站点到 dist/ …"
rm -rf dist
mkdir -p dist
cp index.html app.js chat_engine.js styles.css manifest.json icon.svg \
   vsop87.js calendar_core.js ziwei_engine.js ziwei_bazi_core.js \
   knowledge_base.js kb_retrieve.js bazi_analyze.js bazi_kb.js \
   bazi_retrieve.js tarot_data.js dist/
# kb/ 为古籍原文与编译脚本，已编译进 knowledge_base.js / bazi_kb.js，线上无需发布
touch dist/.nojekyll          # 告诉 GitHub Pages 不要用 Jekyll 处理

# 线上不需要「局域网扫码」按钮，自动隐藏
python3 - << 'PYEOF'
p = "dist/app.js"
s = open(p).read()
anchor = '    document.getElementById("btn-mobile-access")?.addEventListener("click", () => openMobileAccessModal());'
add = anchor + '''
    if (!/^(localhost|127\\.|172\\.|192\\.168\\.|10\\.)/.test(location.hostname)) {
      const mb = document.getElementById("btn-mobile-access");
      if (mb) mb.style.display = "none";
    }'''
if anchor in s and "location.hostname" not in s:
    open(p, "w").write(s.replace(anchor, add, 1))
PYEOF
echo "   已打包 $(ls -A dist | wc -l | tr -d ' ') 个文件"

echo "▶ 3/5 给所有 JS / CSS 打缓存版本号…"
python3 - << 'PYEOF'
import re, time
stamp = time.strftime("%Y%m%d%H%M%S")
p = "dist/index.html"
s = open(p).read()
hit = []
def fix(m):
    hit.append(m.group(2))
    return '%s="%s?v=%s"' % (m.group(1), m.group(2), stamp)
# 只匹配本地相对路径（字符类不含 ":"，故 https:// 外链不会被误伤）
s = re.sub(r'\b(src|href)="([A-Za-z0-9_\-./]+\.(?:js|css))(?:\?v=[^"]*)?"', fix, s)
open(p, "w").write(s)
print("   版本号 v=%s，已标记 %d 个文件" % (stamp, len(hit)))
for f in hit:
    print("     · " + f)
PYEOF

echo "▶ 4/5 推送到 $BRANCH 分支…"
rm -rf "$WORKTREE"
git worktree prune
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git worktree add "$WORKTREE" "$BRANCH" >/dev/null
else
  git worktree add --detach "$WORKTREE" >/dev/null
  (cd "$WORKTREE" && git checkout --orphan "$BRANCH" && git rm -rf . >/dev/null 2>&1 || true)
fi

rsync -a --delete --exclude ".git" dist/ "$WORKTREE"/
cd "$WORKTREE"
git add -A
git commit -m "发布：点到 $(date '+%Y-%m-%d %H:%M')" >/dev/null 2>&1 || echo "   （内容无变化，跳过提交）"
git push -u origin "$BRANCH" --force
cd ..
git worktree remove "$WORKTREE" --force

echo "▶ 5/5 完成！"
REPO_URL=$(git remote get-url origin)
USER_REPO=$(echo "$REPO_URL" | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')
USER_NAME=$(echo "$USER_REPO" | cut -d/ -f1)
REPO_NAME=$(echo "$USER_REPO" | cut -d/ -f2)
echo ""
echo "🌐 https://${USER_NAME}.github.io/${REPO_NAME}/"
echo "   （约 30 秒~1 分钟生效；已自动打版本号，手机刷新即可看到新版）"
