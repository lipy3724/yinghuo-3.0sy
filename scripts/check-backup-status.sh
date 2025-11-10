#!/bin/bash

# 备份状态检查脚本
# 用途: 快速检查备份系统状态

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}映火AI项目备份状态检查${NC}"
echo "=================================="
echo "检查时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "项目路径: $PROJECT_ROOT"
echo ""

# 1. 检查数据库文件
echo -e "${BLUE}1. 数据库文件状态${NC}"
echo "-------------------"
if [ -f "yinghuo.db" ]; then
    DB_SIZE=$(ls -lh yinghuo.db | awk '{print $5}')
    DB_MODIFIED=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" yinghuo.db 2>/dev/null || stat -c "%y" yinghuo.db 2>/dev/null)
    echo -e "✅ yinghuo.db: ${GREEN}存在${NC} (大小: $DB_SIZE, 修改时间: $DB_MODIFIED)"
    
    # 检查数据库内容
    USERS_COUNT=$(sqlite3 yinghuo.db "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "N/A")
    FEATURES_COUNT=$(sqlite3 yinghuo.db "SELECT COUNT(*) FROM feature_usages;" 2>/dev/null || echo "N/A")
    echo "   - 用户数量: $USERS_COUNT"
    echo "   - 功能使用记录: $FEATURES_COUNT"
else
    echo -e "❌ yinghuo.db: ${RED}不存在${NC}"
fi

# 2. 检查备份目录
echo ""
echo -e "${BLUE}2. 备份文件状态${NC}"
echo "-------------------"
if [ -d "db_backups" ]; then
    BACKUP_COUNT=$(find db_backups -name "complete_backup_*" -type d | wc -l | tr -d ' ')
    echo -e "✅ 备份目录: ${GREEN}存在${NC}"
    echo "   - 备份数量: $BACKUP_COUNT 个"
    
    # 最新备份
    LATEST_BACKUP=$(find db_backups -name "complete_backup_*" -type d | sort | tail -1)
    if [ -n "$LATEST_BACKUP" ]; then
        BACKUP_DATE=$(basename "$LATEST_BACKUP" | sed 's/complete_backup_//')
        BACKUP_SIZE=$(du -sh "$LATEST_BACKUP" 2>/dev/null | cut -f1)
        echo "   - 最新备份: $BACKUP_DATE (大小: $BACKUP_SIZE)"
        
        # 检查备份完整性
        if [ -f "$LATEST_BACKUP/yinghuo.db" ] && [ -f "$LATEST_BACKUP/backup_info.txt" ]; then
            echo -e "   - 备份完整性: ${GREEN}完整${NC}"
        else
            echo -e "   - 备份完整性: ${YELLOW}部分缺失${NC}"
        fi
    else
        echo -e "   - 最新备份: ${RED}无${NC}"
    fi
else
    echo -e "❌ 备份目录: ${RED}不存在${NC}"
fi

# 3. 检查备份脚本
echo ""
echo -e "${BLUE}3. 备份脚本状态${NC}"
echo "-------------------"
SCRIPTS=("complete-database-backup.sh" "daily-backup.sh" "setup-backup-cron.sh")
for script in "${SCRIPTS[@]}"; do
    if [ -f "scripts/$script" ] && [ -x "scripts/$script" ]; then
        echo -e "✅ $script: ${GREEN}存在且可执行${NC}"
    elif [ -f "scripts/$script" ]; then
        echo -e "⚠️  $script: ${YELLOW}存在但不可执行${NC}"
    else
        echo -e "❌ $script: ${RED}不存在${NC}"
    fi
done

# 4. 检查定时任务
echo ""
echo -e "${BLUE}4. 定时任务状态${NC}"
echo "-------------------"
if crontab -l 2>/dev/null | grep -q "daily-backup.sh"; then
    echo -e "✅ 定时任务: ${GREEN}已设置${NC}"
    echo "   定时任务详情:"
    crontab -l 2>/dev/null | grep "daily-backup.sh" | sed 's/^/   /'
else
    echo -e "⚠️  定时任务: ${YELLOW}未设置${NC}"
    echo "   建议运行: ./scripts/setup-backup-cron.sh"
fi

# 5. 检查备份日志
echo ""
echo -e "${BLUE}5. 备份日志状态${NC}"
echo "-------------------"
if [ -f "logs/backup.log" ]; then
    LOG_SIZE=$(ls -lh logs/backup.log | awk '{print $5}')
    LOG_LINES=$(wc -l < logs/backup.log)
    echo -e "✅ 备份日志: ${GREEN}存在${NC} (大小: $LOG_SIZE, 行数: $LOG_LINES)"
    
    # 最近的备份记录
    echo "   最近的备份记录:"
    tail -3 logs/backup.log 2>/dev/null | sed 's/^/   /' || echo "   无记录"
else
    echo -e "⚠️  备份日志: ${YELLOW}不存在${NC}"
fi

# 6. 磁盘空间检查
echo ""
echo -e "${BLUE}6. 磁盘空间状态${NC}"
echo "-------------------"
DISK_USAGE=$(df -h . | tail -1 | awk '{print $5}' | sed 's/%//')
DISK_AVAIL=$(df -h . | tail -1 | awk '{print $4}')

if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "✅ 磁盘使用率: ${GREEN}${DISK_USAGE}%${NC} (可用: $DISK_AVAIL)"
elif [ "$DISK_USAGE" -lt 90 ]; then
    echo -e "⚠️  磁盘使用率: ${YELLOW}${DISK_USAGE}%${NC} (可用: $DISK_AVAIL)"
else
    echo -e "❌ 磁盘使用率: ${RED}${DISK_USAGE}%${NC} (可用: $DISK_AVAIL)"
fi

# 7. 建议操作
echo ""
echo -e "${BLUE}7. 建议操作${NC}"
echo "-------------------"

if [ ! -f "yinghuo.db" ]; then
    echo "⚠️  数据库文件不存在，请检查项目配置"
fi

if [ ! -d "db_backups" ] || [ "$BACKUP_COUNT" -eq 0 ]; then
    echo "💡 建议立即执行备份: ./scripts/complete-database-backup.sh"
fi

if ! crontab -l 2>/dev/null | grep -q "daily-backup.sh"; then
    echo "💡 建议设置自动备份: ./scripts/setup-backup-cron.sh"
fi

if [ "$DISK_USAGE" -gt 85 ]; then
    echo "💡 建议清理磁盘空间或转移备份文件"
fi

# 检查备份是否过期（超过2天）
if [ -n "$LATEST_BACKUP" ]; then
    BACKUP_TIMESTAMP=$(echo "$BACKUP_DATE" | sed 's/_/ /' | sed 's/\(..\)\(..\)\(..\)_\(..\)\(..\)\(..\)/20\1-\2-\3 \4:\5:\6/')
    BACKUP_EPOCH=$(date -j -f "%Y-%m-%d %H:%M:%S" "$BACKUP_TIMESTAMP" +%s 2>/dev/null || echo 0)
    CURRENT_EPOCH=$(date +%s)
    HOURS_DIFF=$(( (CURRENT_EPOCH - BACKUP_EPOCH) / 3600 ))
    
    if [ "$HOURS_DIFF" -gt 48 ]; then
        echo "⚠️  最新备份已超过2天，建议执行新的备份"
    fi
fi

echo ""
echo "=================================="
echo "检查完成！"

exit 0










