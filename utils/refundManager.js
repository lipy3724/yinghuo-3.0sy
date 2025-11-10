/**
 * 退款管理模块 - 集中处理所有功能的退款逻辑
 * 
 * 本模块负责处理各种功能的退款机制，包括：
 * 1. 免费次数回退
 * 2. 积分退还
 * 3. 退款记录保存
 * 4. 防重复退款
 *
 * 不包含视频处理和亚马逊助手的功能退款
 */

// 导入所需模块
const { FeatureUsage } = require('../models/FeatureUsage');
const User = require('../models/User');
const { FEATURES } = require('../middleware/featureAccess');

/**
 * 通用退款函数 - 处理任何功能的退款
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} featureName - 功能名称
 * @param {string} reason - 退款原因
 * @param {Object} [options] - 额外选项
 * @param {number} [options.forceCreditCost] - 强制指定退款积分数量
 * @param {boolean} [options.skipGlobalCheck] - 跳过全局变量检查
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundFeatureCredits(userId, taskId, featureName, reason = '任务失败', options = {}) {
  try {
    console.log(`开始处理${featureName}功能退款: 用户ID=${userId}, 任务ID=${taskId}, 原因=${reason}`);
    
    // 获取对应功能的全局任务变量
    const globalTasksVar = getGlobalTasksVariable(featureName);
    let creditCost = 0;
    let wasRefunded = false;
    
    // 检查全局任务记录中是否有该任务的积分信息
    if (!options.skipGlobalCheck && globalTasksVar && globalTasksVar[taskId]) {
      const taskInfo = globalTasksVar[taskId];
      creditCost = taskInfo.creditCost || 0;
      wasRefunded = taskInfo.refunded || false;
      
      // 如果已经退款过了，不重复退款
      if (wasRefunded) {
        console.log(`任务 ${taskId} 已经退款过，跳过退款处理`);
        return false;
      }
      
      // 标记为已退款，防止重复退款
      globalTasksVar[taskId].refunded = true;
    }
    
    // 如果全局变量中没有找到任务信息，尝试从数据库中查找
    if (creditCost === 0) {
      try {
        const recentUsage = await FeatureUsage.findOne({
          where: {
            userId: userId,
            featureName: featureName
          },
          order: [['createdAt', 'DESC']]
        });
        
        if (recentUsage && recentUsage.details) {
          const details = JSON.parse(recentUsage.details || '{}');
          const tasks = details.tasks || [];
          const taskInfo = tasks.find(t => t.taskId === taskId);
          
          if (taskInfo) {
            creditCost = taskInfo.creditCost || 0;
            console.log(`从数据库中找到任务信息: 任务ID=${taskId}, 积分=${creditCost}`);
          }
        }
      } catch (dbError) {
        console.error('从数据库查找任务信息失败:', dbError);
      }
    }
    
    // 如果指定了强制退款积分数量，使用指定值
    if (options.forceCreditCost !== undefined) {
      creditCost = options.forceCreditCost;
    }
    
    // 如果没有积分消耗信息，从功能配置中获取
    if (creditCost === 0) {
      const featureConfig = FEATURES[featureName];
      creditCost = featureConfig ? (
        typeof featureConfig.creditCost === 'function' 
          ? featureConfig.creditCost({}) 
          : featureConfig.creditCost
      ) : 0;
      console.log(`从功能配置获取积分消耗: ${creditCost}`);
    }
    
    // 查找最近的该功能使用记录
    const recentUsage = await FeatureUsage.findOne({
      where: {
        userId: userId,
        featureName: featureName
      },
      order: [['createdAt', 'DESC']]
    });
    
    if (!recentUsage) {
      console.log(`未找到用户 ${userId} 的${featureName}使用记录，无法执行退款`);
      return false;
    }
    
    // 检查该使用记录是否为免费使用
    const featureConfig = FEATURES[featureName];
    
    if (featureConfig && recentUsage.usageCount <= featureConfig.freeUsage) {
      console.log(`用户 ${userId} 使用的是免费次数 (${recentUsage.usageCount}/${featureConfig.freeUsage})，仅回退使用次数，无需退还积分`);
      
      // 即使是免费使用，任务失败时也要回退使用次数，保留免费机会
      if (recentUsage.usageCount > 0) {
        recentUsage.usageCount -= 1;
        await recentUsage.save();
        console.log(`✅ 已回退免费使用次数: 用户ID=${userId}, 当前使用次数=${recentUsage.usageCount}/${featureConfig.freeUsage}`);
      }
      
      // 记录退款信息到任务详情中
      await recordRefundInfo(recentUsage, taskId, 0, true, reason);
      
      return true;
    }
    
    // 如果有积分消耗，执行退款
    if (creditCost > 0) {
      // 获取用户信息
      const user = await User.findByPk(userId);
      if (!user) {
        console.error(`未找到用户 ${userId}，无法执行退款`);
        return false;
      }
      
      // 退还积分
      const originalCredits = user.credits;
      user.credits += creditCost;
      await user.save();
      
      // 完全撤销这次使用记录，而不是仅仅减少使用次数
      if (recentUsage.usageCount > 0) {
        recentUsage.usageCount -= 1;
        
        // 清除这次使用产生的积分消费记录
        recentUsage.credits = Math.max(0, (recentUsage.credits || 0) - creditCost);
        
        // 如果使用次数回到免费范围内，清除相关的付费记录
        if (featureConfig && recentUsage.usageCount < featureConfig.freeUsage) {
          // 回到免费使用范围，清除所有付费相关的记录
          recentUsage.credits = 0;
        }
      }
      
      // 记录退款信息到任务详情中
      await recordRefundInfo(recentUsage, taskId, creditCost, false, reason);
      
      console.log(`✅ ${featureName}功能退款成功: 用户ID=${userId}, 任务ID=${taskId}, 退款积分=${creditCost}, 原积分=${originalCredits}, 现积分=${user.credits}`);
      console.log(`📊 使用记录已更新: 使用次数=${recentUsage.usageCount}, 积分消费=${recentUsage.credits}`);
      return true;
    }
    
    console.log(`任务 ${taskId} 无需退款: 积分=${creditCost}`);
    return false;
    
  } catch (error) {
    console.error(`${featureName}功能退款处理错误:`, error);
    return false;
  }
}

/**
 * 记录退款信息到任务详情中
 * @param {Object} usageRecord - 功能使用记录
 * @param {string} taskId - 任务ID
 * @param {number} creditCost - 退款积分数量
 * @param {boolean} isFree - 是否为免费使用
 * @param {string} reason - 退款原因
 */
