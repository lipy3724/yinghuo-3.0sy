#!/bin/bash

# 映火AI项目完整数据库备份脚本
# 创建时间: $(date '+%Y-%m-%d %H:%M:%S')
# 作者: AI助手

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 备份目录
BACKUP_DATE=$(date '+%Y%m%d_%H%M%S')
BACKUP_DIR="db_backups/complete_backup_${BACKUP_DATE}"
mkdir -p "$BACKUP_DIR"

log "开始完整数据库备份..."
log "项目路径: $PROJECT_ROOT"
log "备份目录: $BACKUP_DIR"

# 备份信息文件
BACKUP_INFO="$BACKUP_DIR/backup_info.txt"

# 写入备份信息
cat > "$BACKUP_INFO" << EOF
映火AI项目数据库完整备份报告
=====================================

备份时间: $(date '+%Y-%m-%d %H:%M:%S')
备份类型: 完整备份
备份目录: $BACKUP_DIR
项目路径: $PROJECT_ROOT

数据库备份详情:
EOF

# 1. SQLite数据库备份
log "正在备份SQLite数据库..."

if [ -f "yinghuo.db" ]; then
    # 复制数据库文件
    cp "yinghuo.db" "$BACKUP_DIR/yinghuo.db"
    
    # 导出SQL文件
    sqlite3 yinghuo.db .dump > "$BACKUP_DIR/yinghuo_${BACKUP_DATE}.sql"
    
    # 获取数据库信息
    USERS_COUNT=$(sqlite3 yinghuo.db "SELECT COUNT(*) FROM users;")
    FEATURE_USAGES_COUNT=$(sqlite3 yinghuo.db "SELECT COUNT(*) FROM feature_usages;")
    IMAGE_HISTORIES_COUNT=$(sqlite3 yinghuo.db "SELECT COUNT(*) FROM image_histories;")
    
    success "SQLite数据库备份完成"
    
    cat >> "$BACKUP_INFO" << EOF

1. SQLite数据库 (yinghuo.db)
   - 文件大小: $(ls -lh yinghuo.db | awk '{print $5}')
   - 用户数量: $USERS_COUNT
   - 功能使用记录: $FEATURE_USAGES_COUNT
   - 图片历史记录: $IMAGE_HISTORIES_COUNT
   - 备份文件: yinghuo.db, yinghuo_${BACKUP_DATE}.sql
EOF
else
    warning "未找到yinghuo.db文件"
    echo "   - SQLite主数据库: 未找到" >> "$BACKUP_INFO"
fi

# 备份其他SQLite文件
for db_file in database.db database.sqlite; do
    if [ -f "$db_file" ]; then
        cp "$db_file" "$BACKUP_DIR/$db_file"
        success "已备份 $db_file"
        echo "   - $db_file: 已备份" >> "$BACKUP_INFO"
    fi
done

# 2. MySQL数据库备份（如果配置了）
log "检查MySQL数据库配置..."

# 尝试从.env文件读取MySQL配置
if [ -f ".env" ]; then
    source .env 2>/dev/null || true
    
    if [ -n "$DB_HOST" ] && [ -n "$DB_NAME" ] && [ "$DB_DIALECT" != "sqlite" ]; then
        log "发现MySQL配置，尝试备份..."
        
        # 构建mysqldump命令
        MYSQL_CMD="mysqldump"
        MYSQL_ARGS="-h${DB_HOST:-localhost} -u${DB_USER:-root}"
        
        if [ -n "$DB_PASSWORD" ]; then
            MYSQL_ARGS="$MYSQL_ARGS -p$DB_PASSWORD"
        fi
        
        if [ -n "$DB_PORT" ]; then
            MYSQL_ARGS="$MYSQL_ARGS -P$DB_PORT"
        fi
        
        # 执行备份
        if command -v mysqldump >/dev/null 2>&1; then
            if $MYSQL_CMD $MYSQL_ARGS "$DB_NAME" > "$BACKUP_DIR/mysql_${DB_NAME}_${BACKUP_DATE}.sql" 2>/dev/null; then
                success "MySQL数据库备份完成"
                echo "   - MySQL数据库 ($DB_NAME): 备份成功" >> "$BACKUP_INFO"
            else
                warning "MySQL数据库备份失败，可能是连接问题"
                echo "   - MySQL数据库 ($DB_NAME): 备份失败" >> "$BACKUP_INFO"
            fi
        else
            warning "未找到mysqldump命令，跳过MySQL备份"
            echo "   - MySQL数据库: mysqldump命令未找到" >> "$BACKUP_INFO"
        fi
    else
        log "未配置MySQL数据库或使用SQLite"
        echo "   - MySQL数据库: 未配置或使用SQLite" >> "$BACKUP_INFO"
    fi
else
    warning "未找到.env文件，跳过MySQL备份"
    echo "   - MySQL数据库: .env文件未找到" >> "$BACKUP_INFO"
fi

# 3. MongoDB数据库备份（如果配置了）
log "检查MongoDB数据库配置..."

