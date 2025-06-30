const express = require('express');
const axios = require('axios');
const https = require('https');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { FEATURES } = require('../middleware/featureAccess');
const { createUnifiedFeatureMiddleware } = require('../middleware/unifiedFeatureUsage');
const User = require('../models/User');
const { FeatureUsage } = require('../models/FeatureUsage');
const { 
  refundImageExpansionCredits, 
  refundImageSharpeningCredits, 
  refundImageUpscalerCredits, 
  refundImageColorizationCredits,
  refundLocalRedrawCredits,
  refundDiantuCredits
} = require('../utils/refundManager');

// 配置API密钥和基础URL
const API_KEY = process.env.DASHSCOPE_API_KEY;
const API_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis';

// 创建一个 Axios 实例，强制使用 IPv4，避免因服务器不支持 IPv6 导致的 EHOSTUNREACH/ECONNREFUSED 错误
const axiosInstance = axios.create({
  // keepAlive 可以复用连接，family:4 强制解析为 IPv4 地址
  httpsAgent: new https.Agent({ keepAlive: true, family: 4 })
});

/**
 * @route   POST /api/image-edit/create-task
 * @desc    创建图像编辑任务
 * @access  私有
 */
router.post('/create-task', protect, async (req, res) => {
  try {
    const requestData = req.body;
    
    // 获取功能类型，根据功能类型使用不同的功能鉴权
    const functionType = requestData.input?.function;
    
    // 如果是图像上色功能，需要验证IMAGE_COLORIZATION权限
    if (functionType === 'colorization') {
      // 使用统一的功能中间件（正确扣除积分）
      return createUnifiedFeatureMiddleware('IMAGE_COLORIZATION')(req, res, async () => {
        try {
          const response = await createTask(requestData);
          
          // 获取当前用户ID和积分消费信息（积分已在中间件中扣除）
          const userId = req.user.id;
          const creditCost = req.featureUsage?.creditCost || 0;
          const isFree = req.featureUsage?.isFree || false;
          
          // 生成唯一任务ID
          const taskId = response.data.output?.task_id || `colorization-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
          
          // 保存任务信息到全局变量
          if (!global.imageColorizationTasks) {
            global.imageColorizationTasks = {};
          }
          
          global.imageColorizationTasks[taskId] = {
            userId: userId,
            creditCost: creditCost, // 积分已在中间件中扣除
            hasChargedCredits: true, // 积分已在中间件中扣除
            timestamp: new Date(),
            imageUrl: requestData.input?.base_image_url,
            prompt: requestData.input?.prompt,
            isFree: isFree // 添加免费使用标记
          };
          
          console.log(`图像上色任务信息已保存: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}, 是否免费=${isFree}`);
          
          // 将任务信息保存到数据库
          try {
            const usage = await FeatureUsage.findOne({
              where: { 
                userId: userId, 
                featureName: 'IMAGE_COLORIZATION' 
              }
            });
            
            if (usage) {
              // 解析现有详情
              const details = JSON.parse(usage.details || '{}');
              // 准备任务列表
              const tasks = details.tasks || [];
              // 添加新任务
              tasks.push({
                taskId: taskId,
                creditCost: creditCost, // 积分已在中间件中扣除
                timestamp: new Date(),
                isFree: isFree // 添加免费使用标记
              });
              
              // 更新usage记录 - 更新details字段但不重复累加积分
              // 积分已在统一中间件中扣除，这里不需要再次累加
              usage.details = JSON.stringify({
                ...details,
                tasks: tasks
              });
              
              // 保存更新
              await usage.save();
              console.log(`图像上色任务信息已保存到数据库: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}`);
            } else {
              // 创建新记录
              await FeatureUsage.create({
                userId: userId,
                featureName: 'IMAGE_COLORIZATION',
                usageCount: 1,
                credits: 0, // 设置为0，积分已在统一中间件中扣除
                lastUsedAt: new Date(),
                details: JSON.stringify({
                  tasks: [{
                    taskId: taskId,
                    creditCost: creditCost, // 积分已在中间件中扣除
                    timestamp: new Date(),
                    isFree: isFree // 添加免费使用标记
                  }]
                })
              });
              console.log(`图像上色功能首次使用记录创建成功: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}`);
            }
          } catch (saveError) {
            console.error('保存图像上色任务详情失败:', saveError);
            // 继续响应，不中断流程
          }
          
          return res.status(response.status || 200).json(response.data);
        } catch (error) {
          handleApiError(error, res);
        }
      });
    } 
    // 如果是局部重绘功能，需要验证LOCAL_REDRAW权限
    else if (functionType === 'inpainting' || functionType === 'description_edit_with_mask') {
      // 使用统一的功能中间件（正确扣除积分）
      return createUnifiedFeatureMiddleware('LOCAL_REDRAW')(req, res, async () => {
        try {
          const response = await createTask(requestData);
          
          // 获取当前用户ID和积分消费信息
          const userId = req.user.id;
          const creditCost = req.featureUsage?.creditCost || 0;
          
          // 判断是否是免费使用
          const isFree = req.featureUsage?.isFree || false;
          
          // 生成唯一任务ID
          const taskId = response.data.output?.task_id || `redraw-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
          
          // 保存任务信息到全局变量
          if (!global.localRedrawTasks) {
            global.localRedrawTasks = {};
          }
          
          global.localRedrawTasks[taskId] = {
            userId: userId,
            creditCost: creditCost, // 积分已在中间件中扣除
            hasChargedCredits: true, // 积分已在中间件中扣除
            timestamp: new Date(),
            imageUrl: requestData.input?.base_image_url,
            prompt: requestData.input?.prompt,
            isFree: isFree // 添加免费使用标记
          };
          
          console.log(`局部重绘任务信息已保存: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}, 是否免费=${isFree}`);
          
          // 将任务信息保存到数据库
          try {
            const usage = await FeatureUsage.findOne({
              where: { 
                userId: userId, 
                featureName: 'LOCAL_REDRAW' 
              }
            });
            
            if (usage) {
              // 解析现有详情
              const details = JSON.parse(usage.details || '{}');
              // 准备任务列表
              const tasks = details.tasks || [];
              // 添加新任务
              tasks.push({
                taskId: taskId,
                creditCost: creditCost, // 积分已在中间件中扣除
                timestamp: new Date(),
                isFree: isFree // 添加免费使用标记
              });
              
              // 更新usage记录 - 更新details字段但不重复累加积分
              // 积分已在统一中间件中扣除，这里不需要再次累加
              usage.details = JSON.stringify({
                ...details,
                tasks: tasks
              });
              
              // 保存更新
              await usage.save();
              console.log(`局部重绘任务信息已保存到数据库: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}`);
            } else {
              // 创建新记录
              await FeatureUsage.create({
                userId: userId,
                featureName: 'LOCAL_REDRAW',
                usageCount: 1,
                credits: 0, // 设置为0，积分已在统一中间件中扣除
                lastUsedAt: new Date(),
                details: JSON.stringify({
                  tasks: [{
                    taskId: taskId,
                    creditCost: creditCost, // 积分已在中间件中扣除
                    timestamp: new Date(),
                    isFree: isFree // 添加免费使用标记
                  }]
                })
              });
              console.log(`局部重绘功能首次使用记录创建成功: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}`);
            }
          } catch (saveError) {
            console.error('保存局部重绘任务详情失败:', saveError);
            // 继续响应，不中断流程
          }
          
          return res.status(response.status || 200).json(response.data);
        } catch (error) {
          handleApiError(error, res);
        }
      });
    }
    // 如果是智能扩图功能，需要验证IMAGE_EXPANSION权限
    // 检查是否为扩图请求：1) function为expand 或 2) parameters包含top_scale、bottom_scale等扩图参数
    else if (functionType === 'expand' || 
            (functionType === 'description_edit' && 
              (requestData.parameters?.outpainting_direction || 
               requestData.parameters?.outpainting_scale || 
               requestData.parameters?.expand_scales ||
               requestData.parameters?.top_scale ||
               requestData.parameters?.bottom_scale ||
               requestData.parameters?.left_scale ||
               requestData.parameters?.right_scale))) {
      // 使用统一的功能中间件（正确扣除积分）
      return createUnifiedFeatureMiddleware('IMAGE_EXPANSION')(req, res, async () => {
        try {
          const response = await createTask(requestData);
          
          // 获取当前用户ID和积分消费信息
          const userId = req.user.id;
          const creditCost = req.featureUsage?.creditCost || 0;
          
          // 判断是否是免费使用
          const isFree = req.featureUsage?.isFree || false;
          
          // 生成唯一任务ID
          const taskId = response.data.output?.task_id || `expand-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
          
          // 保存任务信息到全局变量
          if (!global.imageExpansionTasks) {
            global.imageExpansionTasks = {};
          }
          
          global.imageExpansionTasks[taskId] = {
            userId: userId,
            creditCost: creditCost, // 积分已在中间件中扣除
            hasChargedCredits: true, // 积分已在中间件中扣除
            timestamp: new Date(),
            imageUrl: requestData.input?.base_image_url,
            prompt: requestData.input?.prompt,
            isFree: isFree // 添加免费使用标记
          };
          
          console.log(`智能扩图任务信息已保存: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}, 是否免费=${isFree}`);
          
          // 将任务信息保存到数据库
          try {
            const usage = await FeatureUsage.findOne({
              where: { 
                userId: userId, 
                featureName: 'IMAGE_EXPANSION' 
              }
            });
            
            if (usage) {
              // 解析现有详情
              const details = JSON.parse(usage.details || '{}');
              // 准备任务列表
              const tasks = details.tasks || [];
              // 添加新任务
              tasks.push({
                taskId: taskId,
                creditCost: creditCost, // 积分已在中间件中扣除
                timestamp: new Date(),
                isFree: isFree // 添加免费使用标记
              });
              
              // 更新usage记录 - 更新details字段但不重复累加积分
              // 积分已在统一中间件中扣除，这里不需要再次累加
              usage.details = JSON.stringify({
                ...details,
                tasks: tasks
              });
              
              // 保存更新
              await usage.save();
              console.log(`智能扩图任务信息已保存到数据库: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}`);
            } else {
              // 如果记录不存在，创建新记录
              await FeatureUsage.create({
                userId: userId,
                featureName: 'IMAGE_EXPANSION',
                usageCount: 1,
                lastUsedAt: new Date(),
                credits: 0, // 设置为0，积分已在统一中间件中扣除
                details: JSON.stringify({
                  tasks: [{
                    taskId: taskId,
                    creditCost: creditCost, // 积分已在中间件中扣除
                    timestamp: new Date(),
                    isFree: isFree // 添加免费使用标记
                  }]
                })
              });
              console.log(`智能扩图功能首次使用记录创建成功: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}`);
            }
          } catch (saveError) {
            console.error('保存智能扩图任务详情失败:', saveError);
            // 继续响应，不中断流程
          }
          
          return res.status(response.status || 200).json(response.data);
        } catch (error) {
          handleApiError(error, res);
        }
      });
    }
    // 如果是模糊图片变清晰功能，需要验证IMAGE_SHARPENING权限
    else if (functionType === 'super_resolution') {
      // 使用统一的功能中间件（正确扣除积分）
      return createUnifiedFeatureMiddleware('IMAGE_SHARPENING')(req, res, async () => {
        try {
          const response = await createTask(requestData);
          
          // 获取当前用户ID和积分消费信息
          const userId = req.user.id;
          const creditCost = req.featureUsage?.creditCost || 0;
          
          // 判断是否是免费使用
          const isFree = req.featureUsage?.isFree || false;
          
          // 生成唯一任务ID
          const taskId = response.data.output?.task_id || `sharpen-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
          
          // 保存任务信息到全局变量
          if (!global.imageSharpeningTasks) {
            global.imageSharpeningTasks = {};
          }
          
          global.imageSharpeningTasks[taskId] = {
            userId: userId,
            creditCost: creditCost, // 积分已在中间件中扣除
            hasChargedCredits: true, // 积分已在中间件中扣除
            timestamp: new Date(),
            imageUrl: requestData.input?.base_image_url,
            prompt: requestData.input?.prompt,
            isFree: isFree // 添加免费使用标记
          };
          
          console.log(`图像锐化任务信息已保存: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}, 是否免费=${isFree}`);
          
          // 将任务信息保存到数据库
          try {
            const usage = await FeatureUsage.findOne({
              where: { 
                userId: userId, 
                featureName: 'IMAGE_SHARPENING' 
              }
            });
            
            if (usage) {
              // 解析现有详情
              const details = JSON.parse(usage.details || '{}');
              // 准备任务列表
              const tasks = details.tasks || [];
              // 添加新任务
              tasks.push({
                taskId: taskId,
                creditCost: creditCost, // 积分已在中间件中扣除
                timestamp: new Date(),
                isFree: isFree // 添加免费使用标记
              });
              
              // 更新usage记录 - 更新details字段但不重复累加积分
              // 积分已在统一中间件中扣除，这里不需要再次累加
              usage.details = JSON.stringify({
                ...details,
                tasks: tasks
              });
              
              // 保存更新
              await usage.save();
              console.log(`图像锐化任务信息已保存到数据库: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}`);
            } else {
              // 如果记录不存在，创建新记录
              await FeatureUsage.create({
                userId: userId,
                featureName: 'IMAGE_SHARPENING',
                usageCount: 1,
                lastUsedAt: new Date(),
                credits: 0, // 设置为0，积分已在统一中间件中扣除
                details: JSON.stringify({
                  tasks: [{
                    taskId: taskId,
                    creditCost: creditCost, // 积分已在中间件中扣除
                    timestamp: new Date(),
                    isFree: isFree // 添加免费使用标记
                  }]
                })
              });
              console.log(`图像锐化功能首次使用记录创建成功: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}`);
            }
          } catch (saveError) {
            console.error('保存图像锐化任务详情失败:', saveError);
            // 继续响应，不中断流程
          }
          
          return res.status(response.status || 200).json(response.data);
        } catch (error) {
          handleApiError(error, res);
        }
      });
    }
    // 如果是垫图功能，需要验证DIANTU权限
    else if (functionType === 'control_cartoon_feature') {
      // 使用统一的功能中间件（正确扣除积分）
      return createUnifiedFeatureMiddleware('DIANTU')(req, res, async () => {
        try {
          const response = await createTask(requestData);
          
          // 获取当前用户ID和积分消费信息
          const userId = req.user.id;
          const creditCost = req.featureUsage?.creditCost || FEATURES['DIANTU']?.creditCost || 5;
          
          // 判断是否是免费使用
          const isFree = req.featureUsage?.isFree || false;
          
          // 生成唯一任务ID
          const taskId = response.data.output?.task_id || `diantu-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
          
          // 保存任务信息到全局变量
          if (!global.diantuTasks) {
            global.diantuTasks = {};
          }
          
          global.diantuTasks[taskId] = {
            userId: userId,
            creditCost: creditCost, // 积分已在中间件中扣除
            hasChargedCredits: true, // 积分已在中间件中扣除
            timestamp: new Date(),
            imageUrl: requestData.input?.base_image_url,
            prompt: requestData.input?.prompt,
            isFree: isFree // 添加免费使用标记
          };
          
          console.log(`垫图任务信息已保存: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}, 是否免费=${isFree}`);
          
          // 将任务信息保存到数据库
          try {
            const usage = await FeatureUsage.findOne({
              where: { 
                userId: userId, 
                featureName: 'DIANTU' 
              }
            });
            
            if (usage) {
              // 解析现有详情
              const details = JSON.parse(usage.details || '{}');
              // 准备任务列表
              const tasks = details.tasks || [];
              // 添加新任务
              tasks.push({
                taskId: taskId,
                creditCost: creditCost, // 积分已在中间件中扣除
                timestamp: new Date(),
                isFree: isFree // 添加免费使用标记
              });
              
              // 更新usage记录 - 更新details字段但不重复累加积分
              // 积分已在统一中间件中扣除，这里不需要再次累加
              usage.details = JSON.stringify({
                ...details,
                tasks: tasks
              });
              
              // 保存更新
              await usage.save();
              console.log(`垫图任务信息已保存到数据库: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}`);
            } else {
              // 如果记录不存在，创建新记录
              await FeatureUsage.create({
                userId: userId,
                featureName: 'DIANTU',
                usageCount: 1,
                lastUsedAt: new Date(),
                credits: 0, // 设置为0，积分已在统一中间件中扣除
                details: JSON.stringify({
                  tasks: [{
                    taskId: taskId,
                    creditCost: creditCost, // 积分已在中间件中扣除
                    timestamp: new Date(),
                    isFree: isFree // 添加免费使用标记
                  }]
                })
              });
              console.log(`垫图功能首次使用记录创建成功: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}`);
            }
          } catch (saveError) {
            console.error('保存垫图任务详情失败:', saveError);
            // 继续响应，不中断流程
          }
          
          return res.status(response.status || 200).json(response.data);
        } catch (error) {
          handleApiError(error, res);
        }
      });
    }
    // 其他功能类型使用默认的IMAGE_EDIT权限
    else {
      return createUnifiedFeatureMiddleware('IMAGE_EDIT')(req, res, async () => {
        try {
          const response = await createTask(requestData);
          
          // 获取当前用户ID和积分消费信息
          const userId = req.user.id;
          const creditCost = req.featureUsage?.creditCost || 0;
          
          // 生成唯一任务ID
          const taskId = response.data.output?.task_id || `edit-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
          
          // 保存任务信息到全局变量
          if (!global.imageEditTasks) {
            global.imageEditTasks = {};
          }
          
          global.imageEditTasks[taskId] = {
            userId: userId,
            creditCost: creditCost,
            hasChargedCredits: true,
            timestamp: new Date(),
            imageUrl: requestData.input?.base_image_url,
            prompt: requestData.input?.prompt,
            function: requestData.input?.function || 'general_edit'
          };
          
          console.log(`指令编辑任务信息已保存: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}`);
          
          // 将任务信息保存到数据库
          try {
            // 查找现有记录
            let usage = await FeatureUsage.findOne({
              where: { 
                userId: userId, 
                featureName: 'IMAGE_EDIT' 
              }
            });
            
            if (usage) {
              // 解析现有详情
              let details = {};
              try {
                details = JSON.parse(usage.details || '{}');
              } catch (parseError) {
                details = {};
              }
              
              // 准备任务列表
              const tasks = details.tasks || [];
              
              // 添加新任务
              tasks.push({
                taskId: taskId,
                creditCost: creditCost,
                timestamp: new Date()
              });
              
              // 更新usage记录 - 更新details字段但不重复累加积分
              // 积分已在统一中间件中扣除，这里不需要再次累加
              usage.details = JSON.stringify({
                ...details,
                tasks: tasks
              });
              
              // 保存更新
              await usage.save();
              console.log(`指令编辑任务信息已保存到数据库: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}`);
            } else {
              // 创建新记录
              await FeatureUsage.create({
                userId: userId,
                featureName: 'IMAGE_EDIT',
                usageCount: 1,
                credits: 0, // 设置为0，积分已在统一中间件中扣除
                lastUsedAt: new Date(),
                details: JSON.stringify({
                  tasks: [{
                    taskId: taskId,
                    creditCost: creditCost,
                    timestamp: new Date()
                  }]
                })
              });
              console.log(`指令编辑功能首次使用记录创建成功: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}`);
            }
          } catch (saveError) {
            console.error('保存指令编辑任务详情失败:', saveError);
            // 继续响应，不中断流程
          }
          
          return res.status(response.status || 200).json(response.data);
        } catch (error) {
          handleApiError(error, res);
        }
      });
    }
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * @route   GET /api/image-edit/task-status/:taskId
 * @desc    查询通义万相图像编辑任务状态
 * @access  Private
 */
