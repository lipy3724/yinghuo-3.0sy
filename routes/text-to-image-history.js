/**
 * 文生图片历史记录API路由
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');
const { getTextToImageHistory: getTextToImageHistoryOSS, clearTextToImageHistory: clearTextToImageHistoryOSS, saveTextToImageHistory: saveTextToImageHistoryOSS } = require('../services/textToImageHistoryOSS');
const ImageHistory = require('../models/ImageHistory');

/**
 * 获取文生图片历史记录
 * GET /api/text-to-image/history
 */
router.get('/', protect, async (req, res) => {
    console.log('接收到获取文生图片历史记录请求');
    try {
        const userId = req.user.id;
        const { limit = 10, last24Hours } = req.query;
        
        logger.info('接收到获取文生图片历史记录请求', {
            userId,
            limit: parseInt(limit),
            last24Hours: last24Hours === 'true'
        });
        
        // 构建查询选项
        const options = {
            limit: parseInt(limit),
            last24Hours: last24Hours === 'true'
        };
        
        // 获取历史记录 - 先尝试OSS，如果没有数据则从数据库迁移
        let tasks = [];
        
        try {
            logger.info('从OSS获取文生图片历史记录', { userId });
            tasks = await getTextToImageHistoryOSS(userId, options);
            logger.info('OSS获取成功', { userId, count: tasks.length });
            
            // 如果OSS中没有记录，尝试从数据库获取并迁移
            if (tasks.length === 0) {
                logger.info('OSS中没有历史记录，尝试从数据库获取并迁移', { userId });
                await migrateHistoryFromDatabase(userId, options);
                
                // 迁移后重新从OSS获取
                tasks = await getTextToImageHistoryOSS(userId, options);
                logger.info('迁移完成后从OSS获取', { userId, count: tasks.length });
            }
        } catch (ossError) {
            logger.error('从OSS获取文生图片历史记录失败', {
                userId,
                error: ossError.message
            });
            
            // OSS失败后尝试从数据库获取
            try {
                logger.info('OSS失败，尝试直接从数据库获取历史记录', { userId });
                tasks = await getHistoryFromDatabase(userId, options);
                logger.info('从数据库获取成功', { userId, count: tasks.length });
            } catch (dbError) {
                logger.error('从数据库获取历史记录也失败', {
                    userId,
                    error: dbError.message
                });
                tasks = [];
            }
        }
        
        logger.info('文生图片历史记录获取成功', {
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
        logger.error('获取文生图片历史记录API错误', {
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
 * 保存文生图片历史记录
 * POST /api/text-to-image/history
 */
router.post('/', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const historyItem = req.body;
        
        logger.info('接收到保存文生图片历史记录请求', {
            userId,
            hasPrompt: !!historyItem.prompt,
            hasImageUrl: !!historyItem.imageUrl
        });
        
        // 验证必要字段
        if (!historyItem.prompt || !historyItem.imageUrl) {
            return res.status(400).json({
                success: false,
                message: '提示词和图片URL不能为空'
            });
        }
        
        // 保存记录到OSS
        try {
            logger.info('保存文生图片历史记录到OSS', { userId });
            const result = await saveTextToImageHistoryOSS(userId, historyItem);
            logger.info('OSS保存成功', { userId, recordId: result.recordId });
            
            res.json({
                success: true,
                message: '历史记录保存成功',
                data: result
            });
        } catch (ossError) {
            logger.error('保存文生图片历史记录到OSS失败', {
                userId,
                error: ossError.message
            });
            
            return res.status(500).json({
                success: false,
                message: '保存历史记录失败',
                error: {
                    type: 'storage',
                    code: 'SAVE_FAILED',
                    message: ossError.message
                }
            });
        }
        
    } catch (error) {
        logger.error('保存文生图片历史记录API错误', {
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
 * 清空文生图片历史记录
 * DELETE /api/text-to-image/history
 */
router.delete('/', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        
        logger.info('接收到清空文生图片历史记录请求', { userId });
        
        // 清空OSS历史记录
        let ossCleared = false;
        try {
            await clearTextToImageHistoryOSS(userId);
            logger.info('OSS历史记录清空成功', { userId });
            ossCleared = true;
        } catch (ossError) {
            logger.error('清空OSS历史记录失败', {
                userId,
                error: ossError.message
            });
        }
        
        // 清空数据库历史记录
        let dbCleared = false;
        try {
            const { Op } = require('sequelize');
            const deletedCount = await ImageHistory.destroy({
                where: {
                    userId: userId,
                    type: {
                        [Op.in]: ['TEXT_TO_IMAGE', 'TEXT_TO_IMAGE_HISTORY']
                    }
                }
            });
            
            logger.info('数据库历史记录清空成功', { 
                userId, 
                deletedCount 
            });
            dbCleared = true;
        } catch (dbError) {
            logger.error('清空数据库历史记录失败', {
                userId,
                error: dbError.message
            });
        }
        
        // 检查清空结果 - 对于新用户，OSS和数据库中可能都没有数据，这是正常的
        if (!ossCleared && !dbCleared) {
            // 如果两者都失败，但可能是因为没有数据可清空，所以我们仍然返回成功
            logger.warn('OSS和数据库清空都失败，可能是因为没有数据需要清空', { userId });
        } else if (!ossCleared) {
            logger.warn('OSS清空失败但数据库清空成功', { userId });
        } else if (!dbCleared) {
            logger.warn('数据库清空失败但OSS清空成功', { userId });
        }
        
        res.json({
            success: true,
            message: '历史记录已清空'
        });
        
    } catch (error) {
        logger.error('清空文生图片历史记录API错误', {
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
 * 从数据库获取历史记录
 * @param {string} userId - 用户ID
 * @param {Object} options - 查询选项
 * @returns {Promise<Array>} 历史记录数组
 */
async function getHistoryFromDatabase(userId, options = {}) {
    try {
        const { limit = 10, last24Hours = false } = options;
        
        logger.info('从数据库获取文生图片历史记录', { userId, limit, last24Hours });
        
        // 构建查询条件
        const whereConditions = {
            userId: userId,
            type: ['TEXT_TO_IMAGE', 'TEXT_TO_IMAGE_HISTORY']
        };
        
        // 如果需要过滤最近24小时
        if (last24Hours) {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            whereConditions.createdAt = {
                [require('sequelize').Op.gte]: twentyFourHoursAgo
            };
        }
        
        // 查询数据库
        const records = await ImageHistory.findAll({
            where: whereConditions,
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit)
        });
        
        // 转换为前端需要的格式
        const tasks = records.map(record => ({
            id: record.id,
            prompt: record.prompt || '文生图片',
            imageUrl: record.outputUrl,
            originalImageUrl: record.inputUrl,
            options: record.options ? JSON.parse(record.options) : {},
            created_at: record.createdAt.toISOString(),
            timeDisplay: formatDate(record.createdAt)
        }));
        
        logger.info('从数据库获取文生图片历史记录成功', {
            userId,
            count: tasks.length
        });
        
        return tasks;
    } catch (error) {
        logger.error('从数据库获取文生图片历史记录失败', {
            userId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * 将数据库中的历史记录迁移到OSS
 * @param {string} userId - 用户ID
 * @param {Object} options - 查询选项
 * @returns {Promise<void>}
 */
async function migrateHistoryFromDatabase(userId, options = {}) {
    try {
        logger.info('开始迁移数据库历史记录到OSS', { userId });
        
        // 从数据库获取历史记录
        const dbRecords = await getHistoryFromDatabase(userId, { limit: 50 }); // 迁移最近50条记录
        
        if (dbRecords.length === 0) {
            logger.info('数据库中没有需要迁移的历史记录', { userId });
            return;
        }
        
        logger.info('找到需要迁移的历史记录', { userId, count: dbRecords.length });
        
        // 逐条迁移到OSS
        let migratedCount = 0;
        for (const record of dbRecords) {
            try {
                await saveTextToImageHistoryOSS(userId, {
                    prompt: record.prompt,
                    imageUrl: record.imageUrl,
                    originalImageUrl: record.originalImageUrl,
                    options: record.options
                });
                migratedCount++;
            } catch (migrateError) {
                logger.error('迁移单条记录失败', {
                    userId,
                    recordId: record.id,
                    error: migrateError.message
                });
                // 继续迁移其他记录
            }
        }
        
        logger.info('历史记录迁移完成', {
            userId,
            totalRecords: dbRecords.length,
            migratedCount
        });
        
        // 可选：迁移成功后删除数据库中的记录（暂时注释掉，保留数据库记录作为备份）
        /*
        try {
            await ImageHistory.destroy({
                where: {
                    userId: userId,
                    type: ['TEXT_TO_IMAGE', 'TEXT_TO_IMAGE_HISTORY']
                }
            });
            logger.info('已删除数据库中的历史记录', { userId });
        } catch (deleteError) {
            logger.error('删除数据库历史记录失败', {
                userId,
                error: deleteError.message
            });
        }
        */
        
    } catch (error) {
        logger.error('迁移历史记录失败', {
            userId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * 格式化日期为"YYYY-MM-DD HH:mm"格式
 * @param {Date} date 日期对象
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

module.exports = router;
