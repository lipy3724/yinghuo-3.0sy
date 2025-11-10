// 全局变量
let selectedResolution = '1280*720';
let selectedModel = 'wanx2.1-t2v-turbo'; // 默认使用Turbo模型，不再提供选择
let selectedQuality = '720P'; // 新增：默认选择720P分辨率
let tasks = [];
let pollingIntervals = {};
let currentUser = null;
let userCredits = 0;
let authToken = localStorage.getItem('authToken');
let pollingTasks = [];
let errorCount = 0;
// 轮询配置
const pollingConfig = {
    initialInterval: 5000,     // 初始轮询间隔(5秒)
    maxInterval: 30000,        // 最大轮询间隔(30秒)
    pendingInterval: 10000,    // 排队状态下的轮询间隔(10秒)
    runningInterval: 15000,    // 运行状态下的轮询间隔(15秒)
    maxRetries: 3,             // 最大连续错误重试次数
    retryInterval: 10000       // 错误重试间隔(10秒)
};

// DOM元素
const generateBtn = document.getElementById('generate-btn');
const promptInput = document.getElementById('prompt');
const previewContainer = document.getElementById('preview-container');
const tasksContainer = document.getElementById('tasks-container');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingMessage = document.getElementById('loading-message');
const refreshTasksBtn = document.getElementById('refresh-tasks-btn');
const userCreditsElement = document.getElementById('credits-display');
const loginBtn = document.getElementById('login-btn');
const userMenuBtn = document.getElementById('user-menu-btn');

// 使用统一的认证检查，避免立即跳转
async function checkInitialAuth() {
    // 优先使用统一的认证检查函数
    if (typeof window.checkAuth === 'function') {
        try {
            const isAuthenticated = await window.checkAuth(false); // 不自动重定向
            if (!isAuthenticated) {
                console.log('文生视频：用户未登录，跳转到登录页');
                window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
                return false;
            }
            console.log('文生视频：认证检查通过');
            return true;
        } catch (error) {
            console.error('文生视频：认证检查出错:', error);
            return false;
        }
    }
    
    // 后备的简单检查
    const authToken = localStorage.getItem('authToken');
    const userInfo = localStorage.getItem('user');
    
    if (!authToken || !userInfo) {
        console.log('文生视频：用户未登录，跳转到登录页');
        window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
        return false;
    }
    
    return true;
}

// 移除延迟执行的认证检查，改为在DOMContentLoaded中处理

