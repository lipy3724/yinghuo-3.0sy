/**
 * 统一的认证检查脚本
 * 用于所有功能页面，确保用户在会话失效或被管理员终止时能够正确登出
 */

// 防抖机制 - 避免短时间内重复验证
let lastAuthCheck = 0;
const AUTH_CHECK_DEBOUNCE = 8000; // 增加到8秒内不重复验证，避免与功能API冲突
let isAuthChecking = false; // 防止并发验证

// 检查用户认证状态
async function checkAuth(redirectOnFailure = true) {
    // 防抖检查
    const now = Date.now();
    if (now - lastAuthCheck < AUTH_CHECK_DEBOUNCE) {
        console.log('认证检查防抖，跳过重复验证');
        return true; // 短时间内已验证过，认为有效
    }
    
    // 防止并发验证
    if (isAuthChecking) {
        console.log('正在进行认证验证，跳过重复请求');
        return true;
    }
    
    isAuthChecking = true;
    
    try {
        // 添加小延迟确保localStorage完全写入
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 首先检查本地存储
        const authToken = localStorage.getItem('authToken');
        const userInfo = localStorage.getItem('user');
        
        if (!authToken || !userInfo) {
            console.log('本地存储中没有令牌或用户信息，认证失败');
            if (redirectOnFailure) {
                redirectToLogin();
            }
            return false;
        }
        
        // 验证用户信息格式
        try {
            const user = JSON.parse(userInfo);
            if (!user.id || !user.username) {
                console.log('用户信息格式无效，清除并重定向');
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
                if (redirectOnFailure) {
                    redirectToLogin();
                }
                return false;
            }
        } catch (e) {
            console.log('用户信息解析失败，清除并重定向');
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            if (redirectOnFailure) {
                redirectToLogin();
            }
            return false;
        }
        
        // 更新最后检查时间
        lastAuthCheck = now;
        
        // 验证会话是否有效
        try {
            // 如果verifySession函数可用，优先使用
            if (typeof window.verifySession === 'function') {
                const isValid = await window.verifySession();
                if (!isValid && redirectOnFailure) {
                    redirectToLogin();
                }
                return isValid;
            }
            
            // 否则直接调用验证API，增加超时和重试机制
            const maxRetries = 2;
            let retryCount = 0;
            
            while (retryCount <= maxRetries) {
                try {
                    console.log(`尝试验证会话 (第${retryCount + 1}次)`);
                    
                    // 设置超时
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6秒超时
                    
                    const response = await fetch('/api/auth/verify', {
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        },
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        const result = await response.json();
                        if (result.success) {
                            console.log('会话验证成功');
                            return true;
                        } else {
                            console.log('会话验证失败:', result.message);
                            break;
                        }
                    } else if (response.status === 401) {
                        console.log('会话已过期，需要重新登录');
                        break;
                    } else {
                        console.log(`会话验证失败，状态码: ${response.status}`);
                        break;
                    }
                } catch (error) {
                    retryCount++;
                    if (error.name === 'AbortError') {
                        console.log('会话验证超时');
                    } else {
                        console.log(`会话验证出错 (第${retryCount}次):`, error.message);
                    }
                    
                    if (retryCount > maxRetries) {
                        console.log('会话验证重试次数已用完');
                        // 如果是网络错误，不强制登出，允许用户继续使用备用接口
                        if (error.name === 'AbortError' || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                            console.log('网络错误，允许继续使用页面功能');
                            return true; // 返回true，允许继续使用
                        }
                        break;
                    }
                    
                    // 等待后重试
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }
            
            // 验证失败，清除本地存储并重定向
            console.log('会话验证最终失败，清除本地存储');
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            
            if (redirectOnFailure) {
                redirectToLogin();
            }
            return false;
            
        } catch (error) {
            console.error('会话验证过程中发生错误:', error);
            
            // 如果是网络错误，不强制登出
            if (error.name === 'AbortError' || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                console.log('网络错误，允许继续使用页面功能');
                return true; // 返回true，允许继续使用
            }
            
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            
            if (redirectOnFailure) {
                redirectToLogin();
            }
            return false;
        }
        
    } finally {
        isAuthChecking = false;
    }
}

// 重定向到登录页面
function redirectToLogin() {
    console.log('重定向到登录页面');
    
    // 清除本地存储
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    // 获取当前页面路径
    const currentPath = window.location.pathname;
    
    // 如果不是登录页面，则重定向
    if (!currentPath.includes('login.html') && !currentPath.includes('register.html')) {
        // 保存当前页面路径，登录成功后可以跳转回来
        sessionStorage.setItem('redirectAfterLogin', currentPath);
        
        // 重定向到登录页面
        window.location.href = '/login.html';
    }
}

// 检查是否为认证页面
function isAuthPage() {
    const currentPath = window.location.pathname;
    return currentPath.includes('login.html') || currentPath.includes('register.html');
}

// 页面加载时自动检查认证状态
document.addEventListener('DOMContentLoaded', function() {
    // 如果是认证页面，不进行检查
    if (isAuthPage()) {
        return;
    }
    
    console.log('页面加载完成，开始认证检查');
    
    // 延迟检查，确保localStorage已完全加载，并避免与功能API冲突
    setTimeout(async () => {
        try {
            const isAuthenticated = await checkAuth(true);
            if (isAuthenticated) {
                console.log('用户认证成功');
            } else {
                console.log('用户认证失败，已重定向到登录页面');
            }
        } catch (error) {
            console.error('认证检查过程中发生错误:', error);
        }
    }, 1500); // 增加延迟到1.5秒，让页面完全加载
});

// 防止重复检查
let lastCheckTime = 0;
const CHECK_INTERVAL = 5000; // 5秒内不重复检查

/**
 * 检查用户是否被封禁
 * 该函数在用户点击功能按钮时调用
 */
function checkBanStatus() {
    // 如果是登录页面，不检查
    if (isAuthPage()) return;
    
    // 防抖动
    const now = Date.now();
    if (now - lastCheckTime < CHECK_INTERVAL) return;
    lastCheckTime = now;
    
    // 获取token
    const token = localStorage.getItem('authToken');
    if (!token) return; // 未登录不检查
    
    // 调用封禁检查API
    fetch('/api/auth/check', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw response;
        }
        return response.json();
    })
    .then(data => {
        // 成功，用户未被封禁
        console.log('用户状态正常');
    })
    .catch(async (error) => {
        try {
            // 尝试解析错误
            const errorData = await error.json();
            
            // 检查是否因为封禁而失败
            if (error.status === 403 && errorData.data && errorData.data.isBanned) {
                // 显示封禁提示
                showBanMessage(errorData.data);
            }
        } catch (parseError) {
            console.error('解析错误响应失败:', parseError);
        }
    });
}

