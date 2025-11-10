/**
 * 垫图任务结果URL保存修复
 * 
 * 问题：垫图功能生成的图片在任务完成后，结果URL没有被保存到FeatureUsage表中，
 * 导致历史记录中无法显示生成的结果图。
 * 
 * 解决方案：
 * 1. 修改routes/imageEdit.js中的task-status/:taskId接口
 * 2. 在任务状态为SUCCEEDED时，检查是否为垫图任务
 * 3. 如果是垫图任务，将结果URL保存到FeatureUsage表的对应任务记录中
 * 
 * 修改位置：
 * 在routes/imageEdit.js文件中，找到task-status/:taskId接口的处理函数，
 * 在处理任务成功状态的代码块中，添加保存结果URL的逻辑。
 * 
 * 具体修改代码如下：
 */

// 在if (taskStatus === 'SUCCEEDED')代码块中添加以下代码
if (resultUrl) {
  // 将结果URL缓存起来
  imageCache.set(taskId, {
    url: resultUrl,
    timestamp: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时过期
  });
  
  // 如果是垫图功能，更新任务详情中的resultUrl
  try {
    // 判断是否为垫图功能 - 检查任务类型或函数名
    if (task.isDiantu || task.functionType === 'control_cartoon_feature') {
      console.log(`垫图任务成功，更新结果URL: 任务ID=${taskId}, 结果URL=${resultUrl}`);
      const { FeatureUsage } = require('../models/FeatureUsage');
      const userId = req.user.id;
      
      // 查找用户的垫图功能使用记录
      const usage = await FeatureUsage.findOne({
        where: {
          userId: userId,
          featureName: 'DIANTU'
        }
      });
      
      if (usage) {
        // 解析现有详情
        const details = JSON.parse(usage.details || '{}');
        const tasks = details.tasks || [];
        
        // 找到对应的任务并更新resultUrl
        const taskIndex = tasks.findIndex(t => t.taskId === taskId);
        if (taskIndex !== -1) {
          tasks[taskIndex].resultUrl = resultUrl;
          tasks[taskIndex].status = 'SUCCEEDED';
          tasks[taskIndex].completedAt = new Date().toISOString();
          
          // 更新数据库
          usage.details = JSON.stringify({
            ...details,
            tasks: tasks
          });
          await usage.save();
          
          console.log(`垫图任务结果已保存到数据库: 任务ID=${taskId}`);
        } else {
          console.warn(`未找到对应的垫图任务记录: 任务ID=${taskId}`);
        }
      } else {
        console.warn(`未找到用户的垫图功能使用记录: 用户ID=${userId}`);
      }
    }
  } catch (saveError) {
    console.error('保存垫图任务结果URL失败:', saveError);
    // 继续执行，不中断流程
  }
}

/**
 * 另一种解决方案：
 * 
 * 如果不希望修改原有代码，可以创建一个新的中间件或路由处理函数，
 * 在垫图任务状态查询接口中添加保存结果URL的逻辑。
 * 
 * 例如：
 */

// 创建一个新的路由处理函数，专门用于处理垫图任务状态查询
router.get('/diantu/task-status/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    
    // 先调用原有的任务状态查询接口
    const statusResponse = await axios.get(`/api/image-edit/task-status/${taskId}`, {
      headers: {
        Authorization: `Bearer ${req.headers.authorization.split(' ')[1]}`
      }
    });
    
    // 如果任务成功，保存结果URL
    if (statusResponse.data.status === 'SUCCEEDED' && statusResponse.data.resultUrl) {
      try {
        const resultUrl = statusResponse.data.resultUrl;
        
        // 查找用户的垫图功能使用记录
        const { FeatureUsage } = require('../models/FeatureUsage');
        const usage = await FeatureUsage.findOne({
          where: {
            userId: userId,
            featureName: 'DIANTU'
          }
        });
        
        if (usage) {
          // 解析现有详情
          const details = JSON.parse(usage.details || '{}');
          const tasks = details.tasks || [];
          
          // 找到对应的任务并更新resultUrl
          const taskIndex = tasks.findIndex(t => t.taskId === taskId);
          if (taskIndex !== -1) {
            tasks[taskIndex].resultUrl = resultUrl;
            tasks[taskIndex].status = 'SUCCEEDED';
            tasks[taskIndex].completedAt = new Date().toISOString();
            
            // 更新数据库
            usage.details = JSON.stringify({
              ...details,
              tasks: tasks
            });
            await usage.save();
            
            console.log(`垫图任务结果已保存到数据库: 任务ID=${taskId}`);
          }
        }
      } catch (saveError) {
        console.error('保存垫图任务结果URL失败:', saveError);
      }
    }
    
    // 返回原始响应
    return res.json(statusResponse.data);
  } catch (error) {
    console.error('查询垫图任务状态失败:', error);
    return res.status(500).json({
      success: false,
      message: '查询垫图任务状态失败: ' + error.message
    });
  }
});
