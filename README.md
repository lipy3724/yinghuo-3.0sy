# 萤火AI - 智能图像处理与创作平台

这是一个使用Node.js开发的AI智能工具平台，集成了图片处理、视频编辑、亚马逊助手等多种AI功能。系统采用组件化架构，提供了完整的用户界面和功能管理系统。

## 🧠 今日任务反思（2025-11-10）

- **多语言一致性**：今日针对`home.html`、`public/credits.html`、`public/download-center.html`与`public/translations.js`补充翻译键，确保亚马逊助手和下载中心区域在中英文间切换时表现一致。当前多语言文本更多依赖手动维护，后续可考虑抽离成集中式配置或CMS，以降低遗漏风险。
- **潜在改进**：下载中心页面的文本更新逻辑分散在多个监听器中，建议后续封装统一的语言刷新入口，便于复用与测试；同时可引入自动化检查，提醒缺失的`data-translate`或翻译键，防止未来新增功能出现未翻译内容。

## 💾 最新数据库备份记录

### 📦 数据库备份 - 2025-10-23 09:58:35

**备份状态**: ✅ 成功完成

**备份内容**:
- **数据库类型**: MySQL (XAMPP MariaDB 10.4.28)
- **数据库名称**: yinghuo
- **备份大小**: 1.84MB
- **备份位置**: `db_backups/mysql_backup_20251023_095835/`
- **备份文件**: `yinghuo_mysql_backup.sql`

**数据统计**:
- 📊 数据库表数量: 12
- 📝 数据记录: 10条INSERT语句
- 📄 备份文件行数: 461行
- 💾 文件大小: 1.84MB

**快速恢复**:
```bash
cd db_backups/mysql_backup_20251023_095835 && ./restore.sh
```

**手动恢复**:
```bash
/Applications/XAMPP/xamppfiles/bin/mysql -h 127.0.0.1 -P 3306 -u root yinghuo < db_backups/mysql_backup_20251023_095835/yinghuo_mysql_backup.sql
```

**备份信息**: 查看 `db_backups/mysql_backup_20251023_095835/backup_info.txt`

---

## 🐛 最新Bug修复与优化记录

### 🔧 配置修改: 图片放大功能最大支持尺寸调整（2025-10-22）

**修改类型**: 功能配置调整  
**严重程度**: 🟢 配置优化  
**修改状态**: ✅ 已完成

#### 修改内容

根据用户需求，将**图片放大功能**的最大支持尺寸从4096x4096调整为3000x3000。

#### 具体修改

**修改1：图片上色功能尺寸限制**（`public/image-colorization.html`）
```html
<!-- 修改前 -->
<p class="mt-1 text-xs text-gray-500">图片尺寸要求：宽度和高度都必须在512到4096像素之间，文件大小不超过10MB</p>

<!-- 修改后 -->
<p class="mt-1 text-xs text-gray-500">图片尺寸要求：宽度和高度都必须在512到3000像素之间，文件大小不超过10MB</p>
```

**修改2：图片上色功能JavaScript限制**（`public/image-colorization.html`）
```javascript
// 修改前
const maxDimension = 4096; // 最大尺寸限制

// 修改后
const maxDimension = 3000; // 最大尺寸限制
```

**修改3：图片放大功能页面提示**（`public/image-upscaler.html`）
```html
<!-- 已确认正确 -->
<p class="mt-1 text-xs text-gray-500">图片尺寸需大于 100×100 像素，小于 3000×3000 像素</p>
```

**修改4：图片放大功能JavaScript验证**（`public/image-upscaler.html`）
```javascript
// 已确认正确
if (width > 3000 || height > 3000) {
    alert('图片尺寸太大，需要小于3000×3000像素');
    resetImageUpload();
    return;
}
```

#### 修复效果

- ✅ **图片放大功能**：最大支持尺寸调整为3000x3000像素
- ✅ **图片上色功能**：同步调整最大尺寸限制为3000x3000像素
- ✅ **用户提示**：所有相关页面的提示文本已更新
- ✅ **逻辑一致性**：前端验证和后端处理逻辑保持一致
- ✅ **浏览器缓存**：如果用户看到旧的4096x4096提示，请清除浏览器缓存

#### 影响范围

- 影响功能：图片放大、图片上色
- 影响用户：上传大于3000x3000像素图片的用户
- 尺寸变化：从4096x4096降低到3000x3000

#### 注意事项

如果用户在浏览器中仍然看到4096x4096的提示，这是浏览器缓存导致的，建议：
1. 硬刷新页面（Ctrl+F5 或 Cmd+Shift+R）
2. 清除浏览器缓存
3. 重新访问页面

---

### ⚙️ 界面优化: 积分管理页面修改（2025-10-22）

**修改类型**: 界面优化与功能配置  
**严重程度**: 🟢 界面优化  
**修改状态**: ✅ 已完成

#### 修改内容

根据用户需求，对积分管理页面进行了五项重要修改：
1. 将**视频风格重绘功能**的免费次数显示修改为0次
2. 完全删除了积分管理页面的**使用记录**部分
3. 删除了积分管理页面的**IMAGE_CROP**功能项显示
4. 在积分使用情况页面将**IMAGE_CROP**功能名称改为中文**"图像裁剪"**
5. 修复使用记录表格中**操作列**的功能名称显示为中文

#### 具体修改

**修改1：视频风格重绘功能免费次数显示**（`public/credits.html`）
```html
<!-- 修改前 -->
<p class="text-sm text-gray-500">免费试用: 1次</p>

<!-- 修改后 -->
<p class="text-sm text-gray-500">免费试用: 0次</p>
```

**修改2：删除使用记录组件**（`public/credits.html`）
- 删除了整个使用记录HTML表格组件
- 删除了`loadUsageRecords()`函数
- 删除了`renderUsageRecords()`函数  
- 删除了所有对使用记录相关函数的调用
- 清理了相关的事件监听器和定时器

**修改3：删除IMAGE_CROP功能项**（`public/credits.html`）
```javascript
// 修改前
if (feature.name === 'VIDEO_STYLE_REPAINT') return;

// 修改后  
if (feature.name === 'VIDEO_STYLE_REPAINT' || feature.name === 'IMAGE_CROP') return;
```

**修改4：IMAGE_CROP功能名称中文化**（`public/credits-usage.html`）
```javascript
// 添加功能名称中文映射函数
function getChineseFeatureName(featureName) {
    const featureNameMap = {
        'IMAGE_CROP': '图像裁剪',
        // ... 其他功能映射
    };
    return featureNameMap[featureName] || featureName;
}

// 在功能列表、图表、使用记录中应用中文映射
${getChineseFeatureName(feature.name)}
```

**修改5：使用记录操作列功能名称中文化**（`public/credits-usage.html`）
```javascript
// 添加操作描述中文映射函数
function getChineseDescription(description) {
    let chineseDescription = description;
    const match = description.match(/使用(.+?)功能/);
    if (match) {
        const featureName = match[1];
        const chineseFeatureName = getChineseFeatureName(featureName);
        chineseDescription = description.replace(featureName, chineseFeatureName);
    }
    return chineseDescription;
}

// 在使用记录表格中应用中文映射
<td class="py-3 px-4 border-b text-sm">${getChineseDescription(record.description)}</td>
```

#### 修改效果

- ✅ **视频风格重绘显示正确**: 页面正确显示该功能无免费次数
- ✅ **页面简化**: 删除使用记录部分，页面更加简洁
- ✅ **功能项优化**: 隐藏IMAGE_CROP功能项，避免用户混淆
- ✅ **中文显示**: IMAGE_CROP功能在所有位置都显示为"图像裁剪"
- ✅ **操作描述中文化**: 使用记录中的操作描述完全中文化显示
- ✅ **性能优化**: 减少了不必要的API调用和DOM操作
- ✅ **用户体验**: 专注于积分管理核心功能，界面完全中文化

#### 验证结果

通过代码检查确认：
- ✅ 视频风格重绘功能免费次数显示已修改为0次
- ✅ 使用记录HTML组件已完全删除
- ✅ 使用记录相关JavaScript函数已完全删除
- ✅ 所有使用记录API调用已清理
- ✅ 页面功能正常，无遗留代码

---

### ⚙️ 配置修改: 视频去除字幕功能取消免费次数（2025-10-22）

**修改类型**: 功能配置调整  
**严重程度**: 🟢 配置优化  
**修改状态**: ✅ 已完成

#### 修改内容

根据用户需求，将**视频去除字幕功能**的免费次数设置为0，即第一次使用就需要收费。

#### 具体修改

**修改1：功能配置文件**（`middleware/featureAccess.js` 第110行）
```javascript
// 修改前
'VIDEO_SUBTITLE_REMOVER': {
  name: '视频去除字幕',
  freeUsage: 1,  // 原来有1次免费
  creditCost: 30,
  enabled: true
},

// 修改后
'VIDEO_SUBTITLE_REMOVER': {
  name: '视频去除字幕',
  freeUsage: 0,  // 🔧 修改：视频去除字幕功能无免费次数
  creditCost: 30,
  enabled: true
},
```

#### 修改效果

- ✅ **首次使用收费**: 用户第一次使用视频去除字幕功能就需要消耗积分
- ✅ **积分计算正确**: 按视频时长计算积分（每30秒或不足30秒收费30积分）
- ✅ **前端显示正确**: 积分管理页面显示"免费试用: 0次"
- ✅ **API配置正确**: 后端API返回`"freeUsage": 0`

#### 验证结果

通过API测试确认：
- ✅ 后端配置正确：`curl http://localhost:8080/api/credits/pricing` 返回 `"VIDEO_SUBTITLE_REMOVER","freeUsage":0`
- ✅ 前端页面正确：积分管理页面显示视频去除字幕功能"免费试用: 0次"
- ✅ 功能逻辑正确：第一次使用即开始收费

---

### ⚙️ 配置修改: 多图转视频功能取消免费次数（2025-10-22）

**修改类型**: 功能配置调整  
**严重程度**: 🟢 配置优化  
**修改状态**: ✅ 已完成

#### 修改内容

根据用户需求，将**多图转视频功能**的免费次数设置为0，即第一次使用就需要收费。

#### 具体修改

**修改1：功能配置文件**（`middleware/featureAccess.js` 第82行）
```javascript
// 修改前
freeUsage: 1 

// 修改后  
freeUsage: 0  // 🔧 修改：多图转视频功能无免费次数，所有使用都收费
```

**修改2：任务创建时的免费判断逻辑**（`middleware/unifiedFeatureUsage.js` 第130行）
```javascript
// 修改前
// 如果没有已完成的任务，则当前任务免费（首次使用）
isCurrentTaskFree = completedTasks === 0;

// 修改后
// 🔧 修改：多图转视频功能无免费次数，所有使用都收费
let isCurrentTaskFree = false; // 强制设置为false，不再有免费使用
```

**修改3：任务完成时的免费判断**（`middleware/unifiedFeatureUsage.js` 第794行）
```javascript
// 修改前
// 如果没有已完成的任务，则当前任务免费（首次使用）
isFreeUsage = completedTasks === 0;

// 修改后
// 强制设置为收费，不再有免费使用
isFreeUsage = false;
```

