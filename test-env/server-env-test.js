
  // 模拟server.js的环境变量加载部分
  const path = require('path');
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
  
  console.log('环境变量加载测试:');
  console.log('- DB_HOST:', process.env.DB_HOST || '未加载');
  console.log('- ALIPAY_APP_ID:', process.env.ALIPAY_APP_ID || '未加载');
  