const { FeatureUsage } = require('./models/FeatureUsage');
const User = require('./models/User');

/**
 * 清理测试用户的多图转视频数据
 */
async function cleanTestData() {
    console.log('🧹 清理测试用户的多图转视频数据...\n');
    
    try {
        // 查找测试用户
        const testUser = await User.findOne({ 
            where: { username: 'test' }
        });
        
        if (!testUser) {
            console.log('❌ 未找到测试用户');
            return;
        }
        
        console.log(`📋 测试用户信息:`);
        console.log(`- 用户ID: ${testUser.id}`);
        console.log(`- 用户名: ${testUser.username}`);
        console.log(`- 当前积分: ${testUser.credits}\n`);
        
        // 查找多图转视频功能使用记录
        const usage = await FeatureUsage.findOne({
            where: {
                userId: testUser.id,
                featureName: 'MULTI_IMAGE_TO_VIDEO'
            }
        });
        
        if (usage) {
            console.log(`📊 清理前的功能使用记录:`);
            console.log(`- 使用次数: ${usage.usageCount}`);
            console.log(`- 总积分消费: ${usage.credits}`);
            
            // 解析任务详情
            let details;
            try {
                details = JSON.parse(usage.details || '{}');
            } catch (e) {
                details = { tasks: [] };
            }
            
            console.log(`- 任务数量: ${details.tasks ? details.tasks.length : 0}\n`);
            
            // 重置功能使用记录
            usage.usageCount = 0;
            usage.credits = 0;
            usage.details = JSON.stringify({ tasks: [] });
            await usage.save();
            
            console.log('✅ 已重置功能使用记录');
        } else {
            console.log('📊 未找到多图转视频功能使用记录');
        }
        
        console.log('🎉 测试数据清理完成！\n');
        
    } catch (error) {
        console.error('❌ 清理测试数据时发生错误:', error);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    cleanTestData().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('清理脚本执行失败:', error);
        process.exit(1);
    });
}

module.exports = {
    cleanTestData
};
