const { FeatureUsage } = require('./models/FeatureUsage');
const User = require('./models/User');
const sequelize = require('./config/db');

/**
 * 检查界面显示的积分消耗和数据库记录的差异
 */
async function checkCreditsDiscrepancy() {
    try {
        console.log('开始检查积分消耗差异...\n');
        
        // 查找admin用户
        const user = await User.findOne({
            where: { username: 'admin' },
            attributes: ['id', 'username', 'credits']
        });
        
        if (!user) {
            console.log('未找到admin用户');
            return;
        }
        
        console.log(`用户: ${user.username} (ID: ${user.id})`);
        console.log(`当前积分余额: ${user.credits}\n`);
        
        // 查找admin用户的所有功能使用记录
        const usages = await FeatureUsage.findAll({
            where: { userId: user.id },
            attributes: ['id', 'featureName', 'usageCount', 'credits', 'details', 'createdAt', 'updatedAt']
        });
        
        console.log(`找到 ${usages.length} 条功能使用记录`);
        
        // 计算数据库中的总积分消耗
        let dbTotalCredits = 0;
        for (const usage of usages) {
            console.log(`\n功能: ${usage.featureName}`);
            console.log(`记录ID: ${usage.id}`);
            console.log(`使用次数: ${usage.usageCount}`);
            console.log(`积分消耗: ${usage.credits}`);
            console.log(`创建时间: ${usage.createdAt}`);
            console.log(`更新时间: ${usage.updatedAt}`);
            
            dbTotalCredits += usage.credits;
            
            // 检查任务详情中的积分消耗
            if (usage.details) {
                try {
                    const details = JSON.parse(usage.details);
                    if (details.tasks && Array.isArray(details.tasks)) {
                        let taskTotalCredits = 0;
                        let freeTasks = 0;
                        let paidTasks = 0;
                        
                        for (const task of details.tasks) {
                            const taskCredits = task.creditCost || 0;
                            
                            if (task.isFree) {
                                freeTasks++;
                            } else {
                                paidTasks++;
                                taskTotalCredits += taskCredits;
                            }
                        }
                        
                        console.log(`任务总数: ${details.tasks.length}`);
                        console.log(`免费任务: ${freeTasks}`);
                        console.log(`付费任务: ${paidTasks}`);
                        console.log(`任务积分总和: ${taskTotalCredits}`);
                        
                        if (taskTotalCredits !== usage.credits) {
                            console.log(`⚠️ 积分不一致! 记录值: ${usage.credits}, 任务总和: ${taskTotalCredits}`);
                        }
                    }
                } catch (error) {
                    console.error(`解析details失败:`, error);
                }
            }
        }
        
        console.log(`\n数据库中的总积分消耗: ${dbTotalCredits}`);
        
        // 界面显示的积分消耗
        const uiCredits = 518;
        console.log(`界面显示的积分消耗: ${uiCredits}`);
        
        if (dbTotalCredits !== uiCredits) {
            console.log(`⚠️ 积分消耗不一致! 差额: ${dbTotalCredits - uiCredits}`);
            
            // 检查是否是计算方式的问题
            console.log('\n检查可能的原因:');
            
            // 1. 检查是否有部分任务被标记为免费
            let totalFreeTasks = 0;
            let totalPaidTasks = 0;
            
            for (const usage of usages) {
                if (usage.details) {
                    try {
                        const details = JSON.parse(usage.details);
                        if (details.tasks && Array.isArray(details.tasks)) {
                            for (const task of details.tasks) {
                                if (task.isFree) {
                                    totalFreeTasks++;
                                } else {
                                    totalPaidTasks++;
                                }
                            }
                        }
                    } catch (error) {
                        // 忽略解析错误
                    }
                }
            }
            
            console.log(`免费任务总数: ${totalFreeTasks}`);
            console.log(`付费任务总数: ${totalPaidTasks}`);
            
            // 2. 检查是否有任务的积分被重复计算
            console.log('\n检查是否有任务的积分被重复计算:');
            
            const taskIds = new Set();
            const duplicateTaskIds = new Set();
            
            for (const usage of usages) {
                if (usage.details) {
                    try {
                        const details = JSON.parse(usage.details);
                        if (details.tasks && Array.isArray(details.tasks)) {
                            for (const task of details.tasks) {
                                if (taskIds.has(task.taskId)) {
                                    duplicateTaskIds.add(task.taskId);
                                } else {
                                    taskIds.add(task.taskId);
                                }
                            }
                        }
                    } catch (error) {
                        // 忽略解析错误
                    }
                }
            }
            
            if (duplicateTaskIds.size > 0) {
                console.log(`发现 ${duplicateTaskIds.size} 个重复的任务ID:`);
                for (const taskId of duplicateTaskIds) {
                    console.log(`- ${taskId}`);
                }
            } else {
                console.log('未发现重复的任务ID');
            }
            
            // 3. 检查界面计算逻辑
            console.log('\n可能的界面计算逻辑问题:');
            console.log('- 界面可能只统计了某一时间段内的积分消耗');
            console.log('- 界面可能使用了缓存数据而未更新');
            console.log('- 界面可能有计算错误');
            
            console.log('\n建议解决方案:');
            console.log('1. 更新界面计算逻辑，确保与数据库记录一致');
            console.log('2. 清除界面缓存，重新加载数据');
            console.log('3. 如果界面显示的是某一时间段的数据，请确保时间段设置正确');
        } else {
            console.log('✓ 积分消耗一致');
        }
        
    } catch (error) {
        console.error('检查积分消耗差异时出错:', error);
    } finally {
        await sequelize.close();
    }
}

// 运行检查脚本
checkCreditsDiscrepancy(); 