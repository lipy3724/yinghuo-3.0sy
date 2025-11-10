const { FeatureUsage } = require('./models/FeatureUsage');

async function debugTaskDetails() {
    try {
        // 查找多图转视频任务
        const tasks = await FeatureUsage.findAll({
            where: {
                featureName: 'MULTI_IMAGE_TO_VIDEO'
            },
            order: [['createdAt', 'DESC']],
            limit: 5
        });
        
        console.log('找到的多图转视频任务数量:', tasks.length);
        
        for (const task of tasks) {
            console.log('\n=== 任务详情 ===');
            console.log('任务ID:', task.id);
            console.log('用户ID:', task.userId);
            console.log('状态:', task.status);
            console.log('创建时间:', task.createdAt);
            console.log('更新时间:', task.updatedAt);
            
            if (task.details) {
                try {
                    const details = JSON.parse(task.details);
                    console.log('任务详情:', JSON.stringify(details, null, 2));
                    
                    if (details.tasks && Array.isArray(details.tasks)) {
                        console.log('子任务数量:', details.tasks.length);
                        for (const subTask of details.tasks) {
                            console.log('子任务ID:', subTask.taskId);
                            console.log('子任务状态:', subTask.status);
                            console.log('阿里云RequestId:', subTask.aliCloudRequestId);
                            console.log('视频URL:', subTask.videoUrl);
                        }
                    }
                } catch (e) {
                    console.error('解析任务详情失败:', e);
                }
            }
        }
    } catch (error) {
        console.error('查询任务失败:', error);
    }
}

debugTaskDetails();
