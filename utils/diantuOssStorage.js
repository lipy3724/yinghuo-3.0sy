/**
 * 垫图功能结果图片OSS存储工具函数
 */
const axios = require('axios');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { promisify } = require('util');
const { uploadToOSS } = require('./ossUtils');

// 将文件操作转换为Promise
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

/**
 * 从URL下载图像并上传到OSS
 * @param {string} imageUrl - 图像URL
 * @param {string} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @returns {Promise<string>} OSS中的URL
 */
async function uploadDiantuResultToOSS(imageUrl, userId, taskId) {
  try {
    console.log(`开始处理垫图结果图片: ${imageUrl}`);
    
    // 生成唯一文件名
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);
    const extension = path.extname(imageUrl) || '.jpg';
    const fileName = `${timestamp}-${uniqueId}${extension}`;
    
    // 在OSS中的存储路径
    const ossPath = `diantu/${userId}/${taskId}/${fileName}`;
    
    // 临时文件路径
    const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
    const tempFilePath = path.join(tempDir, fileName);
    
    // 确保临时目录存在
    if (!fs.existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }
    
    // 下载图像
    console.log(`开始下载图像: ${imageUrl}`);
    const response = await axios({
      url: imageUrl,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 30000 // 30秒超时
    });
    
    const imageBuffer = Buffer.from(response.data);
    await writeFile(tempFilePath, imageBuffer);
    console.log(`图像已下载到临时文件: ${tempFilePath}`);
    
    // 上传到OSS
    console.log('开始上传图像到OSS...');
    const ossUrl = await uploadToOSS(imageBuffer, ossPath);
    console.log(`图像已上传到OSS: ${ossUrl}`);
    
    // 删除临时文件
    await unlink(tempFilePath);
    console.log(`临时文件已删除: ${tempFilePath}`);
    
    return ossUrl;
  } catch (error) {
    console.error('上传垫图结果到OSS失败:', error);
    throw error;
  }
}

/**
 * 从远程URL下载图像并保存到OSS
 * @param {string} imageUrl - 图像URL
 * @param {string} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @returns {Promise<string>} OSS中的URL
 */
async function saveDiantuResultToOSS(imageUrl, userId, taskId) {
  try {
    // 检查参数
    if (!imageUrl) {
      throw new Error('图像URL不能为空');
    }
    
    if (!userId) {
      console.warn('未提供用户ID，使用默认值');
      userId = 'unknown';
    }
    
    if (!taskId) {
      console.warn('未提供任务ID，使用随机值');
      taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    }
    
    // 如果图像URL已经是OSS URL，直接返回
    if (imageUrl.includes('yinghuo-ai.oss-cn-shanghai.aliyuncs.com')) {
      console.log('图像已经在OSS中，直接返回:', imageUrl);
      return imageUrl;
    }
    
    // 上传图像到OSS
    const ossUrl = await uploadDiantuResultToOSS(imageUrl, userId, taskId);
    return ossUrl;
  } catch (error) {
    console.error('保存垫图结果到OSS失败:', error);
    // 如果失败，返回原始URL
    return imageUrl;
  }
}

module.exports = {
  saveDiantuResultToOSS
};