require('dotenv').config();
const axios = require('axios');

async function testDashScopeAPI() {
  console.log('=== DashScope API配置检查 ===');
  console.log('DASHSCOPE_API_KEY:', process.env.DASHSCOPE_API_KEY ? '已配置' : '未配置');
  console.log();

  if (!process.env.DASHSCOPE_API_KEY) {
    console.error('错误: DASHSCOPE_API_KEY未配置，请在.env文件中设置正确的API密钥');
    return;
  }

  try {
    console.log('=== DashScope API连接测试 ===');
    console.log('正在连接DashScope API...');
    
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        model: 'qwen-turbo',
        input: {
          prompt: '你好，请用一句话介绍一下自己'
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`
        }
      }
    );
    
    console.log('API连接成功！');
    console.log('模型回复:', response.data.output.text);
  } catch (error) {
    console.error('API连接失败！');
    if (error.response) {
      console.error('错误状态码:', error.response.status);
      console.error('错误详情:', error.response.data);
    } else if (error.request) {
      console.error('未收到响应，可能是网络问题或API地址错误');
    } else {
      console.error('请求配置错误:', error.message);
    }
  }
}

testDashScopeAPI();
