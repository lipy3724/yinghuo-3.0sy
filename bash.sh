#!/bin/bash
# 把 mobile-guard.js 插到所有 HTML 的 </head> 之前（若尚未插入）

grep -rl '</head>' . --include='*.html' | while read -r f; do
  if ! grep -q 'mobile-guard.js' "$f"; then
    perl -pi -e 's@</head>@  <script src="/js/mobile-guard.js"></script>\n</head>@' "$f"
    echo "patched $f"
  fi
done