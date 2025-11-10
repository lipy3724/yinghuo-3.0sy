const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { FEATURES } = require('../middleware/featureAccess');
const { FeatureUsage } = require('../models/FeatureUsage');
const User = require('../models/User');

/**
 * @route   POST /api/feature-access/check
 * @desc    检查用户是否有权限使用特定功能（免费次数或积分）
 * @access  Private
 */
router.post('/check', protect, async (req, res) => {
  try {
    const { featureName, duration } = req.body;
    const userId = req.user.id;
    
    console.log(`检查功能访问权限: 用户ID=${userId}, 功能=${featureName}, 时长=${duration}`);
    
    // 检查功能是否存在
    const featureConfig = FEATURES[featureName];
    if (!featureConfig) {
      return res.status(400).json({
        success: false,
        message: '无效的功能名称'
      });
    }
    
    // 查找用户的功能使用记录
    let usage = await FeatureUsage.findOne({
      where: { userId, featureName }
    });
    
    // 如果没有使用记录，创建一个
    if (!usage) {
      const today = new Date().toISOString().split('T')[0];
      usage = await FeatureUsage.create({
        userId,
        featureName,
        usageCount: 0,
        lastUsedAt: new Date(),
        resetDate: today
      });
    }
    
    // 检查是否在免费使用次数内
    if (usage.usageCount < featureConfig.freeUsage) {
      console.log(`用户ID ${userId} 使用 ${featureName} 功能的免费次数检查: ${usage.usageCount}/${featureConfig.freeUsage}, 可以免费使用`);
      return res.json({
        success: true,
        usageType: 'free',
        message: '免费使用次数内，可以使用该功能',
        data: {
          freeUsageUsed: usage.usageCount,
          freeUsageLimit: featureConfig.freeUsage,
          isFree: true
        }
      });
    }
    
    // 超过免费次数，需要检查积分
    const user = await User.findByPk(userId);
    
    // 计算所需积分
    let requiredCredits = 0;
    if (featureName === 'MULTI_IMAGE_TO_VIDEO') {
      // 多图转视频：每30秒30积分，不足30秒按30秒计算
      const videoDuration = duration || 10;
      requiredCredits = Math.max(30, Math.ceil(videoDuration / 30) * 30);
    } else if (typeof featureConfig.creditCost === 'function') {
      // 其他动态计算积分的功能
      requiredCredits = featureConfig.creditCost(req.body);
    } else {
      // 固定积分消耗
      requiredCredits = featureConfig.creditCost;
    }
    
    // 检查用户积分是否足够
    if (user.credits < requiredCredits) {
      return res.status(402).json({
        success: false,
        message: '积分不足，无法使用该功能',
        data: {
          requiredCredits,
          currentCredits: user.credits,
          freeUsageLimit: featureConfig.freeUsage,
          freeUsageUsed: usage.usageCount,
          isFree: false
        }
      });
    }
    
    // 积分足够，允许使用
    return res.json({
      success: true,
      usageType: 'paid',
      message: '积分足够，可以使用该功能',
      data: {
        requiredCredits,
        currentCredits: user.credits,
        freeUsageLimit: featureConfig.freeUsage,
        freeUsageUsed: usage.usageCount,
        isFree: false
      }
    });
    
  } catch (error) {
    console.error('检查功能访问权限出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，无法检查功能访问权限',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/feature-access/check-feature-access
 * @desc    兼容旧版API路径的检查功能访问权限
 * @access  Private
 */
router.post('/check-feature-access', protect, async (req, res) => {
  try {
    const { featureName, duration } = req.body;
    const userId = req.user.id;
    
    console.log(`[兼容路径] 检查功能访问权限: 用户ID=${userId}, 功能=${featureName}, 时长=${duration}`);
    
    // 检查功能是否存在
    const featureConfig = FEATURES[featureName];
    if (!featureConfig) {
      return res.status(400).json({
        success: false,
        message: '无效的功能名称'
      });
    }
    
    // 查找用户的功能使用记录
    let usage = await FeatureUsage.findOne({
      where: { userId, featureName }
    });
    
    // 如果没有使用记录，创建一个
    if (!usage) {
      const today = new Date().toISOString().split('T')[0];
      usage = await FeatureUsage.create({
        userId,
        featureName,
        usageCount: 0,
        lastUsedAt: new Date(),
        resetDate: today
      });
    }
    
    // 检查是否在免费使用次数内
    if (usage.usageCount < featureConfig.freeUsage) {
      console.log(`[兼容路径] 用户ID ${userId} 使用 ${featureName} 功能的免费次数检查: ${usage.usageCount}/${featureConfig.freeUsage}, 可以免费使用`);
      return res.json({
        success: true,
        usageType: 'free',
        message: '免费使用次数内，可以使用该功能',
        data: {
          freeUsageUsed: usage.usageCount,
          freeUsageLimit: featureConfig.freeUsage,
          isFree: true
        }
      });
    }
    
    // 超过免费次数，需要检查积分
    const user = await User.findByPk(userId);
    
    // 计算所需积分
    let requiredCredits = 0;
    if (featureName === 'MULTI_IMAGE_TO_VIDEO') {
      // 多图转视频：每30秒30积分，不足30秒按30秒计算
      const videoDuration = duration || 10;
      requiredCredits = Math.max(30, Math.ceil(videoDuration / 30) * 30);
    } else if (typeof featureConfig.creditCost === 'function') {
      // 其他动态计算积分的功能
      requiredCredits = featureConfig.creditCost(req.body);
    } else {
      // 固定积分消耗
      requiredCredits = featureConfig.creditCost;
    }
    
    // 检查用户积分是否足够
    if (user.credits < requiredCredits) {
      return res.status(402).json({
        success: false,
        message: '积分不足，无法使用该功能',
        data: {
          requiredCredits,
          currentCredits: user.credits,
          freeUsageLimit: featureConfig.freeUsage,
          freeUsageUsed: usage.usageCount,
          isFree: false
        }
      });
    }
    
    // 积分足够，允许使用
    return res.json({
      success: true,
      usageType: 'paid',
      message: '积分足够，可以使用该功能',
      data: {
        requiredCredits,
        currentCredits: user.credits,
        freeUsageLimit: featureConfig.freeUsage,
        freeUsageUsed: usage.usageCount,
        isFree: false
      }
    });
    
  } catch (error) {
    console.error('检查功能访问权限出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，无法检查功能访问权限',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 