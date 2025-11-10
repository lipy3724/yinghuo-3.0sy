/**
 * 垫图功能API路由
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { FeatureUsage } = require('../models/FeatureUsage');
const { saveDiantuResultToOSS } = require('../utils/diantuOssStorage');

/**
 * @route   GET /api/diantu/tasks
 * @desc    获取用户的垫图任务列表
 * @access  Private
 */
router.get('/tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`获取垫图任务列表: userId=${userId}`);
    
    // 查找用户的垫图功能使用记录
    const tasks = await FeatureUsage.findAll({
      where: {
        userId: userId,
        featureName: 'DIANTU'
      },
      order: [['createdAt', 'DESC']],
      limit: 10 // 增加返回数量，确保能获取到足够的历史记录
    });
    
    console.log(`查询到垫图功能使用记录数量: ${tasks.length}`);
    
    // 格式化任务数据
    const formattedTasks = [];
    
    tasks.forEach(task => {
      try {
        // 解析details字段中的任务列表
        const details = JSON.parse(task.details || '{}');
        const taskList = details.tasks || [];
        
        // 遍历每个任务
        taskList.forEach(taskItem => {
          // 构建格式化的任务对象
          const formattedTask = {
            taskId: taskItem.taskId,
            status: taskItem.status || 'PENDING',
            prompt: taskItem.prompt || '',
            originalUrl: taskItem.imageUrl || taskItem.originalUrl || '',
            resultUrl: taskItem.resultUrl || '',
            createdAt: taskItem.createdAt || taskItem.timestamp || task.createdAt,
            errorMessage: taskItem.errorMessage || ''
          };
          
          // 确保resultUrl存在，如果不存在则使用originalUrl
          if (!formattedTask.resultUrl || formattedTask.resultUrl.trim() === '') {
            console.log(`任务 ${formattedTask.taskId} 缺少resultUrl，使用原始图片URL`);
            formattedTask.resultUrl = formattedTask.originalUrl;
          }
          
          formattedTasks.push(formattedTask);
        });
      } catch (parseError) {
        console.error('解析垫图任务详情失败:', parseError);
      }
    });
    
    console.log(`找到 ${formattedTasks.length} 个垫图任务`);
    
    return res.json({
      success: true,
      tasks: formattedTasks
    });
  } catch (error) {
    console.error('获取垫图任务列表出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * @route   GET /api/diantu/task/:taskId
 * @desc    获取单个垫图任务状态
 * @access  Private
 */
router.get('/task/:taskId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.taskId;
    
    console.log(`获取垫图任务状态: userId=${userId}, taskId=${taskId}`);
    
    // 从统一功能使用记录中获取任务
    const tasks = await FeatureUsage.findAll({
      where: {
        userId: userId,
        featureName: 'DIANTU'
      },
      order: [['createdAt', 'DESC']]
    });
    
    // 在所有任务中查找指定的任务ID
    let foundTask = null;
    
    tasks.forEach(task => {
      try {
        // 解析details字段中的任务列表
        const details = JSON.parse(task.details || '{}');
        const taskList = details.tasks || [];
        
        // 遍历每个任务
        taskList.forEach(taskItem => {
          if (taskItem.taskId === taskId) {
            foundTask = {
              taskId: taskItem.taskId,
              status: taskItem.status || 'PENDING',
              prompt: taskItem.prompt || '',
              originalUrl: taskItem.imageUrl || taskItem.originalUrl || '',
              resultUrl: taskItem.resultUrl || '',
              createdAt: taskItem.createdAt || taskItem.timestamp || task.createdAt,
              errorMessage: taskItem.errorMessage || ''
            };
            
            // 确保resultUrl存在，如果不存在则使用originalUrl
            if (!foundTask.resultUrl || foundTask.resultUrl.trim() === '') {
              console.log(`任务 ${foundTask.taskId} 缺少resultUrl，使用原始图片URL`);
              foundTask.resultUrl = foundTask.originalUrl;
            }
          }
        });
      } catch (parseError) {
        console.error('解析垫图任务详情失败:', parseError);
      }
    });
    
    if (!foundTask) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }
    
    return res.json({
      success: true,
      task: foundTask
    });
  } catch (error) {
    console.error('获取垫图任务状态失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * @route   POST /api/diantu/fix-results
 * @desc    修复垫图任务结果URL
 * @access  Private
 */
router.post('/fix-results', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`开始修复用户 ${userId} 的垫图任务结果`);
    
    // 查找用户的垫图功能使用记录
    const tasks = await FeatureUsage.findAll({
      where: {
        userId: userId,
        featureName: 'DIANTU'
      }
    });
    
    console.log(`找到 ${tasks.length} 条垫图功能使用记录`);
    
    let fixedCount = 0;
    let failedCount = 0;
    
    // 遍历每条记录
    for (const task of tasks) {
      try {
        // 解析details字段
        const details = JSON.parse(task.details || '{}');
        const taskList = details.tasks || [];
        let hasChanges = false;
        
        // 遍历每个任务
        for (const taskItem of taskList) {
          // 只处理已成功的任务
          if (taskItem.status === 'SUCCEEDED' && taskItem.imageUrl && (!taskItem.resultUrl || taskItem.resultUrl.trim() === '')) {
            console.log(`修复任务 ${taskItem.taskId}: 缺少resultUrl`);
            
            try {
              // 将原始图片保存到OSS
              const ossUrl = await saveDiantuResultToOSS(taskItem.imageUrl, userId, taskItem.taskId);
              
              // 更新resultUrl
              taskItem.resultUrl = ossUrl;
              hasChanges = true;
              fixedCount++;
              
              console.log(`任务 ${taskItem.taskId} 已修复: ${ossUrl}`);
            } catch (ossError) {
              console.error(`保存任务 ${taskItem.taskId} 到OSS失败:`, ossError);
              failedCount++;
            }
          }
        }
        
        // 如果有更改，更新数据库
        if (hasChanges) {
          task.details = JSON.stringify(details);
          await task.save();
          console.log(`已更新任务记录 ID=${task.id}`);
        }
      } catch (parseError) {
        console.error(`解析任务 ID=${task.id} 详情失败:`, parseError);
        failedCount++;
      }
    }
    
    return res.json({
      success: true,
      message: `修复完成: 成功修复 ${fixedCount} 个任务, ${failedCount} 个任务失败`
    });
  } catch (error) {
    console.error('修复垫图任务结果失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

module.exports = router;
