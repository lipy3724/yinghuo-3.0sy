const { FeatureUsage } = require('./models/FeatureUsage');

async function debugUser35() {
  console.log('🔍 调试用户35的多图转视频积分问题...\n');
  
  const usage = await FeatureUsage.findOne({
    where: { userId: 35, featureName: 'MULTI_IMAGE_TO_VIDEO' }
  });
  
  if (!usage || !usage.details) {
    console.log('❌ 未找到用户35的使用记录');
    return;
  }
  
  const details = JSON.parse(usage.details);
  console.log('📊 基本信息:');
  console.log(`- 总任务数: ${details.tasks ? details.tasks.length : 0}`);
  console.log(`- 使用次数: ${usage.usageCount}`);
  console.log(`- 积分消费: ${usage.credits}`);
  
  if (!details.tasks || details.tasks.length === 0) {
    console.log('❌ 没有任务记录');
    return;
  }
  
  // 模拟最新任务的免费判断逻辑
  const latestTask = details.tasks[details.tasks.length - 1];
  const taskId = latestTask.taskId;
  
  console.log(`\n🎯 分析最新任务: ${taskId}`);
  console.log(`- 状态: ${latestTask.status}`);
  console.log(`- 当前显示免费: ${latestTask.isFree}`);
  console.log(`- 当前显示积分: ${latestTask.creditCost}`);
  
  // 统计已完成任务（排除当前任务）
  const completedTasks = details.tasks.filter(t => 
    (t.status === 'SUCCEEDED' || t.status === 'completed') && 
    t.taskId !== taskId
  );
  
  console.log(`\n📈 已完成任务分析:`);
  console.log(`- 已完成任务数（排除当前）: ${completedTasks.length}`);
  console.log(`- 按免费判断逻辑，当前任务应该免费: ${completedTasks.length === 0}`);
  
  // 显示前几个已完成任务的详情
  console.log(`\n📋 前10个已完成任务详情:`);
  completedTasks.slice(0, 10).forEach((task, index) => {
    console.log(`${index + 1}. ID=${task.taskId.substring(0, 20)}..., 状态=${task.status}, 免费=${task.isFree}, 积分=${task.creditCost}`);
  });
  
  // 统计任务状态分布
  const statusCount = {};
  details.tasks.forEach(t => {
    statusCount[t.status] = (statusCount[t.status] || 0) + 1;
  });
  
  console.log(`\n📊 任务状态分布:`);
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`- ${status}: ${count}个`);
  });
  
  // 分析问题
  console.log(`\n🔍 问题分析:`);
  if (completedTasks.length > 0) {
    console.log(`✅ 用户已有${completedTasks.length}个已完成任务，应该收费`);
    
    // 检查最新任务的实际状态
    if (latestTask.isFree) {
      console.log(`❌ 但最新任务被标记为免费，这是错误的`);
    } else {
      console.log(`✅ 最新任务正确标记为收费`);
    }
    
    // 检查是否有付费任务
    const paidTasks = completedTasks.filter(t => !t.isFree && t.creditCost > 0);
    console.log(`💰 其中付费任务: ${paidTasks.length}个`);
    console.log(`🆓 其中免费任务: ${completedTasks.length - paidTasks.length}个`);
    
    if (latestTask.isFree) {
      console.log(`\n🎯 结论: 用户已经有付费使用记录，新任务应该收费！`);
    } else {
      console.log(`\n🎯 结论: 积分扣除逻辑正确！`);
    }
  } else {
    console.log(`🆓 用户没有已完成任务，首次使用应该免费`);
    if (latestTask.isFree) {
      console.log(`✅ 系统判断正确`);
    } else {
      console.log(`❌ 系统判断错误，应该免费`);
    }
  }
  
  process.exit(0);
}

debugUser35().catch(console.error);