async function recordRefundInfo(usageRecord, taskId, creditCost, isFree, reason) {
  try {
    const details = JSON.parse(usageRecord.details || '{}');
    const tasks = details.tasks || [];
    const refunds = details.refunds || [];
    
    // 检查任务是否存在
    const taskIndex = tasks.findIndex(t => t.taskId === taskId);
    if (taskIndex !== -1) {
      // 记录退款信息
      refunds.push({
        taskId: taskId,
        creditCost: creditCost,
        isFree: isFree,
        reason: reason,
        refundTime: new Date().toISOString()
      });
      
      // 更新任务详情
      usageRecord.details = JSON.stringify({
        ...details,
        refunds: refunds
      });
      
      await usageRecord.save();
      console.log(`✅ 已记录退款信息: 任务ID=${taskId}, 积分=${creditCost}, 是否免费=${isFree}`);
    }
  } catch (error) {
    console.error('记录退款信息失败:', error);
  }
}

/**
 * 获取功能对应的全局任务变量
 * @param {string} featureName - 功能名称
 * @returns {Object|null} - 全局任务变量
 */
function getGlobalTasksVariable(featureName) {
  switch (featureName) {
    case 'scene-generator':
      return global.sceneGeneratorTasks;
    case 'image-upscaler':
      return global.imageUpscalerTasks;
    case 'marketing-images':
      return global.marketingImagesTasks;
    case 'translate':
      return global.translateTasks;
    case 'image-removal':
      return global.imageRemovalTasks;
    case 'model-skin-changer':
      return global.modelSkinChangerTasks;
    case 'clothing-simulation':
      return global.clothingSimulationTasks;
    case 'IMAGE_EDIT':
      return global.imageEditTasks;
    case 'LOCAL_REDRAW':
      return global.localRedrawTasks;
    case 'IMAGE_COLORIZATION':
      return global.imageColorizationTasks;
    case 'image-expansion':
      return global.imageExpansionTasks;
    case 'VIRTUAL_SHOE_MODEL':
      return global.virtualShoeModelTasks;
    case 'TEXT_TO_IMAGE':
      return global.textToImageTasks;
    case 'IMAGE_SHARPENING':
      return global.imageSharpeningTasks;
    case 'CLOTH_SEGMENTATION':
      return global.clothingSegmentationTasks;
    case 'GLOBAL_STYLE':
      return global.globalStyleTasks;
    case 'DIANTU':
      return global.diantuTasks;
    case 'VIRTUAL_MODEL_VTON':
      return global.virtualModelVtonTasks;
    default:
      console.warn(`未找到功能 ${featureName} 对应的全局任务变量`);
      return null;
  }
}

