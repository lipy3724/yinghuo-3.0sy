#!/bin/bash

# 智能数据库备份脚本 v2.0
# 创建日期：$(date +%Y-%m-%d)
# 用途：自动识别并备份项目使用的所有数据库（MySQL/SQLite）

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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

log_header() {
    echo -e "${PURPLE}[HEADER]${NC} $1"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# 脚本开始
clear
echo "=========================================="
echo "      🗄️ 智能数据库备份脚本 v2.0"
echo "=========================================="
echo ""

# 获取项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

log_info "项目根目录: $PROJECT_ROOT"
echo ""

# 创建备份目录
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="db_backups/smart_backup_$BACKUP_TIMESTAMP"
mkdir -p "$BACKUP_DIR"

log_info "创建智能备份目录: $BACKUP_DIR"

# 加载环境变量
if [ -f ".env" ]; then
    log_info "加载环境变量..."
    export $(grep -v '^#' .env | xargs)
    log_success "环境变量加载完成"
else
    log_warning "未找到 .env 文件，使用默认配置"
fi

# 初始化计数器
TOTAL_BACKUPS=0
SUCCESSFUL_BACKUPS=0
FAILED_BACKUPS=0
TOTAL_SIZE=0

# 1. 检测和备份SQLite数据库
log_header "🔍 第一步：检测SQLite数据库"
echo ""

# 定义SQLite数据库文件
declare -a SQLITE_DBS=("yinghuo.db" "database.db" "database.sqlite")
SQLITE_COUNT=0

for DB_FILE in "${SQLITE_DBS[@]}"; do
    DB_PATH="$PROJECT_ROOT/$DB_FILE"
    
    if [ -f "$DB_PATH" ]; then
        # 检查文件大小
        DB_SIZE_BYTES=$(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH" 2>/dev/null || echo "0")
        
        if [ $DB_SIZE_BYTES -gt 0 ]; then
            log_step "处理SQLite数据库: $DB_FILE"
            
            DB_SIZE=$(ls -lh "$DB_PATH" | awk '{print $5}')
            TOTAL_SIZE=$((TOTAL_SIZE + DB_SIZE_BYTES))
            TOTAL_BACKUPS=$((TOTAL_BACKUPS + 1))
            
            # 复制数据库文件
            cp "$DB_PATH" "$BACKUP_DIR/$DB_FILE"
            if [ $? -eq 0 ]; then
                log_success "数据库文件备份完成: $DB_FILE ($DB_SIZE)"
            else
                log_error "数据库文件备份失败: $DB_FILE"
                FAILED_BACKUPS=$((FAILED_BACKUPS + 1))
                continue
            fi
            
            # 检查是否为有效的SQLite数据库
            if sqlite3 "$DB_PATH" ".tables" >/dev/null 2>&1; then
                TABLES=$(sqlite3 "$DB_PATH" ".tables" 2>/dev/null)
                
                if [ -n "$TABLES" ]; then
                    # 导出SQL文件
                    SQL_FILENAME="${DB_FILE%.*}_${BACKUP_TIMESTAMP}.sql"
                    SQL_PATH="$BACKUP_DIR/$SQL_FILENAME"
                    
                    log_info "导出SQL文件: $SQL_FILENAME"
                    sqlite3 "$DB_PATH" .dump > "$SQL_PATH"
                    
                    if [ $? -eq 0 ]; then
                        SQL_SIZE=$(ls -lh "$SQL_PATH" | awk '{print $5}')
                        log_success "SQL文件导出完成: $SQL_FILENAME ($SQL_SIZE)"
                        
                        # 创建根目录备份副本
                        ROOT_SQL_FILENAME="${DB_FILE%.*}_backup_$(date +%Y%m%d).sql"
                        cp "$SQL_PATH" "$PROJECT_ROOT/$ROOT_SQL_FILENAME"
                        if [ $? -eq 0 ]; then
                            log_success "根目录SQL备份: $ROOT_SQL_FILENAME"
                        fi
                        
                        # 显示表统计信息
                        log_info "数据表统计:"
                        for table in $TABLES; do
                            count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
                            echo "    📊 表 $table: $count 条记录"
                        done
                        
                        SUCCESSFUL_BACKUPS=$((SUCCESSFUL_BACKUPS + 1))
                    else
                        log_error "SQL文件导出失败: $DB_FILE"
                        FAILED_BACKUPS=$((FAILED_BACKUPS + 1))
                    fi
                else
                    log_warning "数据库 $DB_FILE 为空或无表"
                    SUCCESSFUL_BACKUPS=$((SUCCESSFUL_BACKUPS + 1))
                fi
            else
                log_warning "$DB_FILE 不是有效的SQLite数据库"
                SUCCESSFUL_BACKUPS=$((SUCCESSFUL_BACKUPS + 1))
            fi
            
            SQLITE_COUNT=$((SQLITE_COUNT + 1))
        else
            log_warning "数据库文件 $DB_FILE 为空，跳过"
        fi
    else
        log_info "SQLite数据库文件不存在: $DB_FILE"
    fi
    echo ""
done

# 2. 检测和备份MySQL数据库
log_header "🔍 第二步：检测MySQL数据库"
echo ""

# MySQL配置
MYSQL_HOST="${DB_HOST:-localhost}"
MYSQL_USER="${DB_USER:-root}"
MYSQL_PASSWORD="${DB_PASSWORD:-}"
MYSQL_DATABASE="${DB_NAME:-yinghuo}"
MYSQL_PORT="${DB_PORT:-3306}"

log_info "MySQL配置信息:"
echo "    🖥️  主机: $MYSQL_HOST:$MYSQL_PORT"
echo "    👤 用户: $MYSQL_USER"
echo "    🗄️  数据库: $MYSQL_DATABASE"
echo "    🔑 密码: ${MYSQL_PASSWORD:+已设置}${MYSQL_PASSWORD:-未设置}"
echo ""

# 检查MySQL连接
MYSQL_AVAILABLE=false
if command -v mysql >/dev/null 2>&1; then
    log_step "测试MySQL连接..."
    
    # 构建MySQL连接命令
    MYSQL_CMD="mysql -h$MYSQL_HOST -P$MYSQL_PORT -u$MYSQL_USER"
    if [ -n "$MYSQL_PASSWORD" ]; then
        MYSQL_CMD="$MYSQL_CMD -p$MYSQL_PASSWORD"
    fi
    
    # 测试连接
    if echo "SELECT 1;" | $MYSQL_CMD "$MYSQL_DATABASE" >/dev/null 2>&1; then
        log_success "MySQL数据库连接成功"
        MYSQL_AVAILABLE=true
        
        # 获取数据库信息
        MYSQL_VERSION=$($MYSQL_CMD -e "SELECT VERSION();" 2>/dev/null | tail -n 1)
        MYSQL_TABLES=$($MYSQL_CMD "$MYSQL_DATABASE" -e "SHOW TABLES;" 2>/dev/null | tail -n +2)
        
        log_info "MySQL版本: $MYSQL_VERSION"
        
        if [ -n "$MYSQL_TABLES" ]; then
            log_info "数据表列表:"
            echo "$MYSQL_TABLES" | while read table; do
                if [ -n "$table" ]; then
                    count=$($MYSQL_CMD "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM $table;" 2>/dev/null | tail -n 1)
                    echo "    📊 表 $table: $count 条记录"
                fi
            done
            
            # 备份MySQL数据库
            log_step "备份MySQL数据库..."
            MYSQL_BACKUP_FILE="mysql_${MYSQL_DATABASE}_${BACKUP_TIMESTAMP}.sql"
            MYSQL_BACKUP_PATH="$BACKUP_DIR/$MYSQL_BACKUP_FILE"
            
            # 构建mysqldump命令
            MYSQLDUMP_CMD="mysqldump -h$MYSQL_HOST -P$MYSQL_PORT -u$MYSQL_USER"
            if [ -n "$MYSQL_PASSWORD" ]; then
                MYSQLDUMP_CMD="$MYSQLDUMP_CMD -p$MYSQL_PASSWORD"
            fi
            MYSQLDUMP_CMD="$MYSQLDUMP_CMD --routines --triggers --single-transaction"
            
            # 执行备份
            $MYSQLDUMP_CMD "$MYSQL_DATABASE" > "$MYSQL_BACKUP_PATH"
            
            if [ $? -eq 0 ]; then
                MYSQL_SIZE=$(ls -lh "$MYSQL_BACKUP_PATH" | awk '{print $5}')
                log_success "MySQL备份完成: $MYSQL_BACKUP_FILE ($MYSQL_SIZE)"
                
                # 创建根目录备份副本
                ROOT_MYSQL_FILENAME="mysql_${MYSQL_DATABASE}_backup_$(date +%Y%m%d).sql"
                cp "$MYSQL_BACKUP_PATH" "$PROJECT_ROOT/$ROOT_MYSQL_FILENAME"
                if [ $? -eq 0 ]; then
                    log_success "根目录MySQL备份: $ROOT_MYSQL_FILENAME"
                fi
                
                TOTAL_BACKUPS=$((TOTAL_BACKUPS + 1))
                SUCCESSFUL_BACKUPS=$((SUCCESSFUL_BACKUPS + 1))
                
                # 计算文件大小
                MYSQL_SIZE_BYTES=$(stat -f%z "$MYSQL_BACKUP_PATH" 2>/dev/null || stat -c%s "$MYSQL_BACKUP_PATH" 2>/dev/null || echo "0")
                TOTAL_SIZE=$((TOTAL_SIZE + MYSQL_SIZE_BYTES))
            else
                log_error "MySQL备份失败"
                FAILED_BACKUPS=$((FAILED_BACKUPS + 1))
            fi
        else
            log_warning "MySQL数据库中无表或无法获取表信息"
        fi
    else
        log_warning "无法连接到MySQL数据库"
        log_info "可能原因："
        echo "    • MySQL服务未启动"
        echo "    • 连接配置错误"
        echo "    • 权限不足"
        echo "    • 数据库不存在"
    fi
else
    log_warning "MySQL客户端未安装，跳过MySQL备份"
fi

echo ""

# 3. 生成备份报告
log_header "📊 第三步：生成备份报告"
echo ""

# 转换总大小为可读格式
if [ $TOTAL_SIZE -gt 1073741824 ]; then
    TOTAL_SIZE_READABLE=$(echo "scale=2; $TOTAL_SIZE / 1073741824" | bc 2>/dev/null || echo "$(($TOTAL_SIZE / 1073741824))")GB
elif [ $TOTAL_SIZE -gt 1048576 ]; then
    TOTAL_SIZE_READABLE=$(echo "scale=1; $TOTAL_SIZE / 1048576" | bc 2>/dev/null || echo "$(($TOTAL_SIZE / 1048576))")MB
elif [ $TOTAL_SIZE -gt 1024 ]; then
    TOTAL_SIZE_READABLE=$(echo "scale=1; $TOTAL_SIZE / 1024" | bc 2>/dev/null || echo "$(($TOTAL_SIZE / 1024))")KB
else
    TOTAL_SIZE_READABLE="${TOTAL_SIZE}B"
fi

# 生成详细备份报告
BACKUP_REPORT="$BACKUP_DIR/backup_report.txt"
cat > "$BACKUP_REPORT" << EOF
智能数据库备份报告
=====================================

备份时间: $(date '+%Y-%m-%d %H:%M:%S')
备份目录: $BACKUP_DIR
脚本版本: v2.0

📊 备份统计:
-----------
总备份任务: $TOTAL_BACKUPS
成功备份: $SUCCESSFUL_BACKUPS
失败备份: $FAILED_BACKUPS
总大小: $TOTAL_SIZE_READABLE

🗄️ SQLite数据库:
---------------
处理文件数: $SQLITE_COUNT
EOF

# 添加SQLite详情
for DB_FILE in "${SQLITE_DBS[@]}"; do
    if [ -f "$PROJECT_ROOT/$DB_FILE" ]; then
        DB_SIZE_BYTES=$(stat -f%z "$PROJECT_ROOT/$DB_FILE" 2>/dev/null || stat -c%s "$PROJECT_ROOT/$DB_FILE" 2>/dev/null || echo "0")
        if [ $DB_SIZE_BYTES -gt 0 ]; then
            DB_SIZE=$(ls -lh "$PROJECT_ROOT/$DB_FILE" | awk '{print $5}')
            echo "- $DB_FILE: $DB_SIZE" >> "$BACKUP_REPORT"
            
            # 添加表统计
            if sqlite3 "$PROJECT_ROOT/$DB_FILE" ".tables" >/dev/null 2>&1; then
                TABLES=$(sqlite3 "$PROJECT_ROOT/$DB_FILE" ".tables" 2>/dev/null)
                if [ -n "$TABLES" ]; then
                    for table in $TABLES; do
                        count=$(sqlite3 "$PROJECT_ROOT/$DB_FILE" "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
                        echo "  └── 表 $table: $count 条记录" >> "$BACKUP_REPORT"
                    done
                fi
            fi
        fi
    fi
done

# 添加MySQL详情
cat >> "$BACKUP_REPORT" << EOF

🖥️ MySQL数据库:
--------------
连接状态: ${MYSQL_AVAILABLE:+可用}${MYSQL_AVAILABLE:-不可用}
主机: $MYSQL_HOST:$MYSQL_PORT
数据库: $MYSQL_DATABASE
用户: $MYSQL_USER
EOF

if [ "$MYSQL_AVAILABLE" = true ]; then
    if [ -f "$BACKUP_DIR/mysql_${MYSQL_DATABASE}_${BACKUP_TIMESTAMP}.sql" ]; then
        MYSQL_SIZE=$(ls -lh "$BACKUP_DIR/mysql_${MYSQL_DATABASE}_${BACKUP_TIMESTAMP}.sql" | awk '{print $5}')
        echo "备份文件: mysql_${MYSQL_DATABASE}_${BACKUP_TIMESTAMP}.sql ($MYSQL_SIZE)" >> "$BACKUP_REPORT"
    fi
fi

# 添加恢复说明
cat >> "$BACKUP_REPORT" << EOF

🔧 恢复命令:
-----------
# SQLite数据库恢复:
cp $BACKUP_DIR/yinghuo.db ./yinghuo.db
# 或从SQL文件恢复:
sqlite3 yinghuo.db < yinghuo_backup_$(date +%Y%m%d).sql

# MySQL数据库恢复 (如果有):
mysql -h$MYSQL_HOST -u$MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE < mysql_${MYSQL_DATABASE}_backup_$(date +%Y%m%d).sql

备份状态: ${FAILED_BACKUPS:+部分成功}${FAILED_BACKUPS:-完全成功}
脚本执行完成时间: $(date '+%Y-%m-%d %H:%M:%S')
EOF

log_success "备份报告生成完成: backup_report.txt"

# 4. 清理旧备份
log_header "🧹 第四步：清理旧备份"
echo ""

cd "$PROJECT_ROOT/db_backups"
SMART_BACKUP_COUNT=$(ls -1d smart_backup_*/ 2>/dev/null | wc -l)

if [ $SMART_BACKUP_COUNT -gt 7 ]; then
    OLD_BACKUPS=$(ls -1td smart_backup_*/ | tail -n +8)
    CLEANED_COUNT=0
    for old_backup in $OLD_BACKUPS; do
        log_warning "删除旧备份: $old_backup"
        rm -rf "$old_backup"
        CLEANED_COUNT=$((CLEANED_COUNT + 1))
    done
    log_success "清理完成，删除了 $CLEANED_COUNT 个旧备份"
else
    log_info "备份文件数量正常 ($SMART_BACKUP_COUNT/7)"
fi

# 5. 最终总结
echo ""
echo "=========================================="
echo "         🎉 备份完成总结"
echo "=========================================="
echo ""

if [ $FAILED_BACKUPS -eq 0 ]; then
    log_success "🎊 所有数据库备份成功完成！"
else
    log_warning "⚠️  部分备份完成 ($SUCCESSFUL_BACKUPS 成功, $FAILED_BACKUPS 失败)"
fi

echo ""
echo "📁 备份详情:"
echo "   📂 备份目录: $BACKUP_DIR"
echo "   📊 备份任务: $TOTAL_BACKUPS 个"
echo "   ✅ 成功备份: $SUCCESSFUL_BACKUPS 个"
echo "   ❌ 失败备份: $FAILED_BACKUPS 个"
echo "   💾 总大小: $TOTAL_SIZE_READABLE"
echo ""

echo "📋 备份文件:"
if [ $SQLITE_COUNT -gt 0 ]; then
    echo "   🗄️  SQLite数据库: $SQLITE_COUNT 个"
    for DB_FILE in "${SQLITE_DBS[@]}"; do
        if [ -f "$PROJECT_ROOT/$DB_FILE" ]; then
            DB_SIZE_BYTES=$(stat -f%z "$PROJECT_ROOT/$DB_FILE" 2>/dev/null || stat -c%s "$PROJECT_ROOT/$DB_FILE" 2>/dev/null || echo "0")
            if [ $DB_SIZE_BYTES -gt 0 ]; then
                echo "      • ${DB_FILE%.*}_backup_$(date +%Y%m%d).sql"
            fi
        fi
    done
fi

if [ "$MYSQL_AVAILABLE" = true ]; then
    echo "   🖥️  MySQL数据库: 1 个"
    echo "      • mysql_${MYSQL_DATABASE}_backup_$(date +%Y%m%d).sql"
fi

echo ""
echo "🔧 快速恢复命令:"
if [ -f "$PROJECT_ROOT/yinghuo_backup_$(date +%Y%m%d).sql" ]; then
    echo "   SQLite: sqlite3 yinghuo.db < yinghuo_backup_$(date +%Y%m%d).sql"
fi
if [ -f "$PROJECT_ROOT/mysql_${MYSQL_DATABASE}_backup_$(date +%Y%m%d).sql" ]; then
    echo "   MySQL:  mysql -u$MYSQL_USER -p $MYSQL_DATABASE < mysql_${MYSQL_DATABASE}_backup_$(date +%Y%m%d).sql"
fi

echo ""
echo "📄 详细报告: $BACKUP_REPORT"
echo "⏰ 备份完成时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# 返回适当的退出码
if [ $FAILED_BACKUPS -eq 0 ]; then
    exit 0
else
    exit 1
fi
