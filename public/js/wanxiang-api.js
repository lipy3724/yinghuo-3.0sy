/**
 * 通义万相API封装
 * 用于指令编辑功能的图像处理
 */

window.wanxiangApi = {
    /**
     * 创建图像编辑任务
     * @param {string} prompt - 编辑指令
     * @param {string} imageUrl - 图片URL
     * @returns {Promise<string>} 任务ID
     */
    async createImageEditTask(prompt, imageUrl) {
        try {
            console.log('🔍 调试 - 创建图像编辑任务开始');
            console.log('🔍 调试 - 提示词:', prompt);
            console.log('🔍 调试 - 图片URL:', imageUrl);
            
            const authToken = localStorage.getItem('authToken');
            const userInfo = localStorage.getItem('user');
            
            console.log('🔍 调试 - wanxiang-api认证检查:');
            console.log('🔍 调试 - authToken存在:', !!authToken);
            console.log('🔍 调试 - authToken前10位:', authToken ? authToken.substring(0, 10) + '...' : 'null');
            console.log('🔍 调试 - userInfo存在:', !!userInfo);
            
            if (!authToken) {
                console.error('🔍 调试 - 认证失败：authToken不存在');
                throw new Error('用户未登录');
            }
            
            console.log('🔍 调试 - 准备发送API请求到:', '/api/image-edit/create');
            console.log('🔍 调试 - 请求体:', JSON.stringify({
                prompt: prompt,
                imageUrl: imageUrl
            }));
            
            const response = await fetch('/api/image-edit/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    prompt: prompt,
                    imageUrl: imageUrl
                })
            });
            
            console.log('🔍 调试 - API响应状态:', response.status);
            console.log('🔍 调试 - API响应状态文本:', response.statusText);
            console.log('🔍 调试 - API响应头:', Object.fromEntries(response.headers.entries()));
            
            const data = await response.json();
            console.log('🔍 调试 - 创建任务响应数据:', data);
            
            if (!response.ok) {
                throw new Error(data.message || '创建任务失败');
            }
            
            if (data.success && data.data && data.data.taskId) {
                return data.data.taskId;
            } else {
                throw new Error(data.message || '创建任务失败');
            }
        } catch (error) {
            console.error('创建图像编辑任务失败:', error);
            throw error;
        }
    },

    /**
     * 轮询任务状态
     * @param {string} taskId - 任务ID
     * @param {function} progressCallback - 进度回调函数
     * @returns {Promise<string>} 结果图片URL
     */
    async pollTaskStatus(taskId, progressCallback = null) {
        try {
            console.log('🔍 调试 - 开始轮询任务状态');
            console.log('🔍 调试 - 任务ID:', taskId);
            
            const authToken = localStorage.getItem('authToken');
            console.log('🔍 调试 - pollTaskStatus认证检查:');
            console.log('🔍 调试 - authToken存在:', !!authToken);
            
            if (!authToken) {
                console.error('🔍 调试 - 轮询时认证失败：authToken不存在');
                throw new Error('用户未登录');
            }
            
            let attempts = 0;
            const maxAttempts = 60; // 最多轮询60次（5分钟）
            const pollInterval = 5000; // 每5秒轮询一次
            
            while (attempts < maxAttempts) {
                try {
                    console.log(`🔍 调试 - 第${attempts + 1}次轮询请求:`, `/api/image-edit/status/${taskId}`);
                    
                    const response = await fetch(`/api/image-edit/status/${taskId}`, {
                        headers: {
                            'Authorization': `Bearer ${authToken}`
                        }
                    });
                    
                    console.log(`🔍 调试 - 第${attempts + 1}次轮询响应状态:`, response.status);
                    
                    const data = await response.json();
                    console.log(`🔍 调试 - 第${attempts + 1}次轮询结果:`, data);
                    
                    if (!response.ok) {
                        throw new Error(data.message || '查询任务状态失败');
                    }
                    
                    if (data.success) {
                        // 处理新的API响应格式
                        const taskStatus = data.data?.output?.task_status;
                        const results = data.data?.output?.results;
                        const errorMessage = data.data?.output?.message;
                        
                        if (taskStatus === 'SUCCEEDED' && results && results.length > 0) {
                            console.log('任务完成，结果图片:', results[0].url);
                            return results[0].url;
                        } else if (taskStatus === 'FAILED') {
                            throw new Error(errorMessage || '图像编辑任务失败');
                        } else if (taskStatus === 'RUNNING' || taskStatus === 'PENDING') {
                            // 任务仍在进行中，继续轮询
                            console.log('任务进行中，继续等待...');
                            // 调用进度回调函数
                            if (progressCallback) {
                                progressCallback(taskStatus);
                            }
                        } else {
                            console.log('任务状态:', taskStatus, '继续等待...');
                            // 调用进度回调函数
                            if (progressCallback) {
                                progressCallback(taskStatus);
                            }
                        }
                    } else {
                        throw new Error(data.message || '查询任务状态失败');
                    }
                } catch (pollError) {
                    console.error(`第${attempts + 1}次轮询出错:`, pollError);
                    // 如果是网络错误，继续重试
                    if (pollError.message.includes('Failed to fetch') || pollError.message.includes('NetworkError')) {
                        console.log('网络错误，继续重试...');
                    } else {
                        throw pollError;
                    }
                }
                
                attempts++;
                
                // 等待指定时间后继续轮询
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                }
            }
            
            throw new Error('任务处理超时，请稍后查看历史记录');
        } catch (error) {
            console.error('轮询任务状态失败:', error);
            throw error;
        }
    }
};

console.log('通义万相API已加载');


