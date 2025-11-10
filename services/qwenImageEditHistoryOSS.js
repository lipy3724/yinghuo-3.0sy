/**
 * 通义千问图像编辑历史记录OSS存储服务
 */
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { uploadToOSS, deleteFromOSS, getSignedUrl } = require('../utils/ossUtils');

/**
 * 保存图像编辑历史记录到OSS
 * @param {string} userId - 用户ID
 * @param {Object} historyData - 历史记录数据
 * @returns {Promise<Object>} 保存结果
 */
async function saveQwenImageEditHistoryToOSS(userId, historyData) {
  try {
    console.log(`开始保存用户${userId}的图像编辑历史记录到OSS`);
    
    const {
      taskId,
      inputImages = [],
      resultImages = [],
      ossResultImages = [],
      prompt,
      negativePrompt = '',
      aspectRatio = 'auto',
      creditCost = 0,
      isFree = false,
      completedAt
    } = historyData;
    
    // 生成历史记录ID
    const historyId = uuidv4();
    const timestamp = Date.now();
    
    // 构建历史记录元数据
    const metadata = {
      id: historyId,
      userId: userId,
      taskId: taskId,
      type: 'QWEN_IMAGE_EDIT',
      prompt: prompt,
      negativePrompt: negativePrompt,
      aspectRatio: aspectRatio,
      inputImageCount: inputImages.length,
      outputImageCount: resultImages.length,
      creditCost: creditCost,
      isFree: isFree,
      createdAt: completedAt || new Date().toISOString(),
      savedAt: new Date().toISOString(),
      inputImages: inputImages,
      resultImages: resultImages,
      ossResultImages: ossResultImages
    };
    
    // OSS存储路径
    const metadataPath = `qwen-image-edit/${userId}/history/${historyId}/metadata.json`;
    
    // 上传元数据到OSS
    const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2), 'utf8');
    const metadataUrl = await uploadToOSS(metadataBuffer, metadataPath);
    
    console.log(`图像编辑历史记录元数据已保存到OSS: ${metadataUrl}`);
    
    return {
      success: true,
      historyId: historyId,
      metadataUrl: metadataUrl,
      metadata: metadata
    };
    
  } catch (error) {
    console.error('保存图像编辑历史记录到OSS失败:', error);
    throw new Error(`保存历史记录失败: ${error.message}`);
  }
}

/**
 * 从OSS获取用户的图像编辑历史记录列表
 * @param {string} userId - 用户ID
 * @param {number} limit - 限制数量
 * @param {number} offset - 偏移量
 * @returns {Promise<Array>} 历史记录列表
 */
async function getQwenImageEditHistoryFromOSS(userId, limit = 20, offset = 0) {
  try {
    console.log(`获取用户${userId}的图像编辑历史记录，限制${limit}条，偏移${offset}`);
    
    const { getOSSClient } = require('../utils/ossUtils');
    const client = getOSSClient();
    
    if (!client) {
      console.warn('OSS客户端未初始化，返回空历史记录');
      return [];
    }
    
    // 列出用户的历史记录目录
    const prefix = `qwen-image-edit/${userId}/history/`;
    
    try {
      const result = await client.list({
        prefix: prefix,
        delimiter: '/',
        'max-keys': limit * 2 // 获取更多以便过滤
      });
      
      const historyRecords = [];
      
      // 处理返回的对象列表
      if (result.objects) {
        for (const obj of result.objects) {
          if (obj.name.endsWith('/metadata.json')) {
            try {
              // 获取元数据文件内容
              const metadataResult = await client.get(obj.name);
              const metadata = JSON.parse(metadataResult.content.toString());
              
              historyRecords.push({
                historyId: metadata.id,
                taskId: metadata.taskId,
                prompt: metadata.prompt,
                inputImageCount: metadata.inputImageCount,
                outputImageCount: metadata.outputImageCount,
                creditCost: metadata.creditCost,
                isFree: metadata.isFree,
                createdAt: metadata.createdAt,
                savedAt: metadata.savedAt,
                inputImages: metadata.inputImages || [],
                resultImages: metadata.resultImages || [],
                ossResultImages: metadata.ossResultImages || []
              });
            } catch (parseError) {
              console.error(`解析历史记录元数据失败: ${obj.name}`, parseError);
              continue;
            }
          }
        }
      }
      
      // 按创建时间倒序排列
      historyRecords.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // 应用分页
      const startIndex = offset;
      const endIndex = startIndex + limit;
      const paginatedRecords = historyRecords.slice(startIndex, endIndex);
      
      console.log(`从OSS获取到${historyRecords.length}条历史记录，返回${paginatedRecords.length}条`);
      return paginatedRecords;
      
    } catch (listError) {
      console.error('列出OSS历史记录失败:', listError);
      // 降级处理：返回空数组，不影响主要功能
      return [];
    }
    
  } catch (error) {
    console.error('获取图像编辑历史记录失败:', error);
    // 不抛出异常，返回空数组，让应用继续运行
    return [];
  }
}

