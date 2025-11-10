const { FeatureUsage } = require('./models/FeatureUsage');

async function debugTextToVideoStats() {
  try {
    console.log('调试文生视频功能统计...');
    
    // 查询所有文生视频功能的使用记录
    const textToVideoUsage = await FeatureUsage.findAll({
      where: {
        featureName: 'text-to-video'
      },
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`总共找到${textToVideoUsage.length}条文生视频记录`);
    
    // 模拟积分使用情况API中的处理逻辑
    let featureUsageStats = {};
    let totalUsageCount = 0;
    let totalCreditsUsed = 0;
    
    // 处理每条记录
    textToVideoUsage.forEach((usage, index) => {
      console.log(`\n处理记录${index + 1}:`);
      console.log('  用户ID:', usage.userId);
      console.log('  usageCount:', usage.usageCount);
      console.log('  credits:', usage.credits);
      console.log('  创建时间:', usage.createdAt);
      
      let tasks = [];
      let actualUsageCount = 0;
      let totalFeatureCreditCost = 0;
      
      // 解析details字段
      if (usage.details) {
        try {
          const details = JSON.parse(usage.details);
          
          // 处理两种数据格式
          if (details.tasks && Array.isArray(details.tasks)) {
            tasks = details.tasks;
          } else if (Array.isArray(details)) {
            tasks = details;
          }
          
          console.log('  任务数量:', tasks.length);
          
          if (tasks.length > 0) {
            actualUsageCount = tasks.length;
            
            // 计算积分消费
            tasks.forEach(task => {
              if (!task.isFree && task.creditCost > 0) {
                totalFeatureCreditCost += task.creditCost;
              }
            });
            
            console.log('  实际使用次数:', actualUsageCount);
            console.log('  积分消费:', totalFeatureCreditCost);
          }
          
        } catch (e) {
          console.error('  解析details失败:', e.message);
        }
      }
      
      // 累加到总统计中
      totalUsageCount += actualUsageCount;
      totalCreditsUsed += totalFeatureCreditCost;
    });
    
    // 设置featureUsageStats
    if (totalUsageCount > 0) {
      featureUsageStats['text-to-video'] = {
        name: '文生视频',
        credits: totalCreditsUsed,
        count: totalUsageCount,
        usageCount: totalUsageCount
      };
      
      console.log(`\n最终统计结果:`);
      console.log('  功能名称:', featureUsageStats['text-to-video'].name);
      console.log('  使用次数:', featureUsageStats['text-to-video'].count);
      console.log('  积分消费:', featureUsageStats['text-to-video'].credits);
      
      // 检查是否会被添加到featureUsage数组中
      const stat = featureUsageStats['text-to-video'];
      if (stat.count > 0) {
        console.log('✅ 该功能会被添加到功能占比中');
        
        // 模拟前端显示的数据
        const item = {
          name: stat.name,
          credits: stat.credits,
          percentage: totalCreditsUsed > 0 ? parseFloat(((stat.credits / totalCreditsUsed) * 100).toFixed(2)) : 0,
          color: 'rgb(176, 15, 20)', // 文生视频的颜色
          usageCount: stat.count
        };
        
        console.log('前端显示数据:', item);
      } else {
        console.log('❌ 该功能不会被添加到功能占比中（count为0）');
      }
    } else {
      console.log('❌ 没有有效的使用记录，不会显示在功能占比中');
    }
    
  } catch (error) {
    console.error('调试失败:', error);
  }
}

debugTextToVideoStats().then(() => {
  console.log('\n调试完成');
  process.exit(0);
}).catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});
