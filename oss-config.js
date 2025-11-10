/**
 * OSS配置文件
 * 用于阿里云OSS存储服务配置
 */
require('dotenv').config();

module.exports = {
    // OSS基本配置
    region: process.env.OSS_REGION || 'oss-cn-shanghai',
    bucket: process.env.OSS_BUCKET || 'yinghuo-ai',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET,
    endpoint: process.env.OSS_ENDPOINT,
    
    // 安全配置
    secure: process.env.OSS_SECURE === 'true' || true,
    timeout: parseInt(process.env.OSS_TIMEOUT) || 60000,
    
    // 存储路径配置
    paths: {
        textToImage: 'text-to-image/',
        imageHistory: 'image-history/',
        uploads: 'uploads/'
    },
    
    // STS配置（如果需要）
    stsConfig: {
        roleArn: process.env.OSS_ROLE_ARN,
        sessionName: 'yinghuo-web-session',
        durationSeconds: 3600
    },
    
    // 验证配置是否完整
    isValid() {
        return !!(this.accessKeyId && this.accessKeySecret && this.bucket && this.region);
    }
};




