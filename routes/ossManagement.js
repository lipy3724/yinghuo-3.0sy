/**
 * OSS存储管理API路由
 * 提供图像编辑相关的OSS存储管理功能
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
  getQwenImageEditHistoryFromOSS, 
  deleteQwenImageEditHistoryFromOSS,
  cleanupExpiredQwenImageEditHistory 
} = require('../services/qwenImageEditHistoryOSS');
const { getOSSClient } = require('../utils/ossUtils');

/**
 * @route   GET /api/oss/qwen-image-edit/history
 * @desc    获取用户的图像编辑历史记录（从OSS）
 * @access  私有
 */
router.get('/qwen-image-edit/history', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    
    const offset = (page - 1) * limit;
    const historyRecords = await getQwenImageEditHistoryFromOSS(userId, parseInt(limit), offset);
    
    res.json({
      success: true,
      data: {
        records: historyRecords,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          hasMore: historyRecords.length === parseInt(limit)
        }
      }
    });
    
  } catch (error) {
    console.error('获取OSS历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取历史记录失败: ' + error.message
    });
  }
});

/**
 * @route   DELETE /api/oss/qwen-image-edit/history/:historyId
 * @desc    删除指定的图像编辑历史记录
 * @access  私有
 */
router.delete('/qwen-image-edit/history/:historyId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { historyId } = req.params;
    
    const result = await deleteQwenImageEditHistoryFromOSS(userId, historyId);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('删除OSS历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: '删除历史记录失败: ' + error.message
    });
  }
});

/**
 * @route   GET /api/oss/storage-info
 * @desc    获取用户的OSS存储使用情况
 * @access  私有
 */
router.get('/storage-info', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const client = getOSSClient();
    
    if (!client) {
      return res.status(500).json({
        success: false,
        message: 'OSS客户端未初始化'
      });
    }
    
    // 统计用户的存储使用情况
    const prefix = `qwen-image-edit/${userId}/`;
    
    let totalFiles = 0;
    let totalSize = 0;
    let continuationToken = null;
    
    do {
      const listParams = {
        prefix: prefix,
        'max-keys': 1000
      };
      
      if (continuationToken) {
        listParams['continuation-token'] = continuationToken;
      }
      
      const result = await client.list(listParams);
      
      if (result.objects) {
        totalFiles += result.objects.length;
        totalSize += result.objects.reduce((sum, obj) => sum + (obj.size || 0), 0);
      }
      
      continuationToken = result.nextContinuationToken;
    } while (continuationToken);
    
    res.json({
      success: true,
      data: {
        userId: userId,
        totalFiles: totalFiles,
        totalSize: totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        prefix: prefix
      }
    });
    
  } catch (error) {
    console.error('获取存储信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取存储信息失败: ' + error.message
    });
  }
});

/**
 * @route   POST /api/oss/cleanup
 * @desc    清理过期的图像编辑历史记录（管理员功能）
 * @access  私有（需要管理员权限）
 */
router.post('/cleanup', protect, async (req, res) => {
  try {
    // 检查管理员权限（这里简化处理，实际应该检查用户角色）
    if (!req.user.isAdmin && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '需要管理员权限'
      });
    }
    
    const { daysToKeep = 30 } = req.body;
    
    const result = await cleanupExpiredQwenImageEditHistory(daysToKeep);
    
    res.json({
      success: result.success,
      data: result
    });
    
  } catch (error) {
    console.error('清理过期记录失败:', error);
    res.status(500).json({
      success: false,
      message: '清理失败: ' + error.message
    });
  }
});

/**
 * @route   GET /api/oss/health
 * @desc    检查OSS连接状态
 * @access  私有
 */
router.get('/health', protect, async (req, res) => {
  try {
    const client = getOSSClient();
    
    if (!client) {
      return res.json({
        success: false,
        status: 'disconnected',
        message: 'OSS客户端未初始化'
      });
    }
    
    // 尝试列出根目录来测试连接
    try {
      await client.list({
        prefix: 'qwen-image-edit/',
        'max-keys': 1
      });
      
      res.json({
        success: true,
        status: 'connected',
        message: 'OSS连接正常',
        config: {
          region: client.options.region,
          bucket: client.options.bucket,
          secure: client.options.secure
        }
      });
    } catch (testError) {
      res.json({
        success: false,
        status: 'error',
        message: 'OSS连接测试失败: ' + testError.message
      });
    }
    
  } catch (error) {
    console.error('OSS健康检查失败:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: '健康检查失败: ' + error.message
    });
  }
});

module.exports = router;

