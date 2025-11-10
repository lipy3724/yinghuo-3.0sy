/**
 * 通义千问图像编辑API路由
 * 支持多图输入和多图输出的图像编辑功能
 * 使用阿里云百炼平台官方qwen-image-edit-plus模型
 * 参考文档: https://bailian.console.aliyun.com/?tab=doc#/doc/?type=model&url=2977275
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const { createUnifiedFeatureMiddleware } = require('../middleware/unifiedFeatureUsage');
const { uploadToOSS } = require('../api-utils');

// 通义千问API配置
const API_KEY = process.env.DASHSCOPE_API_KEY || process.env.ALIYUN_API_KEY;
// 使用多模态对话API进行图像编辑 - 支持qwen-image-edit-plus模型
const API_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const TASK_API_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks';

// 图像编辑模型配置
const IMAGE_EDIT_MODEL = 'qwen-image-edit-plus'; // 专业图像编辑模型
const FALLBACK_MODEL = 'qwen-vl-max'; // 降级模型（仅提供编辑指导）

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/qwen-image-edit');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB限制
    files: 3 // 最多3个文件
  },
  fileFilter: (req, file, cb) => {
    // 检查文件类型
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('只支持 JPG、PNG、WEBP 格式的图片'));
    }
  }
});

/**
 * @route   POST /api/qwen-image-edit/create
 * @desc    创建通义千问图像编辑任务
 * @access  私有
 */
