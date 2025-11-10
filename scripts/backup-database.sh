#!/bin/bash

# 数据库备份脚本
# 创建日期：$(date +%Y-%m-%d)
# 用途：备份模糊图片变清晰项目的SQLite数据库

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 脚本开始
echo "======================================"
echo "      数据库备份脚本 v1.0"
echo "======================================"

# 获取项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

log_info "项目根目录: $PROJECT_ROOT"

# 数据库文件路径
DB_FILE="yinghuo.db"
DB_PATH="$PROJECT_ROOT/$DB_FILE"

# 检查数据库文件是否存在
if [ ! -f "$DB_PATH" ]; then
    log_error "数据库文件不存在: $DB_PATH"
    exit 1
fi

log_info "找到数据库文件: $DB_PATH"

# 获取数据库文件大小
DB_SIZE=$(ls -lh "$DB_PATH" | awk '{print $5}')
log_info "数据库文件大小: $DB_SIZE"

# 创建备份目录
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="db_backups/$BACKUP_TIMESTAMP"
mkdir -p "$BACKUP_DIR"

log_info "创建备份目录: $BACKUP_DIR"

# 1. 复制数据库文件（二进制备份）
log_info "开始复制数据库文件..."
cp "$DB_PATH" "$BACKUP_DIR/yinghuo.db"

if [ $? -eq 0 ]; then
    log_success "数据库文件复制完成: $BACKUP_DIR/yinghuo.db"
else
    log_error "数据库文件复制失败"
    exit 1
fi

# 2. 导出SQL文件
SQL_FILENAME="yinghuo_${BACKUP_TIMESTAMP}.sql"
SQL_PATH="$BACKUP_DIR/$SQL_FILENAME"

log_info "开始导出SQL文件..."

# 检查sqlite3命令是否存在
if ! command -v sqlite3 &> /dev/null; then
    log_error "sqlite3 命令未找到，请安装SQLite3"
    exit 1
fi

# 导出数据库结构和数据到SQL文件
sqlite3 "$DB_PATH" .dump > "$SQL_PATH"

if [ $? -eq 0 ]; then
    log_success "SQL文件导出完成: $SQL_PATH"
    
    # 检查SQL文件大小
    SQL_SIZE=$(ls -lh "$SQL_PATH" | awk '{print $5}')
    log_info "SQL文件大小: $SQL_SIZE"
else
    log_error "SQL文件导出失败"
    exit 1
fi

# 3. 创建项目根目录的备份副本
ROOT_SQL_FILENAME="yinghuo_backup_$(date +%Y%m%d).sql"
ROOT_SQL_PATH="$PROJECT_ROOT/$ROOT_SQL_FILENAME"

log_info "创建根目录备份副本..."
cp "$SQL_PATH" "$ROOT_SQL_PATH"

if [ $? -eq 0 ]; then
    log_success "根目录备份创建完成: $ROOT_SQL_FILENAME"
else
    log_warning "根目录备份创建失败"
fi

# 4. 生成备份信息文件
BACKUP_INFO="$BACKUP_DIR/backup_info.txt"
cat > "$BACKUP_INFO" << EOF
数据库备份信息
=====================================

备份时间: $(date '+%Y-%m-%d %H:%M:%S')
备份目录: $BACKUP_DIR
原数据库: $DB_PATH
数据库大小: $DB_SIZE

备份文件:
- 数据库文件: yinghuo.db ($DB_SIZE)
- SQL导出文件: $SQL_FILENAME ($SQL_SIZE)

恢复命令:
---------
# 从SQL文件恢复:
sqlite3 yinghuo.db < $SQL_PATH

# 从数据库文件恢复:
cp $BACKUP_DIR/yinghuo.db ./yinghuo.db

备份完成状态: 成功
EOF

log_success "备份信息文件创建完成: $BACKUP_INFO"

# 5. 显示数据库表信息
log_info "检查数据库表结构..."
TABLES=$(sqlite3 "$DB_PATH" ".tables")
if [ -n "$TABLES" ]; then
    log_info "数据库包含的表: $TABLES"
    
    # 统计各表记录数
    echo "" >> "$BACKUP_INFO"
    echo "数据表统计:" >> "$BACKUP_INFO"
    echo "============" >> "$BACKUP_INFO"
    
    for table in $TABLES; do
        count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM $table;")
        log_info "表 $table: $count 条记录"
        echo "- $table: $count 条记录" >> "$BACKUP_INFO"
    done
else
    log_warning "数据库中未找到表"
fi

# 6. 清理旧备份（保留最近10个备份）
log_info "清理旧备份文件..."
cd "$PROJECT_ROOT/db_backups"
BACKUP_COUNT=$(ls -1d */ 2>/dev/null | wc -l)

if [ $BACKUP_COUNT -gt 10 ]; then
    OLD_BACKUPS=$(ls -1td */ | tail -n +11)
    for old_backup in $OLD_BACKUPS; do
        log_warning "删除旧备份: $old_backup"
        rm -rf "$old_backup"
    done
    log_info "旧备份清理完成"
else
    log_info "备份文件数量正常 ($BACKUP_COUNT/10)"
fi

# 7. 更新README备份说明
cd "$PROJECT_ROOT"
if [ -f "README-数据库备份说明.md" ]; then
    log_info "更新备份说明文档..."
    
    # 更新最近备份信息
    sed -i.bak "s/- 最新备份日期：.*/- 最新备份日期：$(date '+%Y年%m月%d日')/" README-数据库备份说明.md
    sed -i.bak "s/- 备份文件：.*/- 备份文件：\`$ROOT_SQL_FILENAME\`/" README-数据库备份说明.md
    sed -i.bak "s/- 备份目录：.*/- 备份目录：\`$BACKUP_DIR\`/" README-数据库备份说明.md
    
    # 删除备份文件
    rm -f README-数据库备份说明.md.bak
    
    log_success "备份说明文档更新完成"
fi

# 备份完成总结
echo ""
echo "======================================"
echo "         备份完成总结"
echo "======================================"
log_success "数据库备份成功完成！"
echo ""
echo "📁 备份位置:"
echo "   - 备份目录: $BACKUP_DIR"
echo "   - SQL文件: $ROOT_SQL_FILENAME"
echo ""
echo "📊 备份内容:"
echo "   - 数据库文件: $DB_SIZE"
echo "   - SQL导出: $SQL_SIZE"
if [ -n "$TABLES" ]; then
    echo "   - 数据表: $TABLES"
fi
echo ""
echo "🔧 恢复命令:"
echo "   sqlite3 yinghuo.db < $ROOT_SQL_FILENAME"
echo ""
echo "备份任务于 $(date '+%Y-%m-%d %H:%M:%S') 完成"
echo "======================================"
