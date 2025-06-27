/**
 * 场景图生成退款机制简单测试脚本
 */

// 初始化全局变量
global.sceneGeneratorTasks = {};

// 创建一个模拟任务
const taskId = `scene-generator-test-${Date.now()}`;
global.sceneGeneratorTasks[taskId] = {
  userId: 1, // 假设用户ID为1
  creditCost: 7, // 场景图生成的积分消费
  hasChargedCredits: true,
  isFree: false,
  timestamp: new Date()
};

console.log('已创建模拟任务:', global.sceneGeneratorTasks[taskId]);

// 模拟refundSceneGeneratorCredits函数
async function mockRefundSceneGeneratorCredits(userId, taskId, reason = '测试退款') {
  console.log(`模拟退款处理: 用户ID=${userId}, 任务ID=${taskId}, 原因=${reason}`);
  
  // 检查全局任务记录中是否有该任务
  if (global.sceneGeneratorTasks && global.sceneGeneratorTasks[taskId]) {
    const taskInfo = global.sceneGeneratorTasks[taskId];
    
    // 检查是否已退款
    if (taskInfo.refunded) {
      console.log(`任务 ${taskId} 已经退款过，跳过退款处理`);
      return false;
    }
    
    // 标记为已退款
    global.sceneGeneratorTasks[taskId].refunded = true;
    console.log('已将任务标记为已退款:', global.sceneGeneratorTasks[taskId]);
    
    return true;
  } else {
    console.log(`未找到任务 ${taskId}`);
    return false;
  }
}

// 测试退款
async function testRefund() {
  console.log('开始测试退款...');
  
  // 第一次退款应该成功
  const firstResult = await mockRefundSceneGeneratorCredits(1, taskId);
  console.log('第一次退款结果:', firstResult);
  
  // 第二次退款应该失败（因为已经退款过）
  const secondResult = await mockRefundSceneGeneratorCredits(1, taskId);
  console.log('第二次退款结果:', secondResult);
  
  // 测试不存在的任务ID
  const nonExistentResult = await mockRefundSceneGeneratorCredits(1, 'non-existent-task');
  console.log('不存在任务的退款结果:', nonExistentResult);
}

// 运行测试
testRefund().then(() => {
  console.log('测试完成');
}); 