// 初始化页面
document.addEventListener('DOMContentLoaded', async () => {
    console.log('文生视频页面初始化...');
    
    // 移除重复的认证检查，避免与HTML页面中的认证检查冲突
    // HTML页面已经有统一的认证检查，这里不再重复检查
    
    // 检查按钮是否正确找到
    if (!generateBtn) {
        console.error('找不到生成按钮元素！');
    } else {
        console.log('已找到生成按钮，设置点击事件');
        // 移除可能已有的事件监听器
        generateBtn.removeEventListener('click', generateVideo);
        // 添加调试版本的点击处理
        generateBtn.addEventListener('click', () => {
            console.log('生成按钮被点击！');
            generateVideo();
        });
    }
    
    // 移除checkAuthStatus()调用，避免重复认证检查冲突
    // checkAuthStatus();
    
    // 简单初始化用户状态（不进行认证检查和跳转）
    const userInfo = localStorage.getItem('user');
    if (userInfo) {
        try {
            currentUser = JSON.parse(userInfo);
            console.log('文生视频页面：初始化用户信息:', currentUser.username);
            
            // 获取用户积分（延迟执行，确保导航栏组件已加载）
            setTimeout(() => {
                fetchUserCredits();
            }, 1000);
        } catch (e) {
            console.error('初始化用户信息失败:', e);
        }
    }
    
    loadUserTasks();
    
    // 视频分辨率选择
    document.querySelectorAll('.resolution-quality-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const quality = btn.dataset.quality;
            
            // 更新按钮样式
            document.querySelectorAll('.resolution-quality-btn').forEach(b => {
                b.classList.remove('bg-indigo-100', 'border-indigo-500', 'text-indigo-700');
            });
            btn.classList.add('bg-indigo-100', 'border-indigo-500', 'text-indigo-700');
            
            // 设置选中的分辨率
            selectedQuality = quality;
            console.log('选择了分辨率质量:', selectedQuality);
            
            // 显示对应的视频比例选项
            const ratio480Container = document.getElementById('ratio-480p-container');
            const ratio720Container = document.getElementById('ratio-720p-container');
            
            if (quality === '480P') {
                ratio480Container.style.display = 'grid';
                ratio720Container.style.display = 'none';
                
                // 默认选中480P的16:9
                const defaultRatioBtn = document.querySelector('#ratio-480p-container .resolution-btn[data-resolution="832*480"]');
                if (defaultRatioBtn) {
                    // 先重置所有按钮样式
                    document.querySelectorAll('#ratio-480p-container .resolution-btn').forEach(b => {
                        b.classList.remove('bg-indigo-100', 'border-indigo-500', 'text-indigo-700');
                    });
                    // 设置选中样式
                    defaultRatioBtn.classList.add('bg-indigo-100', 'border-indigo-500', 'text-indigo-700');
                    selectedResolution = defaultRatioBtn.dataset.resolution;
                    console.log('默认选择了480P的比例:', selectedResolution);
                }
            } else {
                ratio480Container.style.display = 'none';
                ratio720Container.style.display = 'grid';
                
                // 默认选中720P的16:9
                const defaultRatioBtn = document.querySelector('#ratio-720p-container .resolution-btn[data-resolution="1280*720"]');
                if (defaultRatioBtn) {
                    // 先重置所有按钮样式
                    document.querySelectorAll('#ratio-720p-container .resolution-btn').forEach(b => {
                        b.classList.remove('bg-indigo-100', 'border-indigo-500', 'text-indigo-700');
                    });
                    // 设置选中样式
                    defaultRatioBtn.classList.add('bg-indigo-100', 'border-indigo-500', 'text-indigo-700');
                    selectedResolution = defaultRatioBtn.dataset.resolution;
                    console.log('默认选择了720P的比例:', selectedResolution);
                }
                
                // 确保1:1和4:3按钮在正确位置
                document.querySelector('#ratio-720p-container .resolution-btn:nth-child(3)').style.gridColumn = '1';
                document.querySelector('#ratio-720p-container .resolution-btn:nth-child(4)').style.gridColumn = '2';
            }
            
            showToast(`已选择${quality}视频分辨率`, 'info');
        });
    });
    
    // 视频比例选择
    document.querySelectorAll('.resolution-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // 找到当前按钮所在的容器
            const container = btn.closest('#ratio-720p-container, #ratio-480p-container');
            if (!container) return;
            
            // 只重置当前容器内的按钮样式
            container.querySelectorAll('.resolution-btn').forEach(b => {
                b.classList.remove('bg-indigo-100', 'border-indigo-500', 'text-indigo-700');
            });
            
            // 设置当前按钮的选中样式
            btn.classList.add('bg-indigo-100', 'border-indigo-500', 'text-indigo-700');
            selectedResolution = btn.dataset.resolution;
            
            console.log('选择了视频比例:', btn.textContent.trim().split('\n')[0], '分辨率:', selectedResolution, '质量:', selectedQuality);
            showToast('选择了视频比例: ' + btn.textContent.trim().split('\n')[0], 'info');
        });
    });
    
    // 刷新任务列表
    refreshTasksBtn.addEventListener('click', loadUserTasks);
    
    // 全局清空所有任务按钮点击事件
    const clearAllTasksGlobalBtn = document.getElementById('clear-all-tasks-global-btn');
    if (clearAllTasksGlobalBtn) {
        clearAllTasksGlobalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            confirmDeleteTask();
        });
    }
    
    // 监听语言切换事件，更新任务列表和预览区域
    document.addEventListener('languageChanged', (event) => {
        console.log('文生视频页面：收到语言切换事件:', event.detail.language);
        // 重新渲染任务列表
        renderTasks();
        // 更新预览区域占位符文本（如果预览区域是空的）
        updatePreviewPlaceholder();
    });
    
    // 初始化预览区域占位符文本
    updatePreviewPlaceholder();
});

// 更新预览区域占位符文本
function updatePreviewPlaceholder() {
    // 检查预览区域是否为空（没有视频元素）
    const hasVideo = previewContainer.querySelector('video');
    if (!hasVideo) {
        // 检查是否已经有占位符文本
        const placeholderDiv = previewContainer.querySelector('.text-gray-500');
        if (placeholderDiv) {
            const previewText = typeof translate === 'function' ? translate('text_to_video.preview_placeholder') : '您生成的视频将在这里显示';
            const textElement = placeholderDiv.querySelector('p');
            if (textElement) {
                textElement.textContent = previewText;
            }
        } else {
            // 如果没有占位符，创建一个
            const previewText = typeof translate === 'function' ? translate('text_to_video.preview_placeholder') : '您生成的视频将在这里显示';
            previewContainer.innerHTML = `
                <div class="flex items-center justify-center h-full text-gray-500">
                    <p>${previewText}</p>
                </div>
            `;
        }
    }
}