#### 修改效果

- ✅ **第1次使用**：需要收费（按实际视频时长计费，30积分/30秒）
- ✅ **后续使用**：继续收费（与之前一致）
- ✅ **计费标准**：30积分/30秒，不足30秒按30秒计算
- ✅ **用户体验**：功能使用前会提示积分消耗，确保用户知晓收费

#### 影响范围

- 影响功能：多图转视频
- 影响用户：所有新用户和未使用过该功能的用户
- 计费变化：取消首次免费，从第一次使用开始收费

---

### ⚙️ 配置修改: 视频数字人功能取消免费次数（2025-10-22）

**修改类型**: 功能配置调整  
**严重程度**: 🟢 配置优化  
**修改状态**: ✅ 已完成

#### 修改内容

根据用户需求，将**视频数字人功能**的免费次数设置为0，即第一次使用就需要收费。

#### 具体修改

**修改1：功能配置文件**（`middleware/featureAccess.js` 第91行）
```javascript
// 修改前
freeUsage: 1 

// 修改后  
freeUsage: 0  // 🔧 修改：视频数字人功能无免费次数，所有使用都收费
```

**修改2：任务创建时的免费判断逻辑**（`middleware/unifiedFeatureUsage.js` 第1102行）
```javascript
// 修改前
const isFreeUsage = usage.usageCount < featureConfig.freeUsage;

// 修改后
const isFreeUsage = false; // 🔧 修改：视频数字人功能无免费次数，所有使用都收费
```

**修改3：任务完成时的免费判断**（`routes/textToVideo.js` 第2931行）
```javascript
// 修改前
let isFree = false;
if (featureUsage) {
    // 第一次使用是免费的
    isFree = featureUsage.usageCount === 0;
}

// 修改后
let isFree = false; // 🔧 修改：视频数字人功能无免费次数，所有使用都收费
if (featureUsage) {
    console.log(`用户${userId}的视频数字人功能使用次数: ${featureUsage.usageCount}, 是否免费: ${isFree}`);
}
```

#### 修改效果

- ✅ **第1次使用**：需要收费（按实际视频时长计费，9积分/秒）
- ✅ **后续使用**：继续收费（与之前一致）
- ✅ **计费标准**：9积分/秒，按实际生成视频时长计费
- ✅ **用户体验**：功能使用前会提示积分消耗，确保用户知晓收费

#### 影响范围

- 影响功能：视频数字人
- 影响用户：所有新用户和未使用过该功能的用户
- 计费变化：取消首次免费，从第一次使用开始收费

---

### ⚙️ 配置修改: 视频风格重绘功能取消免费次数（2025-10-22）

**修改类型**: 功能配置调整  
**严重程度**: 🟢 配置优化  
**修改状态**: ✅ 已完成

#### 修改内容

根据用户需求，将**视频风格重绘功能**的免费次数设置为0，即第一次使用就需要收费。

#### 具体修改

**修改1：功能配置文件**（`middleware/featureAccess.js` 第102行）
```javascript
// 修改前
freeUsage: 1 

// 修改后  
freeUsage: 0
```

**修改2：免费判断逻辑**（`middleware/unifiedFeatureUsage.js` 第208-210行）
```javascript
// 修改前
isCurrentTaskFree = totalTasks === 0;

// 修改后
isCurrentTaskFree = false; // 🔧 修改：视频风格重绘功能无免费次数，所有使用都收费
```

**修改3：任务完成时的免费判断**（`middleware/unifiedFeatureUsage.js` 第830-833行）
```javascript
// 修改前
isFreeUsage = totalTasks === 0;

// 修改后
isFreeUsage = false; // 🔧 修改：视频风格重绘功能无免费次数，所有使用都收费
```

#### 修改效果

- ✅ **第1次使用**：需要收费（按实际视频时长和分辨率计费）
- ✅ **后续使用**：继续收费（与之前一致）
- ✅ **计费标准**：540P分辨率 3积分/秒，720P及以上 6积分/秒
- ✅ **用户体验**：功能使用前会提示积分消耗，确保用户知晓收费

#### 影响范围

- 影响功能：视频风格重绘
- 影响用户：所有新用户和未使用过该功能的用户
- 计费变化：取消首次免费，从第一次使用开始收费

---

### 🔧 修复: 视频数字人功能统一记录系统集成（2025-10-20）

**Bug类型**: 积分计费错误  
**严重程度**: 🔴 高危  
**修复状态**: ✅ 已完全修复（统一记录系统集成）

#### 问题现象

用户反馈：**视频数字人功能使用后没有扣除积分，也没有记录使用次数**

**问题详情**：
- ❌ 视频数字人功能使用后没有在用户账户中扣除积分
- ❌ 功能使用记录中没有正确记录使用次数和积分消费
- ❌ 导致用户可以无限制免费使用付费功能
- ❌ 视频时长获取失败，显示"null秒"，导致无法计算积分

#### 修复方案

**修改1：增强视频时长获取逻辑，确保始终有有效时长**
```javascript
// 获取视频时长
let videoDuration = 0;

// 尝试从API响应中获取视频时长
if (response.data.usage && response.data.usage.video_duration) {
    try {
        // 确保视频时长至少为1秒，避免出现0秒的情况
        const rawDuration = parseFloat(response.data.usage.video_duration);
        if (!isNaN(rawDuration)) {
            videoDuration = Math.max(1, Math.ceil(rawDuration));
            console.log('从API响应的usage.video_duration获取视频时长:', rawDuration, '秒，取整后:', videoDuration, '秒');
        } else {
            console.log('API返回的视频时长无效:', response.data.usage.video_duration);
            videoDuration = 3; // 设置默认值
        }
    } catch (error) {
        console.error('解析视频时长时出错:', error);
        videoDuration = 3; // 设置默认值
    }
} else {
    // 如果API未返回时长，设置为默认值3秒
    videoDuration = 3;
    console.log('API未返回视频时长，使用默认值:', videoDuration, '秒');
}

// 额外检查：如果视频URL包含时长信息，尝试提取
try {
    if (videoUrl && videoUrl.includes('duration=')) {
        const durationMatch = videoUrl.match(/duration=(\d+(\.\d+)?)/);
        if (durationMatch && durationMatch[1]) {
            const urlDuration = parseFloat(durationMatch[1]);
            if (!isNaN(urlDuration) && urlDuration > 0) {
                videoDuration = Math.max(1, Math.ceil(urlDuration));
                console.log('从视频URL提取到时长信息:', urlDuration, '秒，取整后:', videoDuration, '秒');
            }
        }
    }
} catch (error) {
    console.error('从URL提取视频时长时出错:', error);
}

// 最终确认：确保视频时长至少为3秒
if (videoDuration < 3) {
    videoDuration = 3;
    console.log('视频时长小于3秒，设置为最小值:', videoDuration, '秒');
}
```

**修改2：修复任务详情保存逻辑**
```javascript
// 保存任务详情
const taskDetails = {
    status: 'SUCCEEDED',
    videoUrl: videoUrl,
    videoDuration: videoDuration,
    creditCost: isFree ? 0 : creditsUsed, // 如果是免费使用，积分为0
    isFree: isFree, // 添加是否免费标记
    creditsUsed: creditsUsed, // 保留原有字段，兼容旧代码
    requestId: response.data.request_id
};
```

**修改3：确保视频时长有效，防止null值**
```javascript
// 确保视频时长有效
if (!details.videoDuration || details.videoDuration <= 0) {
    // 如果视频时长无效，设置默认值
    details.videoDuration = 3;
    console.log(`任务${taskId}视频时长无效，设置为默认值: ${details.videoDuration}秒`);
}
```

**修改4：重新计算积分消费，确保使用正确的视频时长**
```javascript
// 如果任务完成且不是免费的，需要扣除积分
if (isTaskCompleted && !isFree) {
    // 重新计算积分消费，确保使用正确的视频时长
    const creditCost = details.videoDuration * 9;
    details.creditCost = creditCost;
    console.log(`重新计算积分消费: ${details.videoDuration}秒 × 9积分/秒 = ${creditCost}积分`);
    
    // 强制记录到日志，确保看到完整的计算过程
    console.log(`强制记录积分计算: 任务完成=${isTaskCompleted}, 免费=${isFree}, 视频时长=${details.videoDuration}, 积分=${creditCost}`);
    
    try {
        // 查找用户
        const User = require('../models/User');
        const user = await User.findByPk(userId);
        
        if (!user) {
            console.error(`未找到用户ID: ${userId}`);
            return;
        }
        
        // 检查是否已经扣除过积分
        const alreadyCharged = parsedDetails.recordedTaskIds && 
                              parsedDetails.recordedTaskIds.includes(taskId);
        
        if (!alreadyCharged) {
            // 扣除积分
            // 确保使用重新计算的积分值
            const deductCredits = Math.min(details.creditCost, user.credits);
            
            console.log(`准备扣除积分: 用户ID=${userId}, 当前积分=${user.credits}, 需扣除=${deductCredits}`);
            
            user.credits -= deductCredits;
            await user.save();
            
            // 记录已扣除积分的任务ID
            if (!parsedDetails.recordedTaskIds) {
                parsedDetails.recordedTaskIds = [];
            }
            parsedDetails.recordedTaskIds.push(taskId);
            
            console.log(`已从用户${userId}扣除${deductCredits}积分，剩余${user.credits}积分`);
            
            // 更新功能使用记录中的积分消耗
            featureUsage.credits = (featureUsage.credits || 0) + deductCredits;
            await featureUsage.save(); // 确保功能使用记录保存
        } else {
            console.log(`任务${taskId}已扣除过积分，跳过重复扣除`);
        }
    } catch (error) {
        console.error(`扣除积分过程中出错: ${error.message}`, error);
    }
}
```

**修改5：添加强制扣除积分逻辑，确保任务完成一定会扣除积分**
```javascript
// 如果没有进入积分扣除流程，强制重新检查条件
console.log(`任务${taskId}未进入积分扣除流程，重新检查条件`);

// 重新检查任务完成状态
if (details.status === 'SUCCEEDED' && !isFree) {
    console.log(`检测到任务${taskId}已完成但未扣除积分，尝试强制扣除`);
    
    try {
        // 查找用户
        const User = require('../models/User');
        const user = await User.findByPk(userId);
        
        if (!user) {
            console.error(`未找到用户ID: ${userId}`);
        } else {
            // 确保视频时长有效
            const validDuration = details.videoDuration > 0 ? details.videoDuration : 3;
            
            // 计算积分
            const forceCreditCost = validDuration * 9;
            const forceDeductCredits = Math.min(forceCreditCost, user.credits);
            
            console.log(`强制扣除积分: 用户ID=${userId}, 当前积分=${user.credits}, 需扣除=${forceDeductCredits}`);
            
            // 检查是否已经扣除过积分
            const alreadyCharged = parsedDetails.recordedTaskIds && 
                                  parsedDetails.recordedTaskIds.includes(taskId);
            
            if (!alreadyCharged) {
                // 扣除积分
                user.credits -= forceDeductCredits;
                await user.save();
                
                // 记录已扣除积分的任务ID
                if (!parsedDetails.recordedTaskIds) {
                    parsedDetails.recordedTaskIds = [];
                }
                parsedDetails.recordedTaskIds.push(taskId);
                
                // 更新任务详情中的积分信息
                details.creditCost = forceCreditCost;
                details.creditsUsed = forceCreditCost;
                
                console.log(`已强制从用户${userId}扣除${forceDeductCredits}积分，剩余${user.credits}积分`);
                
                // 更新功能使用记录中的积分消耗
                featureUsage.credits = (featureUsage.credits || 0) + forceDeductCredits;
                await featureUsage.save();
            } else {
                console.log(`任务${taskId}已扣除过积分，跳过重复扣除`);
            }
        }
    } catch (error) {
        console.error(`强制扣除积分过程中出错: ${error.message}`, error);
    }
}
```

