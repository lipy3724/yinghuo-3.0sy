/**
 * 垫图历史记录路由
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');
const { saveDiantuHistoryOSS, getDiantuHistoryOSS, clearDiantuHistoryOSS } = require('../services/imageDiantuHistoryOSS');

/**
 * 保存垫图历史记录
 * POST /api/diantu/history
 */
router.post('/', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const historyItem = req.body;
        
        logger.info('接收到保存垫图历史记录请求', {
            userId,
            hasOriginal: !!historyItem.originalImageUrl,
            hasResult: !!historyItem.processedImageUrl,
            taskStatus: historyItem.taskStatus
        });
        
        // 验证必要字段
        if (!historyItem.processedImageUrl) {
            return res.status(400).json({
                success: false,
                message: '结果图片URL不能为空'
            });
        }
        
        // 确保只有在任务成功后才保存历史记录
        if (historyItem.taskStatus && historyItem.taskStatus !== 'SUCCEEDED') {
            logger.info('任务未成功完成，不保存历史记录', { 
                userId, 
                taskStatus: historyItem.taskStatus 
            });
            return res.status(200).json({
                success: false,
                message: '任务未成功完成，不保存历史记录'
            });
        }
        
        // 默认使用OSS存储
        const useOSS = historyItem.storage !== 'local';
        
        // 存储类型
        let storageType = useOSS ? 'oss' : 'local';
        
        // 保存记录
        let recordId;
        try {
            if (useOSS) {
                logger.info('使用OSS存储历史记录', { userId });
                recordId = await saveDiantuHistoryOSS(userId, historyItem);
            } else {
                // 如果需要本地存储，可以在这里实现
                logger.info('使用本地存储历史记录', { userId });
                throw new Error('本地存储方式暂未实现');
            }
            
            logger.info('垫图历史记录保存成功', {
                userId,
                recordId,
                storage: storageType
            });
            
            return res.status(200).json({
                success: true,
                recordId,
                storage: storageType,
                message: '历史记录保存成功'
            });
        } catch (storageError) {
            logger.error('保存历史记录失败', {
                userId,
                error: storageError.message,
                stack: storageError.stack
            });
            
            // 如果一种存储方式失败，尝试另一种
            try {
                if (useOSS) {
                    logger.info('OSS存储失败，尝试使用本地存储', { userId });
                    // 如果需要本地存储，可以在这里实现
                    throw new Error('本地存储方式暂未实现');
                } else {
                    logger.info('本地存储失败，尝试使用OSS存储', { userId });
                    recordId = await saveDiantuHistoryOSS(userId, historyItem);
                    storageType = 'oss';
                }
                
                logger.info('垫图历史记录保存成功（备用方式）', {
                    userId,
                    recordId,
                    storage: storageType
                });
                
                return res.status(200).json({
                    success: true,
                    recordId,
                    storage: storageType,
                    message: '历史记录保存成功（备用方式）'
                });
            } catch (fallbackError) {
                logger.error('备用存储方式也失败', {
                    userId,
                    error: fallbackError.message,
                    stack: fallbackError.stack
                });
                
                return res.status(500).json({
                    success: false,
                    message: '历史记录保存失败: ' + fallbackError.message
                });
            }
        }
    } catch (error) {
        logger.error('保存垫图历史记录异常', {
            error: error.message,
            stack: error.stack
        });
        
        return res.status(500).json({
            success: false,
            message: '服务器错误: ' + error.message
        });
    }
});

/**
 * 获取垫图历史记录
 * GET /api/diantu/history
 */