router.get('/task-status/:taskId', protect, async (req, res) => {
    try {
        const { taskId } = req.params;
        
        // 检查任务ID是否存在且有效
        if (!taskId || !/^[0-9a-f-]+$/i.test(taskId)) {
            return res.status(400).json({
                code: "InvalidParameter",
                message: '无效的任务ID',
                request_id: `req_${Date.now()}`
            });
        }
        
        console.log(`查询任务状态: ${taskId}`);
        
        // 准备请求头 - 确保与官方文档一致
        const headers = {
            'Authorization': `Bearer ${API_KEY}`
        };
        
        // 构建请求URL - 与官方文档保持一致
        const url = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
        
        console.log(`发送请求: GET ${url}`);
        
        try {
            // 发送查询任务状态请求
            const response = await axiosInstance.get(url, { headers });
            
            console.log(`任务状态查询响应: ${response.status}, 任务状态: ${response.data.output?.task_status || '未知'}`);
            
            // 记录详细响应以便调试
            const responseData = response.data;
            console.log('详细响应数据:', JSON.stringify(responseData, null, 2));
            
            // 如果任务成功完成，更新全局变量中的状态
            if (responseData.output?.task_status === 'SUCCEEDED') {
                // 尝试获取图片URL
                let resultUrl = '';
                let hasValidResult = false;
                
                if (responseData.output.results && responseData.output.results.length > 0) {
                    // 检查是否有有效URL
                    const successResults = responseData.output.results.filter(result => result.url && result.url.trim() !== '');
                    if (successResults.length > 0) {
                        resultUrl = successResults[0].url;
                        hasValidResult = true;
                    }
                } else if (responseData.output.images && responseData.output.images.length > 0) {
                    // 新版API格式
                    const validImages = responseData.output.images.filter(img => img.url && img.url.trim() !== '');
                    if (validImages.length > 0) {
                        resultUrl = validImages[0].url;
                        hasValidResult = true;
                    }
                } else if (responseData.output.result_url) {
                    resultUrl = responseData.output.result_url;
                    hasValidResult = resultUrl && resultUrl.trim() !== '';
                }
                
                // 更新全局变量中的任务状态
                const taskId = responseData.output.task_id;
                
                // 检查是否是图像扩展任务，更新状态
                if (global.imageExpansionTasks && global.imageExpansionTasks[taskId]) {
                    if (hasValidResult) {
                        // 任务成功，有有效结果
                        global.imageExpansionTasks[taskId].status = 'SUCCEEDED';
                        global.imageExpansionTasks[taskId].resultUrl = resultUrl;
                        global.imageExpansionTasks[taskId].completedAt = new Date();
                        console.log(`更新智能扩图任务状态: taskId=${taskId}, status=SUCCEEDED, 有有效结果URL`);
                    } else {
                        // 任务虽然返回成功，但没有有效结果，视为失败，触发退款
                        global.imageExpansionTasks[taskId].status = 'FAILED';
                        global.imageExpansionTasks[taskId].errorMessage = '任务成功但没有有效结果';
                        global.imageExpansionTasks[taskId].completedAt = new Date();
                        console.log(`更新智能扩图任务状态: taskId=${taskId}, status=FAILED, 原因=任务成功但没有有效结果`);
                        
                        // 自动触发退款
                        try {
                            const taskInfo = global.imageExpansionTasks[taskId];
                            console.log(`智能扩图任务没有有效结果，开始执行退款: 用户ID=${taskInfo.userId}, 任务ID=${taskId}`);
                            await refundImageExpansionCredits(taskInfo.userId, taskId, '任务成功但没有有效结果');
                            console.log(`智能扩图任务退款成功: 用户ID=${taskInfo.userId}, 任务ID=${taskId}, 原因=任务成功但没有有效结果`);
                        } catch (refundError) {
                            console.error(`智能扩图任务退款失败: ${refundError.message}`);
                        }
                        
                        // 修改responseData的状态以通知前端
                        responseData.output.task_status = 'FAILED';
                        responseData.output.message = '任务成功但没有有效结果';
                    }
                }
                
                // 检查是否是图像锐化任务，更新状态
                if (global.imageSharpeningTasks && global.imageSharpeningTasks[taskId]) {
                    if (hasValidResult) {
                        // 任务成功，有有效结果
                        global.imageSharpeningTasks[taskId].status = 'SUCCEEDED';
                        global.imageSharpeningTasks[taskId].resultUrl = resultUrl;
                        global.imageSharpeningTasks[taskId].completedAt = new Date();
                        console.log(`更新模糊图片变清晰任务状态: taskId=${taskId}, status=SUCCEEDED, 有有效结果URL`);
                    } else {
                        // 任务虽然返回成功，但没有有效结果，视为失败，触发退款
                        global.imageSharpeningTasks[taskId].status = 'FAILED';
                        global.imageSharpeningTasks[taskId].errorMessage = '任务成功但没有有效结果';
                        global.imageSharpeningTasks[taskId].completedAt = new Date();
                        console.log(`更新模糊图片变清晰任务状态: taskId=${taskId}, status=FAILED, 原因=任务成功但没有有效结果`);
                        
                        // 自动触发退款
                        try {
                            const taskInfo = global.imageSharpeningTasks[taskId];
                            console.log(`模糊图片变清晰任务没有有效结果，开始执行退款: 用户ID=${taskInfo.userId}, 任务ID=${taskId}`);
                            await refundImageSharpeningCredits(taskInfo.userId, taskId, '任务成功但没有有效结果');
                            console.log(`模糊图片变清晰任务退款成功: 用户ID=${taskInfo.userId}, 任务ID=${taskId}, 原因=任务成功但没有有效结果`);
                        } catch (refundError) {
                            console.error(`模糊图片变清晰任务退款失败: ${refundError.message}`);
                        }
                        
                        // 修改responseData的状态以通知前端
                        responseData.output.task_status = 'FAILED';
                        responseData.output.message = '任务成功但没有有效结果';
                    }
                }
                
                // 检查是否是指令编辑任务
                if (global.imageEditTasks && global.imageEditTasks[taskId]) {
                    global.imageEditTasks[taskId].status = hasValidResult ? 'SUCCEEDED' : 'FAILED';
                    if (hasValidResult) {
                    global.imageEditTasks[taskId].resultUrl = resultUrl;
                    } else {
                        global.imageEditTasks[taskId].errorMessage = '任务成功但没有有效结果';
                    }
                    global.imageEditTasks[taskId].completedAt = new Date();
                    console.log(`更新指令编辑任务状态: taskId=${taskId}, status=${hasValidResult ? 'SUCCEEDED' : 'FAILED'}`);
                }
            }
            // 如果任务失败，更新全局变量中的状态
            else if (responseData.output?.task_status === 'FAILED') {
                const taskId = responseData.output.task_id;
                const errorMessage = responseData.output.message || '任务执行失败';
                
                // 检查是否是指令编辑任务
                if (global.imageEditTasks && global.imageEditTasks[taskId]) {
                    global.imageEditTasks[taskId].status = 'FAILED';
                    global.imageEditTasks[taskId].errorMessage = errorMessage;
                    global.imageEditTasks[taskId].completedAt = new Date();
                    console.log(`更新指令编辑任务状态: taskId=${taskId}, status=FAILED, error=${errorMessage}`);
                }
                
                // 处理智能扩图任务失败的退款
                if (global.imageExpansionTasks && global.imageExpansionTasks[taskId]) {
                    try {
                        const taskInfo = global.imageExpansionTasks[taskId];
                        console.log(`智能扩图任务失败，开始执行退款: 用户ID=${taskInfo.userId}, 任务ID=${taskId}`);
                        await refundImageExpansionCredits(taskInfo.userId, taskId, `智能扩图任务失败: ${errorMessage}`);
                        console.log(`智能扩图任务退款成功: 用户ID=${taskInfo.userId}, 任务ID=${taskId}`);
                    } catch (refundError) {
                        console.error(`智能扩图任务退款失败: ${refundError.message}`);
                    }
                }
                
                // 处理图像高清放大任务失败的退款
                if (global.imageUpscalerTasks && global.imageUpscalerTasks[taskId]) {
                    try {
                        const taskInfo = global.imageUpscalerTasks[taskId];
                        console.log(`图像高清放大任务失败，开始执行退款: 用户ID=${taskInfo.userId}, 任务ID=${taskId}`);
                        await refundImageUpscalerCredits(taskInfo.userId, taskId, `图像高清放大任务失败: ${errorMessage}`);
                        console.log(`图像高清放大任务退款成功: 用户ID=${taskInfo.userId}, 任务ID=${taskId}`);
                    } catch (refundError) {
                        console.error(`图像高清放大任务退款失败: ${refundError.message}`);
                    }
                }
                
                // 处理图像上色任务失败的退款
                if (global.imageColorizationTasks && global.imageColorizationTasks[taskId]) {
                    try {
                        const taskInfo = global.imageColorizationTasks[taskId];
                        console.log(`图像上色任务失败，开始执行退款: 用户ID=${taskInfo.userId}, 任务ID=${taskId}`);
                        await refundImageColorizationCredits(taskInfo.userId, taskId, `图像上色任务失败: ${errorMessage}`);
                        console.log(`图像上色任务退款成功: 用户ID=${taskInfo.userId}, 任务ID=${taskId}`);
                    } catch (refundError) {
                        console.error(`图像上色任务退款失败: ${refundError.message}`);
                    }
                }
                
                // 处理局部重绘任务失败的退款
                if (global.localRedrawTasks && global.localRedrawTasks[taskId]) {
                    try {
                        const taskInfo = global.localRedrawTasks[taskId];
                        console.log(`局部重绘任务失败，开始执行退款: 用户ID=${taskInfo.userId}, 任务ID=${taskId}`);
                        await refundLocalRedrawCredits(taskInfo.userId, taskId, `局部重绘任务失败: ${errorMessage}`);
                        console.log(`局部重绘任务退款成功: 用户ID=${taskInfo.userId}, 任务ID=${taskId}`);
                    } catch (refundError) {
                        console.error(`局部重绘任务退款失败: ${refundError.message}`);
                    }
                }
                
                // 处理模糊图片变清晰任务失败的退款
                if (global.imageSharpeningTasks && global.imageSharpeningTasks[taskId]) {
                    try {
                        const taskInfo = global.imageSharpeningTasks[taskId];
                        console.log(`模糊图片变清晰任务失败，开始执行退款: 用户ID=${taskInfo.userId}, 任务ID=${taskId}`);
                        await refundImageSharpeningCredits(taskInfo.userId, taskId, `模糊图片变清晰任务失败: ${errorMessage}`);
                        console.log(`模糊图片变清晰任务退款成功: 用户ID=${taskInfo.userId}, 任务ID=${taskId}`);
                    } catch (refundError) {
                        console.error(`模糊图片变清晰任务退款失败: ${refundError.message}`);
                    }
                }
                
                // 处理垫图任务失败的退款
                if (global.diantuTasks && global.diantuTasks[taskId]) {
                    try {
                        const taskInfo = global.diantuTasks[taskId];
                        console.log(`垫图任务失败，开始执行退款: 用户ID=${taskInfo.userId}, 任务ID=${taskId}`);
                        await refundDiantuCredits(taskInfo.userId, taskId, `垫图任务失败: ${errorMessage}`);
                        console.log(`垫图任务退款成功: 用户ID=${taskInfo.userId}, 任务ID=${taskId}`);
                    } catch (refundError) {
                        console.error(`垫图任务退款失败: ${refundError.message}`);
                    }
                }
            }
            
            // 直接返回原始响应，保持与官方文档完全一致的格式
            // 响应中包含:
            // 1. request_id
            // 2. output 对象:
            //    - task_id: 任务ID
            //    - task_status: 任务状态 (PENDING/RUNNING/SUCCEEDED/FAILED/CANCELED/UNKNOWN)
            //    - submit_time/scheduled_time/end_time: 时间信息
            //    - results: 结果数组 [{ url: "..." }] 或包含错误信息的对象
            //    - task_metrics: 任务统计信息 { TOTAL, SUCCEEDED, FAILED }
            //    - 错误时: code 和 message 字段
            // 3. usage 对象: { image_count: 图片数量 }
            return res.status(200).json(responseData);
        } catch (error) {
            // 特殊处理 InvalidParameter: function must in [...] 错误
            // 这是阿里云API的一个常见错误，需要做特殊处理
            if (error.response && 
                error.response.data && 
                error.response.data.code === 'InvalidParameter' && 
                error.response.data.message && 
                error.response.data.message.includes('function must in')) {
                
                console.log('检测到function参数错误，尝试处理...');
                
                // 创建一个模拟的任务失败响应，保持格式与API一致
                return res.status(200).json({
                    request_id: `req_${Date.now()}`,
                    output: {
                        task_id: taskId,
                        task_status: 'FAILED',
                        code: 'UnsupportedFunction',
                        message: '不支持的图像编辑功能类型',
                        task_metrics: {
                            TOTAL: 1,
                            SUCCEEDED: 0,
                            FAILED: 1
                        }
                    }
                });
            }
            
            // 其他错误按原方式处理
            throw error;
        }
    } catch (error) {
        console.error('查询任务状态失败:');
        
        if (error.response) {
            console.error(`状态码: ${error.response.status}`);
            console.error('响应数据:', error.response.data);
            
            // 返回阿里云原始错误响应，确保格式与官方文档一致
            return res.status(error.response.status || 500).json({
                code: error.response.data.code || "InternalServerError",
                message: error.response.data.message || '查询任务状态失败',
                request_id: error.response.data.request_id || `req_${Date.now()}`
            });
        }
        
        // 自定义错误格式，与官方文档保持一致
        return res.status(500).json({
            code: "InternalServerError",
            message: '查询任务状态失败: ' + error.message,
            request_id: `req_${Date.now()}`
        });
    }
});

