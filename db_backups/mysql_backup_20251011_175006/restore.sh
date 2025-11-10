#!/bin/bash

# 映火AI项目 - MySQL数据库恢复脚本
# 创建时间: $(date '+%Y-%m-%d %H:%M:%S')

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

# 检查备份文件是否存在
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}错误: 备份文件不存在: $BACKUP_FILE${NC}"
    exit 1
fi

# 检查XAMPP MySQL是否可用
if ! /Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${RED}错误: 无法连接到XAMPP MySQL数据库${NC}"
    echo "请确保:"
    echo "1. XAMPP已启动"
    echo "2. MySQL服务正在运行"
    echo "3. 数据库连接配置正确"
    exit 1
fi

echo -e "${GREEN}✅ XAMPP MySQL连接正常${NC}"

# 显示恢复选项
echo ""
echo "请选择恢复方式:"
echo "1. 恢复到原数据库 (yinghuo) - 会覆盖现有数据"
echo "2. 恢复到新数据库 (yinghuo_restore) - 保留原数据"
echo "3. 仅查看备份信息"
echo "4. 退出"
echo ""

read -p "请输入选择 (1-4): " choice

case $choice in
    1)
        echo ""
        echo -e "${YELLOW}警告: 这将覆盖现有的 yinghuo 数据库！${NC}"
        read -p "确认继续？(输入 yes 确认): " confirm
        
        if [ "$confirm" = "yes" ]; then
            echo ""
            echo "正在恢复到 yinghuo 数据库..."
            
            # 备份当前数据库
            CURRENT_BACKUP="yinghuo_backup_before_restore_$(date +%Y%m%d_%H%M%S).sql"
            echo "正在备份当前数据库到: $CURRENT_BACKUP"
            /Applications/XAMPP/bin/mysqldump -h127.0.0.1 -uroot --single-transaction yinghuo > "$SCRIPT_DIR/$CURRENT_BACKUP"
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ 当前数据库已备份${NC}"
            else
                echo -e "${RED}❌ 当前数据库备份失败${NC}"
                exit 1
            fi
            
            # 恢复数据库
            echo "正在恢复数据库..."
            /Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot yinghuo < "$BACKUP_FILE"
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ 数据库恢复成功！${NC}"
                echo ""
                echo "恢复统计:"
                /Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "
                    USE yinghuo;
                    SELECT 'users' as table_name, COUNT(*) as count FROM users
                    UNION ALL
                    SELECT 'feature_usages', COUNT(*) FROM feature_usages
                    UNION ALL
                    SELECT 'image_histories', COUNT(*) FROM image_histories
                    UNION ALL
                    SELECT 'customer_messages', COUNT(*) FROM customer_messages
                    UNION ALL
                    SELECT 'payment_orders', COUNT(*) FROM payment_orders;
                "
            else
                echo -e "${RED}❌ 数据库恢复失败${NC}"
                echo "可以使用以下命令恢复原数据库:"
                echo "/Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot yinghuo < $SCRIPT_DIR/$CURRENT_BACKUP"
                exit 1
            fi
        else
            echo "恢复已取消"
        fi
        ;;
        
    2)
        echo ""
        echo "正在创建新数据库 yinghuo_restore..."
        
        # 创建新数据库
        /Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "CREATE DATABASE IF NOT EXISTS yinghuo_restore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ 数据库 yinghuo_restore 创建成功${NC}"
        else
            echo -e "${RED}❌ 数据库创建失败${NC}"
            exit 1
        fi
        
        # 恢复到新数据库
        echo "正在恢复数据到 yinghuo_restore..."
        /Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot yinghuo_restore < "$BACKUP_FILE"
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ 数据恢复到 yinghuo_restore 成功！${NC}"
            echo ""
            echo "恢复统计:"
            /Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "
                USE yinghuo_restore;
                SELECT 'users' as table_name, COUNT(*) as count FROM users
                UNION ALL
                SELECT 'feature_usages', COUNT(*) FROM feature_usages
                UNION ALL
                SELECT 'image_histories', COUNT(*) FROM image_histories
                UNION ALL
                SELECT 'customer_messages', COUNT(*) FROM customer_messages
                UNION ALL
                SELECT 'payment_orders', COUNT(*) FROM payment_orders;
            "
            echo ""
            echo "可以通过以下方式访问恢复的数据库:"
            echo "数据库名: yinghuo_restore"
            echo "连接命令: /Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot yinghuo_restore"
        else
            echo -e "${RED}❌ 数据恢复失败${NC}"
            exit 1
        fi
        ;;
        
    3)
        echo ""
        echo -e "${BLUE}备份文件信息:${NC}"
        echo "文件路径: $BACKUP_FILE"
        echo "文件大小: $(ls -lh "$BACKUP_FILE" | awk '{print $5}')"
        echo "创建时间: $(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$BACKUP_FILE" 2>/dev/null || stat -c "%y" "$BACKUP_FILE" 2>/dev/null)"
        echo ""
        echo "备份内容预览:"
        head -20 "$BACKUP_FILE" | grep -E "(CREATE TABLE|INSERT INTO)" | head -10
        ;;
        
    4)
        echo "退出恢复程序"
        exit 0
        ;;
        
    *)
        echo -e "${RED}无效选择${NC}"
        exit 1
        ;;
esac

echo ""
echo "=================================="
echo "恢复操作完成！"










