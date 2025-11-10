#!/bin/bash

# 萤火AI平台宝塔启动脚本
# 此脚本用于在宝塔面板中正确启动Node.js应用

# 切换到项目目录
cd /www/wwwroot/yinghuo/1_副本2\ 2

# 设置环境变量
export NODE_ENV=production
export PORT=8081

# 确保日志目录存在
mkdir -p /www/wwwroot/yinghuo/1_副本2\ 2/logs

# 记录启动时间和信息
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 正在启动萤火AI平台..." >> /www/wwwroot/yinghuo/1_副本2\ 2/logs/startup.log

# 检查node是否可用
if ! command -v node &> /dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 错误: Node.js未安装或不在PATH中" >> /www/wwwroot/yinghuo/1_副本2\ 2/logs/startup.log
    exit 1
fi

# 记录Node版本
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 使用Node.js版本: $(node -v)" >> /www/wwwroot/yinghuo/1_副本2\ 2/logs/startup.log

# 检查package.json是否存在
if [ ! -f "/www/wwwroot/yinghuo/1_副本2 2/package.json" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 错误: package.json文件不存在" >> /www/wwwroot/yinghuo/1_副本2\ 2/logs/startup.log
    exit 1
fi

# 检查server.js是否存在
if [ ! -f "/www/wwwroot/yinghuo/1_副本2 2/server.js" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 错误: server.js文件不存在" >> /www/wwwroot/yinghuo/1_副本2\ 2/logs/startup.log
    exit 1
fi

# 检查并加载.env文件
if [ -f "/www/wwwroot/yinghuo/1_副本2 2/.env" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 加载.env环境变量配置" >> /www/wwwroot/yinghuo/1_副本2\ 2/logs/startup.log
    # 导出.env文件中的环境变量
    export $(grep -v '^#' /www/wwwroot/yinghuo/1_副本2\ 2/.env | xargs)
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 警告: .env文件不存在，使用默认配置" >> /www/wwwroot/yinghuo/1_副本2\ 2/logs/startup.log
fi

# 启动应用
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 正在启动应用..." >> /www/wwwroot/yinghuo/1_副本2\ 2/logs/startup.log

# 检查node_modules是否存在
if [ ! -d "/www/wwwroot/yinghuo/1_副本2 2/node_modules" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 警告: node_modules目录不存在，尝试安装依赖" >> /www/wwwroot/yinghuo/1_副本2\ 2/logs/startup.log
    npm install
    
    if [ $? -ne 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 错误: 依赖安装失败" >> /www/wwwroot/yinghuo/1_副本2\ 2/logs/startup.log
        exit 1
    fi
fi

# 启动Node.js应用
node --max-old-space-size=4096 server.js 2>> /www/wwwroot/yinghuo/1_副本2\ 2/logs/err.log

# 检查启动结果
if [ $? -ne 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 错误: 应用启动失败，请查看错误日志" >> /www/wwwroot/yinghuo/1_副本2\ 2/logs/startup.log
    exit 1
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 应用已成功启动" >> /www/wwwroot/yinghuo/1_副本2\ 2/logs/startup.log
fi 