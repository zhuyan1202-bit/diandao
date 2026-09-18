#!/bin/bash
# =============================================================
#  点到 · 一键发布到 GitHub Pages
#  用法：  ./publish.sh
#  作用：  重新打包 dist/ → 推送到 gh-pages 分支 → 线上网页自动更新
# =============================================================
set -e
cd "$(dirname "$0")"

BRANCH="gh-pages"
WORKTREE=".gh-pages-tmp"

echo "▶ 1/4 检查远程仓库…"
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "❌ 还没有配置远程仓库。请先在 GitHub 上创建一个空仓库，然后执行："
  echo "   git remote add origin https://github.com/<你的用户名>/<仓库名>.git"
  exit 1
fi
echo "   远程：$(git remote get-url origin)"

echo "▶ 2/4 打包静态站点到 dist/ …"
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
echo "   已打包 $(ls dist | wc -l | tr -d ' ') 个文件"

echo "▶ 3/4 推送到 $BRANCH 分支…"
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

echo "▶ 4/4 完成！"
REPO_URL=$(git remote get-url origin)
USER_REPO=$(echo "$REPO_URL" | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')
USER_NAME=$(echo "$USER_REPO" | cut -d/ -f1)
REPO_NAME=$(echo "$USER_REPO" | cut -d/ -f2)
echo ""
echo "🌐 你的网址（首次发布约等 1–2 分钟生效）："
echo "   https://${USER_NAME}.github.io/${REPO_NAME}/"
echo ""
echo "💡 首次发布后，请到 GitHub 仓库页面 Settings → Pages，"
echo "   把 Source 设为 “Deploy from a branch”，分支选 gh-pages / (root)，保存即可。"
