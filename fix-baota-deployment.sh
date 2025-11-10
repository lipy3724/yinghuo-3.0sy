#!/bin/bash

# 宝塔面板 Node.js 部署修复脚本
# 解决 bcrypt 模块编译错误

echo "=== 萤火AI平台 - 宝塔部署修复脚本 ==="
echo "开始修复 bcrypt 模块编译错误..."

# 进入项目目录
cd /www/wwwroot/yinghuo6

echo "1. 备份当前 package.json..."
cp package.json package.json.backup

echo "2. 清理现有依赖..."
rm -rf node_modules
rm -f package-lock.json

echo "3. 安装编译工具（如果需要）..."
# 检查是否有 python 和 make
if ! command -v python3 &> /dev/null; then
    echo "警告: python3 未安装，可能需要手动安装"
fi

if ! command -v make &> /dev/null; then
    echo "警告: make 未安装，可能需要手动安装"
fi

echo "4. 重新安装依赖..."
npm install

# 检查 bcrypt 是否安装成功
if [ $? -eq 0 ]; then
    echo "✅ 依赖安装成功"
else
    echo "❌ 依赖安装失败，尝试使用 bcryptjs 替代..."
    
    # 卸载 bcrypt 并安装 bcryptjs
    npm uninstall bcrypt
    npm install bcryptjs
    
    echo "5. 更新代码以使用 bcryptjs..."
    # 创建一个简单的替换脚本
    find . -name "*.js" -not -path "./node_modules/*" -exec sed -i "s/require('bcrypt')/require('bcryptjs')/g" {} \;
    find . -name "*.js" -not -path "./node_modules/*" -exec sed -i 's/require("bcrypt")/require("bcryptjs")/g' {} \;
    
    echo "✅ 已切换到 bcryptjs"
fi

echo "6. 测试启动..."
timeout 10s node server.js &
sleep 5

if pgrep -f "node server.js" > /dev/null; then
    echo "✅ 服务启动成功！"
    pkill -f "node server.js"
else
    echo "❌ 服务启动失败，请检查日志"
fi

echo "=== 修复完成 ==="
echo "现在可以在宝塔面板中重新启动 Node.js 项目"