// 各功能的专用退款函数

/**
 * 场景图生成任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundSceneGeneratorCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'scene-generator', reason);
}

/**
 * 全局风格化任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundGlobalStyleCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'GLOBAL_STYLE', reason);
}

/**
 * 图片高清放大任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundImageUpscalerCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'image-upscaler', reason);
}

/**
 * 虚拟试鞋任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundVirtualShoeModelCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'VIRTUAL_SHOE_MODEL', reason);
}

/**
 * 图片换背景任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundCutoutCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'cutout', reason);
}

/**
 * 智能扩图任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundImageExpansionCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'image-expansion', reason);
}

/**
 * 图像上色任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundImageColorizationCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'IMAGE_COLORIZATION', reason);
}

/**
 * 局部重绘任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundLocalRedrawCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'LOCAL_REDRAW', reason);
}

/**
 * 营销图生成任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundMarketingImagesCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'marketing-images', reason);
}

/**
 * 图片翻译任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundTranslateCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'translate', reason);
}

/**
 * 模特换肤任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundModelSkinChangerCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'model-skin-changer', reason);
}

/**
 * 模特试衣任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundClothingSimulationCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'clothing-simulation', reason);
}

/**
 * 文生图片任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundTextToImageCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'TEXT_TO_IMAGE', reason);
}

/**
 * 指令编辑任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundImageEditCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'IMAGE_EDIT', reason);
}

/**
 * 图像智能消除任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundImageRemovalCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'image-removal', reason);
}

/**
 * 模糊图片变清晰任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundImageSharpeningCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'IMAGE_SHARPENING', reason);
}

/**
 * 垫图任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundDiantuCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'DIANTU', reason);
}

/**
 * 智能服饰分割任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundClothSegmentationCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'CLOTH_SEGMENTATION', reason);
}

/**
 * 智能虚拟模特试穿任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} reason - 退款原因
 * @returns {Promise<boolean>} - 退款是否成功
 */
async function refundVirtualModelVtonCredits(userId, taskId, reason = '任务失败') {
  return refundFeatureCredits(userId, taskId, 'VIRTUAL_MODEL_VTON', reason);
}

// 导出所有函数
module.exports = {
  // 通用退款函数
  refundFeatureCredits,
  
  // 各功能专用退款函数
  refundSceneGeneratorCredits,
  refundGlobalStyleCredits,
  refundImageUpscalerCredits,
  refundVirtualShoeModelCredits,
  refundCutoutCredits,
  refundImageExpansionCredits,
  refundImageColorizationCredits,
  refundLocalRedrawCredits,
  refundMarketingImagesCredits,
  refundTranslateCredits,
  refundModelSkinChangerCredits,
  refundClothingSimulationCredits,
  refundTextToImageCredits,
  refundImageEditCredits,
  refundImageRemovalCredits,
  refundImageSharpeningCredits,
  refundDiantuCredits,
  refundClothSegmentationCredits,
  refundVirtualModelVtonCredits,
  
  // 工具函数
  getGlobalTasksVariable,
  recordRefundInfo
}; 