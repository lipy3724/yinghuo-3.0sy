/**
 * 多图转视频功能积分扣除修复脚本
 * 
 * 问题描述：多图转视频功能在任务完成后没有正确扣除积分，导致用户可以无限免费使用
 * 修复方案：
 * 1. 修改server.js中的任务记录逻辑，确保hasChargedCredits始终为false
 * 2. 修改middleware/unifiedFeatureUsage.js中的积分计算逻辑，确保至少收取30积分
 * 3. 修复已有的功能使用记录，为未扣费的任务补扣积分
 */

require('dotenv').config();
const { FeatureUsage } = require('./models/FeatureUsage');
const User = require('./models/User');
const { sequelize } = require('./config/db');

async function fixMultiImageToVideoCredits() {
  console.log('开始修复多图转视频功能积分扣除问题...');
  
  try {
    // 查找所有多图转视频功能的使用记录
    const usages = await FeatureUsage.findAll({
      where: {
        featureName: 'MULTI_IMAGE_TO_VIDEO'
      }
    });
    
    console.log(`找到 ${usages.length} 条多图转视频功能使用记录`);
    
    let fixedTasksCount = 0;
    let totalCreditCharged = 0;
    
    // 遍历每条使用记录
    for (const usage of usages) {
      try {
        // 解析任务详情
        const details = JSON.parse(usage.details || '{}');
        const tasks = details.tasks || [];
        
        if (tasks.length === 0) {
          console.log(`用户 ${usage.userId} 的多图转视频功能使用记录没有任务详情，跳过`);
          continue;
        }
        
        console.log(`用户 ${usage.userId} 的多图转视频功能使用记录包含 ${tasks.length} 个任务`);
        
        // 查找用户
        const user = await User.findByPk(usage.userId);
        if (!user) {
          console.log(`未找到用户 ${usage.userId}，跳过`);
          continue;
        }
        
        // 记录原始积分
        const originalCredits = user.credits;
        let userCreditCharged = 0;
        
        // 遍历每个任务
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          
          // 跳过已经正确扣费的任务
          if (task.isFree === true || (task.creditCost && task.creditCost > 0)) {
            console.log(`任务 ${task.taskId} 已正确处理积分，跳过`);
            continue;
          }
          
          // 计算应扣除的积分
          let creditCost = 30; // 默认至少30积分
          
          // 如果有时长信息，根据时长计算积分
          if (task.duration) {
            const durationSec = parseFloat(task.duration);
            if (!isNaN(durationSec) && durationSec > 0) {
              creditCost = Math.max(30, Math.ceil(durationSec / 30) * 30);
            }
          }
          
          console.log(`任务 ${task.taskId} 需要扣除 ${creditCost} 积分`);
          
          // 更新任务记录
          tasks[i].creditCost = creditCost;
          tasks[i].isFree = false;
          
          // 扣除用户积分
          const deduct = Math.min(creditCost, user.credits);
          user.credits -= deduct;
          userCreditCharged += deduct;
          totalCreditCharged += deduct;
          
          fixedTasksCount++;
          
          console.log(`已为任务 ${task.taskId} 扣除 ${deduct} 积分`);
        }
        
        // 更新使用记录
        usage.details = JSON.stringify({ ...details, tasks });
        usage.credits = (usage.credits || 0) + userCreditCharged;
        
        // 保存更改
        await usage.save();
        await user.save();
        
        console.log(`用户 ${usage.userId} 的积分从 ${originalCredits} 减少到 ${user.credits}，共扣除 ${userCreditCharged} 积分`);
      } catch (error) {
        console.error(`处理用户 ${usage.userId} 的使用记录时出错:`, error);
      }
    }
    
    console.log(`修复完成！共修复 ${fixedTasksCount} 个任务，共扣除 ${totalCreditCharged} 积分`);
  } catch (error) {
    console.error('修复过程中出错:', error);
  }
}

// 执行修复
fixMultiImageToVideoCredits()
  .then(() => {
    console.log('修复脚本执行完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('修复脚本执行失败:', error);
    process.exit(1);
  }); 