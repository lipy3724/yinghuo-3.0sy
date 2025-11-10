/**
 * 场景图生成退款API测试脚本
 */

const fetch = require('node-fetch');

// 测试配置
const API_URL = 'http://localhost:3000/api/refund/scene-generator';
const AUTH_TOKEN = ''; // 填入有效的认证令牌
const TEST_TASK_ID = `scene-generator-test-${Date.now()}`;

// 初始化全局变量
global.sceneGeneratorTasks = {};
global.sceneGeneratorTasks[TEST_TASK_ID] = {
  userId: 1,
  creditCost: 7,
  hasChargedCredits: true,
  isFree: false,
  timestamp: new Date()
};

console.log(`已创建测试任务: ${TEST_TASK_ID}`);

/**
 * 测试退款API
 */
async function testRefundApi() {
  try {
    console.log('开始测试退款API...');
    
    if (!AUTH_TOKEN) {
      console.error('请先设置有效的认证令牌');
      return;
    }
    
    // 发送退款请求
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        taskId: TEST_TASK_ID,
        reason: 'API测试退款'
      })
    });
    
    const result = await response.json();
    console.log('API响应:', result);
    
    // 验证退款结果
    if (result.success) {
      console.log('退款API调用成功');
      
      // 检查全局变量中的退款标记
      if (global.sceneGeneratorTasks[TEST_TASK_ID].refunded) {
        console.log('任务已正确标记为已退款');
      } else {
        console.error('任务未被标记为已退款');
      }
    } else {
      console.error('退款API调用失败:', result.message);
    }
    
    // 测试重复退款
    console.log('\n测试重复退款...');
    const repeatResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        taskId: TEST_TASK_ID,
        reason: '重复退款测试'
      })
    });
    
    const repeatResult = await repeatResponse.json();
    console.log('重复退款响应:', repeatResult);
    
    // 测试无效任务ID
    console.log('\n测试无效任务ID...');
    const invalidResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        taskId: 'invalid-task-id',
        reason: '无效任务ID测试'
      })
    });
    
    const invalidResult = await invalidResponse.json();
    console.log('无效任务ID响应:', invalidResult);
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 运行测试
testRefundApi().then(() => {
  console.log('\n测试完成');
}); 