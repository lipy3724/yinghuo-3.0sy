/**
 * 上传图片到OSS的路由
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');
const { uploadImageToOSS } = require('../services/imageDiantuHistoryOSS');

// 配置multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
});

/**
 * 上传图片到OSS
 * POST /api/upload-to-oss
 */
router.post('/', protect, upload.single('image'), async (req, res) => {
    try {
        const userId = req.user.id;
        const file = req.file;
        const prefix = req.body.prefix || 'uploads';
        
        logger.info('接收到上传图片到OSS请求', {
            userId,
            fileSize: file ? file.size : 0,
            prefix
        });
        
        if (!file) {
            return res.status(400).json({
                success: false,
                message: '未提供图片文件'
            });
        }
        
        // 将文件转换为base64
        const base64Data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
        
        // 上传到OSS
        const url = await uploadImageToOSS(userId, base64Data, prefix);
        
        logger.info('图片上传到OSS成功', {
            userId,
            url
        });
        
        return res.status(200).json({
            success: true,
            url,
            message: '图片上传成功'
        });
    } catch (error) {
        logger.error('上传图片到OSS失败', {
            error: error.message,
            stack: error.stack
        });
        
        return res.status(500).json({
            success: false,
            message: '上传图片失败: ' + error.message
        });
    }
});

module.exports = router;