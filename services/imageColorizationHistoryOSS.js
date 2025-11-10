/**
 * 图像上色历史记录OSS存储服务
 */
const OSS = require('ali-oss');
const config = require('../config/index');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const fetch = require('node-fetch') ;// 添加node-fetch引入

// OSS客户端
let ossClient = null;

/**
 * 获取OSS客户端
 * @returns {OSS.Client} OSS客户端实例
 */
function getOSSClient() {
    if (!ossClient) {
        try {
            // 检查OSS配置
            const { region, accessKeyId, accessKeySecret, bucket, endpoint } = config.oss;
            
            if (!accessKeyId || !accessKeySecret) {
                throw new Error('OSS配置缺少accessKeyId或accessKeySecret');
            }
            
            // 创建OSS客户端
            ossClient = new OSS({
                region,
                accessKeyId,
                accessKeySecret,
                bucket,
                endpoint,
                timeout: 60000 // 60秒超时
            });
            
            logger.info('OSS客户端初始化成功');
        } catch (error) {
            logger.error('OSS客户端初始化失败', {
                error: error.message,
                stack: error.stack
            });
            throw new Error(`OSS客户端初始化失败: ${error.message}`);
        }
    }
    
    return ossClient;
}

/**
 * 上传图像到OSS
 * @param {string} userId - 用户ID
 * @param {string} imageData - 图像数据（Base64或URL）
 * @param {string} prefix - 路径前缀
 * @returns {Promise<string>} OSS URL
 */
