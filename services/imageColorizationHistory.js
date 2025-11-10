/**
 * 图像上色历史记录服务（本地存储）
 */
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const fetch = require('node-fetch'); // 添加node-fetch引入

// 历史记录存储目录
const HISTORY_DIR = path.join(__dirname, '../data/colorization-history');

/**
 * 确保历史记录目录存在
 * @param {string} userId - 用户ID
 * @returns {Promise<string>} 用户历史记录目录路径
 */
async function ensureUserHistoryDir(userId) {
    try {
        // 创建主目录（如果不存在）
        try {
            await fs.mkdir(HISTORY_DIR, { recursive: true });
        } catch (err) {
            if (err.code !== 'EEXIST') {
                throw err;
            }
        }
        
        // 创建用户目录（如果不存在）
        const userDir = path.join(HISTORY_DIR, userId);
        try {
            await fs.mkdir(userDir, { recursive: true });
        } catch (err) {
            if (err.code !== 'EEXIST') {
                throw err;
            }
        }
        
        return userDir;
    } catch (error) {
        logger.error('创建历史记录目录失败', {
            userId,
            error: error.message,
            stack: error.stack
        });
        throw new Error(`创建历史记录目录失败: ${error.message}`);
    }
}

/**
 * 保存图像到本地文件
 * @param {string} userId - 用户ID
 * @param {string} imageData - 图像数据（Base64或URL）
 * @param {string} prefix - 文件名前缀
 * @returns {Promise<string>} 图像文件路径
 */
async function saveImageToFile(userId, imageData, prefix = 'result') {
    try {
        if (!imageData) {
            throw new Error('图像数据不能为空');
        }
        
        // 确保用户目录存在
        const userDir = await ensureUserHistoryDir(userId);
        
        // 生成文件名
        const fileName = `${prefix}-${uuidv4()}.png`;
        const filePath = path.join(userDir, fileName);
        
        let buffer;
        
        // 处理不同类型的图像数据
        if (imageData.startsWith('data:image')) {
            // Base64数据
            const base64Data = imageData.split(',')[1];
            buffer = Buffer.from(base64Data, 'base64');
        } else if (imageData.startsWith('http')) {
            // URL数据，需要先下载
            const response = await fetch(imageData);
            const arrayBuffer = await response.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
        } else {
            throw new Error('不支持的图像数据格式');
        }
        
        // 保存文件
        await fs.writeFile(filePath, buffer);
        
        logger.info('图像保存到文件成功', {
            userId,
            filePath,
            size: buffer.length
        });
        
        return filePath;
    } catch (error) {
        logger.error('图像保存到文件失败', {
            userId,
            error: error.message,
            stack: error.stack
        });
        throw new Error(`图像保存到文件失败: ${error.message}`);
    }
}

/**
 * 保存图像上色历史记录
 * @param {string} userId - 用户ID
 * @param {Object} historyItem - 历史记录项
 * @returns {Promise<string>} 记录ID
 */
