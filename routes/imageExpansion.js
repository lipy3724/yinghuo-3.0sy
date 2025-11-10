const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');
const { protect } = require('../middleware/auth');
const { createUnifiedFeatureMiddleware } = require('../middleware/unifiedFeatureUsage');

// 通义万相API配置
const API_KEY = process.env.DASHSCOPE_API_KEY || 'sk-a53c9eb917ce49558997c6bc0edac820';
const API_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis';
const TASK_API_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks';

// 创建axios实例
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ 
    keepAlive: true, 
    family: 4,
    rejectUnauthorized: false // 允许自签名证书
  })
});

// 添加全局错误处理
axiosInstance.interceptors.request.use(config => {
  console.log(`发起请求: ${config.method.toUpperCase()} ${config.url}`);
  return config;
}, error => {
  console.error('请求拦截器错误:', error);
  return Promise.reject(error);
});

axiosInstance.interceptors.response.use(response => {
  console.log(`响应状态: ${response.status} ${response.statusText}`);
  return response;
}, error => {
  console.error('响应拦截器错误:', {
    message: error.message,
    code: error.code,
    status: error.response?.status,
    statusText: error.response?.statusText,
    data: error.response?.data
  });
  return Promise.reject(error);
});

// 图像缓存
const imageCache = new Map();

// 并发请求限制
const MAX_CONCURRENT_REQUESTS = 5;
let currentRequests = 0;
const requestQueue = [];

/**
 * 并发请求限制器
 * @param {Function} fn 要执行的异步函数
 * @param {Array} args 函数参数
 * @returns {Promise} 函数执行结果
 */
async function limitConcurrency(fn, ...args) {
  return new Promise((resolve, reject) => {
    const executeRequest = async () => {
      currentRequests++;
      try {
        const result = await fn(...args);
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        currentRequests--;
        if (requestQueue.length > 0) {
          const nextRequest = requestQueue.shift();
          nextRequest();
        }
      }
    };

    if (currentRequests < MAX_CONCURRENT_REQUESTS) {
      executeRequest();
    } else {
      requestQueue.push(executeRequest);
      console.log(`请求已加入队列，当前并发请求数: ${currentRequests}, 队列长度: ${requestQueue.length}`);
    }
  });
}

