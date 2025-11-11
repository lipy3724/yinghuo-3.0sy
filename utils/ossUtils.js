/**
 * 阿里云OSS工具函数
 */
const OSS = require('ali-oss');
const config = require('../config/index');
const axios = require('axios');
const path = require('path');

// OSS客户端实例
let ossClient = null;

/**
 * 获取OSS客户端实例
 * @returns {OSS.Client|null} OSS客户端实例，如果初始化失败则返回null
 */
function getOSSClient() {
  if (!ossClient) {
    try {
      console.log('开始初始化OSS客户端');
      
      // 从配置或环境变量获取OSS配置
      // 首先尝试从config获取，如果没有再从环境变量获取
      const region = config.oss?.region || process.env.OSS_REGION;
      const accessKeyId = config.oss?.accessKeyId || process.env.ALIYUN_ACCESS_KEY_ID;
      const accessKeySecret = config.oss?.accessKeySecret || process.env.ALIYUN_ACCESS_KEY_SECRET;
      const bucket = config.oss?.bucket || process.env.OSS_BUCKET;
      
      console.log('OSS配置检查:');
      
      // 检查必要的配置并提供默认值
      let configValid = true;
      let missingConfigs = [];
      
      if (!region) {
        console.error('缺少OSS区域配置');
        missingConfigs.push('region');
        configValid = false;
      }
      
      if (!accessKeyId) {
        console.error('缺少阿里云AccessKeyId配置');
        missingConfigs.push('accessKeyId');
        configValid = false;
      }
      
      if (!accessKeySecret) {
        console.error('缺少阿里云AccessKeySecret配置');
        missingConfigs.push('accessKeySecret');
        configValid = false;
      }
      
      if (!bucket) {
        console.error('缺少OSS存储桶配置');
        missingConfigs.push('bucket');
        configValid = false;
      }
      
      if (!configValid) {
        console.error(`OSS配置不完整，缺少以下配置: ${missingConfigs.join(', ')}`);
        
        // 使用测试/开发环境的默认值（仅用于开发环境）
        if (process.env.NODE_ENV === 'development') {
          console.log('在开发环境中使用默认OSS配置');
          
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
          
          console.log('使用开发环境默认配置初始化OSS客户端成功');
          return ossClient;
        }
        
        console.error('OSS配置不完整，无法初始化客户端');
        return null;
      }
      
      // 配置有效，初始化客户端
      console.log('OSS配置有效，正在初始化客户端，配置信息:', { 
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
      
      console.log('OSS客户端初始化成功');
    } catch (error) {
      console.error('初始化OSS客户端失败:', error);
      // 不抛出异常，返回null，让调用方处理
      return null;
    }
  }
  return ossClient;
}

/**
 * 上传文件到OSS
 * @param {Buffer|Stream|String} content 文件内容（Buffer、流或字符串）
 * @param {String} ossPath OSS中的存储路径
 * @returns {Promise<String>} 上传成功后的访问URL
 */
async function uploadToOSS(content, ossPath) {
  try {
    const client = getOSSClient();
    
    if (!client) {
      console.error('上传到OSS失败: OSS客户端未初始化');
      throw new Error('OSS客户端未初始化，请检查OSS配置');
    }
    
    console.log(`正在上传文件到OSS路径: ${ossPath}`);
    const result = await client.put(ossPath, content);
    
    // 返回可访问的URL
    console.log(`文件上传成功，URL: ${result.url}`);
    return result.url;
  } catch (error) {
    console.error('上传到OSS失败:', error);
    throw new Error(`上传到OSS失败: ${error.message}`);
  }
}

/**
 * 从OSS删除文件
 * @param {String} ossPath OSS中的存储路径
 * @returns {Promise<Object>} 删除结果
 */
async function deleteFromOSS(ossPath) {
  try {
    const client = getOSSClient();
    
    if (!client) {
      console.error('从OSS删除文件失败: OSS客户端未初始化');
      throw new Error('OSS客户端未初始化，请检查OSS配置');
    }
    
    console.log(`正在从OSS删除文件: ${ossPath}`);
    const result = await client.delete(ossPath);
    console.log(`文件删除成功: ${ossPath}`);
    return result;
  } catch (error) {
    console.error('从OSS删除文件失败:', error);
    throw new Error(`从OSS删除文件失败: ${error.message}`);
  }
}

/**
 * 上传视频文件到OSS
 * 支持两种调用方式：
 * 1. uploadVideoToOSS(file) - 接收multer文件对象
 * 2. uploadVideoToOSS(buffer, ossPath, mimetype) - 接收buffer、路径和MIME类型
 * @param {Object|Buffer} fileOrBuffer - multer文件对象或Buffer
 * @param {String} [ossPath] - OSS中的存储路径（仅当第一个参数是Buffer时使用）
 * @param {String} [mimetype] - 视频文件的MIME类型（仅当第一个参数是Buffer时使用）
 * @returns {Promise<String>} 上传成功后的访问URL
 */
async function uploadVideoToOSS(fileOrBuffer, ossPath, mimetype) {
  try {
    const client = getOSSClient();
    if (!client) {
      console.error('上传视频到OSS失败: OSS客户端未初始化');
      throw new Error('OSS客户端未初始化，请检查OSS配置');
    }
    
    // 判断是文件对象还是Buffer
    if (fileOrBuffer && fileOrBuffer.buffer) {
      // 方式1：接收multer文件对象
      const file = fileOrBuffer;
      
      if (!file.buffer) {
        throw new Error('视频文件buffer不存在');
      }
      
      // 生成OSS路径
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const ext = path.extname(file.originalname || '.mp4');
      const finalOssPath = `videos/${timestamp}-${randomStr}${ext}`;
      
      console.log(`正在上传视频到OSS路径: ${finalOssPath}, 大小: ${file.buffer.length} bytes`);
      
      // 构建上传选项
      const putOptions = {
        headers: {
          'Content-Type': file.mimetype || 'video/mp4'
        }
      };
      
      const result = await client.put(finalOssPath, file.buffer, putOptions);
      console.log(`视频上传成功，URL: ${result.url}`);
      return result.url;
    } else {
      // 方式2：接收buffer、ossPath和mimetype
      const buffer = fileOrBuffer;
    
    if (!buffer) {
      throw new Error('视频文件buffer不存在');
    }
      
      if (!ossPath) {
        throw new Error('OSS路径不能为空');
      }
    
    console.log(`正在上传视频到OSS路径: ${ossPath}, 大小: ${buffer.length} bytes`);
    
    // 构建上传选项
    const putOptions = {};
    if (mimetype) {
      putOptions.headers = {
        'Content-Type': mimetype
      };
    }
    
    const result = await client.put(ossPath, buffer, putOptions);
    console.log(`视频上传成功，URL: ${result.url}`);
    return result.url;
    }
  } catch (error) {
    console.error('上传视频到OSS失败:', error);
    throw new Error(`上传视频到OSS失败: ${error.message}`);
  }
}

/**
 * 通过远程URL拉取视频并上传到OSS（流式传输，节省内存）
 * @param {String} sourceUrl 源视频的可访问URL（可为阿里云处理结果临时URL）
 * @param {String} ossPath 目标OSS存储路径（如: 'video-logo-removal/{userId}/{taskId}_output.mp4'）
 * @returns {Promise<{ url: string, size?: number, ossPath: string }>} 上传完成后的信息
 */
async function uploadVideoFromUrlToOSS(sourceUrl, ossPath) {
  const client = getOSSClient();
  if (!client) {
    console.error('上传远程视频到OSS失败: OSS客户端未初始化');
    throw new Error('OSS客户端未初始化，请检查OSS配置');
  }
  if (!sourceUrl) {
    throw new Error('sourceUrl 不能为空');
  }
  if (!ossPath) {
    throw new Error('ossPath 不能为空');
  }
  console.log(`开始从远程URL拉取视频并上传到OSS: ${sourceUrl} -> ${ossPath}`);
  try {
    const response = await axios({
      method: 'GET',
      url: sourceUrl,
      responseType: 'stream',
      timeout: 300000
    });
    const contentLength = parseInt(response.headers['content-length'] || '0', 10) || undefined;
    const contentType = response.headers['content-type'] || 'video/mp4';
    const putOptions = {
      headers: {
        'Content-Type': contentType
      }
    };
    const result = await client.putStream(ossPath, response.data, putOptions);
    console.log(`远程视频上传OSS成功: ${result.url}`);
    return { url: result.url, size: contentLength, ossPath };
  } catch (error) {
    console.error('上传远程视频到OSS失败:', error);
    throw new Error(`上传远程视频到OSS失败: ${error.message}`);
  }
}

/**
 * 获取OSS文件的签名URL（用于临时访问私有文件）
 * @param {String} ossPath OSS中的存储路径
 * @param {Number} expireSeconds URL有效期（秒）
 * @returns {String} 签名URL
 */
function getSignedUrl(ossPath, expireSeconds = 3600) {
  try {
    const client = getOSSClient();
    
    if (!client) {
      console.error('获取签名URL失败: OSS客户端未初始化');
      throw new Error('OSS客户端未初始化，请检查OSS配置');
    }
    
    console.log(`正在获取OSS文件的签名URL: ${ossPath}, 有效期: ${expireSeconds}秒`);
    const signedUrl = client.signatureUrl(ossPath, { expires: expireSeconds });
    console.log(`签名URL生成成功`);
    return signedUrl;
  } catch (error) {
    console.error('获取签名URL失败:', error);
    throw new Error(`获取签名URL失败: ${error.message}`);
  }
}

/**
 * 上传图片文件到OSS（接收multer文件对象）
 * @param {Object} file - multer文件对象（包含buffer、originalname、mimetype等）
 * @returns {Promise<String>} 上传成功后的访问URL
 */
async function uploadImageToOSS(file) {
  try {
    if (!file || !file.buffer) {
      throw new Error('图片文件对象无效');
    }
    
    const client = getOSSClient();
    if (!client) {
      console.error('上传图片到OSS失败: OSS客户端未初始化');
      throw new Error('OSS客户端未初始化，请检查OSS配置');
    }
    
    // 生成OSS路径
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname || '.jpg');
    const ossPath = `images/${timestamp}-${randomStr}${ext}`;
    
    console.log(`正在上传图片到OSS路径: ${ossPath}, 大小: ${file.buffer.length} bytes`);
    
    // 构建上传选项
    const putOptions = {
      headers: {
        'Content-Type': file.mimetype || 'image/jpeg'
      }
    };
    
    const result = await client.put(ossPath, file.buffer, putOptions);
    console.log(`图片上传成功，URL: ${result.url}`);
    return result.url;
  } catch (error) {
    console.error('上传图片到OSS失败:', error);
    throw new Error(`上传图片到OSS失败: ${error.message}`);
  }
}


/**
 * 上传视频换脸/换人结果到OSS（从URL下载并上传）
 * @param {String} videoUrl - 源视频URL（阿里云返回的临时URL）
 * @param {String} userId - 用户ID
 * @param {String} taskId - 任务ID
 * @returns {Promise<String>} 上传成功后的访问URL
 */
async function uploadVideoFaceSwapResultToOSS(videoUrl, userId, taskId) {
  try {
    if (!videoUrl) {
      throw new Error('视频URL不能为空');
    }
    
    // 生成OSS路径
    const ossPath = `video-face-swap/${userId}/${taskId}_result.mp4`;
    
    // 使用已有的uploadVideoFromUrlToOSS函数
    const result = await uploadVideoFromUrlToOSS(videoUrl, ossPath);
    console.log(`视频换脸结果已上传到OSS: ${result.url}`);
    return result.url;
  } catch (error) {
    console.error('上传视频换脸结果到OSS失败:', error);
    throw new Error(`上传视频换脸结果到OSS失败: ${error.message}`);
  }
}

module.exports = {
  getOSSClient,
  uploadToOSS,
  uploadVideoToOSS,
  deleteFromOSS,
  getSignedUrl,
  uploadVideoFromUrlToOSS,
  uploadImageToOSS,
  uploadVideoFaceSwapResultToOSS
};