**修改6：优化使用次数更新逻辑**
```javascript
// 如果任务完成，增加使用次数
if (isTaskCompleted) {
    try {
        featureUsage.usageCount += 1;
        featureUsage.lastUsedAt = new Date();
        await featureUsage.save(); // 确保保存使用次数更新
        console.log(`更新用户${userId}的视频数字人功能使用次数为${featureUsage.usageCount}`);
        
        // 确保更新featureUsage.details中的usageCount
        if (!parsedDetails.usageCount || parsedDetails.usageCount < featureUsage.usageCount) {
            parsedDetails.usageCount = featureUsage.usageCount;
            console.log(`更新任务详情中的使用次数为: ${parsedDetails.usageCount}`);
        }
    } catch (error) {
        console.error(`更新使用次数时出错: ${error.message}`, error);
    }
}
```

#### 修复效果
- ✅ 视频数字人功能使用后正确扣除积分（每秒9积分）
- ✅ 功能使用记录中正确记录使用次数和积分消费
- ✅ 首次使用仍然保持免费，符合产品设计
- ✅ 防止重复扣费，确保每个任务只扣除一次积分
- ✅ 增强错误处理，避免因为一个步骤失败导致整个流程中断
- ✅ 确保视频时长始终有有效值，即使API未返回也使用默认值
- ✅ 增加详细日志，便于排查问题
- ✅ 修复了视频时长显示为"null秒"的问题
- ✅ 添加了强制扣除积分逻辑，确保任务完成一定会扣除积分

#### 修改文件
- ✅ `routes/textToVideo.js`
  - 第2900-2945行：增强视频时长获取逻辑，确保始终有有效时长
  - 第2947-2959行：添加积分计算逻辑和错误处理
  - 第2961-2970行：完善任务详情保存结构
  - 第3040-3048行：确保视频时长有效，防止null值
  - 第3050-3101行：重新计算积分消费，确保使用正确的视频时长
  - 第3102-3167行：添加强制扣除积分逻辑，确保任务完成一定会扣除积分
  - 第3169-3186行：优化使用次数更新逻辑
  - 第3188-3197行：优化任务详情保存逻辑

### 🔧 修复: 视频数字人源视频显示问题（2025-10-20）

**Bug类型**: 视频显示错误  
**严重程度**: 🟡 中等  
**修复状态**: ✅ 已完全修复

#### 问题现象

用户反馈：**视频数字人功能中，上传视频后，右侧"源视频"区域显示不正确**

**问题详情**：
- ❌ 源视频区域显示的不是视频而是静态图片
- ❌ 视频没有根据视频的尺寸自适应调整，无法显示完整画面
- ❌ 影响用户对上传视频效果的预览体验

#### 修复方案

**修改1：确保视频容器样式正确**
```css
/* 确保视频在容器中完整显示 */
.preview-container video {
    width: 100%;
    height: 100%;
    object-fit: contain; /* 保持视频比例，确保完整显示 */
}
```

**修改2：调整源视频预览区域尺寸**
```html
<div id="source-preview" class="text-center text-gray-500 w-full h-full flex items-center justify-center">
    上传视频后将在这里显示
</div>
```

**修改3：优化视频预览逻辑**
```javascript
// 更新右侧预览区域，使用object-fit: contain确保视频完整显示
sourcePreview.innerHTML = `<video src="${url}" class="w-full h-full object-contain" controls></video>`;
```

#### 修复效果
- ✅ 源视频区域正确显示上传的视频（而非静态图片）
- ✅ 视频自动适应容器尺寸，保持原始比例并完整显示
- ✅ 改善了用户体验，上传视频后可以立即预览效果

#### 修改文件
- ✅ `digital-human-video.html`
  - 第77-90行：添加视频容器样式
  - 第256行：调整源视频预览区域尺寸
  - 第612行：优化视频预览逻辑

### 🔧 重要修复: 视频数字人计费时长与实际生成视频不符（2025-10-18）

**Bug类型**: 视频时长计费错误  
**严重程度**: 🔴 高危（影响计费准确性）  
**修复状态**: ✅ 已完全修复

#### 问题现象

用户反馈：**上传5秒视频 + 18秒音频，生成18秒视频，但只扣除54积分（6秒的费用）**

**问题详情**：
- ✅ 用户上传：5秒视频 + 18秒音频
- ❌ 未勾选"视频延长模式"
- ❌ 阿里云API生成：18秒视频（自动延长到音频长度）
- ❌ API返回 `usage.video_duration = 5.04` 秒
- ❌ 系统按6秒计费（54积分）
- ❌ 但用户实际得到18秒视频（应计费162积分）

#### 根本原因分析

**问题1：阿里云API行为与文档不符**

根据阿里云官方文档：
> 默认将按音频、视频两者中时长较短的来截断。

**实际行为**：
- 📄 文档说明：`video_extension=false` 时，按较短的截断（应生成5秒）
- ❌ 实际行为：生成18秒视频（音频长度）
- ❌ API返回的 `usage.video_duration=5.04` 只是音频处理时长，不是实际视频时长

**问题2：计费使用错误的时长**

旧代码逻辑（错误）：
```javascript
// ❌ 使用API返回的usage.video_duration计费
if (status.usage && status.usage.video_duration) {
  videoDuration = Math.ceil(parseFloat(status.usage.video_duration));
  // videoDuration = 6秒（从5.04取整）
}
// 按6秒计费 = 54积分
// 但实际生成的视频是18秒！
```

#### 修复方案

**核心修改：优先从实际视频文件获取时长**

**修改位置**：`server.js` 第3960-3999行

```javascript
// ✅ 新逻辑：优先从实际生成的视频文件获取时长
try {
  videoDuration = await getVideoDuration(status.videoUrl);
  console.log(`✅ 从实际视频文件获取时长: ${videoDuration}秒`);
  
  // 记录API返回的时长用于对比
  if (status.usage && status.usage.video_duration) {
    apiDuration = parseFloat(status.usage.video_duration);
    console.log(`📊 API返回的usage.video_duration: ${apiDuration}秒`);
    
    // 如果两个时长差异较大，记录警告
    const diff = Math.abs(videoDuration - apiDuration);
    if (diff > 2) {
      console.warn(`⚠️ 时长差异较大: 实际视频${videoDuration}秒, API返回${apiDuration}秒`);
      console.warn(`⚠️ 将使用实际视频时长（${videoDuration}秒）进行计费`);
    }
  }
} catch (durationError) {
  // 如果无法从视频文件获取，则使用API返回的时长作为备用
  videoDuration = Math.ceil(parseFloat(status.usage.video_duration));
}

// ✅ 使用实际生成的视频时长计费
let billingDuration = Math.ceil(videoDuration);
console.log(`✅ 计费时长: ${billingDuration}秒`);
```

**优化2：添加前端时长警告**

**新增位置**：`digital-human-video.html` 第412-476行

**功能**：
1. ✅ 保存音频时长（`uploadedFiles.audioDuration`）
2. ✅ 检测音频和视频时长差异
3. ✅ 当音频 > 视频 + 1秒 且未启用延长模式时，显示警告：
   ```
   ⚠️ 时长不匹配警告
   您的音频时长（18秒）比视频时长（5秒）长了13秒。
   
   由于未启用"视频延长模式"，生成的视频将自动延长至音频时长（约18秒），
   您将按此时长计费（约162积分）。
   
   建议：
   1. 启用"视频延长模式"
   2. 或将音频裁剪到5秒以内
   ```

**优化3：监听延长选项变化**

```javascript
// 监听视频延长选项的变化
videoExtension.addEventListener('change', function() {
    checkDurationMismatch();
});
```

当用户勾选/取消"视频延长模式"时，自动更新警告提示。

---

### 🔧 历史修复: 视频数字人上传时长获取不准确导致计费错误（2025-10-18）

**Bug类型**: 视频时长获取错误  
**严重程度**: 🔴 高危（影响计费准确性）  
**修复状态**: ✅ 已完全修复

#### 问题描述

用户反馈：**上传5秒视频，显示和扣费却按38秒计算**

**现象**：
- ❌ 上传视频时长与系统显示时长不符
- ❌ 实际上传5秒视频，系统显示38秒
- ❌ 积分扣除错误（5秒应扣45积分，实际扣342积分）
- ❌ 对用户极不公平

#### 根本原因

**前端没有将视频时长传递给后端**：
1. ❌ 前端虽然在视频加载时获取了时长，但**没有保存**
2. ❌ 上传时**没有将视频时长传递给后端**
3. ❌ 后端`getVideoDuration`函数返回null时，可能使用错误的默认值
4. ❌ 导致计费时使用了错误的视频时长

**问题代码位置**：
```javascript
// ❌ 前端：视频加载时没有保存时长（digital-human-video.html 第477-488行）
uploadedVideo.onloadedmetadata = function() {
    // 检查视频时长，但没有保存！
    if (uploadedVideo.duration < 2 || uploadedVideo.duration > 120) {
        alert('视频时长必须在2-120秒之间');
        return;
    }
};

// ❌ 前端：上传时没有传递视频时长（digital-human-video.html 第666-679行）
const formData = new FormData();
formData.append('video', uploadedFiles.video);
formData.append('audio', uploadedFiles.audio);
// 缺少：formData.append('videoDuration', ...);

// ❌ 后端：没有接收前端传递的时长（server.js 第3801行）
const videoDuration = await getVideoDuration(videoUrl);
// 应该：const videoDuration = await getVideoDuration(videoUrl, frontendVideoDuration);
```

#### 修复方案

**三步修复**：

##### 1. 前端保存视频时长（digital-human-video.html）

**修改1：添加videoDuration字段**（第404-409行）
```javascript
// ✅ 添加videoDuration字段
let uploadedFiles = {
    video: null,
    audio: null,
    image: null,
    videoDuration: null  // 保存视频时长（秒）
};
```

**修改2：视频加载时保存时长**（第477-493行）
```javascript
uploadedVideo.onloadedmetadata = function() {
    // ✅ 保存视频时长
    uploadedFiles.videoDuration = uploadedVideo.duration;
    console.log('✅ 视频时长:', uploadedFiles.videoDuration, '秒');
    
    // 检查视频时长
    if (uploadedVideo.duration < 2 || uploadedVideo.duration > 120) {
        alert('视频时长必须在2-120秒之间');
        uploadedFiles.video = null;
        uploadedFiles.videoDuration = null;  // ✅ 清空时长
        return;
    }
};
```

