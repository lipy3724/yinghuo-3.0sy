/**
 * 获取阿里云OSS STS临时访问凭证
 * 
 * 此接口用于获取阿里云OSS的临时访问凭证，使前端能够安全地上传文件到OSS
 * 
 * @route GET /api/oss/sts-token
 * @requires 用户认证
 */

// 导入所需模块
const express = require('express');
const router = express.Router();
const STS = require('ali-oss').STS;
const { protect } = require('../../middleware/auth');
const ossConfig = require('../../oss-config');
const logger = require('../../utils/logger');

/**
 * 获取OSS STS临时访问凭证
 * 
 * @route GET /api/oss/sts-token
 * @requires 用户认证
 * @returns {Object} 包含临时凭证的对象
 */
router.get('/sts-token', protect, async (req, res) => {
    try {
        // 创建STS客户端
        logger.info('正在处理STS Token请求', {
            userId: req.user.id,
            accessKeyId: ossConfig.accessKeyId ? '已配置' : '未配置',
            accessKeySecret: ossConfig.accessKeySecret ? '已配置' : '未配置',
            roleArn: ossConfig.stsConfig && ossConfig.stsConfig.roleArn ? '已配置' : '未配置',
            bucket: ossConfig.bucket || '未配置'
        });
        
        // 检查必要配置
        if (!ossConfig.accessKeyId || !ossConfig.accessKeySecret) {
            logger.error('OSS STS Token错误: accessKeyId或accessKeySecret未配置');
            return res.status(500).json({
                success: false,
                message: 'OSS配置错误: 缺少访问凭证'
            });
        }
        
        if (!ossConfig.stsConfig || !ossConfig.stsConfig.roleArn) {
            logger.error('OSS STS Token错误: roleArn未配置');
            return res.status(500).json({
                success: false,
                message: 'OSS配置错误: 缺少角色ARN'
            });
        }
        
        const sts = new STS({
            accessKeyId: ossConfig.accessKeyId,
            accessKeySecret: ossConfig.accessKeySecret
        });
        
        // 设置STS策略
        const policy = {
            "Statement": [
                {
                    "Action": [
                        "oss:PutObject",
                        "oss:GetObject"
                    ],
                    "Effect": "Allow",
                    "Resource": [
                        `acs:oss:*:*:${ossConfig.bucket}/${ossConfig.paths.textToImage}*`
                    ]
                }
            ],
            "Version": "1"
        };
        
        logger.info('准备获取STS临时凭证', {
            userId: req.user.id,
            roleArn: ossConfig.stsConfig.roleArn,
            durationSeconds: ossConfig.stsConfig.durationSeconds || 3600
        });
        
        // 获取临时凭证
        const result = await sts.assumeRole(
            ossConfig.stsConfig.roleArn,
            policy,
            ossConfig.stsConfig.durationSeconds || 3600,
            ossConfig.stsConfig.sessionName || 'yinghuo-web-session'
        );
        
        // 添加策略和签名信息
        const credentials = result.credentials;
        const expiration = credentials.Expiration;
        const policyText = {
            expiration: expiration,
            conditions: [
                ['content-length-range', 0, 10485760], // 10MB
                ['starts-with', '$key', ossConfig.paths.textToImage]
            ]
        };
        
        let encodedPolicy = Buffer.from(JSON.stringify(policyText)).toString('base64');
        const signature = require('crypto')
            .createHmac('sha1', credentials.AccessKeySecret)
            .update(encodedPolicy)
            .digest('base64');
        
        logger.info('STS临时凭证获取成功', {
            userId: req.user.id,
            expiration: credentials.Expiration
        });
        
        // 返回临时凭证和策略信息
        return res.json({
            success: true,
            credentials: credentials,
            policy: encodedPolicy,
            signature: signature
        });
    } catch (error) {
        logger.error('获取OSS STS Token失败', {
            userId: req.user ? req.user.id : '未知',
            error: error.message,
            stack: error.stack
        });
        
        return res.status(500).json({
            success: false,
            message: '获取OSS临时凭证失败',
            error: error.message
        });
    }
});

module.exports = router;
