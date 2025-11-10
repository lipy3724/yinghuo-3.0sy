const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 调试测试模式下的多图转视频问题
async function debugTestMode() {
    try {
        console.log('🔍 开始调试测试模式下的多图转视频问题...');
        
        // 1. 创建测试会话
        console.log('\n📝 步骤1: 创建测试会话');
        let token;
        
        try {
            const output = execSync('node create-test-session.js', { encoding: 'utf8' });
            const tokenMatch = output.match(/生成的令牌: ([a-zA-Z0-9._-]+)/);
            if (!tokenMatch) {
                throw new Error('无法从create-test-session.js输出中提取token');
            }
            token = tokenMatch[1];
            console.log('✅ 测试会话创建成功，token:', token.substring(0, 20) + '...');
        } catch (error) {
            console.error('❌ 创建测试会话失败:', error.message);
            return;
        }
        
        // 2. 准备测试图片
        const testImages = [
            path.join(__dirname, 'test-image.jpg'),
            path.join(__dirname, 'test-image-512.jpg'),
            path.join(__dirname, 'test-image-512.png')
        ];
        
        // 检查测试图片是否存在
        for (let i = 0; i < testImages.length; i++) {
            if (!fs.existsSync(testImages[i])) {
                console.log(`❌ 测试图片 ${i+1} 不存在: ${testImages[i]}`);
                return;
            }
        }
        
        // 3. 创建FormData并添加图片
        const formData = new FormData();
        testImages.forEach((imagePath, index) => {
            formData.append('images', fs.createReadStream(imagePath));
        });
        
        // 4. 添加其他参数，特别测试滑动转场风格
        formData.append('sceneType', 'portrait');
        formData.append('width', '720');
        formData.append('height', '1280');
        formData.append('style', 'realistic');
        formData.append('transition', 'slide');  // 重点测试滑动转场风格
        formData.append('duration', '10');
        formData.append('durationAdaption', 'true');
        formData.append('smartEffect', 'true');
        formData.append('puzzleEffect', 'false');
        formData.append('mute', 'false');
        formData.append('music', 'none');
        
        console.log('\n📝 步骤2: 发送多图转视频请求（滑动转场风格）');
        console.log('请求参数:');
        console.log('- 转场风格: slide');
        console.log('- 图片数量:', testImages.length);
        console.log('- 视频尺寸: 720x1280');
        console.log('- 视频时长: 10秒');
        
        // 5. 发送请求
        const response = await axios.post('http://localhost:8080/api/multi-image-to-video', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${token}`
            },
            timeout: 30000
        });
        
        console.log('\n✅ 多图转视频请求成功');
        console.log('响应数据:', JSON.stringify(response.data, null, 2));
        
        const taskId = response.data.taskId;
        if (!taskId) {
            console.log('❌ 响应中没有任务ID');
            return;
        }
        
        // 6. 立即查询任务状态（应该显示PENDING）
        console.log('\n📝 步骤3: 立即查询任务状态');
        const immediateStatusResponse = await axios.get(`http://localhost:8080/api/multi-image-to-video/status/${taskId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('\n✅ 立即任务状态查询成功');
        console.log('任务状态:', JSON.stringify(immediateStatusResponse.data, null, 2));
        
        // 7. 等待6秒后再次查询（测试模式应该完成）
        console.log('\n📝 步骤4: 等待6秒后查询任务状态');
        await new Promise(resolve => setTimeout(resolve, 6000));
        
        const finalStatusResponse = await axios.get(`http://localhost:8080/api/multi-image-to-video/status/${taskId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('\n✅ 最终任务状态查询成功');
        console.log('任务状态:', JSON.stringify(finalStatusResponse.data, null, 2));
        
        // 8. 检查全局任务缓存
        console.log('\n📝 步骤5: 检查全局任务缓存');
        console.log('全局任务缓存:', global.taskCache ? Object.keys(global.taskCache) : '未定义');
        if (global.taskCache && global.taskCache[taskId]) {
            console.log('任务缓存详情:', JSON.stringify(global.taskCache[taskId], null, 2));
        }
        
        // 9. 分析结果
        const taskData = finalStatusResponse.data;
        if (taskData.task && taskData.task.status === 'FAILED') {
            console.log('\n❌ 任务失败分析:');
            console.log('- 任务状态:', taskData.task.status);
            console.log('- 错误信息:', taskData.task.error);
            console.log('- 错误详情:', taskData.task.errorDetails);
            console.log('- 任务对象:', JSON.stringify(taskData.task, null, 2));
            
            // 检查是否是转场风格相关的问题
            if (taskData.task.parameters) {
                console.log('\n🔍 任务参数分析:');
                console.log('- 转场风格参数:', taskData.task.parameters.TransitionStyle);
                console.log('- 所有参数:', JSON.stringify(taskData.task.parameters, null, 2));
            }
        } else if (taskData.task && taskData.task.status === 'SUCCEEDED') {
            console.log('\n✅ 任务成功完成');
            console.log('- 视频URL:', taskData.task.videoUrl);
            console.log('- 视频封面:', taskData.task.videoCoverUrl);
            console.log('- 视频时长:', taskData.task.videoDuration);
        } else {
            console.log('\n⏳ 任务仍在处理中，状态:', taskData.task ? taskData.task.status : '未知');
        }
        
    } catch (error) {
        console.error('\n❌ 调试过程中出现错误:');
        if (error.response) {
            console.error('HTTP状态码:', error.response.status);
            console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('错误信息:', error.message);
        }
        console.error('完整错误:', error);
    }
}

// 运行调试
debugTestMode();