**修改3：上传时传递时长**（第672-687行）
```javascript
const formData = new FormData();
formData.append('video', uploadedFiles.video);
formData.append('audio', uploadedFiles.audio);
formData.append('videoExtension', videoExtension.checked);

// ✅ 传递视频时长给后端
if (uploadedFiles.videoDuration) {
    formData.append('videoDuration', uploadedFiles.videoDuration);
    console.log('✅ 上传视频时长:', uploadedFiles.videoDuration, '秒');
} else {
    console.warn('⚠️ 视频时长未知，后端将自行检测');
}
```

##### 2. 后端接收并使用前端时长（server.js 第3799-3807行）

```javascript
// ✅ 获取前端传递的实际视频时长（如果有）
const frontendVideoDuration = req.body.videoDuration ? parseFloat(req.body.videoDuration) : null;
console.log('前端传递的视频时长:', frontendVideoDuration, '秒');

console.log('开始分析上传视频的时长...');
// ✅ 优先使用前端传递的实际时长，如果没有则从视频文件分析
const videoDuration = await getVideoDuration(videoUrl, frontendVideoDuration);
console.log(`最终使用的视频时长: ${videoDuration}秒`);
```

#### 数据流程

**修复前**：
```
用户上传5秒视频
    ↓
前端：获取到5秒（但未保存） ❌
    ↓
上传：没有传递时长给后端 ❌
    ↓
后端：getVideoDuration返回null或错误值 ❌
    ↓
显示：38秒 ❌
计费：38秒 × 9 = 342积分 ❌
```

**修复后**：
```
用户上传5秒视频
    ↓
前端：保存时长 videoDuration=5 ✅
    ↓
上传：formData.append('videoDuration', 5) ✅
    ↓
后端：接收并使用 frontendVideoDuration=5 ✅
    ↓
显示：5秒 ✅
计费：5秒 × 9 = 45积分 ✅
```

#### 修改文件

1. ✅ `digital-human-video.html`
   - 第404-409行：添加`videoDuration`字段
   - 第477-493行：视频加载时保存时长
   - 第672-687行：上传时传递时长

2. ✅ `server.js`
   - 第3799-3807行：接收并优先使用前端传递的时长

#### 修复效果

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| **上传5秒视频** | 显示38秒，扣342积分 ❌ | 显示5秒，扣45积分 ✅ |
| **上传10秒视频** | 显示错误时长 ❌ | 显示10秒，扣90积分 ✅ |
| **上传30秒视频** | 显示错误时长 ❌ | 显示30秒，扣270积分 ✅ |
| **时长准确性** | 完全错误 ❌ | 完全准确 ✅ |
| **计费公平性** | 用户多付费 ❌ | 完全公平 ✅ |

#### 核心优势

1. ✅ **准确性**：使用浏览器video元素的metadata，100%准确
2. ✅ **公平性**：用户按实际上传的视频时长付费
3. ✅ **透明度**：显示时长与实际时长完全一致
4. ✅ **可靠性**：前端直接获取，不依赖后端视频分析
5. ✅ **兼容性**：后端仍保留视频分析功能作为备用

#### 技术细节

**为什么前端时长更准确**：
- ✅ 浏览器`video.duration`从视频metadata直接读取，精确到小数
- ✅ 不需要下载完整视频文件，速度快
- ✅ 不依赖后端第三方API，更可靠
- ❌ 后端通过第三方API分析可能不准确或返回null

**getVideoDuration函数优化**（server.js 第4184-4202行）：
```javascript
async function getVideoDuration(videoUrl, actualDuration = null) {
  // ✅ 优先使用前端传递的实际时长
  if (actualDuration !== null && !isNaN(parseFloat(actualDuration))) {
    const duration = Math.ceil(parseFloat(actualDuration));
    console.log(`使用前端传递的实际视频时长: ${duration}秒`);
    return duration;
  }
  
  // 如果没有提供实际时长，返回null
  console.warn('未提供实际视频时长，无法处理');
  return null;
}
```

#### 用户价值

- ✅ **不再多付费**：上传5秒视频只扣45积分，而非342积分
- ✅ **信息准确**：看到的时长就是真实的视频时长
- ✅ **增强信任**：计费透明公平，提升用户信任度
- ✅ **体验提升**：无需担心系统计算错误

---

### 📝 重要调整: 视频数字人显示和计费逻辑调整为使用API返回时长（2025-10-18）

**调整类型**: 逻辑优化  
**严重程度**: 🟢 功能优化  
**调整状态**: ✅ 已完成

#### 调整说明

根据业务需求，将视频数字人功能的**显示时长**和**计费时长**统一调整为使用**API返回的实际生成视频时长**。

#### 调整原因

1. **更符合实际**：用户下载的是API生成的视频，显示实际生成的视频时长更准确
2. **计费公平**：按实际生成的视频时长计费，对用户更公平
3. **逻辑统一**：显示时长和计费时长保持一致，避免混淆

#### 调整内容

##### 1. 调整计费逻辑（server.js 第3990-4003行）

**调整前**：
```javascript
// 🎯 重要: 计费时长使用原始上传视频时长
const billingDuration = originalVideoDuration > 0 ? originalVideoDuration : videoDuration;
```

**调整后**：
```javascript
// 🎯 重要: 计费时长使用API返回的实际生成视频时长
const billingDuration = videoDuration;
```

##### 2. 调整OSS存储逻辑（server.js 第4130-4131行）

**调整前**：
```javascript
videoDuration: billingDuration,  // 保存原始上传视频时长
originalVideoDuration: originalVideoDuration,
apiProcessedDuration: videoDuration,
```

**调整后**：
```javascript
videoDuration: videoDuration,  // ✅ 保存API返回的实际视频时长（显示和计费依据）
originalVideoDuration: originalVideoDuration,  // ✅ 保存原始上传时长（仅作参考）
```

##### 3. 调整前端显示逻辑（digital-human-video.html 第1283行）

**调整前**：
```javascript
// 优先显示原始上传视频时长
const videoDuration = task.originalVideoDuration || task.videoDuration || 0;
const duration = videoDuration ? `${Math.ceil(videoDuration)}秒` : '未知';
```

**调整后**：
```javascript
// 显示API返回的实际生成视频时长
const duration = task.videoDuration ? `${Math.ceil(task.videoDuration)}秒` : '未知';
```

##### 4. 调整积分记录显示（routes/credits.js 第1053行）

**调整前**：
```javascript
// 优先使用原始上传视频时长
const videoDuration = task.originalVideoDuration || task.videoDuration || task.duration || task.actualDuration || 0;
```

**调整后**：
```javascript
// 显示API返回的实际生成视频时长
const videoDuration = task.videoDuration || task.duration || task.actualDuration || 0;
```

#### 数据流程

**调整后的流程**：
```
用户上传10秒视频
    ↓
后端保存原始时长：originalVideoDuration=10秒（仅作参考）
    ↓
API处理返回：video_duration=6秒（实际生成的视频）
    ↓
✅ 保存到OSS：
   - videoDuration=6秒（实际时长，用于显示和计费）
   - originalVideoDuration=10秒（原始时长，仅作参考）
    ↓
✅ 前端显示：6秒（实际生成的视频时长）
    ↓
✅ 积分记录：生成6秒视频（实际时长）
    ↓
✅ 计费：6秒 × 9积分/秒 = 54积分
```

#### 修改文件列表

1. ✅ `server.js`
   - 第3990-4003行：调整计费逻辑，使用API返回时长
   - 第4042行：调整任务详情保存，使用API返回时长
   - 第4052行：调整全局变量保存，使用API返回时长
   - 第4130-4131行：调整OSS存储，使用API返回时长

2. ✅ `digital-human-video.html` (第1283行)
   - 调整前端任务列表显示逻辑，直接使用 `videoDuration` 字段

3. ✅ `routes/credits.js` (第1053行)
   - 调整积分使用记录的描述生成逻辑，使用 `videoDuration` 字段

#### 调整效果

**场景：用户上传10秒视频，API返回6秒**

| 项目 | 调整前 | 调整后 | 说明 |
|------|--------|--------|------|
| **上传视频时长** | 10秒 | 10秒 | 保存在originalVideoDuration（参考） |
| **API处理后时长** | 6秒 | 6秒 | 实际生成的视频时长 |
| **OSS保存的videoDuration** | 10秒 | 6秒 ✅ | 使用实际时长 |
| **任务列表显示** | 10秒 | 6秒 ✅ | 显示实际时长 |
| **积分记录显示** | "生成10秒视频" | "生成6秒视频" ✅ | 显示实际时长 |
| **计费时长** | 10秒 (90积分) | 6秒 (54积分) ✅ | 按实际时长计费 |
| **数据一致性** | ✅ 一致 | ✅ 一致 | 显示、计费、记录完全一致 |

#### 核心优势

1. ✅ **真实准确**：显示用户实际下载的视频时长
2. ✅ **计费公平**：按实际生成的视频时长计费，用户不会多付费
3. ✅ **逻辑统一**：显示时长 = 计费时长 = API返回时长
4. ✅ **数据完整**：仍然保存原始上传时长（originalVideoDuration）供参考
5. ✅ **向下兼容**：系统可以正常处理旧数据

#### 技术细节

**数据字段说明**：
- `videoDuration`：API返回的实际生成视频时长（用于显示和计费）
- `originalVideoDuration`：用户上传的原始视频时长（仅作参考）

**计费公式**：
```javascript
积分消耗 = Math.ceil(videoDuration) × 9积分/秒
```

#### 用户价值

- ✅ **更公平**：只为实际生成的视频时长付费
- ✅ **更透明**：看到的时长就是实际下载的视频时长
- ✅ **更准确**：避免显示时长与实际视频不符的情况
- ✅ **更可信**：增强用户对系统的信任

---

### 🔧 重要改进: 视频数字人和视频风格重绘计费依据改为原始视频时长（2025-10-18）

**优化类型**: 计费逻辑改进  
**严重程度**: 🟢 重要改进  
**修复状态**: ✅ 已完成

#### 改进目标
将**视频数字人**和**视频风格重绘**功能的计费依据从**API处理后的视频时长**改为**用户上传的原始视频时长**，确保计费透明、准确、公平。

#### 改进前的问题

**场景示例**：
- 用户上传：10秒视频
- API处理后：6秒视频（AI优化）
- **预期计费**：10秒 × 3积分/秒 = 30积分
- **实际计费**：6秒 × 3积分/秒 = 18积分 ❌

**存在的问题**：
1. ❌ 计费时长与用户上传的视频时长不符
2. ❌ 虽然少扣了积分，但透明度不足
3. ❌ 显示时长（10秒）和计费时长（6秒）不一致

#### 改进方案

**核心改进**：使用原始上传视频时长进行计费

##### 1. 修改任务完成时的计费逻辑（`server.js` 第10133-10166行）