/**
 * @route   POST /api/refund/image-upscaler
 * @desc    处理图像高清放大功能的退款请求
 * @access  Private
 */
router.post('/refund/image-upscaler', protect, async (req, res) => {
  try {
    const { taskId, reason } = req.body;
    const userId = req.user.id;
    
    if (!taskId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少任务ID参数' 
      });
    }
    
    console.log(`收到图像高清放大退款请求: 用户ID=${userId}, 任务ID=${taskId}, 原因=${reason || '未提供'}`);
    
    // 调用退款函数
    const success = await refundImageUpscalerCredits(userId, taskId, reason || '前端请求退款');
    
    if (success) {
      console.log(`图像高清放大退款成功: 用户ID=${userId}, 任务ID=${taskId}`);
      return res.status(200).json({ 
        success: true, 
        message: '退款处理成功' 
      });
    } else {
      console.log(`图像高清放大退款失败: 用户ID=${userId}, 任务ID=${taskId}`);
      return res.status(400).json({ 
        success: false, 
        message: '退款处理失败，可能是任务不存在或已经退款' 
      });
    }
  } catch (error) {
    console.error('处理退款请求时出错:', error);
    return res.status(500).json({ 
      success: false, 
      message: '服务器处理退款请求时出错: ' + error.message 
    });
  }
});

