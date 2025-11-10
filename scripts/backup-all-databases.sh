#!/bin/bash

# 完整数据库备份脚本
# 创建日期：$(date +%Y-%m-%d)
# 用途：备份模糊图片变清晰项目的所有数据库

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
echo "      完整数据库备份脚本 v1.0"
echo "======================================"

# 获取项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

log_info "项目根目录: $PROJECT_ROOT"

# 创建备份目录
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="db_backups/complete_$BACKUP_TIMESTAMP"
mkdir -p "$BACKUP_DIR"

log_info "创建完整备份目录: $BACKUP_DIR"

# 定义所有数据库文件
declare -a DATABASES=("yinghuo.db" "database.db" "database.sqlite")

# 备份计数器
BACKUP_COUNT=0
TOTAL_SIZE=0

# 备份每个数据库
for DB_FILE in "${DATABASES[@]}"; do
    DB_PATH="$PROJECT_ROOT/$DB_FILE"
    
    if [ -f "$DB_PATH" ]; then
        log_info "处理数据库: $DB_FILE"
        
        # 获取文件大小
        DB_SIZE=$(ls -lh "$DB_PATH" | awk '{print $5}')
        DB_SIZE_BYTES=$(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH" 2>/dev/null || echo "0")
        TOTAL_SIZE=$((TOTAL_SIZE + DB_SIZE_BYTES))
        
        # 复制数据库文件
        cp "$DB_PATH" "$BACKUP_DIR/$DB_FILE"
        if [ $? -eq 0 ]; then
            log_success "数据库文件复制完成: $DB_FILE ($DB_SIZE)"
        else
            log_error "数据库文件复制失败: $DB_FILE"
            continue
        fi
        
        # 检查是否为SQLite数据库并导出SQL
        if file "$DB_PATH" | grep -q "SQLite"; then
            # 检查数据库是否有内容
            TABLES=$(sqlite3 "$DB_PATH" ".tables" 2>/dev/null || echo "")
            
            if [ -n "$TABLES" ]; then
                # 导出SQL文件
                SQL_FILENAME="${DB_FILE%.*}_${BACKUP_TIMESTAMP}.sql"
                SQL_PATH="$BACKUP_DIR/$SQL_FILENAME"
                
                sqlite3 "$DB_PATH" .dump > "$SQL_PATH"
                if [ $? -eq 0 ]; then
                    SQL_SIZE=$(ls -lh "$SQL_PATH" | awk '{print $5}')
                    log_success "SQL文件导出完成: $SQL_FILENAME ($SQL_SIZE)"
                    
                    # 创建根目录备份副本
                    ROOT_SQL_FILENAME="${DB_FILE%.*}_backup_$(date +%Y%m%d).sql"
                    cp "$SQL_PATH" "$PROJECT_ROOT/$ROOT_SQL_FILENAME"
                    if [ $? -eq 0 ]; then
                        log_success "根目录备份创建: $ROOT_SQL_FILENAME"
                    fi
                    
                    # 显示表信息
                    log_info "数据库 $DB_FILE 包含的表: $TABLES"
                    for table in $TABLES; do
                        count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
                        log_info "  - 表 $table: $count 条记录"
                    done
                else
                    log_error "SQL文件导出失败: $DB_FILE"
                fi
            else
                log_warning "数据库 $DB_FILE 为空或无表"
            fi
        else
            log_warning "$DB_FILE 不是SQLite数据库，跳过SQL导出"
        fi
        
        BACKUP_COUNT=$((BACKUP_COUNT + 1))
    else
        log_warning "数据库文件不存在: $DB_FILE"
    fi
    
    echo ""
done

# 转换总大小为可读格式
if [ $TOTAL_SIZE -gt 1048576 ]; then
    TOTAL_SIZE_READABLE=$(echo "scale=1; $TOTAL_SIZE / 1048576" | bc)MB
elif [ $TOTAL_SIZE -gt 1024 ]; then
    TOTAL_SIZE_READABLE=$(echo "scale=1; $TOTAL_SIZE / 1024" | bc)KB
else
    TOTAL_SIZE_READABLE="${TOTAL_SIZE}B"
fi

# 生成完整备份信息文件
BACKUP_INFO="$BACKUP_DIR/complete_backup_info.txt"
cat > "$BACKUP_INFO" << EOF
完整数据库备份信息
=====================================

备份时间: $(date '+%Y-%m-%d %H:%M:%S')
备份目录: $BACKUP_DIR
备份文件数: $BACKUP_COUNT
总大小: $TOTAL_SIZE_READABLE

备份详情:
---------
EOF

# 添加每个数据库的详细信息
for DB_FILE in "${DATABASES[@]}"; do
    DB_PATH="$PROJECT_ROOT/$DB_FILE"
    if [ -f "$DB_PATH" ]; then
        DB_SIZE=$(ls -lh "$DB_PATH" | awk '{print $5}')
        echo "- $DB_FILE: $DB_SIZE" >> "$BACKUP_INFO"
        
        # 如果有对应的SQL文件，也记录
        SQL_FILENAME="${DB_FILE%.*}_${BACKUP_TIMESTAMP}.sql"
        if [ -f "$BACKUP_DIR/$SQL_FILENAME" ]; then
            SQL_SIZE=$(ls -lh "$BACKUP_DIR/$SQL_FILENAME" | awk '{print $5}')
            echo "  └── SQL导出: $SQL_FILENAME ($SQL_SIZE)" >> "$BACKUP_INFO"
        fi
    fi
done

cat >> "$BACKUP_INFO" << EOF

恢复命令:
---------
# 恢复主数据库:
cp $BACKUP_DIR/yinghuo.db ./yinghuo.db
# 或从SQL恢复:
sqlite3 yinghuo.db < yinghuo_backup_$(date +%Y%m%d).sql

# 恢复其他数据库:
cp $BACKUP_DIR/database.db ./database.db
cp $BACKUP_DIR/database.sqlite ./database.sqlite

备份完成状态: 成功
备份脚本版本: v1.0
EOF

log_success "完整备份信息文件创建: $BACKUP_INFO"

# 清理旧备份（保留最近5个完整备份）
log_info "清理旧的完整备份..."
cd "$PROJECT_ROOT/db_backups"
COMPLETE_BACKUP_COUNT=$(ls -1d complete_*/ 2>/dev/null | wc -l)

if [ $COMPLETE_BACKUP_COUNT -gt 5 ]; then
    OLD_BACKUPS=$(ls -1td complete_*/ | tail -n +6)
    for old_backup in $OLD_BACKUPS; do
        log_warning "删除旧的完整备份: $old_backup"
        rm -rf "$old_backup"
    done
    log_info "旧备份清理完成"
else
    log_info "完整备份文件数量正常 ($COMPLETE_BACKUP_COUNT/5)"
fi

# 备份完成总结
echo ""
echo "======================================"
echo "         完整备份总结"
echo "======================================"
log_success "完整数据库备份成功完成！"
echo ""
echo "📁 备份位置:"
echo "   - 备份目录: $BACKUP_DIR"
echo "   - 备份文件数: $BACKUP_COUNT"
echo "   - 总大小: $TOTAL_SIZE_READABLE"
echo ""
echo "📊 备份内容:"
for DB_FILE in "${DATABASES[@]}"; do
    if [ -f "$PROJECT_ROOT/$DB_FILE" ]; then
        DB_SIZE=$(ls -lh "$PROJECT_ROOT/$DB_FILE" | awk '{print $5}')
        echo "   - $DB_FILE: $DB_SIZE"
    fi
done
echo ""
echo "🔧 主要恢复命令:"
echo "   cp $BACKUP_DIR/yinghuo.db ./yinghuo.db"
echo "   # 或使用: sqlite3 yinghuo.db < yinghuo_backup_$(date +%Y%m%d).sql"
echo ""
echo "备份任务于 $(date '+%Y-%m-%d %H:%M:%S') 完成"
echo "======================================"
