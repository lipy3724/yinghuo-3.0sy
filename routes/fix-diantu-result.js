/**
 * 垫图任务结果URL修复工具
 * 
 * 问题：垫图功能生成的结果图在任务完成后，resultUrl没有被正确保存到FeatureUsage表中，
 * 导致历史记录中显示undefined或空白。
 * 
 * 此脚本提供一个API接口，用于修复历史垫图任务的resultUrl。
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { FeatureUsage } = require('../models/FeatureUsage');
const { saveDiantuResultToOSS } = require('../utils/diantuOssStorage');

/**
 * @route   POST /api/fix-diantu-result
 * @desc    修复垫图任务结果URL
 * @access  Private
 */
router.post('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, resultUrl } = req.body;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：taskId'
      });
    }
    
    console.log(`开始修复垫图任务结果: userId=${userId}, taskId=${taskId}`);
    
    // 查找用户的垫图功能使用记录
    const usage = await FeatureUsage.findOne({
      where: {
        userId: userId,
        featureName: 'DIANTU'
      }
    });
    
    if (!usage) {
      return res.status(404).json({
        success: false,
        message: '未找到用户的垫图功能使用记录'
      });
    }
    
    // 解析details字段
    const details = JSON.parse(usage.details || '{}');
    const tasks = details.tasks || [];
    
    // 找到对应的任务
    const taskIndex = tasks.findIndex(t => t.taskId === taskId);
    
    if (taskIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '未找到对应的垫图任务记录'
      });
    }
    
    // 获取任务信息
    const task = tasks[taskIndex];
    console.log(`找到任务: ${JSON.stringify({
      taskId: task.taskId,
      status: task.status,
      hasResultUrl: !!task.resultUrl,
      hasImageUrl: !!task.imageUrl
    })}`);
    
    // 如果提供了resultUrl，直接使用；否则尝试从原始图片URL上传到OSS
    let newResultUrl = resultUrl;
    
    if (!newResultUrl) {
      // 使用原始图片URL（如果有）
      const originalUrl = task.imageUrl || task.originalUrl;
      
      if (!originalUrl) {
        return res.status(400).json({
          success: false,
          message: '任务没有原始图片URL，无法修复'
        });
      }
      
      try {
        // 将原始图片上传到OSS
        console.log(`尝试将原始图片上传到OSS: ${originalUrl}`);
        newResultUrl = await saveDiantuResultToOSS(originalUrl, userId, taskId);
        console.log(`上传成功: ${newResultUrl}`);
      } catch (ossError) {
        console.error('上传到OSS失败:', ossError);
        return res.status(500).json({
          success: false,
          message: '上传到OSS失败: ' + ossError.message
        });
      }
    }
    
    // 更新任务记录
    tasks[taskIndex].resultUrl = newResultUrl;
    
    // 如果任务状态为PENDING，更新为SUCCEEDED
    if (tasks[taskIndex].status === 'PENDING') {
      tasks[taskIndex].status = 'SUCCEEDED';
      tasks[taskIndex].completedAt = new Date().toISOString();
    }
    
    // 更新数据库
    usage.details = JSON.stringify({
      ...details,
      tasks: tasks
    });
    
    await usage.save();
    
    console.log(`垫图任务结果已修复: taskId=${taskId}, resultUrl=${newResultUrl}`);
    
    return res.json({
      success: true,
      message: '垫图任务结果已修复',
      task: {
        taskId,
        resultUrl: newResultUrl,
        status: tasks[taskIndex].status
      }
    });
  } catch (error) {
    console.error('修复垫图任务结果失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误: ' + error.message
    });
  }
});

/**
 * @route   POST /api/fix-diantu-result/batch
 * @desc    批量修复垫图任务结果URL
 * @access  Private
 */
router.post('/batch', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`开始批量修复用户垫图任务结果: userId=${userId}`);
    
    // 查找用户的垫图功能使用记录
    const usage = await FeatureUsage.findOne({
      where: {
        userId: userId,
        featureName: 'DIANTU'
      }
    });
    
    if (!usage) {
      return res.status(404).json({
        success: false,
        message: '未找到用户的垫图功能使用记录'
      });
    }
    
    // 解析details字段
    const details = JSON.parse(usage.details || '{}');
    const tasks = details.tasks || [];
    
    console.log(`找到 ${tasks.length} 个垫图任务`);
    
    // 统计信息
    const stats = {
      total: tasks.length,
      fixed: 0,
      failed: 0,
      skipped: 0
    };
    
    // 遍历所有任务
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      // 只处理没有resultUrl的已完成任务
      if (task.status === 'SUCCEEDED' && (!task.resultUrl || task.resultUrl === 'undefined')) {
        console.log(`处理任务 ${i+1}/${tasks.length}: ${task.taskId}`);
        
        // 获取原始图片URL
        const originalUrl = task.imageUrl || task.originalUrl;
        
        if (!originalUrl) {
          console.log(`任务 ${task.taskId} 没有原始图片URL，跳过`);
          stats.skipped++;
          continue;
        }
        
        try {
          // 将原始图片上传到OSS
          console.log(`尝试将原始图片上传到OSS: ${originalUrl}`);
          const newResultUrl = await saveDiantuResultToOSS(originalUrl, userId, task.taskId);
          
          // 更新任务记录
          tasks[i].resultUrl = newResultUrl;
          tasks[i].completedAt = tasks[i].completedAt || new Date().toISOString();
          
          console.log(`修复成功: ${task.taskId} -> ${newResultUrl}`);
          stats.fixed++;
        } catch (ossError) {
          console.error(`修复任务 ${task.taskId} 失败:`, ossError);
          stats.failed++;
        }
      } else {
        stats.skipped++;
      }
    }
    
    // 更新数据库
    usage.details = JSON.stringify({
      ...details,
      tasks: tasks
    });
    
    await usage.save();
    
    console.log(`批量修复完成: 总共=${stats.total}, 修复=${stats.fixed}, 失败=${stats.failed}, 跳过=${stats.skipped}`);
    
    return res.json({
      success: true,
      message: '批量修复完成',
      stats
    });
  } catch (error) {
    console.error('批量修复垫图任务结果失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误: ' + error.message
    });
  }
});

module.exports = router;