/**
 * @route   POST /api/refund/image-expansion
 * @desc    处理智能扩图功能的退款请求
 * @access  Private
 */
router.post('/refund/image-expansion', protect, async (req, res) => {
  try {
    const { taskId, reason } = req.body;
    const userId = req.user.id;
    
    if (!taskId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少任务ID参数' 
      });
    }
    
    console.log(`收到智能扩图退款请求: 用户ID=${userId}, 任务ID=${taskId}, 原因=${reason || '未提供'}`);
    
    // 调用退款函数
    const success = await refundImageExpansionCredits(userId, taskId, reason || '前端请求退款');
    
    if (success) {
      console.log(`智能扩图退款成功: 用户ID=${userId}, 任务ID=${taskId}`);
      return res.status(200).json({ 
        success: true, 
        message: '退款处理成功' 
      });
    } else {
      console.log(`智能扩图退款失败: 用户ID=${userId}, 任务ID=${taskId}`);
      return res.status(400).json({ 
        success: false, 
        message: '退款处理失败，可能是任务不存在或已经退款' 
      });
    }
  } catch (error) {
    console.error('处理退款请求时出错:', error);
    return res.status(500).json({ 
      success: false, 
      message: '服务器处理退款请求时出错: ' + error.message 
    });
  }
});

