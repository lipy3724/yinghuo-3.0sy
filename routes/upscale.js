/**
 * 图像高清放大API路由
 * 处理图像高清放大请求，包括图片上传、OSS存储和API调用
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const { uploadToOSS, callUpscaleApi } = require('../api-utils');
const User = require('../models/User');
const { sequelize } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

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

/**
 * @route   POST /api/upscale
 * @desc    处理图像高清放大请求
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

    // 获取放大倍数参数
    const upscaleFactor = req.body.upscaleFactor || '2';
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
    const requiredCredits = 10; // 图像高清放大需要10积分
    
    if (user.credits < requiredCredits) {
      await transaction.rollback();
      return res.status(402).json({
        success: false,
        message: '积分不足，请充值后再试',
        errorCode: 'INSUFFICIENT_CREDITS'
      });
    }
    
    // 生成任务ID
    const taskId = `upscale-${Date.now()}-${uuidv4().substring(0, 8)}`;
    
    try {
      // 读取图片文件
      const imageBuffer = fs.readFileSync(imagePath);
      
      // 上传到OSS
      console.log(`开始上传图片到OSS，用户ID: ${userId}, 任务ID: ${taskId}`);
      const imageUrl = await uploadToOSS(imageBuffer, req.file.originalname, 'upscaler');
      console.log(`图片上传成功，OSS URL: ${imageUrl}`);
      
      // 扣除用户积分
      user.credits -= requiredCredits;
      await user.save({ transaction });
      
      // 记录积分使用
      await sequelize.query(
        `INSERT INTO feature_usage (user_id, feature_name, credits_used, created_at, updated_at, task_id, status)
         VALUES (?, ?, ?, NOW(), NOW(), ?, 'PROCESSING')`,
        {
          replacements: [userId, '图像高清放大', requiredCredits, taskId],
          type: sequelize.QueryTypes.INSERT,
          transaction
        }
      );
      
      // 提交事务
      await transaction.commit();
      
      // 调用图像高清放大API
      console.log(`开始调用图像高清放大API，用户ID: ${userId}, 任务ID: ${taskId}`);
      const result = await callUpscaleApi(imageUrl, upscaleFactor);
      console.log(`API调用成功，结果:`, result);
      
      // 删除临时文件
      fs.unlinkSync(imagePath);
      
                    // 获取正确的结果URL
                    let resultUrl = '';
                    if (result.data && result.data.imageUrl) {
                        resultUrl = result.data.imageUrl;
                    } else if (result.data && result.data.data && result.data.data.imageUrl) {
                        resultUrl = result.data.data.imageUrl;
                    } else {
                        console.error('API返回结果格式异常:', result);
                        throw new Error('API返回结果格式异常，无法获取处理后的图片URL');
                    }
                    
                    console.log('获取到的结果URL:', resultUrl);
                    
                    // 更新任务状态为成功
                    await sequelize.query(
                        `UPDATE feature_usage SET status = 'COMPLETED', result_data = ? WHERE task_id = ?`,
                        {
                            replacements: [JSON.stringify({ originalUrl: imageUrl, resultUrl: resultUrl }), taskId],
                            type: sequelize.QueryTypes.UPDATE
                        }
                    );
                    
                    // 保存历史记录到OSS
                    try {
                        const { client } = require('../utils/ossService');
                        
                        // 先加载现有历史记录
                        const ossPath = `image-upscaler/history/${userId}/records.json`;
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
                            originalImage: imageUrl,
                            resultImage: resultUrl,
                            upscaleFactor: parseInt(upscaleFactor),
                            metadata: {
                                taskId: taskId,
                                timestamp: new Date().toISOString(),
                                feature: 'image-upscaler'
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
                        imageUrl: resultUrl,
                        originalUrl: imageUrl,
                        taskId: taskId
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
      
      // 处理API资源耗尽错误
      if (error.response && error.response.data && error.response.data.code === 'NoTrialResource') {
        return res.status(402).json({
          success: false,
          message: 'API试用资源已耗尽，请稍后再试',
          errorCode: 'NO_TRIAL_RESOURCE',
          taskId: taskId
        });
      }
      
      // 处理其他错误
      console.error('图像高清放大处理失败:', error);
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
    
    console.error('图像高清放大请求处理失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器处理请求失败: ' + error.message
    });
  }
});

/**
 * @route   POST /api/upscale/refund
 * @desc    处理图像高清放大退款请求
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
    
    console.log(`收到图像高清放大退款请求: 用户ID=${userId}, 任务ID=${taskId}, 原因=${reason || '未提供'}`);
    
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
    const creditsToRefund = usageRecord.credits_used || 10;
    
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
    
    console.log(`图像高清放大退款成功: 用户ID=${userId}, 任务ID=${taskId}, 退款积分=${creditsToRefund}`);
    
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
 * @route   GET /api/upscale/tasks
 * @desc    获取用户的图像高清放大任务列表
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
    
    console.log(`获取用户(ID: ${userId})的图像高清放大任务列表`);
    
    // 查询用户的任务记录
    const [tasks] = await sequelize.query(
      `SELECT fu.*, 
        JSON_EXTRACT(fu.result_data, '$.originalUrl') as originalUrl,
        JSON_EXTRACT(fu.result_data, '$.resultUrl') as resultUrl
      FROM feature_usage fu
      WHERE fu.user_id = ? AND fu.feature_name = '图像高清放大'
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
      
      // 尝试从result_data中提取upscaleFactor
      let upscaleFactor = 2; // 默认值
      try {
        if (task.result_data) {
          const resultData = JSON.parse(task.result_data);
          if (resultData.upscaleFactor) {
            upscaleFactor = parseInt(resultData.upscaleFactor);
          }
        }
      } catch (parseError) {
        console.warn(`解析任务${task.task_id}的result_data失败:`, parseError.message);
      }
      
      return {
        taskId: task.task_id,
        status: task.status,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        originalUrl: originalUrl,
        resultUrl: resultUrl,
        errorMessage: task.error_message,
        upscaleFactor: upscaleFactor
      };
    });
    
    return res.json({
      success: true,
      tasks: formattedTasks
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    // 提供更详细的错误信息
    console.error('获取任务列表失败详细信息:', error);
    
    // 构造更友好的错误消息和错误代码
    let errorMessage = '获取任务列表失败';
    let errorCode = 'TASK_LIST_ERROR';
    
    if (error.name === 'SequelizeDatabaseError') {
      errorMessage = '数据库查询错误，请稍后再试';
      errorCode = 'DB_QUERY_ERROR';
    } else if (error.name === 'SequelizeConnectionError') {
      errorMessage = '数据库连接错误，请稍后再试';
      errorCode = 'DB_CONNECTION_ERROR';
    } else if (error.name === 'SequelizeValidationError') {
      errorMessage = '数据验证错误，请检查请求参数';
      errorCode = 'VALIDATION_ERROR';
    } else if (error.message) {
      errorMessage += ': ' + error.message;
    }
    
    return res.status(500).json({
      success: false,
      message: errorMessage,
      errorCode: errorCode,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/upscale/task/:taskId
 * @desc    获取单个任务详情
 * @access  Private
 */
