#!/bin/bash

# 批量更新有问题的功能页面的移动端防护脚本
# 将mobile-guard.js替换为iframe-mobile-guard.js

echo "开始批量更新移动端防护脚本..."

# 需要更新的文件列表
FILES=(
  "public/marketing-images.html"
  "public/translate.html"
  "public/cutout.html"
  "public/scene-generator.html"
  "public/image-removal.html"
  "public/model-skin-changer.html"
  "public/clothing-simulation.html"
)

# 备份目录
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# 替换每个文件中的脚本引用
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "处理文件: $file"
    
    # 创建备份
    cp "$file" "$BACKUP_DIR/$(basename $file)"
    
    # 替换脚本引用
    sed -i.bak 's|/js/mobile-guard.js|/js/iframe-mobile-guard.js|g' "$file"
    
    # 添加移动设备检测代码
    if ! grep -q "检测到移动设备，不加载编辑器" "$file"; then
      sed -i.bak '/const url = /i\
            // 检查是否为移动设备\
            const isMobile = \/Android|iPhone|iPad|iPod|Mobile|BlackBerry|IEMobile|Opera Mini\/i.test(navigator.userAgent);\
            if (isMobile) {\
                console.log("检测到移动设备，不加载编辑器");\
                return;\
            }\
            ' "$file"
    fi
    
    # 清理临时文件
    rm -f "$file.bak"
    
    echo "✅ 已更新: $file"
  else
    echo "❌ 文件不存在: $file"
  fi
done

echo "批量更新完成！备份文件保存在 $BACKUP_DIR 目录"
echo "请重启服务器使更改生效" 