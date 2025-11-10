/**
 * 垫图功能修复脚本
 * 
 * 问题：垫图功能生成的图片在任务完成后，结果URL没有被保存到FeatureUsage表中，
 * 导致历史记录中无法显示生成的结果图。
 * 
 * 修复方案：
 * 在routes/imageEdit.js文件的task-status/:taskId接口中，当任务状态为SUCCEEDED时，
 * 添加保存结果URL到FeatureUsage表的逻辑。
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { FeatureUsage } = require('../models/FeatureUsage');

/**
 * @route   GET /api/fix-diantu/update-task/:taskId
 * @desc    手动更新垫图任务的结果URL
 * @access  私有
 */
router.get('/update-task/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { resultUrl } = req.query;
    
    if (!taskId || !resultUrl) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：taskId 和 resultUrl'
      });
    }
    
    const userId = req.user.id;
    
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
    
    // 解析现有详情
    const details = JSON.parse(usage.details || '{}');
    const tasks = details.tasks || [];
    
    // 找到对应的任务并更新resultUrl
    const taskIndex = tasks.findIndex(t => t.taskId === taskId);
    if (taskIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '未找到对应的垫图任务记录'
      });
    }
    
    // 更新任务状态和结果URL
    tasks[taskIndex].resultUrl = resultUrl;
    tasks[taskIndex].status = 'SUCCEEDED';
    tasks[taskIndex].completedAt = new Date().toISOString();
    
    // 更新数据库
    usage.details = JSON.stringify({
      ...details,
      tasks: tasks
    });
    await usage.save();
    
    return res.json({
      success: true,
      message: '垫图任务结果已成功更新',
      task: tasks[taskIndex]
    });
  } catch (error) {
    console.error('更新垫图任务结果失败:', error);
    return res.status(500).json({
      success: false,
      message: '更新垫图任务结果失败: ' + error.message
    });
  }
});

/**
 * @route   GET /api/fix-diantu/tasks
 * @desc    获取用户的垫图任务列表
 * @access  私有
 */
router.get('/tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 查找用户的垫图功能使用记录
    const usage = await FeatureUsage.findOne({
      where: {
        userId: userId,
        featureName: 'DIANTU'
      }
    });
    
    if (!usage) {
      return res.json({
        success: true,
        tasks: []
      });
    }
    
    // 解析详情
    const details = JSON.parse(usage.details || '{}');
    const tasks = details.tasks || [];
    
    return res.json({
      success: true,
      tasks: tasks
    });
  } catch (error) {
    console.error('获取垫图任务列表失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取垫图任务列表失败: ' + error.message
    });
  }
});

module.exports = router;
