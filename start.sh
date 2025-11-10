#!/bin/bash

# 萤火AI平台启动脚本
# 确保环境变量正确加载并启动服务器

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# 切换到项目根目录
cd "$SCRIPT_DIR"

# 设置环境变量
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}

# 确保日志目录存在
mkdir -p "$SCRIPT_DIR/logs"

# 记录启动时间和信息
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 正在启动萤火AI平台..." >> "$SCRIPT_DIR/logs/startup.log"

# 检查node是否可用
if ! command -v node &> /dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 错误: Node.js未安装或不在PATH中" >> "$SCRIPT_DIR/logs/startup.log"
    exit 1
fi

# 记录Node版本
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 使用Node.js版本: $(node -v)" >> "$SCRIPT_DIR/logs/startup.log"

# 检查package.json是否存在
if [ ! -f "$SCRIPT_DIR/package.json" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 错误: package.json文件不存在" >> "$SCRIPT_DIR/logs/startup.log"
    exit 1
fi

# 检查server.js是否存在
if [ ! -f "$SCRIPT_DIR/server.js" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 错误: server.js文件不存在" >> "$SCRIPT_DIR/logs/startup.log"
    exit 1
fi

# 检查.env文件
if [ -f "$SCRIPT_DIR/.env" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] .env文件存在，将被Node.js应用加载" >> "$SCRIPT_DIR/logs/startup.log"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 警告: .env文件不存在，将使用默认配置" >> "$SCRIPT_DIR/logs/startup.log"
    
    # 如果.env文件不存在，但有模板文件，则复制一份
    if [ -f "$SCRIPT_DIR/bt-env-template" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 从模板创建.env文件" >> "$SCRIPT_DIR/logs/startup.log"
        cp "$SCRIPT_DIR/bt-env-template" "$SCRIPT_DIR/.env"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 请编辑.env文件并填入正确的配置值" >> "$SCRIPT_DIR/logs/startup.log"
        exit 1
    fi
fi

# 检查node_modules是否存在
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 警告: node_modules目录不存在，尝试安装依赖" >> "$SCRIPT_DIR/logs/startup.log"
    npm install
    
    if [ $? -ne 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 错误: 依赖安装失败" >> "$SCRIPT_DIR/logs/startup.log"
        exit 1
    fi
fi

# 测试环境变量加载
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 测试环境变量加载..." >> "$SCRIPT_DIR/logs/startup.log"
node -e "const path = require('path'); require('dotenv').config({ path: path.resolve('$SCRIPT_DIR', '.env') }); console.log('环境变量测试:', { dbHost: process.env.DB_HOST || '未加载', appId: process.env.ALIPAY_APP_ID || '未加载' });" >> "$SCRIPT_DIR/logs/startup.log" 2>&1

# 启动应用
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 正在启动应用..." >> "$SCRIPT_DIR/logs/startup.log"

# 使用PM2启动（如果可用）
if command -v pm2 &> /dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 使用PM2启动应用" >> "$SCRIPT_DIR/logs/startup.log"
    pm2 start "$SCRIPT_DIR/server.js" --name "yinghuo-ai" --time
    
    if [ $? -ne 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 使用PM2启动失败，尝试直接启动" >> "$SCRIPT_DIR/logs/startup.log"
        node --max-old-space-size=4096 "$SCRIPT_DIR/server.js" >> "$SCRIPT_DIR/logs/server.log" 2>> "$SCRIPT_DIR/logs/error.log" &
        echo $! > "$SCRIPT_DIR/server.pid"
    fi
else
    # 直接启动Node.js应用
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 直接启动Node.js应用" >> "$SCRIPT_DIR/logs/startup.log"
    node --max-old-space-size=4096 "$SCRIPT_DIR/server.js" >> "$SCRIPT_DIR/logs/server.log" 2>> "$SCRIPT_DIR/logs/error.log" &
    echo $! > "$SCRIPT_DIR/server.pid"
fi

# 检查启动结果
sleep 2
if [ -f "$SCRIPT_DIR/server.pid" ]; then
    PID=$(cat "$SCRIPT_DIR/server.pid")
    if ps -p $PID > /dev/null; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 应用已成功启动，PID: $PID" >> "$SCRIPT_DIR/logs/startup.log"
        echo "萤火AI平台已成功启动，PID: $PID"
        exit 0
    fi
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 警告: 无法确认应用是否成功启动，请检查日志" >> "$SCRIPT_DIR/logs/startup.log"
echo "萤火AI平台可能未成功启动，请检查日志文件"
