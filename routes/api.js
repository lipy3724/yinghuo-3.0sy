const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { sequelize } = require('../config/db');
const User = require('../models/User');
const crypto = require('crypto');
const { refundImageRemovalCredits } = require('../utils/refundManager');

// 添加安全配置API端点，供前端获取配置信息 - 通用版本
router.get('/api-configs/:feature', protect, async (req, res) => {
  try {
    const feature = req.params.feature;
    
    // 所有功能使用相同的APP_KEY和SECRET_KEY
    // 只返回必要的配置信息，不包含完整的secretKey
    const config = {
      apiMap: {
        signature: '/open/api/signature' // 签名接口路径
      },
      appKey: process.env.IMAGE_REMOVAL_APP_KEY,
      // 不要直接传递secretKey到前端
    };
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('获取API配置信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配置信息失败'
    });
  }
});

// 添加API签名生成端点 - 所有功能共用
router.post('/open/api/signature', protect, async (req, res) => {
  try {
    const { timestamp, nonce } = req.body;
    
    if (!timestamp || !nonce) {
      return res.status(400).json({
        success: false,
        message: '缺少必要的参数'
      });
    }
    
    // 使用服务器上的secretKey计算签名
    const secretKey = process.env.IMAGE_REMOVAL_SECRET_KEY;
    const appKey = process.env.IMAGE_REMOVAL_APP_KEY;
    
    // 计算签名
    const signStr = `appKey=${appKey}&nonce=${nonce}&timestamp=${timestamp}`;
    const signature = crypto.createHmac('sha256', secretKey)
                           .update(signStr)
                           .digest('hex');
    
    res.json({
      success: true,
      data: {
        signature
      }
    });
  } catch (error) {
    console.error('生成API签名失败:', error);
    res.status(500).json({
      success: false,
      message: '生成签名失败'
    });
  }
});

/**
 * @route   POST /api/refund/image-removal
 * @desc    处理图像智能消除功能的退款请求
 * @access  Private
 */
router.post('/refund/image-removal', protect, async (req, res) => {
  try {
    const { taskId, reason } = req.body;
    const userId = req.user.id;
    
    if (!taskId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少任务ID参数' 
      });
    }
    
    console.log(`收到图像智能消除退款请求: 用户ID=${userId}, 任务ID=${taskId}, 原因=${reason || '未提供'}`);
    
    // 调用退款函数
    const success = await refundImageRemovalCredits(userId, taskId, reason || '前端请求退款');
    
    if (success) {
      console.log(`图像智能消除退款成功: 用户ID=${userId}, 任务ID=${taskId}`);
      return res.status(200).json({ 
        success: true, 
        message: '退款处理成功' 
      });
    } else {
      console.log(`图像智能消除退款失败: 用户ID=${userId}, 任务ID=${taskId}`);
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

// 获取用户积分
router.get('/user/credits', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId, {
      attributes: ['credits']
    });
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    res.json({ credits: user.credits });
  } catch (error) {
    console.error('获取用户积分失败:', error);
    res.status(500).json({ message: '获取用户积分失败' });
  }
});

module.exports = router; 