router.get('/', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 10;
        const last24Hours = req.query.last24Hours === 'true';
        const storage = req.query.storage || 'oss';
        
        logger.info('接收到获取垫图历史记录请求', {
            userId,
            limit,
            last24Hours,
            storage
        });
        
        let history = [];
        
        // 获取历史记录
        try {
            if (storage === 'oss' || storage === 'all') {
                history = await getDiantuHistoryOSS(userId, { limit, last24Hours });
            } else {
                // 如果需要本地存储，可以在这里实现
                logger.info('本地存储方式暂未实现，使用OSS', { userId });
                history = await getDiantuHistoryOSS(userId, { limit, last24Hours });
            }
            
            logger.info('获取垫图历史记录成功', {
                userId,
                count: history.length
            });
            
            return res.status(200).json({
                success: true,
                history,
                count: history.length
            });
        } catch (getError) {
            logger.error('获取历史记录失败', {
                userId,
                error: getError.message,
                stack: getError.stack
            });
            
            // 如果一种存储方式失败，尝试另一种
            try {
                if (storage === 'oss') {
                    logger.info('OSS存储获取失败，尝试使用本地存储', { userId });
                    // 如果需要本地存储，可以在这里实现
                    throw new Error('本地存储方式暂未实现');
                } else {
                    logger.info('本地存储获取失败，尝试使用OSS', { userId });
                    history = await getDiantuHistoryOSS(userId, { limit, last24Hours });
                }
                
                logger.info('获取垫图历史记录成功（备用方式）', {
                    userId,
                    count: history.length
                });
                
                return res.status(200).json({
                    success: true,
                    history,
                    count: history.length
                });
            } catch (fallbackError) {
                logger.error('备用存储方式获取也失败', {
                    userId,
                    error: fallbackError.message,
                    stack: fallbackError.stack
                });
                
                return res.status(500).json({
                    success: false,
                    message: '获取历史记录失败: ' + fallbackError.message
                });
            }
        }
    } catch (error) {
        logger.error('获取垫图历史记录异常', {
            error: error.message,
            stack: error.stack
        });
        
        return res.status(500).json({
            success: false,
            message: '服务器错误: ' + error.message
        });
    }
});

/**
 * 清空垫图历史记录
 * DELETE /api/diantu/history
 */
router.delete('/', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const storage = req.query.storage || 'all';
        
        logger.info('接收到清空垫图历史记录请求', {
            userId,
            storage
        });
        
        let deletedCount = 0;
        
        // 清空OSS存储的历史记录
        if (storage === 'oss' || storage === 'all') {
            try {
                await clearDiantuHistoryOSS(userId);
                logger.info('清空OSS历史记录成功', { userId });
                deletedCount += 1; // 由于OSS不返回具体删除数量，这里只能估计
            } catch (clearOSSError) {
                logger.error('清空OSS历史记录失败', {
                    userId,
                    storage,
                    error: clearOSSError.message,
                    stack: clearOSSError.stack
                });
                
                // 如果只清空OSS存储，则返回错误
                if (storage === 'oss') {
                    return res.status(500).json({
                        success: false,
                        message: '清空OSS历史记录失败'
                    });
                }
            }
        }
        
        // 清空本地存储的历史记录（如果需要）
        if (storage === 'local' || storage === 'all') {
            try {
                // 如果需要本地存储，可以在这里实现
                logger.info('本地存储方式暂未实现', { userId });
                
                // 如果只清空本地存储，则返回错误
                if (storage === 'local') {
                    return res.status(500).json({
                        success: false,
                        message: '本地存储方式暂未实现'
                    });
                }
            } catch (clearLocalError) {
                logger.error('清空本地历史记录失败', {
                    userId,
                    storage,
                    error: clearLocalError.message,
                    stack: clearLocalError.stack
                });
                
                // 如果只清空本地存储，则返回错误
                if (storage === 'local') {
                    return res.status(500).json({
                        success: false,
                        message: '清空本地历史记录失败'
                    });
                }
            }
        }
        
        // 如果所有存储方式都清空失败，则返回错误
        if (deletedCount === 0 && storage === 'all') {
            return res.status(500).json({
                success: false,
                message: '清空历史记录失败'
            });
        }
        
        logger.info('清空垫图历史记录成功', {
            userId,
            deletedCount
        });
        
        return res.status(200).json({
            success: true,
            deletedCount,
            message: '历史记录已清空'
        });
    } catch (error) {
        logger.error('清空垫图历史记录异常', {
            error: error.message,
            stack: error.stack
        });
        
        return res.status(500).json({
            success: false,
            message: '服务器错误: ' + error.message
        });
    }
});

module.exports = router;