/**
 * @route   POST /api/refund/image-colorization
 * @desc    处理图像上色功能的退款请求
 * @access  Private
 */
router.post('/refund/image-colorization', protect, async (req, res) => {
  try {
    const { taskId, reason } = req.body;
    const userId = req.user.id;
    
    if (!taskId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少任务ID参数' 
      });
    }
    
    console.log(`收到图像上色退款请求: 用户ID=${userId}, 任务ID=${taskId}, 原因=${reason || '未提供'}`);
    
    // 调用退款函数
    const success = await refundImageColorizationCredits(userId, taskId, reason || '前端请求退款');
    
    if (success) {
      console.log(`图像上色退款成功: 用户ID=${userId}, 任务ID=${taskId}`);
      return res.status(200).json({ 
        success: true, 
        message: '退款处理成功' 
      });
    } else {
      console.log(`图像上色退款失败: 用户ID=${userId}, 任务ID=${taskId}`);
      return res.status(400).json({ 
        success: false, 
        message: '退款处理失败，可能是任务不存在或已经退款' 
      });
    }
  } catch (error) {
    console.error('处理退款请求时出错:', error);
    return res.status(500).json({ 
      success: false, 
      message: '服务器处理退款请求时出错: ' + error.message 
    });
  }
});

/**
 * @route   POST /api/refund/local-redraw
 * @desc    处理局部重绘功能的退款请求
 * @access  Private
 */
