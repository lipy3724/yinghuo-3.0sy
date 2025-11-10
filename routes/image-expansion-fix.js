/**
 * 智能扩图功能积分扣除和使用记录修复路由
 * 此路由提供API端点用于修复智能扩图功能的积分扣除和使用记录问题
 */

const express = require('express');
const router = express.Router();
const { protect, checkAdmin } = require('../middleware/auth');
const { FeatureUsage } = require('../models/FeatureUsage');
const User = require('../models/User');
const sequelize = require('../config/db');
const { saveTaskDetails } = require('../middleware/unifiedFeatureUsage');

/**
 * @route   GET /api/image-expansion-fix/status
 * @desc    获取智能扩图功能积分扣除问题的状态
 * @access  Admin
 */
router.get('/status', protect, checkAdmin, async (req, res) => {
  try {
    // 查找所有智能扩图功能使用记录
    const imageExpansionUsages = await FeatureUsage.findAll({
      where: {
        featureName: 'image-expansion'
      }
    });
    
    // 统计信息
    const stats = {
      totalUsers: imageExpansionUsages.length,
      usersWithCredits: 0,
      usersWithoutCredits: 0,
      totalCredits: 0,
      totalTasks: 0,
      completedTasks: 0,
      freeUsages: 0
    };
    
    // 用户详情
    const userDetails = [];
    
    // 遍历每条使用记录进行统计
    for (const usage of imageExpansionUsages) {
      let details;
      try {
        details = usage.details ? JSON.parse(usage.details) : { tasks: [] };
      } catch (parseError) {
        details = { tasks: [] };
      }
      
      const tasks = details.tasks || [];
      const completedTasks = tasks.filter(task => 
        (task.status === 'completed' || task.status === 'SUCCEEDED')
      );
      const freeTasks = tasks.filter(task => task.isFree);
      
      stats.totalTasks += tasks.length;
      stats.completedTasks += completedTasks.length;
      stats.freeUsages += freeTasks.length;
      
      if (usage.credits > 0) {
        stats.usersWithCredits++;
        stats.totalCredits += usage.credits;
      } else {
        stats.usersWithoutCredits++;
      }
      
      // 获取用户信息
      const user = await User.findByPk(usage.userId, {
        attributes: ['id', 'username', 'credits']
      });
      
      userDetails.push({
        userId: usage.userId,
        username: user ? user.username : 'Unknown',
        usageCount: usage.usageCount,
        credits: usage.credits,
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        freeTasks: freeTasks.length,
        needsFix: usage.credits === 0 && completedTasks.length > freeTasks.length
      });
    }
    
    res.json({
      success: true,
      stats,
      userDetails
    });
  } catch (error) {
    console.error('获取智能扩图功能积分扣除问题状态时出错:', error);
    res.status(500).json({
      success: false,
      message: '获取状态失败: ' + error.message
    });
  }
});

/**
 * @route   POST /api/image-expansion-fix/fix
 * @desc    修复智能扩图功能积分扣除问题
 * @access  Admin
 */
router.post('/fix', protect, checkAdmin, async (req, res) => {
  try {
    // 查找所有智能扩图功能使用记录
    const imageExpansionUsages = await FeatureUsage.findAll({
      where: {
        featureName: 'image-expansion'
      }
    });
    
    console.log(`找到 ${imageExpansionUsages.length} 条智能扩图功能使用记录`);
    
    const results = {
      total: imageExpansionUsages.length,
      fixed: 0,
      skipped: 0,
      failed: 0,
      details: []
    };
    
    // 遍历每条使用记录进行修复
    for (const usage of imageExpansionUsages) {
      try {
        const result = await fixSingleUsageRecord(usage);
        results.details.push(result);
        
        if (result.fixed) {
          results.fixed++;
        } else if (result.skipped) {
          results.skipped++;
        } else {
          results.failed++;
        }
      } catch (fixError) {
        console.error(`修复用户ID=${usage.userId}的智能扩图功能使用记录时出错:`, fixError);
        results.failed++;
        results.details.push({
          userId: usage.userId,
          fixed: false,
          skipped: false,
          error: fixError.message
        });
      }
    }
    
    res.json({
      success: true,
      message: `修复完成: 共修复 ${results.fixed} 条记录，跳过 ${results.skipped} 条记录，失败 ${results.failed} 条记录`,
      results
    });
  } catch (error) {
    console.error('修复智能扩图功能积分扣除问题时出错:', error);
    res.status(500).json({
      success: false,
      message: '修复失败: ' + error.message
    });
  }
});

