/**
 * 测试模糊图片变清晰功能的API端点是否可访问
 */

const axios = require('axios');

// 配置
const config = {
  baseUrl: 'http://localhost:3000',  // 根据实际情况修改
  authToken: ''  // 登录后获取的认证令牌
};

// 登录函数
async function login(username, password) {
  try {
    const response = await axios.post(`${config.baseUrl}/api/auth/login`, {
      username,
      password
    });
    
    if (response.data && response.data.token) {
      config.authToken = response.data.token;
      console.log('登录成功，获取到认证令牌');
      return true;
    } else {
      console.error('登录失败，未获取到认证令牌');
      return false;
    }
  } catch (error) {
    console.error('登录请求失败:', error.message);
    return false;
  }
}

// 测试API端点
async function testEndpoint(endpoint, method = 'GET', data = null) {
  try {
    const options = {
      headers: {
        'Authorization': `Bearer ${config.authToken}`
      }
    };
    
    let response;
    if (method === 'GET') {
      response = await axios.get(`${config.baseUrl}${endpoint}`, options);
    } else if (method === 'POST') {
      response = await axios.post(`${config.baseUrl}${endpoint}`, data, options);
    }
    
    console.log(`✅ ${method} ${endpoint} - 成功`);
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`❌ ${method} ${endpoint} - 失败: ${error.message}`);
    if (error.response) {
      console.error(`  状态码: ${error.response.status}`);
      console.error(`  响应数据: ${JSON.stringify(error.response.data)}`);
    }
    return { success: false, error };
  }
}

// 主测试函数
async function runTests() {
  console.log('========== 开始测试API端点 ==========');
  
  // 登录
  console.log('\n--- 步骤1: 登录 ---');
  const username = process.argv[2] || 'testuser';
  const password = process.argv[3] || 'password';
  
  if (!await login(username, password)) {
    console.error('登录失败，测试终止');
    return;
  }
  
  // 测试模糊图片变清晰历史记录API
  console.log('\n--- 步骤2: 测试模糊图片变清晰历史记录API ---');
  
  // 测试/api/image-sharpen-history/test端点
  await testEndpoint('/api/image-sharpen-history/test');
  
  // 测试/api/image-sharpen-history/list端点
  await testEndpoint('/api/image-sharpen-history/list');
  
  // 测试/api/image-edit/create-task端点
  console.log('\n--- 步骤3: 测试模糊图片变清晰任务创建API ---');
  const createTaskData = {
    model: "wanx2.1-imageedit",
    input: {
      function: "super_resolution",
      prompt: "增强图像清晰度，提高细节，去除噪点",
      base_image_url: "https://example.com/test-image.jpg", // 测试用URL
      upscale_factor: 1
    },
    parameters: {
      n: 1
    }
  };
  
  await testEndpoint('/api/image-edit/create-task', 'POST', createTaskData);
  
  console.log('\n========== 测试完成 ==========');
}

// 执行测试
runTests().catch(error => {
  console.error('测试过程中发生错误:', error);
});
