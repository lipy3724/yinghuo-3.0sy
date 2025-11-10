#!/bin/bash

# 设置自动备份定时任务
# 创建时间: $(date '+%Y-%m-%d %H:%M:%S')

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "设置映火AI项目自动备份定时任务..."
echo "项目路径: $PROJECT_ROOT"

# 创建cron任务配置
CRON_JOB="0 2 * * * cd $PROJECT_ROOT && ./scripts/daily-backup.sh"

# 检查是否已存在相同的cron任务
if crontab -l 2>/dev/null | grep -q "daily-backup.sh"; then
    echo "检测到已存在的备份定时任务"
    echo "当前cron任务:"
    crontab -l 2>/dev/null | grep "daily-backup.sh"
    
    read -p "是否要更新现有的定时任务? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # 移除旧的任务
        crontab -l 2>/dev/null | grep -v "daily-backup.sh" | crontab -
        echo "已移除旧的定时任务"
    else
        echo "保持现有定时任务不变"
        exit 0
    fi
fi

# 添加新的cron任务
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "定时任务设置完成！"
echo "备份时间: 每天凌晨2点"
echo "备份脚本: $PROJECT_ROOT/scripts/daily-backup.sh"
echo ""
echo "当前所有cron任务:"
crontab -l

echo ""
echo "注意事项:"
echo "1. 确保系统cron服务正在运行"
echo "2. 备份日志将保存在 logs/backup.log"
echo "3. 旧备份文件将在7天后自动清理"
echo "4. 可以手动执行: ./scripts/daily-backup.sh"

echo ""
echo "测试备份脚本:"
read -p "是否现在测试执行备份脚本? (y/n): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "执行测试备份..."
    cd "$PROJECT_ROOT"
    ./scripts/daily-backup.sh
    echo "测试完成！"
fi

exit 0










