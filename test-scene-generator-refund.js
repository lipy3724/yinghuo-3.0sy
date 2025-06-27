/**
 * 场景图生成退款机制测试脚本
 * 
 * 此脚本用于测试场景图生成功能的退款机制是否正常工作
 * 它会模拟一个场景图生成任务，然后触发退款流程
 */

// 导入必要的模块
const { FeatureUsage } = require('./models/FeatureUsage');
const User = require('./models/User');
const { FEATURES } = require('./middleware/featureAccess');
const { sequelize } = require('./config/db');

// 导入退款函数 (确保server.js中的函数已导出)
const { refundSceneGeneratorCredits } = require('./server');

// 测试用户ID (替换为实际存在的用户ID)
const TEST_USER_ID = 1;

// 初始化全局变量
if (!global.sceneGeneratorTasks) {
  global.sceneGeneratorTasks = {};
}

/**
 * 模拟场景图生成任务并测试退款
 */
async function testSceneGeneratorRefund() {
  try {
    console.log('开始测试场景图生成退款机制...');
    
    // 1. 查询测试用户
    const user = await User.findByPk(TEST_USER_ID);
    if (!user) {
      console.error(`未找到ID为${TEST_USER_ID}的测试用户`);
      return;
    }
    
    console.log(`测试用户: ID=${user.id}, 用户名=${user.username}, 当前积分=${user.credits}`);
    
    // 2. 查询或创建功能使用记录
    let usage = await FeatureUsage.findOne({
      where: {
        userId: user.id,
        featureName: 'scene-generator'
      }
    });
    
    if (!usage) {
      console.log('未找到使用记录，创建新记录...');
      usage = await FeatureUsage.create({
        userId: user.id,
        featureName: 'scene-generator',
        usageCount: 0,
        credits: 0,
        details: JSON.stringify({ tasks: [], refunds: [] })
      });
    }
    
    console.log(`功能使用记录: 使用次数=${usage.usageCount}, 积分消费=${usage.credits}`);
    
    // 3. 模拟场景图生成任务
    const taskId = `scene-generator-test-${Date.now()}`;
    const creditCost = FEATURES['scene-generator'].creditCost;
    
    console.log(`创建模拟任务: ID=${taskId}, 积分消费=${creditCost}`);
    
    // 4. 更新用户积分和使用记录
    const originalCredits = user.credits;
    user.credits -= creditCost;
    await user.save();
    
    usage.usageCount += 1;
    usage.credits += creditCost;
    
    // 更新任务详情
    const details = JSON.parse(usage.details || '{}');
    if (!details.tasks) details.tasks = [];
    
    details.tasks.push({
      taskId: taskId,
      creditCost: creditCost,
      isFree: false,
      timestamp: new Date()
    });
    
    usage.details = JSON.stringify(details);
    await usage.save();
    
    // 5. 保存到全局变量
    global.sceneGeneratorTasks[taskId] = {
      userId: user.id,
      creditCost: creditCost,
      hasChargedCredits: true,
      isFree: false,
      timestamp: new Date()
    };
    
    console.log(`模拟任务创建完成，用户积分从${originalCredits}减少到${user.credits}`);
    console.log('任务详情:', global.sceneGeneratorTasks[taskId]);
    
    // 6. 测试退款功能
    console.log('开始测试退款功能...');
    const refundResult = await refundSceneGeneratorCredits(user.id, taskId, '测试退款');
    
    if (refundResult) {
      console.log('退款成功!');
      
      // 7. 验证退款结果
      const updatedUser = await User.findByPk(user.id);
      const updatedUsage = await FeatureUsage.findOne({
        where: {
          userId: user.id,
          featureName: 'scene-generator'
        }
      });
      
      console.log(`退款后用户积分: ${updatedUser.credits} (应该等于原始积分 ${originalCredits})`);
      console.log(`退款后使用次数: ${updatedUsage.usageCount} (应该比原来少1)`);
      
      // 检查退款记录
      const updatedDetails = JSON.parse(updatedUsage.details || '{}');
      const refunds = updatedDetails.refunds || [];
      
      console.log(`退款记录数量: ${refunds.length}`);
      if (refunds.length > 0) {
        console.log('最新退款记录:', refunds[refunds.length - 1]);
      }
      
      // 检查全局变量中的退款标记
      if (global.sceneGeneratorTasks[taskId] && global.sceneGeneratorTasks[taskId].refunded) {
        console.log('全局变量中已正确标记为已退款');
      } else {
        console.error('全局变量中未正确标记为已退款');
      }
    } else {
      console.error('退款失败!');
    }
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    // 关闭数据库连接
    await sequelize.close();
  }
}

// 运行测试
testSceneGeneratorRefund().then(() => {
  console.log('测试完成');
}).catch(err => {
  console.error('测试失败:', err);
}); 