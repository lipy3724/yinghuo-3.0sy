const { FeatureUsage } = require('./models/FeatureUsage');
const User = require('./models/User');

async function testUserCreditsAPI() {
  try {
    console.log('测试用户积分使用情况API...');
    
    // 查找有文生视频使用记录的用户
    const textToVideoUsers = await FeatureUsage.findAll({
      where: {
        featureName: 'text-to-video'
      },
      attributes: ['userId'],
      group: ['userId'],
      order: [['userId', 'ASC']]
    });
    
    console.log(`找到${textToVideoUsers.length}个有文生视频使用记录的用户`);
    
    // 测试前几个用户
    for (let i = 0; i < Math.min(3, textToVideoUsers.length); i++) {
      const userId = textToVideoUsers[i].userId;
      console.log(`\n=== 测试用户ID: ${userId} ===`);
      
      // 获取用户信息
      const user = await User.findByPk(userId);
      if (!user) {
        console.log('用户不存在');
        continue;
      }
      
      console.log(`用户名: ${user.username}, 积分: ${user.credits}`);
      
      // 获取该用户的所有功能使用记录
      const usages = await FeatureUsage.findAll({
        where: { userId },
        attributes: ['id', 'featureName', 'usageCount', 'lastUsedAt', 'resetDate', 'credits', 'details']
      });
      
      console.log(`该用户共有${usages.length}条功能使用记录`);
      
      // 模拟积分使用情况API的核心逻辑
      let featureUsageStats = {};
      let totalCreditsUsed = 0;
      let totalUsageCount = 0;
      
      // 处理文生视频功能
      const textToVideoUsage = usages.filter(u => u.featureName === 'text-to-video');
      if (textToVideoUsage.length > 0) {
        console.log(`找到${textToVideoUsage.length}条文生视频记录`);
        
        let actualUsageCount = 0;
        let totalFeatureCreditCost = 0;
        
        textToVideoUsage.forEach(usage => {
          let tasks = [];
          
          if (usage.details) {
            try {
              const details = JSON.parse(usage.details);
              
              if (details.tasks && Array.isArray(details.tasks)) {
                tasks = details.tasks;
              } else if (Array.isArray(details)) {
                tasks = details;
              }
              
              console.log(`  记录ID ${usage.id}: ${tasks.length}个任务`);
              
              if (tasks.length > 0) {
                actualUsageCount += tasks.length;
                
                tasks.forEach(task => {
                  if (!task.isFree && task.creditCost > 0) {
                    totalFeatureCreditCost += task.creditCost;
                  }
                });
              }
              
            } catch (e) {
              console.error(`  解析记录ID ${usage.id} 的details失败:`, e.message);
            }
          }
        });
        
        console.log(`文生视频总使用次数: ${actualUsageCount}, 积分消费: ${totalFeatureCreditCost}`);
        
        if (actualUsageCount > 0) {
          featureUsageStats['text-to-video'] = {
            name: '文生视频',
            credits: totalFeatureCreditCost,
            count: actualUsageCount,
            usageCount: actualUsageCount
          };
          
          totalCreditsUsed += totalFeatureCreditCost;
          totalUsageCount += actualUsageCount;
        }
      } else {
        console.log('该用户没有文生视频使用记录');
      }
      
      // 处理其他功能（简化版）
      const otherUsages = usages.filter(u => u.featureName !== 'text-to-video');
      otherUsages.forEach(usage => {
        if (usage.usageCount > 0) {
          const featureName = usage.featureName;
          
          if (!featureUsageStats[featureName]) {
            featureUsageStats[featureName] = {
              name: featureName,
              credits: usage.credits || 0,
              count: usage.usageCount,
              usageCount: usage.usageCount
            };
            
            totalCreditsUsed += (usage.credits || 0);
            totalUsageCount += usage.usageCount;
          }
        }
      });
      
      console.log(`\n该用户的功能使用统计:`);
      console.log(`总使用次数: ${totalUsageCount}, 总积分消费: ${totalCreditsUsed}`);
      console.log(`功能数量: ${Object.keys(featureUsageStats).length}`);
      
      // 生成功能占比数据
      const featureUsage = [];
      Object.keys(featureUsageStats).forEach(key => {
        const stat = featureUsageStats[key];
        if (stat.count > 0) {
          const item = {
            name: stat.name,
            credits: stat.credits,
            percentage: totalCreditsUsed > 0 ? parseFloat(((stat.credits / totalCreditsUsed) * 100).toFixed(2)) : 0,
            usageCount: stat.count
          };
          featureUsage.push(item);
        }
      });
      
      console.log(`功能占比数据 (${featureUsage.length}项):`);
      featureUsage.forEach(item => {
        console.log(`  ${item.name}: ${item.usageCount}次, ${item.credits}积分, ${item.percentage}%`);
      });
      
      // 检查文生视频是否在其中
      const textToVideoItem = featureUsage.find(item => item.name === '文生视频');
      if (textToVideoItem) {
        console.log('✅ 文生视频功能会显示在功能占比中');
      } else {
        console.log('❌ 文生视频功能不会显示在功能占比中');
      }
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testUserCreditsAPI().then(() => {
  console.log('\n测试完成');
  process.exit(0);
}).catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});