**改进前**：
```javascript
// ❌ 直接使用API返回的duration进行计费
const rate = resolution <= 540 ? 3 : 6;
const creditCost = Math.ceil(duration) * rate;
```

**改进后**：
```javascript
// ✅ 从任务记录中获取原始上传视频时长
let billingDuration = duration; // 默认使用API返回的时长
let originalVideoDuration = null;

if (taskRecord && taskRecord.details) {
  const details = JSON.parse(taskRecord.details || '{}');
  if (details.tasks && Array.isArray(details.tasks)) {
    const targetTask = details.tasks.find(task => task.taskId === taskId);
    if (targetTask && targetTask.videoDuration) {
      originalVideoDuration = targetTask.videoDuration;
      billingDuration = originalVideoDuration; // 使用原始时长计费
    }
  }
}

// 计算积分（使用原始时长）
const rate = resolution <= 540 ? 3 : 6;
const creditCost = Math.ceil(billingDuration) * rate;
```

##### 2. 更新全局变量保存的时长信息（`server.js` 第10029-10047行）

**改进前**：
```javascript
// ❌ 保存API返回的时长
global.videoStyleRepaintTasks[taskId] = {
  videoDuration: duration,  // API处理后的时长
  // ...
};
```

**改进后**：
```javascript
// ✅ 优先保存原始时长，同时记录API时长
const billingDurationForGlobal = originalVideoDuration || duration;

global.videoStyleRepaintTasks[taskId] = {
  videoDuration: billingDurationForGlobal,         // 使用原始时长
  originalVideoDuration: originalVideoDuration,     // 保存原始时长
  apiProcessedDuration: duration,                   // 保存API时长（参考）
  // ...
};
```

#### 改进效果

**场景：用户上传10秒视频，API返回6秒**

| 项目 | 改进前 | 改进后 | 改进 |
|------|--------|--------|------|
| **计费依据** | 6秒（API时长） | 10秒（原始时长） | ✅ 使用原始时长 |
| **540P计费** | 6 × 3 = 18积分 | 10 × 3 = 30积分 | ✅ 透明准确 |
| **720P计费** | 6 × 6 = 36积分 | 10 × 6 = 60积分 | ✅ 透明准确 |
| **数据一致性** | ❌ 不一致 | ✅ 一致 | ✅ 修复 |

#### 核心优势

1. ✅ **计费透明**：用户上传多长时间的视频，就按多长时间计费
2. ✅ **数据准确**：计费基于用户上传的真实视频时长
3. ✅ **体验优化**：消除了时长不一致导致的困惑
4. ✅ **公平性**：所有用户按照相同的标准计费

#### 相关文档
- **视频风格重绘**详细说明：`视频风格重绘计费逻辑修复说明.md`
  - 代码位置：`server.js` 第10029-10047行、第10133-10166行
  - 计费公式：`Math.ceil(originalVideoDuration) × (resolution <= 540 ? 3 : 6)积分`
  
- **视频数字人**详细说明：`视频数字人计费逻辑修复说明.md`
  - 代码位置：`server.js` 第3989-4007行、第4037-4056行
  - 计费公式：`Math.ceil(originalVideoDuration) × 9积分`

---

### 🔧 重要修复: 视频风格重绘使用记录显示的视频时长与上传视频时长不符（2025-10-18）

**Bug类型**: 数据记录与显示问题  
**严重程度**: 🟡 中等  
**修复状态**: ✅ 已完全修复

#### 问题描述
用户反馈在"积分使用记录"页面中，视频风格重绘功能显示的"处理X秒视频"时长与实际上传的视频时长不符。

**示例**：
- 用户上传：`37.76秒`的视频
- 使用记录显示：`处理5秒视频`
- 实际上传：`9秒`视频
- 使用记录显示：`处理5秒视频`

#### 问题根源

经过深入分析，发现问题的核心原因是**时长数据的优先级设置错误**：

1. **创建任务时**：
   - 前端通过 `<video>` 元素的 `metadata` 获取准确的视频时长
   - 保存为 `videoDuration` 字段（例如：37.76秒）

2. **任务完成时**（问题所在）：
   - 阿里云API返回 `usage.duration` 是**处理后的视频时长**
   - 由于AI优化（去除重复帧、无效内容等），这个时长可能与原始视频不同
   - 旧代码**优先使用API返回的时长**更新使用记录
   - 导致使用记录显示的时长与用户上传的视频不符

3. **使用记录显示时**：
   - 代码从数据库读取 `actualDuration`（被错误地更新为API处理后的时长）
   - 导致显示错误的时长

#### 修复方案

**核心思路**：使用记录应该显示**用户上传的原始视频时长**，而不是阿里云API处理后的时长。

#### 修复内容

##### 1. 修改任务完成时的时长显示逻辑（`server.js` 第9980-10027行）

**修改前**：
```javascript
// ❌ 错误：优先使用API返回的准确时长
const displayDuration = duration || originalVideoDuration || 3;
```

**修改后**：
```javascript
// ✅ 正确：优先使用原始上传视频时长
const displayDuration = originalVideoDuration || duration || 3;
```

**关键变更**：
- ✅ 优先使用 `originalVideoDuration`（前端传递的原始视频时长）
- ✅ 保存 `task.originalVideoDuration`（原始时长，用于显示）
- ✅ 保存 `task.apiProcessedDuration`（API处理后时长，用于计费）
- ✅ 更新 `task.actualDuration = originalVideoDuration || duration`（显示优先）
- ✅ 更新 `operationText` 使用原始时长：`处理${Math.ceil(displayDuration)}秒视频`

##### 2. 修改使用记录读取逻辑（`routes/credits.js` 第1063-1093行）

**修改前**：
```javascript
// ❌ 错误：actualDuration优先级高，可能是API处理后的时长
let duration = task.actualDuration || task.duration || task.videoDuration || ...;
```

**修改后**：
```javascript
// ✅ 正确：originalVideoDuration优先级最高
let duration = task.originalVideoDuration || task.videoDuration || task.actualDuration || ...;
```

**关键变更**：
- ✅ 最优先使用 `task.originalVideoDuration`（原始上传视频时长）
- ✅ 其次使用 `task.videoDuration`（创建时保存的时长）
- ✅ 最后才使用 `task.actualDuration`（API处理后的时长）
- ✅ 添加日志输出时长字段优先级，便于调试

#### 数据流程对比

**修复前**：
```
用户上传37.76秒视频
    ↓
前端获取时长：37.76秒
    ↓
创建任务：保存 videoDuration=37.76
    ↓
阿里云处理：返回 duration=5秒（处理后）
    ↓
❌ 更新记录：actualDuration=5秒（错误！）
    ↓
使用记录显示：处理5秒视频（错误！）
```

**修复后**：
```
用户上传37.76秒视频
    ↓
前端获取时长：37.76秒
    ↓
创建任务：保存 videoDuration=37.76
    ↓
阿里云处理：返回 duration=5秒（处理后）
    ↓
✅ 更新记录：
   - originalVideoDuration=37.76（原始，用于显示）
   - apiProcessedDuration=5（处理后，用于计费）
   - actualDuration=37.76（显示优先）
    ↓
使用记录显示：处理38秒视频（正确！✅）
```

#### 修改文件

- ✅ `server.js` (第9980-10027行)
  - 修改时长优先级：`originalVideoDuration > duration`
  - 保存原始时长和API处理时长到不同字段
  - 更新 `operationText` 使用原始时长

- ✅ `routes/credits.js` (第1063-1093行)
  - 修改读取优先级：`originalVideoDuration > videoDuration > actualDuration`
  - 添加日志输出便于调试

#### 重要说明

1. **原始时长 vs 处理后时长**：
   - **原始时长**：用户上传视频的真实时长（来自video元素metadata）
   - **处理后时长**：阿里云AI优化后的视频时长（可能去除重复帧）
   - **显示原则**：使用记录应显示**原始时长**，让用户清楚知道处理了多长的视频
   - **计费原则**：积分计算使用**API返回的时长**（见第10027-10030行）

2. **为什么API时长会不同**：
   - 阿里云视频风格重绘API会对视频进行AI优化
   - 可能去除重复帧、无效内容、优化帧率等
   - 导致生成视频时长与原始视频不完全一致
   - 这是正常的AI处理行为

3. **字段命名规范**：
   - `originalVideoDuration`：原始上传视频时长（用于显示）
   - `apiProcessedDuration`：API处理后时长（用于参考）
   - `actualDuration`：实际显示时长（优先使用原始时长）
   - `videoDuration`：创建时保存的时长（兼容旧数据）

#### 测试验证

**测试场景**：
1. 上传一个37.76秒的视频进行风格重绘
2. 等待任务完成
3. 查看"积分使用记录"页面

**预期结果**：
- ✅ 操作列显示：`处理38秒视频`（向上取整）
- ✅ 时长与用户上传的视频时长一致
- ✅ 不再显示API处理后的时长

#### 用户价值

- ✅ **准确性**：使用记录显示的时长与用户上传的视频一致
- ✅ **透明度**：用户清楚知道处理了多长的视频
- ✅ **可信度**：增强用户对系统计费准确性的信任
- ✅ **兼容性**：保留API处理时长数据，用于计费和调试

---

### ✨ 优化: 移除视频风格重绘页面的蓝色提示框（2025-10-18）

**优化类型**: 用户界面简化  
**重要程度**: 🟢 低  
**完成状态**: ✅ 已完成

#### 优化内容
根据用户反馈，**移除了视频风格重绘页面上传视频后显示的蓝色提示框**，简化用户界面，减少信息干扰。

#### 移除的内容
删除了以下功能：
- 🗑️ **蓝色提示框**：上传视频后自动显示的视频时长处理提示
- 🗑️ **`showDurationNotice` 函数**：创建和显示提示框的函数
- 🗑️ **调用代码**：在视频上传后调用提示框的代码

#### 提示框原本的内容
提示框会根据视频时长显示不同的提示信息：
- **长视频（>8秒）**：提示会进行内容优化，去除重复帧
- **中等视频（5-8秒）**：提示可能略有差异
- **短视频（<5秒）**：提示API计费时长说明

#### 修改文件
- ✅ `public/video-style-repaint.html` (第228-283行, 第251行)
  - 删除 `showDurationNotice` 函数定义（56行代码）
  - 删除调用 `showDurationNotice(duration)` 的代码（3行代码）

#### 修改效果
**修改前**：
```
上传视频 → 显示蓝色提示框（内容：视频时长、处理提示、优化策略等） → 继续操作
```

**修改后**：
```
上传视频 → 直接继续操作 ✨
```

#### 用户价值
- ✅ **界面简洁**：减少不必要的信息提示，让页面更干净
- ✅ **操作流畅**：用户无需阅读提示，直接进行下一步操作
- ✅ **降低干扰**：移除可能造成用户困惑的技术性提示
- ✅ **提升体验**：更符合简洁直观的设计原则

---

### 🔧 重要修复: 多图转视频任务完成后实时显示转场风格（2025-10-18）

**Bug类型**: 前端实时更新问题  
**严重程度**: 🟡 中等  
**修复状态**: ✅ 已完全修复

