const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');
const OSS = require('ali-oss');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
// 加载环境变量
require('dotenv').config();

// API配置
const API_CONFIG = {
  APP_KEY: process.env.API_APP_KEY || "2aec2553d7a6b0f3",
  SECRET_KEY: process.env.API_SECRET_KEY || "98f05a0e7cd39bdfb5378a386c8a3f23",
  SIGN_METHOD_SHA256: process.env.API_SIGN_METHOD_SHA256 || "sha256",
  SIGN_METHOD_HMAC_SHA256: process.env.API_SIGN_METHOD_HMAC_SHA256 || "HmacSHA256",
  API_HOST: process.env.API_HOST || "https://cn-api.aidc-ai.com",
}

// OSS配置
const OSS_CONFIG = {
  region: process.env.OSS_REGION || "oss-region",
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || "your-access-key-id",
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || "your-access-key-secret",
  bucket: process.env.OSS_BUCKET || "your-bucket-name",
}

/**
 * 将二进制数组转换为大写的十六进制字符串
 */
function byte2hex(bytes) {
  let sign = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    let hex = (byte & 0xFF).toString(16);
    if (hex.length === 1) {
      sign += '0';
    }
    sign += hex.toUpperCase();
  }
  return sign;
}

/**
 * HMAC-SHA256加密实现
 */
function encryptHMACSHA256(data, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(data, 'utf8');
  return hmac.digest();
}

/**
 * HMAC-SHA256加密实现 - 使用新的签名方式
 */
function hmacSha256(data, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(data);
  return hmac.digest('hex').toUpperCase();
}

/**
 * 签名API请求
 */
function signApiRequest(params, appSecret, signMethod, apiName) {
  // 第一步：检查参数是否已经排序
  const keys = Object.keys(params).sort();
  
  // 第二步和第三步：把API名和参数串在一起
  let query = apiName;
  
  for (const key of keys) {
    const value = params[key];
    if (key && value) {
      query += key + value;
    }
  }
  
  console.log('Query string for signing:', query);
  
  // 第四步：使用加密算法
  let bytes;
  if (signMethod === API_CONFIG.SIGN_METHOD_SHA256) {
    bytes = encryptHMACSHA256(query, appSecret);
  }
  
  // 第五步：把二进制转化为大写的十六进制
  return byte2hex(bytes);
}

/**
 * 获取签名响应
 */
function getSignParams(params, api) {
  try {
    const time = Date.now();
    const signParams = { ...params };
    
    signParams.app_key = API_CONFIG.APP_KEY;
    signParams.sign_method = API_CONFIG.SIGN_METHOD_SHA256;
    signParams.timestamp = String(time);
    
    const signStr = signApiRequest(signParams, API_CONFIG.SECRET_KEY, API_CONFIG.SIGN_METHOD_SHA256, api);
    
    return {
      appKey: API_CONFIG.APP_KEY,
      signStr,
      timestamp: time,
      signMethod: API_CONFIG.SIGN_METHOD_SHA256
    };
  } catch (error) {
    console.error('获取签名失败:', error);
    throw error;
  }
}

// 创建OSS客户端 - 修复域名错误问题
const ossClient = new OSS({
  region: 'cn-shanghai', // 直接使用硬编码的区域，不包含oss-前缀
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  bucket: 'yinghuo-ai', // 直接使用硬编码的存储桶名称
  secure: true,
  timeout: parseInt(process.env.OSS_TIMEOUT || '60000'),
  cname: false, // 不使用自定义域名
  internal: false, // 使用公网地址
  endpoint: 'oss-cn-shanghai.aliyuncs.com' // 使用标准阿里云OSS endpoint
});

/**
 * 上传文件到OSS
 * @param {Buffer} fileBuffer - 文件buffer
 * @param {String} fileName - 文件名
 * @param {String} category - 文件类别，用于确定OSS路径
 * @returns {Promise<String>} - 返回OSS URL
 */
