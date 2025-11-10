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
      const userId = req.user.id;
      
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
          resetDate: today
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
        
        // 只有在未扣除过积分的情况下才扣除
        if (!alreadyCharged) {
          // 扣除积分
          user.credits -= creditCost;
          await user.save();
          
          usageType = 'paid';
          finalCreditCost = creditCost;
          
          console.log(`用户ID ${userId} 使用 ${featureName} 功能，扣除 ${creditCost} 积分，剩余 ${user.credits} 积分`);
        } else {
          usageType = 'paid';
          finalCreditCost = creditCost; // 记录积分消耗，但不重复扣除
          console.log(`用户ID ${userId} 使用 ${featureName} 功能，任务ID=${taskId}已扣除过积分，跳过重复扣除`);
        }
      } else {
        console.log(`用户ID ${userId} 使用 ${featureName} 功能的免费次数 ${usage.usageCount + 1}/${featureConfig.freeUsage}`);
      }
      
      // 更新使用次数 - 只有在未记录过此任务的情况下才增加使用次数
      if (!alreadyCharged) {
        usage.usageCount += 1;
        usage.lastUsedAt = new Date();
        await usage.save();
      }
      
      // 将使用信息添加到请求对象
      req.featureUsage = {
        featureName,
        usageType,
        creditCost: finalCreditCost,
        isFree: usageType === 'free',
        remainingFreeUsage: Math.max(0, featureConfig.freeUsage - usage.usageCount),
        usage: usage, // 传递usage对象，方便后续保存任务详情
        taskId: taskId // 传递任务ID，用于后续处理
      };
      
      console.log(`功能 ${featureName} 使用记录已处理:`, {
        usageType,
        creditCost: finalCreditCost,
        isFree: usageType === 'free',
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
 * 保存任务详情到数据库
 * @param {object} usage - FeatureUsage实例
 * @param {object} taskInfo - 任务信息
 * @param {string} taskInfo.taskId - 任务ID
 * @param {number} taskInfo.creditCost - 积分消耗
 * @param {boolean} taskInfo.isFree - 是否免费
 * @param {object} taskInfo.extraData - 额外数据
 */
const saveTaskDetails = async (usage, taskInfo) => {
  try {
    // 解析现有详情
    const details = JSON.parse(usage.details || '{}');
    const tasks = details.tasks || [];
    
    // 检查任务ID是否已存在
    const existingTaskIndex = tasks.findIndex(task => task.taskId === taskInfo.taskId);
    
    if (existingTaskIndex !== -1) {
      // 任务已存在，更新任务信息而不是添加新任务
      console.log(`任务ID ${taskInfo.taskId} 已存在，更新任务信息`);
      
      // 保留原有信息，只更新需要更新的字段
      const existingTask = tasks[existingTaskIndex];
      
      // 🔧 修复：判断是否需要扣除积分
      // 当任务从pending状态变为completed状态，且是图生视频或文生视频功能时，需要扣除积分
      const needsCharging = 
        taskInfo.status === 'completed' && 
        existingTask.status !== 'completed' && 
        (taskInfo.featureName === 'text-to-video' || taskInfo.featureName === 'image-to-video');
      
      console.log(`🔍 任务状态检查: 当前状态=${existingTask.status}, 新状态=${taskInfo.status}, 需要扣费=${needsCharging}`);
      
      tasks[existingTaskIndex] = {
        ...existingTask,
        ...taskInfo.extraData,
        // 如果是任务完成状态，更新状态
        ...(taskInfo.status === 'completed' ? { status: 'SUCCEEDED', completedAt: new Date() } : {}),
        // 添加操作描述
        ...(taskInfo.operationText ? { operationText: taskInfo.operationText } : {}),
        // 保留原有的关键字段，确保积分信息不被覆盖
        taskId: existingTask.taskId,
        // 🔧 修复：如果需要扣费，使用新传入的积分信息；否则保留原有值
        creditCost: needsCharging ? taskInfo.creditCost : existingTask.creditCost,
        isFree: needsCharging ? taskInfo.isFree : existingTask.isFree,
        timestamp: existingTask.timestamp,
        updatedAt: new Date().toISOString()
      };
      
      // 更新usage记录
      // 确保details对象包含所有必要的字段，防止refunds未定义错误
      if (!details.recordedTaskIds) {
        details.recordedTaskIds = [];
      }
      if (!details.refunds) {
        details.refunds = [];
      }
      
      usage.details = JSON.stringify({
        ...details,
        tasks: tasks
      });
      
      await usage.save();
      console.log(`任务信息已更新: 任务ID=${taskInfo.taskId}`);
      
      // 🔧 修复：如果不需要扣费，直接返回；否则继续执行积分扣除逻辑
      if (!needsCharging) {
        console.log(`✅ 任务更新完成，无需扣费，直接返回`);
        return;
      }
      
      console.log(`🚀 任务需要扣费，继续执行积分扣除逻辑...`);
      // 继续执行下面的积分扣除逻辑（不return）
    } else {
      // 添加新任务
      const newTask = {
        taskId: taskInfo.taskId,
        // 🔧 修复积分显示：只有明确提供creditCost时才设置，避免覆盖为undefined
        ...(taskInfo.creditCost !== undefined ? { creditCost: taskInfo.creditCost } : {}),
        isFree: taskInfo.isFree,
        timestamp: new Date(),
        createdAt: new Date().toISOString(), // 添加创建时间戳，便于调试
        status: taskInfo.status === 'completed' ? 'SUCCEEDED' : (taskInfo.status || 'PENDING'), // 设置正确的状态
        ...(taskInfo.status === 'completed' ? { completedAt: new Date() } : {}),
        ...(taskInfo.operationText ? { operationText: taskInfo.operationText } : {}), // 添加操作描述
        ...taskInfo.extraData
      };
      
      tasks.push(newTask);
      
      // 更新usage记录 - 只有在任务未完成时才预先记录积分
      // 如果任务已完成，积分扣除将在后续的任务完成处理逻辑中进行
      if (!taskInfo.isFree && taskInfo.status !== 'completed') {
        // 检查是否已经为此任务记录过积分
        const hasRecordedCredits = details.recordedTaskIds && 
                                  details.recordedTaskIds.includes(taskInfo.taskId);
        
        if (!hasRecordedCredits) {
          // 只有在没有记录过的情况下才累加积分
          usage.credits = (usage.credits || 0) + taskInfo.creditCost;
          
          // 记录已处理的任务ID，防止重复计算
          if (!details.recordedTaskIds) {
            details.recordedTaskIds = [];
          }
          details.recordedTaskIds.push(taskInfo.taskId);
          
          console.log(`为任务ID=${taskInfo.taskId}累加积分${taskInfo.creditCost}，当前总积分=${usage.credits}`);
        } else {
          console.log(`任务ID=${taskInfo.taskId}已记录过积分，跳过积分累加`);
        }
      } else if (taskInfo.status === 'completed') {
        console.log(`任务ID=${taskInfo.taskId}已完成，积分将在任务完成处理逻辑中扣除`);
      }
      
      usage.details = JSON.stringify({
        ...details,
        tasks: tasks
      });
      
      await usage.save();
      console.log(`新任务详情已保存: 任务ID=${taskInfo.taskId}, 积分=${taskInfo.creditCost}, 是否免费=${taskInfo.isFree}`);
    }

    // 标记任务完成并更新使用记录
    if (taskInfo.status === 'completed') {
      // 如果是数字人视频功能，根据真实时长校正积分
      if (usage.featureName === 'DIGITAL_HUMAN_VIDEO' && taskInfo.extraData && taskInfo.extraData.videoDuration) {
        const realCost = taskInfo.isFree ? 0 : Math.ceil(taskInfo.extraData.videoDuration) * 9;
        if (realCost !== taskInfo.creditCost) {
          const delta = realCost - taskInfo.creditCost; // >0 需补扣；<0 需退款
          const user = await User.findByPk(usage.userId);
          if (delta > 0) {
            // 补扣时如果余额不足，扣至 0
            const deduct = Math.min(delta, user.credits);
            user.credits -= deduct;
            await user.save();
            taskInfo.creditCost += deduct;
            if (Array.isArray(tasks) && tasks.length > 0) {
              tasks[tasks.length - 1].creditCost = taskInfo.creditCost;
            }
            usage.credits = (usage.credits || 0) + deduct;
            usage.details = JSON.stringify({ ...details, tasks });
            await usage.save();
            console.log(`[校正] 已补扣用户 ${usage.userId} 积分 ${deduct}`);
          } else if (delta < 0) {
            const refund = -delta;
            user.credits += refund;
            await user.save();
            taskInfo.creditCost -= refund;
            if (Array.isArray(tasks) && tasks.length > 0) {
              tasks[tasks.length - 1].creditCost = taskInfo.creditCost;
            }
            usage.credits = (usage.credits || 0) - refund;
            usage.details = JSON.stringify({ ...details, tasks });
            await usage.save();
            console.log(`[校正] 已向用户 ${usage.userId} 退款积分 ${refund}`);
          }
        } else {
          // 即使积分没有变化，也要确保用户表被更新
          // 这是为了解决数字人视频功能积分不显示在积分管理页面的问题
          if (!taskInfo.isFree && taskInfo.creditCost > 0) {
            const user = await User.findByPk(usage.userId);
            if (user) {
              // 检查是否已经扣除过积分
              const existingTask = tasks.find(t => t.taskId === taskInfo.taskId);
              const alreadyCharged = existingTask && existingTask.hasChargedToUser;
              
              if (!alreadyCharged) {
                // 不在这里扣除积分，因为handleTaskCompletion函数已经处理了积分扣除
                // user.credits -= taskInfo.creditCost;
                // await user.save();
                
                // 更新任务记录，标记为已扣除
                if (Array.isArray(tasks) && tasks.length > 0) {
                  const taskIndex = tasks.findIndex(t => t.taskId === taskInfo.taskId);
                  if (taskIndex !== -1) {
                    tasks[taskIndex].hasChargedToUser = true;
                    usage.details = JSON.stringify({ ...details, tasks });
                    await usage.save();
                  }
                }
                
                // 不在这里扣除积分，因为handleTaskCompletion函数已经处理了积分扣除
                console.log(`[数字人视频] 积分已由handleTaskCompletion函数处理，跳过重复扣除: 用户ID=${usage.userId}, 积分=${taskInfo.creditCost}`);
              } else {
                // 即使已经标记为扣除过积分，也要确保用户表中的积分确实已被扣除
                console.log(`[数字人视频] 确认用户积分状态: 用户ID=${usage.userId}, 积分=${taskInfo.creditCost}, 当前余额=${user.credits}`);
                
                // 在这里添加一个额外检查，确保用户表中的积分已被正确扣除
                // 这是为了处理某些情况下标记为已扣除但实际未扣除的情况
                const taskDetails = await FeatureUsage.findOne({
                  where: { userId: usage.userId, featureName: 'DIGITAL_HUMAN_VIDEO' }
                });
                
                if (taskDetails && taskDetails.credits > 0) {
                  // 如果FeatureUsage表中有记录积分扣除，但用户积分未减少，则补扣
                  // 这里我们检查用户当前积分是否足够，如果不够就只扣除剩余的
                  // 不在这里补充扣除积分，因为handleTaskCompletion函数已经处理了积分扣除
                  const deductCredits = Math.min(taskInfo.creditCost, user.credits);
                  if (deductCredits > 0) {
                    // user.credits -= deductCredits;
                    // await user.save();
                    console.log(`[数字人视频] 跳过补充扣除积分: 用户ID=${usage.userId}, 积分=${deductCredits}, 当前余额=${user.credits}`);
                  }
                }
              }
            }
          }
        }
      }
      
      // 处理文生视频、图生视频和多图转视频功能的积分扣除
      if (taskInfo.status === 'completed' && (taskInfo.featureName === 'text-to-video' || taskInfo.featureName === 'image-to-video')) {
        // 文生视频和图生视频功能固定扣除66积分
        const fixedCost = 66;
        
        // 检查是否为免费使用
        if (taskInfo.isFree) {
          console.log(`[任务完成] 用户 ${usage.userId} 使用免费次数完成 ${taskInfo.featureName} 任务`);
          
          // 更新任务记录，确保标记为免费使用
          if (Array.isArray(tasks) && tasks.length > 0) {
            const taskIndex = tasks.findIndex(t => t.taskId === taskInfo.taskId);
            if (taskIndex !== -1) {
              tasks[taskIndex].isFree = true;
              tasks[taskIndex].creditCost = 0;
              
              // 确保details对象包含所有必要的字段，防止refunds未定义错误
              if (!details.recordedTaskIds) {
                details.recordedTaskIds = [];
              }
              if (!details.refunds) {
                details.refunds = [];
              }
              
              usage.details = JSON.stringify({ ...details, tasks });
              await usage.save();
              console.log(`[任务完成] 已更新任务记录，标记为免费使用: taskId=${taskInfo.taskId}`);
            }
          }
          
          // 更新使用次数，确保计入免费使用次数
          // 🔧 修复：使用次数应该反映实际完成的任务数量，而不是固定为1
          const completedTasksCount = Array.isArray(tasks) ? tasks.filter(t => (t.status === 'SUCCEEDED' || t.status === 'completed')).length : 1;
          if (usage.usageCount < completedTasksCount) {
            usage.usageCount = completedTasksCount;
            await usage.save();
            console.log(`[任务完成] 免费使用，已更新使用次数: ${usage.usageCount}`);
          }
        } else {
          // 查找用户
          const user = await User.findByPk(usage.userId);
          if (user) {
            // 检查用户积分是否足够支付标准积分消费
            if (user.credits < fixedCost) {
              console.warn(`[警告] 用户 ${usage.userId} 积分不足，无法完全支付 ${taskInfo.featureName} 功能。需要: ${fixedCost}积分，当前: ${user.credits}积分`);
              
              // 计算实际可扣除的积分（受用户剩余积分限制）
              const deduct = Math.min(fixedCost, user.credits);
              
              // 扣除积分
              user.credits -= deduct;
              await user.save();
              
              // 更新使用记录中的积分消耗 - 使用固定积分值而不是实际扣除的积分
              // 这样在统计时能正确反映功能的标准积分消费
              usage.credits = (usage.credits || 0) + fixedCost;
              
              // 更新任务记录，记录标准积分消费和实际扣除的积分
              if (Array.isArray(tasks) && tasks.length > 0) {
                const taskIndex = tasks.findIndex(t => t.taskId === taskInfo.taskId);
                if (taskIndex !== -1) {
                  tasks[taskIndex].standardCreditCost = fixedCost; // 记录标准积分消费
                  tasks[taskIndex].creditCost = deduct; // 记录实际扣除的积分
                  tasks[taskIndex].isFree = false;
                  tasks[taskIndex].insufficientCredits = true; // 标记积分不足
                  
                  // 确保details对象包含所有必要的字段，防止refunds未定义错误
                  if (!details.recordedTaskIds) {
                    details.recordedTaskIds = [];
                  }
                  if (!details.refunds) {
                    details.refunds = [];
                  }
                  
                  usage.details = JSON.stringify({ ...details, tasks });
                }
              }
              
              await usage.save();
              
              console.log(`[任务完成] 已扣除用户 ${usage.userId} 积分 ${deduct} (功能: ${taskInfo.featureName}, 标准积分消费: ${fixedCost}, 积分不足)`);
            } else {
              // 积分足够，正常扣除
              // 扣除积分
              user.credits -= fixedCost;
              await user.save();
              
              // 更新使用记录中的积分消耗
              usage.credits = (usage.credits || 0) + fixedCost;
              
              // 更新任务记录，记录标准积分消费
              if (Array.isArray(tasks) && tasks.length > 0) {
                const taskIndex = tasks.findIndex(t => t.taskId === taskInfo.taskId);
                if (taskIndex !== -1) {
                  tasks[taskIndex].standardCreditCost = fixedCost; // 记录标准积分消费
                  tasks[taskIndex].creditCost = fixedCost; // 实际扣除的积分与标准一致
                  tasks[taskIndex].isFree = false;
                  
                  // 确保details对象包含所有必要的字段，防止refunds未定义错误
                  if (!details.recordedTaskIds) {
                    details.recordedTaskIds = [];
                  }
                  if (!details.refunds) {
                    details.refunds = [];
                  }
                  
                  usage.details = JSON.stringify({ ...details, tasks });
                }
              }
              
              await usage.save();
              
              console.log(`[任务完成] 已扣除用户 ${usage.userId} 积分 ${fixedCost} (功能: ${taskInfo.featureName})`);
            }
            
            // 🔧 修复：更新使用次数，确保付费使用也被正确计入
            // 使用次数应该反映实际完成的任务数量
            const completedTasksCount = Array.isArray(tasks) ? tasks.filter(t => (t.status === 'SUCCEEDED' || t.status === 'completed')).length : 1;
            if (usage.usageCount < completedTasksCount) {
              usage.usageCount = completedTasksCount;
              await usage.save();
              console.log(`[任务完成] 付费使用，已更新使用次数: ${usage.usageCount}`);
            }
          } else {
            console.error(`[任务完成] 未找到用户ID=${usage.userId}，无法扣除积分`);
          }
        }
      }
        else if (taskInfo.status === 'completed' && taskInfo.featureName === 'MULTI_IMAGE_TO_VIDEO') {
        // 多图转视频功能根据时长扣除积分：每30秒30积分，不足30秒按30秒计
        let durationSec = 0;
        
        // 尝试从多个位置获取时长信息
        if (taskInfo.metadata && taskInfo.metadata.duration) {
          durationSec = parseFloat(taskInfo.metadata.duration);
        } else if (taskInfo.duration) {
          durationSec = parseFloat(taskInfo.duration);
        } else if (taskInfo.extraData && taskInfo.extraData.duration) {
          durationSec = parseFloat(taskInfo.extraData.duration);
        } else {
          // 如果没有时长信息，使用默认值5秒
          durationSec = 5;
          console.log(`[任务完成] 多图转视频任务 ${taskInfo.taskId} 未找到时长信息，使用默认时长5秒`);
        }
        
        if (durationSec > 0) {
          // 确保即使短视频也至少收取30积分
          const calculatedCost = Math.max(30, Math.ceil(durationSec / 30) * 30);
          
          // 重新判断是否为免费使用：检查已完成的付费任务数量
          // 🔧 重要修复：统计所有已完成的任务数量，而不仅仅是付费任务
          let completedTasks = 0;
          if (Array.isArray(tasks)) {
            completedTasks = tasks.filter(t => 
              (t.status === 'SUCCEEDED' || t.status === 'completed') && 
              t.taskId !== taskInfo.taskId // 排除当前任务
            ).length;
          }
          
          // 如果没有已完成的任务，则当前任务免费（首次使用）
          const isActuallyFree = completedTasks === 0;
          
          console.log(`[任务完成] 多图转视频免费使用判断: 用户${usage.userId}, 已完成任务数: ${completedTasks}, 当前任务是否免费: ${isActuallyFree}`);
          
          // 检查是否为免费使用
          if (isActuallyFree) {
            console.log(`[任务完成] 用户 ${usage.userId} 使用免费次数完成多图转视频任务`);
            
            // 更新任务记录，确保标记为免费使用
            if (Array.isArray(tasks) && tasks.length > 0) {
              const taskIndex = tasks.findIndex(t => t.taskId === taskInfo.taskId);
              if (taskIndex !== -1) {
                tasks[taskIndex].isFree = true;
                tasks[taskIndex].creditCost = 0;
                usage.details = JSON.stringify({ ...details, tasks });
                await usage.save();
                console.log(`[任务完成] 已更新任务记录，标记为免费使用: taskId=${taskInfo.taskId}`);
              }
            }
            
            // 更新使用次数，确保计入免费使用次数
            // 对于免费使用，确保使用次数至少为1
            if (usage.usageCount === 0) {
              usage.usageCount = 1;
              await usage.save();
              console.log(`[任务完成] 免费使用，已更新使用次数: ${usage.usageCount}`);
            }
          } else {
            // 查找用户
            const user = await User.findByPk(usage.userId);
            if (user) {
              // 扣除积分
              const deduct = Math.min(calculatedCost, user.credits);
              user.credits -= deduct;
              await user.save();
              
              // 更新使用记录中的积分消耗
              usage.credits = (usage.credits || 0) + deduct;
              
              // 更新任务记录，确保积分消耗正确
              if (Array.isArray(tasks) && tasks.length > 0) {
                const taskIndex = tasks.findIndex(t => t.taskId === taskInfo.taskId);
                if (taskIndex !== -1) {
                  tasks[taskIndex].creditCost = deduct;
                  tasks[taskIndex].isFree = false;
                  usage.details = JSON.stringify({ ...details, tasks });
                }
              }
              
              await usage.save();
              
              // 更新使用次数，确保付费使用也被正确计入
              // 使用次数应该反映实际完成的任务数量
              const completedTasksCount = Array.isArray(tasks) ? tasks.filter(t => (t.status === 'SUCCEEDED' || t.status === 'completed')).length : 1;
              if (usage.usageCount < completedTasksCount) {
                usage.usageCount = completedTasksCount;
                await usage.save();
                console.log(`[任务完成] 付费使用，已更新使用次数: ${usage.usageCount}`);
              }
              
              console.log(`[任务完成] 已扣除用户 ${usage.userId} 积分 ${deduct} (功能: ${taskInfo.featureName}, 时长: ${durationSec}秒)`);
            } else {
              console.error(`[任务完成] 未找到用户ID=${usage.userId}，无法扣除积分`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('保存任务详情失败:', error);
    throw error;
  }
};

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
      const isFreeUsage = usage.usageCount < featureConfig.freeUsage;
      
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