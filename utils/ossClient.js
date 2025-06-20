const OSS = require('ali-oss');
require('dotenv').config();

// 创建并导出 OSS 客户端实例
const client = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_AK || process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_SK || process.env.ALIYUN_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET
});

module.exports = client; 