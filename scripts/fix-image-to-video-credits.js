/**
 * 图生视频积分扣除修复脚本
 * 
 * 该脚本用于修复历史图生视频任务的积分扣除问题
 * 查找所有已完成但未扣除积分的图生视频任务，并补扣积分
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');
const { FeatureUsage } = require('../models/FeatureUsage');
const User = require('../models/User');

// 连接数据库
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: process.env.DB_DIALECT || 'mysql',
  logging: false
});

async function fixImageToVideoCredits() {
  try {
    console.log('开始修复图生视频积分扣除问题...');
    
    // 查找所有图生视频功能的使用记录
    const usages = await FeatureUsage.findAll({
      where: {
        featureName: 'image-to-video'
      }
    });
    
    console.log(`找到 ${usages.length} 条图生视频使用记录`);
    
    let totalFixed = 0;
    let totalCreditsCharged = 0;
    
    // 遍历每条使用记录
    for (const usage of usages) {
      try {
        // 解析任务详情
        let details = {};
        if (usage.details) {
          try {
            details = JSON.parse(usage.details);
          } catch (e) {
            console.error(`解析用户 ${usage.userId} 的任务详情失败:`, e);
            continue;
          }
        }
        
        // 如果没有任务记录，跳过
        if (!details.tasks || !Array.isArray(details.tasks) || details.tasks.length === 0) {
          console.log(`用户 ${usage.userId} 没有任务记录，跳过`);
          continue;
        }
        
        // 获取用户信息
        const user = await User.findByPk(usage.userId);
        if (!user) {
          console.error(`未找到用户 ID=${usage.userId}`);
          continue;
        }
        
        console.log(`处理用户 ${usage.userId} (${user.email || 'unknown'}) 的图生视频任务...`);
        
        // 查找已完成但未计费的任务
        const completedTasks = details.tasks.filter(task => 
          (task.status === 'completed' || task.status === 'SUCCEEDED') && 
          !task.isFree && 
          task.creditCost > 0
        );
        
        if (completedTasks.length === 0) {
          console.log(`用户 ${usage.userId} 没有需要修复的任务`);
          continue;
        }
        
        console.log(`用户 ${usage.userId} 有 ${completedTasks.length} 个任务需要修复`);
        
        // 记录已修复的任务
        const fixedTasks = [];
        let userCreditsCharged = 0;
        
        // 遍历每个需要修复的任务
        for (const task of completedTasks) {
          // 检查是否已经在refunds中有记录
          const hasRefund = details.refunds && Array.isArray(details.refunds) && 
                           details.refunds.some(refund => refund.taskId === task.taskId);
          
          if (hasRefund) {
            console.log(`任务 ${task.taskId} 已有退款记录，跳过`);
            continue;
          }
          
          // 标准积分消耗为66
          const creditCost = task.creditCost || 66;
          
          // 检查用户积分是否足够
          if (user.credits < creditCost) {
            console.log(`用户 ${usage.userId} 积分不足，当前积分: ${user.credits}，需要: ${creditCost}，跳过`);
            continue;
          }
          
          console.log(`修复任务 ${task.taskId}: 扣除 ${creditCost} 积分`);
          
          // 扣除用户积分
          user.credits -= creditCost;
          
          // 更新任务状态
          task.hasChargedCredits = true;
          task.chargedAt = new Date().toISOString();
          
          // 记录已修复的任务
          fixedTasks.push(task.taskId);
          userCreditsCharged += creditCost;
        }
        
        // 如果有修复的任务，保存更改
        if (fixedTasks.length > 0) {
          // 更新用户积分
          await user.save();
          
          // 更新功能使用记录
          usage.credits = (usage.credits || 0) + userCreditsCharged;
          usage.details = JSON.stringify(details);
          await usage.save();
          
          console.log(`用户 ${usage.userId} 修复完成: 修复了 ${fixedTasks.length} 个任务，扣除了 ${userCreditsCharged} 积分，当前积分: ${user.credits}`);
          
          totalFixed += fixedTasks.length;
          totalCreditsCharged += userCreditsCharged;
        }
      } catch (userError) {
        console.error(`处理用户 ${usage.userId} 时出错:`, userError);
      }
    }
    
    console.log('\n===== 修复完成 =====');
    console.log(`总共修复了 ${totalFixed} 个任务`);
    console.log(`总共补扣了 ${totalCreditsCharged} 积分`);
    
  } catch (error) {
    console.error('修复图生视频积分扣除问题时出错:', error);
  } finally {
    // 关闭数据库连接
    await sequelize.close();
  }
}

// 执行修复函数
fixImageToVideoCredits()
  .then(() => {
    console.log('脚本执行完毕');
    process.exit(0);
  })
  .catch(err => {
    console.error('脚本执行失败:', err);
    process.exit(1);
  });