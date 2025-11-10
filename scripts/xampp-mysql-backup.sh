#!/bin/bash

# 映火AI项目 - XAMPP MySQL数据库备份脚本
# 专门用于备份XAMPP中的MySQL数据库

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log() {
    echo -e "$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> logs/mysql_backup.log 2>/dev/null || true
}

log_success() {
    log "${GREEN}✅ $1${NC}"
}

log_error() {
    log "${RED}❌ $1${NC}"
}

log_warning() {
    log "${YELLOW}⚠️  $1${NC}"
}

log_info() {
    log "${BLUE}ℹ️  $1${NC}"
}

# 创建日志目录
mkdir -p logs

log_info "开始XAMPP MySQL数据库备份"
log_info "项目路径: $PROJECT_ROOT"

# 检查XAMPP MySQL工具
MYSQL_BIN="/Applications/XAMPP/bin/mysql"
MYSQLDUMP_BIN="/Applications/XAMPP/bin/mysqldump"

if [ ! -f "$MYSQL_BIN" ]; then
    log_error "XAMPP MySQL未找到: $MYSQL_BIN"
    log_error "请确保XAMPP已正确安装"
    exit 1
fi

if [ ! -f "$MYSQLDUMP_BIN" ]; then
    log_error "XAMPP mysqldump未找到: $MYSQLDUMP_BIN"
    exit 1
fi

log_success "XAMPP MySQL工具检查通过"

# 数据库配置
DB_HOST="127.0.0.1"
DB_USER="root"
DB_PASSWORD=""
DB_NAME="yinghuo"
DB_PORT="3306"

log_info "数据库配置:"
log_info "  主机: $DB_HOST:$DB_PORT"
log_info "  用户: $DB_USER"
log_info "  数据库: $DB_NAME"

# 测试数据库连接
log_info "测试数据库连接..."
if ! $MYSQL_BIN -h$DB_HOST -u$DB_USER -e "USE $DB_NAME; SELECT 1;" >/dev/null 2>&1; then
    log_error "无法连接到数据库 $DB_NAME"
    log_error "请检查:"
    log_error "  1. XAMPP是否已启动"
    log_error "  2. MySQL服务是否正在运行"
    log_error "  3. 数据库 $DB_NAME 是否存在"
    exit 1
fi

log_success "数据库连接成功"

