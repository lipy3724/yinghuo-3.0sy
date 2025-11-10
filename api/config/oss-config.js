/**
 * 阿里云OSS配置文件
 * 
 * 此文件包含阿里云OSS的配置信息，用于服务端获取STS临时访问凭证
 */

module.exports = {
    // OSS基本配置
    region: 'oss-cn-beijing', // OSS区域，根据实际情况修改
    bucket: 'yinghuo-images', // 存储桶名称，根据实际情况修改
    directory: 'text-to-image/', // 存储目录，以斜杠结尾
    
    // 访问凭证（请替换为实际的凭证）
    accessKeyId: 'YOUR_ACCESS_KEY_ID', // 阿里云AccessKey ID
    accessKeySecret: 'YOUR_ACCESS_KEY_SECRET', // 阿里云AccessKey Secret
    
    // STS配置
    roleArn: 'acs:ram::YOUR_ACCOUNT_ID:role/yinghuo-oss-role', // RAM角色ARN
    tokenExpiration: 3600, // 临时凭证有效期，单位秒
    sessionName: 'yinghuo-web-oss-upload', // 会话名称
    
    // 回调配置
    callbackUrl: 'https://your-api-domain.com/api/oss/callback', // OSS上传回调URL
    callbackBodyType: 'application/json', // 回调内容类型
    callbackBody: JSON.stringify({
        bucket: '${bucket}',
        object: '${object}',
        etag: '${etag}',
        size: '${size}',
        mimeType: '${mimeType}',
        height: '${imageInfo.height}',
        width: '${imageInfo.width}',
        format: '${imageInfo.format}'
    })
};