/**
 * 显示封禁消息模态框
 */
function showBanMessage(banData) {
    // 创建模态框
    const modalContainer = document.createElement('div');
    modalContainer.style.position = 'fixed';
    modalContainer.style.top = '0';
    modalContainer.style.left = '0';
    modalContainer.style.width = '100%';
    modalContainer.style.height = '100%';
    modalContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modalContainer.style.display = 'flex';
    modalContainer.style.justifyContent = 'center';
    modalContainer.style.alignItems = 'center';
    modalContainer.style.zIndex = '9999';
    
    // 创建模态框内容
    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '8px';
    modalContent.style.maxWidth = '400px';
    modalContent.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
    
    // 添加标题
    const title = document.createElement('h3');
    title.textContent = '账号已被封禁';
    title.style.color = 'red';
    title.style.marginBottom = '15px';
    title.style.borderBottom = '1px solid #eee';
    title.style.paddingBottom = '10px';
    modalContent.appendChild(title);
    
    // 添加封禁原因
    const reasonDiv = document.createElement('div');
    reasonDiv.style.marginBottom = '10px';
    reasonDiv.innerHTML = `<strong>封禁原因:</strong> ${banData.reason || '违反用户协议'}`;
    modalContent.appendChild(reasonDiv);
    
    // 添加封禁时间
    if (banData.bannedAt) {
        const timeDiv = document.createElement('div');
        timeDiv.style.marginBottom = '10px';
        timeDiv.innerHTML = `<strong>封禁时间:</strong> ${new Date(banData.bannedAt).toLocaleString()}`;
        modalContent.appendChild(timeDiv);
    }
    
    // 添加解封时间（如果有）
    if (banData.unbannedAt) {
        const unbanTimeDiv = document.createElement('div');
        unbanTimeDiv.style.marginBottom = '10px';
        unbanTimeDiv.innerHTML = `<strong>解封时间:</strong> ${new Date(banData.unbannedAt).toLocaleString()}`;
        modalContent.appendChild(unbanTimeDiv);
    }
    
    // 添加按钮
    const buttonDiv = document.createElement('div');
    buttonDiv.style.textAlign = 'center';
    buttonDiv.style.marginTop = '20px';
    
    const okButton = document.createElement('button');
    okButton.textContent = '确定';
    okButton.style.padding = '8px 20px';
    okButton.style.backgroundColor = '#3B82F6';
    okButton.style.color = 'white';
    okButton.style.border = 'none';
    okButton.style.borderRadius = '4px';
    okButton.style.cursor = 'pointer';
    okButton.onclick = () => {
        document.body.removeChild(modalContainer);
        // 强制登出
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    };
    
    buttonDiv.appendChild(okButton);
    modalContent.appendChild(buttonDiv);
    modalContainer.appendChild(modalContent);
    document.body.appendChild(modalContainer);
}

// 导出函数和变量供其他脚本使用
window.checkAuth = checkAuth;
window.checkBanStatus = checkBanStatus;
window.isAuthPage = isAuthPage;
// 将isAuthChecking状态暴露给全局，供其他脚本检查
Object.defineProperty(window, 'isAuthChecking', {
    get: function() { return isAuthChecking; },
    enumerable: true
}); 