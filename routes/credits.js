const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { FeatureUsage } = require('../models/FeatureUsage');
const User = require('../models/User');
const PaymentOrder = require('../models/PaymentOrder');
const { protect } = require('../middleware/auth');
const { FEATURES } = require('../middleware/featureAccess');
const crypto = require('crypto'); // 用于生成签名
const { v4: uuidv4 } = require('uuid');

// 确保全局变量存在 - 用于存储图像智能消除任务信息
if (!global.imageRemovalTasks) {
  global.imageRemovalTasks = {};
}

// 确保全局变量存在 - 用于存储场景图生成任务信息
if (!global.sceneGeneratorTasks) {
  global.sceneGeneratorTasks = {};
}

// 确保全局变量存在 - 用于存储图像上色任务信息
if (!global.imageColorizationTasks) {
  global.imageColorizationTasks = {};
}

// 确保全局变量存在 - 用于存储局部重绘任务信息
if (!global.localRedrawTasks) {
  global.localRedrawTasks = {};
}

// 确保全局变量存在 - 用于存储全局风格化任务信息
if (!global.globalStyleTasks) {
  global.globalStyleTasks = {};
}

// 确保全局变量存在 - 用于存储垫图任务信息
if (!global.diantuTasks) {
  global.diantuTasks = {};
}

// 确保全局变量存在 - 用于存储模特换肤任务信息
if (!global.modelSkinChangerTasks) {
  global.modelSkinChangerTasks = {};
}

// 确保全局变量存在 - 用于存储模特试衣任务信息
if (!global.clothingSimulationTasks) {
  global.clothingSimulationTasks = {};
}

// 确保全局变量存在 - 用于存储智能服饰分割任务信息
if (!global.clothingSegmentationTasks) {
  global.clothingSegmentationTasks = {};
}

// 确保全局变量存在 - 用于存储智能虚拟模特试穿任务信息
if (!global.virtualModelVtonTasks) {
  global.virtualModelVtonTasks = {};
}

// 确保全局变量存在 - 用于存储鞋靴虚拟试穿任务信息
if (!global.virtualShoeModelTasks) {
  global.virtualShoeModelTasks = {};
}

// 确保全局变量存在 - 用于存储文生图片任务信息
if (!global.textToImageTasks) {
  global.textToImageTasks = {};
}

// 确保全局变量存在 - 用于存储指令编辑任务信息
if (!global.imageEditTasks) {
  global.imageEditTasks = {};
}

// 确保全局变量存在 - 用于存储文生视频任务信息
if (!global.textToVideoTasks) {
  global.textToVideoTasks = {};
}

const db = require('../config/db');
const logger = require('../utils/logger');
const axios = require('axios'); // 添加axios用于直接HTTP请求

// PayPal SDK配置
const paypal = require('@paypal/paypal-server-sdk');
// 正确引入支付宝SDK v3.2.0版本
const AlipaySdk = require('alipay-sdk').default;
const AlipayFormData = require('alipay-sdk/lib/form').default;
// 引入支付宝API相关类 - 使用官方SDK中的类

// 修改支付宝SDK引入方式 - 直接使用官方SDK的原始类
const { 
  default: AlipayClient, 
  AlipayTradeQueryResponse, 
  WebAlipayTradeQueryResponse 
} = require('alipay-sdk/lib/alipay');

// 确保使用正确的原始API
const AlipayApi = require('alipay-sdk/lib/alipay').default;

// 日志调试支付宝SDK版本
logger.info('AlipaySdk version:', { version: require('alipay-sdk/package.json').version });
logger.info('支付宝SDK配置:', { 
  appId: process.env.ALIPAY_APP_ID,
  // 不输出私钥内容
  privateKeyLength: process.env.ALIPAY_PRIVATE_KEY ? process.env.ALIPAY_PRIVATE_KEY.length : 0,
  signType: 'RSA2',
  // 不输出公钥内容
  publicKeyLength: process.env.ALIPAY_PUBLIC_KEY ? process.env.ALIPAY_PUBLIC_KEY.length : 0
});

// 支付宝支付配置
const isSandbox = false; // 设置为false使用正式环境
const gateway = 'https://openapi.alipay.com/gateway.do'; // 直接使用正式网关

// 支付宝支付配置 - 使用3.x版本的初始化方式
const alipaySdk = new AlipaySdk({
    appId: process.env.ALIPAY_APP_ID,
    privateKey: process.env.ALIPAY_PRIVATE_KEY,
    signType: 'RSA2',
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
    gateway: gateway,
    timeout: 30000, // 增加超时时间到30秒
    camelcase: true
});

// 创建直接访问API的客户端实例 - 按照CSDN文章方式初始化
// 这个是文档提到的标准做法
const directAlipayClient = new AlipayClient({
    appId: process.env.ALIPAY_APP_ID,
    privateKey: process.env.ALIPAY_PRIVATE_KEY,
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY, 
    gateway: gateway,
    timeout: 60000, // 设置更长的超时时间
    charset: 'UTF-8',
    version: '1.0',
    signType: 'RSA2'
});

