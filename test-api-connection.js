/**
 * API连接测试脚本
 * 用于测试OSS连接和图像高清放大API连接
 */

// 加载环境变量
require('dotenv').config();
const OSS = require('ali-oss');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 颜色代码，用于控制台输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// 打印带颜色的消息
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// 打印成功消息
function success(message) {
  log(`✅ ${message}`, colors.green);
}

// 打印错误消息
function error(message) {
  log(`❌ ${message}`, colors.red);
}

// 打印警告消息
function warning(message) {
  log(`⚠️ ${message}`, colors.yellow);
}

// 打印信息消息
function info(message) {
  log(`ℹ️ ${message}`, colors.blue);
}

// 打印标题
function printTitle(title) {
  const line = '='.repeat(title.length + 4);
  log(`\n${line}`, colors.cyan);
  log(`= ${title} =`, colors.cyan + colors.bright);
  log(`${line}\n`, colors.cyan);
}

// 测试OSS连接
async function testOSSConnection() {
  printTitle('测试OSS连接');
  
  // 检查环境变量
  info('检查OSS环境变量...');
  const requiredEnvVars = ['ALIYUN_ACCESS_KEY_ID', 'ALIYUN_ACCESS_KEY_SECRET', 'OSS_BUCKET', 'OSS_REGION'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    error(`缺少必要的环境变量: ${missingVars.join(', ')}`);
    return false;
  }
  
  success('OSS环境变量检查通过');
  
  // 创建OSS客户端
  info('创建OSS客户端...');
  try {
    const ossClient = new OSS({
      region: process.env.OSS_REGION,
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      secure: true,
      timeout: 60000,
      endpoint: `${process.env.OSS_REGION.startsWith('oss-') ? process.env.OSS_REGION : 'oss-' + process.env.OSS_REGION}.aliyuncs.com`
    });
    
    info('OSS客户端配置:');
    console.log({
      region: ossClient.options.region,
      bucket: ossClient.options.bucket,
      endpoint: ossClient.options.endpoint,
      secure: ossClient.options.secure
    });
    
    // 测试列出文件
    info('测试列出文件...');
    const result = await ossClient.list({
      'max-keys': 1
    });
    
    if (result.objects && result.objects.length > 0) {
      success(`OSS连接成功，找到${result.objects.length}个文件`);
    } else {
      warning('OSS连接成功，但存储桶为空');
    }
    
    // 测试上传小文件
    info('测试上传小文件...');
    const testContent = Buffer.from(`Test file - ${new Date().toISOString()}`);
    const testPath = `test/connection-test-${Date.now()}.txt`;
    
    const uploadResult = await ossClient.put(testPath, testContent);
    success(`测试文件上传成功: ${uploadResult.url}`);
    
    // 测试删除文件
    info('测试删除文件...');
    await ossClient.delete(testPath);
    success('测试文件删除成功');
    
    return true;
  } catch (err) {
    error(`OSS连接测试失败: ${err.message}`);
    console.error(err);
    
    // 更详细的错误分析
    if (err.name === 'ConnectionTimeoutError') {
      error('OSS连接超时，请检查网络连接和区域配置');
    } else if (err.name === 'ResponseTimeoutError') {
      error('OSS响应超时，请检查网络连接和区域配置');
    } else if (err.code === 'InvalidAccessKeyId') {
      error('OSS访问密钥无效，请检查ALIYUN_ACCESS_KEY_ID配置');
    } else if (err.code === 'SignatureDoesNotMatch') {
      error('OSS签名不匹配，请检查ALIYUN_ACCESS_KEY_SECRET配置');
    } else if (err.code === 'NoSuchBucket') {
      error(`存储桶不存在: ${process.env.OSS_BUCKET}`);
    }
    
    return false;
  }
}

