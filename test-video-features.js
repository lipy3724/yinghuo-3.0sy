/**
 * 视频功能扣费逻辑测试脚本
 * 
 * 测试"先使用后扣费"的三个功能：
 * 1. 文生视频 (text-to-video)
 * 2. 图生视频 (image-to-video)
 * 3. 多图转视频 (MULTI_IMAGE_TO_VIDEO)
 */

const { FeatureUsage } = require('./models/FeatureUsage');
const User = require('./models/User');
const { saveTaskDetails } = require('./middleware/unifiedFeatureUsage');

// 连接数据库
require('./config/db');

// 测试用户ID
const TEST_USER_ID = 1; // 请替换为实际存在的用户ID

// 模拟任务信息
const mockTasks = [
  {
    taskId: 'test-text-to-video-' + Date.now(),
    featureName: 'text-to-video',
    status: 'completed',
    isFree: false,
    creditCost: 0, // 初始为0，任务完成后会扣除66积分
    extraData: {
      prompt: '测试文生视频功能'
    }
  },
  {
    taskId: 'test-image-to-video-' + Date.now(),
    featureName: 'image-to-video',
    status: 'completed',
    isFree: false,
    creditCost: 0, // 初始为0，任务完成后会扣除66积分
    extraData: {
      imageUrl: 'https://example.com/test.jpg'
    }
  },
  {
    taskId: 'test-multi-image-to-video-' + Date.now(),
    featureName: 'MULTI_IMAGE_TO_VIDEO',
    status: 'completed',
    isFree: false,
    creditCost: 0, // 初始为0，任务完成后根据时长扣费
    metadata: {
      duration: 45 // 45秒视频，应扣除60积分 (Math.ceil(45/30)*30)
    }
  }
];

/**
 * 测试任务完成后扣费
 */
async function testTaskCompletion() {
  try {
    // 获取测试用户
    const user = await User.findByPk(TEST_USER_ID);
    if (!user) {
      console.error(`测试用户ID ${TEST_USER_ID} 不存在`);
      return;
    }

    console.log(`测试用户: ${user.username}, 当前积分: ${user.credits}`);

    // 遍历测试任务
    for (const task of mockTasks) {
      console.log(`\n测试功能: ${task.featureName}`);
      
      // 查找或创建功能使用记录
      let [usage, created] = await FeatureUsage.findOrCreate({
        where: {
          userId: TEST_USER_ID,
          featureName: task.featureName
        },
        defaults: {
          usageCount: 1,
          lastUsedAt: new Date(),
          resetDate: new Date().toISOString().split('T')[0]
        }
      });

      console.log(`功能使用记录: ${created ? '新创建' : '已存在'}, 使用次数: ${usage.usageCount}`);

      // 保存任务前的用户积分
      const beforeCredits = user.credits;
      console.log(`任务开始前积分: ${beforeCredits}`);

      // 保存任务详情并处理扣费
      await saveTaskDetails(usage, task);

      // 重新获取用户信息，查看积分变化
      await user.reload();
      console.log(`任务完成后积分: ${user.credits}`);
      console.log(`积分变化: ${beforeCredits - user.credits}`);
      
      // 验证扣费是否正确
      let expectedCost = 0;
      if (task.featureName === 'text-to-video' || task.featureName === 'image-to-video') {
        expectedCost = 66;
      } else if (task.featureName === 'MULTI_IMAGE_TO_VIDEO') {
        expectedCost = Math.ceil(task.metadata.duration / 30) * 30;
      }
      
      console.log(`预期扣费: ${expectedCost}, 实际扣费: ${beforeCredits - user.credits}`);
      
      // 重新获取使用记录，查看积分记录是否更新
      await usage.reload();
      console.log(`使用记录中的积分消耗: ${usage.credits || 0}`);
    }

    console.log('\n测试完成!');
  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    // 关闭数据库连接
    process.exit(0);
  }
}

// 执行测试
console.log('开始测试视频功能扣费逻辑...');
testTaskCompletion(); 