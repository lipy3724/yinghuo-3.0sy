/**
 * 图像上色历史记录OSS存储工具函数
 */
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const axios = require('axios');
const { uploadToOSS, deleteFromOSS, getSignedUrl } = require('./ossUtils');

// 将文件读取转换为Promise
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

/**
 * 从URL下载图像并上传到OSS
 * @param {string} imageUrl - 图像URL
 * @param {string} userId - 用户ID
 * @param {string} type - 图像类型 (original/result)
 * @returns {Promise<string>} OSS中的路径
 */
async function uploadImageToOSS(imageUrl, userId, type) {
  let tempFilePath = null;
  
  try {
    if (!imageUrl) {
      throw new Error('图像URL不能为空');
    }
    
    // 生成唯一文件名
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);
    const extension = imageUrl.startsWith('data:') ? '.jpg' : (path.extname(imageUrl) || '.jpg');
    const fileName = `${timestamp}-${uniqueId}${extension}`;
    
    console.log(`处理图像文件: ${fileName}, 类型: ${type}`);
    
    // 在OSS中的存储路径
    const ossPath = `colorization/${userId}/${type}/${fileName}`;
    
    // 临时文件路径
    tempFilePath = path.join(__dirname, '..', 'uploads', 'temp', fileName);
    
    // 确保临时目录存在
    const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
    if (!fs.existsSync(tempDir)) {
      console.log(`创建临时目录: ${tempDir}`);
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // 下载图像
    let imageBuffer;
    if (imageUrl.startsWith('data:')) {
      console.log('处理Base64编码图像');
      // 处理Base64编码的图像
      try {
        const base64Data = imageUrl.split(';base64,').pop();
        if (!base64Data) {
          throw new Error('无效的Base64图像数据');
        }
        imageBuffer = Buffer.from(base64Data, 'base64');
        await writeFile(tempFilePath, imageBuffer);
        console.log(`Base64图像已保存到临时文件: ${tempFilePath}`);
      } catch (base64Error) {
        console.error('处理Base64图像失败:', base64Error);
        throw new Error(`处理Base64图像失败: ${base64Error.message}`);
      }
    } else {
      console.log(`下载URL图像: ${imageUrl.substring(0, 50)}...`);
      // 处理URL图像
      try {
        const response = await axios({
          url: imageUrl,
          method: 'GET',
          responseType: 'arraybuffer',
          timeout: 10000, // 10秒超时
          maxContentLength: 10 * 1024 * 1024 // 最大10MB
        });
        
        if (!response.data || response.data.length === 0) {
          throw new Error('下载的图像数据为空');
        }
        
        imageBuffer = Buffer.from(response.data);
        await writeFile(tempFilePath, imageBuffer);
        console.log(`URL图像已下载并保存到临时文件: ${tempFilePath}`);
      } catch (downloadError) {
        console.error('下载URL图像失败:', downloadError);
        throw new Error(`下载URL图像失败: ${downloadError.message}`);
      }
    }
    
    // 上传到OSS
    console.log(`准备上传图像到OSS路径: ${ossPath}`);
    const ossUrl = await uploadToOSS(imageBuffer, ossPath);
    
    // 删除临时文件
    try {
      await unlink(tempFilePath);
      console.log(`临时文件已删除: ${tempFilePath}`);
      tempFilePath = null;
    } catch (unlinkError) {
      console.warn(`删除临时文件失败: ${tempFilePath}`, unlinkError);
      // 不抛出异常，因为主要功能已经完成
    }
    
    return ossUrl;
  } catch (error) {
    console.error('上传图像到OSS失败:', error);
    
    // 清理临时文件
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
        console.log(`出错后清理临时文件: ${tempFilePath}`);
      } catch (cleanupError) {
        console.warn(`清理临时文件失败: ${tempFilePath}`, cleanupError);
      }
    }
    
    throw new Error(`上传图像到OSS失败: ${error.message}`);
  }
}

/**
 * 保存图像上色历史记录到OSS
 * @param {number} userId - 用户ID
 * @param {object} historyItem - 历史记录项
 * @param {string} historyItem.originalImage - 原始图片URL
 * @param {string} historyItem.resultImage - 上色后图片URL
 * @param {string} historyItem.prompt - 使用的提示词
 * @returns {Promise<object>} 包含OSS路径的历史记录项
 */
