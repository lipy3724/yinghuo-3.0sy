const sequelize = require('./config/db');
const axios = require('axios');
const { saveTaskDetails } = require('./middleware/unifiedFeatureUsage');

// 定义模型
const User = sequelize.define('User', {
  id: {
    type: sequelize.Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: sequelize.Sequelize.STRING,
  credits: {
    type: sequelize.Sequelize.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'users'
});

const FeatureUsage = sequelize.define('FeatureUsage', {
  id: {
    type: sequelize.Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: sequelize.Sequelize.INTEGER,
    allowNull: false
  },
  featureName: {
    type: sequelize.Sequelize.STRING,
    allowNull: false
  },
  usageCount: {
    type: sequelize.Sequelize.INTEGER,
    defaultValue: 0
  },
  lastUsedAt: sequelize.Sequelize.DATE,
  credits: {
    type: sequelize.Sequelize.INTEGER,
    defaultValue: 0
  },
  details: sequelize.Sequelize.TEXT
}, {
  tableName: 'feature_usages'
});

async function autoCheckImageToVideoTasks() {
  try {
    console.log('🤖 自动检查图生视频任务状态并处理积分扣除...\n');
    
    // 查找所有图生视频使用记录
    const imageToVideoUsages = await FeatureUsage.findAll({
      where: { featureName: 'image-to-video' }
    });
    
    console.log(`📊 找到 ${imageToVideoUsages.length} 条图生视频使用记录\n`);
    
    let totalProcessedTasks = 0;
    let totalCreditsDeducted = 0;
    
    for (const usage of imageToVideoUsages) {
      console.log(`👤 处理用户ID: ${usage.userId}`);
      
      if (!usage.details) {
        console.log('  ⚠️  无任务详情，跳过');
        continue;
      }
      
      let details;
      try {
        details = JSON.parse(usage.details);
      } catch (e) {
        console.log('  ❌ 任务详情解析失败，跳过');
        continue;
      }
      
      if (!details.tasks || details.tasks.length === 0) {
        console.log('  ⚠️  无任务记录，跳过');
        continue;
      }
      
      // 查找pending状态的任务
      const pendingTasks = details.tasks.filter(t => 
        !t.status || t.status === 'pending'
      );
      
      if (pendingTasks.length === 0) {
        console.log('  ✅ 无待处理任务');
        continue;
      }
      
      console.log(`  🔍 发现 ${pendingTasks.length} 个待处理任务`);
      
      let tasksProcessed = 0;
      let creditsDeducted = 0;
      let needsUpdate = false;
      
      // 检查每个pending任务的实际状态
      for (const task of pendingTasks) {
        console.log(`    📝 检查任务: ${task.taskId}`);
        
        try {
          // 调用阿里云API检查任务状态
          const response = await axios.get(
            `https://dashscope.aliyuncs.com/api/v1/tasks/${task.taskId}`,
            {
              headers: {
                'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`
              },
              timeout: 10000
            }
          );
          
          const taskStatus = response.data.output?.task_status;
          console.log(`    📊 任务状态: ${taskStatus}`);
          
          if (taskStatus === 'SUCCEEDED') {
            // 任务已成功，使用统一的积分扣除逻辑
            console.log(`    ✅ 任务成功，调用统一积分扣除逻辑`);
            
            // 判断是否免费（第一次使用免费）
            const completedTasksBefore = details.tasks.filter(t => 
              (t.status === 'completed' || t.status === 'SUCCEEDED') && t.taskId !== task.taskId
            ).length;
            
            const isFree = completedTasksBefore === 0;
            const creditCost = isFree ? 0 : 66;
            
            // 调用统一的积分扣除逻辑
            await saveTaskDetails(usage, {
              taskId: task.taskId,
              featureName: 'image-to-video',
              status: 'completed',
              statusCode: 'SUCCEEDED',
              creditCost: creditCost,
              isFree: isFree,
              operationText: '图生视频'
            });
            
            console.log(`    💰 积分处理完成: 免费=${isFree}, 积分=${creditCost}`);
            
            if (!isFree) {
              creditsDeducted += creditCost;
            }
            
            tasksProcessed++;
            needsUpdate = true;
            
          } else if (taskStatus === 'FAILED') {
            // 任务失败，使用统一的积分扣除逻辑（失败任务不扣费）
            console.log(`    ❌ 任务失败，标记为失败状态`);
            
            await saveTaskDetails(usage, {
              taskId: task.taskId,
              featureName: 'image-to-video',
              status: 'FAILED',
              statusCode: 'FAILED',
              creditCost: 0,
              isFree: true,
              operationText: '图生视频'
            });
            
            tasksProcessed++;
            needsUpdate = true;
            
          } else {
            console.log(`    ⏳ 任务仍在处理中: ${taskStatus}`);
          }
          
        } catch (apiError) {
          console.log(`    ❌ API调用失败: ${apiError.message}`);
          
          // 如果是任务不存在的错误，标记为失败
          if (apiError.response?.status === 404 || 
              apiError.message.includes('not found') ||
              apiError.message.includes('timeout')) {
            
            console.log(`    ❌ 任务不存在或超时，标记为失败`);
            
            await saveTaskDetails(usage, {
              taskId: task.taskId,
              featureName: 'image-to-video',
              status: 'FAILED',
              statusCode: 'FAILED',
              creditCost: 0,
              isFree: true,
              operationText: '图生视频',
              error: '任务不存在或API调用超时'
            });
            
            tasksProcessed++;
            needsUpdate = true;
          }
        }
        
        // 添加延迟，避免API调用过于频繁
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (needsUpdate) {
        console.log(`  ✅ 处理完成: 处理任务=${tasksProcessed}, 扣除积分=${creditsDeducted}`);
        
        totalProcessedTasks += tasksProcessed;
        totalCreditsDeducted += creditsDeducted;
      }
      
      console.log('─'.repeat(50));
    }
    
    console.log('\n📊 处理总结:');
    console.log(`✅ 总共处理任务: ${totalProcessedTasks}`);
    console.log(`💰 总共扣除积分: ${totalCreditsDeducted}`);
    
    if (totalProcessedTasks > 0) {
      console.log('\n🎯 建议:');
      console.log('1. 可以将此脚本设置为定时任务，定期检查未完成的图生视频任务');
      console.log('2. 或者在任务状态检查接口中增加自动处理逻辑');
      console.log('3. 确保用户在使用图生视频功能后会调用状态检查接口');
    }
    
  } catch (error) {
    console.error('❌ 处理过程中发生错误:', error);
  } finally {
    await sequelize.close();
    console.log('\n📊 处理完成');
  }
}

// 运行自动检查
autoCheckImageToVideoTasks();
