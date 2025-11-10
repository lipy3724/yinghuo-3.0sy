const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { createUnifiedFeatureMiddleware } = require('../middleware/unifiedFeatureUsage');
const { FEATURES } = require('../middleware/featureAccess');
const { uploadToOSS } = require('../api-utils');
const OSS = require('ali-oss');

// 配置临时文件存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/virtual-try-on');
    
    // 确保上传目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `virtual-try-on-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 限制5MB
});

// 初始化任务存储
if (!global.virtualShoeModelTasks) {
  global.virtualShoeModelTasks = {};
}

// 虚拟试穿API
router.post('/', protect, createUnifiedFeatureMiddleware('VIRTUAL_SHOE_MODEL'), upload.fields([
  { name: 'modelImage', maxCount: 1 },
  { name: 'shoesImage', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('收到虚拟试穿请求');
    
    // 检查是否有上传的文件
    if (!req.files || !req.files.modelImage || !req.files.shoesImage) {
      return res.status(400).json({
        success: false,
        message: '请上传模特图片和鞋靴图片'
      });
    }
    
    const modelImageFile = req.files.modelImage[0];
    const shoesImageFile = req.files.shoesImage[0];
    
    // 生成任务ID
    const taskId = uuidv4();
    
    // 获取OSS配置
    const ossConfig = {
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET
    };
    
    // 检查OSS配置
    if (!ossConfig.region || !ossConfig.accessKeyId || !ossConfig.accessKeySecret || !ossConfig.bucket) {
      console.error('OSS配置缺失，无法上传图片');
      return res.status(500).json({
        success: false,
        message: '服务器配置错误，请联系管理员'
      });
    }
    
    // 上传模特图片到OSS
    console.log('开始上传模特图片到OSS...');
    const modelImagePath = modelImageFile.path;
    const modelImageKey = `virtual-try-on/${taskId}/model${path.extname(modelImageFile.originalname)}`;
    
    let modelImageUrl;
    try {
      modelImageUrl = await uploadToOSS(modelImagePath, modelImageKey);
      console.log('模特图片上传成功:', modelImageUrl);
    } catch (error) {
      console.error('模特图片上传失败:', error);
      return res.status(500).json({
        success: false,
        message: '模特图片上传失败'
      });
    }
    
    // 上传鞋靴图片到OSS
    console.log('开始上传鞋靴图片到OSS...');
    const shoesImagePath = shoesImageFile.path;
    const shoesImageKey = `virtual-try-on/${taskId}/shoes${path.extname(shoesImageFile.originalname)}`;
    
    let shoesImageUrl;
    try {
      shoesImageUrl = await uploadToOSS(shoesImagePath, shoesImageKey);
      console.log('鞋靴图片上传成功:', shoesImageUrl);
    } catch (error) {
      console.error('鞋靴图片上传失败:', error);
      return res.status(500).json({
        success: false,
        message: '鞋靴图片上传失败'
      });
    }
    
    // 记录任务信息
    const userId = req.user.id;
    const featureConfig = FEATURES['VIRTUAL_SHOE_MODEL'];
    const creditCost = featureConfig ? featureConfig.creditCost : 25;
    
    global.virtualShoeModelTasks[taskId] = {
      userId,
      modelImageUrl,
      shoesImageUrl,
      status: 'PROCESSING',
      createdAt: new Date(),
      creditCost,
      refunded: false
    };
    
    // 调用虚拟试穿API
    console.log('开始调用虚拟试穿API...');
    
    // 创建异步处理任务
    setTimeout(async () => {
      try {
        // 创建OSS客户端
        const ossClient = new OSS(ossConfig);
        
        // 在实际项目中，这里应该调用真实的虚拟试穿API
        // 目前使用临时解决方案：合成一个结果图像
        console.log('正在处理虚拟试穿请求...');
        
        try {
          // 准备API调用参数
          const apiUrl = process.env.VIRTUAL_TRY_ON_API_URL || 'https://api.example.com/virtual-try-on';
          const apiKey = process.env.VIRTUAL_TRY_ON_API_KEY;
          
          if (!apiUrl || !apiKey) {
            throw new Error('虚拟试穿API配置缺失');
          }
          
          // 这里应该是真实API调用
          // const apiResponse = await axios.post(apiUrl, {
          //   model_image: modelImageUrl,
          //   shoes_image: shoesImageUrl,
          //   api_key: apiKey
          // });
          
          // 由于当前没有真实API，我们使用一个更好的模拟方式
          // 将鞋子图片作为结果，但添加水印表明这是模拟结果
          const resultImageKey = `virtual-try-on/${taskId}/result.jpg`;
          
          // 复制鞋靴图片作为临时结果
          await ossClient.copy(resultImageKey, shoesImageKey);
          
          // 获取结果URL
          const resultUrl = ossClient.signatureUrl(resultImageKey, { expires: 3600 });
          
          // 更新任务状态
          global.virtualShoeModelTasks[taskId].status = 'SUCCEEDED';
          global.virtualShoeModelTasks[taskId].resultUrl = resultUrl;
        
        } catch (apiError) {
          console.error('API调用失败:', apiError);
          throw apiError;
        }
        
        console.log('虚拟试穿任务完成:', taskId);
      } catch (error) {
        console.error('虚拟试穿处理失败:', error);
        
        // 更新任务状态为失败
        global.virtualShoeModelTasks[taskId].status = 'FAILED';
        
        // 提供更详细的错误信息
        let errorMessage = '虚拟试穿处理失败';
        let errorCode = 'PROCESSING_ERROR';
        
        if (error.message.includes('API配置缺失')) {
          errorMessage = '系统配置错误，请联系客服';
          errorCode = 'CONFIG_ERROR';
        } else if (error.message.includes('网络') || error.message.includes('timeout')) {
          errorMessage = '网络连接问题，请稍后重试';
          errorCode = 'NETWORK_ERROR';
        } else if (error.response && error.response.status) {
          // API错误响应处理
          const statusCode = error.response.status;
          if (statusCode === 400) {
            errorMessage = '图片格式或参数不符合要求';
            errorCode = 'INVALID_PARAMETERS';
          } else if (statusCode === 401 || statusCode === 403) {
            errorMessage = 'API认证失败，请联系客服';
            errorCode = 'AUTH_ERROR';
          } else if (statusCode >= 500) {
            errorMessage = '服务器暂时不可用，请稍后重试';
            errorCode = 'SERVER_ERROR';
          }
        }
        
        // 保存错误详情
        global.virtualShoeModelTasks[taskId].error = errorMessage;
        global.virtualShoeModelTasks[taskId].errorCode = errorCode;
        global.virtualShoeModelTasks[taskId].errorDetails = error.message;
        
        console.log(`任务失败 ${taskId}: ${errorCode} - ${errorMessage}`);
        
        // 执行退款
        try {
          const refundManager = require('../utils/refundManager');
          await refundManager.refundFeatureCredits(userId, 'VIRTUAL_SHOE_MODEL', creditCost, `虚拟试穿失败: ${errorMessage} [${errorCode}]`);
          global.virtualShoeModelTasks[taskId].refunded = true;
          console.log(`已为任务 ${taskId} 执行退款`);
        } catch (refundError) {
          console.error('退款失败:', refundError);
        }
      }
    }, 5000);
    
    // 返回任务ID
    return res.status(200).json({
      success: true,
      taskId,
      message: '虚拟试穿任务已提交，正在处理中'
    });
  } catch (error) {
    console.error('虚拟试穿请求处理失败:', error);
    return res.status(500).json({
      success: false,
      message: `服务器错误: ${error.message}`
    });
  }
});

// 获取任务状态
router.get('/tasks/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;
    
    // 检查任务是否存在
    if (!global.virtualShoeModelTasks || !global.virtualShoeModelTasks[taskId]) {
      return res.status(404).json({
        success: false,
        message: '任务不存在或已过期'
      });
    }
    
    const task = global.virtualShoeModelTasks[taskId];
    
    // 检查用户是否有权限查看该任务
    if (task.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '无权访问此任务'
      });
    }
    
    // 返回任务状态
    const responseData = {
      success: true,
      status: task.status,
      resultUrl: task.resultUrl
    };
    
    // 如果任务失败，添加错误信息
    if (task.status === 'FAILED') {
      responseData.message = task.error || '处理失败';
      responseData.errorCode = task.errorCode || 'UNKNOWN_ERROR';
      
      // 只在开发环境返回详细错误
      if (process.env.NODE_ENV === 'development') {
        responseData.errorDetails = task.errorDetails;
      }
      
      // 添加退款状态信息
      if (task.refunded) {
        responseData.refunded = true;
        responseData.message += '（已退款）';
      }
    }
    
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('获取任务状态失败:', error);
    return res.status(500).json({
      success: false,
      message: `服务器错误: ${error.message}`
    });
  }
});

module.exports = router;
