/**
 * 检查图生视频任务积分扣除情况
 * 
 * 此脚本用于检查已完成的图生视频任务是否正确扣除了积分
 */

require('dotenv').config();
const { FeatureUsage } = require('./models/FeatureUsage');
const User = require('./models/User');
const { sequelize } = require('./config/db');

async function checkImageToVideoCredits() {
  console.log('开始检查图生视频功能积分扣除情况...');
  
  try {
    // 查找所有图生视频功能的使用记录
    const usages = await FeatureUsage.findAll({
      where: {
        featureName: 'image-to-video'
      }
    });
    
    console.log(`找到 ${usages.length} 条图生视频功能使用记录`);
    
    let totalTasksCount = 0;
    let completedTasksCount = 0;
    let chargedTasksCount = 0;
    let unchargedTasksCount = 0;
    
    // 遍历每条使用记录
    for (const usage of usages) {
      try {
        // 解析任务详情
        const details = JSON.parse(usage.details || '{}');
        const tasks = details.tasks || [];
        const refunds = details.refunds || [];
        
        if (tasks.length === 0) {
          console.log(`用户 ${usage.userId} 的图生视频功能使用记录没有任务详情，跳过`);
          continue;
        }
        
        console.log(`\n用户 ${usage.userId} 的图生视频功能使用记录包含 ${tasks.length} 个任务`);
        
        // 查找用户
        const user = await User.findByPk(usage.userId);
        if (!user) {
          console.log(`未找到用户 ${usage.userId}，跳过`);
          continue;
        }
        
        // 遍历每个任务
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          totalTasksCount++;
          
          // 打印任务基本信息
          console.log(`\n任务ID: ${task.taskId}`);
          console.log(`创建时间: ${task.timestamp || '未知'}`);
          console.log(`状态: ${task.status || '未知'}`);
          console.log(`是否免费: ${task.isFree === true ? '是' : '否'}`);
          console.log(`是否已扣除积分: ${task.hasChargedCredits === true ? '是' : '否'}`);
          
          // 跳过免费任务
          if (task.isFree === true) {
            console.log(`任务 ${task.taskId} 是免费使用，无需扣除积分`);
            continue;
          }
          
          // 跳过已经退款的任务
          const isRefunded = refunds.some(refund => refund.taskId === task.taskId);
          if (isRefunded) {
            console.log(`任务 ${task.taskId} 已退款，无需扣除积分`);
            continue;
          }
          
          // 获取任务状态，只检查已完成的任务
          const isCompleted = 
            task.status === 'completed' || 
            task.status === 'SUCCEEDED' ||
            (task.videoUrl && task.videoUrl.startsWith('http')) || 
            (task.extraData && task.extraData.videoUrl && task.extraData.videoUrl.startsWith('http'));
          
          if (isCompleted) {
            completedTasksCount++;
            console.log(`任务 ${task.taskId} 已完成`);
            
            // 检查任务是否已经扣除积分
            if (task.hasChargedCredits === true) {
              chargedTasksCount++;
              console.log(`任务 ${task.taskId} 已正确扣除积分`);
            } else {
              unchargedTasksCount++;
              console.log(`警告: 任务 ${task.taskId} 已完成但未扣除积分!`);
            }
          } else {
            console.log(`任务 ${task.taskId} 未完成，无需扣除积分`);
          }
        }
      } catch (error) {
        console.error(`处理用户 ${usage.userId} 的使用记录时出错:`, error);
      }
    }
    
    console.log('\n检查结果汇总:');
    console.log(`总任务数: ${totalTasksCount}`);
    console.log(`已完成任务数: ${completedTasksCount}`);
    console.log(`已扣除积分任务数: ${chargedTasksCount}`);
    console.log(`未扣除积分任务数: ${unchargedTasksCount}`);
    
    if (unchargedTasksCount > 0) {
      console.log('\n发现问题: 有已完成但未扣除积分的任务，请运行 fix-image-to-video-credits.js 进行修复');
    } else {
      console.log('\n检查完成: 所有已完成的任务都已正确扣除积分');
    }
  } catch (error) {
    console.error('检查过程中出错:', error);
  }
}

// 执行检查
checkImageToVideoCredits()
  .then(() => {
    console.log('检查脚本执行完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('检查脚本执行失败:', error);
    process.exit(1);
  });
