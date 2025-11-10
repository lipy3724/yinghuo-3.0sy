/**
 * 图像上色历史记录备份恢复模块
 * 处理保存失败的历史记录，在网络恢复时自动尝试重新保存
 */
window.ColorizationHistoryFallback = (function() {
    // 常量
    const BACKUP_STORAGE_KEY = 'colorization_history_backup';
    const MAX_RETRY_COUNT = 3;
    const RETRY_INTERVAL = 60000; // 1分钟
    
    // 备份队列
    let backupQueue = [];
    
    // 重试定时器
    let retryTimer = null;
    
    /**
     * 初始化备份恢复模块
     */
    function init() {
        console.log('初始化历史记录备份恢复模块');
        
        // 加载备份队列
        loadBackupQueue();
        
        // 监听网络状态变化
        window.addEventListener('online', handleNetworkOnline);
        
        // 启动重试计划
        scheduleRetry();
    }
    
    /**
     * 加载备份队列
     */
    function loadBackupQueue() {
        try {
            const backupData = localStorage.getItem(BACKUP_STORAGE_KEY);
            if (backupData) {
                backupQueue = JSON.parse(backupData);
                console.log(`加载备份队列: ${backupQueue.length}条记录待恢复`);
            }
        } catch (error) {
            console.error('加载备份队列失败:', error);
            backupQueue = [];
        }
    }
    
    /**
     * 保存备份队列
     */
    function saveBackupQueue() {
        try {
            localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(backupQueue));
        } catch (error) {
            console.error('保存备份队列失败:', error);
        }
    }
    
    /**
     * 创建备份
     * @param {Object} historyItem - 历史记录项
     * @param {string} errorType - 错误类型
     */
    function createBackup(historyItem, errorType) {
        console.log('创建历史记录备份:', historyItem);
        
        // 创建备份项
        const backupItem = {
            historyItem,
            errorType,
            createdAt: new Date().toISOString(),
            retryCount: 0,
            lastRetry: null
        };
        
        // 添加到队列
        backupQueue.push(backupItem);
        
        // 保存队列
        saveBackupQueue();
        
        // 如果是网络错误，监听网络恢复
        if (errorType === 'network') {
            console.log('网络错误，等待网络恢复后自动重试');
        } else {
            // 其他错误，安排定时重试
            scheduleRetry();
        }
    }
    
    /**
     * 处理网络恢复事件
     */
    function handleNetworkOnline() {
        console.log('网络已恢复，尝试恢复备份');
        
        // 立即尝试恢复
        processBackupQueue();
    }
    
    /**
     * 安排重试
     */
    function scheduleRetry() {
        // 如果已经有定时器，先清除
        if (retryTimer) {
            clearTimeout(retryTimer);
        }
        
        // 如果队列为空，不需要重试
        if (backupQueue.length === 0) {
            return;
        }
        
        // 设置定时器
        retryTimer = setTimeout(() => {
            processBackupQueue();
        }, RETRY_INTERVAL);
    }
    
    /**
     * 处理备份队列
     */
    async function processBackupQueue() {
        // 如果队列为空，不需要处理
        if (backupQueue.length === 0) {
            return;
        }
        
        console.log(`开始处理备份队列: ${backupQueue.length}条记录`);
        
        // 复制队列，避免处理过程中的修改
        const queue = [...backupQueue];
        
        // 清空队列
        backupQueue = [];
        saveBackupQueue();
        
        // 处理每个备份项
        for (const backupItem of queue) {
            try {
                // 检查重试次数
                if (backupItem.retryCount >= MAX_RETRY_COUNT) {
                    console.warn('备份项重试次数已达上限，放弃恢复:', backupItem);
                    continue;
                }
                
                // 更新重试信息
                backupItem.retryCount++;
                backupItem.lastRetry = new Date().toISOString();
                
                // 尝试保存
                await saveHistoryToServer(backupItem.historyItem);
                
                console.log('备份恢复成功:', backupItem);
            } catch (error) {
                console.error('备份恢复失败:', error);
                
                // 放回队列，等待下次重试
                backupQueue.push(backupItem);
            }
        }
        
        // 保存更新后的队列
        saveBackupQueue();
        
        // 如果队列不为空，安排下次重试
        if (backupQueue.length > 0) {
            scheduleRetry();
        }
    }
    
    /**
     * 保存历史记录到服务器
     * @param {Object} historyItem - 历史记录项
     * @returns {Promise<void>}
     */
    async function saveHistoryToServer(historyItem) {
        // 检查是否登录
        if (!window.isLoggedIn) {
            throw new Error('用户未登录');
        }
        
        // 准备请求数据
        const historyData = {
            originalImage: historyItem.originalImage,
            resultImage: historyItem.resultImage,
            prompt: historyItem.prompt || '图像上色',
            storage: historyItem.storage || 'oss'
        };
        
        // 发送请求
        const response = await fetch('/api/image-colorization-history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(historyData)
        });
        
        // 检查响应状态
        if (!response.ok) {
            throw new Error(`服务器响应错误: ${response.status}`);
        }
        
        // 解析响应
        const data = await response.json();
        
        // 检查响应数据
        if (!data.success) {
            throw new Error(data.message || '保存失败');
        }
    }
    
    /**
     * 获取备份队列状态
     * @returns {Object} 状态信息
     */
    function getBackupStatus() {
        return {
            pendingCount: backupQueue.length,
            hasBackups: backupQueue.length > 0
        };
    }
    
    // 初始化
    init();
    
    // 导出公共方法
    return {
        init,
        createBackup,
        getBackupStatus,
        processBackupQueue
    };
})();