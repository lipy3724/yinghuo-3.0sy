# 图像高清放大问题诊断指南

## 🚨 问题现象
图像高清放大界面无法成功生成图片，可能表现为：
- 一直显示"正在生成图片"
- 上传后没有任何反应
- 显示错误信息
- 任务状态异常

## 🔍 快速诊断步骤

### 第1步：检查用户登录状态
1. 打开浏览器开发者工具 (F12)
2. 在Console中输入：`localStorage.getItem('authToken')`
3. 如果返回 `null`，说明未登录，需要先登录

### 第2步：检查网络连接
1. 在Console中输入：
```javascript
fetch('/api/user/balance', {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
}).then(r => r.json()).then(console.log)
```
2. 如果返回用户余额信息，说明网络和认证正常

### 第3步：测试图像上传功能
1. 复制以下测试脚本到Console中运行：

```javascript
// 创建测试图片并上传
async function testUpload() {
    const canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FF0000'; ctx.fillRect(0, 0, 2, 2);
    
    canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('image', blob, 'test.png');
        formData.append('upscaleFactor', '2');
        
        try {
            const response = await fetch('/api/upscale', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
                body: formData
            });
            
            const result = await response.json();
            console.log('上传结果:', result);
            
            if (result.taskId) {
                console.log('✅ 异步模式正常，任务ID:', result.taskId);
                // 开始轮询
                pollTask(result.taskId);
            } else if (result.imageUrl) {
                console.log('✅ 同步模式正常，结果:', result.imageUrl);
            } else {
                console.log('❌ 响应格式异常');
            }
        } catch (error) {
            console.error('❌ 上传失败:', error);
        }
    }, 'image/png');
}

// 轮询任务状态
async function pollTask(taskId) {
    for (let i = 0; i < 20; i++) {
        try {
            const response = await fetch(`/api/image-upscaler/task/${taskId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            const data = await response.json();
            console.log(`[${i+1}] 任务状态:`, data.task.status);
            
            if (data.task.status === 'SUCCEEDED') {
                console.log('🎉 任务完成！结果:', data.task.resultUrl);
                break;
            } else if (data.task.status === 'FAILED') {
                console.log('❌ 任务失败:', data.task.errorMessage);
                break;
            }
            
            await new Promise(r => setTimeout(r, 3000));
        } catch (error) {
            console.error('查询失败:', error);
            break;
        }
    }
}

// 运行测试
testUpload();
```

## 🛠️ 常见问题解决方案

### 问题1：认证失败 (401错误)
**原因**：登录token过期或无效
**解决方案**：
1. 重新登录系统
2. 检查localStorage中的authToken是否存在
3. 尝试刷新页面

### 问题2：余额不足
**原因**：账户余额不足以支付图像处理费用
**解决方案**：
1. 充值账户余额
2. 检查当前余额：`fetch('/api/user/balance', {headers: {'Authorization': 'Bearer ' + localStorage.getItem('authToken')}}).then(r=>r.json()).then(console.log)`

### 问题3：图片格式不支持
**原因**：上传的图片格式不被支持
**解决方案**：
1. 确保图片格式为 PNG、JPG、JPEG、WEBP
2. 检查图片大小是否超出限制
3. 尝试使用其他格式的图片

### 问题4：服务器内部错误 (500错误)
**原因**：服务器端处理异常
**解决方案**：
1. 查看浏览器Network标签页的错误详情
2. 尝试稍后重试
3. 联系技术支持

### 问题5：长时间卡在"正在生成图片"
**原因**：异步处理机制问题或轮询失败
**解决方案**：
1. 检查Console是否有错误信息
2. 手动查询任务状态：
```javascript
// 查看当前任务ID
const taskId = localStorage.getItem('currentUpscalerTaskId');
console.log('当前任务ID:', taskId);

// 手动查询状态
if (taskId) {
    fetch(`/api/image-upscaler/task/${taskId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
    }).then(r => r.json()).then(console.log);
}
```

## 🔧 高级调试

### 查看服务器日志
如果您有服务器访问权限，可以查看服务器日志：
```bash
# 查看最新的服务器日志
tail -f logs/app.log

# 或者查看Node.js进程输出
pm2 logs
```

### 检查数据库状态
```javascript
// 查看最近的任务记录
fetch('/api/image-upscaler/tasks', {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
}).then(r => r.json()).then(data => {
    console.log('最近任务:', data.tasks.slice(0, 5));
});
```

### 清理本地存储
如果问题持续存在，尝试清理本地存储：
```javascript
// 清理相关的本地存储
localStorage.removeItem('currentUpscalerTaskId');
localStorage.removeItem('authToken');
localStorage.removeItem('user');

// 然后重新登录
location.reload();
```

## 📞 联系支持

如果以上步骤都无法解决问题，请联系技术支持，并提供：
1. 浏览器Console中的错误信息截图
2. Network标签页中的请求详情
3. 问题发生的具体步骤
4. 使用的浏览器版本和操作系统

## ✅ 预防措施

1. **定期清理浏览器缓存**：避免缓存问题影响功能
2. **保持登录状态**：避免token过期导致的问题
3. **检查网络连接**：确保网络稳定
4. **使用标准图片格式**：PNG、JPG等常见格式
5. **合理的图片大小**：避免过大的图片导致处理超时

---

**最后更新**：2025年9月17日  
**版本**：v2.0 - 异步处理架构
