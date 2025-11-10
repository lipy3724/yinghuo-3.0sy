/**
 * 图生视频功能积分扣除监控脚本
 * 
 * 此脚本用于定期检查图生视频任务的积分扣除情况，发现问题及时报警
 * 可以通过cron定时任务每天运行一次
 */

require('dotenv').config();
const { FeatureUsage } = require('./models/FeatureUsage');
const User = require('./models/User');
const { sequelize } = require('./config/db');
const fs = require('fs');
const path = require('path');

// 导入任务完成状态检查工具
const { isTaskCompleted, logTaskCompletionStatus } = require('./task-completion-checker');

// 日志目录
const LOG_DIR = path.join(__dirname, 'logs');
// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 日志文件路径
const LOG_FILE = path.join(LOG_DIR, `image-to-video-credits-monitor-${new Date().toISOString().split('T')[0]}.log`);

// 写入日志
function writeLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // 输出到控制台
  console.log(message);
  
  // 写入日志文件
  fs.appendFileSync(LOG_FILE, logMessage);
}

// 发送报警通知（可根据实际情况实现，如发送邮件、短信等）
function sendAlert(message) {
  writeLog(`[警报] ${message}`);
  // 这里可以添加实际的报警通知逻辑
}

// 检查图生视频任务积分扣除情况
async function monitorImageToVideoCredits() {
  writeLog('开始监控图生视频功能积分扣除情况...');
  
  try {
    // 查找所有图生视频功能的使用记录
    const usages = await FeatureUsage.findAll({
      where: {
        featureName: 'image-to-video'
      }
    });
    
    writeLog(`找到 ${usages.length} 条图生视频功能使用记录`);
    
    let totalTasksCount = 0;
    let completedTasksCount = 0;
    let chargedTasksCount = 0;
    let unchargedTasksCount = 0;
    let problemUsers = [];
    
    // 遍历每条使用记录
    for (const usage of usages) {
      try {
        // 解析任务详情
        const details = JSON.parse(usage.details || '{}');
        const tasks = details.tasks || [];
        const refunds = details.refunds || [];
        
        if (tasks.length === 0) {
          continue;
        }
        
        // 查找用户
        const user = await User.findByPk(usage.userId);
        if (!user) {
          writeLog(`未找到用户 ${usage.userId}，跳过`);
          continue;
        }
        
        let userUnchargedTasks = 0;
        
        // 遍历每个任务
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          totalTasksCount++;
          
          // 跳过免费任务
          if (task.isFree === true) {
            continue;
          }
          
          // 跳过已经退款的任务
          const isRefunded = refunds.some(refund => refund.taskId === task.taskId);
          if (isRefunded) {
            continue;
          }
          
          // 使用增强的任务完成状态检查逻辑
          const isCompleted = isTaskCompleted(task);
          
          // 记录任务完成状态的详细日志
          logTaskCompletionStatus(task, isCompleted);
          
          if (isCompleted) {
            completedTasksCount++;
            
            // 检查任务是否已经扣除积分
            if (task.hasChargedCredits === true) {
              chargedTasksCount++;
            } else {
              unchargedTasksCount++;
              userUnchargedTasks++;
              
              writeLog(`警告: 用户 ${usage.userId} 的任务 ${task.taskId} 已完成但未扣除积分!`);
            }
          }
        }
        
        // 如果用户有未扣除积分的任务，添加到问题用户列表
        if (userUnchargedTasks > 0) {
          problemUsers.push({
            userId: usage.userId,
            username: user.username,
            unchargedTasks: userUnchargedTasks
          });
        }
      } catch (error) {
        writeLog(`处理用户 ${usage.userId} 的使用记录时出错: ${error.message}`);
      }
    }
    
    writeLog('\n监控结果汇总:');
    writeLog(`总任务数: ${totalTasksCount}`);
    writeLog(`已完成任务数: ${completedTasksCount}`);
    writeLog(`已扣除积分任务数: ${chargedTasksCount}`);
    writeLog(`未扣除积分任务数: ${unchargedTasksCount}`);
    
    // 如果有未扣除积分的任务，发送报警
    if (unchargedTasksCount > 0) {
      const alertMessage = `发现 ${unchargedTasksCount} 个已完成但未扣除积分的图生视频任务，涉及 ${problemUsers.length} 个用户`;
      sendAlert(alertMessage);
      
      writeLog('\n问题用户列表:');
      problemUsers.forEach(user => {
        writeLog(`用户ID: ${user.userId}, 用户名: ${user.username}, 未扣除积分任务数: ${user.unchargedTasks}`);
      });
      
      writeLog('\n请运行 fix-image-to-video-credits.js 进行修复');
    } else {
      writeLog('\n监控完成: 所有已完成的任务都已正确扣除积分');
    }
    
    return {
      totalTasks: totalTasksCount,
      completedTasks: completedTasksCount,
      chargedTasks: chargedTasksCount,
      unchargedTasks: unchargedTasksCount,
      problemUsers: problemUsers
    };
  } catch (error) {
    writeLog(`监控过程中出错: ${error.message}`);
    throw error;
  }
}

// 执行监控
monitorImageToVideoCredits()
  .then((result) => {
    writeLog('监控脚本执行完成');
    process.exit(0);
  })
  .catch(error => {
    writeLog(`监控脚本执行失败: ${error.message}`);
    process.exit(1);
  });