// 生成视频
function generateVideo() {
    console.log('开始执行视频生成函数...');
    
    const prompt = promptInput.value.trim();
    console.log('用户输入的提示词:', prompt);
    
    if (!prompt) {
        console.warn('提示词为空，终止请求');
        showToast('请输入视频描述', 'error');
        return;
    }
    
    // 检查认证状态
    const authToken = localStorage.getItem('authToken');
    console.log('认证Token是否存在:', !!authToken);
    
    if (!currentUser) {
        console.warn('用户未登录，终止请求');
        showToast('请先登录', 'error');
        window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
        return;
    }
    
    // 积分检查（前端仅作提示，最终检查由服务器端完成）
    const costPerSecond = 13.2; // Turbo模型固定为13.2积分/秒，5秒视频总计66积分
    const estimatedCost = costPerSecond * 5; // 假设5秒视频
    console.log('用户积分:', userCredits, '需要积分:', estimatedCost);
    
    // 只有在确实获取到积分信息且积分不足时才阻止请求
    // 如果积分为0可能是还没获取到，让服务器端来最终判断
    if (userCredits > 0 && userCredits < estimatedCost) {
        console.warn('前端检测积分不足，终止请求');
        showToast(`积分不足，需要约${estimatedCost}积分，请充值`, 'error');
        return;
    }
    
    // 显示加载遮罩
    loadingOverlay.classList.remove('hidden');
    loadingMessage.textContent = '正在提交视频生成请求...';
    
    // 准备与Java SDK一致的请求格式
    const requestBody = {
        prompt: prompt,
        model: selectedModel,
        size: selectedResolution, // 确保使用用户选择的分辨率
        quality: selectedQuality  // 添加分辨率质量参数
    };
    
    // 记录详细的参数信息，便于调试
    console.log('发送视频生成请求:', {
        prompt: prompt,
        model: selectedModel,
        size: selectedResolution,
        quality: selectedQuality,
        详细说明: `选择了${selectedQuality}分辨率，视频比例为${selectedResolution}`
    });
    console.log('请求URL:', '/api/text-to-video/create');
    console.log('请求方法: POST');
    
    // 创建AbortController用于请求超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
    // 调用API生成视频
    fetch('/api/text-to-video/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
    })
    .then(response => {
        clearTimeout(timeoutId); // 清除超时
        console.log('收到服务器响应:', {
            status: response.status,
            statusText: response.statusText
        });
        
        if (!response.ok) {
            return response.json().then(data => {
                console.error('服务器返回错误:', data);
                throw new Error(data.message || '请求失败，服务器返回错误');
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('服务器返回任务数据:', data);
        
        if (!data.success) {
            console.error('API返回错误状态:', data);
            throw new Error(data.message || '服务器返回异常响应');
        }
        
        // 兼容处理taskId字段 (服务器可能返回taskId或task_id)
        const taskId = data.taskId || data.task_id;
        
        if (!taskId) {
            console.error('服务器未返回有效的taskId');
            throw new Error('服务器未返回有效的taskId');
        }
        
        console.log('获取到任务ID:', taskId);
        console.log('请求的分辨率参数:', selectedResolution, '质量:', selectedQuality);
        loadingMessage.textContent = '视频生成任务已提交，正在处理中...';
        
        // 将任务添加到任务列表
        const task = {
            id: taskId,
            prompt: promptInput.value.trim(),
            status: 'PENDING',
            model: selectedModel,
            size: selectedResolution,
            quality: selectedQuality, // 添加分辨率质量信息
            createdAt: new Date().toISOString()
        };
        
        // 添加任务到列表并渲染
        tasks.unshift(task);
        renderTasks();
        
        // 立即开始轮询任务状态
        console.log(`开始轮询新创建的任务: ${taskId}`);
        startPollingTaskStatus(taskId);
        
        // 在预览区域显示任务进度
        showGenerationProgress(task);
        
        // 立即滚动到预览区域，让用户看到生成进度
        previewContainer.scrollIntoView({ behavior: 'smooth' });
        
        // 隐藏加载遮罩，显示成功消息
        setTimeout(() => {
            loadingOverlay.classList.add('hidden');
            showToast('视频生成任务已提交，正在后台处理...', 'success');
        }, 1500);
    })
    .catch(error => {
        clearTimeout(timeoutId); // 确保清除超时
        console.error('视频生成请求失败:', error);
        
        // 处理请求超时
        if (error.name === 'AbortError') {
            console.error('请求超时');
            showToast('请求超时，请稍后重试', 'error');
        } else {
            showToast(error.message || '视频生成失败，请重试', 'error');
        }
        
        loadingOverlay.classList.add('hidden');
    });
}

// 开始轮询任务状态
function startPollingTaskStatus(taskId) {
    console.log('开始轮询任务状态:', taskId);
    
    // 确保不要重复轮询
    if (pollingIntervals[taskId]) {
        clearInterval(pollingIntervals[taskId]);
    }
    
    // 初始化轮询状态
    const pollingState = {
        taskId,
        errorCount: 0,
        lastStatus: null,
        interval: pollingConfig.initialInterval,
        lastPollTime: Date.now()
    };
    
    // 轮询函数
    const pollFunction = async () => {
        // 检查距离上次轮询时间是否足够
        const now = Date.now();
        if (now - pollingState.lastPollTime < pollingState.interval) {
            return; // 时间间隔不够，跳过本次轮询
        }
        
        pollingState.lastPollTime = now;
        console.log(`正在查询任务状态: taskId=${taskId}, 当前间隔: ${pollingState.interval/1000}秒`);
        
        try {
            // 创建AbortController用于请求超时处理
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
            
            // 发送请求
            const response = await fetch(`/api/text-to-video/status/${taskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId); // 清除超时
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '获取任务状态失败');
            }
            
            const data = await response.json();
            console.log(`任务状态响应数据:`, data);
            
            // 检查响应格式
            if (!data.success) {
                throw new Error(data.message || '获取任务状态出错');
            }
            
            // 重置错误计数
            pollingState.errorCount = 0;
            
            // 兼容处理状态字段 (服务器可能返回status或task_status)
            const taskStatus = data.status || data.task_status;
            
            // 兼容处理视频URL字段 (服务器可能返回videoUrl或video_url)
            const videoUrl = data.videoUrl || data.video_url;
            
            console.log(`任务状态: ${taskId} => ${taskStatus}, 请求ID: ${data.request_id || 'N/A'}`);
            
            // 根据任务状态调整轮询间隔
            if (taskStatus === 'PENDING') {
                // 排队中状态，使用较长间隔
                pollingState.interval = pollingConfig.pendingInterval;
            } else if (taskStatus === 'RUNNING') {
                // 运行中状态，使用中等间隔
                pollingState.interval = pollingConfig.runningInterval;
            }
            
            // 查找对应任务
            const taskIndex = tasks.findIndex(t => t.id === taskId);
            if (taskIndex === -1) {
                console.error(`未找到任务: ${taskId}`);
                clearInterval(pollingIntervals[taskId]);
                delete pollingIntervals[taskId];
                return;
            }
            
            // 更新任务状态
            const prevStatus = tasks[taskIndex].status;
            tasks[taskIndex].status = taskStatus;
            
            // 如果状态发生变化，记录日志
            if (prevStatus !== taskStatus) {
                console.log(`任务状态变化: ${prevStatus} -> ${taskStatus}`);
                // 状态变化时，立即进行下一次查询
                pollingState.lastPollTime = 0;
                
                // 如果状态变为成功，检查是否有积分信息
                if (prevStatus !== taskStatus && taskStatus === 'SUCCEEDED') {
                    // 检查响应中是否包含积分信息
                    if (data.output && data.output.credits !== undefined) {
                        console.log(`收到更新后的积分信息: ${data.output.credits}`);
                        userCredits = data.output.credits;
                        userCreditsElement.textContent = `积分: ${userCredits}`;
                    } else {
                        // 如果没有积分信息，主动刷新积分
                        console.log('未收到积分信息，主动刷新积分');
                        fetchUserCredits();
                    }
                }
            }
            
            // 更新视频URL（如果有）
            if (videoUrl) {
                console.log(`任务有视频URL: ${videoUrl}`);
                tasks[taskIndex].videoUrl = videoUrl;
            }
            
            // 重新渲染任务列表
            renderTasks();
            
            // 检查是否是最新生成的任务（任务列表中的第一个）
            const isNewestTask = taskIndex === 0;
            
            // 如果是最新任务或者之前已经在预览区域显示了这个任务，则更新预览区域
            if (isNewestTask || document.querySelector(`#preview-container video[data-task-id="${taskId}"]`)) {
                console.log(`更新预览区域显示任务: ${taskId}`);
                showGenerationProgress(tasks[taskIndex]);
            }
            
            // 如果任务已完成或失败，停止轮询
            if (taskStatus === 'SUCCEEDED') {
                console.log(`任务完成: ${taskId}, 视频URL: ${videoUrl}`);
                clearInterval(pollingIntervals[taskId]);
                delete pollingIntervals[taskId];
                
                // 刷新用户积分
                fetchUserCredits();
                
                // 显示成功消息
                showToast('视频生成成功！', 'success');
                
                // 无论是否是最新任务，只要视频生成成功就在预览区域显示
                showVideoPreview(videoUrl, taskId);
                
                // 滚动到预览区域
                previewContainer.scrollIntoView({ behavior: 'smooth' });
            } else if (taskStatus === 'FAILED') {
                console.log(`任务失败: ${taskId}`);
                clearInterval(pollingIntervals[taskId]);
                delete pollingIntervals[taskId];
                
                showToast('视频生成失败，请查看详情', 'error');
            }
            
            // 记录上次状态
            pollingState.lastStatus = taskStatus;
            
        } catch (error) {
            // 错误处理逻辑
            pollingState.errorCount++;
            
            // 处理请求超时
            if (error.name === 'AbortError') {
                console.error(`轮询超时: ${taskId}, 重试次数: ${pollingState.errorCount}`);
                // 超时时增加轮询间隔
                pollingState.interval = Math.min(pollingState.interval * 1.5, pollingConfig.maxInterval);
            } else {
                console.error(`轮询出错: ${taskId}, 错误: ${error.message}, 重试次数: ${pollingState.errorCount}`);
                
                // 只在连续错误超过阈值时显示提示
                if (pollingState.errorCount >= 2) {
                    showToast(`获取任务状态出错，已重试${pollingState.errorCount}次`, 'warning');
                }
                
                // 错误时增加轮询间隔
                pollingState.interval = Math.min(pollingState.interval * 1.5, pollingConfig.maxInterval);
            }
            
            // 如果连续错误次数过多，停止轮询
            if (pollingState.errorCount > pollingConfig.maxRetries) {
                console.error(`轮询错误次数过多，停止轮询: ${taskId}`);
                clearInterval(pollingIntervals[taskId]);
                delete pollingIntervals[taskId];
                showToast('获取任务状态失败，请稍后手动刷新', 'error');
            }
        }
    };
    
    // 立即执行一次轮询
    pollFunction();
    
    // 设置周期性轮询 (使用较短的检查间隔，但实际轮询频率由pollFunction控制)
    pollingIntervals[taskId] = setInterval(pollFunction, 2000);
}

// 渲染任务列表
function renderTasks() {
    if (!tasksContainer) {
        console.error('找不到任务容器元素！');
        return;
    }

    if (tasks.length === 0) {
        // 使用翻译函数获取文本
        const noRecordsText = typeof translate === 'function' ? translate('text_to_video.no_records') : '暂无视频生成记录';
        const taskListInfoText = typeof translate === 'function' ? translate('text_to_video.task_list_info') : '仅显示24小时内的最新1条记录';
        
        tasksContainer.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p>${noRecordsText}</p>
                <p class="text-sm mt-2 text-gray-400">${taskListInfoText}</p>
            </div>
        `;
        return;
    }
    
    // 按创建时间降序排序
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 只显示最新的一条记录
    const tasksToShow = tasks.slice(0, 1);
    
    // 清空容器
    tasksContainer.innerHTML = '';
    
    // 渲染每个任务
    tasksToShow.forEach(task => {
        // 创建任务元素
        const taskElement = createTaskElement(task);
        tasksContainer.appendChild(taskElement);
        
        // 为进行中的任务启动轮询
        if (task.status === 'PENDING' || task.status === 'RUNNING') {
            startPollingTaskStatus(task.id);
            
            // 如果是最新任务，在预览区域显示进度
            if (task === tasks[0]) {
                showGenerationProgress(task);
            }
        }
    });
    
    // 添加预览按钮事件
    document.querySelectorAll('.preview-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const videoUrl = btn.dataset.url;
            showVideoPreview(videoUrl);
        });
    });
    
    // 注意：清空所有任务按钮现在在页面顶部，事件监听器在页面加载时已绑定
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
            statusText = '排队中';
            break;
        case 'RUNNING':
            statusClass = 'bg-blue-100 text-blue-800';
            statusText = '生成中';
            break;
        case 'SUCCEEDED':
            statusClass = 'bg-green-100 text-green-800';
            statusText = '已完成';
            break;
        case 'FAILED':
            statusClass = 'bg-red-100 text-red-800';
            statusText = '失败';
            break;
        default:
            statusClass = 'bg-gray-100 text-gray-800';
            statusText = '未知状态';
    }
    
    // 将分辨率转换为比例显示
    let aspectRatio = '';
    switch(task.size) {
        case '1280*720':
            aspectRatio = '16:9';
            break;
        case '720*1280':
            aspectRatio = '9:16';
            break;
        case '960*960':
            aspectRatio = '1:1';
            break;
        case '832*1088':
            aspectRatio = '3:4';
            break;
        case '1088*832':
            aspectRatio = '4:3';
            break;
        case '624*624':
            aspectRatio = '1:1 (旧版)';
            break;
        default:
            aspectRatio = task.size;
    }
    
    // 视频预览（仅当任务成功且有视频URL时）
    let videoPreview = '';
    if (task.status === 'SUCCEEDED' && task.videoUrl) {
        videoPreview = `
            <div class="mt-3">
                <video controls class="w-full rounded" style="max-height: 180px">
                    <source src="${task.videoUrl}" type="video/mp4">
                    您的浏览器不支持视频标签
                </video>
                <div class="flex justify-end mt-2">
                    <a href="/api/video-subtitle-removal/download?url=${encodeURIComponent(task.videoUrl)}" class="text-indigo-600 hover:text-indigo-800 text-sm mr-3" download>
                        <i class="ri-download-2-line mr-1"></i>下载
                    </a>
                    <button class="text-indigo-600 hover:text-indigo-800 text-sm preview-btn" data-url="${task.videoUrl}">
                        <i class="ri-fullscreen-line mr-1"></i>预览
                    </button>
                </div>
            </div>
        `;
    } else {
        // 对于未完成的任务，不显示额外的按钮
        videoPreview = '';
    }
    
    // 格式化时间戳
    const createdDate = new Date(task.createdAt);
    const formattedDate = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}-${String(createdDate.getDate()).padStart(2, '0')} ${String(createdDate.getHours()).padStart(2, '0')}:${String(createdDate.getMinutes()).padStart(2, '0')}`;
    
    taskElement.innerHTML = `
        <div class="flex justify-between">
            <div class="flex-1 pr-4">
                <p class="font-medium">${task.prompt}</p>
                <div class="flex mt-2 text-sm text-gray-500">
                    <span class="mr-4">${aspectRatio}</span>
                    <span class="mr-4">${task.quality || '720P'}</span>
                    <span>${formattedDate}</span>
                </div>
            </div>
            <div>
                <span class="px-2 py-1 text-xs rounded-full ${statusClass}">${statusText}</span>
            </div>
        </div>
        ${videoPreview}
    `;
    
    return taskElement;
}

// 在预览区域显示视频
function showVideoPreview(videoUrl, taskId = '') {
    previewContainer.innerHTML = `
        <video controls class="w-full h-full" data-task-id="${taskId}">
            <source src="${videoUrl}" type="video/mp4">
            您的浏览器不支持视频标签
        </video>
    `;
    
    // 确保视频元素加载并正确显示
    const videoElement = previewContainer.querySelector('video');
    videoElement.addEventListener('loadedmetadata', () => {
        // 视频元数据加载完成，确保宽高适配容器
        videoElement.style.maxHeight = '100%';
        videoElement.style.maxWidth = '100%';
        videoElement.style.objectFit = 'contain';
    });
    
    videoElement.addEventListener('error', () => {
        // 视频加载出错处理
        console.error('视频加载失败:', videoUrl);
        previewContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full">
                <p class="text-lg text-red-600 text-center">视频加载失败</p>
                <p class="text-sm text-gray-500 mt-2">请检查网络连接或视频链接是否有效</p>
            </div>
        `;
    });
    
    // 滚动到预览区域
    previewContainer.scrollIntoView({ behavior: 'smooth' });
}

// 加载用户任务
function loadUserTasks() {
    if (!localStorage.getItem('authToken')) {
        console.log('用户未登录，不加载任务');
        return;
    }
    
    console.log('加载用户任务...');
    
    fetch('/api/text-to-video/tasks', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.message || '请求失败，服务器返回错误');
            });
        }
        return response.json();
    })
    .then(data => {
        console.log(`获取到 ${data.length} 个任务（OSS存储，24小时内最新记录）`);
        
        tasks = data;
        renderTasks();
        
        // 注意: renderTasks 函数现在会自动为待处理和处理中的任务启动轮询
        // 所以这里不需要再次启动轮询
    })
    .catch(error => {
        console.error('获取任务列表出错:', error);
        showToast(`获取任务列表失败: ${error.message}`, 'error');
    });
}

// 消息提示
function showToast(message, type = 'info') {
    // 创建toast元素
    const toast = document.createElement('div');
    
    // 根据类型设置样式
    let bgColor, textColor;
    if (type === 'success') {
        bgColor = 'bg-green-500';
        textColor = 'text-white';
    } else if (type === 'error') {
        bgColor = 'bg-red-500';
        textColor = 'text-white';
    } else if (type === 'warning') {
        bgColor = 'bg-yellow-500';
        textColor = 'text-white';
    } else {
        bgColor = 'bg-blue-500';
        textColor = 'text-white';
    }
    
    toast.className = `fixed top-4 right-4 ${bgColor} ${textColor} px-4 py-2 rounded shadow-md z-50 transition-opacity duration-300 opacity-0`;
    toast.innerText = message;
    
    // 添加到页面
    document.body.appendChild(toast);
    
    // 显示toast
    setTimeout(() => {
        toast.classList.replace('opacity-0', 'opacity-100');
    }, 10);
    
    // 自动隐藏
    setTimeout(() => {
        toast.classList.replace('opacity-100', 'opacity-0');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// 检查用户登录状态
function checkAuthStatus() {
    const authToken = localStorage.getItem('authToken');
    const userInfo = localStorage.getItem('user');
    
    if (authToken && userInfo) {
        // 用户已登录
        try {
            currentUser = JSON.parse(userInfo);
            
            // 检查页面元素是否存在（避免在某些页面调用时出错）
            if (typeof userMenuBtn !== 'undefined' && userMenuBtn && userMenuBtn.querySelector('span')) {
                userMenuBtn.querySelector('span').textContent = currentUser.username;
                
                // 显示用户菜单，隐藏登录按钮
                if (typeof loginBtn !== 'undefined' && loginBtn) {
                    loginBtn.classList.add('hidden');
                }
                userMenuBtn.classList.remove('hidden');
            }
            
            // 获取用户积分
            fetchUserCredits();
            
            console.log('文生视频页面：用户认证状态正常，用户:', currentUser.username);
        } catch (e) {
            console.error('解析用户信息出错:', e);
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            console.log('文生视频页面：用户信息解析失败，但不跳转（由HTML页面统一处理认证）');
            // 不再自动跳转，让HTML页面的统一认证检查来处理
        }
    } else {
        console.log('文生视频页面：用户未登录，但不跳转（由HTML页面统一处理认证）');
        // 不再自动跳转，让HTML页面的统一认证检查来处理
    }
}

// 获取用户积分
function fetchUserCredits() {
    if (!localStorage.getItem('authToken')) {
        console.log('文生视频页面：未找到认证token，跳过积分获取');
        return;
    }
    
    console.log('文生视频页面：开始获取用户积分...');
    
    fetch('/api/user/credits', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
    })
    .then(response => {
        console.log('文生视频页面：积分API响应状态:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('文生视频页面：积分API响应数据:', data);
        userCredits = data.credits || 0;
        
        // 尝试更新导航栏中的积分显示
        const creditsDisplay = document.getElementById('credits-display');
        if (creditsDisplay) {
            creditsDisplay.textContent = `积分: ${userCredits}`;
            console.log('文生视频页面：已更新导航栏积分显示');
        } else {
            console.warn('文生视频页面：未找到积分显示元素，可能导航栏还未加载完成');
        }
        
        console.log('文生视频页面：获取到用户积分:', userCredits);
    })
    .catch(error => {
        console.error('文生视频页面：获取用户积分出错:', error);
        // 设置默认值，避免积分检查失败
        userCredits = 0;
    });
}

// 从后端加载任务列表
function loadTasks() {
    // 此函数功能已被 loadUserTasks 取代，保留以确保兼容性
    loadUserTasks();
}

// 轮询任务状态
function pollTaskStatus(taskId) {
    // 如果已经存在轮询实例，不再创建新的
    if (pollingIntervals[taskId]) {
        console.log(`任务 ${taskId} 已经在轮询中，跳过`);
        return;
    }
    
    console.log(`开始轮询任务: ${taskId}`);
    
    // 直接使用统一的轮询函数
    startPollingTaskStatus(taskId);
}

// 显示生成进度和状态
function showGenerationProgress(task) {
    if (!previewContainer) return;
    
    // 根据状态显示不同内容
    if (task.status === 'SUCCEEDED' && task.videoUrl) {
        // 成功状态显示视频
        showVideoPreview(task.videoUrl);
    } else {
        // 其他状态显示加载动画和状态信息
        let statusText = '准备中...';
        let statusClass = 'text-gray-600';
        
        if (task.status === 'PENDING') {
            statusText = '排队中，请稍候...';
            statusClass = 'text-yellow-600';
        } else if (task.status === 'RUNNING') {
            statusText = '视频生成中，请稍候...';
            statusClass = 'text-blue-600';
        } else if (task.status === 'FAILED') {
            statusText = '视频生成失败';
            statusClass = 'text-red-600';
        }
        
        previewContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full">
                <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-500 mb-4"></div>
                <p class="text-lg ${statusClass} text-center">${statusText}</p>
                <p class="text-sm text-gray-500 mt-2">提示词: ${task.prompt}</p>
            </div>
        `;
    }
}

// 确认删除任务
function confirmDeleteTask() {
    console.log('确认删除所有任务');
    const confirmText = typeof translate === 'function' ? translate('text_to_video.clear_all_confirm') : '确定要清空所有历史记录吗？此操作将删除所有视频任务，无法恢复！';
    if (!confirm(confirmText)) {
        console.log('用户取消删除操作');
        return;
    }
    
    console.log('用户确认删除所有任务，执行清空操作');
    deleteAllTasks();
}

// 清空所有任务
function deleteAllTasks() {
    console.log('开始清空所有任务');
    
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        console.error('未找到认证Token，无法删除任务');
        showToast('请先登录', 'error');
        return;
    }
    
    // 本地清空函数
    const clearAllTasksLocally = () => {
        // 清空任务列表
        tasks.length = 0;
        console.log('已清空本地任务列表');
        
        // 停止所有轮询
        Object.keys(pollingIntervals).forEach(taskId => {
            clearInterval(pollingIntervals[taskId]);
            delete pollingIntervals[taskId];
        });
        console.log('已停止所有任务轮询');
        
        // 更新本地存储
        try {
            localStorage.setItem('textToVideoTasks', JSON.stringify([]));
            console.log('本地存储已清空');
        } catch (error) {
            console.error('清空本地存储失败:', error);
        }
        
        // 重新渲染任务列表
        renderTasks();
        
        // 清空预览区域
        const previewText = typeof translate === 'function' ? translate('text_to_video.preview_placeholder') : '您生成的视频将在这里显示';
        previewContainer.innerHTML = `
            <div class="flex items-center justify-center h-full text-gray-500">
                <p>${previewText}</p>
            </div>
        `;
        
        return true;
    };
    
    // 调用后端API清空所有任务
    console.log('正在调用API清空所有任务:', '/api/text-to-video/tasks/clear-all');
    fetch('/api/text-to-video/tasks/clear-all', {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        console.log('API响应状态:', response.status, response.statusText);
        if (response.ok) {
            return response.json();
        } else {
            throw new Error(`清空失败: HTTP ${response.status} - ${response.statusText}`);
        }
    })
    .then(result => {
        console.log('清空成功:', result);
        if (clearAllTasksLocally()) {
            const successText = typeof translate === 'function' ? translate('text_to_video.clear_all_success') : '所有历史记录已清空';
            showToast(successText, 'success');
        } else {
            const warningText = typeof translate === 'function' ? translate('text_to_video.clear_all_server_success') : '服务器已清空，但本地列表更新失败';
            showToast(warningText, 'warning');
        }
    })
    .catch(error => {
        console.error('清空任务失败:', error);
        // 如果API调用失败，询问是否本地清空
        const retryConfirmText = typeof translate === 'function' ? translate('text_to_video.clear_all_retry_confirm') : '清空任务失败，是否从本地列表中清空？';
        if (confirm(retryConfirmText)) {
            if (clearAllTasksLocally()) {
                const localSuccessText = typeof translate === 'function' ? translate('text_to_video.clear_all_local_success') : '本地历史记录已清空';
                showToast(localSuccessText, 'warning');
            } else {
                const localFailedText = typeof translate === 'function' ? translate('text_to_video.clear_all_local_failed') : '无法清空本地记录';
                showToast(localFailedText, 'error');
            }
        } else {
            const failedText = typeof translate === 'function' ? translate('text_to_video.clear_all_failed') : '清空任务失败';
            showToast(failedText, 'error');
        }
    });
} 