router.post('/create', protect, upload.array('images', 3), createUnifiedFeatureMiddleware('QWEN_IMAGE_EDIT'), async (req, res) => {
  try {
    const { prompt, negativePrompt = '', n = 1, seed } = req.body;
    const aspectRatio = 'auto'; // 固定使用自动比例
    const userId = req.user.id;
    
    // 增强参数验证逻辑
    // 1. 验证编辑指令
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '编辑指令不能为空，请输入具体的编辑要求'
      });
    }
    
    if (prompt.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: '编辑指令过长，请控制在1000字符以内'
      });
    }
    
    // 2. 验证图片数量（严格按照阿里云API规范：1-3张）
    if (!req.files || req.files.length < 1 || req.files.length > 3) {
      return res.status(400).json({
        success: false,
        message: '图片数量必须在1-3张之间，当前上传了' + (req.files ? req.files.length : 0) + '张图片'
      });
    }
    
    // 3. 验证负面提示词
    if (negativePrompt && negativePrompt.length > 500) {
      return res.status(400).json({
        success: false,
        message: '负面提示词过长，请控制在500字符以内'
      });
    }

    // 4. 验证输出图片数量（n参数）
    const outputCount = parseInt(n);
    console.log('🔍 调试 - 接收到的n参数:', n, '转换后的outputCount:', outputCount);
    if (isNaN(outputCount) || outputCount < 1 || outputCount > 6) {
      return res.status(400).json({
        success: false,
        message: 'qwen-image-edit-plus模型支持生成1-6张图片，当前设置为' + n
      });
    }
    
    // 5. 验证随机数种子（seed参数）
    let seedValue = null;
    if (seed !== undefined && seed !== null && seed !== '') {
      seedValue = parseInt(seed);
      if (isNaN(seedValue) || seedValue < 0 || seedValue > 2147483647) {
        return res.status(400).json({
          success: false,
          message: 'seed参数取值范围应为0到2147483647，当前设置为' + seed
        });
      }
    }
    
    // 6. 验证图片文件完整性
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      
      // 检查文件大小（不能为空，不能超过10MB）
      if (!file.size || file.size === 0) {
        return res.status(400).json({
          success: false,
          message: `第${i + 1}张图片文件损坏或为空`
        });
      }
      
      if (file.size > 10 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: `第${i + 1}张图片文件过大，请控制在10MB以内`
        });
      }
      
      // 检查文件格式
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `第${i + 1}张图片格式不支持，仅支持 JPG、PNG、WEBP 格式`
        });
      }
    }
    
    console.log(`用户${userId}开始创建通义千问图像编辑任务，上传了${req.files.length}张图片`);
    
    // 上传图片到OSS并获取URL
    const imageUrls = [];
    for (const file of req.files) {
      try {
        const fileBuffer = fs.readFileSync(file.path);
        const ossFileName = `qwen-image-edit/${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${path.extname(file.originalname).substring(1)}`;
        const ossUrl = await uploadToOSS(fileBuffer, ossFileName, 'qwen-image-edit');
        imageUrls.push(ossUrl);
        
        // 删除临时文件
        fs.unlinkSync(file.path);
      } catch (uploadError) {
        console.error('上传图片到OSS失败:', uploadError);
        // 清理已上传的临时文件
        req.files.forEach(f => {
          if (fs.existsSync(f.path)) {
            fs.unlinkSync(f.path);
          }
        });
        return res.status(500).json({
          success: false,
          message: '图片上传失败，请重试'
        });
      }
    }
    
    console.log('图片上传成功，OSS URLs:', imageUrls);
    
    // 构建图像编辑API请求数据
    // 优先使用qwen-image-edit-plus模型进行真实图像编辑
    let requestData;
    let useImageEditModel = true;
    
    try {
      // 尝试使用专业图像编辑模型
      requestData = {
        model: IMAGE_EDIT_MODEL,
        input: {
          messages: [
            {
              role: "user",
              content: [
                ...imageUrls.map(url => ({ image: url })), // 支持多图输入
                { text: prompt }
              ]
            }
          ]
        },
        parameters: {
          watermark: false, // 不添加水印
          negative_prompt: negativePrompt || "", // 负面提示词
          n: outputCount, // 生成指定数量的图片（1-6张）
          seed: seedValue, // 随机数种子，控制生成结果的随机性
          result_format: "message"
        }
      };
      
      console.log('🔍 调试 - 发送给API的n参数值:', outputCount);
      
      console.log('使用专业图像编辑模型:', IMAGE_EDIT_MODEL);
    } catch (modelError) {
      console.warn('专业图像编辑模型不可用，降级使用指导模式:', modelError.message);
      useImageEditModel = false;
      
      // 降级使用多模态对话模型提供编辑指导
      requestData = {
        model: FALLBACK_MODEL,
        input: {
          messages: [
            {
              role: "user", 
              content: [
                ...imageUrls.map(url => ({ image: url })), // 使用所有上传的图片
                { 
                  text: `请根据以下要求对图片进行详细的编辑分析和指导：${prompt}${negativePrompt ? `\n注意避免：${negativePrompt}` : ''}\n\n请提供：\n1. 具体的编辑步骤和方法\n2. 推荐的编辑工具和参数设置\n3. 预期效果描述\n4. 注意事项和技巧`
                }
              ]
            }
          ]
        },
        parameters: {
          result_format: "message"
        }
      };
    }
    
    console.log('准备发送到通义千问的数据:', JSON.stringify(requestData, null, 2));
    
    // 调用API进行图像编辑
    const response = await createTask(requestData, useImageEditModel);
    
    // 生成任务ID
    const taskId = `qwen-edit-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // 获取积分消费信息
    const creditCost = req.featureUsage?.creditCost || 0;
    const isFree = req.featureUsage?.usageType === 'free';
    
    // 提取官方响应的完整信息
    const apiResponse = response.data;
    const requestId = apiResponse.requestId;
    const usage = apiResponse.usage || {};
    
    console.log('API请求ID:', requestId);
    console.log('API使用统计:', usage);
    
    // 检查API返回结果
    if (response.data.output && response.data.output.choices) {
      const choice = response.data.output.choices[0];
      
      if (useImageEditModel) {
        // 专业图像编辑模型：使用优化的解析函数
        const messageContent = choice?.message?.content;
        const parseResult = parseApiResponse(messageContent, 'create-task-image-edit');
        let resultImages = parseResult.resultImages;
        let editingInstructions = parseResult.editingInstructions;
        
        // 为生成的图片添加类型标识
        resultImages = resultImages.map(img => ({
          ...img,
          type: 'generated_image'
        }));
        
        if (resultImages.length > 0) {
          // 成功生成了编辑后的图片
          console.log('🔍 调试 - 图像编辑成功，期望生成', outputCount, '张图片，实际生成了', resultImages.length, '张图片');
          console.log('🔍 调试 - 生成的图片详情:', resultImages.map(img => ({ url: img.url, index: img.index })));
          
          // 保存任务信息（已完成状态）
          if (!global.qwenImageEditTasks) {
            global.qwenImageEditTasks = {};
          }
          
          global.qwenImageEditTasks[taskId] = {
            userId: userId,
            creditCost: isFree ? 0 : (resultImages.length * 7), // 按实际生成的图片数量计算积分
            hasChargedCredits: false, // 任务完成时才扣费，这里标记为false，由统一中间件处理
            timestamp: new Date(),
            inputImages: imageUrls,
            resultImages: resultImages,
            editingInstructions: editingInstructions.trim(),
            prompt: prompt,
            negativePrompt: negativePrompt,
            aspectRatio: aspectRatio,
            isFree: isFree,
            status: 'SUCCEEDED',
            taskId: taskId,
            modelUsed: IMAGE_EDIT_MODEL,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            outputCount: resultImages.length, // 记录实际生成的图片数量
            // 添加官方响应信息
            requestId: requestId,
            usage: usage
          };
          
          // 保存任务详情
          try {
            const { saveTaskDetails } = require('../middleware/unifiedFeatureUsage');
            await saveTaskDetails(req.featureUsage.usage, {
              taskId: taskId,
              status: 'completed',
              featureName: 'QWEN_IMAGE_EDIT',
              creditCost: isFree ? 0 : (resultImages.length * 7), // 按实际生成的图片数量计算积分
              isFree: isFree,
              extraData: {
                inputImages: imageUrls,
                resultImages: resultImages,
                editingInstructions: editingInstructions.trim(),
                prompt: prompt,
                negativePrompt: negativePrompt,
                aspectRatio: aspectRatio,
                imageCount: imageUrls.length,
                outputCount: resultImages.length, // 记录实际生成的图片数量
                modelUsed: IMAGE_EDIT_MODEL
              }
            });
            console.log('任务详情已保存到统一记录系统');
          } catch (saveError) {
            console.error('保存任务详情失败:', saveError);
          }
          
          // 返回成功响应（包含编辑后的图片）
          return res.json({
            success: true,
            data: {
              taskId: taskId,
              status: 'SUCCEEDED',
              message: '图像编辑完成',
              inputImages: imageUrls,
              resultImages: resultImages,
              editingInstructions: editingInstructions.trim(),
              prompt: prompt,
              creditCost: isFree ? 0 : creditCost,
              isFree: isFree,
              modelUsed: IMAGE_EDIT_MODEL,
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              note: '使用专业图像编辑模型生成',
              // 添加官方响应信息
              requestId: requestId,
              usage: usage
            }
          });
        }
      }
      
      // 降级模式或未生成图片：使用优化的解析函数处理编辑指导
      const messageContent = choice?.message?.content;
      const parseResult = parseApiResponse(messageContent, 'create-task-fallback');
      const editingInstructions = parseResult.editingInstructions || '';
      
      console.log('返回编辑指导（模型:', useImageEditModel ? IMAGE_EDIT_MODEL : FALLBACK_MODEL, '）:', editingInstructions.substring(0, 200) + '...');
      
      // 保存任务信息到全局变量（已完成状态）
      if (!global.qwenImageEditTasks) {
        global.qwenImageEditTasks = {};
      }
      
      global.qwenImageEditTasks[taskId] = {
        userId: userId,
        creditCost: isFree ? 0 : creditCost,
        hasChargedCredits: !isFree,
        timestamp: new Date(),
        inputImages: imageUrls,
        editingInstructions: editingInstructions,
        prompt: prompt,
        negativePrompt: negativePrompt,
        aspectRatio: aspectRatio,
        isFree: isFree,
        status: 'SUCCEEDED',
        taskId: taskId,
        modelUsed: useImageEditModel ? IMAGE_EDIT_MODEL : FALLBACK_MODEL,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        // 添加官方响应信息
        requestId: requestId,
        usage: usage
      };
      
      // 使用统一中间件的saveTaskDetails函数保存任务详情
      try {
        const { saveTaskDetails } = require('../middleware/unifiedFeatureUsage');
        await saveTaskDetails(req.featureUsage.usage, {
          taskId: taskId,
          status: 'completed',
          featureName: 'QWEN_IMAGE_EDIT',
          creditCost: isFree ? 0 : creditCost,
          isFree: isFree,
          extraData: {
            inputImages: imageUrls,
            editingInstructions: editingInstructions,
            prompt: prompt,
            negativePrompt: negativePrompt,
            aspectRatio: aspectRatio,
            imageCount: imageUrls.length,
            modelUsed: useImageEditModel ? IMAGE_EDIT_MODEL : FALLBACK_MODEL
          }
        });
        console.log('任务详情已保存到统一记录系统');
      } catch (saveError) {
        console.error('保存任务详情失败:', saveError);
      }
      
      // 返回任务完成响应
      return res.json({
        success: true,
        data: {
          taskId: taskId,
          status: 'SUCCEEDED',
          message: useImageEditModel ? '图像编辑分析完成' : '图像编辑指导完成',
          inputImages: imageUrls,
          editingInstructions: editingInstructions,
          prompt: prompt,
          creditCost: isFree ? 0 : creditCost,
          isFree: isFree,
          modelUsed: useImageEditModel ? IMAGE_EDIT_MODEL : FALLBACK_MODEL,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          note: useImageEditModel ? '使用专业图像编辑模型提供指导' : '使用降级模型提供编辑指导建议',
          // 添加官方响应信息
          requestId: requestId,
          usage: usage
        }
      });
    }
    
    // 保存任务信息到全局变量
    if (!global.qwenImageEditTasks) {
      global.qwenImageEditTasks = {};
    }
    
    global.qwenImageEditTasks[taskId] = {
      userId: userId,
      creditCost: isFree ? 0 : creditCost, // 记录积分成本，但创建时不扣费
      hasChargedCredits: false, // 创建时不扣费，任务完成时才扣费
      timestamp: new Date(),
      inputImages: imageUrls,
      prompt: prompt,
      negativePrompt: negativePrompt,
      aspectRatio: aspectRatio,
      isFree: isFree,
      status: 'PENDING',
      taskId: taskId,
      modelUsed: useImageEditModel ? IMAGE_EDIT_MODEL : FALLBACK_MODEL,
      createdAt: new Date().toISOString(),
      outputCount: outputCount // 记录期望生成的图片数量
    };
    
    console.log(`通义千问图像编辑任务信息已保存: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}, 是否免费=${isFree}`);
    
    // 使用统一中间件的saveTaskDetails函数保存任务详情
    try {
      const { saveTaskDetails } = require('../middleware/unifiedFeatureUsage');
      await saveTaskDetails(req.featureUsage.usage, {
        taskId: taskId,
        status: 'pending',
        featureName: 'QWEN_IMAGE_EDIT',
        creditCost: 0, // 创建时不扣费，记录为0
        isFree: isFree,
        extraData: {
          inputImages: imageUrls,
          prompt: prompt,
          negativePrompt: negativePrompt,
          aspectRatio: aspectRatio,
          imageCount: imageUrls.length,
          outputCount: outputCount, // 记录期望生成的图片数量
          plannedCreditCost: isFree ? 0 : creditCost // 记录计划的积分成本
        }
      });
      console.log('任务详情已保存到统一记录系统');
    } catch (saveError) {
      console.error('保存任务详情失败:', saveError);
    }
    
    // 返回成功响应
    res.json({
      success: true,
      data: {
        taskId: taskId,
        status: 'PENDING',
        message: '图像编辑任务已创建，正在处理中...',
        inputImages: imageUrls,
        prompt: prompt,
        creditCost: 0, // 创建时不扣费，显示为0
        plannedCreditCost: isFree ? 0 : creditCost, // 显示计划的积分成本
        isFree: isFree,
        estimatedTime: '30-60秒'
      }
    });
    
  } catch (error) {
    console.error('创建通义千问图像编辑任务失败:', error);
    
    // 清理临时文件
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    
    return res.status(500).json({
      success: false,
      message: '创建任务失败: ' + error.message
    });
  }
});

/**
 * @route   GET /api/qwen-image-edit/status/:taskId
 * @desc    查询通义千问图像编辑任务状态
 * @access  私有
 */
router.get('/status/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    
    // 检查任务是否属于当前用户
    const taskInfo = global.qwenImageEditTasks?.[taskId];
    if (!taskInfo || taskInfo.userId !== userId) {
      return res.status(404).json({
        success: false,
        message: '任务不存在或无权访问'
      });
    }
    
      // 如果任务已完成，直接返回缓存结果
      if (taskInfo.status === 'SUCCEEDED') {
        return res.json({
          success: true,
          data: {
            taskId: taskId,
            status: 'SUCCEEDED',
            editingInstructions: taskInfo.editingInstructions || '',
            inputImages: taskInfo.inputImages,
            resultImages: taskInfo.resultImages || [], // 添加结果图片
            ossResultImages: taskInfo.ossResultImages || [], // 添加OSS结果图片
            prompt: taskInfo.prompt,
            negativePrompt: taskInfo.negativePrompt,
            aspectRatio: taskInfo.aspectRatio,
            creditCost: taskInfo.creditCost,
            isFree: taskInfo.isFree,
            modelUsed: taskInfo.modelUsed,
            completedAt: taskInfo.completedAt,
            createdAt: taskInfo.createdAt,
            note: '专业的图像编辑指导建议'
          }
        });
      }
    
    // 查询API任务状态
    const statusResponse = await getTaskStatus(taskId);
    
    if (statusResponse.data.output) {
      const output = statusResponse.data.output;
      
      if (output.task_status === 'SUCCEEDED') {
        // 任务成功完成 - 优化结果解析
        let resultImages = [];
        let imageIndex = 1;
        
        // 参考Java示例优化结果提取
        if (output.results && Array.isArray(output.results)) {
          // 处理results数组格式
          for (const result of output.results) {
            if (result && typeof result === 'object') {
              const imageUrl = result.url || result.image || result;
              if (imageUrl && typeof imageUrl === 'string') {
                resultImages.push({
                  url: imageUrl,
                  index: imageIndex,
                  type: 'task_result',
                  originalResult: result
                });
                console.log(`输出图像${imageIndex}的URL：${imageUrl}`);
                imageIndex++;
              }
            } else if (typeof result === 'string') {
              // 直接是URL字符串
              resultImages.push({
                url: result,
                index: imageIndex,
                type: 'task_result'
              });
              console.log(`输出图像${imageIndex}的URL：${result}`);
              imageIndex++;
            }
          }
        } else if (output.choices && Array.isArray(output.choices)) {
          // 处理choices格式（类似创建任务时的格式）
          const choice = output.choices[0];
          const messageContent = choice?.message?.content;
          
          if (Array.isArray(messageContent)) {
            for (const content of messageContent) {
              if (content && content.hasOwnProperty('image') && content.image) {
                resultImages.push({
                  url: content.image,
                  index: imageIndex,
                  type: 'choice_result'
                });
                console.log(`输出图像${imageIndex}的URL：${content.image}`);
                imageIndex++;
              }
            }
          }
        }
        
        console.log(`通义千问图像编辑任务完成: ${taskId}, 解析到${resultImages.length}张图片`);
        
        // 🔍 调试：检查解析到的图片URL
        resultImages.forEach((img, index) => {
          console.log(`🔍 调试 - 解析到的图片URL ${index + 1}:`, img.url || img);
          if ((img.url || img).includes('200bject')) {
            console.error('❌ 后端发现错误的URL:', img.url || img);
          }
        });
        
        // 🔥 新增：将结果图片保存到OSS
        const ossResultImages = [];
        for (let i = 0; i < resultImages.length; i++) {
          const resultUrl = resultImages[i].url || resultImages[i];
          if (resultUrl) {
            try {
              console.log(`正在将结果图片 ${i + 1} 保存到OSS: ${resultUrl}`);
              
              // 下载图片
              const axios = require('axios');
              const response = await axios.get(resultUrl, { responseType: 'arraybuffer' });
              const imageBuffer = Buffer.from(response.data);
              
              // 生成OSS存储路径
              const timestamp = Date.now();
              const randomId = Math.random().toString(36).substring(2, 10);
              const ossFileName = `qwen-image-edit/${userId}/results/${taskId}-result-${i + 1}-${timestamp}-${randomId}.jpg`;
              
              // 上传到OSS
              const { uploadToOSS } = require('../utils/ossUtils');
              const ossUrl = await uploadToOSS(imageBuffer, ossFileName);
              
              ossResultImages.push({
                originalUrl: resultUrl,
                ossUrl: ossUrl,
                index: i + 1
              });
              
              console.log(`结果图片 ${i + 1} 已保存到OSS: ${ossUrl}`);
            } catch (ossError) {
              console.error(`保存结果图片 ${i + 1} 到OSS失败:`, ossError);
              // 如果OSS保存失败，保留原始URL
              ossResultImages.push({
                originalUrl: resultUrl,
                ossUrl: resultUrl, // 降级使用原始URL
                index: i + 1,
                ossError: ossError.message
              });
            }
          }
        }
        
        // 更新任务状态
        taskInfo.status = 'SUCCEEDED';
        taskInfo.resultImages = resultImages; // 保留原始结果
        taskInfo.ossResultImages = ossResultImages; // 新增OSS存储结果
        taskInfo.completedAt = new Date().toISOString();
        
        // 调用统一记录系统更新任务状态
        try {
          const { saveTaskDetails } = require('../middleware/unifiedFeatureUsage');
          const { FeatureUsage } = require('../models/FeatureUsage');
          
          const usage = await FeatureUsage.findOne({
            where: { userId: userId, featureName: 'QWEN_IMAGE_EDIT' }
          });
          
          if (usage) {
            await saveTaskDetails(usage, {
              taskId: taskId,
              status: 'completed',
              featureName: 'QWEN_IMAGE_EDIT',
              creditCost: taskInfo.isFree ? 0 : (resultImages.length * 7), // 按实际生成的图片数量计算积分
              isFree: taskInfo.isFree,
              extraData: {
                inputImages: taskInfo.inputImages,
                resultImages: resultImages,
                ossResultImages: ossResultImages, // 包含OSS存储信息
                prompt: taskInfo.prompt,
                negativePrompt: taskInfo.negativePrompt,
                aspectRatio: taskInfo.aspectRatio,
                imageCount: taskInfo.inputImages.length,
                outputCount: resultImages.length // 记录实际生成的图片数量
              }
            });
            console.log('任务完成状态已更新到统一记录系统');
          }
        } catch (updateError) {
          console.error('更新任务完成状态失败:', updateError);
        }
        
        // 🔥 新增：保存历史记录到OSS
        try {
          const { saveQwenImageEditHistoryToOSS } = require('../services/qwenImageEditHistoryOSS');
          
          await saveQwenImageEditHistoryToOSS(userId, {
            taskId: taskId,
            inputImages: taskInfo.inputImages,
            resultImages: resultImages,
            ossResultImages: ossResultImages,
            prompt: taskInfo.prompt,
            negativePrompt: taskInfo.negativePrompt,
            aspectRatio: taskInfo.aspectRatio,
            creditCost: taskInfo.creditCost,
            isFree: taskInfo.isFree,
            completedAt: taskInfo.completedAt
          });
          
          console.log(`图像编辑历史记录已保存到OSS: 任务ID=${taskId}`);
        } catch (historyError) {
          console.error('保存历史记录到OSS失败:', historyError);
          // 不影响主流程，继续执行
        }
        
        return res.json({
          success: true,
          data: {
            taskId: taskId,
            status: 'SUCCEEDED',
            resultImages: resultImages, // 原始API返回的图片URL
            ossResultImages: ossResultImages, // OSS存储的图片信息
            inputImages: taskInfo.inputImages,
            prompt: taskInfo.prompt,
            creditCost: taskInfo.creditCost,
            isFree: taskInfo.isFree,
            completedAt: taskInfo.completedAt
          }
        });
        
      } else if (output.task_status === 'FAILED') {
        // 任务失败
        taskInfo.status = 'FAILED';
        taskInfo.error = output.message || '任务处理失败';
        
        return res.json({
          success: false,
          data: {
            taskId: taskId,
            status: 'FAILED',
            error: taskInfo.error
          }
        });
        
      } else {
        // 任务进行中
        return res.json({
          success: true,
          data: {
            taskId: taskId,
            status: 'PENDING',
            message: '任务正在处理中，请稍候...'
          }
        });
      }
    } else {
      return res.json({
        success: true,
        data: {
          taskId: taskId,
          status: 'PENDING',
          message: '任务正在处理中，请稍候...'
        }
      });
    }
    
  } catch (error) {
    console.error('查询通义千问图像编辑任务状态失败:', error);
    return res.status(500).json({
      success: false,
      message: '查询任务状态失败: ' + error.message
    });
  }
});

/**
 * @route   GET /api/qwen-image-edit/history
 * @desc    获取用户的通义千问图像编辑历史记录
 * @access  私有
 */
router.get('/history', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, hours = 24 } = req.query;
    
    console.log(`获取用户${userId}的通义千问图像编辑历史记录，时间范围：${hours}小时，分页：第${page}页，每页${limit}条`);
    
    // 计算时间过滤的截止时间
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const userTasks = [];
    const taskIdSet = new Set(); // 用于去重
    
    // 🔥 第一步：从内存中获取最新的任务（服务器重启前的任务）
    if (global.qwenImageEditTasks) {
      console.log(`从内存获取历史记录，全局变量中共有${Object.keys(global.qwenImageEditTasks).length}个任务`);
      for (const [taskId, taskInfo] of Object.entries(global.qwenImageEditTasks)) {
        if (taskInfo.userId === userId) {
          // 检查任务是否在指定时间范围内
          const taskTime = new Date(taskInfo.createdAt || taskInfo.timestamp);
          if (taskTime >= cutoffTime) {
            userTasks.push({
              taskId: taskId,
              status: taskInfo.status,
              inputImages: taskInfo.inputImages,
              resultImages: taskInfo.resultImages || [],
              prompt: taskInfo.prompt,
              negativePrompt: taskInfo.negativePrompt,
              aspectRatio: taskInfo.aspectRatio || 'auto', // 🔥 兼容删除aspectRatio的情况
              creditCost: taskInfo.creditCost,
              isFree: taskInfo.isFree,
              createdAt: taskInfo.createdAt,
              completedAt: taskInfo.completedAt,
              source: 'memory' // 标记数据来源
            });
            taskIdSet.add(taskId);
          }
        }
      }
    }
    
    // 🔥 第二步：从OSS获取持久化的历史记录（服务器重启后仍可用）
    try {
      const { getQwenImageEditHistoryFromOSS } = require('../services/qwenImageEditHistoryOSS');
      console.log('尝试从OSS获取历史记录...');
      
      // 获取更多记录以便过滤时间范围
      const ossRecords = await getQwenImageEditHistoryFromOSS(userId, limit * 3, 0);
      console.log(`从OSS获取到${ossRecords.length}条历史记录`);
      
      for (const record of ossRecords) {
        // 避免重复添加（内存中已有的任务）
        if (!taskIdSet.has(record.taskId)) {
          // 检查时间范围
          const recordTime = new Date(record.createdAt || record.savedAt);
          if (recordTime >= cutoffTime) {
            userTasks.push({
              taskId: record.taskId,
              status: 'SUCCEEDED', // OSS中的记录都是已完成的
              inputImages: record.inputImages || [],
              resultImages: record.resultImages || record.ossResultImages || [],
              prompt: record.prompt,
              negativePrompt: record.negativePrompt || '',
              aspectRatio: record.aspectRatio || 'auto', // 🔥 兼容删除aspectRatio的情况
              creditCost: record.creditCost || 0,
              isFree: record.isFree || false,
              createdAt: record.createdAt,
              completedAt: record.createdAt, // OSS记录的创建时间即完成时间
              source: 'oss' // 标记数据来源
            });
            taskIdSet.add(record.taskId);
          }
        }
      }
    } catch (ossError) {
      console.warn('从OSS获取历史记录失败，仅使用内存数据:', ossError.message);
    }
    
    console.log(`合并后找到${userTasks.length}条符合时间范围的历史记录（内存+OSS）`);
    
    // 按创建时间倒序排列
    userTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedTasks = userTasks.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        tasks: paginatedTasks,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(userTasks.length / limit),
          totalTasks: userTasks.length,
          hasNext: endIndex < userTasks.length,
          hasPrev: startIndex > 0
        },
        timeFilter: {
          hours: parseInt(hours),
          cutoffTime: cutoffTime.toISOString()
        },
        dataSource: {
          memory: userTasks.filter(t => t.source === 'memory').length,
          oss: userTasks.filter(t => t.source === 'oss').length,
          total: userTasks.length
        }
      }
    });
    
  } catch (error) {
    console.error('获取通义千问图像编辑历史失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取历史记录失败: ' + error.message
    });
  }
});

/**
 * 解析API返回的内容，提取图片和文本（参考阿里云官方Java示例）
 * @param {any} messageContent API返回的消息内容
 * @param {string} source 来源标识（用于日志）
 * @returns {Object} 解析结果 { resultImages: [], editingInstructions: '' }
 */
function parseApiResponse(messageContent, source = 'unknown') {
  let resultImages = [];
  let editingInstructions = '';
  let imageIndex = 1;
  
  console.log(`[${source}] 开始解析API返回内容:`, JSON.stringify(messageContent, null, 2));
  
  if (Array.isArray(messageContent)) {
    // 参考Java示例的解析方式：遍历contentList
    for (const content of messageContent) {
      if (content && typeof content === 'object') {
        // 检查是否包含图片（参考Java: content.containsKey("image")）
        if (content.hasOwnProperty('image') && content.image) {
          const imageUrl = content.image;
          resultImages.push({ 
            url: imageUrl,
            index: imageIndex,
            type: 'parsed_image',
            source: source
          });
          console.log(`[${source}] 输出图像${imageIndex}的URL：${imageUrl}`);
          imageIndex++;
        }
        // 检查是否包含文本内容
        else if (content.hasOwnProperty('text') && content.text) {
          editingInstructions += content.text + '\n';
          console.log(`[${source}] 提取到文本内容:`, content.text.substring(0, 100) + '...');
        }
      }
      // 兼容直接字符串格式
      else if (typeof content === 'string') {
        editingInstructions += content + '\n';
      }
    }
  } 
  // 兼容非数组格式的返回
  else if (typeof messageContent === 'string') {
    editingInstructions = messageContent;
    console.log(`[${source}] 检测到字符串格式返回，作为编辑指导处理`);
  }
  // 兼容对象格式的返回
  else if (messageContent && typeof messageContent === 'object') {
    if (messageContent.image) {
      resultImages.push({ 
        url: messageContent.image,
        index: 1,
        type: 'parsed_image',
        source: source
      });
      console.log(`[${source}] 输出图像1的URL：${messageContent.image}`);
    }
    if (messageContent.text) {
      editingInstructions = messageContent.text;
    }
  }
  
  // 清理编辑指导内容
  editingInstructions = editingInstructions.trim();
  
  console.log(`🔍 调试 - [${source}] 解析结果: ${resultImages.length}张图片, 指导内容长度: ${editingInstructions.length}字符`);
  console.log(`🔍 调试 - [${source}] 解析到的图片URLs:`, resultImages.map(img => img.url));
  
  // 验证结果完整性
  if (resultImages.length === 0 && editingInstructions.length === 0) {
    console.warn(`[${source}] 警告：API返回了空结果，可能需要检查请求参数或模型状态`);
  }
  
  return {
    resultImages,
    editingInstructions
  };
}

/**
 * 创建通义千问图像编辑任务
 * @param {Object} requestData 请求数据
 * @param {boolean} useImageEditModel 是否使用专业图像编辑模型
 * @returns {Promise<Object>} API响应结果
 */
async function createTask(requestData, useImageEditModel = false) {
  try {
    console.log('准备发送到通义千问的数据:', JSON.stringify(requestData, null, 2));
    console.log('使用模型:', requestData.model, '（专业编辑模型:', useImageEditModel, '）');
    
    // 准备请求头
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    };
    
    let response;
    
    try {
      // 尝试调用API
      response = await axios.post(API_BASE_URL, requestData, { headers });
      console.log('通义千问API响应:', response.status, JSON.stringify(response.data, null, 2));
      
      return { status: response.status, data: response.data };
      
    } catch (apiError) {
      // 如果使用专业模型失败，尝试降级到普通模型
      if (useImageEditModel && apiError.response?.status === 400) {
        console.warn('专业图像编辑模型调用失败，尝试降级到普通模型:', apiError.response.data);
        
        // 修改请求为普通模型
        const fallbackRequestData = {
          ...requestData,
          model: FALLBACK_MODEL,
          parameters: {
            result_format: "message"
          }
        };
        
        // 更新文本内容以提供更好的指导
        if (fallbackRequestData.input.messages[0].content) {
          const textContent = fallbackRequestData.input.messages[0].content.find(c => c.text);
          if (textContent) {
            textContent.text = `请根据以下要求对图片进行详细的编辑分析和指导：${textContent.text}\n\n请提供：\n1. 具体的编辑步骤和方法\n2. 推荐的编辑工具和参数设置\n3. 预期效果描述\n4. 注意事项和技巧`;
          }
        }
        
        console.log('使用降级模型重新请求:', JSON.stringify(fallbackRequestData, null, 2));
        
        response = await axios.post(API_BASE_URL, fallbackRequestData, { headers });
        console.log('降级模型API响应:', response.status, JSON.stringify(response.data, null, 2));
        
        return { status: response.status, data: response.data, fallbackUsed: true };
      }
      
      throw apiError;
    }
    
  } catch (error) {
    console.error('创建通义千问任务失败:', error);
    if (error.response) {
      console.error('API错误响应:', error.response.data);
    }
    throw error;
  }
}

/**
 * 查询任务状态
 * @param {string} taskId 任务ID
 * @returns {Promise<Object>} 任务状态响应
 */
async function getTaskStatus(taskId) {
  try {
    const headers = {
      'Authorization': `Bearer ${API_KEY}`
    };
    
    const response = await axios.get(`${TASK_API_URL}/${taskId}`, { headers });
    return { status: response.status, data: response.data };
  } catch (error) {
    console.error('查询任务状态失败:', error);
    throw error;
  }
}

module.exports = router;
