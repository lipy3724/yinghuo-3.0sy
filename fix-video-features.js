/**
 * 视频功能扣费逻辑修改脚本
 * 
 * 目标：将以下三个功能修改为"先使用后扣费"的逻辑
 * 1. 文生视频 (text-to-video)
 * 2. 图生视频 (image-to-video)
 * 3. 多图转视频 (MULTI_IMAGE_TO_VIDEO)
 */

const fs = require('fs');
const path = require('path');

// 文件路径
const featureAccessPath = path.join(__dirname, 'middleware', 'featureAccess.js');

// 读取文件
console.log('读取文件:', featureAccessPath);
let content = fs.readFileSync(featureAccessPath, 'utf8');

// 1. 修改功能配置，将固定积分改为函数形式
console.log('修改功能配置...');

// 修改文生视频配置
content = content.replace(
  /'text-to-video':\s*{\s*creditCost:\s*66,\s*freeUsage:\s*1\s*},/,
  `'text-to-video': { 
    creditCost: (payload) => {
      // 返回0，创建阶段不预扣积分，任务完成后再扣费
      return 0;
    }, 
    freeUsage: 1 
  }, // 文生视频功能，任务完成后扣除66积分`
);

// 修改图生视频配置
content = content.replace(
  /'image-to-video':\s*{\s*creditCost:\s*66,\s*freeUsage:\s*1\s*},/,
  `'image-to-video': { 
    creditCost: (payload) => {
      // 返回0，创建阶段不预扣积分，任务完成后再扣费
      return 0;
    }, 
    freeUsage: 1 
  }, // 图生视频功能，任务完成后扣除66积分`
);

// 修改多图转视频配置 - 确保在任务创建阶段返回0
content = content.replace(
  /'MULTI_IMAGE_TO_VIDEO':\s*{\s*creditCost:\s*\([^)]*\)\s*=>\s*{[^}]*},\s*freeUsage:\s*1\s*},/,
  `'MULTI_IMAGE_TO_VIDEO': { 
    creditCost: (payload) => {
      /*
        计算多图转视频积分：
        - 规则：每 30 秒 30 积分，不足 30 秒按 30 秒计。
        - 兼容调用方传入数字 duration，或整个 req.body 对象。
        - 创建阶段返回0，任务完成后再根据实际时长扣费
      */
      return 0; // 创建阶段不扣费
    }, 
    freeUsage: 1 
  }, // 多图转视频 30积分/30秒，任务完成后扣费`
);

// 2. 在功能检查逻辑中添加这三个功能的特殊处理
console.log('修改功能检查逻辑...');

// 查找动态计算积分部分的代码位置
const dynamicCreditSection = content.indexOf('// 动态计算积分的功能');