/**
 * @route   POST /api/image-expansion-fix/fix/:userId
 * @desc    修复指定用户的智能扩图功能积分扣除问题
 * @access  Admin
 */
router.post('/fix/:userId', protect, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 查找指定用户的智能扩图功能使用记录
    const usage = await FeatureUsage.findOne({
      where: {
        userId,
        featureName: 'image-expansion'
      }
    });
    
    if (!usage) {
      return res.status(404).json({
        success: false,
        message: `用户ID=${userId}没有智能扩图功能使用记录`
      });
    }
    
    // 修复单条使用记录
    const result = await fixSingleUsageRecord(usage);
    
    res.json({
      success: true,
      message: result.fixed ? '修复成功' : (result.skipped ? '无需修复' : '修复失败'),
      result
    });
  } catch (error) {
    console.error('修复指定用户的智能扩图功能积分扣除问题时出错:', error);
    res.status(500).json({
      success: false,
      message: '修复失败: ' + error.message
    });
  }
});

// 修复单条使用记录
async function fixSingleUsageRecord(usage) {
  try {
    console.log(`正在修复用户ID=${usage.userId}的智能扩图功能使用记录...`);
    
    // 解析details字段
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
    
    // 检查是否已经有积分记录
    if (usage.credits > 0 && details.tasks.some(task => task.creditCost > 0)) {
      console.log(`用户ID=${usage.userId}的智能扩图功能已有积分记录，无需修复`);
      return {
        userId: usage.userId,
        fixed: false,
        skipped: true,
        message: '已有积分记录，无需修复'
      };
    }
    
    // 检查全局任务变量中是否有该用户的任务
    if (global.imageExpansionTasks) {
      const userTasks = Object.values(global.imageExpansionTasks)
        .filter(task => task.userId === usage.userId);
      
      console.log(`从全局变量中找到用户ID=${usage.userId}的智能扩图任务 ${userTasks.length} 个`);
      
      // 计算应扣除的总积分
      let totalCredits = 0;
      let fixedTasks = 0;
      
      // 遍历用户任务，更新details.tasks数组
      for (const task of userTasks) {
        // 检查任务是否已经在details.tasks中
        const existingTaskIndex = details.tasks.findIndex(t => t.taskId === task.taskId);
        
        if (existingTaskIndex >= 0) {
          // 更新现有任务
          console.log(`更新现有任务: ${task.taskId}`);
          details.tasks[existingTaskIndex].creditCost = task.isFree ? 0 : 7;
          details.tasks[existingTaskIndex].isFree = task.isFree || false;
          details.tasks[existingTaskIndex].status = task.status || 'completed';
          
          // 如果任务已完成且不是免费的，累加积分
          if ((task.status === 'SUCCEEDED' || task.status === 'completed') && !task.isFree) {
            totalCredits += 7; // 智能扩图功能固定消耗7积分
            fixedTasks++;
          }
        } else {
          // 添加新任务
          console.log(`添加新任务: ${task.taskId}`);
          details.tasks.push({
            taskId: task.taskId,
            timestamp: task.timestamp || new Date().toISOString(),
            creditCost: task.isFree ? 0 : 7,
            isFree: task.isFree || false,
            status: task.status || 'completed'
          });
          
          // 如果任务已完成且不是免费的，累加积分
          if ((task.status === 'SUCCEEDED' || task.status === 'completed') && !task.isFree) {
            totalCredits += 7; // 智能扩图功能固定消耗7积分
            fixedTasks++;
          }
        }
      }
      
      // 更新使用记录的积分字段
      if (totalCredits > 0) {
        usage.credits = totalCredits;
        await usage.save();
        console.log(`已更新用户ID=${usage.userId}的智能扩图功能积分消费: ${totalCredits}`);
      }
      
      // 更新details字段
      usage.details = JSON.stringify(details);
      await usage.save();
      console.log(`已更新用户ID=${usage.userId}的智能扩图功能使用详情`);
      
      return {
        userId: usage.userId,
        fixed: totalCredits > 0,
        skipped: totalCredits === 0,
        totalCredits,
        fixedTasks,
        totalTasks: userTasks.length
      };
    } else {
      console.log(`全局变量中没有智能扩图任务信息，尝试从数据库中恢复...`);
      
      // 从数据库中查找该用户的任务记录
      const transaction = await sequelize.transaction();
      try {
        // 查询是否有任务记录但未记录积分的情况
        const taskRecords = await sequelize.query(
          `SELECT * FROM task_records WHERE user_id = ? AND feature_name = 'image-expansion' AND status = 'completed'`,
          {
            replacements: [usage.userId],
            type: sequelize.QueryTypes.SELECT,
            transaction
          }
        );
        
        if (taskRecords && taskRecords.length > 0) {
          console.log(`从数据库中找到用户ID=${usage.userId}的智能扩图任务记录 ${taskRecords.length} 个`);
          
          // 计算应扣除的总积分
          let totalCredits = 0;
          let fixedTasks = 0;
          
          // 遍历任务记录，更新details.tasks数组
          for (const record of taskRecords) {
            // 检查任务是否已经在details.tasks中
            const existingTaskIndex = details.tasks.findIndex(t => t.taskId === record.task_id);
            
            if (existingTaskIndex >= 0) {
              // 更新现有任务
              details.tasks[existingTaskIndex].creditCost = record.is_free ? 0 : 7;
              details.tasks[existingTaskIndex].isFree = record.is_free || false;
              details.tasks[existingTaskIndex].status = 'completed';
              
              // 如果不是免费的，累加积分
              if (!record.is_free) {
                totalCredits += 7; // 智能扩图功能固定消耗7积分
                fixedTasks++;
              }
            } else {
              // 添加新任务
              details.tasks.push({
                taskId: record.task_id,
                timestamp: record.created_at || new Date().toISOString(),
                creditCost: record.is_free ? 0 : 7,
                isFree: record.is_free || false,
                status: 'completed'
              });
              
              // 如果不是免费的，累加积分
              if (!record.is_free) {
                totalCredits += 7; // 智能扩图功能固定消耗7积分
                fixedTasks++;
              }
            }
          }
          
          // 更新使用记录的积分字段
          if (totalCredits > 0) {
            usage.credits = totalCredits;
            await usage.save({ transaction });
            console.log(`已更新用户ID=${usage.userId}的智能扩图功能积分消费: ${totalCredits}`);
          }
          
          // 更新details字段
          usage.details = JSON.stringify(details);
          await usage.save({ transaction });
          console.log(`已更新用户ID=${usage.userId}的智能扩图功能使用详情`);
          
          await transaction.commit();
          
          return {
            userId: usage.userId,
            fixed: totalCredits > 0,
            skipped: totalCredits === 0,
            totalCredits,
            fixedTasks,
            totalTasks: taskRecords.length
          };
        } else {
          console.log(`数据库中没有找到用户ID=${usage.userId}的智能扩图任务记录`);
          await transaction.commit();
          
          return {
            userId: usage.userId,
            fixed: false,
            skipped: true,
            message: '数据库中没有找到任务记录'
          };
        }
      } catch (dbError) {
        await transaction.rollback();
        console.error('从数据库恢复任务记录失败:', dbError);
        throw dbError;
      }
    }
  } catch (error) {
    console.error(`修复用户ID=${usage.userId}的智能扩图功能使用记录时出错:`, error);
    throw error;
  }
}

module.exports = router;
