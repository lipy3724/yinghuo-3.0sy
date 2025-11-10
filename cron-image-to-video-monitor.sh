#!/bin/bash

# 图生视频功能积分扣除监控脚本的cron任务
# 建议每天凌晨3点运行一次
# crontab配置: 0 3 * * * /path/to/cron-image-to-video-monitor.sh

# 切换到项目目录
cd "$(dirname "$0")"

# 记录开始时间
echo "开始运行图生视频积分扣除监控脚本: $(date)" >> ./logs/cron-monitor.log

# 运行监控脚本
node monitor-image-to-video-credits.js

# 检查脚本执行结果
if [ $? -eq 0 ]; then
  echo "监控脚本执行成功: $(date)" >> ./logs/cron-monitor.log
else
  echo "监控脚本执行失败: $(date)" >> ./logs/cron-monitor.log
  
  # 如果脚本执行失败，可以发送通知给管理员
  # mail -s "图生视频积分扣除监控失败" admin@example.com < ./logs/cron-monitor.log
fi

# 如果未扣除积分的任务数大于0，自动运行修复脚本
if grep -q "未扣除积分任务数: [1-9]" ./logs/image-to-video-credits-monitor-*.log; then
  echo "发现未扣除积分的任务，自动运行修复脚本: $(date)" >> ./logs/cron-monitor.log
  node fix-image-to-video-credits.js >> ./logs/cron-monitor.log 2>&1
fi

echo "监控任务完成: $(date)" >> ./logs/cron-monitor.log
echo "----------------------------------------" >> ./logs/cron-monitor.log