if [ -f ".env" ] && grep -q "MONGODB_URI" .env 2>/dev/null; then
    MONGODB_URI=$(grep "MONGODB_URI" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'")
    
    if [ -n "$MONGODB_URI" ] && command -v mongodump >/dev/null 2>&1; then
        log "发现MongoDB配置，尝试备份..."
        
        # 创建MongoDB备份目录
        MONGO_BACKUP_DIR="$BACKUP_DIR/mongodb_backup"
        mkdir -p "$MONGO_BACKUP_DIR"
        
        if mongodump --uri="$MONGODB_URI" --out="$MONGO_BACKUP_DIR" >/dev/null 2>&1; then
            success "MongoDB数据库备份完成"
            echo "   - MongoDB数据库: 备份成功" >> "$BACKUP_INFO"
        else
            warning "MongoDB数据库备份失败，可能是连接问题"
            echo "   - MongoDB数据库: 备份失败" >> "$BACKUP_INFO"
        fi
    else
        if [ -z "$MONGODB_URI" ]; then
            log "未配置MongoDB URI"
        else
            warning "未找到mongodump命令，跳过MongoDB备份"
        fi
        echo "   - MongoDB数据库: 未配置或mongodump命令未找到" >> "$BACKUP_INFO"
    fi
else
    log "未配置MongoDB数据库"
    echo "   - MongoDB数据库: 未配置" >> "$BACKUP_INFO"
fi

# 4. 备份重要配置文件
log "备份重要配置文件..."

CONFIG_BACKUP_DIR="$BACKUP_DIR/config_backup"
mkdir -p "$CONFIG_BACKUP_DIR"

# 备份配置文件（不包含敏感信息）
for config_file in package.json ecosystem.config.js; do
    if [ -f "$config_file" ]; then
        cp "$config_file" "$CONFIG_BACKUP_DIR/"
        success "已备份配置文件: $config_file"
    fi
done

# 备份数据库配置文件
if [ -d "config" ]; then
    cp -r config "$CONFIG_BACKUP_DIR/"
    success "已备份config目录"
fi

# 备份模型文件
if [ -d "models" ]; then
    cp -r models "$CONFIG_BACKUP_DIR/"
    success "已备份models目录"
fi

echo "   - 配置文件: 已备份" >> "$BACKUP_INFO"

# 5. 生成备份摘要
log "生成备份摘要..."

BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

cat >> "$BACKUP_INFO" << EOF

备份摘要:
========
- 备份总大小: $BACKUP_SIZE
- 备份文件数量: $(find "$BACKUP_DIR" -type f | wc -l)
- 备份完成时间: $(date '+%Y-%m-%d %H:%M:%S')

恢复说明:
========
1. SQLite数据库恢复:
   cp $BACKUP_DIR/yinghuo.db ./yinghuo.db
   或
   sqlite3 yinghuo.db < $BACKUP_DIR/yinghuo_${BACKUP_DATE}.sql

2. MySQL数据库恢复 (如果有备份):
   mysql -h\$DB_HOST -u\$DB_USER -p\$DB_PASSWORD \$DB_NAME < $BACKUP_DIR/mysql_${DB_NAME}_${BACKUP_DATE}.sql

3. MongoDB数据库恢复 (如果有备份):
   mongorestore --uri="\$MONGODB_URI" $BACKUP_DIR/mongodb_backup/

注意事项:
========
- 恢复前请备份当前数据库
- 确保目标环境的数据库版本兼容
- 恢复后检查数据完整性
- 敏感配置信息(.env)需要单独配置

EOF

# 6. 创建快速恢复脚本
log "创建快速恢复脚本..."

cat > "$BACKUP_DIR/restore.sh" << 'EOF'
#!/bin/bash

# 快速恢复脚本
# 使用方法: ./restore.sh [backup_dir]

set -e

BACKUP_DIR="${1:-$(dirname "$0")}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "开始恢复数据库..."
echo "备份目录: $BACKUP_DIR"
echo "项目目录: $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# 恢复SQLite数据库
if [ -f "$BACKUP_DIR/yinghuo.db" ]; then
    echo "恢复SQLite数据库..."
    cp "$BACKUP_DIR/yinghuo.db" ./yinghuo.db
    echo "SQLite数据库恢复完成"
fi

# 恢复其他数据库文件
for db_file in database.db database.sqlite; do
    if [ -f "$BACKUP_DIR/$db_file" ]; then
        cp "$BACKUP_DIR/$db_file" ./$db_file
        echo "已恢复 $db_file"
    fi
done

echo "数据库恢复完成！"
echo "请检查数据完整性并重启应用程序。"
EOF

chmod +x "$BACKUP_DIR/restore.sh"

# 7. 压缩备份（可选）
if command -v tar >/dev/null 2>&1; then
    log "压缩备份文件..."
    tar -czf "${BACKUP_DIR}.tar.gz" -C "db_backups" "complete_backup_${BACKUP_DATE}"
    success "备份已压缩为: ${BACKUP_DIR}.tar.gz"
    echo "   - 压缩文件: ${BACKUP_DIR}.tar.gz" >> "$BACKUP_INFO"
fi

# 完成
success "数据库备份完成！"
success "备份位置: $BACKUP_DIR"
success "备份信息: $BACKUP_INFO"

echo ""
echo "备份摘要:"
echo "========"
cat "$BACKUP_INFO" | tail -n +$(grep -n "备份摘要:" "$BACKUP_INFO" | cut -d: -f1)

echo ""
echo "下一步操作建议:"
echo "=============="
echo "1. 检查备份文件完整性"
echo "2. 将备份文件保存到安全位置"
echo "3. 定期执行备份（建议每日备份）"
echo "4. 测试恢复流程确保备份可用"

exit 0










