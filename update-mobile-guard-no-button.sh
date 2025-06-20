#!/bin/bash

# 更新移动端防护脚本 - 移除返回按钮版本
# 此脚本用于更新所有使用了mobile-guard.js和iframe-mobile-guard.js的HTML页面
# 确保它们使用最新版本的脚本（无按钮版本）

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}开始更新移动端防护脚本（无按钮版本）...${NC}"

# 需要更新的页面列表
PAGES=(
  "public/marketing-images.html"
  "public/translate.html"
  "public/cutout.html"
  "public/scene-generator.html"
  "public/image-removal.html"
  "public/model-skin-changer.html"
  "public/clothing-simulation.html"
)

# 更新计数器
UPDATED=0
SKIPPED=0
FAILED=0

# 遍历每个页面并更新
for page in "${PAGES[@]}"; do
  if [ -f "$page" ]; then
    echo -e "${YELLOW}处理页面: ${NC}$page"
    
    # 检查文件是否包含mobile-guard.js或iframe-mobile-guard.js
    if grep -q "mobile-guard.js" "$page" || grep -q "iframe-mobile-guard.js" "$page"; then
      # 添加时间戳参数以防止缓存
      timestamp=$(date +%s)
      
      # 使用sed更新脚本引用，添加时间戳参数
      if grep -q "iframe-mobile-guard.js" "$page"; then
        sed -i '' "s|iframe-mobile-guard.js[^\"]*|iframe-mobile-guard.js?v=$timestamp\"|g" "$page"
        echo -e "${GREEN}✓ 已更新iframe-mobile-guard.js引用${NC}"
      elif grep -q "mobile-guard.js" "$page"; then
        sed -i '' "s|mobile-guard.js[^\"]*|mobile-guard.js?v=$timestamp\"|g" "$page"
        echo -e "${GREEN}✓ 已更新mobile-guard.js引用${NC}"
      fi
      
      UPDATED=$((UPDATED+1))
    else
      echo -e "${YELLOW}⚠ 页面不包含移动端防护脚本，跳过${NC}"
      SKIPPED=$((SKIPPED+1))
    fi
  else
    echo -e "${RED}✗ 文件不存在: $page${NC}"
    FAILED=$((FAILED+1))
  fi
  echo ""
done

echo -e "${GREEN}移动端防护脚本更新完成!${NC}"
echo -e "更新: $UPDATED 个文件"
echo -e "跳过: $SKIPPED 个文件"
echo -e "失败: $FAILED 个文件"
echo ""
echo -e "${YELLOW}提示: 请确保清除浏览器缓存以使更改生效${NC}"

# 设置脚本为可执行
chmod +x update-mobile-guard-no-button.sh 