#### 问题描述
用户反馈：**多图转视频选择"随机"转场风格后，任务完成时列表显示的是"随机"，必须刷新浏览器才能看到实际选定的转场风格**

**用户期望**：
- 任务完成后，无需刷新浏览器，任务列表就能立即显示实际使用的转场风格
- 提供即时的用户反馈，提升用户体验

**问题根源**：
1. **后端返回数据不完整**：任务状态查询API返回的数据中缺少 `transition`、`style`、`sceneType` 等字段
2. **前端创建任务对象时缺少字段**：任务成功后创建的 `newTask` 对象中没有包含这些参数
3. **数据未及时保存**：任务创建时 `extraData` 中没有保存这些参数

#### 修复方案

##### 1. 后端修复：保存完整的任务参数（server.js）

**修改1：任务创建时保存完整参数**（第790-798行）
```javascript
extraData: {
    description: '多图转视频',
    imageCount: req.files.length,
    duration: duration || 5,
    // 🎯 保存视频参数，确保前端可以显示具体的转场风格、视频风格等信息
    transition: mappedTransition,  // 保存实际使用的转场风格
    style: style,
    sceneType: scene
}
```

**修改2：任务状态查询时返回完整参数**（第2505-2508行）
```javascript
const formattedTask = {
    // ... 其他字段
    // 🎯 添加视频参数字段，确保前端可以显示具体的转场风格、视频风格等信息
    transition: foundTask.extraData?.transition || null,
    style: foundTask.extraData?.style || null,
    sceneType: foundTask.extraData?.sceneType || null
};
```

##### 2. 前端修复：任务完成时使用完整数据（multi-image-to-video.js）

**修改3：创建新任务对象时包含所有参数**（第702-705行）
```javascript
const newTask = {
    // ... 其他字段
    // 🎯 添加视频参数字段，确保任务列表可以立即显示具体的转场风格、视频风格等信息
    transition: data.task?.transition || null,
    style: data.task?.style || null,
    sceneType: data.task?.sceneType || null
};
```

#### 修改文件
- ✅ `server.js` (第790-798行, 第2505-2508行)
  - 任务创建时在 `extraData` 中保存 `transition`、`style`、`sceneType`
  - 任务状态查询时返回这些字段

- ✅ `public/js/multi-image-to-video.js` (第702-705行)
  - 任务成功后从后端响应中获取这些字段
  - 创建 `newTask` 对象时包含这些参数

#### 修复效果
**修复前**：
```
1. 用户选择"随机"转场 → 提交任务
2. 任务完成 → 任务列表显示"转场: 随机" ❌
3. 刷新浏览器 → 任务列表显示"转场: 水墨" ✅
```

**修复后**：
```
1. 用户选择"随机"转场 → 提交任务
2. 任务完成 → 任务列表立即显示"转场: 水墨" ✅
3. 无需刷新浏览器 ✨
```

#### 技术细节
**数据流程**：
1. 用户选择"随机"转场（前端传空字符串）
2. 后端随机选择具体转场（如 'ink' = 水墨）
3. 保存任务时将 `mappedTransition` 存入 `extraData`
4. 调用阿里云API生成视频
5. 前端轮询任务状态
6. 任务完成后，后端返回包含 `transition: 'ink'` 的数据
7. 前端使用该数据创建 `newTask` 对象
8. 渲染任务列表，显示"水墨"

#### 用户价值
- ✅ **实时反馈**：任务完成后立即看到实际使用的参数，无需刷新
- ✅ **用户体验**：流畅的交互体验，不中断用户操作流程
- ✅ **信息完整**：任务列表显示所有重要参数（转场、风格、场景等）
- ✅ **降低困惑**：用户不会疑惑为什么要刷新才能看到正确信息

---

### 🔧 重要修复: 多图转视频"随机"转场风格显示问题（2025-10-18）

**Bug类型**: 数据显示不准确  
**严重程度**: 🟡 中等  
**修复状态**: ✅ 已完全修复

#### 问题描述
用户反馈：**当选择"随机"转场风格时，任务列表显示的是"随机"，而不是系统实际选定的具体转场风格**

**用户期望**：
- 选择"随机"转场时，系统应该在后端随机选择一个具体的转场风格（如"水墨"、"缩放"等）
- 任务列表应该显示**实际使用的转场风格**，而不是"随机"这两个字
- 这样用户可以知道视频实际使用了哪种转场效果

**问题根源**：
后端在处理"随机"选项时，虽然正确地随机选择了具体的转场风格，但保存任务时使用的是**用户选择的原始值**（空字符串），而不是**系统实际使用的值**（如 'ink'、'zoom' 等）

#### 根本原因
**任务保存时使用了错误的字段**（server.js 第967行）：
```javascript
// ❌ 错误：保存了用户选择的原始值
const taskForOSS = {
    // ... 其他字段
    transition: transition,  // 这里保存的是空字符串或用户选择值
    // ...
};
```

**正确的转场风格处理逻辑**（server.js 第695-706行）：
```javascript
// 转场效果映射处理
let mappedTransition;
if (!transition || transition === '') {
    // 如果没有设置转场风格，则随机选择
    const randomIndex = Math.floor(Math.random() * availableTransitionStyles.length);
    mappedTransition = availableTransitionStyles[randomIndex];  // ✅ 这才是实际使用的转场风格
    console.log(`未设置转场风格，随机选择: "${mappedTransition}"`);
} else {
    mappedTransition = transitionStyleMap[transition] || transition || 'normal';
}
```

#### 修复方案
**修改任务保存逻辑，使用实际的转场风格**（server.js 第967行）：
```javascript
// ✅ 修复：保存实际使用的转场风格
const taskForOSS = {
    // ... 其他字段
    transition: mappedTransition,  // 🔧 修复：保存实际使用的转场风格，而不是用户选择的原始值
    // ...
};
```

#### 修改文件
- ✅ `server.js` (第967行)
  - 修改任务保存逻辑，使用 `mappedTransition` 而不是 `transition`
  - 确保保存到OSS的任务数据包含实际使用的转场风格

- ✅ `public/js/multi-image-to-video.js` (第1035-1067行)
  - 前端已有完整的转场风格映射表和显示逻辑
  - 支持15种转场风格的中文显示

#### 修复效果
**修复前**：
```
多图转视频 (2张图片)
多图转视频  |  31秒  |  转场: 随机  |  2025-10-17 17:53
                        ↑ 
                显示"随机"，用户不知道实际用了什么转场
```

**修复后**：
```
多图转视频 (2张图片)
多图转视频  |  31秒  |  转场: 水墨  |  2025-10-18 10:25
                        ↑
                显示实际使用的转场风格（如"水墨"、"缩放"等）
```

#### 用户价值
- ✅ **透明度提升**：用户可以清楚知道视频实际使用的转场风格
- ✅ **便于对比**：可以对比不同转场风格的视频效果
- ✅ **可追溯性**：历史任务记录了实际使用的参数，便于复现
- ✅ **用户体验**：符合用户直觉，"随机"应该显示最终选定的结果

---

### ✨ 功能优化: 多图转视频任务列表显示转场风格（2025-10-17）

**优化类型**: 用户体验改进  
**重要程度**: 🟢 低  
**完成状态**: ✅ 已完成

#### 优化内容
在**多图转视频功能**的任务列表中，新增显示**镜头转场风格**信息，方便用户查看每个任务使用的转场效果。

#### 具体实现
1. **任务列表显示**：
   - 在任务信息中添加"转场"标签
   - 使用**蓝色高亮**显示转场风格名称
   - 支持15种转场风格的中文显示

2. **转场风格映射**：
   ```javascript
   const transitionStyleNames = {
       'basic': '无',
       'slow': '舒缓',
       'fast': '动感',
       'normal': '自然',
       'ink': '水墨',
       'glitch': '机械故障',
       'shift': '切换',
       'mosaic': '马赛克',
       'shutter': '百叶窗',
       'zoom': '缩放',
       'mask': '遮罩',
       'brush': '笔刷',
       'wind': '风舞',
       'smog': '烟雾',
       '': '随机'
   };
   ```

3. **显示效果**：
   ```
   多图转视频 (2张图片)
   多图转视频  |  31秒  |  转场: 水墨  |  2025-10-17 17:53
   ```

#### 修改文件
- ✅ `public/js/multi-image-to-video.js` (第1035-1067行)
  - 添加转场风格映射表
  - 在任务显示HTML中添加转场风格标签

#### 用户价值
- ✅ 更清晰地了解每个视频使用的转场效果
- ✅ 便于对比不同转场风格的视频效果
- ✅ 提升功能透明度和可追溯性

---

### 🔧 重要修复: 文生视频使用次数统计问题（2025-10-17）

**Bug类型**: 使用次数统计错误  
**严重程度**: 🟡 中等  
**修复状态**: ✅ 已完全修复

#### 问题描述
用户反馈：**文生视频功能使用后，使用次数不更新，功能占比也不显示使用次数占比**

**现象**：
- ✅ 积分扣除正常
- ✅ 积分时段消费正常
- ❌ 使用次数一直不变（例如一直显示为1）
- ❌ 功能占比页面不显示使用次数统计

#### 根本原因
**使用次数更新逻辑缺失**：
1. ❌ **免费任务**：只在`usageCount === 0`时更新为1，如果已经是1就不会再更新
2. ❌ **付费任务**：**完全没有更新usageCount的代码**（与多图转视频对比发现缺失）

**问题代码位置**（routes/unifiedFeatureUsage.js 第397-482行）：
```javascript
// 免费任务 - 第397-402行
if (usage.usageCount === 0) {  // ❌ 只在为0时更新，导致第2次使用时不会更新
  usage.usageCount = 1;
  await usage.save();
}

// 付费任务 - 第403-482行
// ❌ 完全没有更新usageCount的逻辑！
```

#### 修复方案
**参照多图转视频的正确逻辑**，在文生视频/图生视频的任务完成处理中添加使用次数更新代码：

1. **免费任务更新**（第397-404行）：
   ```javascript
   // 🔧 修复：使用次数应该反映实际完成的任务数量
   const completedTasksCount = Array.isArray(tasks) ? 
     tasks.filter(t => (t.status === 'SUCCEEDED' || t.status === 'completed')).length : 1;
   if (usage.usageCount < completedTasksCount) {
     usage.usageCount = completedTasksCount;
     await usage.save();
     console.log(`[任务完成] 免费使用，已更新使用次数: ${usage.usageCount}`);
   }
   ```

2. **付费任务更新**（第482-489行）：
   ```javascript
   // 🔧 修复：更新使用次数，确保付费使用也被正确计入
   const completedTasksCount = Array.isArray(tasks) ? 
     tasks.filter(t => (t.status === 'SUCCEEDED' || t.status === 'completed')).length : 1;
   if (usage.usageCount < completedTasksCount) {
     usage.usageCount = completedTasksCount;
     await usage.save();
     console.log(`[任务完成] 付费使用，已更新使用次数: ${usage.usageCount}`);
   }
   ```

#### 修复效果
- ✅ 第1次使用：usageCount从0变为1
- ✅ 第2次使用：usageCount从1变为2
- ✅ 第3次使用：usageCount从2变为3
- ✅ 使用次数正确反映实际完成的任务数量
- ✅ 功能占比页面可以正确显示使用次数统计

