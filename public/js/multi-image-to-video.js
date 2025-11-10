// 全局变量
let uploadedImages = [];  // 存储上传的多张图片
let userCredits = 0;
let currentUser = null;
let taskId = null;
let pollingInterval = null;
let tasks = [];
let pollingIntervals = {};

// 使用统一的认证检查函数
async function checkLoginStatus() {
    // 优先使用统一的认证检查函数
    if (typeof window.checkAuth === 'function') {
        try {
            const isAuthenticated = await window.checkAuth(false); // 不自动重定向
            if (isAuthenticated) {
                const userInfo = localStorage.getItem('user');
                if (userInfo) {
                    try {
                        currentUser = JSON.parse(userInfo);
                        return true;
                    } catch (error) {
                        console.error('解析用户信息错误:', error);
                    }
                }
            }
            return false;
        } catch (error) {
            console.error('认证检查出错:', error);
            return false;
        }
    }
    
    // 后备的简单检查
    const authToken = localStorage.getItem('authToken');
    const userInfo = localStorage.getItem('user');
    
    if (authToken && userInfo) {
        try {
            currentUser = JSON.parse(userInfo);
            return true;
        } catch (error) {
            console.error('解析用户信息错误:', error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
        }
    }
    return false;
}

document.addEventListener('DOMContentLoaded', async function() {
    // 加载导航栏组件
    try {
        const navbarResponse = await fetch('/components/navbar-simple.html');
        const navbarHtml = await navbarResponse.text();
        document.getElementById('navbar-simple').innerHTML = navbarHtml;
    } catch (error) {
        console.error('加载导航栏组件失败:', error);
    }
    
    // 检查用户登录状态
    const isLoggedIn = await checkLoginStatus();
    if (!isLoggedIn) {
        window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
        return;
    }

    // DOM元素
    const uploadArea = document.getElementById('upload-area');
    const imageUpload = document.getElementById('image-upload');
    const thumbnailContainer = document.getElementById('thumbnail-container');
    const outputVideoContainer = document.getElementById('output-video-container');
    const outputVideo = document.getElementById('output-video');
    const outputVideoPlaceholder = document.getElementById('output-video-placeholder');
    const videoWrapper = document.getElementById('video-wrapper');
    const generateBtn = document.getElementById('generate-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    const tasksContainer = document.getElementById('tasks-container');
    const refreshTasksBtn = document.getElementById('refresh-tasks-btn');
    const clearAllTasksGlobalBtn = document.getElementById('clear-all-tasks-global-btn');
    
    // 新增DOM元素引用
    const sceneType = document.getElementById('scene-type');
    const videoWidth = document.getElementById('video-width');
    const videoHeight = document.getElementById('video-height');
    const videoStyle = document.getElementById('video-style');
    const transitionStyle = document.getElementById('transition-style');
    const duration = document.getElementById('duration');
    const durationError = document.getElementById('duration-error');
    
    // 初始化页面
    loadUserTasks();
    
    // 初始化按钮状态
    updateGenerateButtonState();
    
    // 视频时长验证函数
    function validateDuration() {
        const durationValue = parseFloat(duration.value);
        const isValid = !isNaN(durationValue) && durationValue >= 5 && durationValue <= 60;
        
        if (!isValid && duration.value !== '') {
            durationError.classList.remove('hidden');
            duration.classList.add('border-red-500');
            duration.classList.remove('border-gray-300');
            return false;
        } else {
            durationError.classList.add('hidden');
            duration.classList.remove('border-red-500');
            duration.classList.add('border-gray-300');
            return true;
        }
    }
    
    // 限制输入范围（只在失去焦点时执行）
    function limitDurationInput() {
        const originalValue = duration.value;
        const value = parseFloat(originalValue);
        
        // 如果输入为空，不进行任何处理
        if (originalValue === '') {
            return;
        }
        
        // 如果解析失败，恢复原始值
        if (isNaN(value)) {
            duration.value = originalValue;
            return;
        }
        
        // 限制范围
        if (value < 5) {
            duration.value = 5;
        } else if (value > 60) {
            duration.value = 60;
        } else {
            // 确保值为整数
            duration.value = Math.round(value);
        }
    }
    
    // 检查输入是否在有效范围内（不修改值，只用于验证）
    function isDurationInRange() {
        const value = parseFloat(duration.value);
        return !isNaN(value) && value >= 5 && value <= 60;
    }
    
    // 检查所有生成条件是否满足
    function checkGenerateConditions() {
        // 检查是否有至少2张图片
        const hasEnoughImages = uploadedImages.length >= 2;
        
        // 检查视频时长是否在有效范围内
        const hasValidDuration = isDurationInRange();
        
        // 检查是否有错误提示
        const hasNoErrors = !durationError.classList.contains('hidden') === false;
        
        return hasEnoughImages && hasValidDuration && hasNoErrors;
    }
    
    // 更新生成按钮状态
    function updateGenerateButtonState() {
        const canGenerate = checkGenerateConditions();
        
        if (canGenerate) {
            generateBtn.disabled = false;
            generateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            generateBtn.classList.add('hover:bg-indigo-700');
        } else {
            generateBtn.disabled = true;
            generateBtn.classList.add('opacity-50', 'cursor-not-allowed');
            generateBtn.classList.remove('hover:bg-indigo-700');
        }
    }
    
    // 视频时长输入框事件监听器
    duration.addEventListener('input', function(e) {
        // 防止输入非数字字符
        const value = e.target.value;
        const cleanValue = value.replace(/[^0-9]/g, '');
        
        if (value !== cleanValue) {
            e.target.value = cleanValue;
        }
        
        // 只进行验证，不修改值，让用户可以继续输入
        validateDuration();
        
        // 更新生成按钮状态
        updateGenerateButtonState();
    });
    
    duration.addEventListener('blur', function() {
        // 失去焦点时进行范围限制和整数化
        limitDurationInput();
        validateDuration();
        
        // 更新生成按钮状态
        updateGenerateButtonState();
    });
    
    duration.addEventListener('keypress', function(e) {
        // 只允许数字键
        const isNumber = (e.keyCode >= 48 && e.keyCode <= 57) || (e.keyCode >= 96 && e.keyCode <= 105);
        const isSpecialKey = [8, 9, 27, 46, 13]; // 退格、Tab、Esc、删除、回车
        
        if (!isNumber && !isSpecialKey.includes(e.keyCode)) {
            e.preventDefault();
        }
    });
    
    // 防止粘贴非数字内容
    duration.addEventListener('paste', function(e) {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text');
        const cleanPaste = paste.replace(/[^0-9]/g, '');
        if (cleanPaste) {
            duration.value = cleanPaste;
            // 只进行验证，不立即限制范围
            validateDuration();
            
            // 更新生成按钮状态
            updateGenerateButtonState();
        }
    });
    
    // 上传区域点击事件
    uploadArea.addEventListener('click', function() {
        imageUpload.click();
    });
    
    // 文件上传事件
    imageUpload.addEventListener('change', function(e) {
        handleFileUpload(e.target.files);
    });
    
    // 拖拽事件
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('highlight');
        });
        
    uploadArea.addEventListener('dragleave', function() {
        uploadArea.classList.remove('highlight');
        });
        
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('highlight');
        handleFileUpload(e.dataTransfer.files);
    });
    
    // 生成按钮点击事件
    generateBtn.addEventListener('click', async function() {
            if (uploadedImages.length < 2) {
            const uploadText = typeof translate === 'function' ? translate('multi_image_to_video.upload_at_least_2') : '请至少上传2张图片';
            alert(uploadText);
                return;
            }
            
            // 验证视频时长
            if (!validateDuration()) {
                const durationText = typeof translate === 'function' ? translate('multi_image_to_video.duration_invalid') : '请输入有效的视频时长（5-60秒）';
                alert(durationText);
                duration.focus();
                return;
            }
            
        await generateVideo();
    });
    
    
    // 刷新任务按钮点击事件
    refreshTasksBtn.addEventListener('click', function() {
        loadUserTasks();
    });
    
    // 清空所有任务按钮点击事件
    if (clearAllTasksGlobalBtn) {
        clearAllTasksGlobalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            confirmDeleteTask();
        });
    }
    
    // 处理文件上传
    function handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        // 检查文件数量限制
        if (uploadedImages.length + files.length > 20) {
            const maxImagesText = typeof translate === 'function' ? translate('multi_image_to_video.max_images') : '最多只能上传20张图片';
            alert(maxImagesText);
            return;
        }
        
        // 处理每个文件
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // 检查文件类型
            if (!file.type.startsWith('image/')) {
                const notImageText = typeof translate === 'function' ? translate('multi_image_to_video.not_image_file').replace('{name}', file.name) : `文件 "${file.name}" 不是图片格式`;
                alert(notImageText);
                continue;
            }
            
            // 检查文件大小
            if (file.size > 10 * 1024 * 1024) { // 10MB
                const tooLargeText = typeof translate === 'function' ? translate('multi_image_to_video.file_too_large').replace('{name}', file.name) : `文件 "${file.name}" 超过10MB大小限制`;
                alert(tooLargeText);
                continue;
            }
            
            // 添加到上传列表
            uploadedImages.push(file);
            
            // 创建缩略图
            createThumbnail(file, uploadedImages.length - 1);
        }
                
        // 显示缩略图容器
        if (uploadedImages.length > 0) {
            thumbnailContainer.classList.remove('hidden');
        }
        
        // 更新生成按钮状态
        updateGenerateButtonState();
    }
    
    // 创建缩略图
    function createThumbnail(file, index) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const thumbnailItem = document.createElement('div');
            thumbnailItem.className = 'thumbnail-item';
            thumbnailItem.dataset.index = index;
            
            thumbnailItem.innerHTML = `
                <div class="thumbnail">
                    <img src="${e.target.result}" alt="缩略图">
                    <span class="order-badge">${index + 1}</span>
                    <button class="delete-btn">×</button>
                </div>
            `;
            
            // 删除按钮点击事件
            const deleteBtn = thumbnailItem.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                uploadedImages.splice(index, 1);
                refreshThumbnails();
                
                // 更新生成按钮状态
                updateGenerateButtonState();
        });
        
            // 拖拽功能
            thumbnailItem.setAttribute('draggable', true);
            thumbnailItem.addEventListener('dragstart', handleDragStart);
            thumbnailItem.addEventListener('dragover', handleDragOver);
            thumbnailItem.addEventListener('dragleave', handleDragLeave);
            thumbnailItem.addEventListener('drop', handleDrop);
            thumbnailItem.addEventListener('dragend', handleDragEnd);
            
            thumbnailContainer.appendChild(thumbnailItem);
        };
        
        reader.readAsDataURL(file);
    }
    
    // 刷新所有缩略图
    function refreshThumbnails() {
        thumbnailContainer.innerHTML = '';
        
        if (uploadedImages.length === 0) {
            thumbnailContainer.classList.add('hidden');
            return;
        }
        
        uploadedImages.forEach((file, index) => {
            createThumbnail(file, index);
        });
    }
    
    // 拖拽相关函数
        let dragSrcEl = null;
        
        function handleDragStart(e) {
            dragSrcEl = this;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
        this.classList.add('dragging');
        }
        
        function handleDragOver(e) {
                e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        this.classList.add('over');
            return false;
        }
        
    function handleDragLeave() {
            this.classList.remove('over');
        }
        
        function handleDrop(e) {
            e.stopPropagation();
            
            if (dragSrcEl !== this) {
                // 交换位置
            const fromIndex = parseInt(dragSrcEl.dataset.index);
            const toIndex = parseInt(this.dataset.index);
            
            // 交换数组中的元素
            const temp = uploadedImages[fromIndex];
            uploadedImages[fromIndex] = uploadedImages[toIndex];
            uploadedImages[toIndex] = temp;
                    
            // 刷新缩略图
            refreshThumbnails();
            
            // 更新生成按钮状态
            updateGenerateButtonState();
            }
            
            return false;
        }
        
    function handleDragEnd() {
        const items = document.querySelectorAll('.thumbnail-item');
        items.forEach(item => {
            item.classList.remove('over');
            item.classList.remove('dragging');
        });
    }
    
    // 生成视频
    async function generateVideo() {
        try {
            loadingOverlay.classList.remove('hidden');
                
            // 准备表单数据
                const formData = new FormData();
                
            // 添加图片文件
            uploadedImages.forEach((file, index) => {
                formData.append('images', file);
            });
                
            // 添加参数
            formData.append('sceneType', sceneType.value);
            formData.append('width', videoWidth.value);
            formData.append('height', videoHeight.value);
            formData.append('style', videoStyle.value);
            formData.append('transition', transitionStyle.value);
            formData.append('duration', duration.value);
            
            // 发送请求
            const response = await fetch('/api/multi-image-to-video', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                // 显示详细的错误信息
                let errorMessage = typeof translate === 'function' ? translate('multi_image_to_video.generate_failed') : '视频生成请求失败';
                if (data.message) {
                    errorMessage = data.message;
                } else if (data.error) {
                    errorMessage = data.error;
                } else if (data.details && data.details.message) {
                    errorMessage = data.details.message;
                }
                
                console.error('视频生成请求失败详情:', {
                    status: response.status,
                    statusText: response.statusText,
                    data: data
                });
                
                throw new Error(errorMessage);
            }
            
            // 保存任务ID
                taskId = data.taskId;
                console.log('收到taskId:', taskId, '类型:', typeof taskId);
                
                // 确保taskId是字符串
                if (typeof taskId === 'object') {
                    console.error('taskId是对象，内容:', JSON.stringify(taskId));
                    taskId = String(taskId);
                } else if (taskId === undefined || taskId === null) {
                    console.error('taskId是undefined或null');
                    taskId = null;
                }
                
                // 开始轮询任务状态
            startPolling();
            
        } catch (error) {
            console.error('生成视频出错:', error);
            const failedText = typeof translate === 'function' ? translate('multi_image_to_video.generate_failed') : '生成视频失败';
            alert(failedText + ': ' + error.message);
            loadingOverlay.classList.add('hidden');
        }
    }
    
    // 开始轮询任务状态
    function startPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }
        
        pollingInterval = setInterval(checkTaskStatus, 5000);
        checkTaskStatus(); // 立即检查一次
    }
    
    // 检查任务状态
    async function checkTaskStatus() {
        if (!taskId) return;
        
        // 确保taskId是字符串
        const taskIdStr = String(taskId);
        console.log('查询任务状态，taskId:', taskIdStr, '类型:', typeof taskIdStr);
        
        try {
            const response = await fetch(`/api/multi-image-to-video/status/${taskIdStr}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            const data = await response.json();
            
            console.log(`[多图转视频] 任务状态响应:`, data);
            
            if (!response.ok) {
                // 显示详细的错误信息
                let errorMessage = '检查任务状态失败';
                if (data.message) {
                    errorMessage = data.message;
                } else if (data.error) {
                    errorMessage = data.error;
                }
                
                console.error('任务状态查询失败详情:', {
                    status: response.status,
                    statusText: response.statusText,
                    data: data
                });
                
                throw new Error(errorMessage);
            }
            
            // 根据任务状态处理 - 修复：从data.task.status获取状态
            const taskStatus = data.task ? data.task.status : data.status;
            console.log(`[多图转视频] 当前状态: ${taskStatus}`);
            console.log(`[多图转视频] 完整响应数据:`, data);
            
            switch (taskStatus) {
                case 'SUCCEEDED':
                case 'completed':
                        clearInterval(pollingInterval);
                        pollingInterval = null;
                        loadingOverlay.classList.add('hidden');
                    
                    console.log(`[多图转视频] 任务完成，完整响应数据:`, data);
                    
                    // 修复：正确解析视频URL，支持多种响应格式
                    let videoUrl = null;
                    let videoCoverUrl = null;
                    let videoDuration = null;
                    let videoWidth = null;
                    let videoHeight = null;
                    
                    // 优先从data.task中获取视频信息
                    if (data.task) {
                        console.log(`[多图转视频] data.task完整内容:`, JSON.stringify(data.task, null, 2));
                        
                        videoUrl = data.task.videoUrl;
                        videoCoverUrl = data.task.videoCoverUrl || null;
                        videoDuration = data.task.videoDuration || null;
                        videoWidth = data.task.videoWidth || null;
                        videoHeight = data.task.videoHeight || null;
                        console.log(`[多图转视频] 从data.task获取视频URL:`, videoUrl);
                        
                        // 如果videoUrl为null，尝试其他可能的字段
                        if (!videoUrl) {
                            console.log(`[多图转视频] videoUrl为null，尝试其他字段...`);
                            console.log(`[多图转视频] 可用的字段:`, Object.keys(data.task));
                            
                            // 尝试多种可能的字段名
                            videoUrl = data.task.VideoUrl || data.task.video_url || data.task.url || data.task.Url || 
                                     data.task.videoUrl || data.task.videoUrl || data.task.result?.VideoUrl || 
                                     data.task.result?.videoUrl || data.task.result?.video_url || null;
                            
                            // 同样尝试其他视频信息字段
                            if (!videoCoverUrl) {
                                videoCoverUrl = data.task.VideoCoverUrl || data.task.video_cover_url || 
                                             data.task.coverUrl || data.task.CoverUrl || 
                                             data.task.result?.VideoCoverUrl || data.task.result?.videoCoverUrl || null;
                            }
                            
                            if (!videoDuration) {
                                videoDuration = data.task.Duration || data.task.duration || 
                                             data.task.result?.Duration || data.task.result?.duration || null;
                            }
                            
                            if (!videoWidth) {
                                videoWidth = data.task.Width || data.task.width || 
                                          data.task.result?.Width || data.task.result?.width || null;
                            }
                            
                            if (!videoHeight) {
                                videoHeight = data.task.Height || data.task.height || 
                                           data.task.result?.Height || data.task.result?.height || null;
                            }
                            
                            console.log(`[多图转视频] 尝试其他字段后的videoUrl:`, videoUrl);
                            console.log(`[多图转视频] 尝试其他字段后的videoCoverUrl:`, videoCoverUrl);
                        }
                    }
                    // 检查直接返回的videoUrl字段
                    else if (data.videoUrl) {
                        videoUrl = data.videoUrl;
                        videoCoverUrl = data.videoCoverUrl || null;
                        videoDuration = data.videoDuration || null;
                        videoWidth = data.videoWidth || null;
                        videoHeight = data.videoHeight || null;
                        console.log(`[多图转视频] 从直接字段获取视频URL:`, videoUrl);
                    }
                    // 检查result字段（可能是字符串或对象）
                    else if (data.result) {
                        let resultObj = data.result;
                        
                        // 如果result是字符串，尝试解析为JSON
                        if (typeof data.result === 'string') {
                            try {
                                resultObj = JSON.parse(data.result);
                                console.log(`[多图转视频] 解析result字符串为对象:`, resultObj);
                            } catch (e) {
                                console.error(`[多图转视频] 解析result字符串失败:`, e);
                                resultObj = null;
                            }
                        }
                        
                        // 检查解析后的对象中的videoUrl字段
                        if (resultObj && resultObj.videoUrl) {
                            videoUrl = resultObj.videoUrl;
                            videoCoverUrl = resultObj.videoCoverUrl || null;
                            videoDuration = resultObj.videoDuration || null;
                            videoWidth = resultObj.videoWidth || null;
                            videoHeight = resultObj.videoHeight || null;
                            console.log(`[多图转视频] 从result对象获取videoUrl:`, videoUrl);
                        }
                        // 检查解析后的对象中的VideoUrl字段（大写V）
                        else if (resultObj && resultObj.VideoUrl) {
                            videoUrl = resultObj.VideoUrl;
                            videoCoverUrl = resultObj.VideoCoverUrl || null;
                            videoDuration = resultObj.Duration || null;
                            videoWidth = resultObj.Width || null;
                            videoHeight = resultObj.Height || null;
                            console.log(`[多图转视频] 从result对象获取VideoUrl:`, videoUrl);
                        }
                    }
                    
                    if (videoUrl) {
                        console.log(`[多图转视频] 成功获取视频URL:`, videoUrl);
                        console.log(`[多图转视频] 视频封面URL:`, videoCoverUrl);
                        console.log(`[多图转视频] 视频时长:`, videoDuration);
                        console.log(`[多图转视频] 视频尺寸:`, videoWidth, 'x', videoHeight);
                        
                        // 创建结果对象
                        const resultData = {
                            videoUrl: videoUrl,
                            videoCoverUrl: videoCoverUrl,
                            videoDuration: videoDuration,
                            videoWidth: videoWidth,
                            videoHeight: videoHeight,
                            taskId: data.taskId || taskId,
                            timestamp: new Date().toISOString()
                        };
                        
                        displayVideo(videoUrl);
                        
                        // 将任务添加到任务列表
                        const newTask = {
                            id: data.taskId || taskId,
                            status: 'SUCCEEDED',
                            videoUrl: videoUrl,
                            videoCoverUrl: videoCoverUrl,
                            videoDuration: videoDuration,
                            videoWidth: videoWidth,
                            videoHeight: videoHeight,
                            imageCount: uploadedImages.length,
                            duration: duration.value,
                            creditCost: data.task?.creditCost || 0,
                            isFree: data.task?.isFree || false,
                            createdAt: new Date().toISOString(),
                            // 🎯 添加视频参数字段，确保任务列表可以立即显示具体的转场风格、视频风格等信息
                            transition: data.task?.transition || null,
                            style: data.task?.style || null,
                            sceneType: data.task?.sceneType || null
                        };
                        
                        // 添加到任务列表开头
                        tasks.unshift(newTask);
                        
                        // 重新渲染任务列表
                        renderTasks();
                    } else {
                        console.error(`[多图转视频] 任务完成但缺少视频URL:`, data);
                        console.error(`[多图转视频] 可用的字段:`, Object.keys(data));
                        if (data.result) {
                            console.error(`[多图转视频] result字段内容:`, data.result);
                            console.error(`[多图转_video] result字段类型:`, typeof data.result);
                        }
                        const missingUrlText = typeof translate === 'function' ? translate('multi_image_to_video.video_generated_failed') : '视频生成完成但缺少视频URL，请重试';
                        alert(missingUrlText);
                    }
                    break;
                    
                case 'FAILED':
                case 'failed':
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                    loadingOverlay.classList.add('hidden');
                    
                    // 获取详细的错误信息
                    let errorMessage = '未知错误';
                    let errorDetails = null;
                    
                    if (data.task && data.task.error) {
                        errorMessage = data.task.error;
                        errorDetails = data.task.errorDetails;
                    } else if (data.result && data.result.error) {
                        errorMessage = data.result.error;
                    } else if (data.error) {
                        errorMessage = data.error;
                    } else if (data.message) {
                        errorMessage = data.message;
                    }
                    
                    console.error('视频生成失败详情:', {
                        taskStatus: taskStatus,
                        task: data.task,
                        result: data.result,
                        error: data.error,
                        message: data.message,
                        fullData: data
                    });
                    
                    // 显示详细的错误信息
                    const failedText = typeof translate === 'function' ? translate('multi_image_to_video.video_generated_failed') : '视频生成失败';
                    let displayMessage = failedText + ': ' + errorMessage;
                    if (errorDetails && errorDetails.message) {
                        displayMessage += '\n详细信息: ' + errorDetails.message;
                    }
                    if (errorDetails && errorDetails.code) {
                        displayMessage += '\n错误代码: ' + errorDetails.code;
                    }
                    
                    alert(displayMessage);
                    break;
                    
                case 'PENDING':
                case 'RUNNING':
                case 'processing':
                    // 继续等待
                    break;
                    
                case 'UNKNOWN':
                    console.log('任务状态为UNKNOWN，继续等待...');
                    // 继续等待，不做其他处理
                    break;
                    
                default:
                    console.warn('未知任务状态:', taskStatus);
                    // 对于未知状态，继续等待
                    break;
                }
            
        } catch (error) {
            console.error('检查任务状态出错:', error);
            // 出错时不停止轮询，继续尝试
        }
    }
    
    // 显示视频
    function displayVideo(videoUrl) {
        console.log('显示视频，URL:', videoUrl);
        
        if (!videoUrl) {
            console.error('视频URL为空，无法显示视频');
            const emptyUrlText = typeof translate === 'function' ? translate('multi_image_to_video.video_generated_failed') : '视频URL为空，无法播放视频';
            alert(emptyUrlText);
            return;
        }
        
        // 设置视频源
        outputVideo.src = videoUrl;
        
        // 添加视频加载事件监听器
        outputVideo.addEventListener('loadedmetadata', function() {
            console.log('视频元数据加载完成，时长:', outputVideo.duration, '秒');
            console.log('视频尺寸:', outputVideo.videoWidth, 'x', outputVideo.videoHeight);
        });
        
        outputVideo.addEventListener('loadeddata', function() {
            console.log('视频数据加载完成');
        });
        
        outputVideo.addEventListener('canplay', function() {
            console.log('视频可以开始播放');
        });
        
        outputVideo.addEventListener('error', function(e) {
            console.error('视频加载错误:', e);
            console.error('视频错误详情:', outputVideo.error);
            const loadFailedText = typeof translate === 'function' ? translate('multi_image_to_video.video_generated_failed') : '视频加载失败，请检查视频URL是否正确';
            alert(loadFailedText);
        });
        
        // 显示视频容器
        outputVideoPlaceholder.classList.add('hidden');
        videoWrapper.classList.remove('hidden');
        
        // 尝试加载视频
        outputVideo.load();
    }
    
    // 加载用户任务
    function loadUserTasks() {
        if (!localStorage.getItem('authToken')) {
            console.log('用户未登录，不加载任务');
            return;
        }
        
        console.log('加载用户多图转视频任务...');
        
        // 检查本地存储中是否有任务数据
        const localTasks = JSON.parse(localStorage.getItem('multiImageToVideoTasks') || '[]');
        console.log('本地存储中的任务数量:', localTasks.length);
        if (localTasks.length > 0) {
            console.log('⚠️ 发现本地存储中有任务数据:', localTasks);
        }
        
        fetch('/api/multi-image-to-video/tasks', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('✅ 从OSS加载多图转视频任务数据:', data);
            console.log('任务来源: OSS存储');
            // 修复数据结构：服务器返回 { success: true, data: tasks }
            const ossTasks = data.data || data.tasks || [];
            console.log(`从OSS获取到 ${ossTasks.length} 个任务`);
            
            if (ossTasks.length > 0) {
                console.log('OSS任务详情:', ossTasks);
            }
            
            tasks = ossTasks;
            renderTasks();
        })
        .catch(error => {
            console.error('❌ 加载多图转视频任务失败:', error);
            console.log('⚠️ 尝试从本地存储加载任务（备用方案）');
            // 如果API失败，尝试从本地存储加载
            loadTasksFromLocalStorage();
        });
    }
    
    // 从本地存储加载任务（备用方案）
    function loadTasksFromLocalStorage() {
        const localTasks = JSON.parse(localStorage.getItem('multiImageToVideoTasks') || '[]');
        console.log('⚠️ 从本地存储加载任务（备用方案）');
        console.log('任务来源: 浏览器本地存储 (localStorage)');
        console.log(`本地存储中的任务数量: ${localTasks.length}`);
        if (localTasks.length > 0) {
            console.log('本地存储任务详情:', localTasks);
            console.warn('⚠️ 这些任务来自本地存储，可能是旧数据。如果不需要，可以清空本地存储。');
        }
        tasks = localTasks;
        renderTasks();
    }
    
    // 删除任务
    async function deleteTask(taskId) {
        const deleteConfirmText = typeof translate === 'function' ? translate('multi_image_to_video.delete_confirm') || '确定要删除这个任务吗？' : '确定要删除这个任务吗？';
        if (!confirm(deleteConfirmText)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/multi-image-to-video/tasks/${taskId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const deleteFailedText = typeof translate === 'function' ? translate('multi_image_to_video.delete_failed') || '删除任务失败' : '删除任务失败';
                throw new Error(deleteFailedText);
            }
            
            // 从本地任务列表中移除
            tasks = tasks.filter(task => task.id !== taskId);
            renderTasks();
            
            const deleteSuccessText = typeof translate === 'function' ? translate('multi_image_to_video.delete_success') || '任务删除成功' : '任务删除成功';
            showToast(deleteSuccessText, 'success');
        } catch (error) {
            console.error('删除任务失败:', error);
            const deleteFailedText = typeof translate === 'function' ? translate('multi_image_to_video.delete_failed') || '删除任务失败' : '删除任务失败';
            showToast(deleteFailedText, 'error');
        }
    }
    
    // 清空所有任务
    async function clearAllTasks() {
        console.log('开始执行清空所有任务操作');
        
        try {
            const response = await fetch('/api/multi-image-to-video/tasks/clear-all', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('清空任务API响应状态:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('清空任务API错误:', errorData);
                throw new Error(errorData.message || '清空任务失败');
            }
            
            const result = await response.json();
            console.log('清空任务API响应:', result);
            
            // 清空本地任务列表
            tasks = [];
            renderTasks();
            
            // 同时清空本地存储中的任务数据
            localStorage.removeItem('multiImageToVideoTasks');
            console.log('✅ 已清空本地存储中的任务数据');
            
            console.log('本地任务列表已清空，重新渲染完成');
            const clearSuccessText = typeof translate === 'function' ? translate('multi_image_to_video.clear_all_success') : '所有任务已清空';
            showToast(clearSuccessText, 'success');
        } catch (error) {
            console.error('清空任务失败:', error);
            const clearFailedText = typeof translate === 'function' ? translate('multi_image_to_video.clear_all_failed') : '清空任务失败';
            showToast(clearFailedText + ': ' + error.message, 'error');
        }
    }
    
    // 渲染任务列表
    function renderTasks() {
        if (!tasksContainer) {
            console.error('找不到任务容器元素！');
            return;
        }

        if (tasks.length === 0) {
            const noTasksText = typeof translate === 'function' ? translate('multi_image_to_video.no_tasks') : '暂无视频生成记录';
            const tasksDescText = typeof translate === 'function' ? translate('multi_image_to_video.tasks_description') : '仅显示24小时内的最新记录';
            tasksContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <p>${noTasksText}</p>
                    <p class="text-sm mt-2 text-gray-400">${tasksDescText}</p>
                </div>
            `;
            return;
        }
        
        // 按创建时间降序排序
        tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // 只显示最新的记录
        const tasksToShow = tasks.slice(0, 1);
        
        // 清空容器
        tasksContainer.innerHTML = '';
        
        // 渲染每个任务
        tasksToShow.forEach(task => {
            const taskElement = createTaskElement(task);
            tasksContainer.appendChild(taskElement);
            
            // 为进行中的任务启动轮询
            if (task.status === 'PENDING' || task.status === 'RUNNING' || 
                task.status === 'processing' || task.status === 'UNKNOWN') {
                startPollingTaskStatus(task.id);
            }
        });
    }
    
    // 创建单个任务元素
    function createTaskElement(task) {
        const taskElement = document.createElement('div');
        taskElement.className = 'video-task bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4';
        taskElement.id = `task-${task.id}`;
        
        // 任务状态标识
        let statusClass, statusText;
        
        switch (task.status) {
            case 'PENDING':
                statusClass = 'bg-yellow-100 text-yellow-800';
                statusText = typeof translate === 'function' ? translate('multi_image_to_video.status_pending') : '排队中';
                break;
            case 'RUNNING':
            case 'processing':
                statusClass = 'bg-blue-100 text-blue-800';
                statusText = typeof translate === 'function' ? translate('multi_image_to_video.status_running') : '生成中';
                break;
            case 'SUCCEEDED':
            case 'completed':
                statusClass = 'bg-green-100 text-green-800';
                statusText = typeof translate === 'function' ? translate('multi_image_to_video.status_completed') : '已完成';
                break;
            case 'FAILED':
            case 'failed':
                statusClass = 'bg-red-100 text-red-800';
                statusText = typeof translate === 'function' ? translate('multi_image_to_video.status_failed') : '失败';
                break;
            case 'UNKNOWN':
                statusClass = 'bg-yellow-100 text-yellow-800';
                statusText = typeof translate === 'function' ? translate('multi_image_to_video.status_processing') : '处理中';
                break;
            default:
                statusClass = 'bg-gray-100 text-gray-800';
                statusText = typeof translate === 'function' ? translate('multi_image_to_video.status_processing') : '未知状态';
        }
        
        // 视频预览（仅当任务成功且有视频URL时）
        let videoPreview = '';
        if ((task.status === 'SUCCEEDED' || task.status === 'completed') && task.videoUrl) {
            videoPreview = `
                <div class="mt-3">
                    <video controls class="w-full rounded" style="max-height: 180px">
                        <source src="${task.videoUrl}" type="video/mp4">
                        ${typeof translate === 'function' ? translate('multi_image_to_video.video_not_supported') || '您的浏览器不支持视频标签' : '您的浏览器不支持视频标签'}
                    </video>
                        <button class="text-indigo-600 hover:text-indigo-800 text-sm preview-btn" data-url="${task.videoUrl}">
                            <i class="ri-fullscreen-line mr-1"></i>${typeof translate === 'function' ? translate('multi_image_to_video.preview') : '预览'}
                        </button>
                    </div>
                </div>
            `;
        }
        
        // 格式化时间戳
        const createdDate = new Date(task.createdAt);
        const formattedDate = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}-${String(createdDate.getDate()).padStart(2, '0')} ${String(createdDate.getHours()).padStart(2, '0')}:${String(createdDate.getMinutes()).padStart(2, '0')}`;
        
        // 获取图片数量信息
        const imageCount = task.imageCount || (typeof translate === 'function' ? translate('multi_image_to_video.multiple_images') || '多张' : '多张');
        
        // 转场风格映射表（支持多语言）
        const getTransitionName = (style) => {
            if (!style) return typeof translate === 'function' ? translate('multi_image_to_video.transition_random') : '随机';
            const key = `multi_image_to_video.transition_${style}`;
            if (typeof translate === 'function') {
                const translated = translate(key);
                // 如果翻译存在且不是键本身，返回翻译；否则返回默认值
                if (translated && translated !== key) {
                    // 提取括号前的部分（去掉英文说明）
                    return translated.split(' (')[0] || translated;
                }
            }
            // 默认中文映射
            const defaultNames = {
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
                'smog': '烟雾'
            };
            return defaultNames[style] || style || '随机';
        };
        
        // 获取转场风格显示名称
        const transitionStyle = task.transition || '';
        const transitionDisplayName = getTransitionName(transitionStyle);
        
        // 不再显示积分信息
        
        const multiImageText = typeof translate === 'function' ? translate('multi_image_to_video.main_title') : '多图转视频';
        const imagesText = typeof translate === 'function' ? translate('multi_image_to_video.images') || '张图片' : '张图片';
        const transitionText = typeof translate === 'function' ? translate('multi_image_to_video.transition') || '转场' : '转场';
        const secondsText = typeof translate === 'function' ? translate('multi_image_to_video.seconds') || '秒' : '秒';
        
        taskElement.innerHTML = `
            <div class="flex justify-between">
                <div class="flex-1 pr-4">
                    <p class="font-medium">${multiImageText} (${imageCount}${imagesText})</p>
                    <div class="flex mt-2 text-sm text-gray-500">
                        <span class="mr-4">${multiImageText}</span>
                        <span class="mr-4">${task.duration || 10}${secondsText}</span>
                        <span class="mr-4">${transitionText}: <span class="text-indigo-600 font-medium">${transitionDisplayName}</span></span>
                        <span>${formattedDate}</span>
                    </div>
                </div>
                <div>
                    <span class="px-2 py-1 text-xs rounded-full ${statusClass}">${statusText}</span>
                </div>
            </div>
            ${videoPreview}
        `;
        
        // 添加预览按钮事件
        const previewBtn = taskElement.querySelector('.preview-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                const videoUrl = previewBtn.dataset.url;
                displayVideo(videoUrl);
            });
        }
        
        // 删除按钮已移除，不再需要事件处理
        
        return taskElement;
    }
    
    // 轮询任务状态
    function startPollingTaskStatus(taskId) {
        if (pollingIntervals[taskId]) {
            clearInterval(pollingIntervals[taskId]);
        }
        
        pollingIntervals[taskId] = setInterval(() => {
            checkTaskStatusById(taskId);
        }, 5000); // 每5秒检查一次
    }
    
    // 检查任务状态
    function checkTaskStatusById(taskId) {
        fetch(`/api/multi-image-to-video/status/${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 更新任务状态
                const taskIndex = tasks.findIndex(task => task.id === taskId);
                if (taskIndex !== -1) {
                    tasks[taskIndex] = { ...tasks[taskIndex], ...data.task };
                    
                    // 如果任务完成，停止轮询
                    if (data.task.status === 'SUCCEEDED' || data.task.status === 'FAILED') {
                        clearInterval(pollingIntervals[taskId]);
                        delete pollingIntervals[taskId];
                    }
                    
                    // 重新渲染任务列表
                    renderTasks();
                }
            }
        })
        .catch(error => {
            console.error('检查任务状态失败:', error);
            const checkFailedText = typeof translate === 'function' ? translate('multi_image_to_video.check_status_failed') : '检查任务状态失败';
            console.error(checkFailedText, error);
        });
    }
    
    // 监听语言切换事件，更新任务列表和页面文本
    document.addEventListener('languageChanged', (event) => {
        console.log('多图转视频页面：收到语言切换事件:', event.detail?.language);
        // 重新渲染任务列表
        renderTasks();
    });
    
    // 确认删除任务
    function confirmDeleteTask() {
        console.log('确认删除所有多图转视频任务');
        const confirmText = typeof translate === 'function' ? translate('multi_image_to_video.clear_all_confirm') : '确定要清空所有历史记录吗？此操作将删除所有多图转视频任务，无法恢复！';
        if (!confirm(confirmText)) {
            console.log('用户取消删除操作');
            return;
        }
        
        console.log('用户确认删除所有任务，直接执行清空操作');
        clearAllTasks();
    }
    
    // 显示提示消息
    function showToast(message, type = 'info') {
        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 px-4 py-2 rounded-md text-white z-50 ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            'bg-blue-500'
        }`;
        toast.textContent = message;
        
        // 添加到页面
        document.body.appendChild(toast);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }
}); 