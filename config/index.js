/**
 * 应用配置
 */
require('dotenv').config();

module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  
  // 数据库配置
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/yinghuo',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'yinghuoai_default_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  // OSS配置
  oss: {
    region: process.env.OSS_REGION,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
    endpoint: process.env.OSS_ENDPOINT
  },
  
  // 其他配置
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
  }
};
