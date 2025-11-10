/**
 * 图像上色API路由
 * 处理图像上色请求，包括图片上传、OSS存储和API调用
 * 参照图像高清放大的积分扣除机制
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const { uploadToOSS } = require('../api-utils');
const User = require('../models/User');
const { sequelize } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const https = require('https');

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// 配置临时文件存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// 配置文件过滤器
const fileFilter = (req, file, cb) => {
  // 只接受图片文件
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('只能上传图片文件!'), false);
  }
};

// 配置上传中间件
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 限制10MB
  }
});

// 通义万相API配置
const API_KEY = process.env.DASHSCOPE_API_KEY || 'sk-a53c9eb917ce49558997c6bc0edac820';
const API_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis';
const TASK_API_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks';

// 创建axios实例
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ keepAlive: true, family: 4 })
});

/**
 * @route   POST /api/image-colorization
 * @desc    处理图像上色请求
 * @access  Private
 */
router.post('/', protect, upload.single('image'), async (req, res) => {
  // 开始事务
  const transaction = await sequelize.transaction();
  
  try {
    // 验证请求
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '未提供图片文件'
      });
    }

    // 获取提示词参数
    const prompt = req.body.prompt || '图像上色';
    const imagePath = req.file.path;
    
    // 获取用户信息
    const userId = req.user.id;
    const user = await User.findByPk(userId, { transaction });
    
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 检查用户积分
    const requiredCredits = 5; // 图像上色需要5积分
    
    if (user.credits < requiredCredits) {
      await transaction.rollback();
      return res.status(402).json({
        success: false,
        message: '积分不足，请充值后再试',
        errorCode: 'INSUFFICIENT_CREDITS'
      });
    }
    
    // 生成任务ID
    const taskId = `colorization-${Date.now()}-${uuidv4().substring(0, 8)}`;
    
    try {
      // 读取图片文件
      const imageBuffer = fs.readFileSync(imagePath);
      
      // 上传到OSS
      console.log(`开始上传图片到OSS，用户ID: ${userId}, 任务ID: ${taskId}`);
      const imageUrl = await uploadToOSS(imageBuffer, req.file.originalname, 'colorization');
      console.log(`图片上传成功，OSS URL: ${imageUrl}`);
      
      // 扣除用户积分
      user.credits -= requiredCredits;
      await user.save({ transaction });
      
      // 记录积分使用
      await sequelize.query(
        `INSERT INTO feature_usage (user_id, feature_name, credits_used, created_at, updated_at, task_id, status)
         VALUES (?, ?, ?, NOW(), NOW(), ?, 'PROCESSING')`,
        {
          replacements: [userId, 'IMAGE_COLORIZATION', requiredCredits, taskId],
          type: sequelize.QueryTypes.INSERT,
          transaction
        }
      );
      
      // 提交事务
      await transaction.commit();
      
      // 构建通义万相API请求数据
      const requestData = {
        model: "wanx2.1-imageedit",
        input: {
          base_image_url: imageUrl,
          prompt: prompt,
          function: "colorization"
        },
        parameters: {
          n: 1
        }
      };
      
      // 调用图像上色API
      console.log(`开始调用图像上色API，用户ID: ${userId}, 任务ID: ${taskId}`);
      const response = await createTask(requestData);
      
      // API返回的任务ID（如果有）
      const apiTaskId = response.data.output?.task_id || taskId;
      
      // 删除临时文件
      fs.unlinkSync(imagePath);
      
      // 返回结果
      return res.json({
        success: true,
        message: '任务创建成功，正在处理中',
        taskId: apiTaskId
      });
    } catch (error) {
      // 删除临时文件
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      
      // 如果事务已提交，需要处理退款
      if (transaction.finished === 'commit') {
        try {
          // 记录任务失败
          await sequelize.query(
            `UPDATE feature_usage SET status = 'FAILED', error_message = ? WHERE task_id = ?`,
            {
              replacements: [error.message || '任务处理失败', taskId],
              type: sequelize.QueryTypes.UPDATE
            }
          );
          
          // 退还积分
          await User.increment('credits', {
            by: requiredCredits,
            where: { id: userId }
          });
          
          console.log(`已退还积分，用户ID: ${userId}, 积分: ${requiredCredits}, 任务ID: ${taskId}`);
        } catch (refundError) {
          console.error('退款处理失败:', refundError);
        }
      } else {
        // 回滚事务
        await transaction.rollback();
      }
      
      // 处理API错误
      console.error('图像上色处理失败:', error);
      return res.status(500).json({
        success: false,
        message: '图像处理失败: ' + error.message,
        taskId: taskId
      });
    }
  } catch (error) {
    // 回滚事务
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    
    // 删除临时文件
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('图像上色请求处理失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器处理请求失败: ' + error.message
    });
  }
});

