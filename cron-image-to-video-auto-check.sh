#!/bin/bash

# 图生视频任务自动检查脚本
# 用于定期检查未完成的图生视频任务并自动处理积分扣除

# 设置工作目录
cd /Users/houkai/Documents/Yinghuo1/积分end\ 3

# 记录日志
echo "$(date '+%Y-%m-%d %H:%M:%S') - 开始自动检查图生视频任务" >> logs/image-to-video-auto-check.log

# 运行自动检查脚本
node auto-check-image-to-video-tasks.js >> logs/image-to-video-auto-check.log 2>&1

# 记录完成日志
echo "$(date '+%Y-%m-%d %H:%M:%S') - 图生视频任务自动检查完成" >> logs/image-to-video-auto-check.log
echo "----------------------------------------" >> logs/image-to-video-auto-check.log
