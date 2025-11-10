/**
 * 指令编辑历史记录OSS存储服务
 * 参照文生图片历史记录OSS实现，为指令编辑功能提供完整的历史记录存储
 */
const OSS = require('ali-oss');
const config = require('../config/index');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// OSS客户端实例（单例模式）
let ossClient = null;

/**
 * 获取OSS客户端实例
 * @returns {OSS.Client|null} OSS客户端实例，如果初始化失败则返回null
 */
function getOSSClient() {
  if (!ossClient) {
    try {
      console.log('[指令编辑OSS] 开始初始化OSS客户端');
      
      // 从配置或环境变量获取OSS配置
      const region = config.oss?.region || process.env.OSS_REGION;
      const accessKeyId = config.oss?.accessKeyId || process.env.ALIYUN_ACCESS_KEY_ID;
      const accessKeySecret = config.oss?.accessKeySecret || process.env.ALIYUN_ACCESS_KEY_SECRET;
      const bucket = config.oss?.bucket || process.env.OSS_BUCKET;
      
      console.log('[指令编辑OSS] OSS配置检查:');
      
      // 检查必要的配置
      let configValid = true;
      let missingConfigs = [];
      
      if (!region) {
        console.error('[指令编辑OSS] 缺少OSS区域配置');
        missingConfigs.push('region');
        configValid = false;
      }
      
      if (!accessKeyId) {
        console.error('[指令编辑OSS] 缺少阿里云AccessKeyId配置');
        missingConfigs.push('accessKeyId');
        configValid = false;
      }
      
      if (!accessKeySecret) {
        console.error('[指令编辑OSS] 缺少阿里云AccessKeySecret配置');
        missingConfigs.push('accessKeySecret');
        configValid = false;
      }
      
      if (!bucket) {
        console.error('[指令编辑OSS] 缺少OSS存储桶配置');
        missingConfigs.push('bucket');
        configValid = false;
      }
      
      if (!configValid) {
        console.error(`[指令编辑OSS] OSS配置不完整，缺少以下配置: ${missingConfigs.join(', ')}`);
        
        // 使用测试/开发环境的默认值（仅用于开发环境）
        if (process.env.NODE_ENV === 'development') {
          console.log('[指令编辑OSS] 在开发环境中使用默认OSS配置');
          
          // 使用默认测试配置
          const defaultRegion = 'oss-cn-beijing';
          const defaultBucket = 'test-bucket';
          const defaultAccessKeyId = 'test-access-key-id';
          const defaultAccessKeySecret = 'test-access-key-secret';
          
          ossClient = new OSS({
            region: region || defaultRegion,
            accessKeyId: accessKeyId || defaultAccessKeyId,
            accessKeySecret: accessKeySecret || defaultAccessKeySecret,
            bucket: bucket || defaultBucket,
            secure: true
          });
          
          console.log('[指令编辑OSS] 使用开发环境默认配置初始化OSS客户端成功');
          return ossClient;
        }
        
        console.error('[指令编辑OSS] OSS配置不完整，无法初始化客户端');
        return null;
      }
      
      // 配置有效，初始化客户端
      console.log('[指令编辑OSS] OSS配置有效，正在初始化客户端，配置信息:', { 
        region, 
        accessKeyId: accessKeyId ? (accessKeyId.substring(0, 3) + '***' + accessKeyId.substring(accessKeyId.length - 3)) : 'undefined',
        bucket
      });
      
      ossClient = new OSS({
        region: region,
        accessKeyId: accessKeyId,
        accessKeySecret: accessKeySecret,
        bucket: bucket,
        secure: true
      });
      
      console.log('[指令编辑OSS] OSS客户端初始化成功');
    } catch (error) {
      console.error('[指令编辑OSS] 初始化OSS客户端失败:', error);
      return null;
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
async function uploadImageToOSS(userId, imageData, prefix = 'image-edit') {
  try {
    if (!imageData) {
      throw new Error('图像数据不能为空');
    }
    
    // 获取OSS客户端
    const client = getOSSClient();
    
    if (!client) {
      console.error('[指令编辑OSS] 上传失败: OSS客户端未初始化');
      throw new Error('OSS客户端未初始化，请检查OSS配置');
    }
    
    // 生成文件名
    const fileName = `${prefix}/${userId}/${uuidv4()}.png`;
    
    let buffer;
    
    // 处理不同类型的图像数据
    if (imageData.startsWith('data:image')) {
      // Base64数据
      console.log(`[指令编辑OSS] 处理Base64图片数据`);
      const base64Data = imageData.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else if (imageData.startsWith('http')) {
      // URL数据，需要先下载
      console.log(`[指令编辑OSS] 正在下载图片: ${imageData}`);
      const response = await axios.get(imageData, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30秒超时
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      buffer = Buffer.from(response.data);
      console.log(`[指令编辑OSS] 图片下载成功，大小: ${buffer.length} bytes`);
    } else {
      throw new Error('不支持的图像数据格式');
    }
    
    // 上传到OSS
    console.log(`[指令编辑OSS] 正在上传图片到OSS路径: ${fileName}`);
    const result = await client.put(fileName, buffer, {
      mime: 'image/png',
      headers: {
        'Cache-Control': 'max-age=31536000'
      }
    });
    
    console.log(`[指令编辑OSS] 图片上传成功，URL: ${result.url}`);
    return result.url;
  } catch (error) {
    console.error('[指令编辑OSS] 上传图片到OSS失败:', error);
    throw new Error(`上传图片到OSS失败: ${error.message}`);
  }
}

/**
 * 从URL下载图片并转换为Buffer（保留用于兼容性）
 * @param {String} imageUrl 图片URL
 * @returns {Promise<Buffer>} 图片Buffer
 * @deprecated 请使用uploadImageToOSS函数直接上传
 */
async function downloadImageFromUrl(imageUrl) {
  try {
    console.log(`[指令编辑OSS] 正在下载图片: ${imageUrl}`);
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30秒超时
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    console.log(`[指令编辑OSS] 图片下载成功，大小: ${response.data.length} bytes`);
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`[指令编辑OSS] 下载图片失败: ${imageUrl}`, error.message);
    throw new Error(`下载图片失败: ${error.message}`);
  }
}

/**
 * 上传JSON元数据到OSS
 * @param {Object} metadata 元数据对象
 * @param {String} ossPath OSS存储路径
 * @returns {Promise<String>} OSS元数据URL
 */
async function uploadMetadataToOSS(metadata, ossPath) {
  try {
    const client = getOSSClient();
    
    if (!client) {
      console.error('[指令编辑OSS] 上传元数据失败: OSS客户端未初始化');
      throw new Error('OSS客户端未初始化，请检查OSS配置');
    }
    
    console.log(`[指令编辑OSS] 正在上传元数据到OSS路径: ${ossPath}`);
    const metadataJson = JSON.stringify(metadata, null, 2);
    const result = await client.put(ossPath, Buffer.from(metadataJson, 'utf8'), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[指令编辑OSS] 元数据上传成功，URL: ${result.url}`);
    return result.url;
  } catch (error) {
    console.error('[指令编辑OSS] 上传元数据到OSS失败:', error);
    throw new Error(`上传元数据到OSS失败: ${error.message}`);
  }
}

/**
 * 保存指令编辑历史记录到OSS
 * @param {Object} recordData 历史记录数据
 * @param {String} recordData.userId 用户ID
 * @param {String} recordData.prompt 指令提示词
 * @param {String} recordData.inputImageUrl 输入图片URL或Base64
 * @param {String} recordData.outputImageUrl 输出图片URL或Base64
 * @param {String} recordData.function 编辑功能类型
 * @param {Object} recordData.parameters 编辑参数
 * @param {String} recordData.model 使用的模型
 * @param {String} recordData.taskId 任务ID
 * @returns {Promise<Object>} 保存结果
 */
async function saveImageEditHistory(recordData) {
  try {
    const { userId, prompt, inputImageUrl, outputImageUrl, function: editFunction, parameters, model, taskId } = recordData;
    
    console.log(`[指令编辑OSS] 开始保存历史记录，用户ID: ${userId}, 任务ID: ${taskId}`);
    
    // 确保必要的字段存在
    if (!recordData || !outputImageUrl) {
      console.error('[指令编辑OSS] 保存失败: 输出图片数据不能为空', { userId });
      throw new Error('输出图片数据不能为空');
    }
    
    // 上传图像到OSS并获取OSS URL
    console.log('[指令编辑OSS] 上传图像到OSS');
    
    // 生成记录ID
    const recordId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const ossHistoryItem = {
      recordId,
      userId,
      taskId,
      timestamp,
      prompt,
      function: editFunction || 'general_edit',
      model: model || 'wanx2.1-imageedit',
      parameters: parameters || {},
      version: '1.0.0'
    };
    
    // 上传输出图片
    if (outputImageUrl) {
      try {
        ossHistoryItem.outputUrl = await uploadImageToOSS(
          userId,
          outputImageUrl,
          'image-edit/outputs'
        );
        console.log('[指令编辑OSS] 输出图片上传成功', { userId });
      } catch (uploadError) {
        console.error('[指令编辑OSS] 输出图片上传失败', {
          userId,
          error: uploadError.message
        });
        throw new Error(`输出图片上传失败: ${uploadError.message}`);
      }
    }
    
    // 上传输入图片（如果有）
    if (inputImageUrl) {
      try {
        ossHistoryItem.inputUrl = await uploadImageToOSS(
          userId,
          inputImageUrl,
          'image-edit/inputs'
        );
        console.log('[指令编辑OSS] 输入图片上传成功', { userId });
      } catch (uploadError) {
        console.error('[指令编辑OSS] 输入图片上传失败', {
          userId,
          error: uploadError.message
        });
        // 输入图片上传失败不影响整体流程
        ossHistoryItem.inputUrl = null;
      }
    }
    
    if (!ossHistoryItem.outputUrl) {
      console.error('[指令编辑OSS] 保存失败: OSS上传后的输出图片URL为空', { userId });
      throw new Error('OSS上传后的输出图片URL为空');
    }
    
    // 保存元数据到OSS
    const metadataKey = `image-edit/metadata/${userId}/${recordId}.json`;
    const metadataContent = JSON.stringify(ossHistoryItem);
    
    const client = getOSSClient();
    if (!client) {
      throw new Error('OSS客户端未初始化，请检查OSS配置');
    }
    
    await client.put(metadataKey, Buffer.from(metadataContent), {
      mime: 'application/json'
    });
    
    console.log(`[指令编辑OSS] 历史记录保存完成，记录ID: ${recordId}`);
    
    return {
      success: true,
      recordId,
      metadata: ossHistoryItem,
      urls: {
        inputImage: ossHistoryItem.inputUrl,
        outputImage: ossHistoryItem.outputUrl,
        metadata: metadataKey
      }
    };
  } catch (error) {
    console.error('[指令编辑OSS] 保存历史记录失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 获取用户的指令编辑历史记录列表
 * @param {String} userId 用户ID
 * @param {Object} options 查询选项
 * @param {Number} options.hours 查询最近N小时的记录，默认24小时
 * @param {Number} options.limit 限制返回数量，默认50
 * @returns {Promise<Object>} 历史记录列表
 */
async function getImageEditHistory(userId, options = {}) {
  try {
    const { hours = 24, limit = 50 } = options;
    
    console.log(`[指令编辑OSS] 获取用户历史记录，用户ID: ${userId}, 查询最近${hours}小时`);
    
    const client = getOSSClient();
    if (!client) {
      throw new Error('OSS客户端未初始化');
    }
    
    // 列出用户的元数据文件
    const metadataPrefix = `image-edit/metadata/${userId}/`;
    const result = await client.list({
      prefix: metadataPrefix,
      'max-keys': limit
    });
    
    if (!result.objects || result.objects.length === 0) {
      console.log(`[指令编辑OSS] 用户 ${userId} 没有历史记录`);
      return {
        success: true,
        records: [],
        total: 0
      };
    }
    
    // 过滤指定时间范围内的记录
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentObjects = result.objects.filter(obj => {
      return new Date(obj.lastModified) >= cutoffTime;
    });
    
    // 下载并解析元数据
    const records = [];
    for (const obj of recentObjects) {
      try {
        const metadataResult = await client.get(obj.name);
        const metadata = JSON.parse(metadataResult.content.toString());
        
        // 添加文件信息
        metadata.fileInfo = {
          lastModified: obj.lastModified,
          size: obj.size,
          etag: obj.etag
        };
        
        records.push(metadata);
      } catch (error) {
        console.error(`[指令编辑OSS] 解析元数据失败: ${obj.name}`, error.message);
      }
    }
    
    // 按时间倒序排列
    records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    console.log(`[指令编辑OSS] 获取历史记录成功，用户: ${userId}, 总数: ${records.length}`);
    
    return {
      success: true,
      records,
      total: records.length,
      queryInfo: {
        userId,
        hours,
        limit,
        cutoffTime: cutoffTime.toISOString()
      }
    };
  } catch (error) {
    console.error('[指令编辑OSS] 获取历史记录失败:', error);
    return {
      success: false,
      error: error.message,
      records: [],
      total: 0
    };
  }
}

/**
 * 清空用户的指令编辑历史记录
 * @param {String} userId 用户ID
 * @returns {Promise<Object>} 清空结果
 */
async function clearImageEditHistory(userId) {
  try {
    console.log(`[指令编辑OSS] 开始清空用户历史记录，用户ID: ${userId}`);
    
    const client = getOSSClient();
    if (!client) {
      throw new Error('OSS客户端未初始化');
    }
    
    // 要删除的路径前缀
    const pathPrefixes = [
      `image-edit/inputs/${userId}/`,
      `image-edit/outputs/${userId}/`,
      `image-edit/metadata/${userId}/`
    ];
    
    let totalDeleted = 0;
    const deleteResults = [];
    
    for (const prefix of pathPrefixes) {
      try {
        console.log(`[指令编辑OSS] 清理路径: ${prefix}`);
        
        // 列出该路径下的所有文件
        const listResult = await client.list({
          prefix: prefix,
          'max-keys': 1000 // 一次最多删除1000个文件
        });
        
        if (listResult.objects && listResult.objects.length > 0) {
          // 批量删除文件
          const deleteObjects = listResult.objects.map(obj => obj.name);
          const deleteResult = await client.deleteMulti(deleteObjects);
          
          const deletedCount = deleteResult.deleted ? deleteResult.deleted.length : 0;
          totalDeleted += deletedCount;
          
          deleteResults.push({
            prefix,
            deletedCount,
            deleted: deleteResult.deleted || []
          });
          
          console.log(`[指令编辑OSS] 路径 ${prefix} 删除了 ${deletedCount} 个文件`);
        } else {
          console.log(`[指令编辑OSS] 路径 ${prefix} 没有文件需要删除`);
          deleteResults.push({
            prefix,
            deletedCount: 0,
            deleted: []
          });
        }
      } catch (error) {
        console.error(`[指令编辑OSS] 清理路径 ${prefix} 失败:`, error.message);
        deleteResults.push({
          prefix,
          deletedCount: 0,
          error: error.message
        });
      }
    }
    
    console.log(`[指令编辑OSS] 清空历史记录完成，用户: ${userId}, 总计删除: ${totalDeleted} 个文件`);
    
    return {
      success: true,
      userId,
      totalDeleted,
      details: deleteResults
    };
  } catch (error) {
    console.error('[指令编辑OSS] 清空历史记录失败:', error);
    return {
      success: false,
      error: error.message,
      userId,
      totalDeleted: 0
    };
  }
}

/**
 * 从OSS删除指定的历史记录
 * @param {String} userId 用户ID
 * @param {String} recordId 记录ID
 * @returns {Promise<Object>} 删除结果
 */
async function deleteImageEditRecord(userId, recordId) {
  try {
    console.log(`[指令编辑OSS] 开始删除指定历史记录，用户ID: ${userId}, 记录ID: ${recordId}`);
    
    const client = getOSSClient();
    if (!client) {
      throw new Error('OSS客户端未初始化');
    }
    
    // 首先获取元数据以了解需要删除的文件
    const metadataPath = `image-edit/metadata/${userId}/${recordId}.json`;
    let metadata = null;
    
    try {
      const metadataResult = await client.get(metadataPath);
      metadata = JSON.parse(metadataResult.content.toString());
    } catch (error) {
      console.error(`[指令编辑OSS] 获取元数据失败: ${metadataPath}`, error.message);
      // 如果元数据不存在，仍然尝试删除可能存在的文件
    }
    
    // 准备要删除的文件列表
    const filesToDelete = [metadataPath];
    
    if (metadata && metadata.images) {
      // 添加输入图片
      if (metadata.images.input && metadata.images.input.ossPath) {
        filesToDelete.push(metadata.images.input.ossPath);
      }
      // 添加输出图片
      if (metadata.images.output && metadata.images.output.ossPath) {
        filesToDelete.push(metadata.images.output.ossPath);
      }
    }
    
    // 批量删除文件
    let deletedCount = 0;
    const deleteResults = [];
    
    for (const filePath of filesToDelete) {
      try {
        await client.delete(filePath);
        deletedCount++;
        deleteResults.push({
          file: filePath,
          success: true
        });
        console.log(`[指令编辑OSS] 删除文件成功: ${filePath}`);
      } catch (error) {
        console.error(`[指令编辑OSS] 删除文件失败: ${filePath}`, error.message);
        deleteResults.push({
          file: filePath,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log(`[指令编辑OSS] 删除历史记录完成，记录ID: ${recordId}, 删除文件数: ${deletedCount}`);
    
    return {
      success: deletedCount > 0,
      recordId,
      deletedCount,
      details: deleteResults
    };
  } catch (error) {
    console.error('[指令编辑OSS] 删除历史记录失败:', error);
    return {
      success: false,
      error: error.message,
      recordId,
      deletedCount: 0
    };
  }
}

module.exports = {
  getOSSClient,
  downloadImageFromUrl, // 保留用于兼容性
  uploadImageToOSS,
  uploadMetadataToOSS,
  saveImageEditHistory,
  getImageEditHistory,
  clearImageEditHistory,
  deleteImageEditRecord
};
