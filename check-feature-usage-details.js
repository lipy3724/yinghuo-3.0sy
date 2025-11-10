const { FeatureUsage } = require('./models/FeatureUsage');
const sequelize = require('./config/db');

/**
 * 检查用户功能使用记录详情
 */
async function checkFeatureUsageDetails() {
    try {
        console.log('开始检查功能使用记录详情...');
        
        // 查找admin用户的所有功能使用记录
        const usages = await FeatureUsage.findAll({
            where: { userId: 2 }, // admin用户ID为2
            attributes: ['id', 'featureName', 'usageCount', 'credits', 'details', 'createdAt']
        });
        
        console.log(`找到 ${usages.length} 条功能使用记录`);
        
        // 遍历每条记录，检查详情
        for (const usage of usages) {
            console.log(`\n功能: ${usage.featureName}`);
            console.log(`记录ID: ${usage.id}`);
            console.log(`创建时间: ${usage.createdAt}`);
            console.log(`使用次数: ${usage.usageCount}`);
            console.log(`记录的积分消耗: ${usage.credits}`);
            
            if (!usage.details) {
                console.log('无详情记录');
                continue;
            }
            
            try {
                const details = JSON.parse(usage.details);
                if (!details.tasks || !Array.isArray(details.tasks)) {
                    console.log('无任务记录');
                    continue;
                }
                
                let totalTaskCredits = 0;
                
                // 检查每个任务
                console.log('任务详情:');
                for (const task of details.tasks) {
                    const taskCredits = task.creditCost || 0;
                    const taskId = task.taskId || '未知';
                    const isFree = task.isFree ? '是' : '否';
                    
                    console.log(`  - 任务ID: ${taskId}, 积分: ${taskCredits}, 是否免费: ${isFree}`);
                    
                    // 只累加非免费任务的积分
                    if (!task.isFree) {
                        totalTaskCredits += taskCredits;
                    }
                }
                
                // 检查任务积分总和与记录的积分是否一致
                console.log(`任务积分总和: ${totalTaskCredits}`);
                if (totalTaskCredits !== usage.credits) {
                    console.log(`⚠️ 警告: 任务积分总和(${totalTaskCredits})与记录的积分(${usage.credits})不一致!`);
                }
                
            } catch (parseError) {
                console.error(`解析功能 ${usage.featureName} 的details失败:`, parseError);
            }
        }
        
        console.log('\n检查完成！');
        
    } catch (error) {
        console.error('检查功能使用记录详情时出错:', error);
    } finally {
        await sequelize.close();
    }
}

// 运行检查脚本
checkFeatureUsageDetails(); 