async function uploadToOSS(fileBuffer, fileName, category = 'general') {
  try {
    // 生成唯一的文件名避免冲突
    const extname = path.extname(fileName);
    
    // 根据类别确定OSS路径
    let ossPath;
    if (category === 'colorization' || fileName.includes('colorization')) {
      ossPath = `image-colorization/images/${Date.now()}-${uuidv4()}${extname}`;
    } else if (category === 'upscaler' || fileName.includes('upscaler')) {
      ossPath = `image-upscaler/images/${Date.now()}-${uuidv4()}${extname}`;
    } else if (category === 'qwen-image-edit' || fileName.includes('qwen-image-edit')) {
      // 通义千问图像编辑专用路径，不设置强制下载头部
      ossPath = fileName; // 直接使用传入的文件名，因为已经包含了完整路径
    } else if (category === 'image-edit-history' || fileName.includes('image-edit-history')) {
      // 图像编辑历史记录专用路径，直接使用传入的文件名
      ossPath = fileName; // 直接使用传入的文件名，因为已经包含了完整路径
    } else {
      // 默认使用通用路径
      ossPath = `general/images/${Date.now()}-${uuidv4()}${extname}`;
    }
    
    console.log('开始上传文件到OSS...');
    console.log('OSS配置:', {
      region: ossClient.options.region,
      bucket: ossClient.options.bucket,
      endpoint: ossClient.options.endpoint,
      secure: ossClient.options.secure,
      cname: ossClient.options.cname,
      internal: ossClient.options.internal
    });
    
    // 测试OSS连接
    try {
      await ossClient.list({
        'max-keys': 1
      });
      console.log('OSS连接测试成功');
    } catch (testError) {
      console.error('OSS连接测试失败:', testError);
      console.error('OSS错误详情:', JSON.stringify(testError));
      // 继续尝试上传，不阻止主流程
    }
    
    // 上传到OSS
    let result;
    if (category === 'qwen-image-edit') {
      // 为通义千问图像编辑设置特殊的头部，确保API可以访问
      const contentType = extname.toLowerCase() === '.png' ? 'image/png' : 
                         extname.toLowerCase() === '.webp' ? 'image/webp' : 'image/jpeg';
      
      result = await ossClient.put(ossPath, fileBuffer, {
        headers: {
          'Content-Type': contentType, // 根据文件类型设置正确的Content-Type
          'Cache-Control': 'public, max-age=31536000', // 设置缓存
          'Content-Disposition': 'inline', // 设置为内联显示，而不是下载
          // 不设置 x-oss-force-download，让图片可以直接访问
        }
      });
      
      // 为通义千问图像编辑的文件设置公共读取权限
      try {
        await ossClient.putACL(ossPath, 'public-read');
        console.log('✅ 文件ACL设置为public-read成功');
      } catch (aclError) {
        console.warn('⚠️  设置文件ACL失败:', aclError.message);
        // 不阻止主流程，继续执行
      }
    } else if (category === 'image-edit-history') {
      // 为图像编辑历史记录设置特殊的头部，确保可以被访问
      result = await ossClient.put(ossPath, fileBuffer, {
        headers: {
          'Content-Type': 'application/json', // JSON文件类型
          'Cache-Control': 'public, max-age=86400', // 设置缓存24小时
          'Content-Disposition': 'inline', // 设置为内联显示，而不是下载
        }
      });
      
      // 为历史记录文件设置公共读取权限
      try {
        await ossClient.putACL(ossPath, 'public-read');
        console.log('✅ 历史记录文件ACL设置为public-read成功');
      } catch (aclError) {
        console.warn('⚠️  设置历史记录文件ACL失败:', aclError.message);
        // 不阻止主流程，继续执行
      }
    } else {
      result = await ossClient.put(ossPath, fileBuffer);
    }
    console.log('文件上传到OSS成功:', result.url);
    
    // 验证上传结果
    if (!result.url) {
      console.warn('OSS上传成功但URL为空，构造URL');
      // 手动构造URL
      const protocol = ossClient.options.secure ? 'https://' : 'http://';
      const endpoint = ossClient.options.endpoint;
      const bucket = ossClient.options.bucket;
      const constructedUrl = `${protocol}${bucket}.${endpoint}/${ossPath}`;
      console.log('手动构造的URL:', constructedUrl);
      return constructedUrl;
    }
    
    return result.url;
  } catch (error) {
    console.error('上传到OSS失败:', error);
    console.error('OSS错误详情:', error.code, error.message, error.requestId);
    console.error('OSS错误堆栈:', error.stack);
    
    // 更详细的错误信息
    if (error.name === 'ConnectionTimeoutError') {
      throw new Error(`OSS连接超时: ${error.message}`);
    } else if (error.name === 'ResponseTimeoutError') {
      throw new Error(`OSS响应超时: ${error.message}`);
    } else if (error.code === 'InvalidAccessKeyId') {
      throw new Error('OSS访问密钥无效，请检查配置');
    } else if (error.code === 'SignatureDoesNotMatch') {
      throw new Error('OSS签名不匹配，请检查AccessKey配置');
    } else if (error.code === 'NoSuchBucket') {
      throw new Error(`存储桶不存在: ${ossClient.options.bucket}`);
    } else {
      throw new Error(`上传到OSS失败: ${error.code || error.message}`);
    }
  }
}

