/**
 * 智能服饰分割历史记录OSS存储服务
 */
const OSS = require('ali-oss');
const config = require('../config/index');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const fetch = require('node-fetch'); // 添加node-fetch引入

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
            
            logger.info('OSS客户端初始化成功 - 服饰分割');
        } catch (error) {
            logger.error('OSS客户端初始化失败 - 服饰分割', {
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
async function uploadImageToOSS(userId, imageData, prefix = 'cloth-segmentation') {
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
        } else if (imageData.startsWith('http')) {
            // URL数据，需要先下载
            const response = await fetch(imageData);
            const arrayBuffer = await response.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
        } else {
            throw new Error('不支持的图像数据格式');
        }
        
        // 上传到OSS
        const result = await client.put(fileName, buffer, {
            mime: 'image/png',
            headers: {
                'Cache-Control': 'max-age=31536000'
            }
        });
        
        logger.info('图像上传到OSS成功 - 服饰分割', {
            userId,
            fileName,
            size: buffer.length
        });
        
        return result.url;
    } catch (error) {
        logger.error('图像上传到OSS失败 - 服饰分割', {
            userId,
            error: error.message,
            stack: error.stack
        });
        throw new Error(`图像上传到OSS失败: ${error.message}`);
    }
}

/**
 * 保存智能服饰分割历史记录到OSS
 * @param {string} userId - 用户ID
 * @param {Object} historyItem - 历史记录项
 * @returns {Promise<string>} 记录ID
 */
async function saveClothSegmentationHistoryOSS(userId, historyItem) {
    try {
        logger.info('保存智能服饰分割历史记录到OSS', {
            userId,
            hasInput: !!historyItem.inputUrl,
            hasOutput: !!historyItem.outputUrl,
            clothClasses: historyItem.clothClasses
        });
        
        // 确保必要的字段存在
        if (!historyItem || !historyItem.outputUrl) {
            logger.error('保存失败: 输出图片URL不能为空', { userId });
            throw new Error('输出图片URL不能为空');
        }
        
        // 上传图像到OSS并获取OSS URL
        logger.info('上传图像到OSS - 服饰分割', { userId });
        
        const ossHistoryItem = { ...historyItem };
        
        // 上传输出图片
        if (historyItem.outputUrl) {
            try {
                ossHistoryItem.outputUrl = await uploadImageToOSS(
                    userId,
                    historyItem.outputUrl,
                    'cloth-segmentation/results'
                );
                logger.info('输出图片上传成功', { userId });
            } catch (uploadError) {
                logger.error('输出图片上传失败', {
                    userId,
                    error: uploadError.message
                });
                throw new Error(`输出图片上传失败: ${uploadError.message}`);
            }
        }
        
        // 上传输入图片（如果有）
        if (historyItem.inputUrl) {
            try {
                ossHistoryItem.inputUrl = await uploadImageToOSS(
                    userId,
                    historyItem.inputUrl,
                    'cloth-segmentation/inputs'
                );
                logger.info('输入图片上传成功', { userId });
            } catch (uploadError) {
                logger.error('输入图片上传失败', {
                    userId,
                    error: uploadError.message
                });
                // 输入图片上传失败不影响整体流程
                ossHistoryItem.inputUrl = null;
            }
        }
        
        // 上传分类结果图片（如果有）
        if (historyItem.classUrls && typeof historyItem.classUrls === 'object') {
            const ossClassUrls = {};
            for (const [className, imageUrl] of Object.entries(historyItem.classUrls)) {
                try {
                    ossClassUrls[className] = await uploadImageToOSS(
                        userId,
                        imageUrl,
                        `cloth-segmentation/classes/${className}`
                    );
                    logger.info(`${className} 分类图片上传成功`, { userId });
                } catch (uploadError) {
                    logger.error(`${className} 分类图片上传失败`, {
                        userId,
                        error: uploadError.message
                    });
                    // 分类图片上传失败不影响整体流程
                }
            }
            ossHistoryItem.classUrls = ossClassUrls;
        }
        
        if (!ossHistoryItem.outputUrl) {
            logger.error('保存失败: OSS上传后的输出图片URL为空', { userId });
            throw new Error('OSS上传后的输出图片URL为空');
        }
        
        // 添加创建时间
        if (!ossHistoryItem.created_at) {
            ossHistoryItem.created_at = new Date().toISOString();
        }
        
        // 确保有处理类型
        if (!ossHistoryItem.type) {
            ossHistoryItem.type = 'CLOTH_SEGMENTATION';
        }
        
        // 生成记录ID
        const recordId = uuidv4();
        ossHistoryItem.id = recordId;
        
        // 保存元数据到OSS
        const metadataKey = `cloth-segmentation/metadata/${userId}/${recordId}.json`;
        const metadataContent = JSON.stringify(ossHistoryItem);
        
        const client = getOSSClient();
        await client.put(metadataKey, Buffer.from(metadataContent), {
            mime: 'application/json'
        });
        
        logger.info('智能服饰分割历史记录元数据保存成功', {
            userId,
            recordId,
            metadataKey
        });
        
        return recordId;
    } catch (error) {
        logger.error('保存智能服饰分割历史记录到OSS失败', {
            userId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * 获取智能服饰分割历史记录从OSS
 * @param {string} userId - 用户ID
 * @param {Object} options - 选项
 * @param {number} options.limit - 限制数量
 * @param {boolean} options.last24Hours - 是否只获取最近24小时的记录
 * @returns {Promise<Array>} 历史记录列表
 */
async function getClothSegmentationHistoryOSS(userId, options = {}) {
    try {
        const { limit = 10, last24Hours = false } = options;
        
        logger.info('获取智能服饰分割历史记录从OSS', {
            userId,
            limit,
            last24Hours
        });
        
        // 获取OSS客户端
        const client = getOSSClient();
        
        // 列出元数据文件
        const metadataPrefix = `cloth-segmentation/metadata/${userId}/`;
        const result = await client.list({
            prefix: metadataPrefix,
            'max-keys': 100 // 最多获取100条
        });
        
        if (!result.objects || result.objects.length === 0) {
            logger.info('没有找到智能服饰分割历史记录', { userId });
            return [];
        }
        
        // 过滤并排序元数据文件
        const metadataFiles = result.objects
            .filter(obj => obj.name.endsWith('.json'))
            .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
        
        logger.info('找到智能服饰分割元数据文件', {
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
                if (last24Hours && historyItem.created_at) {
                    const itemDate = new Date(historyItem.created_at);
                    if (itemDate < twentyFourHoursAgo) {
                        continue;
                    }
                }
                
                // 添加到历史记录
                history.push(historyItem);
            } catch (itemError) {
                logger.error('获取智能服饰分割历史记录项失败', {
                    userId,
                    fileName: file.name,
                    error: itemError.message
                });
                // 继续处理下一个
            }
        }
        
        logger.info('获取智能服饰分割历史记录成功', {
            userId,
            count: history.length
        });
        
        return history;
    } catch (error) {
        logger.error('获取智能服饰分割历史记录从OSS失败', {
            userId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * 清空智能服饰分割历史记录（OSS）
 * @param {string} userId - 用户ID
 * @returns {Promise<void>}
 */
async function clearClothSegmentationHistoryOSS(userId) {
    try {
        logger.info('清空智能服饰分割历史记录（OSS）', { userId });
        
        // 获取OSS客户端
        const client = getOSSClient();
        
        // 列出元数据文件
        const metadataPrefix = `cloth-segmentation/metadata/${userId}/`;
        const result = await client.list({
            prefix: metadataPrefix,
            'max-keys': 1000
        });
        
        if (!result.objects || result.objects.length === 0) {
            logger.info('没有找到智能服饰分割历史记录，无需清空', { userId });
            return;
        }
        
        // 删除元数据文件
        const objectsToDelete = result.objects.map(obj => obj.name);
        
        logger.info('准备删除智能服饰分割元数据文件', {
            userId,
            count: objectsToDelete.length
        });
        
        // 批量删除
        if (objectsToDelete.length > 0) {
            await client.deleteMulti(objectsToDelete);
        }
        
        logger.info('清空智能服饰分割历史记录成功', { userId });
    } catch (error) {
        logger.error('清空智能服饰分割历史记录（OSS）失败', {
            userId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

module.exports = {
    saveClothSegmentationHistoryOSS,
    getClothSegmentationHistoryOSS,
    clearClothSegmentationHistoryOSS,
    uploadImageToOSS
};