// 创建任务函数
async function createTask(requestData) {
  // 最大重试次数
  const maxRetries = 3;
  let retryCount = 0;
  let lastError = null;

  while (retryCount < maxRetries) {
    try {
      console.log(`尝试调用通义万相API (第${retryCount + 1}次尝试)`);
      const response = await axiosInstance.post(API_BASE_URL, requestData, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
          'Accept': 'application/json',
          'Connection': 'keep-alive'
        },
        timeout: 60000, // 增加超时时间到60秒
        // 添加代理设置，解决可能的网络问题
        proxy: false,
        maxContentLength: 100 * 1024 * 1024, // 设置最大响应大小为100MB
        maxBodyLength: 100 * 1024 * 1024 // 设置最大请求体大小为100MB
      });

      console.log('通义万相API响应:', response.status, JSON.stringify(response.data, null, 2));
      return response;
    } catch (error) {
      lastError = error;
      const errorMessage = error.response?.data || error.message;
      console.error(`调用通义万相API失败 (第${retryCount + 1}次尝试):`, errorMessage);
      
      // 记录详细错误信息
      console.error('错误详情:', {
        code: error.code,
        status: error.response?.status,
        headers: error.response?.headers,
        data: error.response?.data,
        message: error.message,
        stack: error.stack
      });
      
      // 如果是网络错误或超时，则重试
      if (error.code === 'ECONNABORTED' || 
          error.code === 'ETIMEDOUT' || 
          error.code === 'ECONNRESET' ||
          error.message.includes('socket hang up') ||
          error.message.includes('timeout')) {
        retryCount++;
        if (retryCount < maxRetries) {
          const delay = 2000 * retryCount; // 递增延迟
          console.log(`将在 ${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      } else {
        // 如果是其他错误，不重试
        break;
      }
    }
  }
  
  // 所有重试都失败
  console.error(`通义万相API调用失败，已重试 ${retryCount} 次`);
  throw lastError;
}

// 查询任务状态函数
async function queryTaskStatus(taskId) {
  // 最大重试次数
  const maxRetries = 3;
  let retryCount = 0;
  let lastError = null;

  while (retryCount < maxRetries) {
    try {
      console.log(`尝试查询任务 ${taskId} 状态 (第${retryCount + 1}次尝试)`);
      const response = await axiosInstance.get(`${TASK_API_URL}/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
          'Accept': 'application/json',
          'Connection': 'keep-alive'
        },
        timeout: 30000, // 增加超时时间到30秒
        // 添加代理设置，解决可能的网络问题
        proxy: false,
        maxContentLength: 50 * 1024 * 1024 // 设置最大响应大小为50MB
      });

      return response;
    } catch (error) {
      lastError = error;
      const errorMessage = error.response?.data || error.message;
      console.error(`查询任务 ${taskId} 状态失败 (第${retryCount + 1}次尝试):`, errorMessage);
      
      // 记录详细错误信息
      console.error('错误详情:', {
        code: error.code,
        status: error.response?.status,
        headers: error.response?.headers,
        data: error.response?.data,
        message: error.message,
        stack: error.stack
      });
      
      // 如果是网络错误或超时，则重试
      if (error.code === 'ECONNABORTED' || 
          error.code === 'ETIMEDOUT' || 
          error.code === 'ECONNRESET' ||
          error.message.includes('socket hang up') ||
          error.message.includes('timeout')) {
        retryCount++;
        if (retryCount < maxRetries) {
          const delay = 1000 * retryCount; // 递增延迟
          console.log(`将在 ${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      } else {
        // 如果是其他错误，不重试
        break;
      }
    }
  }
  
  // 所有重试都失败
  console.error(`查询任务 ${taskId} 状态失败，已重试 ${retryCount} 次`);
  throw lastError;
}

// 获取结果URL函数
function getResultUrl(statusResponse) {
  try {
    const output = statusResponse.data.output;
    if (output && output.results && output.results.length > 0) {
      return output.results[0].url;
    }
    return null;
  } catch (error) {
    console.error('解析结果URL失败:', error);
    return null;
  }
}

/**
 * @route   POST /api/image-expansion/create
 * @desc    创建智能扩图任务
 * @access  私有
 */
router.post('/create', protect, createUnifiedFeatureMiddleware('image-expansion'), async (req, res) => {
  // 添加错误捕获包装
  try {
    const { prompt, imageUrl, leftScale, rightScale, topScale, bottomScale, negativePrompt, quality } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：imageUrl'
      });
    }
    
    // 验证扩展比例参数
    const maxScale = 2;
    if ((leftScale && leftScale > maxScale) || 
        (rightScale && rightScale > maxScale) || 
        (topScale && topScale > maxScale) || 
        (bottomScale && bottomScale > maxScale)) {
      return res.status(400).json({
        success: false,
        message: `扩展比例不能超过${maxScale}倍`
      });
    }
    
    // 从统一中间件获取积分使用信息
    const userId = req.user.id;
    const { usageType, creditCost, isFree } = req.featureUsage;
    
    // 积分已在统一中间件中扣除，这里只需要记录任务信息
    
    // 生成唯一任务ID
    let taskId = `expand-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    try {
      // 构建通义万相API请求数据
      const requestData = {
        model: "wanx2.1-imageedit",
        input: {
          base_image_url: imageUrl,
          prompt: prompt || "延续图像内容",
          function: "expand",
          negative_prompt: negativePrompt || "模糊, 扭曲, 变形, 低质量"
        },
        parameters: {
          n: 1,
          left_scale: leftScale || 0.5,
          right_scale: rightScale || 0.5,
          top_scale: topScale || 0.5,
          bottom_scale: bottomScale || 0.5,
          quality: quality || "standard"
        }
      };
      
      console.log('创建智能扩图任务:', JSON.stringify(requestData, null, 2));
      
      // 调用创建任务，使用并发限制
      const response = await limitConcurrency(createTask, requestData);
      
      // 使用API返回的任务ID，如果没有则使用生成的ID
      const apiTaskId = response.data.output?.task_id;
      if (apiTaskId) {
        taskId = apiTaskId;
      }
      
      // 保存任务信息到全局变量
      if (!global.imageExpansionTasks) {
        global.imageExpansionTasks = {};
      }
      
      global.imageExpansionTasks[taskId] = {
        userId: userId,
        creditCost: isFree ? 0 : creditCost,
        hasChargedCredits: !isFree,
        timestamp: new Date(),
        imageUrl: imageUrl,
        prompt: prompt || "延续图像内容",
        function: "expand",
        leftScale: leftScale || 0.5,
        rightScale: rightScale || 0.5,
        topScale: topScale || 0.5,
        bottomScale: bottomScale || 0.5,
        isFree: isFree,
        status: 'PENDING',
        taskId: taskId,
        createdAt: new Date().toISOString()
      };
      
      console.log(`智能扩图任务信息已保存: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}, 是否免费=${isFree}`);
      
      // 使用统一中间件的saveTaskDetails函数保存任务详情
      try {
        const { saveTaskDetails } = require('../middleware/unifiedFeatureUsage');
        await saveTaskDetails(req.featureUsage.usage, {
          taskId: taskId,
          creditCost: creditCost,
          isFree: isFree,
          status: 'pending', // 标记为待处理
          extraData: {
            imageUrl: imageUrl,
            prompt: prompt || "延续图像内容",
            leftScale: leftScale || 0.5,
            rightScale: rightScale || 0.5,
            topScale: topScale || 0.5,
            bottomScale: bottomScale || 0.5,
            status: 'PENDING'
          }
        });
        
        // 保存使用记录ID到全局任务变量中，以便后续更新
        if (global.imageExpansionTasks[taskId]) {
          global.imageExpansionTasks[taskId].usageId = req.featureUsage.usage.id;
        }
        
        console.log(`智能扩图任务ID=${taskId}已通过统一中间件保存到数据库`);
      } catch (saveError) {
        console.error('通过统一中间件保存任务信息失败:', saveError);
        // 继续响应，不中断流程
      }
      
      return res.json({
        success: true,
        taskId: taskId,
        message: '任务创建成功，正在处理中'
      });
    } catch (error) {
      console.error('创建智能扩图任务失败:', error);
      
      // 调用退款函数
      try {
        const refundManager = require('../utils/refundManager');
        await refundManager.refundImageExpansionCredits(userId, taskId, '任务创建失败');
        console.log(`已为任务ID=${taskId}执行退款处理`);
        
        // 更新数据库中的任务状态为失败
        try {
          const { saveTaskDetails } = require('../middleware/unifiedFeatureUsage');
          await saveTaskDetails(req.featureUsage.usage, {
            taskId: taskId,
            creditCost: creditCost,
            isFree: isFree,
            status: 'cancelled', // 标记为已取消
            extraData: {
              status: 'FAILED',
              failReason: '任务创建失败',
              failedAt: new Date().toISOString()
            }
          });
          console.log(`智能扩图任务ID=${taskId}已通过统一中间件更新为失败状态`);
        } catch (dbError) {
          console.error('更新智能扩图任务状态失败:', dbError);
        }
      } catch (refundError) {
        console.error('执行退款失败:', refundError);
      }
      
      // 根据错误类型返回不同的错误信息
      let errorMessage = '创建任务失败，请稍后重试';
      let errorCode = 'TASK_CREATION_ERROR';
      
      if (error.message.includes('API')) {
        errorMessage = '通义万相API调用失败，请稍后重试';
        errorCode = 'API_ERROR';
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('连接')) {
        errorMessage = '网络连接错误，请检查网络设置';
        errorCode = 'NETWORK_ERROR';
      } else if (error.message.includes('timeout') || error.message.includes('超时')) {
        errorMessage = '请求超时，请稍后重试';
        errorCode = 'TIMEOUT_ERROR';
      }
      
      return res.status(500).json({
        success: false,
        message: errorMessage,
        errorDetail: error.message,
        errorCode: errorCode
      });
    }
  } catch (error) {
    console.error('处理智能扩图请求出错:', error);
    
    // 记录异常详情
    console.error('异常详情:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : null
    });
    
    // 尝试退款
    try {
      const userId = req.user.id;
      const taskId = `expand-error-${Date.now()}`;
      const refundManager = require('../utils/refundManager');
      await refundManager.refundImageExpansionCredits(userId, taskId, '处理请求异常');
      console.log(`已为异常请求执行退款处理: 用户ID=${userId}`);
    } catch (refundError) {
      console.error('异常退款失败:', refundError);
    }
    
    // 根据错误类型返回不同的错误信息
    let errorMessage = '服务器内部错误，请稍后重试';
    let errorCode = 'SERVER_ERROR';
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorMessage = '请求超时，请检查网络连接并稍后重试';
      errorCode = 'TIMEOUT_ERROR';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = '无法连接到服务器，请稍后重试';
      errorCode = 'CONNECTION_ERROR';
    } else if (error.message.includes('socket hang up')) {
      errorMessage = '网络连接中断，请稍后重试';
      errorCode = 'NETWORK_ERROR';
    }
    
    return res.status(500).json({
      success: false,
      message: errorMessage,
      errorDetail: error.message,
      errorCode: errorCode
    });
  }
});

