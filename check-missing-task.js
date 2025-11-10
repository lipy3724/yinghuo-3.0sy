const { FeatureUsage } = require('./models/FeatureUsage');
const User = require('./models/User');
const sequelize = require('./config/db');

/**
 * 查找未被记录的任务
 */
async function checkMissingTask() {
    try {
        console.log('开始查找未被记录的任务...');
        
        // 查找admin用户
        const user = await User.findOne({
            where: { username: 'admin' },
            attributes: ['id', 'username']
        });
        
        if (!user) {
            console.log('未找到admin用户');
            return;
        }
        
        console.log(`用户: ${user.username} (ID: ${user.id})`);
        
        // 查找admin用户的所有功能使用记录
        const usages = await FeatureUsage.findAll({
            where: { userId: user.id },
            attributes: ['id', 'featureName', 'details']
        });
        
        console.log(`找到 ${usages.length} 条功能使用记录`);
        
        // 遍历每条记录，查找未被统计的任务
        for (const usage of usages) {
            console.log(`\n检查功能: ${usage.featureName} (记录ID: ${usage.id})`);
            
            if (!usage.details) {
                console.log('无详情记录，跳过');
                continue;
            }
            
            try {
                const details = JSON.parse(usage.details);
                if (!details.tasks || !Array.isArray(details.tasks)) {
                    console.log('无任务记录，跳过');
                    continue;
                }
                
                // 查找未被统计积分的任务
                const missingCreditTasks = details.tasks.filter(task => 
                    task.creditCost === undefined || task.creditCost === null
                );
                
                if (missingCreditTasks.length > 0) {
                    console.log(`发现 ${missingCreditTasks.length} 个未记录积分的任务:`);
                    missingCreditTasks.forEach(task => {
                        console.log(`- 任务ID: ${task.taskId}, 是否免费: ${task.isFree ? '是' : '否'}`);
                    });
                } else {
                    console.log('所有任务都已正确记录积分');
                }
                
                // 查找最新的任务
                const sortedTasks = [...details.tasks].sort((a, b) => {
                    const timeA = parseInt(a.taskId.split('-')[1]);
                    const timeB = parseInt(b.taskId.split('-')[1]);
                    return timeB - timeA;
                });
                
                if (sortedTasks.length > 0) {
                    const latestTask = sortedTasks[0];
                    console.log(`最新任务: ${latestTask.taskId}, 积分: ${latestTask.creditCost || 0}, 是否免费: ${latestTask.isFree ? '是' : '否'}`);
                }
                
            } catch (parseError) {
                console.error(`解析功能 ${usage.featureName} 的details失败:`, parseError);
            }
        }
        
        console.log('\n检查完成！');
        
    } catch (error) {
        console.error('查找未被记录的任务时出错:', error);
    } finally {
        await sequelize.close();
    }
}

// 运行查找脚本
checkMissingTask(); 