router.post('/refund/local-redraw', protect, async (req, res) => {
  try {
    const { taskId, reason } = req.body;
    const userId = req.user.id;
    
    if (!taskId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少任务ID参数' 
      });
    }
    
    console.log(`收到局部重绘退款请求: 用户ID=${userId}, 任务ID=${taskId}, 原因=${reason || '未提供'}`);
    
    // 调用退款函数
    const success = await refundLocalRedrawCredits(userId, taskId, reason || '前端请求退款');
    
    if (success) {
      console.log(`局部重绘退款成功: 用户ID=${userId}, 任务ID=${taskId}`);
      return res.status(200).json({ 
        success: true, 
        message: '退款处理成功' 
      });
    } else {
      console.log(`局部重绘退款失败: 用户ID=${userId}, 任务ID=${taskId}`);
      return res.status(400).json({ 
        success: false, 
        message: '退款处理失败，可能是任务不存在或已经退款' 
      });
    }
  } catch (error) {
    console.error('处理退款请求时出错:', error);
    return res.status(500).json({ 
      success: false, 
      message: '服务器处理退款请求时出错: ' + error.message 
    });
  }
});

/**
 * @route   POST /api/refund/image-sharpening
 * @desc    处理模糊图片变清晰功能的退款请求
 * @access  Private
 */