async function uploadImageToOSS(userId, imageData, prefix = 'colorization') {
    try {
        if (!imageData) {
            throw new Error('图像数据不能为空');
        }
        
        // 获取OSS客户端
        const client = getOSSClient();
        
        // 生成文件名
        const fileName = `${prefix}/${userId}/${uuidv4()}.png`;
        
        let buffer;
        
        // 处理不同类型的图像数据
        if (imageData.startsWith('data:image')) {
            // Base64数据
            const base64Data = imageData.split(',')[1];
            buffer = Buffer.from(base64Data, 'base64');
            logger.info('处理Base64图像数据', { userId, size: buffer.length });
        } else if (imageData.startsWith('http')) {
            // URL数据，需要先下载
            logger.info('开始下载图像数据', { userId, url: imageData.substring(0, 100) + '...' });
            const response = await fetch(imageData, {
                timeout: 30000, // 30秒超时
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ImageColorizationOSS/1.0)'
                }
            });
            
            if (!response.ok) {
                throw new Error(`下载图像失败: HTTP ${response.status} ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
            logger.info('图像下载完成', { userId, size: buffer.length });
        } else {
            throw new Error('不支持的图像数据格式');
        }
        
        // 上传到OSS，添加重试机制
        let result;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                result = await client.put(fileName, buffer, {
                    mime: 'image/png',
                    headers: {
                        'Cache-Control': 'max-age=31536000',
                        'Content-Type': 'image/png'
                    }
                });
                
                logger.info('图像上传到OSS成功', {
                    userId,
                    fileName,
                    size: buffer.length,
                    retryCount
                });
                
                return result.url;
            } catch (uploadError) {
                retryCount++;
                logger.warn('图像上传到OSS失败，准备重试', {
                    userId,
                    fileName,
                    retryCount,
                    maxRetries,
                    error: uploadError.message
                });
                
                if (retryCount >= maxRetries) {
                    throw uploadError;
                }
                
                // 等待一段时间后重试
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
        }
    } catch (error) {
        logger.error('图像上传到OSS失败', {
            userId,
            error: error.message,
            stack: error.stack
        });
        throw new Error(`图像上传到OSS失败: ${error.message}`);
    }
}

/**
 * 保存图像上色历史记录到OSS
 * @param {string} userId - 用户ID
 * @param {Object} historyItem - 历史记录项
 * @returns {Promise<string>} 记录ID
 */
async function saveColorizationHistoryOSS(userId, historyItem) {
    try {
        logger.info('保存图像上色历史记录到OSS', {
            userId,
            hasOriginal: !!historyItem.originalImage,
            hasResult: !!historyItem.resultImage
        });
        
        // 确保必要的字段存在
        if (!historyItem || !historyItem.resultImage) {
            logger.error('保存失败: 结果图片URL不能为空', { userId });
            throw new Error('结果图片URL不能为空');
        }
        
        // 上传图像到OSS并获取OSS URL
        logger.info('上传图像到OSS', { userId });
        
        const ossHistoryItem = { ...historyItem };
        
        // 上传结果图片
        if (historyItem.resultImage) {
            try {
                logger.info('开始上传结果图片到OSS', { 
                    userId, 
                    imageType: historyItem.resultImage.startsWith('data:') ? 'base64' : 'url',
                    imageLength: historyItem.resultImage.length
                });
                
                ossHistoryItem.resultImage = await uploadImageToOSS(
                    userId,
                    historyItem.resultImage,
                    'colorization/results'
                );
                logger.info('结果图片上传成功', { userId, ossUrl: ossHistoryItem.resultImage });
            } catch (uploadError) {
                logger.error('结果图片上传失败', {
                    userId,
                    error: uploadError.message,
                    stack: uploadError.stack
                });
                
                // 如果上传失败，保留原始URL作为备用
                logger.warn('使用原始结果图片URL作为备用', { userId });
                ossHistoryItem.resultImage = historyItem.resultImage;
                
                // 不抛出错误，继续处理其他图片
            }
        }
        
        // 上传原始图片（如果有）
        if (historyItem.originalImage) {
            try {
                logger.info('开始上传原始图片到OSS', { 
                    userId, 
                    imageType: historyItem.originalImage.startsWith('data:') ? 'base64' : 'url',
                    imageLength: historyItem.originalImage.length
                });
                
                ossHistoryItem.originalImage = await uploadImageToOSS(
                    userId,
                    historyItem.originalImage,
                    'colorization/originals'
                );
                logger.info('原始图片上传成功', { userId, ossUrl: ossHistoryItem.originalImage });
            } catch (uploadError) {
                logger.error('原始图片上传失败', {
                    userId,
                    error: uploadError.message,
                    stack: uploadError.stack
                });
                
                // 原始图片上传失败不影响整体流程，保留原始URL
                logger.warn('使用原始图片URL作为备用', { userId });
                ossHistoryItem.originalImage = historyItem.originalImage;
            }
        }
        
        // 确保至少有一个结果图片URL
        if (!ossHistoryItem.resultImage) {
            logger.error('保存失败: 结果图片URL为空', { userId });
            throw new Error('结果图片URL不能为空');
        }
        
        // 记录最终的上传结果
        logger.info('图像上色历史记录准备完成', {
            userId,
            hasOriginalImage: !!ossHistoryItem.originalImage,
            hasResultImage: !!ossHistoryItem.resultImage,
            originalImageType: ossHistoryItem.originalImage ? 
                (ossHistoryItem.originalImage.startsWith('http') ? 'OSS URL' : 'Original URL') : 'None',
            resultImageType: ossHistoryItem.resultImage ? 
                (ossHistoryItem.resultImage.startsWith('http') ? 'OSS URL' : 'Original URL') : 'None'
        });
        
        // 添加创建时间
        if (!ossHistoryItem.createdAt) {
            ossHistoryItem.createdAt = new Date().toISOString();
        }
        
        // 生成记录ID
        const recordId = uuidv4();
        
        // 保存元数据到OSS
        const metadataKey = `colorization/metadata/${userId}/${recordId}.json`;
        const metadataContent = JSON.stringify(ossHistoryItem);
        
        const client = getOSSClient();
        await client.put(metadataKey, Buffer.from(metadataContent), {
            mime: 'application/json'
        });
        
        logger.info('历史记录元数据保存成功', {
            userId,
            recordId,
            metadataKey
        });
        
        return recordId;
    } catch (error) {
        logger.error('保存图像上色历史记录到OSS失败', {
            userId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * 获取图像上色历史记录从OSS
 * @param {string} userId - 用户ID
 * @param {Object} options - 选项
 * @param {number} options.limit - 限制数量
 * @param {boolean} options.last24Hours - 是否只获取最近24小时的记录
 * @returns {Promise<Array>} 历史记录列表
 */
async function getColorizationHistoryOSS(userId, options = {}) {
    try {
        const { limit = 10, last24Hours = false } = options;
        
        logger.info('获取图像上色历史记录从OSS', {
            userId,
            limit,
            last24Hours
        });
        
        // 获取OSS客户端
        const client = getOSSClient();
        
        // 列出元数据文件
        const metadataPrefix = `colorization/metadata/${userId}/`;
        const result = await client.list({
            prefix: metadataPrefix,
            'max-keys': 100 // 最多获取100条
        });
        
        if (!result.objects || result.objects.length === 0) {
            logger.info('没有找到历史记录', { userId });
            return [];
        }
        
        // 过滤并排序元数据文件
        const metadataFiles = result.objects
            .filter(obj => obj.name.endsWith('.json'))
            .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
        
        logger.info('找到元数据文件', {
            userId,
            count: metadataFiles.length
        });
        
        // 获取元数据内容
        const history = [];
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        for (const file of metadataFiles) {
            if (history.length >= limit) {
                break;
            }
            
            try {
                // 获取文件内容
                const result = await client.get(file.name);
                const content = result.content.toString('utf-8');
                const historyItem = JSON.parse(content);
                
                // 检查时间（如果需要）
                if (last24Hours && historyItem.createdAt) {
                    const itemDate = new Date(historyItem.createdAt);
                    if (itemDate < twentyFourHoursAgo) {
                        continue;
                    }
                }
                
                // 添加到历史记录
                history.push(historyItem);
            } catch (itemError) {
                logger.error('获取历史记录项失败', {
                    userId,
                    fileName: file.name,
                    error: itemError.message
                });
                // 继续处理下一个
            }
        }
        
        logger.info('获取历史记录成功', {
            userId,
            count: history.length
        });
        
        return history;
    } catch (error) {
        logger.error('获取图像上色历史记录从OSS失败', {
            userId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * 清空图像上色历史记录（OSS）
 * @param {string} userId - 用户ID
 * @returns {Promise<void>}
 */
async function clearColorizationHistoryOSS(userId) {
    try {
        logger.info('清空图像上色历史记录（OSS）', { userId });
        
        // 获取OSS客户端
        const client = getOSSClient();
        
        // 列出元数据文件
        const metadataPrefix = `colorization/metadata/${userId}/`;
        const result = await client.list({
            prefix: metadataPrefix,
            'max-keys': 1000
        });
        
        if (!result.objects || result.objects.length === 0) {
            logger.info('没有找到历史记录，无需清空', { userId });
            return;
        }
        
        // 删除元数据文件
        const objectsToDelete = result.objects.map(obj => obj.name);
        
        logger.info('准备删除元数据文件', {
            userId,
            count: objectsToDelete.length
        });
        
        // 批量删除
        if (objectsToDelete.length > 0) {
            await client.deleteMulti(objectsToDelete);
        }
        
        logger.info('清空历史记录成功', { userId });
    } catch (error) {
        logger.error('清空图像上色历史记录（OSS）失败', {
            userId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

module.exports = {
    saveColorizationHistoryOSS,
    getColorizationHistoryOSS,
    clearColorizationHistoryOSS,
    uploadImageToOSS
};
