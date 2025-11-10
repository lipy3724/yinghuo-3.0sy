/**
 * 智能扩图功能优化版本
 * 主要优化点：
 * 1. 优化轮询策略，动态调整轮询间隔
 * 2. 增强错误处理和重试机制
 * 3. 改进用户体验和进度反馈
 */

// 初始化扩图功能
document.addEventListener('DOMContentLoaded', async function() {
    // 获取DOM元素
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const previewImage = document.getElementById('preview-image');
    const previewContainer = document.getElementById('preview-container');
    const promptInput = document.getElementById('prompt-input');
    const expandButton = document.getElementById('expand-button');
    const resultContainer = document.getElementById('result-container');
    const resultImage = document.getElementById('result-image');
    const loadingContainer = document.getElementById('loading-container');
    const loadingMessage = document.getElementById('loading-message');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    
    // 获取滑块控制元素
    const leftScale = document.getElementById('left-scale');
    const rightScale = document.getElementById('right-scale');
    const topScale = document.getElementById('top-scale');
    const bottomScale = document.getElementById('bottom-scale');
    const leftValue = document.getElementById('left-value');
    const rightValue = document.getElementById('right-value');
    const topValue = document.getElementById('top-value');
    const bottomValue = document.getElementById('bottom-value');
    
    // 初始化滑块显示值
    updateSliderValues();
    
    // 检查登录状态
    await checkLoginStatus();
    
    // 绑定事件处理
    bindEventHandlers();
    
    // 检查登录状态函数
    async function checkLoginStatus() {
        try {
            // 安全获取authToken
            let authToken = '';
            try {
                if (isLocalStorageAvailable()) {
                    authToken = localStorage.getItem('authToken') || '';
                }
            } catch (e) {
                console.error('获取authToken失败:', e);
            }
            
            if (!authToken) {
                console.log('用户未登录，跳转到登录页面');
                window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('检查登录状态失败:', error);
            return false;
        }
    }
    
    // 绑定事件处理函数
    function bindEventHandlers() {
        // 上传区域点击事件
        uploadArea.addEventListener('click', () => fileInput.click());
        
        // 文件选择事件
        fileInput.addEventListener('change', handleFileSelect);
        
        // 拖放事件
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
        
        // 扩展按钮点击事件
        expandButton.addEventListener('click', handleExpand);
        
        // 滑块值变化事件
        leftScale.addEventListener('input', updateSliderValues);
        rightScale.addEventListener('input', updateSliderValues);
        topScale.addEventListener('input', updateSliderValues);
        bottomScale.addEventListener('input', updateSliderValues);
    }
    
    // 更新滑块显示值
    function updateSliderValues() {
        leftValue.textContent = leftScale.value + 'x';
        rightValue.textContent = rightScale.value + 'x';
        topValue.textContent = topScale.value + 'x';
        bottomValue.textContent = bottomScale.value + 'x';
    }
    
    // 处理文件选择
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            processSelectedFile(file);
        }
    }
    
    // 处理拖拽悬停
    function handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        uploadArea.classList.add('border-indigo-500', 'bg-indigo-50');
    }
    
    // 处理拖拽离开
    function handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        uploadArea.classList.remove('border-indigo-500', 'bg-indigo-50');
    }
    
    // 处理拖拽放置
    function handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        uploadArea.classList.remove('border-indigo-500', 'bg-indigo-50');
        
        const file = event.dataTransfer.files[0];
        if (file) {
            processSelectedFile(file);
        }
    }
    
    // 处理扩展按钮点击
    async function handleExpand() {
        if (!previewImage.src || previewImage.src.includes('placeholder.svg')) {
            alert('请先上传图片');
            return;
        }
        
        // 禁用扩展按钮
        expandButton.disabled = true;
        expandButton.classList.add('opacity-50', 'cursor-not-allowed');
        expandButton.textContent = '处理中...';
        
        // 显示加载容器
        loadingContainer.classList.remove('hidden');
        loadingMessage.textContent = '正在准备任务...';
        
        // 初始化进度条
        progressContainer.classList.remove('hidden');
        progressBar.style.width = '5%';
        progressBar.style.backgroundColor = '#4f46e5';
        progressText.textContent = '5% - 准备中';
        
        try {
            // 获取提示词
            const prompt = promptInput.value.trim() || '延续图像内容';
            
            // 上传图片并获取URL
            const imageUrl = await uploadImageToServer(previewImage.src);
            
            // 更新进度条
            progressBar.style.width = '20%';
            progressText.textContent = '20% - 创建任务';
            loadingMessage.textContent = '正在创建扩图任务...';
            
            // 创建扩图任务
            const taskId = await createExpansionTask(prompt, imageUrl);
            
            if (taskId) {
                // 更新进度条
                progressBar.style.width = '30%';
                progressText.textContent = '30% - 任务已创建';
                loadingMessage.textContent = '任务已创建，正在处理中...';
                
                // 轮询任务状态
                const resultUrl = await pollTaskStatus(taskId);
                
                if (resultUrl) {
                    // 显示结果
                    displayResult(resultUrl);
                    
                    // 更新进度条
                    progressBar.style.width = '100%';
                    progressBar.style.backgroundColor = '#10b981';
                    progressText.textContent = '100% - 完成';
                    loadingMessage.textContent = '扩图完成！';
                    
                    // 2秒后隐藏加载容器
                    setTimeout(() => {
                        loadingContainer.classList.add('hidden');
                        progressContainer.classList.add('hidden');
                    }, 2000);
                } else {
                    // 任务失败或超时
                    throw new Error('扩图任务未返回有效结果');
                }
            } else {
                throw new Error('创建扩图任务失败');
            }
        } catch (error) {
            console.error('扩图处理错误:', error);
            
            // 更新进度条为错误状态
            progressBar.style.width = '100%';
            progressBar.style.backgroundColor = '#ef4444';
            progressText.textContent = '失败';
            
            // 显示错误消息
            loadingMessage.textContent = `扩图失败: ${error.message || '未知错误'}`;
            loadingMessage.style.color = '#ef4444';
            
            // 5秒后隐藏错误消息
            setTimeout(() => {
                loadingContainer.classList.add('hidden');
                progressContainer.classList.add('hidden');
                loadingMessage.style.color = '';
            }, 5000);
        } finally {
            // 恢复扩展按钮
            expandButton.disabled = false;
            expandButton.classList.remove('opacity-50', 'cursor-not-allowed');
            expandButton.textContent = '立即扩图';
        }
    }
    
    // 处理选中的文件
    function processSelectedFile(file) {
        if (!file.type.match('image.*')) {
            alert('请选择图片文件');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            previewImage.onload = function() {
                previewContainer.classList.remove('hidden');
                resultContainer.classList.add('hidden');
            };
        };
        reader.readAsDataURL(file);
    }
    
    // 上传图片到服务器
    async function uploadImageToServer(imageData) {
        try {
            loadingMessage.textContent = '正在上传图片...';
            
            // 将base64图片数据转换为Blob
            const blob = await fetch(imageData).then(res => res.blob());
            
            // 创建FormData对象
            const formData = new FormData();
            formData.append('image', blob, 'image.png');
            
            // 安全获取authToken
            let authToken = '';
            try {
                if (isLocalStorageAvailable()) {
                    authToken = localStorage.getItem('authToken') || '';
                }
            } catch (e) {
                console.error('获取authToken失败:', e);
            }
            
            // 设置请求超时
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
            
            // 发送请求
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`上传失败: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success || !data.url) {
                throw new Error(data.message || '上传失败，未获取到图片URL');
            }
            
            return data.url;
        } catch (error) {
            console.error('上传图片失败:', error);
            throw new Error(`上传图片失败: ${error.message}`);
        }
    }
    
    // 创建扩图任务
    async function createExpansionTask(prompt, imageUrl) {
        try {
            // 获取各个方向的扩展比例
            const leftScaleValue = parseFloat(leftScale.value);
            const rightScaleValue = parseFloat(rightScale.value);
            const topScaleValue = parseFloat(topScale.value);
            const bottomScaleValue = parseFloat(bottomScale.value);
            
            // 验证参数范围
            const maxScale = 2;
            if (leftScaleValue > maxScale || rightScaleValue > maxScale || topScaleValue > maxScale || bottomScaleValue > maxScale) {
                throw new Error(`扩展比例不能超过${maxScale}倍`);
            }
            
            // 安全获取authToken
            let authToken = '';
            try {
                if (isLocalStorageAvailable()) {
                    authToken = localStorage.getItem('authToken') || '';
                }
            } catch (e) {
                console.error('获取authToken失败:', e);
            }
            
            // 准备请求数据
            const requestData = {
                prompt: prompt || '延续图像内容',
                imageUrl: imageUrl,
                leftScale: leftScaleValue,
                rightScale: rightScaleValue,
                topScale: topScaleValue,
                bottomScale: bottomScaleValue,
                // 添加负面提示词，避免生成低质量内容
                negativePrompt: '模糊, 扭曲, 变形, 低质量',
                // 添加质量参数
                quality: 'standard'
            };
            
            // 设置请求超时
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
            
            // 发送请求
            const response = await fetch('/api/image-expansion/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(requestData),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`创建任务失败: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success || !data.taskId) {
                throw new Error(data.message || '创建任务失败，未获取到任务ID');
            }
            
            return data.taskId;
        } catch (error) {
            console.error('创建扩图任务失败:', error);
            throw new Error(`创建扩图任务失败: ${error.message}`);
        }
    }
    
    // 轮询任务状态 - 优化版
    async function pollTaskStatus(taskId) {
        // 轮询设置
        let pollInterval = 2000; // 初始轮询间隔2秒
        const maxPollInterval = 5000; // 最大轮询间隔5秒
        const minPollInterval = 1000; // 最小轮询间隔1秒
        const maxAttempts = 90; // 最大轮询次数，相当于3-5分钟
        let pollCount = 0;
        
        // 任务开始时间
        const taskStartTime = Date.now();
        // 预估完成时间（秒）
        const estimatedTime = 60;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                // 更新进度显示
                const elapsedSeconds = Math.floor((Date.now() - taskStartTime) / 1000);
                const progressPercent = Math.min(90, Math.floor(30 + (elapsedSeconds / estimatedTime) * 60));
                
                progressBar.style.width = `${progressPercent}%`;
                progressText.textContent = `${progressPercent}% - 处理中`;
                
                // 更新等待消息
                if (elapsedSeconds < 10) {
                    loadingMessage.textContent = '正在处理图像...';
                } else if (elapsedSeconds < 30) {
                    loadingMessage.textContent = '正在扩展图像内容...';
                } else if (elapsedSeconds < 60) {
                    loadingMessage.textContent = '正在优化生成结果...';
                } else {
                    loadingMessage.textContent = '任务处理中，请耐心等待...';
                }
                
                // 安全获取authToken
                let authToken = '';
                try {
                    if (isLocalStorageAvailable()) {
                        authToken = localStorage.getItem('authToken') || '';
                    }
                } catch (e) {
                    console.error('获取authToken失败:', e);
                }
                
                // 设置请求超时
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
                
                // 尝试多个API路径，提高成功率
                let response;
                let apiPaths = [
                    `/api/image-expansion/status/${taskId}`,
                    `/api/task/status/${taskId}`,
                    `/api/image-expansion/task/${taskId}`
                ];
                
                let lastError = null;
                
                // 尝试所有可能的API路径
                for (const apiPath of apiPaths) {
                    try {
                        response = await fetch(apiPath, {
                            headers: {
                                'Authorization': `Bearer ${authToken}`
                            },
                            signal: controller.signal
                        });
                        
                        if (response.ok) {
                            break; // 找到有效的API路径
                        }
                    } catch (pathError) {
                        lastError = pathError;
                        console.warn(`API路径 ${apiPath} 请求失败:`, pathError);
                        // 继续尝试下一个路径
                    }
                }
                
                clearTimeout(timeoutId);
                
                if (!response || !response.ok) {
                    throw new Error(lastError?.message || `所有API路径请求失败: ${response?.status} ${response?.statusText}`);
                }
                
                const data = await response.json();
                
                // 详细记录API响应
                console.log(`轮询 #${attempt + 1} 响应:`, data);
                
                // 检查任务状态
                const taskStatus = data.status || data.output?.task_status;
                
                if (taskStatus === 'SUCCEEDED') {
                    // 任务成功完成
                    let resultUrl = null;
                    
                    // 尝试从不同的响应结构中获取结果URL
                    if (data.resultUrl) {
                        resultUrl = data.resultUrl;
                    } else if (data.output?.images && data.output.images.length > 0) {
                        resultUrl = data.output.images[0].url;
                    } else if (data.output?.results && data.output.results.length > 0) {
                        resultUrl = data.output.results[0].url;
                    }
                    
                    if (resultUrl) {
                        return resultUrl;
                    } else {
                        throw new Error('任务完成但未返回有效的图像URL');
                    }
                } else if (taskStatus === 'FAILED') {
                    // 任务失败
                    const errorMessage = data.message || data.output?.error_message || '任务处理失败';
                    throw new Error(errorMessage);
                } else if (taskStatus === 'TIMEOUT') {
                    // 任务超时
                    throw new Error('任务处理超时');
                } else {
                    // 任务仍在处理中，继续轮询
                    pollCount++;
                    
                    // 动态调整轮询间隔
                    if (pollCount > 10) {
                        // 增加轮询间隔
                        pollInterval = Math.min(pollInterval * 1.2, maxPollInterval);
                    } else if (pollCount <= 3) {
                        // 初始几次快速轮询
                        pollInterval = minPollInterval;
                    }
                    
                    // 等待下一次轮询
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                }
            } catch (error) {
                console.error(`轮询第 ${attempt + 1} 次失败:`, error);
                
                // 网络错误时使用短间隔重试
                if (error.name === 'AbortError' || error.name === 'TypeError' || error.message.includes('NetworkError')) {
                    pollInterval = minPollInterval;
                }
                
                // 等待后重试
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }
        
        // 超过最大尝试次数，但不立即失败，尝试继续获取结果
        console.log(`轮询次数已达上限(${maxAttempts}次)，但任务可能仍在处理中，继续等待结果`);
        
        // 更新加载消息，提示用户任务处理中
        loadingMessage.textContent = '任务处理中，请继续等待...';
        loadingMessage.style.color = '#3b82f6'; // 蓝色提示更友好
        
        // 更新进度条显示
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = '#3b82f6'; // 蓝色进度条表示处理中
        progressText.textContent = '100% - 处理中，请等待';
        
        // 继续尝试获取结果，而不是立即退款
        try {
            console.log('继续尝试获取任务结果...');
            
            // 再多等待一段时间
            const extraWaitTime = 60000; // 额外等待60秒
            const checkInterval = 5000; // 每5秒检查一次
            const maxExtraChecks = extraWaitTime / checkInterval;
            
            for (let extraCheck = 0; extraCheck < maxExtraChecks; extraCheck++) {
                try {
                    // 更新提示信息
                    loadingMessage.textContent = `任务处理中，额外等待中 (${extraCheck + 1}/${maxExtraChecks})...`;
                    
                    // 等待间隔
                    await new Promise(resolve => setTimeout(resolve, checkInterval));
                    
                    // 安全获取authToken
                    let authToken = '';
                    try {
                        if (isLocalStorageAvailable()) {
                            authToken = localStorage.getItem('authToken') || '';
                        }
                    } catch (e) {
                        console.error('获取authToken失败:', e);
                    }
                    
                    // 尝试查询任务状态
                    const response = await fetch(`/api/image-expansion/status/${taskId}`, {
                        headers: {
                            'Authorization': `Bearer ${authToken}`
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`查询任务状态失败: ${response.status} ${response.statusText}`);
                    }
                    
                    const data = await response.json();
                    const taskStatus = data.status || data.output?.task_status;
                    
                    if (taskStatus === 'SUCCEEDED') {
                        console.log('额外等待后任务成功完成!');
                        
                        // 处理成功结果
                        let resultUrl = null;
                        if (data.resultUrl) {
                            resultUrl = data.resultUrl;
                        } else if (data.output?.images && data.output.images.length > 0) {
                            resultUrl = data.output.images[0].url;
                        } else if (data.output?.results && data.output.results.length > 0) {
                            resultUrl = data.output.results[0].url;
                        }
                        
                        if (resultUrl) {
                            return resultUrl;
                        }
                    } else if (taskStatus === 'FAILED') {
                        console.log('额外等待后任务失败');
                        break; // 退出循环，进行退款流程
                    } else {
                        console.log(`额外等待中，当前状态: ${taskStatus || 'PENDING'} (${extraCheck + 1}/${maxExtraChecks})`);
                    }
                } catch (checkError) {
                    console.warn(`额外等待检查出错 (${extraCheck + 1}/${maxExtraChecks}):`, checkError);
                    // 继续循环，不中断
                }
            }
            
            console.log('额外等待后仍未获得结果，准备退款');
            
            // 更新加载消息，提示用户任务处理超时
            loadingMessage.textContent = '任务处理超时，正在为您退款...';
            loadingMessage.style.color = '#ef4444'; // 红色提示更醒目
            
            // 更新进度条显示
            progressBar.style.backgroundColor = '#f87171'; // 红色进度条表示超时
            progressText.textContent = '100% - 处理超时';
            
            // 请求退款
            console.log('请求退款...');
            await requestRefund(taskId, '任务处理时间过长');
            
            // 等待一小段时间让用户看到退款提示
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 显示友好提示
            alert('处理时间超过预期，系统已自动退还您的积分。\n\n您可以稍后重新尝试生成。');
            
            // 返回null表示没有结果
            return null;
        } catch (finalError) {
            console.error('最终尝试获取结果失败:', finalError);
            throw new Error('任务处理超时，请稍后重试');
        }
    }
    
    // 请求退款
    async function requestRefund(taskId, reason) {
        try {
            console.log('请求退款，任务ID:', taskId);
            
            // 安全获取authToken
            let authToken = '';
            try {
                if (isLocalStorageAvailable()) {
                    authToken = localStorage.getItem('authToken') || '';
                }
            } catch (e) {
                console.error('获取authToken失败:', e);
            }
            
            // 统一使用公开退款API端点
            const endpoint = '/api/refund/image-expansion-fallback';
            
            console.log(`使用退款端点: ${endpoint}`);
            
            // 增加超时设置
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
            
            // 发送请求
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    taskId: taskId,
                    reason: reason || '任务处理失败'
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`退款请求失败: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            return {
                success: data.success,
                message: data.message || '退款请求已处理'
            };
        } catch (error) {
            console.error('请求退款失败:', error);
            return {
                success: false,
                message: `退款请求失败: ${error.message}`
            };
        }
    }
    
    // 显示结果
    function displayResult(imageUrl) {
        resultImage.onload = function() {
            resultContainer.classList.remove('hidden');
            // 添加下载按钮
            const downloadButton = document.getElementById('download-button');
            if (downloadButton) {
                downloadButton.classList.remove('hidden');
                downloadButton.href = imageUrl;
                downloadButton.download = 'expanded-image.png';
            }
        };
        resultImage.src = imageUrl;
    }
    
    // 检查localStorage是否可用
    function isLocalStorageAvailable() {
        try {
            const test = '__test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
});