/**
 * @route   GET /api/credits
 * @desc    获取当前用户积分和使用情况
 * @access  私有
 */
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 获取用户信息
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'credits', 'lastRechargeTime']
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 获取当天日期
    const today = new Date().toISOString().split('T')[0];
    
    // 获取用户所有功能的使用情况
    const usages = await FeatureUsage.findAll({
      where: { userId }
    });
    
    // 按功能整理使用情况
    const featureUsages = {};
    Object.keys(FEATURES).forEach(featureName => {
      const usage = usages.find(u => u.featureName === featureName);
      const config = FEATURES[featureName];
      
      // 计算剩余免费次数 - 不再考虑resetDate，直接根据总使用次数计算
      let remainingFreeUsage = config.freeUsage;
      if (usage) {
        remainingFreeUsage = Math.max(0, config.freeUsage - usage.usageCount);
      }
      
      featureUsages[featureName] = {
        name: featureName,
        creditCost: config.creditCost,
        freeUsageLimit: config.freeUsage,
        remainingFreeUsage: remainingFreeUsage,
        lastUsed: usage ? usage.lastUsedAt : null
      };
    });
    
    // 返回用户积分和使用情况
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          credits: user.credits,
          lastRechargeTime: user.lastRechargeTime
        },
        featureUsages
      }
    });
  } catch (error) {
    console.error('获取积分信息错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，获取积分信息失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/credits/recharge
 * @desc    为用户充值积分
 * @access  私有
 */
router.post('/recharge', protect, async (req, res) => {
  const { amount, paymentMethod, transactionId } = req.body;
  const userId = req.user.id;
  
  // 验证充值金额
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: '请输入有效的充值金额'
    });
  }
  
  try {
    // 在实际应用中，这里应该调用支付API进行实际扣款
    // 为演示目的，我们假设支付已成功
    
    // 更新用户积分
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 更新积分和充值时间
    user.credits += parseInt(amount);
    user.lastRechargeTime = new Date();
    await user.save();
    
    // 返回更新后的积分信息
    res.json({
      success: true,
      message: '积分充值成功',
      data: {
        credits: user.credits,
        rechargeAmount: amount,
        lastRechargeTime: user.lastRechargeTime
      }
    });
  } catch (error) {
    console.error('积分充值错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，积分充值失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/credits/pricing
 * @desc    获取所有功能的价格信息
 * @access  公开
 */
router.get('/pricing', (req, res) => {
  // 创建价格列表
  const pricing = Object.keys(FEATURES).map(featureName => {
    const feature = FEATURES[featureName];
    return {
      name: featureName,
      creditCost: feature.creditCost,
      freeUsage: feature.freeUsage
    };
  });
  
  res.json({
    success: true,
    data: {
      pricing
    }
  });
});

/**
 * 检查是否为开发者账号(lilili1119)的中间件
 */
const checkDeveloper = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['username']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 只允许lilili1119用户访问开发者功能
    if (user.username !== 'lilili1119') {
      return res.status(403).json({
        success: false,
        message: '无访问权限'
      });
    }

    next();
  } catch (error) {
    console.error('检查开发者权限错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @route   POST /api/credits/dev/set-credits
 * @desc    开发者模式 - 设置用户积分
 * @access  私有 (仅开发者账号)
 */
router.post('/dev/set-credits', protect, checkDeveloper, async (req, res) => {
  const { amount } = req.body;
  const userId = req.user.id;
  
  // 验证积分金额
  if (amount === undefined || isNaN(amount)) {
    return res.status(400).json({
      success: false,
      message: '请输入有效的积分数量'
    });
  }
  
  try {
    // 更新用户积分
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 设置积分
    user.credits = parseInt(amount);
    await user.save();
    
    // 返回更新后的积分信息
    res.json({
      success: true,
      message: '积分设置成功',
      data: {
        credits: user.credits
      }
    });
  } catch (error) {
    console.error('开发者模式设置积分错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，积分设置失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/credits/dev/reset-usage
 * @desc    开发者模式 - 重置功能使用次数
 * @access  私有 (仅开发者账号)
 */
router.post('/dev/reset-usage', protect, checkDeveloper, async (req, res) => {
  const { featureName } = req.body;
  const userId = req.user.id;
  
  try {
    // 如果是重置所有功能
    if (featureName === 'all') {
      // 重置该用户的所有功能使用记录
      await FeatureUsage.destroy({
        where: { userId }
      });
      
      return res.json({
        success: true,
        message: '已重置所有功能的使用次数'
      });
    }
    
    // 验证功能是否存在
    if (!FEATURES[featureName]) {
      return res.status(400).json({
        success: false,
        message: '无效的功能名称'
      });
    }
    
    // 删除特定功能的使用记录
    await FeatureUsage.destroy({
      where: {
        userId,
        featureName
      }
    });
    
    res.json({
      success: true,
      message: `已重置 ${featureName} 的使用次数`
    });
  } catch (error) {
    console.error('开发者模式重置功能使用次数错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，重置功能使用次数失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/credits/track-usage
 * @desc    记录功能使用情况（用于编辑器功能）
 * @access  私有
 */
router.post('/track-usage', protect, async (req, res) => {
  const { action, featureName } = req.body;
  const userId = req.user.id;
  
  // 验证功能名称
  if (!featureName || !FEATURES[featureName]) {
    return res.status(400).json({
      success: false,
      message: '无效的功能名称'
    });
  }

  try {
    // 获取功能配置
    const featureConfig = FEATURES[featureName];
    
    // 获取当天日期，仅用于记录
    const today = new Date().toISOString().split('T')[0];
    
    // 查找或创建该用户对该功能的使用记录
    let [usage, created] = await FeatureUsage.findOrCreate({
      where: {
        userId,
        featureName
      },
      defaults: {
        usageCount: 0,
        lastUsedAt: new Date(),
        resetDate: today
      }
    });

    // 如果是仅查看页面(page_view)不计入使用次数
    const isPageView = action === 'page_view';
    
    if (isPageView) {
      // 页面访问不扣费，只返回当前状态
      return res.json({
        success: true,
        data: {
          featureName,
          usageType: 'page_view',
          creditCost: 0,
          remainingFreeUsage: Math.max(0, featureConfig.freeUsage - usage.usageCount),
          freeUsageLimit: featureConfig.freeUsage,
          freeUsageUsed: usage.usageCount
        }
      });
    }

    // 计算积分消耗（使用与统一中间件相同的逻辑）
    let creditCost = 0;
    if (typeof featureConfig.creditCost === 'function') {
      // 对于任务完成后扣费的功能，在track-usage时使用固定积分
      if (featureName === 'FACE_FUSION') {
        creditCost = 5; // 图片换脸功能固定5积分
      } else {
      creditCost = featureConfig.creditCost(req.body);
      }
    } else {
      creditCost = featureConfig.creditCost;
    }

    // 检查是否在免费使用次数内
    let usageType = 'free';
    let finalCreditCost = 0;
    
    if (usage.usageCount >= featureConfig.freeUsage) {
      // 超过免费次数，检查用户积分
      const user = await User.findByPk(userId);
      
      if (user.credits < creditCost) {
        return res.status(402).json({
          success: false,
          message: '您的免费试用次数已用完，积分不足',
          data: {
            requiredCredits: creditCost,
            currentCredits: user.credits,
            freeUsageLimit: featureConfig.freeUsage,
            freeUsageUsed: usage.usageCount
          }
        });
      }
      
      // 扣除积分
      user.credits -= creditCost;
      await user.save();
      
      usageType = 'paid';
      finalCreditCost = creditCost;
      
      console.log(`用户ID ${userId} 使用 ${featureName} 功能，扣除 ${creditCost} 积分，剩余 ${user.credits} 积分`);
    } else {
      console.log(`用户ID ${userId} 使用 ${featureName} 功能的免费次数 ${usage.usageCount + 1}/${featureConfig.freeUsage}`);
    }
    
    // 更新使用次数
    usage.usageCount += 1;
    usage.lastUsedAt = new Date();
    await usage.save();

    // 保存任务详情到数据库
    try {
      const details = JSON.parse(usage.details || '{}');
      const tasks = details.tasks || [];
      
      // 生成或使用传入的任务ID
      const taskId = req.body.taskId || `${featureName}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      // 检查任务是否已存在，避免重复添加
      const taskExists = tasks.some(t => t.taskId === taskId);
      if (taskExists) {
        console.log(`任务ID=${taskId}已存在，跳过添加`);
      } else {
        // 添加新任务
        tasks.push({
          taskId: taskId,
          creditCost: finalCreditCost,
          isFree: usageType === 'free',
          timestamp: new Date(),
          createdAt: new Date().toISOString() // 添加创建时间戳，便于调试
        });
        
        // 更新usage记录 - 更新details字段但不重复累加积分
        // 积分已在上面扣除，这里不需要再次累加
        usage.details = JSON.stringify({
          ...details,
          tasks: tasks
        });
        
        await usage.save();
        console.log(`任务详情已保存: 功能=${featureName}, 任务ID=${taskId}, 积分=${finalCreditCost}, 是否免费=${usageType === 'free'}`);
      }
      
      // 保存任务详情到全局变量（为了兼容现有逻辑）
      const taskInfo = {
        userId: userId,
        taskId: taskId, // 显式保存任务ID
        creditCost: finalCreditCost,
        hasChargedCredits: usageType === 'paid',
        isFree: usageType === 'free',
        timestamp: new Date()
      };

      // 根据功能类型保存到对应的全局变量
      switch (featureName) {
        case 'scene-generator':
          if (!global.sceneGeneratorTasks) global.sceneGeneratorTasks = {};
          global.sceneGeneratorTasks[taskId] = taskInfo;
          break;
        case 'image-removal':
          if (!global.imageRemovalTasks) global.imageRemovalTasks = {};
          global.imageRemovalTasks[taskId] = taskInfo;
          break;
        case 'marketing-images':
          if (!global.marketingImagesTasks) global.marketingImagesTasks = {};
          global.marketingImagesTasks[taskId] = taskInfo;
          break;
        case 'translate':
          if (!global.translateTasks) global.translateTasks = {};
          global.translateTasks[taskId] = taskInfo;
          break;
        // 可以根据需要添加更多功能
      }
      
      // 返回结果
      res.json({
        success: true,
        data: {
          featureName,
          usageType,
          creditCost: finalCreditCost,
          isFree: usageType === 'free',
          remainingFreeUsage: Math.max(0, featureConfig.freeUsage - usage.usageCount),
          freeUsageLimit: featureConfig.freeUsage,
          freeUsageUsed: usage.usageCount,
          taskId: taskId
        }
      });
    } catch (e) {
      console.error('保存任务详情失败:', e);
      res.status(500).json({
        success: false,
        message: '服务器错误，无法保存任务详情'
      });
    }
  } catch (error) {
    console.error(`功能 ${featureName} 使用记录处理错误:`, error);
    res.status(500).json({
      success: false,
      message: '服务器错误，无法验证功能访问权限'
    });
  }
});

/**
 * 计算用户积分消费的正确总值
 * @param {Array} tasks 所有任务记录
 * @param {Array} refunds 所有退款记录
 * @returns {Number} 正确的积分消费总值
 */
/**
 * 计算正确的总积分消费
 * 此函数是计算积分消费的唯一标准方法
 * @param {Array} tasks 任务记录数组
 * @param {Array} refunds 退款记录数组
 * @returns {Number} 计算出的总积分消费
 */
function calculateCorrectTotalCredits(tasks, refunds = []) {
  // 如果没有任务记录，返回0
  if (!tasks || !tasks.length) return 0;
  
  console.log(`开始计算总积分消费，任务数量: ${tasks.length}, 退款数量: ${refunds.length}`);
  
  // 创建一个Map来存储每个任务ID的积分消费
  const taskCreditsMap = new Map();
  
  // 创建一个Set来跟踪已处理的任务ID
  const processedTaskIds = new Set();
  
  // 创建一个Set来跟踪免费任务ID
  const freeTaskIds = new Set();
  
  // 遍历所有任务，记录积分消费
  for (const task of tasks) {
    // 跳过没有任务ID的记录
    if (!task.taskId) {
      console.log(`跳过没有任务ID的记录`);
      continue;
    }
    
    // 如果已处理过此任务ID，跳过
    if (processedTaskIds.has(task.taskId)) {
      console.log(`跳过重复任务ID: ${task.taskId}`);
      continue;
    }
    
    // 标记此任务ID已处理
    processedTaskIds.add(task.taskId);
    
    // 跳过免费任务
    if (task.isFree) {
      console.log(`跳过免费任务: ${task.taskId}`);
      freeTaskIds.add(task.taskId);
      continue;
    }
    
    // 优先使用standardCreditCost字段（如果存在），否则使用creditCost
    const creditCost = task.standardCreditCost !== undefined ? 
      task.standardCreditCost : 
      (task.creditCost || 0);
    
    // 如果积分消费为0，跳过
    if (creditCost <= 0) {
      console.log(`跳过零积分任务: ${task.taskId}, 积分=${creditCost}`);
      continue;
    }
    
    // 记录任务的积分消费，如果已存在则使用最大值
    if (taskCreditsMap.has(task.taskId)) {
      const existingCost = taskCreditsMap.get(task.taskId);
      const newCost = Math.max(existingCost, creditCost);
      console.log(`更新任务积分: ${task.taskId}, 原积分=${existingCost}, 新积分=${creditCost}, 取最大值=${newCost}`);
      taskCreditsMap.set(task.taskId, newCost);
    } else {
      console.log(`添加任务积分: ${task.taskId}, 积分=${creditCost}`);
      taskCreditsMap.set(task.taskId, creditCost);
    }
  }
  
  // 处理退款记录，从总积分消费中减去退款的积分
  for (const refund of refunds) {
    if (refund.taskId && taskCreditsMap.has(refund.taskId)) {
      console.log(`移除已退款任务: ${refund.taskId}, 退还积分=${taskCreditsMap.get(refund.taskId)}`);
      taskCreditsMap.delete(refund.taskId);
    }
  }
  
  // 计算总积分消费
  let totalCredits = 0;
  for (const [taskId, creditCost] of taskCreditsMap.entries()) {
    console.log(`计入总积分: 任务ID=${taskId}, 积分=${creditCost}`);
    totalCredits += creditCost;
  }
  
  // 确保总积分消费为整数
  const roundedTotal = Math.round(totalCredits);
  console.log(`计算完成，原始总积分=${totalCredits}, 四舍五入后=${roundedTotal}`);
  return roundedTotal;
}

/**
 * 生成图表数据，确保总和为指定值
 * @param {Array} labels 日期标签数组
 * @param {Number} totalValue 总积分值
 * @param {Array} tasks 任务记录，用于按日期分配积分
 * @returns {Array} 生成的图表数据数组
 */
function generateChartData(labels, totalValue, tasks = null) {
  if (!labels || !labels.length) return [];
  
  // 创建一个与labels长度相同的数组，初始值为0
  const data = new Array(labels.length).fill(0);
  
  // 如果有任务记录，尝试根据任务日期分配积分
  if (tasks && tasks.length > 0 && totalValue > 0) {
    // 创建日期到索引的映射
    const dateToIndexMap = new Map();
    labels.forEach((label, index) => {
      dateToIndexMap.set(label, index);
    });
    
    // 按任务日期分配积分
    const tasksByDate = new Map();
    for (const task of tasks) {
      if (!task.timestamp || task.isFree) continue;
      
      const taskDate = new Date(task.timestamp);
      const dateKey = taskDate.toISOString().split('T')[0].substring(5); // 格式为MM-DD
      
      if (dateToIndexMap.has(dateKey)) {
        const creditCost = task.creditCost || 0;
        if (creditCost <= 0) continue;
        
        if (tasksByDate.has(dateKey)) {
          tasksByDate.set(dateKey, tasksByDate.get(dateKey) + creditCost);
        } else {
          tasksByDate.set(dateKey, creditCost);
        }
      }
    }
    
    // 计算分配的总积分
    let allocatedCredits = 0;
    for (const [dateKey, credits] of tasksByDate.entries()) {
      const index = dateToIndexMap.get(dateKey);
      data[index] = credits;
      allocatedCredits += credits;
    }
    
    // 如果分配的积分与总积分不一致，调整数据
    if (Math.abs(allocatedCredits - totalValue) > 0.01) {
      // 计算调整因子
      const adjustmentFactor = totalValue / allocatedCredits;
      
      // 调整每天的积分消费
      for (let i = 0; i < data.length; i++) {
        if (data[i] > 0) {
          data[i] = Math.round(data[i] * adjustmentFactor);
        }
      }
      
      // 确保总和等于totalValue
      let currentSum = data.reduce((sum, value) => sum + value, 0);
      let diff = totalValue - currentSum;
      
      // 如果还有差异，调整最后一个非零值
      if (diff !== 0) {
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i] > 0) {
            data[i] += diff;
            break;
          }
        }
      }
    }
  } else if (totalValue > 0) {
    // 如果没有任务记录但有总积分，使用默认分配方式
    const dataLength = data.length;
    if (dataLength < 3) {
      // 如果数据点太少，均匀分配
      const perDayValue = Math.floor(totalValue / dataLength);
      for (let i = 0; i < dataLength; i++) {
        data[i] = perDayValue;
      }
      // 将剩余的积分分配给最后一天
      data[dataLength - 1] += totalValue - perDayValue * dataLength;
    } else {
      // 最后三天分配积分，模拟最近的消费
      data[dataLength - 1] = Math.round(totalValue * 0.37); // 最后一天 37%
      data[dataLength - 2] = Math.round(totalValue * 0.55); // 倒数第二天 55%
      data[dataLength - 3] = totalValue - data[dataLength - 1] - data[dataLength - 2]; // 倒数第三天，确保总和为totalValue
    }
  }
  
  return data;
}

/**
 * @route   GET /api/credits/usage
 * @desc    获取用户积分使用历史记录
 * @access  私有
 */
router.get('/usage', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days) || 30; // 默认查询30天内记录
    
    // 获取当前日期和指定天数前的日期
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // 创建日期标签和空数据数组（用于图表显示）
    const dateLabels = [];
    const usageData = [];
    
    // 生成从开始日期到今天的所有日期
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      dateLabels.push(d.toISOString().split('T')[0].substring(5)); // 格式为MM-DD
      usageData.push(0); // 初始化为0
    }
    
    // 获取用户的所有功能使用记录，不限时间范围，包含ID字段用于后续更新
    const usages = await FeatureUsage.findAll({
      where: { userId },
      attributes: ['id', 'featureName', 'usageCount', 'lastUsedAt', 'resetDate', 'credits', 'details']
    });
    
    // 初始化功能使用统计
    let featureUsageStats = {};
    let usageRecords = [];
    
    // 跟踪总积分消费和总使用次数
    let totalCreditsUsed = 0;
    let totalAllTimeCreditsUsed = 0;
    let totalUsageCount = 0;
    
    // 收集所有任务和退款记录，用于准确计算积分消费
    let allTasks = [];
    let allRefunds = [];
    
    // 使用Set跟踪已处理的任务ID，避免重复计算
    const processedTaskIdsForTotal = new Set();
    
    // 添加跟踪统计
    console.log(`开始处理用户ID=${userId}的积分使用统计，总共${usages.length}条功能使用记录`);
    
    // 从featureAccess模块获取功能配置
    const { FEATURES } = require('../middleware/featureAccess');
    
    // 处理每种功能
    Object.keys(FEATURES).forEach(featureName => {
      // 初始化该功能的使用情况
      let totalFeatureCreditCost = 0;
      let allTimeFeatureCreditCost = 0;
      
      // 查找该功能的所有使用记录
      const featureUsages = usages.filter(u => u.featureName === featureName);
      
      console.log(`开始处理${featureName}功能的积分统计，用户ID: ${userId}`);
      
      // 如果没有使用记录，则跳过
      if (!featureUsages || featureUsages.length === 0) {
        return;
      }
      
      // 使用第一条记录作为主要记录（用于获取details等信息）
      const usage = featureUsages[0];
      // 初始化任务列表变量，确保每个功能都有这个变量
      let tasks = [];
      
      // 计算该功能的总积分消费（不受时间范围限制）- 使用所有记录的总和
      allTimeFeatureCreditCost = featureUsages.reduce((sum, u) => sum + (u.credits || 0), 0);
      
      console.log(`开始处理${featureName}功能的积分统计，用户ID: ${userId}`);
      
      // 从数据库details字段获取任务记录
      if (usage.details) {
        try {
          const details = JSON.parse(usage.details);
          console.log(`成功解析${featureName}功能的details字段:`, details ? '有数据' : '无数据');
          
          // 获取退款记录
          const refunds = details.refunds || [];
          
          // 收集所有退款记录，用于准确计算积分消费
          if (refunds.length > 0) {
            allRefunds = [...allRefunds, ...refunds];
          }
          
          if (details && details.tasks && Array.isArray(details.tasks)) {
            console.log(`${featureName}功能的details中包含${details.tasks.length}条任务记录`);
            
            // 先排序任务按时间从新到旧
            details.tasks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // 收集所有任务记录，用于准确计算积分消费
            // 为每个任务添加功能名称标记，方便后续分析
            const tasksWithFeatureName = details.tasks.map(task => ({
              ...task,
              featureNameTag: featureName
            }));
            allTasks = [...allTasks, ...tasksWithFeatureName];
            
            // 过滤出时间范围内的任务
            tasks = details.tasks.filter(task => 
              new Date(task.timestamp) >= startDate
            );
            
            console.log(`${featureName}功能过滤后在时间范围内的任务数量: ${tasks.length}`);
            
            // 获取任务ID集合，用于去重 - 这很重要，防止任务被重复计算
            const taskIds = new Set(tasks.map(task => task.taskId));
            console.log(`从数据库获取到${tasks.length}条${featureName}任务记录，唯一任务ID数量: ${taskIds.size}`);
            
            // 进行去重处理 - 始终执行去重，防止多个记录条目引用同一任务ID
            console.log(`对${featureName}功能的任务记录进行去重处理`);
            const uniqueTasks = [];
            const processedTaskIds = new Set();
            
            // 首先获取每个任务ID对应的最新任务记录
            const taskMap = new Map();
            for (const task of tasks) {
              const taskId = task.taskId;
              if (!taskId) continue; // 跳过没有任务ID的记录
              
              // 如果已经处理过此任务ID，则跳过
              if (processedTaskIds.has(taskId)) {
                console.log(`跳过重复任务ID: ${taskId}`);
                continue;
              }
              
              // 标记此任务ID已处理
              processedTaskIds.add(taskId);
              
              // 如果是首次遇到此任务ID或者此任务更新，则更新记录
              if (!taskMap.has(taskId) || 
                  (task.creditUpdated && !taskMap.get(taskId).creditUpdated) ||
                  (task.timestamp && new Date(task.timestamp) > new Date(taskMap.get(taskId).timestamp || 0))) {
                taskMap.set(taskId, task);
              }
            }
            
            // 将最新的任务记录添加到结果中
            for (const task of taskMap.values()) {
              uniqueTasks.push(task);
            }
            
            console.log(`${featureName}功能去重后任务数量从${tasks.length}减少到${uniqueTasks.length}`);
            tasks = uniqueTasks;
            
            // 计算时间范围内的积分消费 - 只统计非免费使用且未退款的积分消费
            // 获取已记录的任务ID，用于防止重复计算
            const recordedTaskIds = details.recordedTaskIds || [];
            console.log(`${featureName}功能已记录的任务ID数量: ${recordedTaskIds.length}`);
            
            // 使用Set来跟踪已处理的任务ID，防止重复计算
            const taskIdTracker = new Set();
            
            totalFeatureCreditCost = tasks.reduce((total, task) => {
              const taskId = task.taskId;
              
              // 如果没有任务ID或已处理过此任务，跳过
              if (!taskId || taskIdTracker.has(taskId) || processedTaskIdsForTotal.has(taskId)) {
                return total;
              }
              
              // 标记此任务ID已处理
              taskIdTracker.add(taskId);
              processedTaskIdsForTotal.add(taskId);
              
              // 如果是免费使用，则不计入积分消费
              if (task.isFree) {
                console.log(`跳过免费使用的任务ID=${taskId || '未知'}, 积分=0`);
                return total;
              }
              
              // 检查这个任务是否已经被退款
              const isRefunded = refunds.some(refund => refund.taskId === taskId);
              if (isRefunded) {
                console.log(`跳过已退款的任务ID=${taskId || '未知'}, 积分=0`);
                return total;
              }
              
              const cost = task.creditCost || 0;
              console.log(`统计付费任务ID=${taskId || '未知'}, 功能=${featureName}, 积分=${cost}`);
              return total + cost;
            }, 0);
            console.log(`从${featureName}功能的任务记录计算的时间范围内积分消费: ${totalFeatureCreditCost}`);
          }
        } catch (parseError) {
          console.error(`解析${featureName}功能的details字段失败:`, parseError);
        }
      }
        
        // 将每次任务作为单独的使用记录
        if (tasks.length > 0) {
          console.log(`将${featureName}功能的${tasks.length}条任务添加到使用记录中`);
          
          // 获取退款记录
          let refunds = [];
          if (usage && usage.details) {
            try {
              const details = JSON.parse(usage.details);
              refunds = details.refunds || [];
            } catch (e) {
              console.error(`解析${featureName}功能的退款记录失败:`, e);
            }
          }
          
          // 使用Set跟踪已添加到usageData的任务ID，避免重复计算
          const addedToUsageDataTaskIds = new Set();
          
          tasks.forEach(task => {
            // 检查这个任务是否已经被退款
            const isRefunded = refunds.some(refund => refund.taskId === task.taskId);
            if (isRefunded) {
              console.log(`跳过已退款的任务: ${task.taskId}`);
              return; // 跳过已退款的任务，不添加到使用记录中
            }
            
            // 免费使用时积分为0
            const creditCost = task.isFree ? 0 : (task.creditCost || 0);
            const taskDate = new Date(task.timestamp || now);
            
            // 优先使用任务中的操作描述字段
            let description = task.operationText || `使用${getLocalFeatureName(featureName)}功能`;
            
            // 如果没有操作描述，根据功能类型生成不同的描述
            if (!task.operationText) {
                if (featureName === 'DIGITAL_HUMAN_VIDEO') {
                    // 🔧 修复视频时长显示问题：优先从extraData中获取视频时长
                    let videoDuration = 0;
                    
                    // 优先级顺序：extraData.videoDuration > extraData.originalVideoDuration > task直接字段
                    if (task.extraData && task.extraData.videoDuration) {
                        videoDuration = task.extraData.videoDuration;
                        console.log(`视频数字人使用extraData.videoDuration: ${videoDuration}秒`);
                    } else if (task.extraData && task.extraData.originalVideoDuration) {
                        videoDuration = task.extraData.originalVideoDuration;
                        console.log(`视频数字人使用extraData.originalVideoDuration: ${videoDuration}秒`);
                    } else {
                        videoDuration = task.videoDuration || task.duration || task.actualDuration || 0;
                        console.log(`视频数字人使用直接字段: ${videoDuration}秒`);
                    }
                    
                    // 如果仍然是0，使用默认值
                    if (videoDuration === 0) {
                        videoDuration = 3; // 默认3秒
                        console.log(`视频数字人时长为0，使用默认值: ${videoDuration}秒`);
                    }
                    
                    description = `生成${Math.ceil(videoDuration)}秒视频`;
                } else if (featureName === 'MULTI_IMAGE_TO_VIDEO') {
                    // 从任务元数据中获取视频时长信息
                    let duration = 0;
                    if (task.metadata && task.metadata.duration) {
                        duration = task.metadata.duration;
                    } else {
                        duration = task.actualDuration || task.duration || task.videoDuration || 0;
                    }
                    description = `处理${duration}秒视频`;
                } else if (featureName === 'VIDEO_SUBTITLE_REMOVER' || featureName === 'VIDEO_STYLE_REPAINT') {
                    // 🔧 重要修复：优先使用已保存的操作描述，确保显示原始视频时长
                    if (task.operationText) {
                      description = task.operationText;
                      console.log(`使用已保存的操作描述: ${description}`);
                    } else {
                      // 视频风格重绘和视频相关功能可能在多个字段保存了视频时长
                      // 🔧 核心修复：优先使用originalVideoDuration（原始上传视频时长）
                      // 而不是apiProcessedDuration或actualDuration（API处理后的时长）
                      let duration = task.originalVideoDuration || task.videoDuration || task.actualDuration || task.duration || 
                                    (task.extraData && task.extraData.videoDuration ? task.extraData.videoDuration : 0);
                      
                      console.log(`视频时长字段优先级: originalVideoDuration=${task.originalVideoDuration}, videoDuration=${task.videoDuration}, actualDuration=${task.actualDuration}, 最终使用=${duration}`);
                      
                      // 特别针对视频风格重绘，从任务详情中寻找更多可能的字段
                      if (featureName === 'VIDEO_STYLE_REPAINT' && duration === 0) {
                        // 如果没找到时长信息，尝试查看是否有分辨率和计算的积分信息来估算时长
                        const creditCost = task.creditCost || 0;
                        const resolution = task.resolution || task.min_len || 540;
                        const rate = resolution <= 540 ? 3 : 6;
                        
                        // 如果有积分信息和费率，可以反推时长
                        if (creditCost > 0 && rate > 0) {
                          duration = Math.ceil(creditCost / rate);
                          console.log(`通过积分和费率估算视频时长: ${creditCost}积分 / ${rate}积分/秒 = ${duration}秒`);
                        }
                      }
                      
                      description = `处理${Math.ceil(duration)}秒视频`;
                    }
                } else if (featureName === 'image-removal') {
                    description = '图像智能消除';
                }
            }
            
            // 🔧 修复积分使用记录显示逻辑：使用任务创建时已确定的免费状态，避免重复计算导致状态混乱
            let displayCredits;
            let isActuallyFree;
            
            // 修复局部重绘功能显示免费的问题
            if (featureName === 'LOCAL_REDRAW') {
              // 局部重绘功能特殊处理
              // 检查任务状态和实际积分消费
              if (task.status === 'completed' || task.status === 'SUCCEEDED') {
                // 已完成的任务，检查积分消费
                const { FEATURES } = require('../middleware/featureAccess');
                const featureConfig = FEATURES[featureName];
                
                // 修复免费状态判断逻辑
                // 如果是第一次使用，显示免费
                if (task.isFree === true) {
                  displayCredits = "免费";
                  isActuallyFree = true;
                } else {
                  // 非免费使用，显示标准积分
                  displayCredits = featureConfig.creditCost;
                  isActuallyFree = false;
                  
                  // 打印日志，记录局部重绘付费使用情况
                  console.log(`局部重绘付费使用: 任务ID=${task.taskId}, 积分=${displayCredits}, 是否免费=${isActuallyFree}`); 
                }
              } else {
                // 未完成的任务，显示待定
                displayCredits = "待定";
                isActuallyFree = task.isFree || false;
              }
            } else if (featureName === 'IMAGE_EDIT') {
              // 🔧 指令编辑功能特殊处理（与局部重绘类似）
              // 指令编辑是创建时扣费的功能
              if (task.status === 'completed' || task.status === 'SUCCEEDED' || task.status === 'failed' || task.status === 'FAILED') {
                // 已完成或失败的任务，检查积分消费
                const { FEATURES } = require('../middleware/featureAccess');
                const featureConfig = FEATURES[featureName];
                
                // 修复免费状态判断逻辑
                // 如果是第一次使用，显示免费
                if (task.isFree === true) {
                  displayCredits = "免费";
                  isActuallyFree = true;
                  console.log(`指令编辑免费使用: 任务ID=${task.taskId}, 积分=免费, isFree=${task.isFree}, status=${task.status}`);
                } else if (task.creditCost === 0 && task.isFree !== false) {
                  // 如果creditCost是0且isFree不是明确的false，可能是首次免费使用
                  displayCredits = "免费";
                  isActuallyFree = true;
                  console.log(`指令编辑首次免费使用(creditCost=0): 任务ID=${task.taskId}, 积分=免费, status=${task.status}`);
                } else {
                  // 非免费使用，显示标准积分
                  displayCredits = featureConfig.creditCost;
                  isActuallyFree = false;
                  console.log(`指令编辑付费使用: 任务ID=${task.taskId}, 积分=${displayCredits}, isFree=${task.isFree}, creditCost=${task.creditCost}, status=${task.status}`);
                }
              } else {
                // 未完成的任务，显示待定
                displayCredits = "待定";
                isActuallyFree = task.isFree || false;
                console.log(`指令编辑任务进行中: 任务ID=${task.taskId}, 积分=待定, status=${task.status}`);
              }
            } else if (task.isFree === true) {
              // 真正的免费使用（任务创建时已正确判断）
              displayCredits = "免费";
              isActuallyFree = true;
            } else if (task.creditCost === 0 || creditCost === 0) {
              // 防重复扣费导致的0积分（超过免费次数但因修复而不扣费）
              // 需要从功能配置中获取标准积分消费
              const { FEATURES } = require('../middleware/featureAccess');
              const featureConfig = FEATURES[featureName];
              let standardCost = featureConfig?.creditCost || 0;
              
              // 🔧 修复图生视频和文生视频功能的积分显示问题
              if (typeof standardCost === 'function') {
                // 对于图生视频和文生视频等功能，固定显示66积分
                if (featureName === 'image-to-video' || featureName === 'text-to-video') {
                  standardCost = 66;
                } else {
                  // 其他函数类型的积分计算，调用函数获取默认值
                  standardCost = standardCost({}) || 0;
                }
              }
              
              displayCredits = standardCost;
              isActuallyFree = false;
            } else {
              // 正常的付费使用
              displayCredits = creditCost;
              isActuallyFree = false;
            }
            
            // 添加单独的使用记录
            // 特殊处理视频数字人功能，确保记录显示在使用记录中
            const isDigitalHumanVideo = featureName === 'DIGITAL_HUMAN_VIDEO';
            if (isDigitalHumanVideo) {
              console.log(`添加视频数字人使用记录: 任务ID=${task.taskId}, 状态=${task.status}, 积分=${displayCredits}, 是否免费=${isActuallyFree}, 时间=${taskDate.toLocaleString('zh-CN')}`);
            }
            
            usageRecords.push({
              date: taskDate.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              }).replace(/\//g, '-'),
              timestamp: taskDate.getTime(),
              feature: getLocalFeatureName(featureName),
              description: description,
              credits: displayCredits, // 使用修复后的显示逻辑
              isFree: isActuallyFree, // 使用修复后的免费标记
              taskId: task.taskId, // 添加任务ID，方便调试
              status: task.status, // 添加任务状态，方便调试
              featureNameTag: featureName // 添加原始功能名称标记，便于调试
            });
            
            // 特殊处理局部重绘功能，记录日志
            if (featureName === 'LOCAL_REDRAW') {
              console.log(`局部重绘使用记录: 任务ID=${task.taskId}, 状态=${task.status}, 积分=${displayCredits}, 是否免费=${isActuallyFree}, 原始免费状态=${task.isFree}`);
            }
            
            // 更新对应日期的使用量 - 仅统计非免费使用且未退款的任务
            // 对于免费使用或已退款任务，不更新积分消费数据
            if (!task.isFree && !addedToUsageDataTaskIds.has(task.taskId)) {
              // 优先使用standardCreditCost字段（如果存在），否则使用creditCost
              const numericCreditCost = task.standardCreditCost !== undefined ? 
                task.standardCreditCost : 
                (typeof creditCost === 'number' ? creditCost : 0);
                
              if (numericCreditCost > 0) {
                const dateIndex = dateLabels.findIndex(date => 
                  date === taskDate.toISOString().split('T')[0].substring(5)
                );
                if (dateIndex !== -1) {
                  // 添加日志，跟踪每次积分添加前后的值
                  const beforeValue = usageData[dateIndex];
                  
                  // 特别处理文生视频和图生视频功能，确保免费任务不计入积分
                  if (featureName === 'text-to-video' || featureName === 'image-to-video') {
                    console.log(`处理${featureName === 'text-to-video' ? '文生视频' : '图生视频'}任务: ID=${task.taskId}, 是否免费=${task.isFree}, 积分=${numericCreditCost}${task.standardCreditCost !== undefined ? ' (标准积分)' : ''}`);
                    // 再次确认这不是免费任务
                    if (task.isFree === true || numericCreditCost <= 0) {
                      console.log(`跳过免费${featureName === 'text-to-video' ? '文生视频' : '图生视频'}任务: ${task.taskId}`);
                      return; // 跳过此次循环，不添加积分
                    }
                  }
                  
                  // 特别处理视频去字幕功能，确保免费任务不计入积分 - 参照文生视频的处理逻辑
                  if (featureName === 'VIDEO_SUBTITLE_REMOVER') {
                    console.log(`处理视频去字幕任务: ID=${task.taskId}, 是否免费=${task.isFree}, 积分=${numericCreditCost}`);
                    // 再次确认这不是免费任务
                    if (task.isFree === true || numericCreditCost <= 0) {
                      console.log(`跳过免费视频去字幕任务: ${task.taskId}`);
                      return; // 跳过此次循环，不添加积分
                    }
                  }
                  
                  // 确保任务不是免费的，且有有效的积分消费
                  if (task.isFree === true || numericCreditCost <= 0) {
                    console.log(`跳过零积分或免费任务: ID=${task.taskId}, 功能=${featureName}, 积分=${numericCreditCost}, 是否免费=${task.isFree}`);
                    return; // 跳过此次循环，不添加积分
                  }
                  
                  usageData[dateIndex] += numericCreditCost;
                  console.log(`添加积分到日期 ${dateLabels[dateIndex]}: 任务ID=${task.taskId}, 功能=${featureName}, 积分=${numericCreditCost}${task.standardCreditCost !== undefined ? ' (标准积分)' : ''}, 之前=${beforeValue}, 之后=${usageData[dateIndex]}`);
                  
                  // 标记此任务ID已添加到usageData，防止重复计算
                  addedToUsageDataTaskIds.add(task.taskId);
                }
              }
            } else if (task.isFree) {
              console.log(`跳过免费任务积分计算: 任务ID=${task.taskId}, 功能=${featureName}`);
            }
          });
        }
      
      // 记录最终统计结果
      console.log(`${featureName}功能统计完成 - 任务数量:${tasks.length}, 积分消费:${totalFeatureCreditCost}`);
      
      // 开始处理图片翻译功能的积分统计，用户ID: ${userId}
      if (featureName === 'translate') {
        // 图片翻译功能的特殊处理
        // 修复积分计算重复问题，仅使用实际任务数量
        let actualUsageCount = 0;
        
        // 如果有任务记录，使用任务的数量而不是数据库中的usageCount
        if (tasks && tasks.length > 0) {
          // 对于图片翻译，统计实际任务数即可，数据库记录可能重复
          actualUsageCount = tasks.length;
          console.log(`图片翻译功能使用任务数量作为实际使用次数: ${actualUsageCount}`);
        } else {
          // 没有任务记录则使用所有数据库记录的总和
          actualUsageCount = featureUsages.reduce((sum, u) => sum + (u.usageCount || 0), 0);
        }
        
        // 将实际使用次数应用到featureUsageStats
        featureUsageStats[featureName] = {
          name: getLocalFeatureName(featureName),
          credits: totalFeatureCreditCost,
          count: actualUsageCount,
          usageCount: actualUsageCount
        };
        
        // 累加总积分消费和总使用次数
        totalCreditsUsed += totalFeatureCreditCost;
        totalAllTimeCreditsUsed += allTimeFeatureCreditCost;
        totalUsageCount += actualUsageCount;
        
        console.log(`设置${featureName}功能的最终统计次数: ${featureUsageStats[featureName].usageCount}`);
      } 
      // 开始处理图生视频功能的积分统计，用户ID: ${userId}
      else if (featureName === 'image-to-video') {
        // 图生视频功能的特殊处理
        // 修复积分计算重复问题，仅使用实际任务数量
        let actualUsageCount = 0;
        
        // 对于图生视频功能，需要特别处理details格式
        if (usage.details) {
          try {
            const details = JSON.parse(usage.details);
            
            // 处理两种数据格式：
            // 1. 新格式：{ tasks: [...], refunds: [...] }
            // 2. 旧格式：直接是任务数组 [...]
            if (details.tasks && Array.isArray(details.tasks)) {
              // 新格式
              tasks = details.tasks;
            } else if (Array.isArray(details)) {
              // 旧格式：直接是任务数组
              tasks = details;
            }
            
            console.log(`图生视频功能解析到${tasks.length}条任务记录`);
          } catch (e) {
            console.error(`解析图生视频功能的details字段失败:`, e);
          }
        }
        
        // 计算图生视频功能的积分消费
        if (tasks && tasks.length > 0) {
          // 🔧 修复重复记录问题：使用Map去重，只保留每个taskId的最新记录
          const taskMap = new Map();
          tasks.forEach(task => {
            const existingTask = taskMap.get(task.taskId);
            // 如果不存在或新任务状态为completed，则更新
            if (!existingTask || task.status === 'completed' || task.status === 'SUCCEEDED') {
              taskMap.set(task.taskId, task);
            }
          });
          
          // 使用去重后的任务数组
          const uniqueTasks = Array.from(taskMap.values());
          actualUsageCount = uniqueTasks.length;
          
          console.log(`图生视频功能原始任务数: ${tasks.length}, 去重后任务数: ${uniqueTasks.length}`);
          
          // 计算积分消费：遍历去重后的任务记录，累加非免费任务的积分
          uniqueTasks.forEach(task => {
            if (!task.isFree && task.creditCost > 0) {
              totalFeatureCreditCost += task.creditCost;
            }
          });
          
          // 更新tasks为去重后的数组，供后续使用记录使用
          tasks = uniqueTasks;
          
          console.log(`图生视频功能使用任务数量作为实际使用次数: ${actualUsageCount}, 积分消费: ${totalFeatureCreditCost}`);
        } else {
          // 没有任务记录则使用所有数据库记录的总和
          actualUsageCount = featureUsages.reduce((sum, u) => sum + (u.usageCount || 0), 0);
          // 如果没有任务记录，使用数据库中的积分记录
          totalFeatureCreditCost = allTimeFeatureCreditCost;
        }
        
        // 将实际使用次数应用到featureUsageStats
        featureUsageStats[featureName] = {
          name: getLocalFeatureName(featureName),
          credits: totalFeatureCreditCost,
          count: actualUsageCount,
          usageCount: actualUsageCount
        };
        
        // 累加总积分消费和总使用次数
        totalCreditsUsed += totalFeatureCreditCost;
        totalAllTimeCreditsUsed += allTimeFeatureCreditCost;
        totalUsageCount += actualUsageCount;
        
        console.log(`设置${featureName}功能的最终统计次数: ${featureUsageStats[featureName].usageCount}, 积分: ${totalFeatureCreditCost}`);
        
        // 🔧 修复重复记录问题：图生视频的使用记录已在通用逻辑中添加（第1017-1233行），这里不需要再添加
        // 通用逻辑已经处理了去重、时间过滤、状态过滤等所有逻辑
        console.log(`图生视频功能的使用记录已在通用逻辑中添加，跳过重复添加`)
      } 
      // 特别处理图片高清放大功能(IMAGE_SHARPENING)
      // 🔧 修复重复记录问题：移除text-to-video和image-to-video，因为它们已经在通用逻辑中处理了
      else if (featureName === 'IMAGE_SHARPENING' || featureName === 'image-upscaler' || featureName === 'IMAGE_COLORIZATION' || 
               featureName === 'GLOBAL_STYLE' || featureName === 'LOCAL_REDRAW' || featureName === 'DIANTU' ||
               featureName === 'MULTI_IMAGE_TO_VIDEO' || featureName === 'VIDEO_STYLE_REPAINT' || featureName === 'DIGITAL_HUMAN_VIDEO' || 
               featureName === 'VIRTUAL_SHOE_MODEL' || featureName === 'VIDEO_SUBTITLE_REMOVER') {
        // 图片和视频相关功能的特殊处理（图片高清放大、图片上色、全局风格化、局部重绘、垫图、多图转视频、视频风格重绘）
        // 修复积分计算重复问题，仅使用实际任务数量
        let actualUsageCount = 0;
        
        // 如果有任务记录，使用任务的数量而不是数据库中的usageCount
        if (tasks && tasks.length > 0) {
          // 获取退款记录
          let refunds = [];
          if (usage && usage.details) {
            try {
              const details = JSON.parse(usage.details);
              refunds = details.refunds || [];
            } catch (e) {
              console.error(`解析${featureName}功能的退款记录失败:`, e);
            }
          }
          
          // 统计未退款的任务数作为实际使用次数
          const nonRefundedTasks = tasks.filter(task => {
            return !refunds.some(refund => refund.taskId === task.taskId);
          });
          actualUsageCount = nonRefundedTasks.length;
          
          // 根据功能名称设置显示名称
          let featureNameDisplay = '';
          switch(featureName) {
            case 'IMAGE_COLORIZATION': 
              featureNameDisplay = '图片上色'; 
              break;
            case 'IMAGE_SHARPENING':
            case 'image-upscaler':
              featureNameDisplay = '图片高清放大';
              break;
            case 'GLOBAL_STYLE':
              featureNameDisplay = '全局风格化';
              break;
            case 'LOCAL_REDRAW':
              featureNameDisplay = '局部重绘';
              break;
            case 'DIANTU':
              featureNameDisplay = '垫图';
              break;
            case 'DIGITAL_HUMAN_VIDEO':
              featureNameDisplay = '视频数字人';
              break;
            case 'VIRTUAL_SHOE_MODEL':
              featureNameDisplay = '鞋靴虚拟试穿';
              break;
            case 'VIDEO_SUBTITLE_REMOVER':
              featureNameDisplay = '视频去除字幕';
              break;
            default:
              featureNameDisplay = getLocalFeatureName(featureName);
          }
          
          console.log(`${featureNameDisplay}功能使用未退款任务数量作为实际使用次数: ${actualUsageCount} (总任务数: ${tasks.length}, 退款数: ${tasks.length - actualUsageCount})`);
          
          // 计算免费任务和付费任务的数量（只计算未退款的任务）
          const freeTasks = nonRefundedTasks.filter(task => task.isFree === true);
          const paidTasks = nonRefundedTasks.filter(task => !task.isFree);
          console.log(`${featureNameDisplay}功能免费任务数: ${freeTasks.length}, 付费任务数: ${paidTasks.length}`);
          
          // 验证积分消费是否正确
          const calculatedCost = paidTasks.reduce((sum, task) => {
            // 优先使用standardCreditCost字段（如果存在），否则使用creditCost
            const cost = task.standardCreditCost !== undefined ? task.standardCreditCost : (task.creditCost || 0);
            return sum + cost;
          }, 0);
          console.log(`${featureNameDisplay}功能积分计算: 从任务计算=${calculatedCost}，当前值=${totalFeatureCreditCost}`);
          
          // 始终使用从任务计算得出的积分消费，这样可以确保免费任务不会被计入
          totalFeatureCreditCost = calculatedCost;
          
          // 特别处理文生视频功能，确保积分计算正确
          if (featureName === 'text-to-video' || featureName === 'image-to-video') {
            console.log(`${featureName === 'text-to-video' ? '文生视频' : '图生视频'}功能特殊处理: 付费任务数=${paidTasks.length}, 免费任务数=${freeTasks.length}`);
            
            // 再次验证积分计算是否正确
            const verifiedCost = paidTasks.reduce((sum, task) => {
              // 优先使用standardCreditCost字段（如果存在），否则使用creditCost
              const cost = task.standardCreditCost !== undefined ? task.standardCreditCost : (task.creditCost || 0);
              console.log(`${featureName === 'text-to-video' ? '文生视频' : '图生视频'}付费任务: ID=${task.taskId}, 积分=${cost}${task.standardCreditCost !== undefined ? ' (标准积分)' : ''}`);
              return sum + cost;
            }, 0);
            
            console.log(`${featureName === 'text-to-video' ? '文生视频' : '图生视频'}功能积分再次验证: ${verifiedCost}`);
            
            // 如果验证的积分与计算的积分不一致，使用验证的积分
            if (verifiedCost !== totalFeatureCreditCost) {
              console.log(`${featureName === 'text-to-video' ? '文生视频' : '图生视频'}功能积分计算不一致，使用验证值: ${verifiedCost}，原值: ${totalFeatureCreditCost}`);
              totalFeatureCreditCost = verifiedCost;
            }
            
            // 确保免费任务不会被计入积分消费
            freeTasks.forEach(task => {
              console.log(`${featureName === 'text-to-video' ? '文生视频' : '图生视频'}免费任务确认: ID=${task.taskId}, 积分=0`);
              // 确保此任务在usageData中不会被计入积分
              task.creditCost = 0;
              task.standardCreditCost = 0;
              task.isFree = true;
            });
          }
          
          // 特别处理视频去字幕功能，确保积分计算正确 - 参照文生视频的处理逻辑
          if (featureName === 'VIDEO_SUBTITLE_REMOVER') {
            console.log(`视频去字幕功能特殊处理: 付费任务数=${paidTasks.length}, 免费任务数=${freeTasks.length}`);
            
            // 再次验证积分计算是否正确
            const verifiedCost = paidTasks.reduce((sum, task) => {
              const cost = task.creditCost || 0;
              console.log(`视频去字幕付费任务: ID=${task.taskId}, 积分=${cost}`);
              return sum + cost;
            }, 0);
            
            console.log(`视频去字幕功能积分再次验证: ${verifiedCost}`);
            
            // 如果验证的积分与计算的积分不一致，使用验证的积分
            if (verifiedCost !== totalFeatureCreditCost) {
              console.log(`视频去字幕功能积分计算不一致，使用验证值: ${verifiedCost}，原值: ${totalFeatureCreditCost}`);
              totalFeatureCreditCost = verifiedCost;
            }
            
            // 确保免费任务不会被计入积分消费
            freeTasks.forEach(task => {
              console.log(`视频去字幕免费任务确认: ID=${task.taskId}, 积分=0`);
              // 确保此任务在usageData中不会被计入积分
              task.creditCost = 0;
              task.isFree = true;
            });
          }
          
          // 更新任务列表，确保免费任务正确标记
          for (const task of tasks) {
            if (task.isFree === undefined) {
              console.log(`发现未标记是否免费的任务ID=${task.taskId || '未知'}，检查积分值确定是否免费`);
              task.isFree = !task.creditCost || task.creditCost === 0;
              console.log(`根据积分值${task.creditCost}将任务标记为${task.isFree ? '免费' : '付费'}`);
            }
          }
        } else {
          // 没有任务记录则使用所有数据库记录的总和
          actualUsageCount = featureUsages.reduce((sum, u) => sum + (u.usageCount || 0), 0);
          
          // 根据功能名称设置显示名称
          let featureNameDisplay = '';
          switch(featureName) {
            case 'IMAGE_COLORIZATION': 
              featureNameDisplay = '图片上色'; 
              break;
            case 'IMAGE_SHARPENING':
            case 'image-upscaler':
              featureNameDisplay = '图片高清放大';
              break;
            case 'GLOBAL_STYLE':
              featureNameDisplay = '全局风格化';
              break;
            case 'LOCAL_REDRAW':
              featureNameDisplay = '局部重绘';
              break;
            case 'DIANTU':
              featureNameDisplay = '垫图';
              break;
            case 'DIGITAL_HUMAN_VIDEO':
              featureNameDisplay = '视频数字人';
              break;
            case 'VIRTUAL_SHOE_MODEL':
              featureNameDisplay = '鞋靴虚拟试穿';
              break;
            default:
              featureNameDisplay = getLocalFeatureName(featureName);
          }
          
          console.log(`${featureNameDisplay}功能没有任务记录，使用数据库记录的使用次数: ${actualUsageCount}`);
        }
        
        // 确保功能统计数据正确反映实际使用情况，包括免费使用和付费使用
        // 计算免费和付费任务数量（如果有任务记录）
        let freeTaskCount = 0;
        let paidTaskCount = 0;
        
        if (tasks && tasks.length > 0) {
          // 获取退款记录
          let refunds = [];
          if (usage && usage.details) {
            try {
              const details = JSON.parse(usage.details);
              refunds = details.refunds || [];
            } catch (e) {
              console.error(`解析${featureName}功能的退款记录失败:`, e);
            }
          }
          
          // 统计未退款的任务
          const nonRefundedTasks = tasks.filter(task => {
            return !refunds.some(refund => refund.taskId === task.taskId);
          });
          
          freeTaskCount = nonRefundedTasks.filter(task => task.isFree === true).length;
          paidTaskCount = nonRefundedTasks.filter(task => !task.isFree).length;
        }
        
        // 对于垫图功能，使用所有数据库记录的usageCount字段总和，而不是计算的actualUsageCount
        // 因为垫图功能包含免费使用，应该计入总使用次数
        let finalUsageCount = actualUsageCount;
        if (featureName === 'DIANTU') {
          const totalUsageCount = featureUsages.reduce((sum, u) => sum + (u.usageCount || 0), 0);
          if (totalUsageCount > 0) {
            finalUsageCount = totalUsageCount;
            console.log(`垫图功能使用所有数据库记录的usageCount总和: ${finalUsageCount}，而不是计算的actualUsageCount: ${actualUsageCount}`);
          }
        }
        
        featureUsageStats[featureName] = {
          name: getLocalFeatureName(featureName),
          credits: totalFeatureCreditCost,
          count: finalUsageCount,
          usageCount: finalUsageCount,
          freeTasks: freeTaskCount,
          paidTasks: paidTaskCount
        };
        
        // 仅累加付费使用的积分消费
        totalCreditsUsed += totalFeatureCreditCost;
        totalAllTimeCreditsUsed += allTimeFeatureCreditCost;
        totalUsageCount += finalUsageCount;
        
        console.log(`设置${featureName}功能的最终统计: 总次数=${featureUsageStats[featureName].usageCount}, 积分消费=${totalFeatureCreditCost}, 免费次数=${freeTaskCount}, 付费次数=${paidTaskCount}`);
      } else {
        // 获取正确的使用次数 - 对于大多数功能，我们应该使用实际任务数
        // 对于亚马逊助手功能，需要额外处理可能出现的重复计数问题
        let actualUsageCount;
        
        // 对于亚马逊类型的功能，使用任务数作为实际使用次数，避免前端重复记录问题
        if (featureName.startsWith('amazon_') || featureName === 'product_comparison' || 
            featureName === 'product_improvement_analysis' || featureName === 'fba_claim_email') {
          // 使用去重后的任务数作为实际使用次数，防止重复计数
          actualUsageCount = tasks.length > 0 ? tasks.length : featureUsages.reduce((sum, u) => sum + (u.usageCount || 0), 0);
          console.log(`亚马逊助手功能${featureName}使用任务数作为实际使用次数: ${actualUsageCount}`);
        } 
        // 🔧 修复文生视频使用次数统计问题：使用任务数量而不是数据库记录
        else if (featureName === 'text-to-video') {
          // 文生视频功能使用任务数作为实际使用次数
          actualUsageCount = tasks.length > 0 ? tasks.length : featureUsages.reduce((sum, u) => sum + (u.usageCount || 0), 0);
          console.log(`文生视频功能使用任务数作为实际使用次数: ${actualUsageCount} (任务数: ${tasks.length})`);
        }
        else {
          // 其他功能仍然使用所有数据库记录的使用次数总和
          actualUsageCount = featureUsages.reduce((sum, u) => sum + (u.usageCount || 0), 0);
        }
        
        // 对于数字人视频等特殊功能，已经在任务记录中计算了积分消费，直接使用任务记录的积分总和
        // 🔧 修复重复处理问题：移除image-to-video（它有专门的处理分支），添加text-to-video到这里处理
        if (featureName === 'DIGITAL_HUMAN_VIDEO' || featureName === 'MULTI_IMAGE_TO_VIDEO' || 
            featureName === 'VIDEO_SUBTITLE_REMOVER' || featureName === 'VIDEO_STYLE_REPAINT' ||
            featureName === 'text-to-video' ||
            featureName === 'image-expansion' || featureName === 'IMAGE_SHARPENING' ||
            featureName === 'image-upscaler' || featureName === 'scene-generator' ||
            featureName === 'marketing-images' || featureName === 'translate' || featureName === 'cutout' ||
            featureName === 'VIRTUAL_MODEL_VTON' || featureName === 'IMAGE_COLORIZATION' ||
            featureName === 'GLOBAL_STYLE' || featureName === 'DIANTU' || featureName === 'image-removal' ||
            featureName === 'LOCAL_REDRAW' || featureName === 'VIRTUAL_SHOOT') {
          
          // 获取退款记录
          let refunds = [];
          if (usage && usage.details) {
            try {
              const details = JSON.parse(usage.details);
              refunds = details.refunds || [];
            } catch (e) {
              console.error(`解析${featureName}功能的退款记录失败:`, e);
            }
          }
          
          // 使用Set跟踪已处理的任务ID，避免重复计算
          const taskIdTracker = new Set();
          
          totalFeatureCreditCost = tasks.reduce((total, task) => {
            const taskId = task.taskId;
            
            // 如果没有任务ID或已处理过此任务，跳过
            if (!taskId || taskIdTracker.has(taskId)) {
              return total;
            }
            
            // 标记此任务ID已处理
            taskIdTracker.add(taskId);
            
            // 如果是免费使用，则不计入积分消费
            if (task.isFree) {
              console.log(`跳过免费使用的任务ID=${taskId || '未知'}, 积分=0`);
              return total;
            }
            
            // 检查任务是否已退款
            const isRefunded = refunds.some(refund => refund.taskId === taskId);
            if (isRefunded) {
              console.log(`跳过已退款的任务ID=${taskId || '未知'}, 积分=${task.creditCost || 0}`);
              return total;
            }
            
            const creditCost = task.creditCost || 0;
            console.log(`计算任务ID=${taskId || '未知'}, 积分=${creditCost}`);
            return total + creditCost;
          }, 0);
        }
        // 对于其他功能，仍然使用数据库记录的积分消费
        else if (usage && usage.credits > 0) {
          // 总积分使用最准确的来源是数据库记录
          totalFeatureCreditCost = usage.credits;
          console.log(`使用数据库记录的${featureName}功能积分消费作为最终统计: ${totalFeatureCreditCost}`);
        }
        
        console.log(`${featureName}功能最终使用次数: ${actualUsageCount} (数据库记录: ${usage ? usage.usageCount : 0}, 任务数: ${tasks.length})`);
        
        // 将功能记录添加到统计数据中
        featureUsageStats[featureName] = {
          name: getLocalFeatureName(featureName),
          credits: totalFeatureCreditCost,
          count: actualUsageCount,
          usageCount: actualUsageCount
        };
        
        // 累加总使用次数，但不要重复累加积分（已经在上面累加过了）
        totalUsageCount += actualUsageCount;
        
        console.log(`设置${featureName}功能的最终统计次数: ${featureUsageStats[featureName].usageCount}`);
        console.log(`${featureName}功能统计完成 - 任务数量:${tasks.length}, 积分消费:${totalFeatureCreditCost}`);
      }
    });
    
    // 按日期降序排序
    usageRecords.sort((a, b) => {
      const tb = b.timestamp !== undefined ? b.timestamp : new Date(b.date).getTime();
      const ta = a.timestamp !== undefined ? a.timestamp : new Date(a.date).getTime();
      return tb - ta;
    });
    
    // 调试日志：检查视频数字人功能的使用记录
    const digitalHumanRecords = usageRecords.filter(record => record.featureNameTag === 'DIGITAL_HUMAN_VIDEO');
    console.log(`视频数字人功能使用记录数量: ${digitalHumanRecords.length}`);
    if (digitalHumanRecords.length > 0) {
      digitalHumanRecords.forEach((record, index) => {
        console.log(`视频数字人记录[${index}]: 任务ID=${record.taskId}, 状态=${record.status}, 积分=${record.credits}, 是否免费=${record.isFree}, 时间=${record.date}`);
      });
    } else {
      console.log('未找到视频数字人功能的使用记录，检查数据库和任务记录');
    }
    
    // 计算功能使用百分比
    const featureUsage = [];
    
    // 修改逻辑：即使totalCreditsUsed为0，也显示功能使用情况
    // 定义不同功能的颜色 - 使用完全不同的鲜明颜色方案
    const colors = {
      // 主要原色系
      'image-upscaler': 'rgb(220, 53, 69)',        // 图像高清放大 - 鲜红色
      'text-to-video': 'rgb(176, 15, 20)',         // 文生视频 - 深红色
      'VIDEO_STYLE_REPAINT': 'rgb(240, 96, 96)',   // 视频风格重绘 - 浅红色
      
      // 橙色系
      'VIDEO_SUBTITLE_REMOVER': 'rgb(253, 126, 20)', // 视频去除字幕 - 橙色
      'cutout': 'rgb(255, 193, 7)',                // 商品换背景 - 金黄色
      'IMAGE_EDIT': 'rgb(214, 158, 46)',           // 图像指令编辑 - 金棕色
      
      // 黄色系
      'amazon_review_analysis': 'rgb(255, 236, 0)',  // 亚马逊客户评论分析 - 鲜黄色
      
      // 绿色系 - 使用不同色调
      'translate': 'rgb(16, 185, 129)',            // 图片翻译 - 蓝绿色
      'image-expansion': 'rgb(170, 222, 40)',      // 智能扩图 - 黄绿色（柠檬绿）
      'IMAGE_SHARPENING': 'rgb(40, 167, 69)',      // 模糊图片变清晰 - 深绿色
      'IMAGE_COLORIZATION': 'rgb(0, 230, 118)',    // 图像上色 - 浅绿色
      
      // 蓝色系 - 使用不同色调
      'DIGITAL_HUMAN_VIDEO': 'rgb(7, 71, 166)',    // 视频数字人 - 深蓝色
      'scene-generator': 'rgb(32, 156, 238)',      // 场景图生成 - 天蓝色
      'GLOBAL_STYLE': 'rgb(0, 123, 255)',          // 全局风格化 - 亮蓝色
      'image-to-video': 'rgb(13, 71, 161)',        // 图生视频 - 海军蓝
      'marketing-images': 'rgb(83, 109, 254)',     // AI营销图生成 - 靛蓝色
      
      // 青色系
      'VIRTUAL_MODEL_VTON': 'rgb(0, 188, 212)',    // 智能虚拟模特试穿 - 青色
      
      // 紫色系 - 使用不同色调
      'model-skin-changer': 'rgb(139, 92, 246)',   // 模特换肤 - 紫色
      'CLOTH_SEGMENTATION': 'rgb(96, 19, 186)',    // 智能服饰分割 - 深紫色
      'MULTI_IMAGE_TO_VIDEO': 'rgb(186, 104, 200)', // 多图转视频 - 淡紫色
      'LOCAL_REDRAW': 'rgb(233, 30, 99)',          // 局部重绘 - 粉红色
      
      // 棕色系
      'clothing-simulation': 'rgb(130, 74, 54)',   // 模拟试衣 - 棕色
      
      // 灰黑系
      'image-removal': 'rgb(52, 58, 64)',          // 图像智能消除 - 深灰色
      'DIANTU': 'rgb(73, 80, 87)',                 // 垫图 - 灰色
      
      // 亚马逊功能相关颜色
      'amazon_video_script': 'rgb(75, 192, 192)',     // 亚马逊广告视频脚本生成
      'product_improvement_analysis': 'rgb(255, 159, 64)', // 选品的改款分析和建议
      'amazon_brand_info': 'rgb(54, 162, 235)',      // 品牌信息收集和总结
      'amazon_brand_naming': 'rgb(255, 99, 132)',    // 亚马逊品牌起名
      'amazon_listing': 'rgb(255, 206, 86)',         // 亚马逊Listing写作与优化
      'amazon_search_term': 'rgb(153, 102, 255)',    // 亚马逊后台搜索词
      'amazon_review_analysis': 'rgb(255, 159, 64)', // 亚马逊客户评论分析
      'amazon_consumer_insights': 'rgb(54, 162, 235)', // 亚马逊消费者洞察专家
      'amazon_customer_email': 'rgb(255, 99, 132)',  // 亚马逊客户邮件回复
      'fba_claim_email': 'rgb(75, 192, 192)',    // FBA索赔邮件
      'amazon_review_generator': 'rgb(153, 102, 255)', // 亚马逊评论生成
      'amazon_review_response': 'rgb(255, 159, 64)', // 亚马逊评论回复
      'product_comparison': 'rgb(255, 159, 64)',     // 产品对比
      'amazon_post_creator': 'rgb(75, 192, 192)',    // 创建亚马逊Post
      'amazon_keyword_recommender': 'rgb(153, 102, 255)', // 亚马逊关键词推荐
      'amazon_case_creator': 'rgb(255, 159, 64)',     // 亚马逊客服case内容
    };
    
    Object.keys(featureUsageStats).forEach(key => {
      const stat = featureUsageStats[key];
      // 只添加有积分消费或者有成功任务的功能记录
      // 如果积分为0且使用次数大于0，说明可能是免费使用或者已退款，需要进一步判断
      if (stat.count > 0) {
        // 对于鞋靴虚拟试穿等功能，如果积分为0但使用次数大于0，检查是否有成功的任务
        if (stat.credits === 0 && stat.count > 0) {
          // 检查是否有成功的任务记录
          const usage = usages.find(u => u.featureName === key);
          let hasSuccessfulTasks = false;
          
          if (usage && usage.details) {
            try {
              const details = JSON.parse(usage.details);
              
              // 处理两种数据格式：
              // 1. 新格式：{ tasks: [...], refunds: [...] }
              // 2. 旧格式：直接是任务数组 [...]
              let tasks = [];
              let refunds = [];
              
              if (details.tasks && Array.isArray(details.tasks)) {
                // 新格式
                tasks = details.tasks;
                refunds = details.refunds || [];
              } else if (Array.isArray(details)) {
                // 旧格式：直接是任务数组
                tasks = details;
                refunds = [];
              }
              
              if (tasks.length > 0) {
                // 检查是否有成功的任务（没有退款记录的任务）
                hasSuccessfulTasks = tasks.some(task => {
                  // 如果没有退款记录，或者退款记录中没有包含这个任务，则认为是成功的
                  if (!refunds || !Array.isArray(refunds)) {
                    return true; // 没有退款记录，任务是成功的
                  }
                  return !refunds.some(refund => refund.taskId === task.taskId);
                });
              }
            } catch (e) {
              console.error(`解析功能 ${key} 的详情失败:`, e);
            }
          }
          
          // 如果没有成功的任务，跳过显示
          if (!hasSuccessfulTasks) {
            console.log(`功能 ${key} 积分为0且无成功任务，跳过显示`);
            return;
          }
        }
        
        // 为多图转视频功能添加usageCount属性，用于前端统计
        const item = {
          name: stat.name,
          credits: stat.credits,
          percentage: totalCreditsUsed > 0 ? parseFloat(((stat.credits / totalCreditsUsed) * 100).toFixed(2)) : 0,
          color: colors[key] || 'rgb(107, 114, 128)' // 默认颜色
        };
        
        // 为所有功能添加使用次数属性
          item.usageCount = stat.count;
        
        // 记录日志
        if (key === 'DIGITAL_HUMAN_VIDEO') {
          console.log(`添加视频数字人使用次数: ${stat.count}`);
        } else if (key === 'MULTI_IMAGE_TO_VIDEO') {
          console.log(`添加多图转视频使用次数: ${stat.count}`);
        } else if (key === 'VIDEO_STYLE_REPAINT') {
          console.log(`添加视频风格重绘使用次数: ${stat.count}`);
        } else if (key === 'VIDEO_SUBTITLE_REMOVER') {
          console.log(`添加视频去除字幕使用次数: ${stat.count}`);
        } else if (key === 'VIRTUAL_SHOE_MODEL') {
          console.log(`添加鞋靴虚拟试穿使用次数: ${stat.count}, 积分: ${stat.credits}`);
        }
        
        featureUsage.push(item);
      }
    });
    
    // 按使用次数降序排序 (如果积分消费都是0，则按使用次数排序)
    if (totalCreditsUsed === 0) {
      featureUsage.sort((a, b) => {
        const statA = featureUsageStats[Object.keys(featureUsageStats).find(key => 
          featureUsageStats[key].name === a.name)];
        const statB = featureUsageStats[Object.keys(featureUsageStats).find(key => 
          featureUsageStats[key].name === b.name)];
        return statB.count - statA.count;
      });
    } else {
      // 按消费积分降序排序
      featureUsage.sort((a, b) => b.credits - a.credits);
    }
    
    // 验证步骤：确保总积分与各功能积分之和一致
    let sumOfFeatureCredits = 0;
    Object.keys(featureUsageStats).forEach(key => {
      const stat = featureUsageStats[key];
      if (stat && stat.credits > 0) {
        sumOfFeatureCredits += stat.credits;
        console.log(`功能 ${stat.name || key} 积分消费: ${stat.credits}`);
      }
    });
    console.log(`各功能积分之和: ${sumOfFeatureCredits}, 标准计算的总积分: ${totalCreditsUsed}`);
    
    // 如果存在差异，记录警告但仍使用calculateCorrectTotalCredits的结果
    if (Math.abs(sumOfFeatureCredits - totalCreditsUsed) > 0.01) {
      console.log(`警告：总积分与各功能积分之和不一致，差异: ${Math.abs(sumOfFeatureCredits - totalCreditsUsed)}`);
      console.log(`保持使用calculateCorrectTotalCredits计算的结果: ${totalCreditsUsed}`);
    }
    
    // 特别处理文生视频功能，确保其积分消费正确显示
    // 但是不要重复计算，因为我们已经在上面的计算中包含了文生视频功能的积分
    if (featureUsageStats['text-to-video'] && featureUsageStats['text-to-video'].credits > 0) {
      console.log(`文生视频功能积分消费: ${featureUsageStats['text-to-video'].credits}`);
      
      // 检查文生视频功能的积分是否已经包含在总积分中
      // 不再尝试添加文生视频功能的积分到总积分，因为这可能导致重复计算
      // 我们只需要确保在usageData中正确反映了文生视频功能的积分消费
      
      // 检查usageData中是否包含文生视频功能的积分
      let textToVideoInUsageData = false;
      const textToVideoCredits = featureUsageStats['text-to-video'].credits;
      
      // 遍历usageData，检查是否有与文生视频积分相等的值
      for (let i = 0; i < usageData.length; i++) {
        if (Math.abs(usageData[i] - textToVideoCredits) < 0.01) {
          textToVideoInUsageData = true;
          console.log(`文生视频功能积分 ${textToVideoCredits} 已包含在日期索引 ${i} 的usageData中`);
          break;
        }
      }
      
      if (!textToVideoInUsageData) {
        console.log(`文生视频功能积分 ${textToVideoCredits} 未包含在usageData中，但已在总积分中计算`);
      } else {
        console.log(`文生视频功能积分已包含在usageData中，无需额外处理`);
      }
    }
    
    // 确保refunds变量已定义，防止"refunds is not defined"错误
    let refunds = [];
    
    // 返回结果给客户端
    // 使用calculateCorrectTotalCredits函数作为唯一的积分计算方法
    const calculatedCredits = calculateCorrectTotalCredits(allTasks, allRefunds);
    console.log(`原始计算的积分消费: ${totalCreditsUsed}, 标准计算的积分消费: ${calculatedCredits}`);
    
    // 始终使用calculateCorrectTotalCredits计算的结果作为最终积分值
    totalCreditsUsed = calculatedCredits;
    
    // 生成按日期分布的图表数据
    const chartDataCalculated = generateChartData(dateLabels, totalCreditsUsed, allTasks.filter(task => 
      new Date(task.timestamp) >= startDate
    ));
    
    res.json({
      success: true,
      data: {
        summary: {
          totalCreditsUsed,
          totalAllTimeCreditsUsed,
          totalUsageCount,
          featureCount: Object.keys(featureUsageStats).length
        },
        chartData: {
          labels: dateLabels,
          data: chartDataCalculated
        },
        featureUsage,
        usageRecords,
        totalRecords: usageRecords.length
      }
    });
  } catch (error) {
    console.error('获取积分使用历史出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，无法获取积分使用历史',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * 获取功能的本地化名称
 */
function getLocalFeatureName(featureName) {
  const featureNames = {
    'image-upscaler': '图像高清放大',
    'marketing-images': 'AI营销图生成',
    'cutout': '商品换背景',
    'translate': '图片翻译',
    'scene-generator': '场景图生成',
    'image-removal': '图像智能消除',
    'model-skin-changer': '模特换肤',
    'clothing-simulation': '模拟试衣',
    'text-to-video': '文生视频',
    'image-to-video': '图生视频',
    'IMAGE_EDIT': '指令编辑',
    'LOCAL_REDRAW': '局部重绘',
    'IMAGE_COLORIZATION': '图像上色',
    'image-expansion': '智能扩图',
    'VIRTUAL_SHOE_MODEL': '鞋靴虚拟试穿',
    'TEXT_TO_IMAGE': '文生图片',
    'IMAGE_SHARPENING': '模糊图片变清晰',
    'CLOTH_SEGMENTATION': '智能服饰分割',
    'GLOBAL_STYLE': '全局风格化',
    'VIRTUAL_MODEL_VTON': '智能虚拟模特试穿',
    'VIDEO_SUBTITLE_REMOVER': '视频去除字幕',
    'MULTI_IMAGE_TO_VIDEO': '多图转视频',
    'DIGITAL_HUMAN_VIDEO': '视频数字人',
    'VIDEO_STYLE_REPAINT': '视频风格重绘',
    'DIANTU': '垫图',
    'amazon_video_script': '亚马逊广告视频脚本生成',
    'product_improvement_analysis': '选品的改款分析和建议',
    'amazon_brand_info': '品牌信息收集和总结',
    'amazon_brand_naming': '亚马逊品牌起名',
    'amazon_listing': '亚马逊Listing写作与优化',
    'amazon_search_term': '亚马逊后台搜索词',
    'amazon_review_analysis': '亚马逊客户评论分析',
    'amazon_consumer_insights': '亚马逊消费者洞察专家',
    'amazon_customer_email': '亚马逊客户邮件回复',
    'fba_claim_email': 'FBA索赔邮件',
    'amazon_review_generator': '亚马逊评论生成',
    'amazon_review_response': '亚马逊评论回复',
    'product_comparison': '产品对比',
    'amazon_post_creator': '创建亚马逊Post',
    'amazon_keyword_recommender': '亚马逊关键词推荐',
    'amazon_case_creator': '亚马逊客服case内容',
    'QWEN_IMAGE_EDIT': '图像编辑',
    'IMAGE_CROP': '图像裁剪',
    'IMAGE_RESIZE': '图片改尺寸',
    'VIDEO_FACE_FUSION': '视频换脸',
    'FACE_FUSION': '图片换脸'
  };
  
  return featureNames[featureName] || featureName;
}

// 添加formatDate函数定义
function formatDate(date) {
  if (!date) return '';
  try {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  } catch (e) {
    console.error('日期格式化错误:', e);
    return '';
  }
}

// 创建支付宝支付订单
router.post('/alipay/create', protect, async (req, res) => {
    try {
        const { amount } = req.body;
        
        if (!amount || isNaN(amount) || amount < 10) {
            return res.status(400).json({ success: false, message: '无效的充值金额' });
        }
        
        // 使用Sequelize ORM方式创建订单记录
        logger.info('开始创建订单', { amount, userId: req.user.id });
        const orderNumber = `AL${Date.now()}${Math.floor(Math.random() * 1000)}`;
        
        // 计算对应的人民币金额
        let price = 0;
        if (parseInt(amount) === 800) price = 99;
        else if (parseInt(amount) === 3980) price = 399;
        else if (parseInt(amount) === 6730) price = 599;
        else if (parseInt(amount) === 12500) price = 999;
        else if (parseInt(amount) === 350) price = 59;
        else price = Math.ceil(parseInt(amount) * 0.12); // 默认比例
        
        // 使用Sequelize ORM创建订单
        const order = await PaymentOrder.create({
            user_id: req.user.id,
            amount: parseInt(amount),
            price: price,
            status: 'pending',
            payment_method: 'alipay',
            order_number: orderNumber,
            qrcode_expire_time: new Date(Date.now() + 15 * 60 * 1000) // 二维码15分钟有效期
        });
        
        logger.info('订单创建成功', { 
            orderId: order.id, 
            orderNumber: order.order_number 
        });
        
        // 使用表单方式创建支付宝支付链接 - 这是最简单可靠的方式
        try {
            // 创建表单实例
            const formData = new AlipayFormData();
            // 设置返回格式为页面跳转格式
            formData.setMethod('get');
            
            // 设置支付页面回跳地址 - 使用自定义路由
            formData.addField('returnUrl', `${process.env.BASE_URL}/api/credits/alipay/return`);
            // 设置异步通知地址
            formData.addField('notifyUrl', `${process.env.BASE_URL}/api/credits/alipay/notify`);
            
            // 设置业务数据
            formData.addField('bizContent', JSON.stringify({
                out_trade_no: orderNumber,               // 订单号
                product_code: 'FAST_INSTANT_TRADE_PAY',  // 产品码
                total_amount: price.toFixed(2),          // 订单金额
                subject: `萤火AI积分充值-${amount}积分`,  // 订单标题
                body: `萤火AI积分充值-${amount}积分`,     // 订单描述
                timeout_express: '15m'                   // 设置订单超时时间为15分钟
            }));
            
            logger.info('准备调用支付宝支付接口', { 
                orderNumber, 
                price, 
                returnUrl: `${process.env.BASE_URL}/api/credits/alipay/return`,
                notifyUrl: `${process.env.BASE_URL}/api/credits/alipay/notify`
            });
            
            // 调用 SDK 生成支付链接
            const paymentUrl = await alipaySdk.exec(
                'alipay.trade.page.pay', // 统一下单接口
                {},                      // 无需额外参数
                { formData: formData }   // 传入表单参数
            );
            
            logger.info('支付宝支付链接生成成功', { 
                orderNumber, 
                paymentUrl: paymentUrl ? (paymentUrl.substring(0, 100) + '...') : '链接为空'
            });
            
            // 如果生成URL成功
            if (paymentUrl) {
                return res.json({
                    success: true,
                    data: {
                        orderId: order.id,
                        orderNumber: order.order_number,
                        paymentUrl: paymentUrl,
                        expireTime: order.qrcode_expire_time
                    }
                });
            } else {
                // 未能生成URL
                logger.error('无法生成支付宝支付链接', { orderNumber });
                await order.update({ status: 'failed' });
                
                return res.status(500).json({
                    success: false,
                    message: '生成支付链接失败，请稍后重试'
                });
            }
        } catch (sdkError) {
            logger.error('支付宝SDK调用失败', { 
                error: sdkError.message, 
                stack: sdkError.stack,
                userId: req.user.id,
                orderNumber
            });
            
            // 更新订单状态为失败
            await order.update({ status: 'failed' });
            
            return res.status(500).json({ 
                success: false, 
                message: '调用支付宝接口失败，请稍后重试', 
                error: sdkError.message 
            });
        }
    } catch (error) {
        logger.error('创建支付宝订单出错', { 
            error: error.message, 
            stack: error.stack,
            userId: req.user.id
        });
        res.status(500).json({ 
            success: false, 
            message: '创建支付订单失败，请稍后重试', 
            error: error.message 
        });
    }
});

// 支付宝支付结果同步回调接口
router.get('/alipay/return', async (req, res) => {
    try {
        const params = req.query;
        logger.info('收到支付宝同步回调', { 
            params: JSON.stringify(params),
            outTradeNo: params.out_trade_no,
            tradeNo: params.trade_no
        });
        
        // 如果包含了trade_no，表示支付可能已经成功
        if (params.trade_no && params.out_trade_no) {
            // 查询订单
            const order = await PaymentOrder.findOne({
                where: { order_number: params.out_trade_no }
            });
            
            if (order && order.status !== 'completed') {
                // 主动查询一次支付宝订单状态
                try {
                    const formData = new AlipayFormData();
                    formData.setMethod('get');
                    
                    formData.addField('bizContent', JSON.stringify({
                        out_trade_no: params.out_trade_no
                    }));
                    
                    const tradeQueryResult = await alipaySdk.exec(
                        'alipay.trade.query',
                        {},
                        { formData: formData }
                    );
                    
                    // 尝试解析查询结果
                    try {
                        const queryResponse = JSON.parse(tradeQueryResult);
                        
                        // 如果交易成功或交易完成
                        if (queryResponse.alipay_trade_query_response && 
                            (queryResponse.alipay_trade_query_response.trade_status === 'TRADE_SUCCESS' || 
                             queryResponse.alipay_trade_query_response.trade_status === 'TRADE_FINISHED')) {
                            
                            // 更新订单状态
                            order.status = 'completed';
                            order.transaction_id = params.trade_no || queryResponse.alipay_trade_query_response.trade_no;
                            order.payment_time = new Date();
                            await order.save();
                            
                            // 更新用户积分
                            const user = await User.findByPk(order.user_id);
                            if (user) {
                                user.credits = user.credits + order.amount;
                                user.lastRechargeTime = new Date();
                                await user.save();
                                
                                logger.info('同步回调: 用户积分已更新', { 
                                    userId: user.id, 
                                    credits: user.credits,
                                    amount: order.amount
                                });
                            }
                            
                            logger.info('同步回调: 订单已标记为完成', { 
                                orderNumber: order.order_number 
                            });
                        }
                    } catch (parseError) {
                        logger.warn('同步回调: 解析查询结果失败', { 
                            error: parseError.message 
                        });
                    }
                } catch (queryError) {
                    logger.warn('同步回调: 查询订单状态出错', { 
                        error: queryError.message 
                    });
                }
            }
        }
        
        // 无论处理结果如何，都重定向到结果页面，让前端页面继续查询处理
        res.redirect(`/credits-result.html?out_trade_no=${params.out_trade_no}&trade_no=${params.trade_no || ''}`);
    } catch (error) {
        logger.error('处理支付宝同步回调出错', { 
            error: error.message, 
            stack: error.stack,
            query: req.query
        });
        res.redirect('/credits-result.html?error=process_failed');
    }
});

// 查询支付宝订单状态
router.get('/alipay/query/:orderNumber', protect, async (req, res) => {
    try {
        const { orderNumber } = req.params;
        
        // 查询订单
        const order = await PaymentOrder.findOne({
            where: { 
                order_number: orderNumber,
                user_id: req.user.id
            }
        });
        
        if (!order) {
            return res.status(404).json({ success: false, message: '订单不存在' });
        }
        
        if (order.status === 'completed') {
            return res.json({
                success: true,
                data: {
                    status: 'completed',
                    message: '充值成功',
                    credits: order.amount
                }
            });
        }
        
        // 检查二维码是否过期
        const now = new Date();
        if (order.qrcode_expire_time && now > new Date(order.qrcode_expire_time)) {
            logger.info('订单二维码已过期', { orderNumber });
            return res.json({
                success: true,
                data: {
                    status: 'expired',
                    message: '支付二维码已过期，请重新发起支付'
                }
            });
        }
        
        // 尝试主动查询一次订单状态 - 使用AlipaySdk查询
        try {
            const formData = new AlipayFormData();
            formData.setMethod('get');
            
            formData.addField('bizContent', JSON.stringify({
                out_trade_no: orderNumber
            }));
            
            // 执行查询
            const tradeQueryResult = await alipaySdk.exec(
                'alipay.trade.query',
                {},
                { formData: formData }
            );
            
            // 尝试解析查询结果
            try {
                const queryResponse = JSON.parse(tradeQueryResult);
                logger.info('订单查询结果', { 
                    orderNumber,
                    tradeStatus: queryResponse.alipay_trade_query_response ? 
                        queryResponse.alipay_trade_query_response.trade_status : '未知'
                });
                
                // 如果交易成功或交易完成
                if (queryResponse.alipay_trade_query_response && 
                    (queryResponse.alipay_trade_query_response.trade_status === 'TRADE_SUCCESS' || 
                     queryResponse.alipay_trade_query_response.trade_status === 'TRADE_FINISHED')) {
                    
                    // 更新订单状态
                    order.status = 'completed';
                    order.transaction_id = queryResponse.alipay_trade_query_response.trade_no;
                    order.payment_time = new Date();
                    await order.save();
                    
                    // 更新用户积分
                    const user = await User.findByPk(order.user_id);
                    if (user) {
                        user.credits = user.credits + order.amount;
                        user.lastRechargeTime = new Date();
                        await user.save();
                        
                        logger.info('用户积分已更新', { 
                            userId: user.id, 
                            orderId: order.id, 
                            credits: user.credits
                        });
                    }
                    
                    return res.json({
                        success: true,
                        data: {
                            status: 'completed',
                            message: '充值成功',
                            credits: order.amount
                        }
                    });
                }
            } catch (parseError) {
                logger.warn('解析订单查询结果失败', { 
                    error: parseError.message, 
                    orderNumber 
                });
            }
        } catch (queryError) {
            logger.warn('主动查询订单状态出错', { 
                error: queryError.message, 
                orderNumber 
            });
        }
        
        // 支付宝支付主要依赖异步通知进行状态更新
        // 这里只返回处理中状态，由前端定期查询，后端通过异步通知更新订单状态
        return res.json({
            success: true,
            data: {
                status: 'pending',
                message: '订单处理中，请在支付宝完成支付后返回此页面查看结果'
            }
        });
    } catch (error) {
        logger.error('查询支付宝订单状态处理失败', { 
            error: error.message, 
            stack: error.stack,
            userId: req.user.id 
        });
        res.status(500).json({ success: false, message: '查询订单状态失败', error: error.message });
    }
});

// 支付宝支付结果异步通知
router.post('/alipay/notify', async (req, res) => {
    try {
        const params = req.body;
        logger.info('收到支付宝异步通知', { 
            params: JSON.stringify(params),
            out_trade_no: params.out_trade_no, 
            trade_status: params.trade_status 
        });
        
        // 简单验证必要字段是否存在
        if (!params.out_trade_no || !params.trade_status) {
            logger.error('支付宝通知: 缺少必要字段', { params });
            return res.send('fail');
        }
        
        // 获取商户订单号
        const outTradeNo = params.out_trade_no;
        const tradeStatus = params.trade_status;
        
        // 查询订单
        const order = await PaymentOrder.findOne({
            where: { order_number: outTradeNo }
        });
        
        if (!order) {
            logger.error('支付宝通知: 订单不存在', { outTradeNo });
            return res.send('fail');
        }
        
        // 检查订单是否已处理
        if (order.status === 'completed') {
            logger.info('支付宝通知: 订单已处理', { outTradeNo });
            return res.send('success');
        }
        
        // 如果交易成功或完成
        if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
            // 更新订单状态
            order.status = 'completed';
            order.transaction_id = params.trade_no;
            order.payment_time = new Date();
            await order.save();
            
            // 更新用户积分
            const user = await User.findByPk(order.user_id);
            if (user) {
                user.credits = user.credits + order.amount;
                user.lastRechargeTime = new Date();
                await user.save();
                
                logger.info('支付宝通知: 积分已更新', { 
                    userId: order.user_id, 
                    orderId: order.id, 
                    amount: order.amount, 
                    credits: user.credits
                });
            }
            
            logger.info('支付宝通知: 充值成功', { 
                userId: order.user_id, 
                orderId: order.id, 
                amount: order.amount, 
                tradeNo: params.trade_no 
            });
            
            // 向支付宝返回成功
            return res.send('success');
        } else {
            // 其他交易状态，记录日志
            logger.info('支付宝通知: 交易未完成', { 
                outTradeNo, 
                tradeStatus 
            });
            return res.send('success');
        }
    } catch (error) {
        logger.error('处理支付宝通知出错', { 
            error: error.message, 
            stack: error.stack,
            body: req.body
        });
        res.send('fail');
    }
});

// 充值积分 (测试用，实际应用中会通过支付宝回调)
router.post('/recharge', protect, async (req, res) => {
    try {
        const { amount, paymentMethod, transactionId } = req.body;
        
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ success: false, message: '无效的充值金额' });
        }
        
        // 开始事务
        await db.query('BEGIN');
        
        // 增加用户积分
        const result = await db.query(
            'UPDATE users SET credits = credits + $1, last_recharge_time = NOW() WHERE id = $2 RETURNING credits, last_recharge_time',
            [amount, req.user.id]
        );
        
        // 记录充值记录
        await db.query(
            'INSERT INTO recharge_records (user_id, amount, payment_method, transaction_id) VALUES ($1, $2, $3, $4)',
            [req.user.id, amount, paymentMethod, transactionId]
        );
        
        // 提交事务
        await db.query('COMMIT');
        
        logger.info('用户充值积分成功', { 
            userId: req.user.id, 
            amount, 
            method: paymentMethod, 
            transactionId 
        });
        
        res.json({
            success: true,
            message: '积分充值成功',
            data: {
                credits: result.rows[0].credits,
                lastRechargeTime: result.rows[0].last_recharge_time
            }
        });
    } catch (error) {
        // 回滚事务
        await db.query('ROLLBACK');
        
        logger.error('充值积分出错', { error: error.message, userId: req.user.id });
        res.status(500).json({ success: false, message: '充值积分失败', error: error.message });
    }
});

// 设置用户积分 (开发者权限)
router.post('/dev/set-credits', protect, checkDeveloper, async (req, res) => {
    try {
        const { amount } = req.body;
        
        if (!amount || isNaN(amount) || amount < 0) {
            return res.status(400).json({ success: false, message: '无效的积分数量' });
        }
        
        const result = await db.query(
            'UPDATE users SET credits = $1 WHERE id = $2 RETURNING credits',
            [amount, req.user.id]
        );
        
        logger.info('开发者设置积分', { userId: req.user.id, newAmount: amount });
        
        res.json({
            success: true,
            message: '积分设置成功',
            data: {
                credits: result.rows[0].credits
            }
        });
    } catch (error) {
        logger.error('设置积分出错', { error: error.message, userId: req.user.id });
        res.status(500).json({ success: false, message: '设置积分失败', error: error.message });
    }
});

// 重置功能使用次数 (开发者权限)
router.post('/dev/reset-usage', protect, checkDeveloper, async (req, res) => {
    try {
        const { featureName } = req.body;
        
        if (!featureName) {
            return res.status(400).json({ success: false, message: '未指定功能名称' });
        }
        
        let query;
        let params;
        
        if (featureName === 'all') {
            // 重置所有功能的使用记录
            query = `DELETE FROM feature_usage WHERE user_id = $1`;
            params = [req.user.id];
        } else {
            // 重置指定功能的使用记录
            query = `DELETE FROM feature_usage 
                     WHERE user_id = $1 AND feature_id = (SELECT id FROM features WHERE name = $2)`;
            params = [req.user.id, featureName];
        }
        
        await db.query(query, params);
        
        logger.info('开发者重置功能使用次数', { 
            userId: req.user.id, 
            featureName: featureName === 'all' ? '所有功能' : featureName 
        });
        
        res.json({
            success: true,
            message: featureName === 'all' ? '所有功能使用次数已重置' : `${featureName} 功能使用次数已重置`
        });
    } catch (error) {
        logger.error('重置功能使用次数出错', { error: error.message, userId: req.user.id });
        res.status(500).json({ success: false, message: '重置功能使用次数失败', error: error.message });
    }
});

// ==================== PayPal支付相关接口 ====================

// PayPal环境配置（从环境变量读取）
const isPayPalSandbox = process.env.PAYPAL_SANDBOX === 'true' || process.env.PAYPAL_SANDBOX === '1';
const paypalClientId = process.env.PAYPAL_CLIENT_ID;
const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;

// 验证PayPal配置
const isPayPalConfigured = paypalClientId && paypalClientSecret;
if (!isPayPalConfigured) {
    logger.warn('PayPal配置缺失：请在.env文件中配置PAYPAL_CLIENT_ID和PAYPAL_CLIENT_SECRET');
}

// 初始化PayPal环境（仅在配置存在时）
let paypalEnvironment = null;
let paypalConfig = null;
let paypalClient = null;
let ordersController = null;

if (isPayPalConfigured) {
    paypalEnvironment = isPayPalSandbox 
        ? paypal.Environment.Sandbox
        : paypal.Environment.Production;
    
    // 创建PayPal客户端配置
    // 根据PayPal Server SDK 2.0.0文档，应该使用clientCredentialsAuthCredentials
    // 参考：https://www.npmjs.com/package/@paypal/paypal-server-sdk/v/2.0.0
    paypalConfig = {
        environment: paypalEnvironment,
        clientCredentialsAuthCredentials: {
            oAuthClientId: paypalClientId.trim(), // 确保没有多余的空格
            oAuthClientSecret: paypalClientSecret.trim() // 确保没有多余的空格
        },
        timeout: 30000 // 设置30秒超时
    };
    
    // 记录配置信息（不记录完整的Secret，只记录前几位和后几位）
    logger.info('初始化PayPal客户端', {
        environment: paypalEnvironment,
        isSandbox: isPayPalSandbox,
        clientIdPrefix: paypalClientId ? paypalClientId.substring(0, 10) + '...' : '未设置',
        clientSecretPrefix: paypalClientSecret ? paypalClientSecret.substring(0, 10) + '...' : '未设置',
        hasClientId: !!paypalClientId,
        hasClientSecret: !!paypalClientSecret
    });
    
    try {
        // 创建PayPal客户端
        paypalClient = new paypal.Client(paypalConfig);
        
        // 创建Orders控制器（需要传入Client实例，而不是配置对象）
        ordersController = new paypal.OrdersController(paypalClient);
        
        logger.info('PayPal客户端初始化成功');
    } catch (initError) {
        logger.error('PayPal客户端初始化失败', {
            error: initError.message,
            stack: initError.stack
        });
    }
}

/**
 * @route   GET /api/credits/paypal/config
 * @desc    获取PayPal配置（用于前端）
 * @access  公开
 */
router.get('/paypal/config', (req, res) => {
    try {
        if (!isPayPalConfigured || !paypalClientId) {
            return res.status(503).json({
                success: false,
                message: 'PayPal服务未配置，请在.env文件中配置PAYPAL_CLIENT_ID和PAYPAL_CLIENT_SECRET'
            });
        }
        
        res.json({
            success: true,
            data: {
                clientId: paypalClientId,
                isSandbox: isPayPalSandbox
            }
        });
    } catch (error) {
        logger.error('获取PayPal配置失败', { error: error.message });
        res.status(500).json({
            success: false,
            message: '获取PayPal配置失败'
        });
    }
});

/**
 * @route   POST /api/credits/paypal/create
 * @desc    创建PayPal支付订单
 * @access  私有
 */
router.post('/paypal/create', protect, async (req, res) => {
    try {
        // 检查PayPal是否已配置
        if (!isPayPalConfigured || !ordersController) {
            return res.status(503).json({
                success: false,
                message: 'PayPal服务未配置，请联系管理员'
            });
        }
        
        const { amount } = req.body;
        
        if (!amount || isNaN(amount) || amount < 10) {
            return res.status(400).json({ success: false, message: '无效的充值金额' });
        }
        
        // 计算对应的人民币金额（转换为美元，假设1美元=7人民币）
        let price = 0;
        if (parseInt(amount) === 800) price = 99;
        else if (parseInt(amount) === 3980) price = 399;
        else if (parseInt(amount) === 6730) price = 599;
        else if (parseInt(amount) === 12500) price = 999;
        else if (parseInt(amount) === 350) price = 59;
        else price = Math.ceil(parseInt(amount) * 0.12); // 默认比例
        
        // 转换为美元（假设1美元=7人民币，实际应该使用实时汇率）
        const priceInUSD = (price / 7).toFixed(2);
        
        // 创建订单号
        const orderNumber = `PP${Date.now()}${Math.floor(Math.random() * 1000)}`;
        
        logger.info('开始创建PayPal订单', { amount, price, priceInUSD, userId: req.user.id, orderNumber });
        
        // 使用Sequelize ORM创建订单记录
        const order = await PaymentOrder.create({
            user_id: req.user.id,
            amount: parseInt(amount),
            price: price,
            status: 'pending',
            payment_method: 'paypal',
            order_number: orderNumber,
            qrcode_expire_time: new Date(Date.now() + 15 * 60 * 1000) // 15分钟有效期
        });
        
        logger.info('PayPal订单创建成功', { 
            orderId: order.id, 
            orderNumber: order.order_number 
        });
        
        try {
            // 创建PayPal订单（注意：PayPal SDK使用驼峰命名，不是下划线命名）
            // 根据PayPal官方文档：https://developer.paypal.com/studio/checkout/standard/integrate
            
            // 动态检测当前环境，如果是本地开发环境，使用localhost
            // 检查请求的host来判断是否是本地环境
            const isLocal = req.get('host')?.includes('localhost') || 
                          req.get('host')?.includes('127.0.0.1') ||
                          process.env.NODE_ENV === 'development';
            
            // 根据环境设置baseUrl
            let baseUrl;
            if (isLocal) {
                // 本地环境使用localhost
                const protocol = req.protocol || 'http';
                const host = req.get('host') || 'localhost:8080';
                baseUrl = `${protocol}://${host}`;
            } else {
                // 生产环境使用环境变量或默认值
                baseUrl = process.env.BASE_URL || 'https://yinghuo.ai';
            }
            
            const returnUrl = `${baseUrl}/api/credits/paypal/return?orderNumber=${orderNumber}`;
            const cancelUrl = `${baseUrl}/credits.html`;
            
            const orderRequest = {
                intent: 'CAPTURE',
                purchaseUnits: [{
                    referenceId: orderNumber,
                    description: `萤火AI积分充值-${amount}积分`,
                    amount: {
                        currencyCode: 'USD',
                        value: priceInUSD.toString() // 确保是字符串类型
                    }
                }],
                applicationContext: {
                    brandName: '萤火AI',
                    landingPage: 'BILLING',
                    userAction: 'PAY_NOW',
                    returnUrl: returnUrl,
                    cancelUrl: cancelUrl
                }
            };
            
            logger.info('准备调用PayPal API创建订单', { 
                orderRequest: JSON.stringify(orderRequest, null, 2),
                orderNumber,
                baseUrl,
                returnUrl,
                cancelUrl,
                hasPaypalClient: !!paypalClient,
                hasOrdersController: !!ordersController,
                clientCredentialsAuthManager: paypalClient?.clientCredentialsAuthManager ? '已初始化' : '未初始化'
            });
            
            // 检查PayPal客户端和控制器是否已正确初始化
            if (!paypalClient || !ordersController) {
                logger.error('PayPal客户端或控制器未初始化', {
                    hasPaypalClient: !!paypalClient,
                    hasOrdersController: !!ordersController
                });
                await order.update({ status: 'failed' });
                return res.status(500).json({
                    success: false,
                    message: 'PayPal服务未正确初始化，请联系管理员'
                });
            }
            
            // 调用PayPal API创建订单
            // 根据PayPal Orders V2 API文档：https://developer.paypal.com/docs/api/orders/v2/#orders_create
            // PayPal Server SDK 2.0.0的createOrder方法接受一个包含body的对象
            // body应该包含符合Orders V2 API规范的订单请求
            logger.info('开始调用PayPal createOrder API');
            const response = await ordersController.createOrder({ body: orderRequest });
            
            // 检查响应状态码和响应体
            if (response && response.statusCode === 201 && response.body) {
                // 处理响应体：如果它是字符串，先解析为JSON对象
                let responseBody = response.body;
                if (typeof responseBody === 'string') {
                    try {
                        responseBody = JSON.parse(responseBody);
                        logger.info('PayPal响应体已从字符串解析为对象', { 
                            orderNumber,
                            hasId: !!responseBody.id
                        });
                    } catch (parseError) {
                        logger.error('PayPal响应体JSON解析失败', { 
                            orderNumber,
                            responseBody: response.body,
                            error: parseError.message
                        });
                        await order.update({ status: 'failed' });
                        return res.status(500).json({
                            success: false,
                            message: 'PayPal订单创建失败：响应解析错误'
                        });
                    }
                }
                
                // 从解析后的响应体中提取订单ID和批准URL
                const paypalOrderId = responseBody.id;
                const approvalUrl = responseBody.links?.find(link => link.rel === 'approve')?.href;
                
                if (!paypalOrderId) {
                    logger.error('PayPal订单创建响应中缺少订单ID', { 
                        orderNumber,
                        responseBody: responseBody,
                        responseBodyType: typeof responseBody,
                        responseBodyKeys: responseBody ? Object.keys(responseBody) : []
                    });
                    await order.update({ status: 'failed' });
                    return res.status(500).json({
                        success: false,
                        message: 'PayPal订单创建失败：响应格式错误'
                    });
                }
                
                // 更新订单，保存PayPal订单ID
                await order.update({
                    transaction_id: paypalOrderId
                });
                
                logger.info('PayPal订单创建成功', { 
                    orderNumber, 
                    paypalOrderId,
                    approvalUrl: approvalUrl ? approvalUrl.substring(0, 100) + '...' : '无'
                });
                
                return res.json({
                    success: true,
                    data: {
                        orderId: order.id,
                        orderNumber: order.order_number,
                        paypalOrderId: paypalOrderId,
                        approvalUrl: approvalUrl,
                        expireTime: order.qrcode_expire_time
                    }
                });
            } else {
                // 响应格式不正确或状态码不是201
                logger.error('PayPal订单创建失败：响应格式错误', { 
                    orderNumber,
                    statusCode: response?.statusCode,
                    responseBody: response?.body,
                    fullResponse: response
                });
                await order.update({ status: 'failed' });
                
                return res.status(500).json({
                    success: false,
                    message: '创建PayPal订单失败，请稍后重试',
                    error: response?.body?.message || 'PayPal API返回了意外的响应格式'
                });
            }
        } catch (paypalError) {
            // 记录详细的错误信息
            // 根据PayPal Orders V2 API文档，错误可能来自多个地方
            let errorDetails = {
                message: paypalError.message,
                stack: paypalError.stack,
                userId: req.user.id,
                orderNumber,
                orderRequest: orderRequest // 记录请求内容以便调试
            };
            
            // 尝试提取PayPal API返回的详细错误信息
            // PayPal SDK可能返回的错误格式有多种
            if (paypalError.response) {
                errorDetails.response = {
                    status: paypalError.response.status,
                    statusText: paypalError.response.statusText,
                    data: paypalError.response.data,
                    headers: paypalError.response.headers
                };
            }
            
            // 如果错误有body属性（PayPal SDK可能返回的错误格式）
            if (paypalError.body) {
                errorDetails.paypalErrorBody = paypalError.body;
                // PayPal API错误通常包含details数组，记录详细信息
                if (paypalError.body.details) {
                    errorDetails.paypalErrorDetails = paypalError.body.details;
                }
                if (paypalError.body.name) {
                    errorDetails.paypalErrorName = paypalError.body.name;
                }
            }
            
            // 如果错误有result属性
            if (paypalError.result) {
                errorDetails.paypalResult = paypalError.result;
            }
            
            // 如果错误有error属性（某些SDK版本可能使用此格式）
            if (paypalError.error) {
                errorDetails.paypalError = paypalError.error;
            }
            
            // 记录完整的错误信息
            logger.error('PayPal API调用失败', errorDetails);
            
            // 更新订单状态为失败
            await order.update({ status: 'failed' });
            
            // 提取用户友好的错误消息
            // 根据PayPal Orders V2 API文档，错误消息可能在多个位置
            let errorMessage = '调用PayPal接口失败，请稍后重试';
            
            if (paypalError.body) {
                // PayPal API错误通常有message字段
                if (paypalError.body.message) {
                    errorMessage = paypalError.body.message;
                }
                // 或者有details数组，取第一个detail的issue
                else if (paypalError.body.details && paypalError.body.details.length > 0) {
                    const firstDetail = paypalError.body.details[0];
                    errorMessage = firstDetail.issue || firstDetail.description || errorMessage;
                }
            } else if (paypalError.response?.data?.message) {
                errorMessage = paypalError.response.data.message;
            } else if (paypalError.message) {
                errorMessage = paypalError.message;
            }
            
            return res.status(500).json({ 
                success: false, 
                message: '调用PayPal接口失败，请稍后重试', 
                error: errorMessage,
                // 开发环境返回详细错误，生产环境应该移除
                ...(process.env.NODE_ENV !== 'production' && { 
                    details: {
                        errorName: errorDetails.paypalErrorName,
                        errorDetails: errorDetails.paypalErrorDetails,
                        fullError: errorDetails
                    }
                })
            });
        }
    } catch (error) {
        logger.error('创建PayPal订单出错', { 
            error: error.message, 
            stack: error.stack,
            userId: req.user.id
        });
        res.status(500).json({ 
            success: false, 
            message: '创建支付订单失败，请稍后重试', 
            error: error.message 
        });
    }
});

/**
 * @route   POST /api/credits/paypal/capture
 * @desc    捕获PayPal支付（确认支付）
 * @access  私有
 */
router.post('/paypal/capture', protect, async (req, res) => {
    try {
        // 检查PayPal是否已配置
        if (!isPayPalConfigured || !ordersController) {
            return res.status(503).json({
                success: false,
                message: 'PayPal服务未配置，请联系管理员'
            });
        }
        
        const { orderId } = req.body;
        
        if (!orderId) {
            return res.status(400).json({ success: false, message: '缺少订单ID' });
        }
        
        // 查询订单
        const order = await PaymentOrder.findOne({
            where: { 
                order_number: orderId,
                user_id: req.user.id,
                payment_method: 'paypal'
            }
        });
        
        if (!order) {
            return res.status(404).json({ success: false, message: '订单不存在' });
        }
        
        if (order.status === 'completed') {
            return res.json({
                success: true,
                message: '订单已完成',
                data: {
                    orderId: order.id,
                    orderNumber: order.order_number,
                    amount: order.amount
                }
            });
        }
        
        // 获取PayPal订单ID
        const paypalOrderId = order.transaction_id;
        if (!paypalOrderId) {
            return res.status(400).json({ success: false, message: 'PayPal订单ID不存在' });
        }
        
        logger.info('开始捕获PayPal支付', { 
            orderNumber: order.order_number,
            paypalOrderId 
        });
        
        try {
            // 调用PayPal API捕获支付（需要将订单ID包装在id参数中）
            const response = await ordersController.captureOrder({ id: paypalOrderId });
            
            if (response.statusCode === 201 && response.body) {
                // 处理响应体：如果它是字符串，先解析为JSON对象
                let capture = response.body;
                if (typeof capture === 'string') {
                    try {
                        capture = JSON.parse(capture);
                        logger.info('PayPal捕获响应体已从字符串解析为对象', { 
                            orderNumber: order.order_number,
                            hasId: !!capture.id
                        });
                    } catch (parseError) {
                        logger.error('PayPal捕获响应体JSON解析失败', { 
                            orderNumber: order.order_number,
                            responseBody: response.body,
                            error: parseError.message
                        });
                        await order.update({ status: 'failed' });
                        return res.status(500).json({
                            success: false,
                            message: 'PayPal支付捕获失败：响应解析错误'
                        });
                    }
                }
                
                const captureId = capture.id;
                const status = capture.status;
                
                logger.info('PayPal支付捕获成功', { 
                    orderNumber: order.order_number,
                    captureId,
                    status
                });
                
                // 如果支付成功
                if (status === 'COMPLETED') {
                    // 更新订单状态
                    order.status = 'completed';
                    order.transaction_id = captureId;
                    order.payment_time = new Date();
                    await order.save();
                    
                    // 更新用户积分
                    const user = await User.findByPk(order.user_id);
                    if (user) {
                        user.credits = user.credits + order.amount;
                        user.lastRechargeTime = new Date();
                        await user.save();
                        
                        logger.info('PayPal支付: 用户积分已更新', { 
                            userId: user.id, 
                            credits: user.credits,
                            amount: order.amount
                        });
                    }
                    
                    return res.json({
                        success: true,
                        message: '支付成功',
                        data: {
                            orderId: order.id,
                            orderNumber: order.order_number,
                            amount: order.amount,
                            credits: user.credits
                        }
                    });
                } else {
                    logger.warn('PayPal支付状态未完成', { 
                        orderNumber: order.order_number,
                        status
                    });
                    
                    return res.status(400).json({
                        success: false,
                        message: `支付状态: ${status}`
                    });
                }
            } else {
                logger.error('PayPal支付捕获失败', { 
                    orderNumber: order.order_number,
                    statusCode: response.statusCode,
                    response: response.body
                });
                
                return res.status(500).json({
                    success: false,
                    message: '支付捕获失败，请稍后重试'
                });
            }
        } catch (paypalError) {
            logger.error('PayPal API调用失败', { 
                error: paypalError.message, 
                stack: paypalError.stack,
                orderNumber: order.order_number
            });
            
            return res.status(500).json({ 
                success: false, 
                message: '调用PayPal接口失败，请稍后重试', 
                error: paypalError.message 
            });
        }
    } catch (error) {
        logger.error('捕获PayPal支付出错', { 
            error: error.message, 
            stack: error.stack,
            userId: req.user.id
        });
        res.status(500).json({ 
            success: false, 
            message: '处理支付失败，请稍后重试', 
            error: error.message 
        });
    }
});

/**
 * @route   GET /api/credits/paypal/return
 * @desc    PayPal支付返回页面
 * @access  公开
 */
router.get('/paypal/return', async (req, res) => {
    try {
        const { orderNumber, token, PayerID } = req.query;
        
        logger.info('收到PayPal支付返回', { 
            orderNumber,
            token,
            PayerID
        });
        
        // 如果有订单号，重定向到前端页面并传递订单号
        if (orderNumber) {
            return res.redirect(`/credits.html?paypalOrderNumber=${orderNumber}`);
        }
        
        // 如果没有订单号，直接重定向到积分页面
        res.redirect('/credits.html');
    } catch (error) {
        logger.error('处理PayPal返回页面出错', { 
            error: error.message 
        });
        res.redirect('/credits.html');
    }
});

module.exports = router;