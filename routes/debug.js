const express = require('express');
const router = express.Router();
const sequelize = require('../config/db');
const { FeatureUsage } = require('../models/FeatureUsage');
const { User } = require('../models/User');

/**
 * @route   GET /api/debug/database
 * @desc    测试数据库连接
 * @access  公开
 */
router.get('/database', async (req, res) => {
  try {
    // 测试数据库连接
    await sequelize.authenticate();
    
    // 测试查询
    const userCount = await User.count();
    const featureUsageCount = await FeatureUsage.count();
    
    res.json({
      success: true,
      message: '数据库连接正常',
      data: {
        userCount,
        featureUsageCount,
        databaseType: sequelize.getDialect(),
        databaseName: sequelize.getDatabaseName()
      }
    });
  } catch (error) {
    console.error('数据库连接测试失败:', error);
    res.status(500).json({
      success: false,
      message: '数据库连接失败',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/debug/credits-usage/:userId
 * @desc    调试特定用户的积分使用情况
 * @access  公开
 */
router.get('/credits-usage/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // 获取用户信息
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 获取功能使用记录
    const usages = await FeatureUsage.findAll({
      where: { userId },
      order: [['lastUsedAt', 'DESC']]
    });
    
    // 统计信息
    const totalCredits = usages.reduce((sum, usage) => sum + (usage.credits || 0), 0);
    const totalUsageCount = usages.reduce((sum, usage) => sum + (usage.usageCount || 0), 0);
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          credits: user.credits
        },
        usages: usages.map(usage => ({
          id: usage.id,
          featureName: usage.featureName,
          usageCount: usage.usageCount,
          credits: usage.credits,
          lastUsedAt: usage.lastUsedAt,
          details: usage.details ? JSON.parse(usage.details) : null
        })),
        summary: {
          totalCredits,
          totalUsageCount,
          featureCount: usages.length
        }
      }
    });
  } catch (error) {
    console.error('调试积分使用情况失败:', error);
    res.status(500).json({
      success: false,
      message: '调试失败',
      error: error.message
    });
  }
});

module.exports = router;