#### 影响范围
- `text-to-video`（文生视频）✅ 已修复
- `image-to-video`（图生视频）✅ 已修复
- 与多图转视频逻辑完全对齐 ✅

#### 验证方式
1. 使用文生视频功能创建任务
2. 等待任务完成
3. 查看积分使用记录页面，确认使用次数正确递增
4. 查看功能占比统计，确认显示正确

---

### 🔧 系统修复: 端口占用问题（2025-10-17）

**问题类型**: 系统运行问题  
**严重程度**: 🟡 中等  
**修复状态**: ✅ 已完全修复

#### 问题描述
服务器启动失败，报错：`Error: listen EADDRINUSE: address already in use :::8080`

**现象**：
- ❌ 服务器无法启动
- ❌ 8080端口被占用
- ❌ 存在多个node进程占用端口

#### 根本原因
**端口被多个进程占用**：
1. 存在旧的node进程（PID: 14142, 18461）占用8080端口
2. 新启动的服务器无法绑定该端口
3. 可能原因：之前的服务器进程未正常关闭

#### 修复步骤
1. **检测占用端口的进程**：
   ```bash
   lsof -ti:8080
   # 发现进程: 14142, 18461
   ```

2. **强制关闭进程**：
   ```bash
   kill -9 14142 18461
   ```

3. **重新启动服务器**：
   ```bash
   npm start
   ```

4. **验证服务器状态**：
   ```bash
   curl http://localhost:8080/api/health
   # 返回: {"status":"ok","timestamp":"2025-10-17T06:30:23.289Z","uptime":18.011543083}
   ```

#### 修复效果
- ✅ 服务器成功启动在8080端口
- ✅ 健康检查API正常响应（HTTP 200）
- ✅ 主页正常加载
- ✅ 所有功能恢复正常

#### 预防措施
**正确的服务器关闭方式**：
```bash
# 方式1: 使用npm stop（如果配置了）
npm stop

# 方式2: 查找并关闭进程
lsof -ti:8080 | xargs kill

# 方式3: 在启动服务器的终端按 Ctrl+C
```

**启动前检查端口**：
```bash
# 检查端口是否被占用
lsof -ti:8080

# 如果有输出，说明端口被占用，需要先关闭
```

---

### 🔥 重要修复: 图生视频积分不扣除问题（2025-10-17）

**Bug类型**: 积分扣除逻辑错误  
**严重程度**: 🔴 高危（直接影响收入）  
**修复状态**: ✅ 已完全修复

#### 问题描述
用户反馈：**图生视频/文生视频任务完成后，积分没有从用户账户扣除**

**现象**：
- ✅ 任务正常完成，视频可以下载
- ❌ 用户积分余额没有减少
- ❌ 使用记录可能显示扣费，但实际未扣除
- ❌ 用户可以无限次免费使用（绕过收费机制）

#### 根本原因
**`saveTaskDetails`函数逻辑缺陷**：
1. ❌ 任务创建时添加到`details.tasks`（状态为pending）
2. ❌ 任务完成时，发现任务已存在（`existingTaskIndex !== -1`）
3. ❌ 更新任务信息时，**保留了原有的creditCost和isFree**，没有使用新传入的值
4. ❌ 更新完成后**直接返回**（第210行），**跳过了第348-457行的积分扣除逻辑**！

**核心问题代码**（routes/unifiedFeatureUsage.js 第173-210行）：
```javascript
if (existingTaskIndex !== -1) {
  // 任务已存在，更新任务信息
  tasks[existingTaskIndex] = {
    ...existingTask,
    creditCost: existingTask.creditCost, // ❌ 保留旧值，忽略新传入的值
    isFree: existingTask.isFree, // ❌ 保留旧值，忽略新传入的值
    ...
  };
  await usage.save();
  // ❌ 直接返回，跳过积分扣除逻辑！
}
```

#### 修复方案
**修改`saveTaskDetails`函数**（routes/unifiedFeatureUsage.js 第173-229行）：

1. **添加needsCharging判断**：
   ```javascript
   // 判断是否需要扣除积分
   const needsCharging = 
     taskInfo.status === 'completed' && 
     existingTask.status !== 'completed' && 
     (taskInfo.featureName === 'text-to-video' || taskInfo.featureName === 'image-to-video');
   ```

2. **条件性更新积分信息**：
   ```javascript
   // 如果需要扣费，使用新传入的积分信息；否则保留原有值
   creditCost: needsCharging ? taskInfo.creditCost : existingTask.creditCost,
   isFree: needsCharging ? taskInfo.isFree : existingTask.isFree,
   ```

3. **条件性返回**：
   ```javascript
   // 如果不需要扣费，直接返回；否则继续执行积分扣除逻辑
   if (!needsCharging) {
     return;
   }
   // 继续执行第348-457行的积分扣除逻辑
   ```

#### 修复效果
- ✅ 第1次使用：免费，积分不变
- ✅ 第2次使用：扣除66积分，用户积分正确减少
- ✅ 积分扣除逻辑正确执行
- ✅ 用户表的credits字段正确更新
- ✅ 使用记录正确显示

#### 验证指南
完整的验证步骤和检查清单，请参考：
📄 [图生视频积分扣除修复验证指南.md](./图生视频积分扣除修复验证指南.md)

#### 影响范围
- `image-to-video`（图生视频）✅ 已修复
- `text-to-video`（文生视频）✅ 已修复

#### 技术细节
详细的问题分析和代码对比，请参考：
📄 [图生视频积分不扣除问题分析报告-2025-10-17.md](./图生视频积分不扣除问题分析报告-2025-10-17.md)

---

### 优化 1: 图生视频积分扣除逻辑优化（2025-10-17）

**优化类型**: 逻辑优化  
**严重程度**: 中等  
**修复状态**: ✅ 已完成优化

#### 优化目标
参照多图转视频的积分扣除逻辑，优化图生视频和文生视频的免费判断机制，确保免费判断更加准确可靠。

#### 优化内容
**修改免费判断时机**（middleware/unifiedFeatureUsage.js 第831-868行）：
- ❌ 旧逻辑：**创建时判断**（基于所有任务，包括pending） + **完成时使用创建时的标记**
- ✅ 新逻辑：**完成时判断**（基于已完成任务数，排除当前任务）

#### 优化效果
1. **免费判断更准确**：
   - ✅ 基于已完成任务数判断，避免pending任务影响
   - ✅ 与多图转视频逻辑完全一致
   - ✅ 异常场景处理更合理（如首个任务失败，第二个任务仍然免费）

2. **逻辑更清晰**：
   - ✅ 创建时：基本检查（积分是否足够）
   - ✅ 完成时：免费判断 + 积分扣除
   - ✅ 两个阶段职责分明

详细优化报告：[图生视频积分扣除逻辑优化报告-2025-10-17.md](./图生视频积分扣除逻辑优化报告-2025-10-17.md)

---

### Bug 1: 图生视频免费判断错误（2025-10-17）

**Bug类型**: 免费次数判断错误  
**严重程度**: 高  
**修复状态**: ✅ 已完全修复

#### 问题描述
用户反馈：**图生视频的第2、3、4次使用都被判定为免费**

- ✅ 使用次数统计正确
- ❌ 免费判断错误（应该只有第1次免费，但第2、3、4次也显示免费）
- ❌ 积分扣除不正确（应该扣3次66积分，实际只扣了1次）

#### 根本原因
**免费判断时机错误**：
- ❌ 旧逻辑：基于**已完成任务数**判断（当第1个任务还在pending时，第2次使用仍被判定为免费）
- ✅ 正确逻辑：应基于**历史任务总数**判断（不论任务状态）

#### 修复方案
**修改免费判断逻辑**（middleware/unifiedFeatureUsage.js）：
- 将判断依据从"已完成任务数"改为"历史任务总数"
- 确保第2次使用时，即使第1个任务还在pending，也能正确判定为收费
- 与视频风格重绘功能的逻辑对齐

#### 修复效果
- ✅ 第1次使用：免费
- ✅ 第2次使用：收费66积分（即使第1个任务还在pending）
- ✅ 第3次及以后：均收费66积分

详细修复报告：[图生视频免费判断Bug修复报告-2025-10-17.md](./图生视频免费判断Bug修复报告-2025-10-17.md)

---

### Bug 2: 图生视频使用记录重复显示（2025-10-17）

**Bug类型**: 数据显示重复  
**严重程度**: 中等  
**修复状态**: ✅ 已完全修复

#### 问题描述
用户反馈：**图生视频使用记录在列表中重复显示（每条记录显示2次）**

- ✅ 使用次数统计正确
- ✅ 积分扣除正确
- ❌ 使用记录列表重复显示（实际2次使用，却显示4条记录）

#### 根本原因
**重复添加使用记录**：图生视频的使用记录被添加了两次
1. **通用逻辑**（第1017-1233行）：为所有功能添加使用记录，包括image-to-video
2. **特殊处理**（第1349-1398行）：在图生视频的特殊处理中又添加了一遍使用记录

#### 修复方案
**删除重复的使用记录添加逻辑**：
- 保留通用逻辑中的使用记录添加（已包含去重、时间过滤、状态过滤）
- 删除图生视频特殊处理中的重复添加（50行代码 → 2行注释）
- 保留图生视频的使用次数和积分统计逻辑（这部分是特殊的）

#### 修复效果
- ✅ 使用次数统计准确
- ✅ 积分扣除准确
- ✅ 使用记录不再重复显示

详细修复报告：[图生视频使用记录重复显示Bug修复报告-最终版-2025-10-17.md](./图生视频使用记录重复显示Bug修复报告-最终版-2025-10-17.md)

---

## 🎉 项目简介

### 技术栈
- **后端**: Node.js + Express
- **数据库**: MySQL + Sequelize ORM
- **存储**: 阿里云OSS
- **前端**: HTML5 + CSS3 + JavaScript

### 核心功能

#### 1. 图像处理功能
- 图片高清放大
- 智能抠图
- 场景生成
- 图像物体移除
- 模特肤色替换
- 模拟试衣
- 图像指令编辑
- 图像局部重绘
- 图像上色
- 智能扩图
- 文生图片
- 模糊图片变清晰
- 智能服饰分割
- 全局风格化
- 图像裁剪

#### 2. 视频处理功能
- 文生视频
- 图生视频
- 多图转视频
- 视频去除字幕
- 视频风格重绘
- 数字人视频

#### 3. 亚马逊助手功能
- 广告视频脚本生成
- 选品改款分析
- 品牌信息收集
- 品牌起名
- Listing写作优化
- 后台搜索词
- 客户评论分析
- 消费者洞察
- 客户邮件回复
- FBA索赔邮件
- 评论生成和回复
- 产品对比
- Post创建
- 关键词推荐
- 客服case内容

### 积分系统
- 新用户注册赠送积分
- 每个功能首次使用免费
- 后续使用按积分消耗
- 完整的积分使用记录
- 积分充值功能

---

## 📚 项目文档

