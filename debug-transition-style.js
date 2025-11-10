const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// 创建测试图片
function createTestImage(filename, width = 200, height = 200) {
    const pngHeader = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk header
        0x00, 0x00, 0x00, 0xC8, 0x00, 0x00, 0x00, 0xC8, // 200x200
        0x08, 0x02, 0x00, 0x00, 0x00, 0x4E, 0x1D, 0xB3, 0x44 // bit depth, color type, etc.
    ]);
    
    const pngData = Buffer.concat([
        pngHeader,
        Buffer.from([
            0x00, 0x00, 0x00, 0x09, 0x70, 0x48, 0x59, 0x73, // pHYs chunk
            0x00, 0x00, 0x0B, 0x13, 0x00, 0x00, 0x0B, 0x13,
            0x01, 0x00, 0x9A, 0x9C, 0x18,
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82 // IEND chunk
        ])
    ]);
    
    fs.writeFileSync(filename, pngData);
    console.log(`测试图片已创建: ${filename}`);
}

// 测试不同的TransitionStyle值
async function testTransitionStyles() {
    console.log('开始测试不同的TransitionStyle值...');
    
    // 要测试的转场效果值
    const transitionStyles = [
        'normal',    // 阿里云API可能支持的值
        'fade',      // 前端设置的值
        'basic',     // 可能的映射值
        'natural',   // 前端选项
        'slide',     // 前端选项
        'zoom',      // 前端选项
        'rotate',    // 前端选项
        '', // 空值
        undefined    // 未定义
    ];
    
    for (const transitionStyle of transitionStyles) {
        console.log(`\n=== 测试TransitionStyle: "${transitionStyle}" ===`);
        
        try {
            // 创建测试图片
            createTestImage('test1.png');
            createTestImage('test2.png');
            
            // 创建FormData
            const formData = new FormData();
            formData.append('images', fs.createReadStream('test1.png'));
            formData.append('images', fs.createReadStream('test2.png'));
            formData.append('sceneType', 'general');
            formData.append('width', '1280');
            formData.append('height', '720');
            formData.append('style', 'normal');
            if (transitionStyle !== undefined) {
                formData.append('transition', transitionStyle);
            }
            formData.append('duration', '10');
            
            // 使用有效的JWT令牌
            const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzAsImlzQWRtaW4iOmZhbHNlLCJpYXQiOjE3NTc0MDE1MDYsImV4cCI6MTc1OTk5MzUwNn0.z1QUiUVjZB-COMmWeHXDzMYTHN9BSq421Upaid8LP1Y';
            
            // 调用创建任务API
            const createResponse = await axios.post('http://localhost:8080/api/multi-image-to-video', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    ...formData.getHeaders()
                }
            });
            
            console.log('创建任务响应:', createResponse.data);
            
            if (createResponse.data.success && createResponse.data.taskId) {
                const taskId = createResponse.data.taskId;
                console.log(`✅ TransitionStyle "${transitionStyle}" 创建成功，任务ID: ${taskId}`);
                
                // 等待几秒后查询状态看错误信息
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                const statusResponse = await axios.get(`http://localhost:8080/api/tasks/${taskId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                console.log('任务状态:', statusResponse.data.status);
                if (statusResponse.data.result?.error) {
                    console.log('❌ 错误信息:', statusResponse.data.result.error);
                } else {
                    console.log('✅ 无错误信息');
                }
                
            } else {
                console.log('❌ 任务创建失败:', createResponse.data);
            }
            
        } catch (error) {
            console.error(`❌ TransitionStyle "${transitionStyle}" 测试失败:`, error.response?.data || error.message);
        } finally {
            // 清理测试文件
            try {
                fs.unlinkSync('test1.png');
                fs.unlinkSync('test2.png');
            } catch (cleanupError) {
                // 忽略清理错误
            }
        }
        
        // 等待一下再测试下一个值
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// 运行测试
testTransitionStyles();
