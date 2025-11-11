const { FeatureUsage } = require('../models/FeatureUsage');
const User = require('../models/User');
const { FEATURES } = require('./featureAccess');

/**
 * 统一的功能使用中间件
 * 实现免费次数检查→积分扣除→记录生成的完整逻辑
 * @param {string} featureName - 功能名称
 * @param {object} options - 可选配置
 * @param {function} options.calculateCreditCost - 动态计算积分消耗的函数
 * @returns {function} Express中间件函数
 */
const createUnifiedFeatureMiddleware = (featureName, options = {}) => {
  return async (req, res, next) => {
    try {
      if (!req.user || (!req.user.id && !req.user.userId)) {
        return res.status(401).json({
          success: false,
          message: '用户认证信息缺失'
        });
      }
      
      const userId = req.user.id || req.user.userId;
      
      // 验证功能名称
      if (!featureName || !FEATURES[featureName]) {
        return res.status(400).json({
          success: false,
          message: '无效的功能名称'
        });
      }

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
          resetDate: today,
          details: JSON.stringify({ tasks: [] }) // 🔧 确保新记录有正确的details结构
        }
      });
      
      // 生成或获取任务ID，用于跟踪整个流程
      const taskId = req.body.taskId || `${featureName}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      req.body.taskId = taskId; // 确保后续处理可以使用相同的任务ID
      
      // 检查是否已经为此任务扣除过积分
      let alreadyCharged = false;
      if (usage.details) {
        try {
          const details = JSON.parse(usage.details || '{}');
          const recordedTaskIds = details.recordedTaskIds || [];
          alreadyCharged = recordedTaskIds.includes(taskId);
          
          if (alreadyCharged) {
            console.log(`任务ID=${taskId}已扣除过积分，跳过重复扣除`);
          }
        } catch (error) {
          console.error('解析使用记录详情失败:', error);
        }
      }
      
      // 计算积分消耗
      let creditCost = 0;
      if (typeof featureConfig.creditCost === 'function') {
        // 动态计算积分
        if (options.calculateCreditCost) {
          creditCost = options.calculateCreditCost(req, featureConfig);
        } else {
          creditCost = featureConfig.creditCost(req.body);
        }
      } else {
        // 固定积分消耗
        creditCost = featureConfig.creditCost;
      }
      
      // 特殊处理视频去除字幕功能 - 只检查积分是否足够，但不扣除
      const isVideoSubtitleRemover = featureName === 'VIDEO_SUBTITLE_REMOVER';
      if (isVideoSubtitleRemover) {
        // 计算实际所需积分，用于权限检查
        const duration = parseInt(req.body.videoDuration) || 30;
        creditCost = Math.ceil(duration / 30) * 30;
        console.log(`视频去除字幕功能 - 视频时长${duration}秒，需要${creditCost}积分，仅做权限检查`);
      }
      
      // 特殊处理视频去水印功能 - 只检查积分是否足够，但不扣除（任务完成时才扣除）
      const isVideoLogoRemoval = featureName === 'VIDEO_LOGO_REMOVAL';
      if (isVideoLogoRemoval) {
        // 计算实际所需积分，用于权限检查
        // 默认检查5积分（对应30秒视频的最小计费），实际扣费在任务完成时根据实际时长计算（每30秒5积分）
        creditCost = 5;
        console.log(`视频去水印功能 - 需要至少${creditCost}积分，仅做权限检查，任务完成时根据实际时长扣费（每30秒5积分）`);
      }
      
      // 特殊处理视频换人功能 - 只检查积分是否足够，但不扣除（任务完成时才扣除）
      const isVideoFaceSwap = featureName === 'VIDEO_FACE_SWAP';
      if (isVideoFaceSwap) {
        // 计算实际所需积分，用于权限检查
        creditCost = featureConfig.creditCost(req.body);
        console.log(`视频换人功能 - 需要${creditCost}积分，仅做权限检查，任务完成时才扣除`);
      }
      
      // 特殊处理视频换脸功能（通用视频人脸融合）- 只检查积分是否足够，但不扣除（任务完成时才扣除）
      const isVideoFaceFusion = featureName === 'VIDEO_FACE_FUSION';
      if (isVideoFaceFusion) {
        // 计算实际所需积分，用于权限检查
        creditCost = featureConfig.creditCost(req.body);
        console.log(`视频换脸功能 - 需要${creditCost}积分，仅做权限检查，任务完成时才扣除`);
      }
      
      // 特殊处理局部重绘功能 - 只检查积分是否足够，但不扣除（任务完成时才扣除）
      const isLocalRedraw = featureName === 'LOCAL_REDRAW';
      
      // 🔧 特殊处理视频风格重绘功能 - 延迟计费，任务创建时不增加使用次数
      const isVideoStyleRepaint = featureName === 'VIDEO_STYLE_REPAINT';
      // 🔧 特殊处理文生视频和图生视频功能 - 延迟计费，任务创建时不增加使用次数
      const isTextToVideo = featureName === 'text-to-video';
      const isImageToVideo = featureName === 'image-to-video';
      
      if (isLocalRedraw) {
        console.log(`局部重绘功能 - 需要${creditCost}积分，仅做权限检查，任务完成时才扣除积分`);
      }
      if (isTextToVideo) {
        console.log(`文生视频功能 - 需要66积分，仅做权限检查，任务完成时才扣除积分`);
      }
      if (isImageToVideo) {
        console.log(`图生视频功能 - 需要66积分，仅做权限检查，任务完成时才扣除积分`);
      }
      
      // 检查是否在免费使用次数内
      let usageType = 'free';
      let finalCreditCost = 0;
      
      // 多图转视频功能：延迟计费，在任务完成时才判断免费还是收费
      if (featureName === 'MULTI_IMAGE_TO_VIDEO') {
        // 在任务创建阶段，正确判断是否为免费使用
        const user = await User.findByPk(userId);
        
        // 根据视频时长计算所需积分
        const duration = parseInt(req.body.duration) || 5; // 默认5秒
        const baseCredits = 30; // 每30秒30积分
        const requiredCredits = Math.ceil(duration / 30) * baseCredits;
        
        // 🔧 修改：多图转视频功能无免费次数，所有使用都收费
        let isCurrentTaskFree = false; // 强制设置为false，不再有免费使用
        let completedTasks = 0;
        
        if (usage.details) {
          try {
            const details = JSON.parse(usage.details);
            if (details.tasks && Array.isArray(details.tasks)) {
              // 统计已完成的任务数量（不论免费还是付费）
              completedTasks = details.tasks.filter(t => 
                t.status === 'SUCCEEDED' || t.status === 'completed'
              ).length;
            }
          } catch (e) {
            console.error('解析任务详情失败:', e);
          }
        }
        
        console.log(`[任务创建] 多图转视频免费判断: 用户ID=${userId}, 已完成任务数=${completedTasks}, 当前任务是否免费=${isCurrentTaskFree}`);
        
        if (!isCurrentTaskFree && user.credits < requiredCredits) {
          // 不是免费任务且积分不足
          const shortfall = requiredCredits - user.credits;
          return res.status(402).json({
            success: false,
            message: `积分不足，无法使用多图转视频功能`,
            error: 'INSUFFICIENT_CREDITS',
            data: {
              featureName: '多图转视频',
              requiredCredits: requiredCredits,
              currentCredits: user.credits,
              shortfall: shortfall,
              freeUsageLimit: 1,
              freeUsageUsed: completedTasks,
              videoDuration: duration,
              suggestion: `您还需要 ${shortfall} 积分才能使用此功能，请前往充值页面购买积分。`
            }
          });
        }
        
        // 设置使用类型和积分消耗
        if (isCurrentTaskFree) {
          usageType = 'free';
          finalCreditCost = 0;
        } else {
          usageType = 'deferred'; // 延迟计费，任务完成时扣费
          finalCreditCost = requiredCredits;
        }
        
        console.log(`用户ID ${userId} 使用多图转视频功能，使用类型=${usageType}，视频时长${duration}秒，积分消耗=${finalCreditCost}`);
      } else if (featureName === 'VIDEO_STYLE_REPAINT') {
        // 🔧 视频风格重绘功能：延迟计费，所有使用都收费（无免费次数）
        const user = await User.findByPk(userId);
        
        // 🔧 重要修复：视频风格重绘功能无免费次数，所有使用都收费
        let isCurrentTaskFree = false;
        let totalTasks = 0;
        
        if (usage.details) {
          try {
            const details = JSON.parse(usage.details);
            if (details.tasks && Array.isArray(details.tasks)) {
              // 统计所有历史任务数量（不论状态如何）
              totalTasks = details.tasks.length;
              console.log(`视频风格重绘免费判断 - 解析details成功: 历史任务总数=${totalTasks}`);
            }
          } catch (e) {
            console.error('解析任务详情失败:', e);
            totalTasks = 0; // 解析失败时默认为0
          }
        } else {
          // 🔧 如果details为空（新用户），则历史任务数为0
          totalTasks = 0;
          console.log(`视频风格重绘免费判断 - details为空: 历史任务总数=${totalTasks}`);
        }
        
        // 🔧 修改：视频风格重绘功能无免费次数，所有使用都收费
        isCurrentTaskFree = false;
        console.log(`视频风格重绘免费判断 - 最终结果: 历史任务总数=${totalTasks}, 当前任务是否免费=${isCurrentTaskFree} (已设置为无免费次数)`);
        
        console.log(`[任务创建] 视频风格重绘免费判断: 用户ID=${userId}, 历史任务总数=${totalTasks}, 当前任务是否免费=${isCurrentTaskFree}`);
        
        // 对于非免费任务，检查用户积分是否足够（虽然创建时不扣费，但需要验证余额）
        if (!isCurrentTaskFree) {
          // 估算所需积分（实际积分在任务完成时计算）
          const estimatedCredits = 30; // 预估积分，实际按时长和分辨率计费
          
          if (user.credits < estimatedCredits) {
            const shortfall = estimatedCredits - user.credits;
            return res.status(402).json({
              success: false,
              message: `积分不足，无法使用视频风格重绘功能`,
              error: 'INSUFFICIENT_CREDITS',
              data: {
                featureName: '视频风格重绘',
                requiredCredits: '按实际时长和分辨率计费',
                currentCredits: user.credits,
                shortfall: shortfall,
                freeUsageLimit: 1,
                freeUsageUsed: totalTasks,
                estimatedCredits: estimatedCredits,
                suggestion: `您还需要至少 ${shortfall} 积分才能使用此功能，实际消耗按视频时长和分辨率计费，请前往充值页面购买积分。`
              }
            });
          }
        }
        
        // 设置使用类型和积分消耗
        if (isCurrentTaskFree) {
          usageType = 'free';
          finalCreditCost = 0;
        } else {
          usageType = 'deferred'; // 延迟计费，任务完成时扣费
          finalCreditCost = 0; // 创建时不扣费
        }
        
        console.log(`用户ID ${userId} 使用视频风格重绘功能，使用类型=${usageType}，积分消耗=${finalCreditCost}`);
      } else if (featureName === 'text-to-video' || featureName === 'image-to-video') {
        // 🔧 文生视频和图生视频功能：延迟计费，在任务完成时才判断免费还是收费
        const user = await User.findByPk(userId);
        
        // 🔧 重要修复：正确判断当前任务是否免费 - 基于历史任务总数量（不论状态如何）
        // 修复原因：如果基于已完成任务数，当第一个任务还在pending时创建第二个任务，会导致第二个任务也被判定为免费
        let isCurrentTaskFree = false;
        let totalTasks = 0;
        
        if (usage.details) {
          try {
            const details = JSON.parse(usage.details);
            if (details.tasks && Array.isArray(details.tasks)) {
              // 统计所有历史任务数量（不论状态如何，包括pending、completed、SUCCEEDED、FAILED等所有状态）
              totalTasks = details.tasks.length;
              console.log(`${featureName}免费判断 - 解析details成功: 历史任务总数=${totalTasks}`);
            }
          } catch (e) {
            console.error('解析任务详情失败:', e);
            totalTasks = 0; // 解析失败时默认为0
          }
        } else {
          // 🔧 如果details为空（新用户），则历史任务数为0
          totalTasks = 0;
          console.log(`${featureName}免费判断 - details为空: 历史任务总数=${totalTasks}`);
        }
        
        // 如果没有历史任务，则当前任务免费（首次使用）
        isCurrentTaskFree = totalTasks === 0;
        
        console.log(`[任务创建] ${featureName}免费判断: 用户ID=${userId}, 历史任务总数=${totalTasks}, 当前任务是否免费=${isCurrentTaskFree}`);
        
        const requiredCredits = 66; // 固定66积分
        
        if (!isCurrentTaskFree && user.credits < requiredCredits) {
          // 不是免费任务且积分不足
          const shortfall = requiredCredits - user.credits;
          return res.status(400).json({
            success: false,
            message: `积分不足，需要${requiredCredits}积分，当前余额${user.credits}积分，还需${shortfall}积分`,
            code: 'INSUFFICIENT_CREDITS',
            required: requiredCredits,
            current: user.credits,
            shortfall: shortfall
          });
        }
        
        // 设置使用类型和积分消耗
        if (isCurrentTaskFree) {
          usageType = 'free';
          finalCreditCost = 0;
        } else {
          usageType = 'deferred'; // 延迟计费，任务完成时扣费
          finalCreditCost = 0; // 创建时不扣费
        }
        
        console.log(`用户ID ${userId} 使用${featureName}功能，使用类型=${usageType}，积分消耗=${finalCreditCost}`);
      } else if (usage.usageCount >= featureConfig.freeUsage) {
        // 超过免费次数，检查用户积分
        const user = await User.findByPk(userId);
        
        if (user.credits < creditCost) {
          // 获取功能的中文名称
          const featureNames = {
            'LOCAL_REDRAW': '局部重绘',
            'IMAGE_EDIT': '图像指令编辑',
            'IMAGE_COLORIZATION': '图像上色',
            'image-expansion': '智能扩图',
            'IMAGE_SHARPENING': '模糊图片变清晰',
            'GLOBAL_STYLE': '全局风格化',
            'DIANTU': '垫图',
            'CLOTH_SEGMENTATION': '智能服饰分割',
            'VIRTUAL_MODEL_VTON': '智能虚拟模特试穿',
            'VIRTUAL_SHOE_MODEL': '鞋靴虚拟试穿'
          };
          
          const featureDisplayName = featureNames[featureName] || featureName;
          const shortfall = creditCost - user.credits;
          
          return res.status(402).json({
            success: false,
            message: `积分不足，无法使用${featureDisplayName}功能`,
            error: 'INSUFFICIENT_CREDITS',
            data: {
              featureName: featureDisplayName,
              requiredCredits: creditCost,
              currentCredits: user.credits,
              shortfall: shortfall,
              freeUsageLimit: featureConfig.freeUsage,
              freeUsageUsed: usage.usageCount,
              suggestion: `您还需要 ${shortfall} 积分才能使用此功能，请前往充值页面购买积分。`
            }
          });
        }
        
        // 只有在未扣除过积分的情况下才扣除
        if (!alreadyCharged) {
          // 对于视频去除字幕功能、局部重绘功能和视频换人功能，在任务提交阶段不扣除积分
          // 修复：视频去水印/logo 也属于延迟计费，提交阶段不扣费
          if (!isVideoSubtitleRemover && !isLocalRedraw && !isVideoFaceSwap && !isVideoFaceFusion && !isVideoLogoRemoval) {
            // 扣除积分
            user.credits -= creditCost;
            await user.save();
            
            // 更新使用记录的积分消费
            usage.credits = (usage.credits || 0) + creditCost;
            await usage.save();
            
            usageType = 'paid';
            finalCreditCost = creditCost;
            
            console.log(`用户ID ${userId} 使用 ${featureName} 功能，扣除 ${creditCost} 积分，剩余 ${user.credits} 积分，功能总消费 ${usage.credits} 积分`);
          } else {
            // 视频去除字幕功能、局部重绘功能和视频换人功能 - 不扣除积分，但标记为付费使用
            // 修复：包含视频去水印/logo
            usageType = 'paid';
            finalCreditCost = creditCost; // 记录积分消耗，但实际不扣除
            let featureDisplayName = '未知功能';
            if (isVideoSubtitleRemover) featureDisplayName = '视频去除字幕';
            else if (isLocalRedraw) featureDisplayName = '局部重绘';
            else if (isVideoFaceSwap) featureDisplayName = '视频换人';
            else if (isVideoFaceFusion) featureDisplayName = '视频换脸';
            else if (isVideoLogoRemoval) featureDisplayName = '视频去水印';
            console.log(`用户ID ${userId} 使用${featureDisplayName}功能，需要 ${creditCost} 积分，暂不扣除，任务完成后再扣费`);
          }
        } else {
          usageType = 'paid';
          finalCreditCost = creditCost; // 记录积分消耗，但不重复扣除
          console.log(`用户ID ${userId} 使用 ${featureName} 功能，任务ID=${taskId}已扣除过积分，跳过重复扣除`);
        }
      } else {
        if (featureName === 'MULTI_IMAGE_TO_VIDEO') {
          console.log(`用户ID ${userId} 使用多图转视频功能的延迟计费模式`);
          } else {
          console.log(`用户ID ${userId} 使用 ${featureName} 功能的免费次数 ${usage.usageCount + 1}/${featureConfig.freeUsage}`);
        }
      }
      
      // 更新使用次数 - 修复视频去除字幕功能、局部重绘功能、视频风格重绘功能、文生视频和图生视频功能的累积逻辑
      if (!alreadyCharged && featureName !== 'MULTI_IMAGE_TO_VIDEO') {
        // 对于延迟计费的功能，使用次数将在saveTaskDetails中正确累积
        // 修复：视频去水印/logo 也是延迟计费，创建时不增加 usageCount
        if (!isVideoSubtitleRemover && !isLocalRedraw && !isVideoStyleRepaint && !isTextToVideo && !isImageToVideo && !isVideoFaceSwap && !isVideoFaceFusion && !isVideoLogoRemoval) {
          usage.usageCount += 1;
          usage.lastUsedAt = new Date();
          await usage.save();
        } else {
          // 延迟计费功能只更新最后使用时间，使用次数在saveTaskDetails中处理
          usage.lastUsedAt = new Date();
          
          // 不再在创建任务时增加使用次数，而是在任务完成时根据已完成的任务数量判断
          
          await usage.save();
          let featureDisplayName = '未知功能';
          if (isVideoSubtitleRemover) featureDisplayName = '视频去除字幕';
          else if (isLocalRedraw) featureDisplayName = '局部重绘';
          else if (isVideoStyleRepaint) featureDisplayName = '视频风格重绘';
          else if (isTextToVideo) featureDisplayName = '文生视频';
          else if (isImageToVideo) featureDisplayName = '图生视频';
          else if (isVideoFaceSwap) featureDisplayName = '视频换人';
          console.log(`${featureDisplayName}功能创建任务，使用次数将在任务完成时计算`);
        }
      } else if (featureName === 'MULTI_IMAGE_TO_VIDEO') {
        // 多图转视频功能只更新最后使用时间，不增加使用次数（在任务完成时才增加）
        usage.lastUsedAt = new Date();
        await usage.save();
        console.log(`多图转视频功能创建任务，不增加使用次数，当前使用次数: ${usage.usageCount}`);
      }
      
// 🔧 重要修复：正确设置免费状态 - 基于积分消耗而非使用类型
let actualIsFree = false;
if (featureName === 'LOCAL_REDRAW') {
  // 局部重绘功能：基于已完成的任务数量判断
  let completedTasks = 0;
  
  if (usage.details) {
    try {
      const details = JSON.parse(usage.details);
      if (details.tasks && Array.isArray(details.tasks)) {
        // 统计已完成的任务数量（不论免费还是付费）
        completedTasks = details.tasks.filter(t => 
          t.status === 'SUCCEEDED' || t.status === 'completed'
        ).length;
      }
    } catch (e) {
      console.error('解析任务详情失败:', e);
    }
  }
  
  // 如果已完成的任务数量小于免费次数，则当前任务免费
  const featureConfig = FEATURES[featureName];
  actualIsFree = completedTasks < featureConfig.freeUsage;
  console.log(`局部重绘功能免费判断: 已完成任务数=${completedTasks}, 免费次数=${featureConfig.freeUsage}, 是否免费=${actualIsFree}`);
} else if (featureName === 'VIDEO_STYLE_REPAINT') {
  // 🔧 视频风格重绘功能：无免费次数，所有使用都收费
  actualIsFree = false;
} else if (featureName === 'VIDEO_SUBTITLE_REMOVER') {
  // 🔧 视频去除字幕功能：无免费次数，所有使用都收费
  actualIsFree = false;
} else if (featureName === 'VIDEO_LOGO_REMOVAL') {
  // 🔧 视频去水印/logo功能：无免费次数，所有使用都收费
  actualIsFree = false;
} else if (featureName === 'MULTI_IMAGE_TO_VIDEO' || featureName === 'text-to-video' || featureName === 'image-to-video') {
  // 多图转视频、文生视频、图生视频功能：基于积分消耗确定免费状态
  actualIsFree = finalCreditCost === 0;
} else {
  // 其他功能：基于使用类型确定免费状态
  actualIsFree = usageType === 'free';
}
      
      // 将使用信息添加到请求对象
      req.featureUsage = {
        featureName,
        usageType,
        creditCost: finalCreditCost,
        isFree: actualIsFree, // 修复：基于积分消耗确定免费状态
        remainingFreeUsage: Math.max(0, featureConfig.freeUsage - usage.usageCount),
        usage: usage, // 传递usage对象，方便后续保存任务详情
        taskId: taskId // 传递任务ID，用于后续处理
      };
      
      console.log(`功能 ${featureName} 使用记录已处理:`, {
        usageType,
        creditCost: finalCreditCost,
        isFree: actualIsFree, // 修复：显示正确的免费状态
        taskId: taskId
      });
      
      next();
    } catch (error) {
      console.error(`功能 ${featureName} 使用记录处理错误:`, error);
      res.status(500).json({
        success: false,
        message: '服务器错误，无法验证功能访问权限'
      });
    }
  };
};

/**
 * 保存任务详情到功能使用记录中
 * @param {Object} usage - 功能使用记录对象
 * @param {Object} taskInfo - 任务信息对象，包含taskId、creditCost、isFree等
 * @returns {Promise<void>}
 */
async function saveTaskDetails(usage, taskInfo) {
  try {
    if (!usage) {
      console.error('保存任务详情失败: usage对象为空');
      return;
    }

    // 初始化details字段，如果不存在
    let details;
    try {
      details = usage.details ? JSON.parse(usage.details) : { tasks: [] };
    } catch (parseError) {
      console.error('解析details字段失败，重新初始化:', parseError);
      details = { tasks: [] };
    }

    // 确保details对象有tasks数组
    if (!details.tasks) {
      details.tasks = [];
    }

    // 🔧 调试三重记录问题：添加详细日志
    console.log(`saveTaskDetails调用 - 任务ID: ${taskInfo.taskId}, 功能: ${taskInfo.featureName}, 状态: ${taskInfo.status}`);
    console.log(`当前已有任务数量: ${details.tasks.length}`);
    if (details.tasks.length > 0) {
        console.log(`现有任务ID列表: ${details.tasks.map(t => t.taskId).join(', ')}`);
    }
    
    // 检查是否已存在该任务
    const existingTaskIndex = details.tasks.findIndex(task => task.taskId === taskInfo.taskId);
    
    if (existingTaskIndex >= 0) {
        console.log(`找到现有任务，索引: ${existingTaskIndex}, 将更新现有记录`);
        
        // 🔧 强化防重复机制：如果任务已经是completed状态，且新状态也是completed，则跳过处理
        const existingTask = details.tasks[existingTaskIndex];
        if (existingTask.status === 'completed' && taskInfo.status === 'completed') {
            console.log(`⚠️ 任务已完成，跳过重复处理: 任务ID=${taskInfo.taskId}`);
            return; // 直接返回，不进行任何更新
        }
    } else {
        console.log(`未找到现有任务，将创建新记录`);
    }
    
    if (existingTaskIndex >= 0) {
      // 更新现有任务
      const existingTask = details.tasks[existingTaskIndex];
      existingTask.creditCost = taskInfo.creditCost || existingTask.creditCost || 0;
      existingTask.isFree = taskInfo.isFree !== undefined ? taskInfo.isFree : existingTask.isFree || false;
      
      // 如果任务完成，更新完成时间
      if (taskInfo.status === 'completed') {
        existingTask.completedAt = new Date().toISOString();
        existingTask.status = 'completed';
      }
      
      // 更新额外数据
      if (taskInfo.extraData) {
        existingTask.extraData = { ...existingTask.extraData, ...taskInfo.extraData };
      }
      
      // 更新阿里云RequestId（如果有）
      if (taskInfo.aliCloudRequestId) {
        existingTask.aliCloudRequestId = taskInfo.aliCloudRequestId;
      }
      
      // 更新任务状态和错误信息
      if (taskInfo.status) {
        existingTask.status = taskInfo.status;
      }
      if (taskInfo.error) {
        existingTask.error = taskInfo.error;
      }
      if (taskInfo.errorDetails) {
        existingTask.errorDetails = taskInfo.errorDetails;
      }
      
      // 更新操作描述（如果有）
      if (taskInfo.operationText) {
        existingTask.operationText = taskInfo.operationText;
      }
      
      // 更新积分和免费状态（重要！）
      if (taskInfo.creditCost !== undefined) {
        existingTask.creditCost = taskInfo.creditCost;
      }
      if (taskInfo.isFree !== undefined) {
        existingTask.isFree = taskInfo.isFree;
      }
      
      console.log(`更新现有任务: 任务ID=${taskInfo.taskId}, 积分=${existingTask.creditCost}, 是否免费=${existingTask.isFree}`);
    } else {
      // 添加新任务 - 对于多图转视频，需要特殊处理
      const newTask = {
        taskId: taskInfo.taskId,
        timestamp: new Date().toISOString(),
        creditCost: taskInfo.creditCost || 0,
        isFree: taskInfo.isFree || false
      };

      // 添加操作描述（如果有）
      if (taskInfo.operationText) {
        newTask.operationText = taskInfo.operationText;
      }

      // 添加元数据（如果有）
      if (taskInfo.metadata) {
        newTask.metadata = taskInfo.metadata;
      }

      // 添加额外数据（如果有）
      if (taskInfo.extraData) {
        newTask.extraData = taskInfo.extraData;
      }
      
      // 添加阿里云RequestId（如果有）
      if (taskInfo.aliCloudRequestId) {
        newTask.aliCloudRequestId = taskInfo.aliCloudRequestId;
      }
      
      // 添加任务状态和错误信息
      if (taskInfo.status) {
        newTask.status = taskInfo.status;
      }
      if (taskInfo.error) {
        newTask.error = taskInfo.error;
      }
      if (taskInfo.errorDetails) {
        newTask.errorDetails = taskInfo.errorDetails;
      }
      
      // 如果任务完成，添加完成时间
      if (taskInfo.status === 'completed') {
        newTask.completedAt = new Date().toISOString();
        newTask.status = 'completed';
      }

      details.tasks.push(newTask);
      console.log(`添加新任务: 任务ID=${taskInfo.taskId}, 积分=${taskInfo.creditCost}, 是否免费=${taskInfo.isFree}`);
    }
    
    // 处理任务完成后的积分扣除逻辑
    // 支持多种完成状态标记: completed, COMPLETED, SUCCEEDED, FAILED
    if ((taskInfo.status === 'completed' || taskInfo.status === 'COMPLETED' || taskInfo.statusCode === 'SUCCEEDED' || taskInfo.status === 'FAILED') && taskInfo.featureName) {
      // 添加详细日志，记录任务完成状态
      console.log(`任务状态检测: 任务ID=${taskInfo.taskId}, 状态=${taskInfo.status}, 状态码=${taskInfo.statusCode || '无'}, 功能=${taskInfo.featureName}`);
      
      // 只有非失败任务才进行积分扣除
      if (taskInfo.status !== 'FAILED') {
        const completionResult = await handleTaskCompletion(usage, taskInfo);
        
        // 将更新信息保存到taskInfo中，供后续使用
        if (completionResult && taskInfo.featureName === 'MULTI_IMAGE_TO_VIDEO') {
          taskInfo._needsUpdate = true; // 标记需要更新
        }
      } else {
        console.log(`任务失败，跳过积分扣除: 任务ID=${taskInfo.taskId}`);
      }
    }
    
    // 🔧 重要修复：对于视频去字幕功能、视频数字人功能、视频换人功能和视频换脸功能，需要正确更新使用次数和积分统计
    if (taskInfo.featureName === 'VIDEO_SUBTITLE_REMOVER' || usage.featureName === 'VIDEO_SUBTITLE_REMOVER' ||
        taskInfo.featureName === 'DIGITAL_HUMAN_VIDEO' || usage.featureName === 'DIGITAL_HUMAN_VIDEO' ||
        taskInfo.featureName === 'VIDEO_FACE_SWAP' || usage.featureName === 'VIDEO_FACE_SWAP' ||
        taskInfo.featureName === 'VIDEO_FACE_FUSION' || usage.featureName === 'VIDEO_FACE_FUSION') {
      // 计算总任务数和总积分消费
      const totalTasks = details.tasks.length;
      const totalCredits = details.tasks.reduce((sum, task) => sum + (task.creditCost || 0), 0);
      
      // 更新使用次数和积分消费
      usage.usageCount = totalTasks;
      usage.credits = totalCredits;
      usage.lastUsedAt = new Date();
      
      const featureName = taskInfo.featureName || usage.featureName;
      let featureDisplayName = '未知功能';
      if (featureName === 'DIGITAL_HUMAN_VIDEO') featureDisplayName = '视频数字人';
      else if (featureName === 'VIDEO_SUBTITLE_REMOVER') featureDisplayName = '视频去字幕';
      else if (featureName === 'VIDEO_LOGO_REMOVAL') featureDisplayName = '视频去水印';
      else if (featureName === 'VIDEO_FACE_SWAP') featureDisplayName = '视频换人';
      else if (featureName === 'VIDEO_FACE_FUSION') featureDisplayName = '视频换脸';
      console.log(`✅ ${featureDisplayName}功能统计更新: 总任务数=${totalTasks}, 总积分=${totalCredits}`);
      
      // 移除这里的CreditHistory.create调用，因为handleTaskCompletion函数已经处理了积分扣除和记录
      // 这里重复记录会导致双倍扣费问题
    }
    
    // 更新usage对象
    usage.details = JSON.stringify(details);
    await usage.save();
    
    // 🔧 重要修复：如果是多图转视频功能且任务已完成或失败，需要同步积分信息到OSS存储
    if (taskInfo.featureName === 'MULTI_IMAGE_TO_VIDEO' && 
        (taskInfo.status === 'completed' || taskInfo.status === 'COMPLETED' || taskInfo.statusCode === 'SUCCEEDED' || taskInfo.status === 'FAILED')) {
      try {
        // 获取当前任务的最终积分信息
        const currentTask = details.tasks.find(task => task.taskId === taskInfo.taskId);
        if (currentTask) {
          // 使用全局函数更新OSS（避免循环依赖）
          if (global.updateMultiImageToVideoTaskInOSS) {
            // 🔧 关键修复：使用taskInfo中的最新积分信息，而不是currentTask中创建时的积分信息
            const finalCreditCost = taskInfo.creditCost || currentTask.creditCost;
            const finalIsFree = taskInfo.isFree !== undefined ? taskInfo.isFree : currentTask.isFree;
            
            // 🔧 修复：同步完整的任务信息，包括视频URL等
            const ossUpdates = {
              creditCost: finalCreditCost,
              isFree: finalIsFree,
              status: taskInfo.status === 'FAILED' ? 'FAILED' : 'completed'
            };
            
            // 如果任务包含视频相关信息，也要同步到OSS
            if (taskInfo.videoUrl) {
              ossUpdates.videoUrl = taskInfo.videoUrl;
            }
            if (taskInfo.videoCoverUrl) {
              ossUpdates.videoCoverUrl = taskInfo.videoCoverUrl;
            }
            if (taskInfo.videoDuration) {
              ossUpdates.videoDuration = taskInfo.videoDuration;
            }
            if (taskInfo.videoWidth) {
              ossUpdates.videoWidth = taskInfo.videoWidth;
            }
            if (taskInfo.videoHeight) {
              ossUpdates.videoHeight = taskInfo.videoHeight;
            }
            
            await global.updateMultiImageToVideoTaskInOSS(usage.userId, taskInfo.taskId, ossUpdates);
            console.log(`✅ 已同步多图转视频任务完整信息到OSS: 任务ID=${taskInfo.taskId}, 积分=${finalCreditCost}, 免费=${finalIsFree}, 状态=${taskInfo.status}, 视频URL=${taskInfo.videoUrl ? '已设置' : '未设置'}`);
          } else {
            console.warn('⚠️ 全局OSS更新函数不可用，跳过OSS同步');
          }
        }
      } catch (ossError) {
        console.error('❌ 同步任务积分信息到OSS失败:', ossError);
        // 不抛出错误，因为数据库已经更新成功
      }
    }
    
    console.log(`已记录任务详情: 任务ID=${taskInfo.taskId}, 积分=${taskInfo.creditCost}, 是否免费=${taskInfo.isFree}${taskInfo.operationText ? ', 操作=' + taskInfo.operationText : ''}`);
    
    // 🔧 重要修复：如果任务需要更新免费状态，在任务详情保存后立即更新
    if (taskInfo._needsUpdate && (taskInfo.featureName === 'MULTI_IMAGE_TO_VIDEO' || taskInfo.featureName === 'LOCAL_REDRAW')) {
      try {
        // 重新解析刚保存的任务详情
        const updatedDetails = JSON.parse(usage.details);
        const taskIndex = updatedDetails.tasks.findIndex(task => task.taskId === taskInfo.taskId);
        
        if (taskIndex >= 0) {
          // 更新任务的免费标记和积分消费
          updatedDetails.tasks[taskIndex].isFree = taskInfo.isFree;
          updatedDetails.tasks[taskIndex].creditCost = taskInfo.creditCost;
          
          // 重新保存到数据库
          usage.details = JSON.stringify(updatedDetails);
          await usage.save();
          
          console.log(`✅ 已更新任务详情: 任务ID=${taskInfo.taskId}, 免费=${taskInfo.isFree}, 积分=${taskInfo.creditCost}`);
        }
      } catch (finalUpdateError) {
        console.error('❌ 更新任务详情失败:', finalUpdateError);
      }
    }
    
    return true;
  } catch (error) {
    console.error('保存任务详情失败:', error);
    return false;
  }
}

/**
 * 处理任务完成后的积分扣除逻辑
 * @param {Object} usage - 功能使用记录对象
 * @param {Object} taskInfo - 任务信息对象
 */
async function handleTaskCompletion(usage, taskInfo) {
  try {
    const User = require('../models/User');
    const { FEATURES } = require('./featureAccess');
    
    const userId = usage.userId;
    const featureName = taskInfo.featureName;
    const creditCost = taskInfo.creditCost || 0;
    const isFree = taskInfo.isFree || false;
    
    console.log(`处理任务完成扣费: 用户=${userId}, 功能=${featureName}, 积分=${creditCost}, 免费=${isFree}, 任务ID=${taskInfo.taskId}`);
    
    // 记录详细的任务信息，便于排查问题
    console.log(`任务详情: ${JSON.stringify({
      taskId: taskInfo.taskId,
      featureName: featureName,
      status: taskInfo.status,
      statusCode: taskInfo.statusCode,
      creditCost: creditCost,
      isFree: isFree,
      timestamp: new Date().toISOString()
    }, null, 2)}`);
    
    // 获取功能配置
    const featureConfig = FEATURES[featureName];
    if (!featureConfig) {
      console.error(`功能配置未找到: ${featureName}`);
      return;
    }
    
    // 检查是否为免费使用
    let isFreeUsage = false;
    
    if (featureName === 'MULTI_IMAGE_TO_VIDEO') {
      // 多图转视频功能：在任务完成时进行免费判断
      let details;
      try {
        details = usage.details ? JSON.parse(usage.details) : { tasks: [] };
      } catch (e) {
        details = { tasks: [] };
      }
      
      // 🔧 修改：多图转视频功能无免费次数，所有使用都收费
      const completedTasks = details.tasks.filter(t => 
        (t.status === 'SUCCEEDED' || t.status === 'completed') && 
        t.taskId !== taskInfo.taskId // 排除当前任务
      ).length;
      
      // 强制设置为收费，不再有免费使用
      isFreeUsage = false;
      
      console.log(`[任务完成] 多图转视频免费使用判断: 用户${userId}, 已完成任务数: ${completedTasks}, 当前任务是否免费: ${isFreeUsage}`);
      
      // 更新任务信息中的免费标记（这很重要！）
      taskInfo.isFree = isFreeUsage;
      // 对于多图转视频，重新计算积分而不是使用默认的creditCost
      if (!isFreeUsage) {
        const duration = taskInfo.metadata?.duration || taskInfo.duration || 5;
        taskInfo.creditCost = Math.max(30, Math.ceil(duration / 30) * 30);
        console.log(`[任务完成] 多图转视频任务积分更新: 时长=${duration}秒, 积分=${taskInfo.creditCost}`);
      } else {
        taskInfo.creditCost = 0;
      }
      
      // 如果这是第一个付费任务完成，需要更新使用次数
      if (!isFreeUsage && completedTasks === 0) {
        usage.usageCount = Math.max(usage.usageCount, 1); // 确保使用次数至少为1
        console.log(`[任务完成] 更新多图转视频使用次数: ${usage.usageCount}`);
      }
    } else if (featureName === 'VIDEO_STYLE_REPAINT') {
      // 🔧 视频风格重绘功能：所有使用都收费，从已保存的任务详情中获取计费状态
      let details;
      try {
        details = usage.details ? JSON.parse(usage.details) : { tasks: [] };
      } catch (e) {
        details = { tasks: [] };
      }
      
      // 查找当前任务的免费状态
      const currentTask = details.tasks.find(t => t.taskId === taskInfo.taskId);
      if (currentTask) {
        isFreeUsage = currentTask.isFree || false;
        console.log(`[任务完成] 视频风格重绘从保存的任务详情中获取免费状态: 任务ID=${taskInfo.taskId}, 免费=${isFreeUsage}`);
      } else {
        // 🔧 修改：视频风格重绘功能无免费次数，所有使用都收费
        const totalTasks = details.tasks.length;
        isFreeUsage = false;
        console.log(`[任务完成] 视频风格重绘未找到任务记录，基于历史任务总数判断: 总任务数=${totalTasks}, 免费=${isFreeUsage} (已设置为无免费次数)`);
      }
    } else if (featureName === 'text-to-video' || featureName === 'image-to-video') {
      // 🔧 文生视频和图生视频功能：参照多图转视频逻辑，在任务完成时重新判断免费状态
      // 修复原因：创建时基于所有任务（包括pending）判断，可能不准确；完成时基于已完成任务判断更准确
      let details;
      try {
        details = usage.details ? JSON.parse(usage.details) : { tasks: [] };
      } catch (e) {
        details = { tasks: [] };
      }
      
      // 🔧 重要修复：统计所有已完成的任务数量（不包括当前任务）
      const completedTasks = details.tasks.filter(t => 
        (t.status === 'SUCCEEDED' || t.status === 'completed') && 
        t.taskId !== taskInfo.taskId // 排除当前任务
      ).length;
      
      // 🔧 修改：视频风格重绘功能无免费次数，所有使用都收费
      isFreeUsage = false;
      
      console.log(`[任务完成] ${featureName}免费使用判断: 用户${userId}, 已完成任务数: ${completedTasks}, 当前任务是否免费: ${isFreeUsage}`);
      
      // 更新任务信息中的免费标记（这很重要！）
      taskInfo.isFree = isFreeUsage;
      
      // 根据免费状态设置积分消耗
      if (!isFreeUsage) {
        taskInfo.creditCost = 66; // 固定66积分
        console.log(`[任务完成] ${featureName}付费任务积分更新: 积分=${taskInfo.creditCost}`);
      } else {
        taskInfo.creditCost = 0;
        console.log(`[任务完成] ${featureName}免费任务积分更新: 积分=${taskInfo.creditCost}`);
      }
      
      // 🔧 修改：由于视频风格重绘无免费次数，每次使用都更新使用次数
      usage.usageCount = Math.max(usage.usageCount, completedTasks + 1); // 确保使用次数正确递增
      console.log(`[任务完成] 更新${featureName}使用次数: ${usage.usageCount}`);
    } else {
// 其他功能：使用任务创建时的免费标记，避免重新计算导致的逻辑错误
// 因为usageCount在任务创建时已经被更新，重新计算会导致判断错误
// 🔧 修复：对于局部重绘功能，重新判断免费状态而不是使用创建时的标记
if (featureName === 'LOCAL_REDRAW') {
  // 局部重绘功能：基于已完成的任务数量判断是否为免费使用
  // 修复问题：不使用usageCount，而是统计完成的任务数量
  let completedTasks = 0;
  
  if (usage.details) {
    try {
      const details = JSON.parse(usage.details);
      if (details.tasks && Array.isArray(details.tasks)) {
        // 统计已完成的任务数量（不论免费还是付费）
        completedTasks = details.tasks.filter(t => 
          (t.status === 'SUCCEEDED' || t.status === 'completed') &&
          t.taskId !== taskInfo.taskId // 排除当前任务
        ).length;
      }
    } catch (e) {
      console.error('解析任务详情失败:', e);
    }
  }
  
  // 如果没有已完成的任务，则当前任务免费（首次使用）
  isFreeUsage = completedTasks < featureConfig.freeUsage;
  console.log(`[任务完成] 局部重绘功能重新判断免费状态: 已完成任务数=${completedTasks}, 免费次数=${featureConfig.freeUsage}, 是否免费=${isFreeUsage}`);
  
  // 设置任务的免费状态和积分消耗
  taskInfo.isFree = isFreeUsage;
  if (!isFreeUsage) {
    taskInfo.creditCost = featureConfig.creditCost;
    console.log(`[任务完成] 局部重绘功能超过免费次数，设置为付费使用: 积分=${taskInfo.creditCost}`);
    
    // 修复保存任务详情时的免费状态不一致问题
    // 将任务标记为需要更新，确保在保存详情后再次更新免费状态
    taskInfo._needsUpdate = true;
  } else {
    taskInfo.creditCost = 0;
  }
} else if (featureName === 'VIDEO_SUBTITLE_REMOVER') {
  // 🔧 视频去除字幕功能：无免费次数，所有使用都收费
  isFreeUsage = false;
  console.log(`[任务完成] 视频去除字幕功能免费判断: 无免费次数，当前任务收费`);
  
  // 设置任务的免费状态和积分消耗
  taskInfo.isFree = isFreeUsage;
  if (!isFreeUsage) {
    // 积分消耗已在上面的actualCreditCost计算中处理
    console.log(`[任务完成] 视频去除字幕功能设置为付费使用`);
  }
} else if (featureName === 'VIDEO_LOGO_REMOVAL') {
  // 🔧 视频去水印/logo功能：无免费次数，所有使用都收费
  isFreeUsage = false;
  console.log(`[任务完成] 视频去水印功能免费判断: 无免费次数，当前任务收费`);
  
  // 设置任务的免费状态和积分消耗
  taskInfo.isFree = isFreeUsage;
  if (!isFreeUsage) {
    // 积分消耗已在上面的actualCreditCost计算中处理
    console.log(`[任务完成] 视频去水印功能设置为付费使用`);
  }
} else if (featureName === 'VIDEO_FACE_SWAP') {
  // 🔧 视频换人功能：无免费次数，所有使用都收费
  isFreeUsage = false;
  console.log(`[任务完成] 视频换人功能免费判断: 无免费次数，当前任务收费`);
  
  // 设置任务的免费状态和积分消耗
  taskInfo.isFree = isFreeUsage;
} else if (featureName === 'VIDEO_FACE_FUSION') {
  // 🔧 视频换脸功能：无免费次数，所有使用都收费
  isFreeUsage = false;
  console.log(`[任务完成] 视频换脸功能免费判断: 无免费次数，当前任务收费`);
  
  // 设置任务的免费状态和积分消耗
  taskInfo.isFree = isFreeUsage;
  if (!isFreeUsage) {
    // 积分消耗已在上面的actualCreditCost计算中处理
    console.log(`[任务完成] 视频换脸功能设置为付费使用`);
  }
} else {
  isFreeUsage = taskInfo.isFree || false;
  console.log(`[任务完成] ${featureName}功能使用任务创建时的免费标记: ${isFreeUsage}, 当前使用次数: ${usage.usageCount}, 免费次数: ${featureConfig.freeUsage}`);
}
    }
    
    // 🔧 重要修复：对于多图转视频功能，重新计算积分而不是使用创建时的creditCost
    let actualCreditCost = 0;
    if (!isFreeUsage) {
      if (featureName === 'MULTI_IMAGE_TO_VIDEO') {
        // 🔧 多图转视频：根据用户提交时指定的视频时长重新计算积分
        // 优先级：metadata.duration > extraData.duration > taskInfo.duration > 默认5秒
        const duration = taskInfo.metadata?.duration 
          || taskInfo.extraData?.duration 
          || taskInfo.duration 
          || 5;
        actualCreditCost = Math.max(30, Math.ceil(duration / 30) * 30);
        console.log(`[任务完成] 多图转视频重新计算积分: 用户指定时长=${duration}秒, 积分=${actualCreditCost}`);
      } else if (featureName === 'VIDEO_STYLE_REPAINT') {
        // 🔧 视频风格重绘功能在任务完成时才扣除积分
        const duration = taskInfo.metadata?.duration || taskInfo.duration || 3;
        const resolution = taskInfo.metadata?.resolution || taskInfo.resolution || 540;
        const rate = resolution <= 540 ? 3 : 6;
        actualCreditCost = Math.ceil(duration) * rate;
        console.log(`[任务完成] 视频风格重绘功能在任务完成时扣费: 任务ID=${taskInfo.taskId}, 时长=${duration}秒, 分辨率=${resolution}P, 费率=${rate}积分/秒, 积分=${actualCreditCost}`);
      } else if (featureName === 'LOCAL_REDRAW') {
        // 🔧 局部重绘功能在任务完成时才扣除积分
        actualCreditCost = taskInfo.creditCost || creditCost;
        console.log(`[任务完成] ${featureName}功能在任务完成时扣费: 任务ID=${taskInfo.taskId}, 积分=${actualCreditCost}`);
      } else if (featureName === 'text-to-video' || featureName === 'image-to-video') {
        // 🔧 文生视频和图生视频功能在任务完成时扣除固定66积分
        actualCreditCost = 66;
        console.log(`[任务完成] ${featureName}功能在任务完成时扣费: 任务ID=${taskInfo.taskId}, 积分=${actualCreditCost}`);
      } else if (featureName === 'VIDEO_SUBTITLE_REMOVER') {
        // 🔧 视频去除字幕功能在任务完成时才扣除积分
        const duration = taskInfo.metadata?.duration || taskInfo.duration || 30;
        actualCreditCost = Math.ceil(duration / 30) * 30;
        console.log(`[任务完成] 视频去除字幕功能在任务完成时扣费: 任务ID=${taskInfo.taskId}, 时长=${duration}秒, 积分=${actualCreditCost}`);
      } else if (featureName === 'VIDEO_LOGO_REMOVAL') {
        // 🔧 视频去水印/logo功能在任务完成时才扣除积分
        // 根据实际视频时长计算积分，每30秒5积分，不足30秒按30秒计算
        const duration = taskInfo.metadata?.duration || taskInfo.duration || 30;
        actualCreditCost = Math.ceil(duration / 30) * 5;
        console.log(`[任务完成] 视频去水印功能在任务完成时扣费: 任务ID=${taskInfo.taskId}, 时长=${duration}秒, 积分=${actualCreditCost}`);
      } else if (featureName === 'VIDEO_FACE_SWAP') {
        // 🔧 视频换人功能在任务完成时才扣除积分 - 按秒计费
        // 从任务信息中获取视频时长和服务模式
        const videoDuration = taskInfo.metadata?.videoDuration 
          || taskInfo.extraData?.videoDuration 
          || taskInfo.videoDuration 
          || 1; // 默认1秒
      } else if (featureName === 'VIDEO_FACE_FUSION') {
        // 🔧 视频换脸功能在任务完成时才扣除积分 - 按秒计费
        // 从任务信息中获取视频时长
        const videoDuration = taskInfo.metadata?.videoDuration 
          || taskInfo.extraData?.videoDuration 
          || taskInfo.videoDuration 
          || 1; // 默认1秒
        const ratePerSecond = 1; // 1积分/秒
        actualCreditCost = Math.ceil(videoDuration) * ratePerSecond;
        console.log(`[任务完成] 视频换脸功能在任务完成时扣费: 任务ID=${taskInfo.taskId}, 时长=${videoDuration}秒, 积分=${actualCreditCost}`);
      } else if (featureName === 'IMAGE_EDIT') {
        // 🔧 图像编辑功能按生成图片数量计费，在创建时已扣费，任务完成时不再扣费
        actualCreditCost = 0;
        console.log(`[任务完成] ${featureName}功能按图片数量在创建时已扣费，跳过重复扣费: 任务ID=${taskInfo.taskId}`);
      } else if (featureName === 'QWEN_IMAGE_EDIT') {
        // 🔧 通义千问图像编辑功能：任务完成时扣费
        if (isFreeUsage) {
          actualCreditCost = 0;
          console.log(`[任务完成] ${featureName}功能免费使用，不扣费: 任务ID=${taskInfo.taskId}`);
        } else {
          // 按生成的图片数量计费
          const outputCount = Math.max(1, (taskInfo.extraData?.outputCount || taskInfo.extraData?.resultImages?.length || 1));
          actualCreditCost = outputCount * 7; // 每张图片7积分
          console.log(`[任务完成] ${featureName}功能按图片数量扣费: 任务ID=${taskInfo.taskId}, 图片数量=${outputCount}, 积分=${actualCreditCost}`);
        }
      } else if (featureName === 'IMAGE_COLORIZATION' || featureName === 'IMAGE_SHARPENING' || featureName === 'GLOBAL_STYLE' || featureName === 'DIANTU') {
        // 🔧 修复其他功能重复扣费问题：这些功能在创建时已经扣费，任务完成时不再扣费
        actualCreditCost = 0;
        console.log(`[任务完成] ${featureName}功能在创建时已扣费，跳过重复扣费: 任务ID=${taskInfo.taskId}`);
      } else {
        // 其他功能：使用原有逻辑
        actualCreditCost = taskInfo.creditCost || creditCost;
      }
    }
    
    console.log(`积分扣除计算: 使用次数=${usage.usageCount}, 免费次数=${featureConfig.freeUsage}, 是否免费=${isFreeUsage}, 实际扣除=${actualCreditCost}`);
    
// 🔧 强化防护：对于在创建时已扣费的功能，强制跳过任务完成时的扣费
// 注意：LOCAL_REDRAW和VIDEO_STYLE_REPAINT已改为任务完成时扣费，不再包含在此列表中
const preChargedFeatures = ['IMAGE_EDIT', 'IMAGE_COLORIZATION', 'IMAGE_SHARPENING', 'GLOBAL_STYLE', 'DIANTU'];
if (preChargedFeatures.includes(featureName)) {
  console.log(`[强化防护] ${featureName}功能在创建时已扣费，任务完成时强制跳过扣费: 任务ID=${taskInfo.taskId}`);
  return true; // 直接返回，不执行任何扣费逻辑
}

// 🔧 修复：对于局部重绘功能，确保任务完成时正确扣费
if (featureName === 'LOCAL_REDRAW') {
  console.log(`[任务完成] 局部重绘功能确认扣费状态: 任务ID=${taskInfo.taskId}, 是否免费=${isFreeUsage}, 积分=${actualCreditCost}`);
  
  // 修复局部重绘功能在保存任务详情时的免费状态不一致问题
  // 确保任务完成时的免费状态与扣费逻辑一致
  if (!isFreeUsage) {
    // 如果不是免费使用，确保任务信息中的isFree也是false
    taskInfo.isFree = false;
    console.log(`[任务完成] 局部重绘功能修正免费状态: 任务ID=${taskInfo.taskId}, 是否免费=false`);
  }
}
    
    // 如果不需要扣除积分，直接返回
    if (actualCreditCost <= 0) {
      console.log(`任务免费，无需扣除积分: 任务ID=${taskInfo.taskId}`);
      
      // 即使免费，也要保存使用记录的更新
      if (featureName === 'MULTI_IMAGE_TO_VIDEO') {
        await usage.save();
      }
      
      return true; // 返回成功标记
    }
    
    // 扣除用户积分
    const user = await User.findByPk(userId);
    if (!user) {
      console.error(`用户不存在: ${userId}`);
      return;
    }
    
    // 检查用户积分是否足够
    if (user.credits < actualCreditCost) {
      console.error(`用户积分不足: 当前=${user.credits}, 需要=${actualCreditCost}`);
      return;
    }
    
    // 扣除积分
    user.credits -= actualCreditCost;
    await user.save();
    
    // 更新使用记录的积分字段
    usage.credits = (usage.credits || 0) + actualCreditCost;
    // 注意：不在这里保存usage，因为saveTaskDetails函数会统一保存
    
    console.log(`已扣除积分: 用户=${userId}, 扣除=${actualCreditCost}, 剩余=${user.credits}, 功能总积分=${usage.credits}, 任务ID=${taskInfo.taskId}`);
    
    // 记录积分扣除事件到日志
    console.log(`[积分扣除事件] 用户=${userId}, 功能=${featureName}, 积分=${actualCreditCost}, 任务ID=${taskInfo.taskId}, 时间=${new Date().toISOString()}`);
    
    // 创建积分历史记录
    try {
      const { CreditHistory } = require('../models/CreditHistory');
      await CreditHistory.create({
        userId: userId,
        type: featureName,
        amount: -actualCreditCost, // 负数表示扣除积分
        description: `${featureName === 'DIGITAL_HUMAN_VIDEO' ? '视频数字人生成' : featureName}，积分消费`,
        createdAt: new Date(),
        updatedAt: new Date(),
        taskId: taskInfo.taskId,
        featureName: featureName
      });
      console.log(`✅ 已创建积分历史记录: 用户ID=${userId}, 积分=${actualCreditCost}, 任务ID=${taskInfo.taskId}`);
    } catch (creditHistoryError) {
      console.error('❌ 创建积分历史记录失败:', creditHistoryError);
      // 不影响主流程，继续执行
    }
    
    // 注意：任务详情的更新由saveTaskDetails函数统一处理，这里不重复更新
    
    return true; // 返回成功标记
    
  } catch (error) {
    console.error('处理任务完成扣费失败:', error);
    return false; // 返回失败标记
  }
}

/**
 * 创建数字人视频功能中间件 - 预扣积分，任务完成后调整
 * @param {Function} getDynamicCredits - 动态获取积分消耗的函数
 * @returns {Function} Express中间件函数
 */
const createDigitalHumanMiddleware = (getDynamicCredits) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const featureName = 'DIGITAL_HUMAN_VIDEO';
      
      // 获取功能配置
      const featureConfig = FEATURES[featureName];
      if (!featureConfig) {
        return res.status(500).json({
          success: false,
          message: '功能配置未找到'
        });
      }
      
      // 检查用户是否存在
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }
      
      // 获取或创建功能使用记录
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      let usage = await FeatureUsage.findOne({
        where: { userId, featureName }
      });
      
      if (!usage) {
        usage = await FeatureUsage.create({
          userId,
          featureName,
          usageCount: 0,
          credits: 0,
          lastUsedAt: today,
          resetDate: todayStr,
          details: JSON.stringify({ tasks: [] })
        });
      }
      
      // 不再每日重置 usageCount，确保每个用户终身仅有一次免费机会
      // 如果仍需要记录最新访问日期，可在此更新 lastUsedAt
      usage.lastUsedAt = new Date();
      await usage.save();
      
      // 检查是否还有免费次数
      const isFreeUsage = false; // 🔧 修改：视频数字人功能无免费次数，所有使用都收费
      
      // 对于数字人视频功能，积分检查和扣除将在上传后进行
      // 这里只记录使用信息，不预先扣除积分或更新使用次数
      
      // 将使用信息添加到请求对象
      req.featureUsage = {
        usage,
        featureConfig,
        usageType: isFreeUsage ? 'free' : 'paid',
        getDynamicCredits, // 传递动态积分计算函数
        isFreeUsage: isFreeUsage, // 旧字段，向后兼容
        isFree: isFreeUsage // 新增字段，供路由逻辑判断
      };
      
      console.log(`数字人视频功能中间件: 用户${userId}, 今日使用${usage.usageCount}/${featureConfig.freeUsage}, 类型: ${req.featureUsage.usageType}`);
      
      next();
    } catch (error) {
      console.error('数字人视频功能中间件错误:', error);
      return res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  };
};

module.exports = {
  createUnifiedFeatureMiddleware,
  createDigitalHumanMiddleware,
  saveTaskDetails
}; 