/**
 * 从OSS删除图像编辑历史记录
 * @param {string} userId - 用户ID
 * @param {string} historyId - 历史记录ID
 * @returns {Promise<Object>} 删除结果
 */
async function deleteQwenImageEditHistoryFromOSS(userId, historyId) {
  try {
    console.log(`删除用户${userId}的图像编辑历史记录: ${historyId}`);
    
    // 删除元数据文件
    const metadataPath = `qwen-image-edit/${userId}/history/${historyId}/metadata.json`;
    await deleteFromOSS(metadataPath);
    
    console.log(`图像编辑历史记录已从OSS删除: ${historyId}`);
    
    return {
      success: true,
      historyId: historyId
    };
    
  } catch (error) {
    console.error('删除图像编辑历史记录失败:', error);
    throw new Error(`删除历史记录失败: ${error.message}`);
  }
}

/**
 * 清理过期的图像编辑历史记录
 * @param {number} daysToKeep - 保留天数，默认7天
 * @returns {Promise<Object>} 清理结果
 */
async function cleanupExpiredQwenImageEditHistory(daysToKeep = 7) {
  try {
    console.log(`开始清理${daysToKeep}天前的图像编辑历史记录`);
    
    const { getOSSClient } = require('../utils/ossUtils');
    const client = getOSSClient();
    
    if (!client) {
      console.warn('OSS客户端未初始化，跳过清理');
      return {
        success: false,
        cleanedCount: 0,
        message: 'OSS客户端未初始化'
      };
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let cleanedCount = 0;
    const prefix = 'qwen-image-edit/';
    
    try {
      // 列出所有图像编辑相关的文件
      let continuationToken = null;
      
      do {
        const listParams = {
          prefix: prefix,
          'max-keys': 1000
        };
        
        if (continuationToken) {
          listParams['continuation-token'] = continuationToken;
        }
        
        const result = await client.list(listParams);
        
        if (result.objects) {
          for (const obj of result.objects) {
            // 检查文件的最后修改时间
            if (obj.lastModified && new Date(obj.lastModified) < cutoffDate) {
              try {
                await client.delete(obj.name);
                cleanedCount++;
                console.log(`已删除过期文件: ${obj.name}`);
              } catch (deleteError) {
                console.error(`删除文件失败: ${obj.name}`, deleteError);
              }
            }
          }
        }
        
        continuationToken = result.nextContinuationToken;
      } while (continuationToken);
      
      console.log(`清理完成，共删除${cleanedCount}个过期文件`);
      
      return {
        success: true,
        cleanedCount: cleanedCount,
        message: `成功清理${cleanedCount}个过期文件`
      };
      
    } catch (listError) {
      console.error('列出OSS文件失败:', listError);
      return {
        success: false,
        cleanedCount: 0,
        message: `清理失败: ${listError.message}`
      };
    }
    
  } catch (error) {
    console.error('清理过期历史记录失败:', error);
    return {
      success: false,
      cleanedCount: 0,
      message: `清理失败: ${error.message}`
    };
  }
}

/**
 * 清空用户的所有图像编辑历史记录
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} 清空结果
 */
async function clearQwenImageEditHistoryFromOSS(userId) {
  try {
    console.log(`开始清空用户${userId}的所有图像编辑历史记录`);
    
    const { getOSSClient } = require('../utils/ossUtils');
    const client = getOSSClient();
    
    if (!client) {
      console.warn('OSS客户端未初始化，跳过清空');
      return {
        success: false,
        deletedCount: 0,
        message: 'OSS客户端未初始化'
      };
    }
    
    let deletedCount = 0;
    const prefix = `qwen-image-edit/${userId}/`;
    
    try {
      // 列出用户的所有图像编辑历史记录文件
      let continuationToken = null;
      
      do {
        const listParams = {
          prefix: prefix,
          'max-keys': 1000
        };
        
        if (continuationToken) {
          listParams['continuation-token'] = continuationToken;
        }
        
        const result = await client.list(listParams);
        
        if (result.objects && result.objects.length > 0) {
          // 批量删除文件
          const deleteList = result.objects.map(obj => obj.name);
          
          if (deleteList.length > 0) {
            await client.deleteMulti(deleteList);
            deletedCount += deleteList.length;
            console.log(`已删除${deleteList.length}个文件`);
          }
        }
        
        continuationToken = result.nextContinuationToken;
      } while (continuationToken);
      
      console.log(`用户${userId}的图像编辑历史记录清空完成，共删除${deletedCount}个文件`);
      
      return {
        success: true,
        deletedCount: deletedCount,
        message: `已清空${deletedCount}个历史记录文件`
      };
      
    } catch (listError) {
      console.error('列出或删除OSS文件失败:', listError);
      throw listError;
    }
    
  } catch (error) {
    console.error('清空图像编辑历史记录失败:', error);
    throw error;
  }
}

module.exports = {
  saveQwenImageEditHistoryToOSS,
  getQwenImageEditHistoryFromOSS,
  deleteQwenImageEditHistoryFromOSS,
  cleanupExpiredQwenImageEditHistory,
  clearQwenImageEditHistoryFromOSS
};
