const express = require('express');
const axios = require('axios');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { FEATURES } = require('../middleware/featureAccess');
const { createUnifiedFeatureMiddleware } = require('../middleware/unifiedFeatureUsage');
const User = require('../models/User');
const { FeatureUsage } = require('../models/FeatureUsage');
const { refundGlobalStyleCredits } = require('../utils/refundManager');
const { saveHistoryToOSS } = require('./global-style-history');

// 通义万相API密钥
const API_KEY = process.env.DASHSCOPE_API_KEY;
// 全局风格化API基础URL
const API_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis';

/**
 * @route   POST /api/global-style/create-task
 * @desc    创建全局风格化任务
 * @access  私有
 */
router.post('/create-task', protect, createUnifiedFeatureMiddleware('GLOBAL_STYLE'), async (req, res) => {
  try {
    const { imageUrl, prompt, strength } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        code: "InvalidParameter",
        message: "缺少必要参数: imageUrl",
        request_id: `req_${Date.now()}`
      });
    }
    
    if (!prompt) {
      return res.status(400).json({
        code: "InvalidParameter",
        message: "缺少必要参数: prompt",
        request_id: `req_${Date.now()}`
      });
    }
    
    // 检查strength参数是否有效，如果无效使用默认值0.5
    const strengthValue = typeof strength === 'number' && strength >= 0 && strength <= 1 
      ? strength 
      : 0.5;
    
    // 检查prompt内容，确保不含有可能导致JSON解析错误的特殊字符
    const sanitizedPrompt = sanitizeJsonString(prompt);
    
    console.log(`创建全局风格化任务: ${sanitizedPrompt}, 强度: ${strengthValue}`);
    
    // 构建请求数据
    const requestData = {
      "model": "wanx2.1-imageedit",
      "input": {
        "function": "stylization_all", // 全局风格化的function参数
        "prompt": sanitizedPrompt,
        "base_image_url": imageUrl
      },
      "parameters": {
        "n": 1,
        "strength": strengthValue // 添加风格化强度参数
      }
    };
    
    console.log('发送到通义万相的数据:', JSON.stringify(requestData, null, 2));
    
    // 创建任务
    const response = await createTask(requestData);
    
    // 获取当前用户ID和积分消费信息
    const userId = req.user.id;
    const creditCost = req.featureUsage?.creditCost || 0;
    const isFree = req.featureUsage?.isFree || false;
    
    // 获取任务ID
    const taskId = response.data.output?.task_id || `style-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // 保存任务信息到全局变量
    if (!global.globalStyleTasks) {
      global.globalStyleTasks = {};
    }
    
    global.globalStyleTasks[taskId] = {
      userId: userId,
      creditCost: creditCost, // 积分已在中间件中扣除
      hasChargedCredits: true, // 积分已在中间件中扣除
      timestamp: new Date(),
      prompt: sanitizedPrompt,
      strength: strengthValue,
      isFree: isFree, // 添加免费使用标记
      originalUrl: req.body.originalImageUrl || req.body.imageUrl // 保存原始图片URL
    };
    
    console.log(`全局风格化任务信息已保存: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}, 是否免费=${isFree}`);
    
    // 将任务信息保存到数据库
    try {
      // 查找或创建FeatureUsage记录
      const [usage, created] = await FeatureUsage.findOrCreate({
        where: { 
          userId: userId, 
          featureName: 'GLOBAL_STYLE' 
        },
        defaults: {
          usageCount: 0,
          lastUsedAt: new Date(),
          credits: 0,
          details: '{}'
        }
      });
      
      // 解析现有详情
      const details = JSON.parse(usage.details || '{}');
      // 准备任务列表
      const tasks = details.tasks || [];
      // 添加新任务
      tasks.push({
        taskId: taskId,
        creditCost: creditCost, // 积分已在中间件中扣除
        timestamp: new Date(),
        prompt: sanitizedPrompt,
        strength: strengthValue,
        isFree: isFree, // 添加免费使用标记
        originalUrl: req.body.originalImageUrl || req.body.imageUrl // 保存原始图片URL
      });
      
      // 更新usage记录 - 不再重复累加积分
      // 积分已在统一中间件中扣除，这里不需要再次累加
      usage.usageCount += 1;
      usage.lastUsedAt = new Date();
      usage.details = JSON.stringify({
        ...details,
        tasks: tasks
      });
      
      // 保存更新
      await usage.save();
      console.log(`全局风格化任务信息已保存到数据库: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}, 是否免费=${isFree}`);
    } catch (saveError) {
      console.error('保存全局风格化任务详情失败:', saveError);
      // 继续响应，不中断流程
    }
    
    // 确保返回有效的JSON格式
    res.status(response.status || 200).json(response.data);
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * @route   GET /api/global-style/task-status
 * @desc    查询全局风格化任务状态
 * @access  Private
 */
router.get('/task-status', protect, async (req, res) => {
  try {
    const { taskId } = req.query;
    
    if (!taskId || !/^[0-9a-f-]+$/i.test(taskId)) {
      return res.status(400).json({
        code: "InvalidParameter",
        message: '无效的任务ID',
        request_id: `req_${Date.now()}`
      });
    }
    
    console.log(`查询全局风格化任务状态: ${taskId}`);
    
    // 准备请求头
    const headers = {
      'Authorization': `Bearer ${API_KEY}`
    };
    
    // 构建请求URL
    const url = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
    
    try {
      // 增加超时控制
      const timeout = 10000; // 10秒超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        // 发送查询任务状态请求
        const response = await axios.get(url, { 
          headers,
          signal: controller.signal,
          timeout: timeout
        });
        
        clearTimeout(timeoutId);
        console.log(`任务状态查询响应: ${response.status}, 任务状态: ${response.data.output?.task_status || '未知'}`);
        
        // 这里处理响应，提取出需要的图像URL
        const taskStatus = response.data.output?.task_status || 'UNKNOWN';
        
        // 如果任务成功，返回图像URL
        if (taskStatus === 'SUCCEEDED') {
        // 从结果中获取图像URL
        const results = response.data.output?.results || [];
        const imageUrl = results.length > 0 ? results[0]?.url : null;
        
        // 保存结果URL到数据库和OSS
        if (imageUrl) {
          try {
            const userId = req.user.id;
            console.log(`保存全局风格化任务结果: 用户ID=${userId}, 任务ID=${taskId}, 结果URL=${imageUrl}`);
            
            // 查找用户的FeatureUsage记录
            const usage = await FeatureUsage.findOne({
              where: { 
                userId: userId, 
                featureName: 'GLOBAL_STYLE' 
              }
            });
            
            if (usage) {
              // 解析现有详情
              const details = JSON.parse(usage.details || '{}');
              const tasks = details.tasks || [];
              
              // 找到对应的任务并更新resultUrl
              const taskIndex = tasks.findIndex(task => task.taskId === taskId);
              if (taskIndex !== -1) {
                tasks[taskIndex].resultUrl = imageUrl;
                tasks[taskIndex].status = 'SUCCEEDED';
                tasks[taskIndex].completedAt = new Date();
                
                // 更新数据库
                usage.details = JSON.stringify({
                  ...details,
                  tasks: tasks
                });
                await usage.save();
                
                console.log(`全局风格化任务结果已保存到数据库: 任务ID=${taskId}`);
                
                // 保存历史记录到OSS
                try {
                  const { saveHistoryToOSS } = require('./global-style-history');
                  
                  // 获取任务信息
                  const taskInfo = tasks[taskIndex];
                  // 优先从数据库任务信息获取，如果为空则从全局变量获取
                  let originalImage = taskInfo.originalUrl || taskInfo.imageUrl;
                  
                  // 如果数据库中没有原始图片URL，尝试从全局变量获取
                  if (!originalImage && global.globalStyleTasks && global.globalStyleTasks[taskId]) {
                    originalImage = global.globalStyleTasks[taskId].originalUrl;
                    console.log(`从全局变量获取原始图片URL: ${originalImage}`);
                  }
                  
                  if (originalImage) {
                    // 创建历史记录对象
                    const historyRecord = {
                      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                      userId: userId,
                      originalImage: originalImage,
                      resultImage: imageUrl,
                      prompt: taskInfo.prompt || '',
                      strength: taskInfo.strength || 0.8,
                      metadata: {
                        taskId: taskId,
                        timestamp: new Date().toISOString(),
                        feature: 'global-style'
                      },
                      timestamp: new Date().toISOString()
                    };
                    
                    // 保存到OSS
                    await saveHistoryToOSS(userId, historyRecord);
                    console.log(`全局风格化历史记录已保存到OSS: 任务ID=${taskId}`);
                  } else {
                    console.warn(`无法获取原始图片URL，跳过OSS历史记录保存: 任务ID=${taskId}`);
                  }
                } catch (ossError) {
                  console.error('保存历史记录到OSS失败:', ossError);
                  // 继续响应，不中断流程
                }
              } else {
                console.warn(`未找到对应的任务记录: 任务ID=${taskId}`);
              }
            } else {
              console.warn(`未找到用户的FeatureUsage记录: 用户ID=${userId}`);
            }
          } catch (saveError) {
            console.error('保存任务结果到数据库失败:', saveError);
            // 继续响应，不中断流程
          }
        }
        
        return res.status(200).json({
          status: taskStatus,
          imageUrl: imageUrl,
          request_id: response.data.request_id
        });
      }
      
      // 如果任务失败，返回错误信息
      if (taskStatus === 'FAILED') {
        // 获取任务信息并执行退款
        const taskInfo = global.globalStyleTasks[taskId];
        if (taskInfo && taskInfo.userId) {
          try {
            console.log(`全局风格化任务失败，开始执行退款: 用户ID=${taskInfo.userId}, 任务ID=${taskId}`);
            await refundGlobalStyleCredits(taskInfo.userId, taskId, `风格化任务失败: ${response.data.output?.message || '未知错误'}`);
            console.log(`全局风格化任务退款完成: 任务ID=${taskId}`);
          } catch (refundError) {
            console.error(`全局风格化任务退款失败: ${refundError.message}`);
          }
        } else {
          console.error(`无法找到任务信息进行退款: 任务ID=${taskId}`);
        }
        
        return res.status(200).json({
          status: taskStatus,
          message: response.data.output?.message || '风格化任务失败',
          code: response.data.output?.code || 'ProcessingFailed',
          request_id: response.data.request_id
        });
      }
      
        // 如果任务仍在处理中，返回当前状态
        return res.status(200).json({
          status: taskStatus,
          request_id: response.data.request_id
        });
      } catch (requestError) {
        clearTimeout(timeoutId);
        if (requestError.name === 'AbortError' || requestError.code === 'ECONNABORTED') {
          console.error(`任务状态查询请求超时 (${timeout}ms)`);
          return res.status(408).json({
            status: 'FAILED',
            code: "RequestTimeout",
            message: '任务状态查询超时，请稍后再试',
            request_id: `req_${Date.now()}`
          });
        }
        throw requestError;
      }
    } catch (error) {
      // 处理API请求错误
      console.error('查询任务状态失败:', error);
      
      if (error.response) {
        return res.status(error.response.status || 500).json({
          status: 'FAILED',
          code: error.response.data.code || "InternalServerError",
          message: error.response.data.message || '查询任务状态失败',
          request_id: error.response.data.request_id || `req_${Date.now()}`
        });
      }
      
      return res.status(500).json({
        status: 'FAILED',
        code: "InternalServerError",
        message: '查询任务状态失败: ' + error.message,
        request_id: `req_${Date.now()}`
      });
    }
  } catch (error) {
    console.error('查询任务状态路由错误:', error);
    
    return res.status(500).json({
      status: 'FAILED',
      code: "InternalServerError",
      message: '查询任务状态失败: ' + error.message,
      request_id: `req_${Date.now()}`
    });
  }
});

/**
 * 创建全局风格化任务
 * @param {Object} requestData 请求数据
 * @returns {Promise<Object>} API响应结果
 */
async function createTask(requestData) {
  try {
    console.log('准备发送到通义万相的数据:', JSON.stringify(requestData, null, 2));
    
    // 准备请求头
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'X-DashScope-Async': 'enable' // 启用异步模式
    };
    
    // 增加超时控制
    const timeout = 20000; // 20秒超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      // 发送创建任务请求
      const response = await axios.post(API_BASE_URL, requestData, { 
        headers,
        signal: controller.signal,
        timeout: timeout
      });
      
      clearTimeout(timeoutId);
      console.log('通义万相API响应:', response.status, JSON.stringify(response.data, null, 2));
      
      // 检查响应是否包含错误信息
      if (response.data.output?.task_status === 'FAILED') {
        console.error('任务创建失败:', response.data.output);
        throw new Error(response.data.output.message || '任务创建失败');
      }
      
      return { status: response.status, data: response.data };
    } catch (requestError) {
      clearTimeout(timeoutId);
      if (requestError.name === 'AbortError' || requestError.code === 'ECONNABORTED') {
        console.error(`任务创建请求超时 (${timeout}ms)`);
        throw new Error('任务创建请求超时，请稍后再试');
      }
      throw requestError;
    }
  } catch (error) {
    console.error('创建任务失败:', error);
    if (error.response) {
      console.error('API错误响应:', error.response.status, error.response.data);
    }
    throw error;
  }
}

/**
 * 处理API错误
 * @param {Error} error 错误对象
 * @param {Object} res 响应对象
 */
function handleApiError(error, res) {
  console.error('API调用失败:', error);
  
  if (error.response) {
    console.error('API错误响应:', error.response.status);
    
    try {
      console.error('错误详情:', JSON.stringify(error.response.data, null, 2));
      
      // 确保错误消息是安全的JSON字符串
      let errorMessage = error.response.data.message || '调用阿里云API失败';
      if (typeof errorMessage === 'string') {
        errorMessage = sanitizeJsonString(errorMessage);
      }
      
      // 返回阿里云原始错误响应
      return res.status(error.response.status).json({
        code: error.response.data.code || "ApiCallError",
        message: errorMessage,
        request_id: error.response.data.request_id || `req_${Date.now()}`
      });
    } catch (jsonError) {
      console.error('解析错误响应失败:', jsonError);
      return res.status(500).json({
        code: "InternalServerError",
        message: '处理API响应失败，请稍后再试',
        request_id: `req_${Date.now()}`
      });
    }
  }
  
  // 返回一般错误响应
  return res.status(500).json({
    code: "InternalServerError",
    message: 'API调用失败: ' + sanitizeJsonString(error.message),
    request_id: `req_${Date.now()}`
  });
}

/**
 * @route   GET /api/global-style/history
 * @desc    获取全局风格化历史记录（从OSS）
 * @access  私有
 */
router.get('/history', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`获取全局风格化历史记录: 用户ID=${userId}`);
    
    // 从OSS获取历史记录
    const { loadHistoryFromOSS } = require('./global-style-history');
    const records = await loadHistoryFromOSS(userId);
    
    // 按时间降序排序
    const sortedRecords = records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    console.log(`找到 ${sortedRecords.length} 条全局风格化历史记录`);
    
    res.json({
      success: true,
      results: sortedRecords,
      count: sortedRecords.length
    });
  } catch (error) {
    console.error('获取全局风格化历史记录失败:', error);
    res.status(500).json({
      success: false,
      error: '获取历史记录失败',
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/global-style/history
 * @desc    清空全局风格化历史记录（从OSS）
 * @access  私有
 */
router.delete('/history', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`清空全局风格化历史记录: 用户ID=${userId}`);
    
    // 清空OSS中的历史记录
    const { clearHistoryFromOSS } = require('./global-style-history');
    await clearHistoryFromOSS(userId);
    
    console.log(`全局风格化历史记录已清空: 用户ID=${userId}`);
    
    res.json({
      success: true,
      message: '历史记录已清空'
    });
  } catch (error) {
    console.error('清空全局风格化历史记录失败:', error);
    res.status(500).json({
      success: false,
      error: '清空历史记录失败',
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/global-style/history/:taskId
 * @desc    删除单个全局风格化历史记录
 * @access  私有
 */
router.delete('/history/:taskId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.taskId;
    console.log(`删除单个全局风格化历史记录: 用户ID=${userId}, 任务ID=${taskId}`);
    
    // 从OSS删除历史记录
    const { deleteHistoryFromOSS } = require('./global-style-history');
    const success = await deleteHistoryFromOSS(userId, taskId);
    
    if (success) {
      console.log(`单个全局风格化历史记录已删除: 任务ID=${taskId}`);
      res.json({
        success: true,
        message: '历史记录已删除'
      });
    } else {
      res.status(404).json({
        success: false,
        message: '历史记录不存在'
      });
    }
  } catch (error) {
    console.error('删除单个全局风格化历史记录失败:', error);
    res.status(500).json({
      success: false,
      error: '删除历史记录失败',
      message: error.message
    });
  }
});

/**
 * 处理字符串以确保它可以安全地作为JSON字符串
 * @param {string} str 原始字符串
 * @returns {string} 处理后的安全字符串
 */
function sanitizeJsonString(str) {
  if (typeof str !== 'string') return '';
  
  // 替换可能导致JSON解析错误的特殊字符
  return str.replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/\f/g, '\\f');
}

module.exports = router; 