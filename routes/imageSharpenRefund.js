const { FeatureUsage } = require('../models/FeatureUsage');
const User = require('../models/User');

/**
 * 模糊图片变清晰功能积分退款函数
 * 当任务失败时，退还已扣除的积分
 * @param {string} userId 用户ID
 * @param {string} taskId 任务ID
 * @param {string} reason 退款原因
 * @returns {Promise<boolean>} 是否退款成功
 */
async function refundImageSharpeningCredits(userId, taskId, reason = '任务失败') {
    try {
        console.log(`开始处理模糊图片变清晰退款: 用户ID=${userId}, 任务ID=${taskId}, 原因=${reason}`);
        
        // 查找该功能的使用记录
        const usage = await FeatureUsage.findOne({
            where: {
                userId: userId,
                featureName: 'IMAGE_SHARPENING'
            }
        });
        
        if (!usage) {
            console.log(`未找到用户${userId}的模糊图片变清晰使用记录，无需退款`);
            return false;
        }
        
        // 解析details字段，查找对应的任务记录
        let details = {};
        if (usage.details) {
            try {
                details = JSON.parse(usage.details);
            } catch (e) {
                console.error('解析details字段失败:', e);
                details = {};
            }
        }
        
        // 确保refunds数组存在
        if (!details.refunds) {
            details.refunds = [];
        }
        
        // 查找对应的任务记录
        const tasks = details.tasks || [];
        let task = null;
        
        if (taskId) {
            // 如果提供了taskId，先尝试精确匹配
            task = tasks.find(t => t.taskId === taskId);
            
            // 检查是否已经退款过
            const existingRefund = details.refunds.find(refund => refund.taskId === taskId);
            if (existingRefund) {
                console.log(`任务${taskId}已经退款过，跳过重复退款`);
                return false;
            }
        }
        
        // 如果没找到任务记录或没有提供taskId，尝试从最近的任务中推断
        if (!task && tasks.length > 0) {
            // 按时间排序，取最近的一个没有退款的任务
            const sortedTasks = tasks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            for (const t of sortedTasks) {
                const existingRefund = details.refunds.find(refund => refund.taskId === t.taskId);
                if (!existingRefund) {
                    task = t;
                    console.log(`使用最近的未退款任务记录进行退款: ${task.taskId}`);
                    break;
                }
            }
        }
        
        if (!task) {
            console.log(`未找到任务记录，无法退款`);
            return false;
        }
        
        const creditCost = task.creditCost || 0;
        const isFree = task.isFree || false;
        
        console.log(`找到任务记录: 积分=${creditCost}, 是否免费=${isFree}`);
        
        // 如果是免费使用，只需要回退使用次数，不退还积分
        if (isFree) {
            console.log('免费使用失败，回退使用次数');
            
            // 减少使用次数
            if (usage.usageCount > 0) {
                usage.usageCount -= 1;
            }
            
            // 记录退款信息（标记为免费退款）
            details.refunds.push({
                taskId: task.taskId,
                creditCost: 0,
                isFree: true,
                reason: reason,
                refundTime: new Date().toISOString()
            });
            
            usage.details = JSON.stringify(details);
            await usage.save();
            
            console.log(`模糊图片变清晰免费使用退款完成: 用户ID=${userId}, 回退使用次数`);
            return true;
        }
        
        // 付费使用退款
        if (creditCost > 0) {
            console.log(`开始退还积分: ${creditCost}`);
            
            // 获取用户信息
            const user = await User.findByPk(userId);
            
            if (!user) {
                console.error(`未找到用户ID=${userId}`);
                return false;
            }
            
            // 退还积分
            user.credits += creditCost;
            await user.save();
            
            // 减少该功能的积分消费记录
            if (usage.credits >= creditCost) {
                usage.credits -= creditCost;
            } else {
                usage.credits = 0;
            }
            
            // 减少使用次数
            if (usage.usageCount > 0) {
                usage.usageCount -= 1;
            }
            
            // 记录退款信息
            details.refunds.push({
                taskId: task.taskId,
                creditCost: creditCost,
                isFree: false,
                reason: reason,
                refundTime: new Date().toISOString()
            });
            
            usage.details = JSON.stringify(details);
            await usage.save();
            
            console.log(`模糊图片变清晰积分退款完成: 用户ID=${userId}, 退还积分=${creditCost}, 用户当前积分=${user.credits}`);
            return true;
        }
        
        console.log(`任务${taskId}无需退款: 积分=${creditCost}, 免费=${isFree}`);
        return false;
        
    } catch (error) {
        console.error('模糊图片变清晰退款失败:', error);
        return false;
    }
}

module.exports = {
    refundImageSharpeningCredits
};
