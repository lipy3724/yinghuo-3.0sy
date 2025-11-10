#!/bin/bash

# 萤火AI平台配置更新脚本
# 用于快速修改部署配置文件中的路径和端口

# 定义新的配置参数
NEW_PROJ_DIR="/www/wwwroot/yinghuo/1_副本2 2"
NEW_PORT="8081"
OLD_PROJ_DIR="/www/wwwroot/yinghuo"
OLD_PORT="3000"

echo "====================================================="
echo "        萤火AI平台宝塔部署配置更新工具              "
echo "====================================================="
echo ""
echo "将更新以下配置："
echo "- 项目路径: ${OLD_PROJ_DIR} -> ${NEW_PROJ_DIR}"
echo "- 端口: ${OLD_PORT} -> ${NEW_PORT}"
echo ""

# 更新 bt-deploy.sh
if [ -f "bt-deploy.sh" ]; then
    echo "正在更新 bt-deploy.sh..."
    sed -i.bak "s|PROJ_DIR=\"${OLD_PROJ_DIR}\"|PROJ_DIR=\"${NEW_PROJ_DIR}\"|g" bt-deploy.sh
    sed -i.bak "s|PORT=${OLD_PORT}|PORT=${NEW_PORT}|g" bt-deploy.sh
fi

# 更新 bt-start.sh
if [ -f "bt-start.sh" ]; then
    echo "正在更新 bt-start.sh..."
    sed -i.bak "s|cd ${OLD_PROJ_DIR}|cd ${NEW_PROJ_DIR}|g" bt-start.sh
    sed -i.bak "s|export PORT=${OLD_PORT}|export PORT=${NEW_PORT}|g" bt-start.sh
    sed -i.bak "s|mkdir -p ${OLD_PROJ_DIR}/logs|mkdir -p ${NEW_PROJ_DIR}/logs|g" bt-start.sh
    sed -i.bak "s|/www/wwwroot/yinghuo/|${NEW_PROJ_DIR}/|g" bt-start.sh
fi

# 更新 bt-pm2-config.js
if [ -f "bt-pm2-config.js" ]; then
    echo "正在更新 bt-pm2-config.js..."
    sed -i.bak "s|cwd: '${OLD_PROJ_DIR}'|cwd: '${NEW_PROJ_DIR}'|g" bt-pm2-config.js
    sed -i.bak "s|PORT: ${OLD_PORT}|PORT: ${NEW_PORT}|g" bt-pm2-config.js
    sed -i.bak "s|${OLD_PROJ_DIR}/logs|${NEW_PROJ_DIR}/logs|g" bt-pm2-config.js
fi

# 更新 bt-check.sh
if [ -f "bt-check.sh" ]; then
    echo "正在更新 bt-check.sh..."
    sed -i.bak "s|PROJ_DIR=\"${OLD_PROJ_DIR}\"|PROJ_DIR=\"${NEW_PROJ_DIR}\"|g" bt-check.sh
    sed -i.bak "s|检查端口${OLD_PORT}占用情况|检查端口${NEW_PORT}占用情况|g" bt-check.sh
    sed -i.bak "s|netstat -tln \| grep \":${OLD_PORT}\"|netstat -tln \| grep \":${NEW_PORT}\"|g" bt-check.sh
    sed -i.bak "s|--add-port=${OLD_PORT}/tcp|--add-port=${NEW_PORT}/tcp|g" bt-check.sh
fi

# 更新 bt-env-template
if [ -f "bt-env-template" ]; then
    echo "正在更新 bt-env-template..."
    sed -i.bak "s|PORT=${OLD_PORT}|PORT=${NEW_PORT}|g" bt-env-template
fi

# 更新 宝塔部署指南.md
if [ -f "宝塔部署指南.md" ]; then
    echo "正在更新 宝塔部署指南.md..."
    sed -i.bak "s|${OLD_PROJ_DIR}|${NEW_PROJ_DIR}|g" "宝塔部署指南.md"
    sed -i.bak "s|端口：\`${OLD_PORT}\`|端口：\`${NEW_PORT}\`|g" "宝塔部署指南.md"
    sed -i.bak "s|http://127.0.0.1:${OLD_PORT}|http://127.0.0.1:${NEW_PORT}|g" "宝塔部署指南.md"
    sed -i.bak "s|netstat -tln \| grep ${OLD_PORT}|netstat -tln \| grep ${NEW_PORT}|g" "宝塔部署指南.md"
fi

echo ""
echo "配置更新完成!"
echo "已为所有修改的文件创建.bak备份"
echo ""
echo "请检查以下Nginx配置中的端口是否需要更新："
echo "proxy_pass http://127.0.0.1:${NEW_PORT};"
echo ""
echo "=====================================================" 