/**
 * @route   GET /api/image-colorization/task-status/:taskId
 * @desc    查询任务状态
 * @access  Private
 */
router.get('/task-status/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    
    // 验证taskId格式
    if (!taskId || typeof taskId !== 'string' || taskId.trim() === '') {
      return res.status(400).json({
        success: false, 
        message: '任务ID无效'
      });
    }
    
    // 查询任务记录
    const [tasks] = await sequelize.query(
      `SELECT * FROM feature_usage WHERE task_id = ? AND user_id = ?`,
      {
        replacements: [taskId, userId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    if (!tasks || tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: '未找到对应的任务记录'
      });
    }
    
    const task = tasks[0];
    
    // 如果任务已完成或失败，直接返回结果
    if (task.status === 'COMPLETED') {
      try {
        const resultData = JSON.parse(task.result_data || '{}');
        return res.json({
          success: true,
          status: 'SUCCEEDED',
          resultUrl: resultData.resultUrl,
          originalUrl: resultData.originalUrl
        });
      } catch (parseError) {
        console.error('解析任务结果数据失败:', parseError);
        return res.json({
          success: false,
          status: 'ERROR',
          message: '解析任务结果数据失败'
        });
      }
    } else if (task.status === 'FAILED') {
      return res.json({
        success: false,
        status: 'FAILED',
        message: task.error_message || '任务处理失败'
      });
    } else if (task.status === 'REFUNDED') {
      return res.json({
        success: false,
        status: 'REFUNDED',
        message: '任务已退款'
      });
    }
    
    // 任务仍在处理中，查询API状态
    try {
      const statusResponse = await queryTaskStatus(taskId);
      
      // 获取任务状态
      const taskStatus = statusResponse.data.output?.task_status;
      
      if (taskStatus === 'SUCCEEDED') {
        // 任务成功完成，获取结果URL
        let resultUrl = getResultUrl(statusResponse);
        
        if (resultUrl) {
          // 更新任务状态
          const resultData = {
            originalUrl: task.original_url || '',
            resultUrl: resultUrl
          };
          
          await sequelize.query(
            `UPDATE feature_usage SET status = 'COMPLETED', result_data = ?, updated_at = NOW() WHERE task_id = ?`,
            {
              replacements: [JSON.stringify(resultData), taskId],
              type: sequelize.QueryTypes.UPDATE
            }
          );
          
          // 保存历史记录到OSS
          try {
            const { client } = require('../utils/ossService');
            
            // 先加载现有历史记录
            const ossPath = `image-colorization/history/${userId}/records.json`;
            let existingRecords = [];
            
            try {
              const result = await client.get(ossPath);
              existingRecords = JSON.parse(result.content.toString());
            } catch (error) {
              if (error.code !== 'NoSuchKey') {
                console.error('加载现有历史记录失败:', error);
              }
            }
            
            // 创建新记录
            const historyRecord = {
              id: generateId(),
              userId,
              originalImage: task.original_url || '',
              resultImage: resultUrl,
              prompt: prompt || '图像上色',
              metadata: {
                taskId: taskId,
                timestamp: new Date().toISOString(),
                feature: 'IMAGE_COLORIZATION'
              },
              timestamp: new Date().toISOString()
            };
            
            // 添加新记录到开头
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
            
            console.log(`历史记录已保存到OSS: 用户ID=${userId}, 任务ID=${taskId}`);
          } catch (historyError) {
            console.error('保存历史记录到OSS失败:', historyError);
            // 历史记录保存失败不影响主流程
          }
          
          // 返回结果
          return res.json({
            success: true,
            status: 'SUCCEEDED',
            resultUrl: resultUrl,
            originalUrl: task.original_url || ''
          });
        }
      } else if (taskStatus === 'FAILED') {
        // 任务失败
        await sequelize.query(
          `UPDATE feature_usage SET status = 'FAILED', error_message = ?, updated_at = NOW() WHERE task_id = ?`,
          {
            replacements: [statusResponse.data.output?.message || '任务处理失败', taskId],
            type: sequelize.QueryTypes.UPDATE
          }
        );
        
        return res.json({
          success: false,
          status: 'FAILED',
          message: statusResponse.data.output?.message || '任务处理失败'
        });
      } else {
        // 任务仍在处理中
        return res.json({
          success: true,
          status: taskStatus || 'PENDING',
          message: '任务处理中'
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
    return res.status(500).json({
      success: false,
      message: '查询任务状态失败: ' + error.message
    });
  }
});

/**
 * @route   POST /api/image-colorization/refund
 * @desc    处理图像上色退款请求
 * @access  Private
 */
router.post('/refund', protect, async (req, res) => {
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
    
    // 查询任务记录
    const [usageRecords] = await sequelize.query(
      `SELECT * FROM feature_usage WHERE task_id = ? AND user_id = ?`,
      {
        replacements: [taskId, userId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    if (!usageRecords || usageRecords.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '未找到对应的任务记录' 
      });
    }
    
    const usageRecord = usageRecords[0];
    
    // 检查任务状态
    if (usageRecord.status === 'REFUNDED') {
      return res.status(400).json({ 
        success: false, 
        message: '该任务已经退款' 
      });
    }
    
    // 退还积分
    const creditsToRefund = usageRecord.credits_used || 5;
    
    await User.increment('credits', {
      by: creditsToRefund,
      where: { id: userId }
    });
    
    // 更新任务状态
    await sequelize.query(
      `UPDATE feature_usage SET status = 'REFUNDED', refund_reason = ?, updated_at = NOW() WHERE task_id = ?`,
      {
        replacements: [reason || '用户请求退款', taskId],
        type: sequelize.QueryTypes.UPDATE
      }
    );
    
    console.log(`图像上色退款成功: 用户ID=${userId}, 任务ID=${taskId}, 退款积分=${creditsToRefund}`);
    
    return res.status(200).json({ 
      success: true, 
      message: '退款处理成功',
      refundedCredits: creditsToRefund
    });
  } catch (error) {
    console.error('处理退款请求时出错:', error);
    return res.status(500).json({ 
      success: false, 
      message: '服务器处理退款请求时出错: ' + error.message 
    });
  }
});

/**
 * @route   GET /api/image-colorization/tasks
 * @desc    获取用户的图像上色任务列表
 * @access  Private
 */
router.get('/tasks', protect, async (req, res) => {
  try {
    // 验证用户身份
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌或令牌无效',
        errorCode: 'AUTH_ERROR'
      });
    }
    
    const userId = req.user.id;
    
    // 检查用户是否存在
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
        errorCode: 'USER_NOT_FOUND'
      });
    }
    
    console.log(`获取用户(ID: ${userId})的图像上色任务列表`);
    
    // 查询用户的任务记录
    const [tasks] = await sequelize.query(
      `SELECT fu.*, 
        JSON_EXTRACT(fu.result_data, '$.originalUrl') as originalUrl,
        JSON_EXTRACT(fu.result_data, '$.resultUrl') as resultUrl
      FROM feature_usage fu
      WHERE fu.user_id = ? AND fu.feature_name = 'IMAGE_COLORIZATION'
      ORDER BY fu.created_at DESC
      LIMIT 10`,
      {
        replacements: [userId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    console.log(`查询到${tasks.length}条任务记录`);
    
    // 处理任务数据
    const formattedTasks = tasks.map(task => {
      // 解析JSON字段
      let originalUrl = task.originalUrl;
      let resultUrl = task.resultUrl;
      
      // 移除JSON字符串中的引号
      if (originalUrl && originalUrl.startsWith('"') && originalUrl.endsWith('"')) {
        originalUrl = originalUrl.substring(1, originalUrl.length - 1);
      }
      
      if (resultUrl && resultUrl.startsWith('"') && resultUrl.endsWith('"')) {
        resultUrl = resultUrl.substring(1, resultUrl.length - 1);
      }
      
      return {
        taskId: task.task_id,
        status: task.status,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        originalUrl: originalUrl,
        resultUrl: resultUrl,
        errorMessage: task.error_message
      };
    });
    
    return res.json({
      success: true,
      tasks: formattedTasks
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    
    // 构造更友好的错误消息和错误代码
    let errorMessage = '获取任务列表失败';
    let errorCode = 'TASK_LIST_ERROR';
    
    if (error.name === 'SequelizeDatabaseError') {
      errorMessage = '数据库查询错误，请稍后再试';
      errorCode = 'DB_QUERY_ERROR';
    } else if (error.name === 'SequelizeConnectionError') {
      errorMessage = '数据库连接错误，请稍后再试';
      errorCode = 'DB_CONNECTION_ERROR';
    } else if (error.message) {
      errorMessage += ': ' + error.message;
    }
    
    return res.status(500).json({
      success: false,
      message: errorMessage,
      errorCode: errorCode
    });
  }
});

// 创建任务
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
      const response = await axiosInstance.post(API_BASE_URL, requestData, { 
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

// 查询任务状态
async function queryTaskStatus(taskId) {
  try {
    console.log('查询任务状态:', taskId);
    
    // 准备请求头
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    };
    
    // 增加超时控制
    const timeout = 15000; // 15秒超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await axiosInstance.get(`${TASK_API_URL}/${taskId}`, { 
        headers,
        signal: controller.signal,
        timeout: timeout
      });
      
      clearTimeout(timeoutId);
      console.log('任务状态查询响应:', response.status, JSON.stringify(response.data, null, 2));
      
      return { status: response.status, data: response.data };
    } catch (requestError) {
      clearTimeout(timeoutId);
      if (requestError.name === 'AbortError' || requestError.code === 'ECONNABORTED') {
        console.error(`任务状态查询超时 (${timeout}ms)`, taskId);
        throw new Error('任务状态查询超时，请稍后再试');
      }
      throw requestError;
    }
  } catch (error) {
    console.error('查询任务状态失败:', error);
    if (error.response) {
      console.error('API错误响应:', error.response.status, error.response.data);
    }
    throw error;
  }
}

// 获取结果URL
function getResultUrl(statusResponse) {
  try {
    // 优先检查images字段(新版API)
    if (statusResponse.data.output?.images && statusResponse.data.output.images.length > 0) {
      const resultImageUrl = statusResponse.data.output.images[0].url;
      if (resultImageUrl && resultImageUrl.trim() !== '') {
        return resultImageUrl;
      }
    }
    
    // 然后检查results字段(旧版API)
    const resultsList = statusResponse.data.output?.results || [];
    if (resultsList.length > 0) {
      // 找出成功的结果
      const successResults = resultsList.filter(result => result.url && result.url.trim() !== '');
      if (successResults.length > 0) {
        return successResults[0].url;
      }
    }
    
    return null;
  } catch (error) {
    console.error('获取结果URL失败:', error);
    return null;
  }
}

module.exports = router;


