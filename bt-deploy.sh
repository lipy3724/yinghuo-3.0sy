#!/bin/bash

# 萤火AI平台宝塔部署脚本
# 该脚本用于在宝塔面板环境中部署和启动Node.js应用

# 1. 设置环境变量
echo "正在设置环境变量..."
PROJ_DIR="/www/wwwroot/yinghuo/1_副本2 2"
APP_NAME="yinghuo-ai"
NODE_VERSION="v18.20.8"  # 应与您本地开发环境一致

# 2. 创建必要的目录
echo "正在创建必要的目录..."
mkdir -p $PROJ_DIR/logs
mkdir -p $PROJ_DIR/uploads
mkdir -p $PROJ_DIR/temp
mkdir -p $PROJ_DIR/results

# 3. 设置权限
echo "正在设置目录权限..."
chown -R www:www $PROJ_DIR
chmod -R 755 $PROJ_DIR
chmod -R 777 $PROJ_DIR/logs
chmod -R 777 $PROJ_DIR/uploads
chmod -R 777 $PROJ_DIR/temp
chmod -R 777 $PROJ_DIR/results

# 4. 创建环境变量文件
echo "正在创建.env文件..."
if [ ! -f "$PROJ_DIR/.env" ]; then
  cat > $PROJ_DIR/.env << EOF
# 数据库配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=yinghuo
DB_PORT=3306

# 应用配置
NODE_ENV=production
PORT=8081

# JWT密钥
JWT_SECRET=yinghuoai_secret_key_change_this_in_production
JWT_EXPIRE=30d

# 阿里云OSS配置
OSS_REGION=oss-cn-shanghai
OSS_BUCKET=yinghuo-ai
OSS_ACCESS_KEY_ID=替换为您的AccessKeyID
OSS_ACCESS_KEY_SECRET=替换为您的AccessKeySecret

# 其他API密钥
DASHSCOPE_API_KEY=替换为您的DASHSCOPE_API_KEY
EOF
  echo ".env文件已创建，请修改其中的配置值"
else
  echo ".env文件已存在，跳过创建"
fi

# 5. 创建PM2配置文件
echo "正在创建PM2配置文件..."
cat > $PROJ_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: "${APP_NAME}",
    script: "server.js",
    cwd: "${PROJ_DIR}",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "production",
      PORT: 8081
    },
    error_file: "${PROJ_DIR}/logs/err.log",
    out_file: "${PROJ_DIR}/logs/out.log",
    log_file: "${PROJ_DIR}/logs/combined.log",
    time: true
  }]
} 
EOF

# 6. 创建宝塔启动脚本
echo "正在创建宝塔启动脚本..."
cat > $PROJ_DIR/bt-start.sh << EOF
#!/bin/bash
cd ${PROJ_DIR}
export NODE_ENV=production
export PORT=8081

# 确保日志目录存在
mkdir -p ${PROJ_DIR}/logs

# 启动应用
node server.js
EOF

# 设置启动脚本权限
chmod +x $PROJ_DIR/bt-start.sh

# 7. 提示安装依赖
echo "请确保已安装所有依赖："
echo "cd ${PROJ_DIR} && npm install"

# 8. 使用说明
echo ""
echo "==================================================="
echo "         萤火AI平台宝塔部署脚本执行完成             "
echo "==================================================="
echo ""
echo "宝塔Node.js项目管理器配置说明："
echo "1. 项目名称：yinghuo"
echo "2. 启动选项："
echo "   - 项目目录：${PROJ_DIR}"
echo "   - 启动文件：${PROJ_DIR}/bt-start.sh"
echo "   - 运行用户：www"
echo "   - Node版本：${NODE_VERSION}"
echo ""
echo "重要提示："
echo "1. 请编辑.env文件，填入正确的数据库和API配置"
echo "2. 确保数据库已创建且有正确的表结构"
echo "3. 如需使用PM2管理应用，请运行："
echo "   pm2 start ${PROJ_DIR}/ecosystem.config.js"
echo ""
echo "如遇到问题，请检查日志："
echo "tail -f ${PROJ_DIR}/logs/err.log"
echo "===================================================" 