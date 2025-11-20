const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { saveFaceFusionHistoryOSS, getFaceFusionHistoryOSS, clearFaceFusionHistoryOSS } = require('../services/faceFusionHistoryOSS');
const logger = require('../utils/logger');

/**
 * @route   GET /api/face-fusion-history/list
 * @desc    获取图片换脸历史记录列表
 * @access  Private
 */
router.get('/list', protect, async (req, res) => {
  logger.info('收到图片换脸历史记录请求', {
    path: req.originalUrl,
    userId: req.user ? req.user.id : '未认证'
  });
  
  try {
    const userId = req.user.id;
    const { limit = 10, hours = 24 } = req.query;
    
    logger.info(`获取用户 ${userId} 的图片换脸历史记录`, {
      limit,
      hours
    });
    
    // 从OSS获取历史记录
    const records = await getFaceFusionHistoryOSS(userId, {
      limit: parseInt(limit),
      last24Hours: hours === '24'
    });
    
    // 为每条记录添加时间显示格式
    records.forEach(record => {
      // 使用created_at作为首选时间字段，如果不存在才使用timestamp
      const date = new Date(record.created_at || record.timestamp || record.metadata?.timestamp);
      record.timeDisplay = formatDate(date);
    });
    
    logger.info(`返回 ${records.length} 条历史记录给用户 ${userId}`);
    
    res.json({
      success: true,
      records: records
    });
  } catch (error) {
    logger.error('获取图片换脸历史记录失败', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
      code: error.code
    });
    
    // 即使出错也返回空数组，让前端可以正常处理
    res.json({
      success: true,
      records: [],
      message: '历史记录加载失败，请稍后重试'
    });
  }
});

/**
 * @route   POST /api/face-fusion-history/save
 * @desc    保存图片换脸历史记录
 * @access  Private
 */
router.post('/save', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const historyItem = req.body;
    
    logger.info('接收到保存图片换脸历史记录请求', {
      userId,
      hasOriginal: !!historyItem.originalImage,
      hasResult: !!historyItem.resultImage,
      templateId: historyItem.templateId
    });
    
    // 验证必要字段
    if (!historyItem.resultImage) {
      return res.status(400).json({
        success: false,
        message: '结果图片URL不能为空'
      });
    }
    
    // 保存记录到OSS
    let recordId;
    try {
      logger.info('使用OSS存储图片换脸历史记录', { userId });
      recordId = await saveFaceFusionHistoryOSS(userId, historyItem);
      logger.info('OSS存储成功', { userId, recordId });
    } catch (storageError) {
      logger.error('图片换脸历史记录存储失败', {
        userId,
        error: storageError.message
      });
      
      return res.status(500).json({
        success: false,
        message: '保存历史记录失败',
        error: {
          type: 'storage',
          code: 'SAVE_FAILED',
          message: storageError.message
        }
      });
    }
    
    logger.info('图片换脸历史记录保存成功', {
      userId,
      recordId
    });
    
    res.json({
      success: true,
      message: '历史记录保存成功',
      data: {
        recordId
      }
    });
  } catch (error) {
    logger.error('保存图片换脸历史记录API错误', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: '保存历史记录失败: ' + error.message
    });
  }
});

/**
 * @route   DELETE /api/face-fusion-history/clear
 * @desc    清空图片换脸历史记录
 * @access  Private
 */
router.delete('/clear', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    logger.info('清空图片换脸历史记录', { userId });
    
    // 清空历史记录
    await clearFaceFusionHistoryOSS(userId);
    
    logger.info('图片换脸历史记录已清空', { userId });
    
    res.json({
      success: true,
      message: '历史记录已清空'
    });
  } catch (error) {
    logger.error('清空图片换脸历史记录失败', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: '清空历史记录失败: ' + error.message
    });
  }
});

/**
 * 格式化日期为"YYYY/MM/DD HH:mm:ss"格式
 * @param {Date} date 日期对象
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
  // 检查date是否有效
  if (!date || isNaN(date.getTime())) {
    console.warn('无效的日期对象:', date);
    // 返回当前时间作为后备
    date = new Date();
  }
  
  try {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    logger.error('格式化日期失败:', {
      date: date,
      error: error.message,
      stack: error.stack
    });
    
    // 返回当前时间格式化字符串作为后备
    const now = new Date();
    return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }
}

// 添加测试路由，用于验证路由是否正常工作
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: '图片换脸历史记录API测试成功'
  });
});

module.exports = router;

