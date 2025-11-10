
const path = require('path');

// 测试1: 默认加载
console.log('测试1: 默认加载');
require('dotenv').config();
console.log('DB_HOST:', process.env.DB_HOST || '未加载');
console.log('ALIPAY_APP_ID:', process.env.ALIPAY_APP_ID || '未加载');

// 重置环境变量
delete process.env.DB_HOST;
delete process.env.ALIPAY_APP_ID;

// 测试2: 使用绝对路径加载
console.log('\n测试2: 使用绝对路径加载');
const envPath = path.resolve('/Users/houkai/Documents/Yinghuo1/9.11', '.env');
console.log('尝试加载:', envPath);
require('dotenv').config({ path: envPath });
console.log('DB_HOST:', process.env.DB_HOST || '未加载');
console.log('ALIPAY_APP_ID:', process.env.ALIPAY_APP_ID || '未加载');