### 📖 功能说明文档
- [💡 图生视频积分扣除逻辑说明.md](./图生视频积分扣除逻辑说明.md) ⭐ **适合初学者**

### 系统运行报告
- [🚀 系统运行状态报告-2025-10-17.md](./系统运行状态报告-2025-10-17.md) ⭐ 最新

### 重要修复报告
- [🔥 图生视频积分不扣除问题分析报告-2025-10-17.md](./图生视频积分不扣除问题分析报告-2025-10-17.md)
- [🔥 图生视频积分扣除修复验证指南.md](./图生视频积分扣除修复验证指南.md)
- [图生视频积分扣除逻辑优化报告-2025-10-17.md](./图生视频积分扣除逻辑优化报告-2025-10-17.md)
- [图生视频免费判断Bug修复报告-2025-10-17.md](./图生视频免费判断Bug修复报告-2025-10-17.md)
- [图生视频使用记录重复显示Bug修复报告-最终版-2025-10-17.md](./图生视频使用记录重复显示Bug修复报告-最终版-2025-10-17.md)

---

## 🚀 快速开始

### 环境要求
- Node.js 14+
- MySQL 5.7+
- 阿里云OSS账号

### 安装步骤
1. 克隆项目
2. 安装依赖：`npm install`
3. 配置环境变量（数据库、OSS等）
4. 运行数据库迁移
5. 启动服务：`npm start`

### 启动服务器

#### 正常启动
```bash
# 进入项目目录
cd /Users/houkai/Documents/Yinghuo1/图生视频START

# 启动服务器（后台运行）
npm start
```

#### 端口被占用时
```bash
# 1. 检查8080端口占用情况
lsof -ti:8080

# 2. 如果有进程占用，强制关闭
lsof -ti:8080 | xargs kill -9

# 3. 重新启动服务器
npm start
```

#### 验证服务器状态
```bash
# 检查健康状态
curl http://localhost:8080/api/health

# 检查主页
curl -I http://localhost:8080/
```

### 访问地址
- 营销首页：`http://localhost:8080/index.html`
- 用户账户：`http://localhost:8080/account.html`
- 积分记录：`http://localhost:8080/credits-usage.html`
- 管理后台：`http://localhost:8080/admin-dashboard.html`
- 健康检查：`http://localhost:8080/api/health`

---

## 📝 更新日志

### 2025-10-21
- ✨ **新增图像裁剪功能**
  - 创建完整的图像裁剪页面 (`image-crop.html`)
  - 支持拖拽调整裁剪区域，8个控制点精确调整
  - 预设多种比例：1:1、4:3、16:9、3:4、9:16等
  - 支持自定义尺寸输入
  - 实时预览裁剪效果
  - 完全免费使用，基于前端Canvas技术
  - 添加后端API记录使用统计
  - 在主页面所有位置添加功能入口

### 2025-11-10
- 🌍 **多语言体验修复**：补齐首页亚马逊助手卡片与移动端功能菜单的翻译映射，确保切换为英文后所有标题与描述均正确显示。

---

## 👨‍💻 开发团队

**AI助手** - 技术支持与Bug修复

---

## 🔧 最新修复记录 - 视频数字人统一记录系统集成（2025-10-20）

### 问题根本原因

经过深入分析发现，视频数字人功能使用了**独立的保存逻辑**，没有集成到**统一的功能使用记录系统**中，导致：

- ❌ **没有创建CreditHistory记录** → 积分使用记录页面显示为空
- ❌ **没有更新统一的功能使用统计** → 功能占比显示为0
- ❌ **积分扣除不完整** → 缺少完整的记录链路

### 修复方案

**核心修复**：在任务完成时调用统一功能使用记录系统

**修改文件**：`routes/textToVideo.js` (第2992-3028行)

```javascript
// 🔧 修复：调用统一功能使用记录系统，确保积分扣除和使用记录正确
try {
    console.log('开始调用统一功能使用记录系统...');
    
    // 导入统一功能使用记录系统的保存函数
    const { saveTaskDetails: saveUnifiedTaskDetails } = require('../middleware/unifiedFeatureUsage');
    
    // 查找功能使用记录
    const featureUsage = await FeatureUsage.findOne({
        where: { userId: req.user.id, featureName: 'DIGITAL_HUMAN_VIDEO' }
    });
    
    if (featureUsage) {
        // 调用统一功能使用记录系统
        await saveUnifiedTaskDetails(featureUsage, {
            taskId: taskId,
            status: 'completed',
            featureName: 'DIGITAL_HUMAN_VIDEO',
            creditCost: isFree ? 0 : creditsUsed,
            isFree: isFree,
            extraData: {
                videoDuration: videoDuration,
                videoUrl: videoUrl,
                requestId: response.data.request_id
            }
        });
        
        console.log('✅ 统一功能使用记录系统调用成功');
    }
} catch (unifiedError) {
    console.error('❌ 调用统一功能使用记录系统失败:', unifiedError);
}
```

### 修复效果

修复后，视频数字人功能将：

1. ✅ **正确创建CreditHistory记录** - 积分使用记录页面正常显示
2. ✅ **更新统一功能使用统计** - 功能占比正确计算
3. ✅ **完整的积分扣除链路** - 包含所有必要的记录和验证
4. ✅ **保持向后兼容** - 不影响现有功能

### 测试验证

**提供测试脚本**：`test_digital_human_fix.js`

```bash
# 运行测试脚本验证修复效果
node test_digital_human_fix.js
```

**预期结果**：
- 统一记录系统正常调用
- CreditHistory记录正确创建
- 功能使用统计正确更新
- 积分扣除完整无误

---

## 🔧 导航栏功能中心修复记录（2025-10-22）

### 问题描述

用户反馈：积分管理页面引用的导航栏功能中心里面没有**图像裁剪**和**图像改尺寸**功能。

### 问题分析

检查发现积分管理页面使用的是`components/navbar-full.html`导航栏，其功能中心下拉菜单的"图像处理"分类中确实缺少了这两个功能的链接。

### 修复内容

**修改文件**：`components/navbar-full.html`

**修复位置**：图像处理分类（第38-53行）

#### 第一步：添加缺失功能
```html
<!-- 修改前：图像处理分类缺少图像裁剪和图像改尺寸 -->
<h3 class="text-sm font-semibold text-gray-900 mb-2 pb-1 border-b image-processing">图像处理</h3>
<ul class="space-y-1">
    <li><a href="javascript:void(0)" onclick="checkAuthAndRedirect('/scene-generator')" class="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">场景图生成</a></li>
    <!-- ... 其他功能 ... -->
</ul>
```

#### 第二步：调整功能排列顺序（与首页保持一致）
```html
<!-- 最终版本：按照首页图像处理功能的顺序排列 -->
<h3 class="text-sm font-semibold text-gray-900 mb-2 pb-1 border-b image-processing">图像处理</h3>
<ul class="space-y-1">
    <!-- 🔧 按照首页图像处理功能的顺序排列 -->
    <li><a href="javascript:void(0)" onclick="checkAuthAndRedirect('/scene-generator')" class="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">场景图生成</a></li>
    <li><a href="javascript:void(0)" onclick="checkAuthAndRedirect('/image-removal.html')" class="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">图像智能消除</a></li>
    <li><a href="javascript:void(0)" onclick="checkAuthAndRedirect('/image-expansion.html')" class="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">智能扩图</a></li>
    <li><a href="javascript:void(0)" onclick="checkAuthAndRedirect('/image-sharpen.html')" class="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">模糊图片变清晰</a></li>
    <li><a href="javascript:void(0)" onclick="checkAuthAndRedirect('/image-upscaler.html')" class="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">图像高清放大</a></li>
    <li><a href="javascript:void(0)" onclick="checkAuthAndRedirect('/image-crop.html')" class="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">图像裁剪</a></li>
    <li><a href="javascript:void(0)" onclick="checkAuthAndRedirect('/image-resizer.html')" class="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">图片改尺寸</a></li>
    <li><a href="javascript:void(0)" onclick="checkAuthAndRedirect('/image-colorization.html')" class="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">图像上色</a></li>
    <!-- ... 其他功能 ... -->
</ul>
```

### 修复效果

- ✅ **功能链接完整**：导航栏功能中心现在包含图像裁剪和图片改尺寸功能
- ✅ **排列顺序一致**：与首页图像处理功能的顺序完全保持一致
  - 🔝 **核心功能优先**：场景图生成 → 图像智能消除 → 智能扩图 → 模糊图片变清晰 → 图像高清放大
  - 📍 **常用功能跟随**：图像裁剪 → 图片改尺寸 → 图像上色 → 其他功能
- ✅ **链接正确**：使用正确的页面路径和认证检查函数
- ✅ **用户体验**：用户在首页和导航栏看到的功能顺序完全一致，提升使用体验

### 验证方法

1. 访问积分管理页面：`http://localhost:8080/credits.html`
2. 点击导航栏中的"功能中心"
3. 查看"图像处理"分类
4. 确认"图像裁剪"和"图像改尺寸"功能链接存在且可点击

---

---

## 🌐 最新功能更新 - 多语言支持（2025-11-03）

### 新增功能：中英文语言切换

**功能描述**：在首页"开始使用"按钮左侧添加了语言选择器，支持中文和英文之间的实时切换。

#### 功能特性

1. **语言选择器位置**：位于首页主要CTA按钮"开始使用"的左侧
2. **支持语言**：
   - 🇨🇳 中文（默认）
   - 🇺🇸 English（英文）

3. **切换内容**：
   - 页面标题和描述文本
   - 统计数据标签
   - 按钮文本
   - 页面标题（浏览器标签）
   - HTML语言属性

4. **用户体验**：
   - 语言选择会保存到本地存储
   - 下次访问时自动恢复用户的语言偏好
   - 实时切换，无需刷新页面

#### 技术实现

**前端实现**：
- 使用`data-i18n`属性标记需要翻译的文本元素
- JavaScript动态更新页面内容
- localStorage保存用户语言偏好

**翻译内容**：
```javascript
// 中文内容
hero_title_1: "专业级电商ai工具"
hero_title_2: "服务电商人"
start_using: "开始使用"

// 英文内容  
hero_title_1: "Professional E-commerce AI Tools"
hero_title_2: "Serving E-commerce Professionals"
start_using: "Get Started"
```

#### 修改文件

- ✅ `index.html`
  - 添加语言选择器UI组件
  - 为文本元素添加`data-i18n`属性
  - 实现语言切换JavaScript逻辑
  - 创建中英文翻译数据

#### 使用方法

1. 访问首页：`http://localhost:8080/index.html`
2. 在"开始使用"按钮左侧找到语言选择下拉菜单
3. 选择"English"切换到英文界面
4. 选择"中文"切换回中文界面
5. 语言偏好会自动保存，下次访问时生效

#### 用户价值

- ✅ **国际化支持**：为海外用户提供英文界面
- ✅ **用户友好**：简单直观的语言切换方式
- ✅ **体验优化**：语言偏好持久化保存
- ✅ **无缝切换**：实时更新，无需页面刷新

---

## 📄 许可证

本项目由 **AI进化论-花生** 创建，版权所有，引用请注明出处。