router.get('/task/:taskId', protect, async (req, res) => {
  try {
    // 验证用户身份
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌或令牌无效',
        errorCode: 'AUTH_ERROR'
      });
    }
    
    const { taskId } = req.params;
    const userId = req.user.id;
    
    // 验证参数
    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: '缺少任务ID参数',
        errorCode: 'MISSING_TASK_ID'
      });
    }
    
    console.log(`获取任务详情: 用户ID=${userId}, 任务ID=${taskId}`);
    
    // 查询任务记录
    const [tasks] = await sequelize.query(
      `SELECT fu.*, 
        JSON_EXTRACT(fu.result_data, '$.originalUrl') as originalUrl,
        JSON_EXTRACT(fu.result_data, '$.resultUrl') as resultUrl
      FROM feature_usage fu
      WHERE fu.task_id = ? AND fu.user_id = ?`,
      {
        replacements: [taskId, userId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    if (!tasks || tasks.length === 0) {
      console.log(`未找到任务记录: 用户ID=${userId}, 任务ID=${taskId}`);
      return res.status(404).json({
        success: false,
        message: '未找到对应的任务记录',
        errorCode: 'TASK_NOT_FOUND'
      });
    }
    
    const task = tasks[0];
    console.log(`找到任务记录: 任务ID=${taskId}, 状态=${task.status}`);
    
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
    
    // 尝试从result_data中提取upscaleFactor
    let upscaleFactor = 2; // 默认值
    try {
      if (task.result_data) {
        const resultData = JSON.parse(task.result_data);
        if (resultData.upscaleFactor) {
          upscaleFactor = parseInt(resultData.upscaleFactor);
        }
      }
    } catch (parseError) {
      console.warn(`解析任务${task.task_id}的result_data失败:`, parseError.message);
    }
    
    const formattedTask = {
      taskId: task.task_id,
      status: task.status,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      originalUrl: originalUrl,
      resultUrl: resultUrl,
      errorMessage: task.error_message,
      upscaleFactor: upscaleFactor
    };
    
    return res.json({
      success: true,
      task: formattedTask
    });
  } catch (error) {
    console.error('获取任务详情失败:', error);
    
    // 构造更友好的错误消息和错误代码
    let errorMessage = '获取任务详情失败';
    let errorCode = 'TASK_DETAIL_ERROR';
    
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
      errorCode: errorCode,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
