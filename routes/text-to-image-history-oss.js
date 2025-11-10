/**
 * 文生图片历史记录OSS路由
 * 参照智能服饰分割的历史记录实现，提供完整的OSS历史记录功能
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  saveTextToImageHistory,
  getTextToImageHistory,
  clearTextToImageHistory,
  deleteTextToImageRecord
} = require('../services/textToImageHistoryOSS');

/**
 * @route   POST /api/text-to-image/history-oss
 * @desc    保存文生图片历史记录到OSS
 * @access  私有
 */
router.post('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      prompt, 
      negativePrompt, 
      size, 
      imageUrl, 
      parameters, 
      model,
      actualPrompt,
      originalPrompt 
    } = req.body;

    // 验证必要参数
    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: '提示词不能为空'
      });
    }

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: '图片URL不能为空'
      });
    }

    console.log(`[文生图片历史记录OSS] 收到保存请求，用户ID: ${userId}`);

    // 准备记录数据
    const recordData = {
      userId,
      prompt: actualPrompt || originalPrompt || prompt,
      negativePrompt: negativePrompt || '',
      size: size || '1024*1024',
      imageUrl,
      parameters: parameters || {},
      model: model || 'wanx2.1-t2i-turbo'
    };

    // 保存到OSS
    const result = await saveTextToImageHistory(recordData);

    if (result.success) {
      console.log(`[文生图片历史记录OSS] 保存成功，记录ID: ${result.recordId}`);
      
      res.json({
        success: true,
        message: '历史记录保存成功',
        data: {
          recordId: result.recordId,
          imageUrl: result.urls.generatedImage, // 返回OSS图片URL
          metadataUrl: result.urls.metadata,
          paths: result.paths
        }
      });
    } else {
      console.error(`[文生图片历史记录OSS] 保存失败: ${result.error}`);
      
      res.status(500).json({
        success: false,
        message: '保存历史记录失败',
        error: result.error
      });
    }
  } catch (error) {
    console.error('[文生图片历史记录OSS] 保存历史记录时出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/text-to-image/history-oss
 * @desc    获取用户的文生图片历史记录
 * @access  私有
 */
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { hours = 24, limit = 50 } = req.query;

    console.log(`[文生图片历史记录OSS] 获取历史记录，用户ID: ${userId}, 查询最近${hours}小时`);

    const result = await getTextToImageHistory(userId, {
      hours: parseInt(hours),
      limit: parseInt(limit)
    });

    if (result.success) {
      console.log(`[文生图片历史记录OSS] 获取成功，用户: ${userId}, 记录数: ${result.total}`);
      
      res.json({
        success: true,
        message: '获取历史记录成功',
        data: {
          records: result.records,
          total: result.total,
          queryInfo: result.queryInfo
        }
      });
    } else {
      console.error(`[文生图片历史记录OSS] 获取失败: ${result.error}`);
      
      res.status(500).json({
        success: false,
        message: '获取历史记录失败',
        error: result.error,
        data: {
          records: [],
          total: 0
        }
      });
    }
  } catch (error) {
    console.error('[文生图片历史记录OSS] 获取历史记录时出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message,
      data: {
        records: [],
        total: 0
      }
    });
  }
});

/**
 * @route   DELETE /api/text-to-image/history-oss
 * @desc    清空用户的文生图片历史记录
 * @access  私有
 */
router.delete('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[文生图片历史记录OSS] 清空历史记录，用户ID: ${userId}`);

    const result = await clearTextToImageHistory(userId);

    if (result.success) {
      console.log(`[文生图片历史记录OSS] 清空成功，用户: ${userId}, 删除文件数: ${result.totalDeleted}`);
      
      res.json({
        success: true,
        message: `历史记录清空成功，共删除 ${result.totalDeleted} 个文件`,
        data: {
          userId: result.userId,
          totalDeleted: result.totalDeleted,
          details: result.details
        }
      });
    } else {
      console.error(`[文生图片历史记录OSS] 清空失败: ${result.error}`);
      
      res.status(500).json({
        success: false,
        message: '清空历史记录失败',
        error: result.error
      });
    }
  } catch (error) {
    console.error('[文生图片历史记录OSS] 清空历史记录时出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/text-to-image/history-oss/:recordId
 * @desc    删除指定的文生图片历史记录
 * @access  私有
 */
router.delete('/:recordId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { recordId } = req.params;

    if (!recordId) {
      return res.status(400).json({
        success: false,
        message: '记录ID不能为空'
      });
    }

    console.log(`[文生图片历史记录OSS] 删除历史记录，用户ID: ${userId}, 记录ID: ${recordId}`);

    const result = await deleteTextToImageRecord(userId, recordId);

    if (result.success) {
      console.log(`[文生图片历史记录OSS] 删除成功，记录ID: ${recordId}, 删除文件数: ${result.deletedCount}`);
      
      res.json({
        success: true,
        message: `历史记录删除成功，共删除 ${result.deletedCount} 个文件`,
        data: {
          recordId: result.recordId,
          deletedCount: result.deletedCount,
          details: result.details
        }
      });
    } else {
      console.error(`[文生图片历史记录OSS] 删除失败: ${result.error}`);
      
      res.status(500).json({
        success: false,
        message: '删除历史记录失败',
        error: result.error
      });
    }
  } catch (error) {
    console.error('[文生图片历史记录OSS] 删除历史记录时出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/text-to-image/history-oss/stats
 * @desc    获取用户的文生图片历史记录统计信息
 * @access  私有
 */
router.get('/stats', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[文生图片历史记录OSS] 获取统计信息，用户ID: ${userId}`);

    // 获取最近24小时的记录用于统计
    const result = await getTextToImageHistory(userId, { hours: 24, limit: 1000 });

    if (result.success) {
      const records = result.records;
      
      // 计算统计信息
      const stats = {
        total: records.length,
        today: records.filter(record => {
          const recordDate = new Date(record.timestamp);
          const today = new Date();
          return recordDate.toDateString() === today.toDateString();
        }).length,
        totalImages: records.reduce((sum, record) => sum + (record.stats?.totalImages || 1), 0),
        totalSize: records.reduce((sum, record) => {
          const sizes = record.stats?.imageSizes || {};
          return sum + Object.values(sizes).reduce((s, size) => s + size, 0);
        }, 0),
        models: {},
        sizes: {}
      };

      // 统计模型使用情况
      records.forEach(record => {
        const model = record.model || 'unknown';
        stats.models[model] = (stats.models[model] || 0) + 1;
      });

      // 统计图片尺寸使用情况
      records.forEach(record => {
        const size = record.size || 'unknown';
        stats.sizes[size] = (stats.sizes[size] || 0) + 1;
      });

      console.log(`[文生图片历史记录OSS] 统计信息获取成功，用户: ${userId}`);
      
      res.json({
        success: true,
        message: '统计信息获取成功',
        data: stats
      });
    } else {
      console.error(`[文生图片历史记录OSS] 获取统计信息失败: ${result.error}`);
      
      res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: result.error
      });
    }
  } catch (error) {
    console.error('[文生图片历史记录OSS] 获取统计信息时出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

module.exports = router;
