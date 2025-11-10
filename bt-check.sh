#!/bin/bash

# 萤火AI平台宝塔环境检查脚本
# 用于检查宝塔环境是否满足部署要求

echo "===================== 萤火AI平台宝塔环境检查 ====================="
echo "开始检查宝塔环境是否满足部署要求..."
echo ""

# 定义颜色代码
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# 定义项目路径
PROJ_DIR="/www/wwwroot/yinghuo/1_副本2 2"

# 检查Node.js版本
echo -n "检查Node.js版本: "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}已安装 ${NODE_VERSION}${NC}"
    
    # 检查版本是否符合要求
    NODE_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1 | tr -d 'v')
    if [ $NODE_MAJOR_VERSION -lt 14 ]; then
        echo -e "${YELLOW}警告: Node.js版本较低，建议使用v14及以上版本${NC}"
    fi
else
    echo -e "${RED}未安装${NC}"
    echo -e "${YELLOW}请在宝塔面板中安装Node.js (建议v14及以上版本)${NC}"
fi

# 检查npm版本
echo -n "检查npm版本: "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}已安装 ${NPM_VERSION}${NC}"
else
    echo -e "${RED}未安装${NC}"
    echo -e "${YELLOW}npm未安装，请检查Node.js安装是否完整${NC}"
fi

# 检查PM2
echo -n "检查PM2: "
if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 -v 2>/dev/null || echo "未知版本")
    echo -e "${GREEN}已安装 ${PM2_VERSION}${NC}"
else
    echo -e "${YELLOW}未安装${NC}"
    echo -e "建议安装PM2以管理Node.js应用: ${GREEN}npm install -g pm2${NC}"
fi

# 检查MySQL
echo -n "检查MySQL: "
if command -v mysql &> /dev/null; then
    MYSQL_VERSION=$(mysql --version | awk '{print $3}')
    echo -e "${GREEN}已安装 ${MYSQL_VERSION}${NC}"
else
    echo -e "${YELLOW}未检测到命令行工具${NC}"
    echo -e "请确认MySQL已在宝塔面板中安装"
fi

# 检查项目目录
echo -n "检查项目目录 ${PROJ_DIR}: "
if [ -d "$PROJ_DIR" ]; then
    echo -e "${GREEN}存在${NC}"
else
    echo -e "${RED}不存在${NC}"
    echo -e "请创建项目目录: ${GREEN}mkdir -p ${PROJ_DIR}${NC}"
fi

# 检查目录权限
if [ -d "$PROJ_DIR" ]; then
    echo -n "检查目录权限: "
    OWNER=$(ls -ld $PROJ_DIR | awk '{print $3}')
    GROUP=$(ls -ld $PROJ_DIR | awk '{print $4}')
    
    if [ "$OWNER" = "www" ] || [ "$GROUP" = "www" ]; then
        echo -e "${GREEN}正确${NC}"
    else
        echo -e "${YELLOW}不正确${NC}"
        echo -e "建议设置目录权限: ${GREEN}chown -R www:www ${PROJ_DIR}${NC}"
    fi
fi

# 检查端口占用
echo -n "检查端口8081占用情况: "
PORT_CHECK=$(netstat -tln | grep ":8081" || echo "")
if [ -z "$PORT_CHECK" ]; then
    echo -e "${GREEN}未被占用${NC}"
else
    echo -e "${YELLOW}已被占用${NC}"
    echo -e "占用详情:"
    netstat -tln | grep ":8081"
    echo -e "可能需要更改应用配置的端口或停止占用端口的服务"
fi

# 检查防火墙
echo -n "检查防火墙端口8081: "
if command -v firewall-cmd &> /dev/null; then
    FIREWALL_STATUS=$(firewall-cmd --zone=public --query-port=8081/tcp 2>/dev/null || echo "no")
    if [ "$FIREWALL_STATUS" = "yes" ]; then
        echo -e "${GREEN}已开放${NC}"
    else
        echo -e "${YELLOW}未开放${NC}"
        echo -e "建议开放端口: ${GREEN}firewall-cmd --permanent --zone=public --add-port=8081/tcp && firewall-cmd --reload${NC}"
    fi
else
    echo -e "${YELLOW}未检测到firewall-cmd${NC}"
    echo -e "请在宝塔面板中确认防火墙设置"
fi

# 检查磁盘空间
echo -n "检查磁盘空间: "
DISK_SPACE=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
if [ $DISK_SPACE -lt 90 ]; then
    echo -e "${GREEN}充足 (使用率 ${DISK_SPACE}%)${NC}"
else
    echo -e "${RED}不足 (使用率 ${DISK_SPACE}%)${NC}"
    echo -e "磁盘空间不足，请清理磁盘"
fi

# 检查内存
echo -n "检查可用内存: "
FREE_MEM=$(free -m | awk 'NR==2 {print $7}')
if [ $FREE_MEM -gt 1024 ]; then
    echo -e "${GREEN}充足 (${FREE_MEM}MB可用)${NC}"
else
    echo -e "${YELLOW}较低 (${FREE_MEM}MB可用)${NC}"
    echo -e "可用内存较低，可能影响应用性能"
fi

# 总结
echo ""
echo "===================== 检查结果 ====================="
echo "请根据以上检查结果，解决存在的问题后再部署应用"
echo "推荐的部署步骤:"
echo "1. 确保Node.js和MySQL已正确安装"
echo "2. 创建项目目录并设置正确的权限"
echo "3. 上传项目文件到 ${PROJ_DIR}"
echo "4. 执行部署脚本 ${GREEN}bash bt-deploy.sh${NC}"
echo "5. 配置环境变量文件 .env"
echo "6. 使用宝塔Node.js管理器启动应用"
echo "===================== 结束 =====================" 