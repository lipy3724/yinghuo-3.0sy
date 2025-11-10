#!/bin/bash

# 映火AI项目 - MySQL数据库恢复脚本

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_FILE="$SCRIPT_DIR/yinghuo_mysql_backup.sql"

echo -e "${BLUE}映火AI项目 - MySQL数据库恢复${NC}"
echo "=================================="
echo "恢复时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "备份文件: $BACKUP_FILE"
echo ""

# 检查备份文件
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}错误: 备份文件不存在${NC}"
    exit 1
fi

# 检查XAMPP MySQL
if ! /Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${RED}错误: 无法连接到XAMPP MySQL${NC}"
    echo "请确保XAMPP已启动且MySQL服务正在运行"
    exit 1
fi

echo -e "${GREEN}✅ XAMPP MySQL连接正常${NC}"

# 恢复选项
echo ""
echo "请选择恢复方式:"
echo "1. 恢复到原数据库 (yinghuo) - 会覆盖现有数据"
echo "2. 恢复到新数据库 (yinghuo_restore)"
echo "3. 查看备份信息"
echo "4. 退出"
echo ""

read -p "请输入选择 (1-4): " choice

case $choice in
    1)
        echo -e "${YELLOW}警告: 这将覆盖现有数据！${NC}"
        read -p "确认继续？(输入 yes): " confirm
        if [ "$confirm" = "yes" ]; then
            echo "正在恢复..."
            /Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot yinghuo < "$BACKUP_FILE"
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ 恢复成功${NC}"
            else
                echo -e "${RED}❌ 恢复失败${NC}"
            fi
        fi
        ;;
    2)
        echo "创建新数据库 yinghuo_restore..."
        /Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "CREATE DATABASE IF NOT EXISTS yinghuo_restore;"
        /Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot yinghuo_restore < "$BACKUP_FILE"
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ 恢复到 yinghuo_restore 成功${NC}"
        else
            echo -e "${RED}❌ 恢复失败${NC}"
        fi
        ;;
    3)
        echo -e "${BLUE}备份信息:${NC}"
        cat "$SCRIPT_DIR/backup_info.txt"
        ;;
    4)
        exit 0
        ;;
esac