router.post('/refund/image-sharpening', protect, async (req, res) => {
  try {
    const { taskId, reason } = req.body;
    const userId = req.user.id;
    
    if (!taskId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少任务ID参数' 
      });
    }
    
    console.log(`收到模糊图片变清晰退款请求: 用户ID=${userId}, 任务ID=${taskId}, 原因=${reason || '未提供'}`);
    
    // 调用退款函数
    const success = await refundImageSharpeningCredits(userId, taskId, reason || '前端请求退款');
    
    if (success) {
      console.log(`模糊图片变清晰退款成功: 用户ID=${userId}, 任务ID=${taskId}`);
      return res.status(200).json({ 
        success: true, 
        message: '退款处理成功' 
      });
    } else {
      console.log(`模糊图片变清晰退款失败: 用户ID=${userId}, 任务ID=${taskId}`);
      return res.status(400).json({ 
        success: false, 
        message: '退款处理失败，可能是任务不存在或已经退款' 
      });
    }
  } catch (error) {
    console.error('处理退款请求时出错:', error);
    return res.status(500).json({ 
      success: false, 
      message: '服务器处理退款请求时出错: ' + error.message 
    });
  }
});

/**
 * @route   POST /api/refund/diantu
 * @desc    处理垫图功能的退款请求
 * @access  Private
 */
