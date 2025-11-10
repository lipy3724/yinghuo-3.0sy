/**
 * 图生视频功能积分扣除逻辑优化脚本
 * 
 * 此脚本用于优化图生视频功能的积分扣除逻辑，确保任务完成后正确扣除积分
 * 
 * 优化内容：
 * 1. 修复任务状态查询API中的积分扣除逻辑
 * 2. 添加任务状态标记的统一处理
 * 3. 增强日志记录，便于排查问题
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// 导入任务完成状态检查工具
const { isTaskCompleted, logTaskCompletionStatus } = require('./task-completion-checker');

// 要修改的文件路径
const textToVideoFilePath = path.join(__dirname, 'routes', 'textToVideo.js');
const unifiedFeatureUsageFilePath = path.join(__dirname, 'middleware', 'unifiedFeatureUsage.js');

// 备份文件
function backupFile(filePath) {
  const backupPath = `${filePath}.backup-${Date.now()}`;
  fs.copyFileSync(filePath, backupPath);
  console.log(`已备份文件: ${filePath} -> ${backupPath}`);
  return backupPath;
}

// 优化图生视频任务状态查询API
function optimizeTaskStatusAPI() {
  try {
    console.log('开始优化图生视频任务状态查询API...');
    
    // 备份文件
    const backupPath = backupFile(textToVideoFilePath);
    
    // 读取文件内容
    let content = fs.readFileSync(textToVideoFilePath, 'utf8');
    
    // 查找任务状态查询API中的积分扣除逻辑
    const taskStatusAPIRegex = /router\.get\('\/task-status\/:taskId', protect, async \(req, res\) => \{[\s\S]+?if \(currentTaskStatus === 'SUCCEEDED'\) \{[\s\S]+?\/\/ 更新数据库中的使用记录，仅在未扣除积分时执行[\s\S]+?if \(!hasChargedCredits\) \{/;
    
    // 检查是否找到了目标代码段
    if (!taskStatusAPIRegex.test(content)) {
      console.log('未找到目标代码段，请手动检查文件');
      return;
    }
    
    // 修改任务状态查询API中的积分扣除逻辑
    content = content.replace(
      /\/\/ 更新数据库中的使用记录，仅在未扣除积分时执行\s+if \(!hasChargedCredits\) \{/g,
      `// 更新数据库中的使用记录，仅在未扣除积分时执行
                if (!hasChargedCredits) {
                    // 导入任务完成状态检查工具
                    const { isTaskCompleted, logTaskCompletionStatus } = require('../task-completion-checker');
                    
                    // 构建任务对象
                    const taskObj = {
                        taskId: taskId,
                        status: currentTaskStatus,
                        response: dashscopeResponse
                    };
                    
                    // 检查任务是否已完成
                    const isCompleted = isTaskCompleted(taskObj);
                    logTaskCompletionStatus(taskObj, isCompleted);
                    
                    // 添加详细日志，记录任务状态和处理流程
                    console.log(\`图生视频任务状态更新: 任务ID=\${taskId}, 状态=\${currentTaskStatus}, 视频URL=\${dashscopeResponse.output.video_url ? '已生成' : '未生成'}, 判定完成=\${isCompleted}\`);`
    );
    
    // 增强任务完成状态的判断逻辑
    content = content.replace(
      /\/\/ 调用saveTaskDetails函数，传入status='completed'参数，触发后续扣费逻辑[\s\S]+?await saveTaskDetails\(usage, \{[\s\S]+?taskId: taskId,[\s\S]+?featureName: 'image-to-video',[\s\S]+?status: 'completed',/g,
      `// 调用saveTaskDetails函数，传入status='completed'参数，触发后续扣费逻辑
                            const { saveTaskDetails } = require('../middleware/unifiedFeatureUsage');
                            await saveTaskDetails(usage, {
                                taskId: taskId,
                                featureName: 'image-to-video',
                                status: 'completed', // 统一使用'completed'状态触发扣费逻辑
                                statusCode: 'SUCCEEDED', // 添加原始状态码，便于排查问题`
    );
    
    // 增强任务完成后的日志记录
    content = content.replace(
      /console\.log\(\`已触发图生视频任务完成扣费逻辑: 任务ID=\${taskId}, 积分=\${creditCost}, 免费=\${taskIsFree}\`\);/g,
      `console.log(\`已触发图生视频任务完成扣费逻辑: 任务ID=\${taskId}, 积分=\${creditCost}, 免费=\${taskIsFree}, 视频URL=\${dashscopeResponse.output.video_url}\`);
                            
                            // 添加详细日志，记录积分扣除过程
                            console.log(\`积分扣除详情: 用户ID=\${userId}, 任务ID=\${taskId}, 功能=image-to-video, 积分=\${creditCost}, 免费=\${taskIsFree}, 时间=\${new Date().toISOString()}\`);`
    );
    
    // 写入修改后的内容
    fs.writeFileSync(textToVideoFilePath, content);
    console.log('已优化图生视频任务状态查询API');
    
    return true;
  } catch (error) {
    console.error('优化图生视频任务状态查询API失败:', error);
    return false;
  }
}

// 优化统一功能使用中间件
function optimizeUnifiedFeatureUsage() {
  try {
    console.log('开始优化统一功能使用中间件...');
    
    // 备份文件
    const backupPath = backupFile(unifiedFeatureUsageFilePath);
    
    // 读取文件内容
    let content = fs.readFileSync(unifiedFeatureUsageFilePath, 'utf8');
    
    // 优化任务完成状态的判断逻辑
    content = content.replace(
      /\/\/ 处理任务完成后的积分扣除逻辑\s+if \(taskInfo\.status === 'completed' && taskInfo\.featureName\) \{/g,
      `// 处理任务完成后的积分扣除逻辑
    // 使用增强的任务完成状态检查逻辑
    const { isTaskCompleted, logTaskCompletionStatus } = require('../task-completion-checker');
    const isCompleted = isTaskCompleted(taskInfo);
    logTaskCompletionStatus(taskInfo, isCompleted);
    
    if (isCompleted && taskInfo.featureName) {
      // 添加详细日志，记录任务完成状态
      console.log(\`任务完成状态检测: 任务ID=\${taskInfo.taskId}, 状态=\${taskInfo.status}, 状态码=\${taskInfo.statusCode || '无'}, 功能=\${taskInfo.featureName}\`);`
    );
    
    // 增强handleTaskCompletion函数的日志记录
    content = content.replace(
      /console\.log\(\`处理任务完成扣费: 用户=\${userId}, 功能=\${featureName}, 积分=\${creditCost}, 免费=\${isFree}\`\);/g,
      `console.log(\`处理任务完成扣费: 用户=\${userId}, 功能=\${featureName}, 积分=\${creditCost}, 免费=\${isFree}, 任务ID=\${taskInfo.taskId}\`);
    
    // 记录详细的任务信息，便于排查问题
    console.log(\`任务详情: \${JSON.stringify({
      taskId: taskInfo.taskId,
      featureName: featureName,
      status: taskInfo.status,
      statusCode: taskInfo.statusCode,
      creditCost: creditCost,
      isFree: isFree,
      timestamp: new Date().toISOString()
    }, null, 2)}\`);`
    );
    
    // 增强积分扣除成功的日志记录
    content = content.replace(
      /console\.log\(\`已扣除积分: 用户=\${userId}, 扣除=\${actualCreditCost}, 剩余=\${user\.credits}, 功能总积分=\${usage\.credits}\`\);/g,
      `console.log(\`已扣除积分: 用户=\${userId}, 扣除=\${actualCreditCost}, 剩余=\${user.credits}, 功能总积分=\${usage.credits}, 任务ID=\${taskInfo.taskId}\`);
    
    // 记录积分扣除事件到日志
    console.log(\`[积分扣除事件] 用户=\${userId}, 功能=\${featureName}, 积分=\${actualCreditCost}, 任务ID=\${taskInfo.taskId}, 时间=\${new Date().toISOString()}\`);`
    );
    
    // 写入修改后的内容
    fs.writeFileSync(unifiedFeatureUsageFilePath, content);
    console.log('已优化统一功能使用中间件');
    
    return true;
  } catch (error) {
    console.error('优化统一功能使用中间件失败:', error);
    return false;
  }
}

// 执行优化
async function optimize() {
  console.log('开始优化图生视频功能积分扣除逻辑...');
  
  // 优化图生视频任务状态查询API
  const apiOptimized = optimizeTaskStatusAPI();
  
  // 优化统一功能使用中间件
  const middlewareOptimized = optimizeUnifiedFeatureUsage();
  
  if (apiOptimized && middlewareOptimized) {
    console.log('优化完成！请重启服务器以应用更改');
  } else {
    console.log('优化过程中出现错误，请查看日志');
  }
}

// 执行优化
optimize()
  .then(() => {
    console.log('优化脚本执行完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('优化脚本执行失败:', error);
    process.exit(1);
  });