async function saveColorizationHistoryToOSS(userId, historyItem) {
  try {
    console.log(`开始保存用户 ${userId} 的图像上色历史记录到OSS`);
    
    // 检查OSS客户端是否可用
    const { getOSSClient } = require('./ossUtils');
    const client = getOSSClient();
    if (!client) {
      console.warn('OSS客户端不可用，将使用原始URL保存历史记录');
      return {
        originalImage: historyItem.originalImage || null,
        resultImage: historyItem.resultImage || null,
        prompt: historyItem.prompt || '图像上色',
        createdAt: new Date()
      };
    }
    
    // 确保必要的字段存在
    if (!historyItem.resultImage) {
      console.error('保存历史记录失败: 结果图片URL不能为空');
      throw new Error('结果图片URL不能为空');
    }
    
    // 上传原始图像到OSS（如果存在）
    let originalImageOssUrl = null;
    if (historyItem.originalImage) {
      try {
        console.log('上传原始图像到OSS');
        originalImageOssUrl = await uploadImageToOSS(historyItem.originalImage, userId, 'original');
        console.log('原始图像上传成功:', originalImageOssUrl);
      } catch (originalError) {
        console.error('上传原始图像失败，继续处理结果图像:', originalError);
        // 原始图像上传失败不影响整体流程，继续处理结果图像
        // 使用原始URL
        originalImageOssUrl = historyItem.originalImage;
      }
    }
    
    // 上传结果图像到OSS
    console.log('上传结果图像到OSS');
    let resultImageOssUrl;
    try {
      resultImageOssUrl = await uploadImageToOSS(historyItem.resultImage, userId, 'result');
      console.log('结果图像上传成功:', resultImageOssUrl);
    } catch (resultError) {
      console.error('上传结果图像失败:', resultError);
      // 使用原始URL作为备用
      console.warn('使用原始结果图像URL作为备用');
      resultImageOssUrl = historyItem.resultImage;
    }
    
    // 返回包含OSS路径的历史记录项
    const ossHistoryItem = {
      originalImage: originalImageOssUrl,
      resultImage: resultImageOssUrl,
      prompt: historyItem.prompt || '图像上色',
      createdAt: new Date()
    };
    
    console.log('历史记录项准备完成:', {
      hasOriginalImage: !!ossHistoryItem.originalImage,
      hasResultImage: !!ossHistoryItem.resultImage,
      prompt: ossHistoryItem.prompt
    });
    
    return ossHistoryItem;
  } catch (error) {
    console.error('保存图像上色历史记录到OSS失败:', error);
    
    // 出现错误时，使用原始URL
    console.warn('出现错误，使用原始URL作为备用');
    return {
      originalImage: historyItem.originalImage || null,
      resultImage: historyItem.resultImage || null,
      prompt: historyItem.prompt || '图像上色',
      createdAt: new Date()
    };
  }
}

/**
 * 从OSS删除图像上色历史记录
 * @param {string} ossUrl - OSS中的URL
 * @returns {Promise<void>}
 */
async function deleteColorizationHistoryFromOSS(ossUrl) {
  try {
    if (!ossUrl) return;
    
    // 检查是否是OSS URL
    if (!ossUrl.includes('aliyuncs.com')) {
      console.log(`不是OSS URL，跳过删除: ${ossUrl}`);
      return;
    }
    
    // 检查OSS客户端是否可用
    const { getOSSClient } = require('./ossUtils');
    const client = getOSSClient();
    if (!client) {
      console.warn('OSS客户端不可用，跳过删除');
      return;
    }
    
    try {
      // 从URL中提取OSS路径
      const ossPath = ossUrl.split('/').slice(3).join('/');
      
      // 从OSS删除文件
      await deleteFromOSS(ossPath);
      
      console.log(`已从OSS删除文件: ${ossPath}`);
    } catch (deleteError) {
      console.error('从OSS删除文件失败:', deleteError);
      // 不抛出异常，让调用方继续执行
    }
  } catch (error) {
    console.error('从OSS删除图像上色历史记录失败:', error);
    // 不抛出异常，让调用方继续执行
  }
}

/**
 * 清理超过24小时的历史记录
 * @param {Array} records - 历史记录数组
 * @returns {Promise<Array>} 删除的记录数组
 */
async function cleanupOldRecords(records) {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const oldRecords = records.filter(record => 
      new Date(record.createdAt) < yesterday
    );
    
    // 删除旧记录
    for (const record of oldRecords) {
      if (record.originalImage) {
        await deleteColorizationHistoryFromOSS(record.originalImage);
      }
      if (record.resultImage) {
        await deleteColorizationHistoryFromOSS(record.resultImage);
      }
    }
    
    return oldRecords;
  } catch (error) {
    console.error('清理旧的图像上色历史记录失败:', error);
    throw error;
  }
}

module.exports = {
  uploadImageToOSS,
  saveColorizationHistoryToOSS,
  deleteColorizationHistoryFromOSS,
  cleanupOldRecords
};