/**
 * @route   GET /api/image-expansion/status/:taskId
 * @desc    智能扩图专用任务状态查询接口
 * @access  私有
 */
router.get('/status/:taskId', protect, async (req, res) => {
  // 添加错误捕获包装
  try {
    const { taskId } = req.params;
    
    // 验证taskId格式
    if (!taskId || typeof taskId !== 'string' || taskId.trim() === '') {
      return res.status(400).json({
        success: false, 
        message: '任务ID无效'
      });
    }
    
      // 从全局变量中查找任务
      const task = global.imageExpansionTasks?.[taskId];
    if (!task) {
      return res.status(404).json({
        success: false, 
        message: '任务不存在'
      });
    }
    
    // 检查任务是否属于当前用户
    if (task.userId && task.userId !== req.user.id) {
      return res.status(403).json({
        success: false, 
        message: '无权访问此任务'
      });
    }
    
    // 检查任务是否已经超时
    const taskCreationTime = task.timestamp ? new Date(task.timestamp) : new Date();
    const currentTime = new Date();
    const taskAgeInMinutes = (currentTime - taskCreationTime) / (1000 * 60);
    
    // 如果任务已经创建超过10分钟，则视为超时
    if (taskAgeInMinutes > 10) {
      console.log(`任务 ${taskId} 已超时 (${taskAgeInMinutes.toFixed(2)}分钟)`);
      
      return res.json({
        success: false, 
        status: 'TIMEOUT',
        message: '任务处理超时，请重试或联系客服'
      });
    }
    
    // 检查缓存中是否有结果
    const cachedResult = imageCache.get(taskId);
    if (cachedResult && cachedResult.expiresAt > new Date()) {
      console.log(`从缓存中获取任务 ${taskId} 的结果`);
      return res.json({
        success: true, 
        status: 'SUCCEEDED',
        resultUrl: cachedResult.url,
        cached: true
      });
    }
    
    // 缓存中没有结果，调用通义万相API查询任务状态
    try {
      const statusResponse = await limitConcurrency(queryTaskStatus, taskId);
      
      // 获取任务状态
      const taskStatus = statusResponse.data.output?.task_status;
      
      if (taskStatus === 'SUCCEEDED') {
      // 任务成功完成，获取结果URL
        let resultUrl = getResultUrl(statusResponse);
        
        if (resultUrl) {
          // 将结果URL缓存起来
          imageCache.set(taskId, {
            url: resultUrl,
            timestamp: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时过期
          });
          
          // 更新数据库中的任务状态为成功
          try {
            const { saveTaskDetails } = require('../middleware/unifiedFeatureUsage');
            // 获取任务信息
            const task = global.imageExpansionTasks?.[taskId];
            if (task) {
            await saveTaskDetails(req.featureUsage.usage, {
              taskId: taskId,
              creditCost: task.creditCost || 0,
              isFree: task.isFree || false,
              status: 'completed', // 标记为已完成
              extraData: {
                status: 'SUCCEEDED',
                resultUrl: resultUrl,
                completedAt: new Date().toISOString()
              }
            });
              console.log(`智能扩图任务ID=${taskId}已通过统一中间件更新为完成状态`);
            }
          } catch (dbError) {
            console.error('更新智能扩图任务状态失败:', dbError);
            // 继续处理，不影响用户使用
          }
          
          // 保存历史记录到OSS
          try {
            const task = global.imageExpansionTasks?.[taskId];
            if (task) {
              // 准备历史记录数据
              const historyData = {
                originalImage: task.imageUrl,
                resultImage: resultUrl,
                prompt: task.prompt,
                leftScale: task.leftScale || 0.5,
                rightScale: task.rightScale || 0.5,
                topScale: task.topScale || 0.5,
                bottomScale: task.bottomScale || 0.5,
                metadata: {
                  taskId: taskId,
                  timestamp: new Date().toISOString(),
                  feature: 'image-expansion',
                  creditCost: task.creditCost,
                  isFree: task.isFree
                }
              };
              
              // 调用历史记录保存API
              const axios = require('axios');
              const authToken = `Bearer ${process.env.JWT_SECRET || 'default-secret'}`;
              
              // 构造内部API调用
              const saveHistoryUrl = `http://localhost:${process.env.PORT || 8080}/api/image-expansion-history/save`;
              
              // 模拟认证用户请求
              const mockReq = {
                user: { id: task.userId },
                body: historyData
              };
              
              // 直接调用历史记录保存函数
              const imageExpansionHistoryRoute = require('./image-expansion-history');
              console.log(`✅ 智能扩图任务 ${taskId} 完成，准备保存历史记录到OSS`);
              
              // 由于我们在同一个服务器内部，直接调用保存函数会更可靠
              // 这里我们使用异步方式，不阻塞主响应
              setTimeout(async () => {
                try {
                  // 直接导入并调用OSS保存函数
                  const { client } = require('../utils/ossService');
                  
                  // 生成唯一ID
                  const historyId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
                  
                  // 创建历史记录对象
                  const historyRecord = {
                    id: historyId,
                    userId: task.userId,
                    originalImage: task.imageUrl,
                    resultImage: resultUrl,
                    prompt: task.prompt,
                    leftScale: task.leftScale || 0.5,
                    rightScale: task.rightScale || 0.5,
                    topScale: task.topScale || 0.5,
                    bottomScale: task.bottomScale || 0.5,
                    metadata: historyData.metadata,
                    timestamp: new Date().toISOString()
                  };
                  
                  // 从OSS加载现有历史记录
                  const ossPath = `image-expansion/history/${task.userId}/records.json`;
                  let existingRecords = [];
                  
                  try {
                    const result = await client.get(ossPath);
                    existingRecords = JSON.parse(result.content.toString());
                    
                    // 过滤掉超过24小时的记录
                    const now = new Date();
                    existingRecords = existingRecords.filter(record => {
                      const recordDate = new Date(record.timestamp);
                      const hoursDiff = (now - recordDate) / (1000 * 60 * 60);
                      return hoursDiff <= 24;
                    });
                  } catch (error) {
                    if (error.code !== 'NoSuchKey') {
                      console.error('加载现有历史记录失败:', error);
                    }
                  }
                  
                  // 添加新记录
                  existingRecords.unshift(historyRecord);
                  
                  // 只保留最新的10条记录
                  const limitedRecords = existingRecords.slice(0, 10);
                  
                  // 保存到OSS
                  const content = JSON.stringify(limitedRecords);
                  await client.put(ossPath, Buffer.from(content), {
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  });
                  
                  console.log(`✅ 智能扩图历史记录已保存到OSS: 用户ID=${task.userId}, 任务ID=${taskId}`);
                } catch (saveError) {
                  console.error('❌ 保存智能扩图历史记录到OSS失败:', saveError);
                }
              }, 1000); // 延迟1秒执行，确保主响应已发送
            }
          } catch (historyError) {
            console.error('❌ 保存智能扩图历史记录失败:', historyError);
            // 不影响主流程，继续返回结果
          }
        }
        
        // 返回结果
        return res.json({
          success: true, 
          status: 'SUCCEEDED',
          resultUrl: resultUrl,
          output: statusResponse.data.output
        });
      } else if (taskStatus === 'FAILED') {
        // 任务失败，执行退款并更新任务状态
        try {
          const refundManager = require('../utils/refundManager');
          await refundManager.refundImageExpansionCredits(req.user.id, taskId, `API任务失败: ${statusResponse.data.output?.message || '未知原因'}`);
          console.log(`已为失败的任务ID=${taskId}执行退款处理`);
          
          // 更新数据库中的任务状态
          try {
            const { saveTaskDetails } = require('../middleware/unifiedFeatureUsage');
            // 获取任务信息
            const task = global.imageExpansionTasks?.[taskId];
            if (task) {
            await saveTaskDetails(req.featureUsage.usage, {
              taskId: taskId,
              creditCost: task.creditCost || 0,
              isFree: task.isFree || false,
              status: 'cancelled', // 标记为已取消
              extraData: {
                status: 'FAILED',
                failReason: statusResponse.data.output?.message || '任务处理失败',
                failedAt: new Date().toISOString()
              }
            });
              console.log(`智能扩图任务ID=${taskId}已通过统一中间件更新为失败状态`);
            }
          } catch (dbError) {
            console.error('更新智能扩图任务状态失败:', dbError);
          }
        } catch (refundError) {
          console.error('失败任务退款失败:', refundError);
        }
        
        return res.json({
          success: false, 
          status: 'FAILED',
          message: statusResponse.data.output?.message || '任务处理失败',
          output: statusResponse.data.output
        });
      } else {
        // 任务仍在处理中
        return res.json({
          success: true, 
          status: taskStatus || 'PENDING',
          message: '任务处理中',
          output: statusResponse.data.output
        });
      }
    } catch (error) {
      console.error(`查询任务 ${taskId} 状态失败:`, error);
      return res.status(500).json({
        success: false, 
        message: '查询任务状态失败: ' + error.message
      });
    }
  } catch (error) {
    console.error('查询任务状态失败:', error);
    
    // 记录异常详情
    console.error('状态查询异常详情:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      taskId: req.params.taskId,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : null
    });
    
    // 根据错误类型返回不同的错误信息
    let errorMessage = '查询任务状态失败';
    let errorCode = 'QUERY_ERROR';
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorMessage = '查询超时，请稍后重试';
      errorCode = 'TIMEOUT_ERROR';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = '无法连接到服务器，请稍后重试';
      errorCode = 'CONNECTION_ERROR';
    } else if (error.message.includes('socket hang up')) {
      errorMessage = '网络连接中断，请稍后重试';
      errorCode = 'NETWORK_ERROR';
    }
    
    return res.status(500).json({
      success: false, 
      message: errorMessage,
      errorDetail: error.message,
      errorCode: errorCode
    });
  }
});

module.exports = router;
