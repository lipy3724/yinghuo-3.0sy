/**
 * 阿里云OSS工具函数
 */
const OSS = require('ali-oss');
const config = require('../config/index');

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

module.exports = {
  getOSSClient,
  uploadToOSS,
  deleteFromOSS,
  getSignedUrl
};