// 测试API连接
async function testAPIConnection() {
  printTitle('测试图像高清放大API连接');
  
  // 检查环境变量
  info('检查API环境变量...');
  const requiredEnvVars = ['API_APP_KEY', 'API_SECRET_KEY', 'API_HOST'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    error(`缺少必要的环境变量: ${missingVars.join(', ')}`);
    return false;
  }
  
  success('API环境变量检查通过');
  
  // 测试API服务器连通性
  info('测试API服务器连通性...');
  try {
    const apiHost = process.env.API_HOST || "https://cn-api.aidc-ai.com";
    const response = await axios.get(apiHost, { 
      timeout: 5000,
      headers: { 'User-Agent': 'YinghuoAI/1.0' }
    });
    
    success(`API服务器连通性测试成功: HTTP ${response.status}`);
    
    // 测试API签名
    info('测试API签名...');
    const timestamp = Date.now();
    const signData = process.env.API_SECRET_KEY + timestamp;
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', process.env.API_SECRET_KEY);
    hmac.update(signData);
    const sign = hmac.digest('hex').toUpperCase();
    
    success(`API签名生成成功: ${sign.substring(0, 10)}...`);
    
    // 构建API URL
    const apiPath = "/ai/super/resolution";
    const normalizedApiHost = apiHost.endsWith('/') ? apiHost.slice(0, -1) : apiHost;
    const apiUrl = `${normalizedApiHost}/rest${apiPath}?partner_id=aidge&sign_method=sha256&sign_ver=v2&app_key=${process.env.API_APP_KEY}&timestamp=${timestamp}&sign=${sign}`;
    
    info(`API URL: ${apiUrl.substring(0, 50)}...`);
    
    // 测试API调用 - 使用公开图片URL
    info('测试API调用...');
    const testImageUrl = "https://picsum.photos/200/300"; // 使用公开测试图片
    
    const requestBody = {
      imageUrl: encodeURI(testImageUrl),
      upscaleFactor: "2"
    };
    
    info('请求参数:');
    console.log(requestBody);
    
    try {
      const apiResponse = await axios.post(apiUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'x-iop-trial': 'true',
          'User-Agent': 'YinghuoAI/1.0'
        },
        timeout: 30000
      });
      
      if (apiResponse.data && (apiResponse.data.success === true || (apiResponse.data.data && apiResponse.data.data.imageUrl))) {
        success('API调用成功');
        console.log('API响应:');
        console.log(JSON.stringify(apiResponse.data, null, 2));
        return true;
      } else {
        warning('API调用返回了非标准格式的响应');
        console.log('API响应:');
        console.log(JSON.stringify(apiResponse.data, null, 2));
        return false;
      }
    } catch (apiError) {
      error(`API调用失败: ${apiError.message}`);
      
      if (apiError.response) {
        error(`HTTP状态码: ${apiError.response.status}`);
        console.log('API错误响应:');
        console.log(JSON.stringify(apiError.response.data, null, 2));
        
        // 检查是否是资源耗尽错误
        if (apiError.response.data && apiError.response.data.code === 'NoTrialResource') {
          warning('API试用资源已耗尽，请升级到付费账户或等待下个月资源重置');
        }
      } else if (apiError.code === 'ECONNABORTED') {
        error('API请求超时');
      } else if (apiError.code === 'ENOTFOUND') {
        error('API域名解析失败');
      }
      
      return false;
    }
  } catch (err) {
    error(`API服务器连通性测试失败: ${err.message}`);
    return false;
  }
}

// 测试图像高清放大路由
async function testUpscaleRoute() {
  printTitle('测试图像高清放大路由');
  
  info('测试/api/upscale路由...');
  try {
    // 获取服务器地址
    const serverHost = process.env.SERVER_HOST || 'http://localhost:8080';
    
    // 测试路由是否存在
    info('检查路由是否存在...');
    try {
      const response = await axios.options(`${serverHost}/api/upscale`, {
        timeout: 5000
      });
      
      if (response.status === 200 || response.status === 204) {
        success('路由存在');
      } else {
        warning(`路由检查返回状态码: ${response.status}`);
      }
    } catch (routeError) {
      if (routeError.response && routeError.response.status === 404) {
        error('路由不存在，请检查server.js中是否正确注册了路由');
        return false;
      } else {
        warning(`路由检查失败: ${routeError.message}`);
      }
    }
    
    // 测试任务列表API
    info('测试任务列表API...');
    try {
      // 这里需要认证令牌，如果没有提供，则跳过此测试
      if (!process.env.TEST_AUTH_TOKEN) {
        warning('未提供TEST_AUTH_TOKEN环境变量，跳过任务列表API测试');
      } else {
        const tasksResponse = await axios.get(`${serverHost}/api/upscale/tasks`, {
          headers: {
            'Authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}`
          },
          timeout: 5000
        });
        
        if (tasksResponse.status === 200) {
          success('任务列表API测试成功');
          console.log('响应数据:');
          console.log(JSON.stringify(tasksResponse.data, null, 2));
        } else {
          warning(`任务列表API返回状态码: ${tasksResponse.status}`);
        }
      }
    } catch (tasksError) {
      warning(`任务列表API测试失败: ${tasksError.message}`);
    }
    
    return true;
  } catch (err) {
    error(`图像高清放大路由测试失败: ${err.message}`);
    return false;
  }
}

// 主函数
async function main() {
  printTitle('API连接测试工具');
  info('开始测试...');
  
  let ossSuccess = false;
  let apiSuccess = false;
  let routeSuccess = false;
  
  try {
    ossSuccess = await testOSSConnection();
    apiSuccess = await testAPIConnection();
    routeSuccess = await testUpscaleRoute();
    
    printTitle('测试结果摘要');
    
    if (ossSuccess) {
      success('OSS连接测试: 通过');
    } else {
      error('OSS连接测试: 失败');
    }
    
    if (apiSuccess) {
      success('API连接测试: 通过');
    } else {
      error('API连接测试: 失败');
    }
    
    if (routeSuccess) {
      success('路由测试: 通过');
    } else {
      error('路由测试: 失败');
    }
    
    if (ossSuccess && apiSuccess && routeSuccess) {
      success('\n所有测试通过！系统应该可以正常工作。');
    } else {
      warning('\n部分测试失败，请根据上面的错误信息进行排查。');
    }
  } catch (err) {
    error(`测试过程中发生错误: ${err.message}`);
    console.error(err);
  }
}

// 执行主函数
main().catch(err => {
  error(`程序执行出错: ${err.message}`);
  console.error(err);
  process.exit(1);
});