# 获取数据库统计信息
log_info "获取数据库统计信息..."
DB_STATS=$($MYSQL_BIN -h$DB_HOST -u$DB_USER -e "
USE $DB_NAME;
SELECT 
    CONCAT('用户数量: ', (SELECT COUNT(*) FROM users)) as stat
UNION ALL
SELECT 
    CONCAT('功能使用记录: ', (SELECT COUNT(*) FROM feature_usages))
UNION ALL
SELECT 
    CONCAT('图片历史记录: ', (SELECT COUNT(*) FROM image_histories))
UNION ALL
SELECT 
    CONCAT('客服消息: ', (SELECT COUNT(*) FROM customer_messages))
UNION ALL
SELECT 
    CONCAT('支付订单: ', (SELECT COUNT(*) FROM payment_orders));
" 2>/dev/null | tail -n +2)

log_info "数据库统计:"
echo "$DB_STATS" | while read line; do
    log_info "  $line"
done

# 创建备份目录
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="db_backups/mysql_backup_$BACKUP_DATE"
mkdir -p "$BACKUP_DIR"

log_info "备份目录: $BACKUP_DIR"

# 执行MySQL备份
log_info "开始备份MySQL数据库..."
BACKUP_FILE="$BACKUP_DIR/yinghuo_mysql_backup.sql"

# 使用mysqldump备份（不包含存储过程，避免版本兼容问题）
$MYSQLDUMP_BIN -h$DB_HOST -u$DB_USER \
    --single-transaction \
    --add-drop-table \
    --create-options \
    --disable-keys \
    --extended-insert \
    --quick \
    --lock-tables=false \
    $DB_NAME > "$BACKUP_FILE" 2>/dev/null

if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    log_success "MySQL备份完成: yinghuo_mysql_backup.sql ($BACKUP_SIZE)"
else
    log_error "MySQL备份失败"
    exit 1
fi

# 创建备份信息文件
log_info "创建备份信息文件..."
cat > "$BACKUP_DIR/backup_info.txt" << EOF
映火AI项目 - XAMPP MySQL数据库备份报告
=====================================

备份时间: $(date '+%Y-%m-%d %H:%M:%S')
备份类型: MySQL完整备份
数据库: $DB_NAME (XAMPP MariaDB)
备份目录: $BACKUP_DIR
项目路径: $PROJECT_ROOT

数据库配置:
- 主机: $DB_HOST:$DB_PORT
- 用户: $DB_USER
- 数据库: $DB_NAME

数据库统计:
$DB_STATS

备份文件:
- yinghuo_mysql_backup.sql ($BACKUP_SIZE)

数据库表信息:
$(echo "SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema = '$DB_NAME' ORDER BY table_name;" | $MYSQL_BIN -h$DB_HOST -u$DB_USER 2>/dev/null)

恢复说明:
========
1. 快速恢复（使用恢复脚本）:
   cd $BACKUP_DIR
   ./restore.sh

2. 手动恢复到原数据库:
   /Applications/XAMPP/bin/mysql -h$DB_HOST -u$DB_USER $DB_NAME < $BACKUP_FILE

3. 恢复到新数据库:
   /Applications/XAMPP/bin/mysql -h$DB_HOST -u$DB_USER -e "CREATE DATABASE yinghuo_restore;"
   /Applications/XAMPP/bin/mysql -h$DB_HOST -u$DB_USER yinghuo_restore < $BACKUP_FILE

注意事项:
========
- 恢复前请备份当前数据库
- 确保XAMPP MySQL服务正在运行
- 备份文件包含完整的表结构和数据
- 不包含存储过程和触发器（避免版本兼容问题）

备份完成时间: $(date '+%Y-%m-%d %H:%M:%S')
EOF

log_success "备份信息文件已创建"

# 创建恢复脚本
log_info "创建恢复脚本..."
cat > "$BACKUP_DIR/restore.sh" << 'EOF'
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
EOF

chmod +x "$BACKUP_DIR/restore.sh"
log_success "恢复脚本已创建"

# 压缩备份文件
log_info "压缩备份文件..."
cd db_backups
tar -czf "mysql_backup_$BACKUP_DATE.tar.gz" "mysql_backup_$BACKUP_DATE/"
if [ $? -eq 0 ]; then
    COMPRESSED_SIZE=$(ls -lh "mysql_backup_$BACKUP_DATE.tar.gz" | awk '{print $5}')
    log_success "备份文件已压缩: mysql_backup_$BACKUP_DATE.tar.gz ($COMPRESSED_SIZE)"
else
    log_warning "备份文件压缩失败"
fi
cd "$PROJECT_ROOT"

# 清理旧备份（保留最近7个）
log_info "清理旧备份文件..."
cd db_backups
OLD_BACKUPS=$(ls -1 mysql_backup_*.tar.gz 2>/dev/null | head -n -7)
if [ -n "$OLD_BACKUPS" ]; then
    echo "$OLD_BACKUPS" | while read backup; do
        rm -f "$backup"
        log_info "已删除旧备份: $backup"
    done
    
    # 清理对应的目录
    OLD_DIRS=$(ls -1d mysql_backup_*/ 2>/dev/null | head -n -7)
    if [ -n "$OLD_DIRS" ]; then
        echo "$OLD_DIRS" | while read dir; do
            rm -rf "$dir"
            log_info "已删除旧备份目录: $dir"
        done
    fi
else
    log_info "无需清理旧备份"
fi
cd "$PROJECT_ROOT"

# 备份摘要
log_success "备份完成！"
log_info "备份摘要:"
log_info "  备份目录: $BACKUP_DIR"
log_info "  备份文件: yinghuo_mysql_backup.sql ($BACKUP_SIZE)"
log_info "  压缩文件: mysql_backup_$BACKUP_DATE.tar.gz"
log_info "  恢复脚本: $BACKUP_DIR/restore.sh"

echo ""
echo -e "${GREEN}🎉 XAMPP MySQL数据库备份成功完成！${NC}"
echo ""
echo "快速恢复命令:"
echo "  cd $BACKUP_DIR && ./restore.sh"
echo ""
echo "备份位置:"
echo "  目录: $BACKUP_DIR"
echo "  压缩: db_backups/mysql_backup_$BACKUP_DATE.tar.gz"

exit 0