if (dynamicCreditSection !== -1) {
  // 查找if-else语句的结束位置
  const elseIfPattern = /else if \(featureName === 'VIDEO_SUBTITLE_REMOVER'\) {/;
  const elseIfPosition = content.search(elseIfPattern);
  
  if (elseIfPosition !== -1) {
    // 在VIDEO_SUBTITLE_REMOVER条件前插入新的条件
    const newConditions = `
        else if (featureName === 'text-to-video') {
          // 文生视频功能，在任务完成后扣除积分
          console.log(\`文生视频功能权限检查 - 跳过积分扣除\`);
          creditCost = 20; // 仅检查用户是否有至少20积分，实际不会扣除
        }
        else if (featureName === 'image-to-video') {
          // 图生视频功能，在任务完成后扣除积分
          console.log(\`图生视频功能权限检查 - 跳过积分扣除\`);
          creditCost = 20; // 仅检查用户是否有至少20积分，实际不会扣除
        }
        else if (featureName === 'MULTI_IMAGE_TO_VIDEO') {
          // 多图转视频功能，在任务完成后根据实际时长扣除积分
          console.log(\`多图转视频功能权限检查 - 跳过积分扣除\`);
          creditCost = 30; // 仅检查用户是否有至少30积分，实际不会扣除
        }`;
    
    content = content.slice(0, elseIfPosition) + newConditions + content.slice(elseIfPosition);
  }
}

// 3. 修改unifiedFeatureUsage.js文件，确保任务完成后正确扣费
const unifiedFeatureUsagePath = path.join(__dirname, 'middleware', 'unifiedFeatureUsage.js');
console.log('读取文件:', unifiedFeatureUsagePath);
let usageContent = fs.readFileSync(unifiedFeatureUsagePath, 'utf8');

// 查找任务完成后处理逻辑的位置
const taskCompletionSection = usageContent.indexOf('// 标记任务完成并更新使用记录');
if (taskCompletionSection !== -1) {
  // 查找处理数字人视频功能的代码块
  const digitalHumanSection = usageContent.indexOf('// 如果是数字人视频功能，根据真实时长校正积分');
  
  if (digitalHumanSection !== -1) {
    // 在数字人视频功能处理后添加新的功能处理逻辑
    const newTaskCompletionLogic = `
    // 处理文生视频、图生视频和多图转视频功能的积分扣除
    if (taskInfo.featureName === 'text-to-video' || taskInfo.featureName === 'image-to-video') {
      // 文生视频和图生视频功能固定扣除66积分
      const fixedCost = 66;
      
      // 查找用户
      const user = await User.findByPk(usage.userId);
      if (user) {
        // 扣除积分
        const deduct = Math.min(fixedCost, user.credits);
        user.credits -= deduct;
        await user.save();
        
        // 更新使用记录中的积分消耗
        usage.credits = (usage.credits || 0) + deduct;
        await usage.save();
        
        console.log(\`[任务完成] 已扣除用户 \${usage.userId} 积分 \${deduct} (功能: \${taskInfo.featureName})\`);
      }
    }
    else if (taskInfo.featureName === 'MULTI_IMAGE_TO_VIDEO' && taskInfo.metadata && taskInfo.metadata.duration) {
      // 多图转视频功能根据时长扣除积分：每30秒30积分，不足30秒按30秒计
      const durationSec = parseFloat(taskInfo.metadata.duration);
      if (!isNaN(durationSec) && durationSec > 0) {
        const calculatedCost = Math.ceil(durationSec / 30) * 30;
        
        // 查找用户
        const user = await User.findByPk(usage.userId);
        if (user) {
          // 扣除积分
          const deduct = Math.min(calculatedCost, user.credits);
          user.credits -= deduct;
          await user.save();
          
          // 更新使用记录中的积分消耗
          usage.credits = (usage.credits || 0) + deduct;
          await usage.save();
          
          console.log(\`[任务完成] 已扣除用户 \${usage.userId} 积分 \${deduct} (功能: \${taskInfo.featureName}, 时长: \${durationSec}秒)\`);
        }
      }
    }`;
    
    // 找到合适的插入位置（在数字人视频功能处理后）
    const insertPosition = usageContent.indexOf('}', digitalHumanSection + 100);
    if (insertPosition !== -1) {
      usageContent = usageContent.slice(0, insertPosition + 1) + newTaskCompletionLogic + usageContent.slice(insertPosition + 1);
    }
  }
}

// 保存修改后的文件
fs.writeFileSync(featureAccessPath, content, 'utf8');
console.log('✅ 已保存修改到 featureAccess.js');

fs.writeFileSync(unifiedFeatureUsagePath, usageContent, 'utf8');
console.log('✅ 已保存修改到 unifiedFeatureUsage.js');

// 4. 创建一个修改说明文件
const readmePath = path.join(__dirname, 'VIDEO_FEATURES_UPDATE.md');
const readmeContent = `# 视频功能扣费逻辑更新

## 已修改的功能

以下功能已更新为"先使用后扣费"的逻辑：

1. **文生视频 (text-to-video)**
   - 原逻辑：使用前扣除66积分
   - 新逻辑：创建任务时仅检查用户是否有至少20积分，任务完成后扣除66积分

2. **图生视频 (image-to-video)**
   - 原逻辑：使用前扣除66积分
   - 新逻辑：创建任务时仅检查用户是否有至少20积分，任务完成后扣除66积分

3. **多图转视频 (MULTI_IMAGE_TO_VIDEO)**
   - 原逻辑：使用前根据预估时长扣除积分
   - 新逻辑：创建任务时仅检查用户是否有至少30积分，任务完成后根据实际时长扣除积分（每30秒30积分）

## 实现方式

1. 修改了 \`middleware/featureAccess.js\` 中的功能配置，将积分计算改为在创建阶段返回0
2. 在功能检查逻辑中添加了这三个功能的特殊处理，仅检查最低积分要求
3. 修改了 \`middleware/unifiedFeatureUsage.js\` 中的任务完成处理逻辑，在任务完成后扣除相应积分

## 注意事项

- 请确保任务完成回调机制正常工作，否则可能导致用户使用功能但未被扣费
- 建议监控这些功能的使用情况，确保积分扣除正常
- 如果发现任何问题，可以回滚到之前的扣费逻辑

## 后续优化建议

1. 添加积分预授权机制，在任务创建时锁定一定积分
2. 完善任务失败处理逻辑，明确定义哪些失败情况需要扣费、哪些不需要
3. 添加定时任务检查长时间未完成的任务，避免资源浪费
`;

fs.writeFileSync(readmePath, readmeContent, 'utf8');
console.log('✅ 已创建修改说明文件 VIDEO_FEATURES_UPDATE.md');

console.log('✅ 修改完成！请重启服务器以应用更改。'); 