router.post('/refund/diantu', protect, async (req, res) => {
  try {
    const { taskId, reason } = req.body;
    const userId = req.user.id;
    
    if (!taskId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少任务ID参数' 
      });
    }
    
    console.log(`收到垫图退款请求: 用户ID=${userId}, 任务ID=${taskId}, 原因=${reason || '未提供'}`);
    
    // 调用退款函数
    const success = await refundDiantuCredits(userId, taskId, reason || '前端请求退款');
    
    if (success) {
      console.log(`垫图退款成功: 用户ID=${userId}, 任务ID=${taskId}`);
      return res.status(200).json({ 
        success: true, 
        message: '退款处理成功' 
      });
    } else {
      console.log(`垫图退款失败: 用户ID=${userId}, 任务ID=${taskId}`);
      return res.status(400).json({ 
        success: false, 
        message: '退款处理失败，可能是任务不存在或已经退款' 
      });
    }
  } catch (error) {
    console.error('处理退款请求时出错:', error);
    return res.status(500).json({ 
      success: false, 
      message: '服务器处理退款请求时出错: ' + error.message 
    });
  }
});

/**
 * 创建图像编辑任务
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
    
    // 发送创建任务请求
    const response = await axiosInstance.post(API_BASE_URL, requestData, { headers });
    
    console.log('通义万相API响应:', response.status, JSON.stringify(response.data, null, 2));
    
    return { status: response.status, data: response.data };
  } catch (error) {
    console.error('创建任务失败:', error);
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
  
  // 获取当前用户ID和任务ID（如果存在）
  const userId = res.req?.user?.id;
  const taskId = res.req?.body?.taskId || `error-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  const functionType = res.req?.body?.input?.function;
  
  // 如果有用户ID，尝试进行退款处理
  if (userId) {
    try {
      // 根据功能类型选择合适的退款函数
      if (functionType === 'expand') {
        console.log(`智能扩图API调用失败，尝试退款: 用户ID=${userId}, 任务ID=${taskId}`);
        refundImageExpansionCredits(userId, taskId, 'API调用失败').catch(e => 
          console.error(`智能扩图退款失败: ${e.message}`));
      } 
      else if (functionType === 'upscaler') {
        console.log(`图像高清放大API调用失败，尝试退款: 用户ID=${userId}, 任务ID=${taskId}`);
        refundImageUpscalerCredits(userId, taskId, 'API调用失败').catch(e => 
          console.error(`图像高清放大退款失败: ${e.message}`));
      }
      else if (functionType === 'colorization') {
        console.log(`图像上色API调用失败，尝试退款: 用户ID=${userId}, 任务ID=${taskId}`);
        refundImageColorizationCredits(userId, taskId, 'API调用失败').catch(e => 
          console.error(`图像上色退款失败: ${e.message}`));
      }
      else if (functionType === 'inpainting' || functionType === 'description_edit_with_mask') {
        console.log(`局部重绘API调用失败，尝试退款: 用户ID=${userId}, 任务ID=${taskId}`);
        refundLocalRedrawCredits(userId, taskId, 'API调用失败').catch(e => 
          console.error(`局部重绘退款失败: ${e.message}`));
      }
      else if (functionType === 'super_resolution' || functionType === 'sharpening') {
        console.log(`模糊图片变清晰API调用失败，尝试退款: 用户ID=${userId}, 任务ID=${taskId}`);
        refundImageSharpeningCredits(userId, taskId, 'API调用失败').catch(e => 
          console.error(`模糊图片变清晰退款失败: ${e.message}`));
      }
      else if (functionType === 'diantu') {
        console.log(`垫图API调用失败，尝试退款: 用户ID=${userId}, 任务ID=${taskId}`);
        refundDiantuCredits(userId, taskId, 'API调用失败').catch(e => 
          console.error(`垫图退款失败: ${e.message}`));
      }
    } catch (refundError) {
      console.error(`退款处理失败: ${refundError.message}`);
    }
  }
  
  if (error.response) {
    console.error('API错误响应:', error.response.status, JSON.stringify(error.response.data, null, 2));
    
    // 返回阿里云原始错误响应
    return res.status(error.response.status).json({
      code: error.response.data.code || "ApiCallError",
      message: error.response.data.message || '调用阿里云API失败',
      request_id: error.response.data.request_id || `req_${Date.now()}`
    });
  }
  
  // 返回一般错误响应
  return res.status(500).json({
    code: "InternalServerError",
    message: 'API调用失败: ' + error.message,
    request_id: `req_${Date.now()}`
  });
}

module.exports = router; 