/**
 * 调用图像高清放大API
 * @param {String} imageUrl - 图片URL
 * @param {Number} upscaleFactor - 放大倍数
 * @returns {Promise<Object>} - API响应
 */
async function callUpscaleApi(imageUrl, upscaleFactor) {
  try {
    // 使用原始代码中的API路径
    const apiPath = "/ai/super/resolution";
    
    // 当前时间戳（毫秒）
    const timestamp = Date.now();
    
    // 按照原始代码的方式计算签名
    const signData = API_CONFIG.SECRET_KEY + timestamp;
    const sign = hmacSha256(signData, API_CONFIG.SECRET_KEY);
    
    // 构建API URL - 使用环境变量中的API_HOST
    const apiHost = API_CONFIG.API_HOST || "https://cn-api.aidc-ai.com";
    console.log('使用API主机:', apiHost);
    
    // 确保apiHost不包含尾部斜杠
    const normalizedApiHost = apiHost.endsWith('/') ? apiHost.slice(0, -1) : apiHost;
    
    // 修正API URL格式
    const apiUrl = `${normalizedApiHost}/rest${apiPath}?partner_id=aidge&sign_method=sha256&sign_ver=v2&app_key=${API_CONFIG.APP_KEY}&timestamp=${timestamp}&sign=${sign}`;
    
    // 构建请求参数 - 与原始代码保持一致
    const requestBody = {
      imageUrl: encodeURI(imageUrl), // 确保URL正确编码
      upscaleFactor: String(upscaleFactor)
    };
    
    // 打印日志
    console.log('调用图像高清放大API:', apiUrl);
    console.log('签名数据:', signData);
    console.log('APP_KEY:', API_CONFIG.APP_KEY);
    console.log('SECRET_KEY长度:', API_CONFIG.SECRET_KEY ? API_CONFIG.SECRET_KEY.length : 0);
    
    // 准备请求头 - 与原始代码保持一致
    const headers = {
      'Content-Type': 'application/json',
      'x-iop-trial': 'true',  // 添加试用标记
      'User-Agent': 'YinghuoAI/1.0' // 添加用户代理
    };
    
    console.log('请求头:', headers);
    console.log('请求参数:', requestBody);
    
    // 使用POST方法发送请求，参数放在请求体中，增加超时设置和错误处理
    try {
      console.log('发送API请求到:', apiUrl);
      console.log('请求体:', JSON.stringify(requestBody));
      console.log('请求头:', JSON.stringify(headers));
      
      // 测试API连通性
      try {
        await axios.get(apiHost, { 
          timeout: 5000,
          headers: { 'User-Agent': 'YinghuoAI/1.0' }
        });
        console.log('API服务器连通性测试成功');
      } catch (pingError) {
        console.error('API服务器连通性测试失败:', pingError.message);
        // 继续执行，不阻止主请求
      }
      
      // 使用代理发送请求（如果有代理配置）
      const axiosConfig = {
        headers,
        timeout: 120000, // 增加超时时间到120秒
        validateStatus: function (status) {
          return status >= 200 && status < 600; // 接受所有状态码，以便我们可以处理错误
        }
      };
      
      // 如果环境中配置了代理，则使用代理
      if (process.env.HTTP_PROXY) {
        const HttpsProxyAgent = require('https-proxy-agent');
        axiosConfig.httpsAgent = new HttpsProxyAgent(process.env.HTTP_PROXY);
        console.log('使用代理:', process.env.HTTP_PROXY);
      }
      
      const response = await axios.post(apiUrl, requestBody, axiosConfig);
    
      console.log('API响应状态:', response.status);
      console.log('API响应头:', JSON.stringify(response.headers, null, 2));
      console.log('API完整响应:', JSON.stringify(response.data, null, 2));
      
      // 检查HTTP状态码
      if (response.status >= 400) {
        console.error(`API返回错误状态码: ${response.status}`);
        console.error('错误响应:', response.data);
        throw new Error(`API错误: ${response.status} ${JSON.stringify(response.data)}`);
      }
      
      // 检查响应数据 - 增强错误处理
      console.log('API完整响应数据结构:', JSON.stringify(response.data, null, 2));
      
      // 尝试处理不同格式的成功响应
      if (response.data && response.data.success === true) {
        console.log('API调用成功 - 标准格式');
        return response.data;
      } else if (response.data && response.data.code === 200) {
        // 成功但使用code=200表示
        console.log('API调用成功 - code=200格式');
        
        // 检查data字段中是否有imageUrl
        if (response.data.data && response.data.data.imageUrl) {
          return {
            success: true,
            data: response.data.data,
            requestId: response.data.requestId || 'unknown'
          };
        }
        
        // 检查result字段中是否有imageUrl
        if (response.data.result && response.data.result.imageUrl) {
          return {
            success: true,
            data: {
              imageUrl: response.data.result.imageUrl
            },
            requestId: response.data.requestId || 'unknown'
          };
        }
        
        // 直接检查response.data中是否有imageUrl
        if (response.data.imageUrl) {
          return {
            success: true,
            data: {
              imageUrl: response.data.imageUrl
            },
            requestId: response.data.requestId || 'unknown'
          };
        }
      } else if (response.data && response.data.data && response.data.data.imageUrl) {
        // 成功但格式不同，构造标准格式返回
        console.log('API调用成功 - 直接包含data.imageUrl格式');
        return {
          success: true,
          data: response.data.data,
          requestId: response.data.requestId || 'unknown'
        };
      } else if (response.data && response.data.result && response.data.result.imageUrl) {
        // 成功但使用result字段
        console.log('API调用成功 - 使用result字段格式');
        return {
          success: true,
          data: {
            imageUrl: response.data.result.imageUrl
          },
          requestId: response.data.requestId || 'unknown'
        };
      } else if (response.data && response.data.imageUrl) {
        // 成功但imageUrl直接在顶层
        console.log('API调用成功 - imageUrl在顶层格式');
        return {
          success: true,
          data: {
            imageUrl: response.data.imageUrl
          },
          requestId: 'unknown'
        };
      } else if (response.data && response.data.code && response.data.code !== 200) {
        // API返回了错误码
        console.error('API返回错误码:', response.data.code);
        console.error('API错误信息:', response.data.message || '未知错误');
        throw new Error(`API错误: ${response.data.code} ${response.data.message || '未知错误'}`);
      } else if (response.data) {
        // 有响应但格式不符合预期
        console.error('API响应格式异常:', JSON.stringify(response.data, null, 2));
        throw new Error(`API响应格式异常: ${JSON.stringify(response.data)}`);
      } else {
        // 没有响应数据
        console.error('API调用失败: 没有响应数据');
        throw new Error('图像处理失败: 没有响应数据');
      }
    } catch (axiosError) {
      console.error('API请求发送失败:', axiosError.message);
      if (axiosError.response) {
        console.error('错误响应状态:', axiosError.response.status);
        console.error('错误响应数据:', axiosError.response.data);
      } else if (axiosError.code === 'ECONNABORTED') {
        console.error('API请求超时');
        throw new Error('图像处理请求超时，请稍后重试');
      } else if (axiosError.code === 'ENOTFOUND') {
        console.error('API域名解析失败');
        throw new Error('无法连接到图像处理服务器，请检查网络连接');
      }
      throw new Error(`图像处理请求失败: ${axiosError.message}`);
    }
  } catch (error) {
    console.error('调用图像高清放大API失败:', error.message);
    console.error('错误详情:', error);
    if (error.response) {
      console.error('API响应状态:', error.response.status);
      console.error('API响应数据:', error.response.data);
      throw new Error(`图像处理失败: ${error.response.status} ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error('未收到响应:', error.request);
      throw new Error(`图像处理失败: 未收到API响应，请检查网络连接`);
    } else {
      throw new Error(`图像处理失败: ${error.message}`);
    }
  }
}

/**
 * 生成Aidge虚拟模特需要的签名
 * @param {string} secret - 加密密钥（即从Aidge官网获取到的secret）
 * @param {number} timeStamp - 当前的Unix时间戳（单位：秒）
 * @param {string} userId - 商户侧自定义的用户ID，可选
 * @returns {string} - 加签后的签名
 */
function generateAidgeSign(secret, timeStamp, userId) {
  try {
    // 使用TreeMap排序参数，在JS中可以使用Object.keys排序实现
    const params = {};
    params.timeStamp = timeStamp.toString();
    
    // 仅当userId非空时添加
    if (userId && userId.trim()) {
      params.userId = userId;
    }
    
    // 按key排序构建查询字符串（不含分隔符，直接拼接）
    const sortedKeys = Object.keys(params).sort();
    let query = '';
    
    for (const key of sortedKeys) {
      const value = params[key];
      // 检查key和value都不为空
      if (key && key.trim() && value && value.trim()) {
        query += key + value;
      }
    }
    
    // 使用HMAC-SHA256加密
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(query);
    
    // 转为大写的十六进制字符串
    return hmac.digest('hex').toUpperCase();
  } catch (error) {
    console.error('生成Aidge签名失败:', error);
    throw new Error('生成签名失败: ' + error.message);
  }
}

/**
 * 从OSS删除文件
 * @param {string} fileName - 文件名（包含路径）
 * @returns {Promise<boolean>} - 删除是否成功
 */
async function deleteFromOSS(fileName) {
  try {
    console.log('从OSS删除文件:', fileName);
    
    const result = await ossClient.delete(fileName);
    console.log('OSS删除结果:', result);
    
    return true;
  } catch (error) {
    console.error('从OSS删除文件失败:', error);
    throw error;
  }
}

/**
 * 列出OSS中的文件
 * @param {string} prefix - 文件前缀（路径）
 * @param {number} maxKeys - 最大返回数量，默认100
 * @returns {Promise<Array>} - 文件列表
 */
async function listOSSFiles(prefix, maxKeys = 100) {
  try {
    console.log('列出OSS文件，前缀:', prefix, '最大数量:', maxKeys);
    
    const result = await ossClient.list({
      prefix: prefix,
      'max-keys': maxKeys
    });
    
    console.log('OSS文件列表结果:', result.objects ? result.objects.length : 0, '个文件');
    
    if (!result.objects) {
      return [];
    }
    
    // 转换为更友好的格式
    const files = result.objects.map(obj => ({
      name: obj.name,
      url: `https://${OSS_CONFIG.bucket}.${OSS_CONFIG.region}.aliyuncs.com/${obj.name}`,
      size: obj.size,
      lastModified: obj.lastModified,
      etag: obj.etag
    }));
    
    return files;
  } catch (error) {
    console.error('列出OSS文件失败:', error);
    throw error;
  }
}

module.exports = {
  uploadToOSS,
  deleteFromOSS,
  listOSSFiles,
  callUpscaleApi,
  generateAidgeSign
}; 