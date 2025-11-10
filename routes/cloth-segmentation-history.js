/**
 * 智能服饰分割历史记录API路由
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { saveClothSegmentationHistoryOSS, getClothSegmentationHistoryOSS, clearClothSegmentationHistoryOSS } = require('../services/clothSegmentationHistoryOSS');
const logger = require('../utils/logger');
const ImageHistory = require('../models/ImageHistory');

/**
 * 保存智能服饰分割历史记录
 * POST /api/cloth-segmentation/history
 */
router.post('/', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const historyItem = req.body;
        
        logger.info('接收到保存智能服饰分割历史记录请求', {
            userId,
            hasInput: !!historyItem.inputUrl,
            hasOutput: !!historyItem.outputUrl,
            clothClasses: historyItem.clothClasses
        });
        
        // 验证必要字段
        if (!historyItem.outputUrl) {
            return res.status(400).json({
                success: false,
                message: '输出图片URL不能为空'
            });
        }
        
        // 始终使用OSS存储
        const storageType = 'oss';
        
        // 保存记录到OSS
        let recordId;
        try {
            logger.info('使用OSS存储智能服饰分割历史记录', { userId });
            recordId = await saveClothSegmentationHistoryOSS(userId, historyItem);
            logger.info('OSS存储成功', { userId, recordId });
        } catch (storageError) {
            logger.error('智能服饰分割历史记录存储失败', {
                userId,
                storageType,
                error: storageError.message
            });
            
            return res.status(500).json({
                success: false,
                message: '保存历史记录失败',
                error: {
                    type: 'storage',
                    code: 'SAVE_FAILED',
                    message: storageError.message
                }
            });
        }
        
        // 注释：移除自动备份到下载中心（ImageHistory数据库）的逻辑
        // 用户现在需要手动点击"保存到下载中心"按钮才能将图片保存到下载中心
        // 这样可以避免智能服饰分割结果自动出现在下载中心，给用户更多控制权
        
        logger.info('智能服饰分割历史记录保存完成（不自动备份到下载中心）', { userId, recordId });
        
        logger.info('智能服饰分割历史记录保存成功', {
            userId,
            recordId,
            storageType
        });
        
        res.json({
            success: true,
            message: '历史记录保存成功',
            data: {
                recordId,
                storageType
            }
        });
        
    } catch (error) {
        logger.error('保存智能服饰分割历史记录API错误', {
            userId: req.user?.id,
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: {
                type: 'server',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

/**
 * 获取智能服饰分割历史记录
 * GET /api/cloth-segmentation/history
 */
router.get('/', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 10, last24Hours } = req.query;
        
        logger.info('接收到获取智能服饰分割历史记录请求', {
            userId,
            limit: parseInt(limit),
            last24Hours: last24Hours === 'true'
        });
        
        // 构建查询选项
        const options = {
            limit: parseInt(limit),
            last24Hours: last24Hours === 'true'
        };
        
        // 获取历史记录 - 默认使用OSS
        let tasks = [];
        
        try {
            logger.info('从OSS获取智能服饰分割历史记录', { userId });
            tasks = await getClothSegmentationHistoryOSS(userId, options);
            logger.info('OSS获取成功', { userId, count: tasks.length });
        } catch (ossError) {
            logger.error('从OSS获取智能服饰分割历史记录失败', {
                userId,
                error: ossError.message
            });
            
            // OSS失败后返回空数组
            tasks = [];
        }
        
        logger.info('智能服饰分割历史记录获取成功', {
            userId,
            count: tasks.length
        });
        
        res.json({
            success: true,
            data: {
                tasks,
                total: tasks.length
            }
        });
        
    } catch (error) {
        logger.error('获取智能服饰分割历史记录API错误', {
            userId: req.user?.id,
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: {
                type: 'server',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

/**
 * 清空智能服饰分割历史记录
 * DELETE /api/cloth-segmentation/history
 */
router.delete('/', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        
        logger.info('接收到清空智能服饰分割历史记录请求', { userId });
        
        // 清空OSS中的历史记录
        try {
            logger.info('清空OSS中的智能服饰分割历史记录', { userId });
            await clearClothSegmentationHistoryOSS(userId);
            logger.info('OSS清空成功', { userId });
        } catch (ossError) {
            logger.error('清空OSS中的智能服饰分割历史记录失败', {
                userId,
                error: ossError.message
            });
            
            return res.status(500).json({
                success: false,
                message: '清空历史记录失败',
                error: {
                    type: 'storage',
                    code: 'CLEAR_FAILED',
                    message: ossError.message
                }
            });
        }
        
        logger.info('智能服饰分割历史记录清空成功', { userId });
        
        res.json({
            success: true,
            message: '历史记录已清空'
        });
        
    } catch (error) {
        logger.error('清空智能服饰分割历史记录API错误', {
            userId: req.user?.id,
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: {
                type: 'server',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

module.exports = router;