async function saveColorizationHistory(userId, historyItem) {
    try {
        logger.info('保存图像上色历史记录', {
            userId,
            hasOriginal: !!historyItem.originalImage,
            hasResult: !!historyItem.resultImage
        });
        
        // 确保必要的字段存在
        if (!historyItem || !historyItem.resultImage) {
            logger.error('保存失败: 结果图片不能为空', { userId });
            throw new Error('结果图片不能为空');
        }
        
        // 确保用户目录存在
        const userDir = await ensureUserHistoryDir(userId);
        
        // 保存结果图片
        let resultImagePath = null;
        if (historyItem.resultImage) {
            try {
                resultImagePath = await saveImageToFile(userId, historyItem.resultImage, 'result');
                logger.info('结果图片保存成功', { userId, resultImagePath });
            } catch (saveError) {
                logger.error('结果图片保存失败', {
                    userId,
                    error: saveError.message
                });
                throw new Error(`结果图片保存失败: ${saveError.message}`);
            }
        }
        
        // 保存原始图片（如果有）
        let originalImagePath = null;
        if (historyItem.originalImage) {
            try {
                originalImagePath = await saveImageToFile(userId, historyItem.originalImage, 'original');
                logger.info('原始图片保存成功', { userId, originalImagePath });
            } catch (saveError) {
                logger.error('原始图片保存失败', {
                    userId,
                    error: saveError.message
                });
                // 原始图片保存失败不影响整体流程
            }
        }
        
        // 创建记录对象
        const recordId = uuidv4();
        const record = {
            id: recordId,
            originalImage: originalImagePath,
            resultImage: resultImagePath,
            prompt: historyItem.prompt || '图像上色',
            createdAt: new Date().toISOString()
        };
        
        // 保存记录到JSON文件
        const recordFile = path.join(userDir, `${recordId}.json`);
        await fs.writeFile(recordFile, JSON.stringify(record, null, 2));
        
        logger.info('历史记录保存成功', {
            userId,
            recordId,
            recordFile
        });
        
        return recordId;
    } catch (error) {
        logger.error('保存图像上色历史记录失败', {
            userId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * 获取图像上色历史记录
 * @param {string} userId - 用户ID
 * @param {Object} options - 选项
 * @param {number} options.limit - 限制数量
 * @param {boolean} options.last24Hours - 是否只获取最近24小时的记录
 * @returns {Promise<Array>} 历史记录列表
 */
async function getColorizationHistory(userId, options = {}) {
    try {
        const { limit = 10, last24Hours = false } = options;
        
        logger.info('获取图像上色历史记录', {
            userId,
            limit,
            last24Hours
        });
        
        // 确保用户目录存在
        const userDir = await ensureUserHistoryDir(userId);
        
        // 读取目录中的所有JSON文件
        let files;
        try {
            files = await fs.readdir(userDir);
        } catch (readError) {
            logger.error('读取历史记录目录失败', {
                userId,
                error: readError.message
            });
            return [];
        }
        
        // 过滤出JSON文件
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        if (jsonFiles.length === 0) {
            logger.info('没有找到历史记录', { userId });
            return [];
        }
        
        // 读取每个文件的内容
        const records = [];
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        for (const file of jsonFiles) {
            try {
                const filePath = path.join(userDir, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const record = JSON.parse(content);
                
                // 检查时间（如果需要）
                if (last24Hours && record.createdAt) {
                    const recordDate = new Date(record.createdAt);
                    if (recordDate < twentyFourHoursAgo) {
                        continue;
                    }
                }
                
                // 转换文件路径为URL或Base64（如果需要）
                if (record.resultImage) {
                    try {
                        const imageBuffer = await fs.readFile(record.resultImage);
                        record.resultImage = `data:image/png;base64,${imageBuffer.toString('base64')}`;
                    } catch (readError) {
                        logger.error('读取结果图片失败', {
                            userId,
                            filePath: record.resultImage,
                            error: readError.message
                        });
                        record.resultImage = null;
                    }
                }
                
                if (record.originalImage) {
                    try {
                        const imageBuffer = await fs.readFile(record.originalImage);
                        record.originalImage = `data:image/png;base64,${imageBuffer.toString('base64')}`;
                    } catch (readError) {
                        logger.error('读取原始图片失败', {
                            userId,
                            filePath: record.originalImage,
                            error: readError.message
                        });
                        record.originalImage = null;
                    }
                }
                
                records.push(record);
            } catch (parseError) {
                logger.error('解析历史记录文件失败', {
                    userId,
                    file,
                    error: parseError.message
                });
                // 继续处理下一个文件
            }
        }
        
        // 按创建时间排序并限制数量
        const sortedRecords = records
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit);
        
        logger.info('获取历史记录成功', {
            userId,
            count: sortedRecords.length
        });
        
        return sortedRecords;
    } catch (error) {
        logger.error('获取图像上色历史记录失败', {
            userId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * 清空图像上色历史记录
 * @param {string} userId - 用户ID
 * @returns {Promise<void>}
 */
async function clearColorizationHistory(userId) {
    try {
        logger.info('清空图像上色历史记录', { userId });
        
        // 确保用户目录存在
        const userDir = await ensureUserHistoryDir(userId);
        
        // 读取目录中的所有文件
        let files;
        try {
            files = await fs.readdir(userDir);
        } catch (readError) {
            logger.error('读取历史记录目录失败', {
                userId,
                error: readError.message
            });
            return;
        }
        
        // 删除所有文件
        for (const file of files) {
            try {
                const filePath = path.join(userDir, file);
                await fs.unlink(filePath);
            } catch (unlinkError) {
                logger.error('删除文件失败', {
                    userId,
                    file,
                    error: unlinkError.message
                });
                // 继续删除其他文件
            }
        }
        
        logger.info('清空历史记录成功', { userId });
    } catch (error) {
        logger.error('清空图像上色历史记录失败', {
            userId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

module.exports = {
    saveColorizationHistory,
    getColorizationHistory,
    clearColorizationHistory
};
