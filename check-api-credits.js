const { FeatureUsage } = require('./models/FeatureUsage');
const sequelize = require('./config/db');

async function checkApiCredits() {
    try {
        console.log('检查API积分计算逻辑...');
        
        const userId = 2; // admin用户
        const days = 30;
        
        // 获取当前日期和指定天数前的日期
        const now = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        console.log(`时间范围: ${startDate.toISOString()} 到 ${now.toISOString()}`);
        
        // 获取用户的所有功能使用记录
        const usages = await FeatureUsage.findAll({
            where: { userId },
            attributes: ['id', 'featureName', 'usageCount', 'lastUsedAt', 'resetDate', 'credits', 'details']
        });
        
        console.log(`用户有 ${usages.length} 条功能使用记录`);
        
        let totalCreditsUsed = 0;
        const processedTaskIdsForTotal = new Set();
        
        // 处理每种功能
        for (const usage of usages) {
            const featureName = usage.featureName;
            console.log(`\n处理功能: ${featureName}`);
            console.log(`数据库记录的积分消耗: ${usage.credits}`);
            
            let totalFeatureCreditCost = 0;
            
            if (usage.details) {
                try {
                    const details = JSON.parse(usage.details);
                    const refunds = details.refunds || [];
                    
                    if (details.tasks && Array.isArray(details.tasks)) {
                        console.log(`任务数量: ${details.tasks.length}`);
                        
                        // 过滤时间范围内的任务
                        const tasks = details.tasks.filter(task => 
                            new Date(task.timestamp) >= startDate
                        );
                        
                        console.log(`时间范围内的任务数量: ${tasks.length}`);
                        
                        // 计算积分消耗
                        for (const task of tasks) {
                            const taskId = task.taskId;
                            
                            if (!taskId || processedTaskIdsForTotal.has(taskId)) {
                                continue;
                            }
                            
                            processedTaskIdsForTotal.add(taskId);
                            
                            if (task.isFree) {
                                console.log(`跳过免费任务: ${taskId}`);
                                continue;
                            }
                            
                            // 检查是否已退款
                            const isRefunded = refunds.some(refund => refund.taskId === taskId);
                            if (isRefunded) {
                                console.log(`跳过已退款任务: ${taskId}`);
                                continue;
                            }
                            
                            const cost = task.creditCost || 0;
                            console.log(`统计任务: ${taskId}, 积分: ${cost}`);
                            totalFeatureCreditCost += cost;
                        }
                    }
                } catch (parseError) {
                    console.error(`解析details失败:`, parseError);
                }
            }
            
            console.log(`${featureName} 功能API计算积分消耗: ${totalFeatureCreditCost}`);
            totalCreditsUsed += totalFeatureCreditCost;
        }
        
        console.log(`\nAPI计算的总积分消耗: ${totalCreditsUsed}`);
        console.log(`正确余额应该是: 10000 - ${totalCreditsUsed} = ${10000 - totalCreditsUsed} 积分`);
        
    } catch (error) {
        console.error('检查失败:', error);
    } finally {
        await sequelize.close();
    }
}

checkApiCredits(); 