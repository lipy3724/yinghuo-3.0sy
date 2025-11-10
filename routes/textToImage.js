const express = require('express');
const axios = require('axios');
const logger = require('../utils/logger');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { createUnifiedFeatureMiddleware, saveTaskDetails } = require('../middleware/unifiedFeatureUsage');
const { uploadToOSS } = require('../api-utils');
const ImageHistory = require('../models/ImageHistory');
const { saveTextToImageHistory } = require('../services/textToImageHistoryOSS');

// 通义万相API密钥
const API_KEY = process.env.DASHSCOPE_API_KEY || 'sk-a53c9eb917ce49558997c6bc0edac820';
const API_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';
const API_TASK_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks/';

/**
 * @route   POST /api/text-to-image/generate
 * @desc    生成文生图片 - 创建任务
 * @access  私有
 */
router.post('/generate', protect, createUnifiedFeatureMiddleware('TEXT_TO_IMAGE'), async (req, res) => {
  try {
    const { prompt, negativePrompt = '', size = '1024*1024', n = 1, prompt_extend = true, watermark = false } = req.body;
    const userId = req.user.id;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: '提示词不能为空'
      });
    }

    // 准备请求参数 - 使用V2版API
    const requestData = {
      model: "wanx2.1-t2i-turbo", // 升级到V2模型
      input: {
        prompt: prompt,
        negative_prompt: negativePrompt
      },
      parameters: {
        size: size.replace('x', '*'), // 确保使用*而不是x作为分隔符
        n: parseInt(n),
        prompt_extend: prompt_extend,
        watermark: watermark
      }
    };

    console.log('准备发送到通义万相的数据:', JSON.stringify(requestData, null, 2));

    // 准备请求头 - 添加异步任务头
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'X-DashScope-Async': 'enable' // 启用异步任务处理
    };

    // 调用通义万相API创建任务
    const response = await axios.post(API_BASE_URL, requestData, { headers });

    console.log('通义万相API创建任务响应:', response.status, JSON.stringify(response.data, null, 2));

    // 检查是否成功创建任务
    if (response.data && response.data.output && response.data.output.task_id) {
      const taskId = response.data.output.task_id;
      const taskStatus = response.data.output.task_status;

      // 记录任务信息到全局变量，方便后续查询和积分统计
      // 积分已在统一中间件中扣除，这里只记录任务信息
      const isFree = req.featureUsage?.isFree || false;
      const creditCost = req.featureUsage?.creditCost || 0;
      
      global.textToImageTasks[taskId] = {
        userId: userId,
        prompt: prompt,
        timestamp: new Date(),
        creditCost: creditCost,
        hasChargedCredits: true, // 积分已在中间件中扣除
        isFree: isFree
      };

      // 🚀 立即将任务详情保存到数据库，确保积分使用页面及时显示
      try {
        if (req.featureUsage && req.featureUsage.usage) {
          await saveTaskDetails(req.featureUsage.usage, {
            taskId: taskId,
            creditCost: creditCost,
            isFree: isFree
          });
          logger.info(`已即时写入文生图任务记录到数据库 taskId=${taskId}`);
        }
      } catch (dbErr) {
        logger.error('即时保存文生图任务详情失败', { error: dbErr.message });
      }

      return res.json({
        success: true,
        message: '图片生成任务已创建',
        taskId: taskId,
        taskStatus: taskStatus,
        requestId: response.data.request_id
      });
    } else {
      return res.status(500).json({
        success: false,
        message: '创建图片生成任务失败',
        error: response.data.message || '未知错误'
      });
    }
  } catch (error) {
    console.error('创建图片生成任务出错:', error);
    
    if (error.response) {
      // 阿里云API错误
      return res.status(error.response.status).json({
        success: false,
        message: '创建图片生成任务失败: ' + (error.response.data.message || error.message),
        error: error.response.data
      });
    }
    
    return res.status(500).json({
      success: false,
      message: '网络出现问题，请稍后重试',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/text-to-image/task/:taskId
 * @desc    查询文生图任务状态和结果
 * @access  私有
 */
router.get('/task/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: '任务ID不能为空'
      });
    }

    // 准备请求头
    const headers = {
      'Authorization': `Bearer ${API_KEY}`
    };

    // 查询任务状态
    const response = await axios.get(`${API_TASK_URL}${taskId}`, { headers });

    console.log('查询任务状态响应:', response.status, JSON.stringify(response.data, null, 2));

    const taskStatus = response.data.output.task_status;

    // 如果任务成功完成
    if (taskStatus === 'SUCCEEDED') {
      // 记录任务完成状态到全局变量
      if (global.textToImageTasks && global.textToImageTasks[taskId]) {
        global.textToImageTasks[taskId].status = 'SUCCEEDED';
        global.textToImageTasks[taskId].completedAt = new Date();
        
        // 查找或创建数据库中的使用记录
        try {
          const { FeatureUsage } = require('../models/FeatureUsage');
          const userId = req.user.id;
          
          // 从全局任务记录中获取prompt
          const prompt = global.textToImageTasks[taskId].prompt || '文生图片';
          
          // 获取功能配置信息
          const { FEATURES } = require('../middleware/featureAccess');
          const creditCost = FEATURES.TEXT_TO_IMAGE.creditCost;
          
          // 查找现有记录
          let usage = await FeatureUsage.findOne({
            where: { userId, featureName: 'TEXT_TO_IMAGE' }
          });
          
          if (usage) {
            // 解析现有任务记录
            let details = {};
            try {
              details = usage.details ? JSON.parse(usage.details) : {};
            } catch (e) {
              details = {};
            }
            
            if (!details.tasks) {
              details.tasks = [];
            }
            
            // 检查任务是否已记录
            const taskExists = details.tasks.some(task => task.taskId === taskId);
            
            if (!taskExists) {
              // 添加新的任务记录（积分已在中间件中扣除）
              const isFree = global.textToImageTasks[taskId].isFree || false;
              const actualCreditCost = global.textToImageTasks[taskId].creditCost || 0;
              
              details.tasks.push({
                taskId: taskId,
                creditCost: actualCreditCost,
                timestamp: new Date(),
                prompt: global.textToImageTasks[taskId].prompt,
                isFree: isFree
              });
              
              // 更新使用记录
              usage.details = JSON.stringify(details);
              usage.lastUsedAt = new Date();
              await usage.save();
              
              console.log(`已更新用户 ${userId} 的文生图片使用记录，添加任务 ${taskId}`);
            }
          } else {
            // 创建新记录
            await FeatureUsage.create({
              userId: userId,
              featureName: 'TEXT_TO_IMAGE',
              usageCount: 1,
              credits: 0, // 设置为0，因为积分已在统一中间件中扣除
              details: JSON.stringify({
                tasks: [{
                  taskId: taskId,
                  creditCost: global.textToImageTasks[taskId].isFree ? 0 : creditCost,
                  timestamp: new Date(),
                  prompt: global.textToImageTasks[taskId].prompt,
                  isFree: global.textToImageTasks[taskId].isFree || false
                }]
              }),
              lastUsedAt: new Date()
            });
            
            console.log(`已为用户 ${userId} 创建文生图片使用记录，任务 ${taskId}`);
          }
        } catch (dbError) {
          console.error('保存文生图片使用记录失败:', dbError);
          // 继续处理，不影响用户使用
        }
      }
      
      // 根据文档返回格式处理结果
      if (response.data.output.results && response.data.output.results.length > 0) {
        // 获取图片URL列表 - 每个result对象中的url属性包含图片URL
        const imageUrls = response.data.output.results.map(result => result.url);
        
        // 注意：完全停止自动保存到下载中心和ImageHistory表
        // 文生图片现在只保存在内存中的textToImageTasks对象和前端历史记录中
        // 用户如需长期保存，必须手动点击"保存到下载中心"按钮
        console.log(`文生图片生成成功，用户ID: ${req.user.id}, 任务ID: ${taskId}。结果仅保存在内存中，不会自动写入数据库。`);

        // 注释：移除自动写入ImageHistory表的逻辑
        // 这样可以彻底避免文生图片自动出现在下载中心
        // 只有用户手动点击"保存到下载中心"按钮时，才会调用downloads.js的API将图片保存到ImageHistory表
        
        // 将图片URL和任务信息存储到全局变量，供前端获取
        if (global.textToImageTasks && global.textToImageTasks[taskId]) {
          global.textToImageTasks[taskId].imageUrls = imageUrls;
          global.textToImageTasks[taskId].originalPrompt = response.data.output.results[0].orig_prompt || global.textToImageTasks[taskId].prompt;
          global.textToImageTasks[taskId].actualPrompt = response.data.output.results[0].actual_prompt || global.textToImageTasks[taskId].prompt;
          // 确保不会自动保存到下载中心
          global.textToImageTasks[taskId].autoSaved = false;
          
          // 自动保存到OSS历史记录（每张图片单独保存）
          console.log(`[文生图片] 开始自动保存到OSS历史记录，任务ID: ${taskId}, 图片数量: ${imageUrls.length}`);
          
          // 等待所有OSS保存操作完成再返回响应，确保前端能立即获取到历史记录
          const savePromises = imageUrls.map(async (imageUrl, index) => {
            try {
              const recordData = {
                userId: req.user.id,
                prompt: global.textToImageTasks[taskId].actualPrompt || global.textToImageTasks[taskId].prompt,
                negativePrompt: global.textToImageTasks[taskId].negativePrompt || '',
                size: global.textToImageTasks[taskId].size || '1024*1024',
                imageUrl: imageUrl,
                parameters: {
                  n: global.textToImageTasks[taskId].n || 1,
                  prompt_extend: global.textToImageTasks[taskId].prompt_extend,
                  watermark: global.textToImageTasks[taskId].watermark,
                  model: global.textToImageTasks[taskId].model || 'wanx2.1-t2i-turbo',
                  taskId: taskId,
                  imageIndex: index
                },
                model: global.textToImageTasks[taskId].model || 'wanx2.1-t2i-turbo'
              };
              
              const ossResult = await saveTextToImageHistory(recordData);
              
              if (ossResult.success) {
                console.log(`[文生图片] OSS历史记录保存成功，任务ID: ${taskId}, 图片 ${index + 1}/${imageUrls.length}, 记录ID: ${ossResult.recordId}`);
                
                // 在全局变量中记录OSS信息
                if (!global.textToImageTasks[taskId].ossRecords) {
                  global.textToImageTasks[taskId].ossRecords = [];
                }
                global.textToImageTasks[taskId].ossRecords.push({
                  recordId: ossResult.recordId,
                  imageIndex: index,
                  ossImageUrl: ossResult.urls.generatedImage,
                  metadataUrl: ossResult.urls.metadata
                });
                
                return { success: true, recordId: ossResult.recordId };
              } else {
                console.error(`[文生图片] OSS历史记录保存失败，任务ID: ${taskId}, 图片 ${index + 1}/${imageUrls.length}, 错误: ${ossResult.error}`);
                return { success: false, error: ossResult.error };
              }
            } catch (error) {
              console.error(`[文生图片] OSS历史记录保存异常，任务ID: ${taskId}, 图片 ${index + 1}/${imageUrls.length}:`, error);
              return { success: false, error: error.message };
            }
          });
          
          // 等待所有保存操作完成
          try {
            const saveResults = await Promise.all(savePromises);
            const successCount = saveResults.filter(result => result.success).length;
            console.log(`[文生图片] OSS历史记录保存完成，任务ID: ${taskId}, 成功: ${successCount}/${imageUrls.length}`);
          } catch (error) {
            console.error(`[文生图片] OSS历史记录保存过程中出现错误，任务ID: ${taskId}:`, error);
          }
        }
        
        return res.json({
          success: true,
          message: '图片生成成功',
          taskStatus: taskStatus,
          images: imageUrls,
          originalPrompt: response.data.output.results[0].orig_prompt || prompt,
          actualPrompt: response.data.output.results[0].actual_prompt || prompt,
          requestId: response.data.request_id
        });
      } else {
        // 检查是否有其他可能的结果格式
        console.log('任务成功但没有标准results数组，尝试查找其他结果格式');
        
        let imageUrls = [];
        
        // 检查task_metrics字段
        if (response.data.output.task_metrics) {
          console.log('找到task_metrics:', response.data.output.task_metrics);
        }
        
        // 尝试查找result_url字段
        if (response.data.output.result_url) {
          imageUrls.push(response.data.output.result_url);
        }
        
        // 尝试查找result_urls数组
        if (response.data.output.result_urls && response.data.output.result_urls.length > 0) {
          imageUrls = imageUrls.concat(response.data.output.result_urls);
        }
        
        if (imageUrls.length > 0) {
          return res.json({
            success: true,
            message: '图片生成成功(非标准格式)',
            taskStatus: taskStatus,
            images: imageUrls,
            requestId: response.data.request_id
          });
        }
        
        return res.status(500).json({
          success: false,
          message: '网络出现问题，请稍后重试',
          taskStatus: taskStatus,
          rawResponse: response.data.output
        });
      }
    } 
    // 如果任务失败
    else if (taskStatus === 'FAILED') {
      // 更新全局变量中的任务状态
      if (global.textToImageTasks && global.textToImageTasks[taskId]) {
        global.textToImageTasks[taskId].status = 'FAILED';
        global.textToImageTasks[taskId].errorMessage = response.data.output.message || '未知错误';
        global.textToImageTasks[taskId].completedAt = new Date();
      }
      
      return res.status(500).json({
        success: false,
        message: '网络出现问题，请稍后重试',
        taskStatus: taskStatus,
        error: response.data.output.message || '未知错误'
      });
    } 
    // 如果任务仍在处理中
    else {
      return res.json({
        success: true,
        message: '图片生成任务正在处理中',
        taskStatus: taskStatus,
        requestId: response.data.request_id
      });
    }
  } catch (error) {
    console.error('查询图片生成任务出错:', error);
    
    if (error.response) {
      // 阿里云API错误
      return res.status(error.response.status).json({
        success: false,
        message: '查询图片生成任务失败: ' + (error.response.data.message || error.message),
        error: error.response.data
      });
    }
    
    return res.status(500).json({
      success: false,
      message: '网络出现问题，请稍后重试',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/text-to-image/clear-history
 * @desc    清空文生图片历史记录
 * @access  私有
 */
router.post('/clear-history', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 使用ImageHistory模型删除用户的所有文生图片历史记录
    const ImageHistory = require('../models/ImageHistory');
    
    // 使用原生SQL查询，避免可能的模型定义问题
    const sequelize = require('../config/db');
    const result = await sequelize.query(
      'DELETE FROM image_histories WHERE userId = ? AND (type = ? OR type = ?)',
      {
        replacements: [userId, 'TEXT_TO_IMAGE', 'TEXT_TO_IMAGE_HISTORY'],
        type: sequelize.QueryTypes.DELETE
      }
    );
    
    console.log(`用户 ${userId} 清空了文生图片历史记录，删除了 ${result} 条记录`);
    
    res.json({
      success: true,
      message: '历史记录已清空',
      deletedCount: result
    });
    
  } catch (error) {
    console.error('清空文生图片历史记录出错:', error);
    res.status(500).json({
      success: false,
      message: '清空历史记录失败',
      error: error.message
    });
  }
});

// 下载代理路由, 避免 CORS 跨域问题
router.get('/download', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('缺少 url 参数');
  try {
    const response = await axios.get(url, { responseType: 'stream' });
    res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.data.pipe(res);
  } catch (e) {
    console.error('[text-to-image-proxy-download] 失败:', e.message);
    res.status(500).send('文件下载失败');
  }
});


module.exports = router; 