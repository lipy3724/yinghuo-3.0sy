#!/bin/bash

# 映火AI项目每日自动备份脚本
# 创建时间: $(date '+%Y-%m-%d %H:%M:%S')
# 用途: 定时执行数据库备份，清理旧备份

set -e

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 日志文件
LOG_FILE="logs/backup.log"
mkdir -p logs

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "开始每日自动备份..."

# 执行完整备份
if ./scripts/complete-database-backup.sh >> "$LOG_FILE" 2>&1; then
    log "备份成功完成"
else
    log "备份执行失败，退出码: $?"
    exit 1
fi

# 清理超过7天的备份文件
log "清理旧备份文件..."

BACKUP_RETENTION_DAYS=7
find db_backups -name "complete_backup_*" -type d -mtime +$BACKUP_RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null || true
find db_backups -name "complete_backup_*.tar.gz" -type f -mtime +$BACKUP_RETENTION_DAYS -delete 2>/dev/null || true

# 清理超过30天的日志
find logs -name "backup.log.*" -type f -mtime +30 -delete 2>/dev/null || true

# 如果日志文件超过10MB，则轮转
if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt 10485760 ]; then
    mv "$LOG_FILE" "${LOG_FILE}.$(date '+%Y%m%d_%H%M%S')"
    touch "$LOG_FILE"
    log "日志文件已轮转"
fi

log "每日备份任务完成"

# 发送备份状态通知（可选）
# 如果需要邮件通知，可以在这里添加邮件发送逻辑

exit 0










