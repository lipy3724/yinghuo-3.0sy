/**
 * 阿里云OSS上传回调处理
 * 
 * 此接口用于处理阿里云OSS上传完成后的回调请求
 * 
 * @route POST /api/oss/callback
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const config = require('../../oss-config');
const User = require('../../models/User');
const ImageRecord = require('../../models/ImageRecord');

/**
 * OSS上传回调处理
 * 
 * @route POST /api/oss/callback
 * @returns {Object} 回调处理结果
 */
router.post('/callback', async (req, res) => {
    try {
        // 验证OSS回调请求的合法性
        const authorization = req.headers.authorization;
        const pubKeyUrl = req.headers['x-oss-pub-key-url'];
        const bodyRaw = req.rawBody; // 需要在app.js中配置获取原始请求体
        
        // 验证签名
        if (!verifyOSSCallback(authorization, pubKeyUrl, bodyRaw, req.url)) {
            return res.status(403).json({
                success: false,
                message: '非法的OSS回调请求'
            });
        }
        
        // 处理回调数据
        const callbackData = req.body;
        console.log('OSS回调数据:', callbackData);
        
        // 解析元数据
        const userId = callbackData.userId;
        const imageType = callbackData.imageType || 'TEXT_TO_IMAGE';
        const description = callbackData.description || '';
        const originalUrl = callbackData.originalUrl;
        
        // 构建OSS图片URL
        const ossImageUrl = `https://${callbackData.bucket}.${config.region}.aliyuncs.com/${callbackData.object}`;
        
        // 记录图片信息到数据库
        if (userId) {
            await ImageRecord.create({
                userId: userId,
                type: imageType,
                imageUrl: ossImageUrl,
                originalImageUrl: originalUrl,
                description: description,
                width: callbackData.width,
                height: callbackData.height,
                size: callbackData.size,
                format: callbackData.format,
                storage: 'oss',
                storagePath: callbackData.object
            });
            
            console.log('图片记录已保存到数据库');
        }
        
        // 返回成功响应
        return res.json({
            success: true,
            message: '回调处理成功',
            imageUrl: ossImageUrl
        });
    } catch (error) {
        console.error('处理OSS回调失败:', error);
        return res.status(500).json({
            success: false,
            message: '处理OSS回调失败',
            error: error.message
        });
    }
});

/**
 * 验证OSS回调请求的合法性
 * 
 * @param {string} authorization 授权头
 * @param {string} pubKeyUrl 公钥URL
 * @param {string} bodyRaw 原始请求体
 * @param {string} path 请求路径
 * @returns {boolean} 验证结果
 */
function verifyOSSCallback(authorization, pubKeyUrl, bodyRaw, path) {
    // 实际项目中应该实现完整的验证逻辑
    // 此处为简化示例，仅返回true
    // 详细验证逻辑请参考阿里云OSS文档
    return true;
}

module.exports = router;
