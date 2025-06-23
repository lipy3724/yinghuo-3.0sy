/**
 * 统一的认证检查脚本
 * 用于所有功能页面，确保用户在会话失效或被管理员终止时能够正确登出
 */

// 防抖机制 - 避免短时间内重复验证
let lastAuthCheck = 0;
const AUTH_CHECK_DEBOUNCE = 3000; // 3秒内不重复验证
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
                    
                    // 获取响应数据以检查是否被强制登出
                    let responseData = null;
                    try {
                        responseData = await response.json();
                    } catch (e) {
                        console.error('解析响应数据失败:', e);
                        // 如果解析失败但状态码是200，可能是网络问题，不要立即重定向
                        if (response.status === 200) {
                            console.log('响应状态正常但解析失败，可能是网络问题，暂不重定向');
                            return true; // 暂时认为验证成功
                        }
                    }
                    
                    // 如果会话无效，清除登录信息并重定向
                    if (response.status === 401 || response.status === 403) {
                        console.log('服务器确认会话已失效或被管理员终止');
                        
                        // 检查是否是被管理员强制登出
                        const isForceLogout = responseData && 
                                             responseData.data && 
                                             responseData.data.userSessionTerminated === true;
                        
                        if (isForceLogout) {
                            console.log('管理员已强制登出此用户的所有设备');
                            // 显示提示消息
                            alert('您的账号已被管理员强制下线，请重新登录');
                        }
                        
                        if (redirectOnFailure) {
                            // 如果存在全局登出函数，使用它
                            if (typeof window.userLogout === 'function') {
                                window.userLogout();
                            } else if (typeof window.logout === 'function') {
                                window.logout();
                            } else {
                                // 否则手动清除并重定向
                                clearAuthAndRedirect();
                            }
                        }
                        return false;
                    }
                    
                    // 如果状态码是200，认为验证成功
                    if (response.status === 200) {
                        return true;
                    }
                    
                    if (response.ok && responseData && responseData.success) {
                        return true;
                    }
                    
                    // 其他状态码，准备重试
                    throw new Error(`HTTP ${response.status}`);
                    
                } catch (error) {
                    retryCount++;
                    console.warn(`验证尝试 ${retryCount} 失败:`, error.message);
                    
                    if (retryCount <= maxRetries) {
                        // 等待后重试
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                    }
                }
            }
            
            // 所有重试都失败了，但本地有token，优先信任本地状态
            console.log('服务器验证失败，但本地token存在，暂不重定向');
            return true; // 网络问题时暂时认为验证成功
            
        } catch (error) {
            console.error('验证会话时出错:', error);
            
            // 网络错误不要立即重定向，给用户一些时间
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                console.log('网络请求失败，可能是网络问题，暂不重定向');
                return true; // 网络问题时暂时认为验证成功
            }
            
            // 如果是AbortError（超时），也不要立即重定向
            if (error.name === 'AbortError') {
                console.log('请求被中止（可能是超时），暂不重定向');
                return true;
            }
            
            // 其他错误，根据参数决定是否重定向
            if (redirectOnFailure) {
                console.log('其他验证错误，将重定向到登录页');
                clearAuthAndRedirect();
            }
            return false;
        }
        
    } finally {
        // 确保清除检查标志
        setTimeout(() => {
            isAuthChecking = false;
        }, 500);
    }
}

// 重定向到登录页面，可选择保存当前URL用于登录后返回
function redirectToLogin() {
    const currentUrl = window.location.href;
    localStorage.setItem('redirectAfterLogin', currentUrl);
    window.location.href = '/login.html';
}

// 清除认证信息并重定向到登录页
function clearAuthAndRedirect() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    redirectToLogin();
}

// 检查功能访问权限
async function checkFeatureAccess(featureName) {
    // 首先检查基本认证
    const isAuthenticated = await checkAuth(false);
    if (!isAuthenticated) {
        redirectToLogin();
        return false;
    }
    
    // 可以在这里添加功能特定的访问检查逻辑
    return true;
}

// 页面加载时自动验证
document.addEventListener('DOMContentLoaded', function() {
    // 如果页面不是登录页或注册页，执行验证
    const isAuthPage = window.location.pathname.includes('login.html') || 
                      window.location.pathname.includes('register.html') ||
                      window.location.pathname.includes('phone-login.html') ||
                      window.location.pathname.includes('phone-register.html');
    
    if (!isAuthPage && localStorage.getItem('authToken')) {
        // 添加延迟，避免刚登录成功就被重定向
        // 特别是从登录页面跳转过来的情况
        const referrer = document.referrer;
        const isFromLoginPage = referrer.includes('login.html') || 
                               referrer.includes('phone-login.html') ||
                               referrer.includes('register.html') ||
                               referrer.includes('phone-register.html');
        
        // 检查是否是刚刚登录成功（通过检查localStorage的写入时间）
        const authToken = localStorage.getItem('authToken');
        const userInfo = localStorage.getItem('user');
        const isRecentLogin = authToken && userInfo && isFromLoginPage;
        
        // 增加更保守的延迟策略，避免误跳转
        if (isRecentLogin) {
            // 如果是刚登录成功，延迟更长时间再验证，确保登录状态稳定
            console.log('检测到刚登录成功，延迟验证以确保状态稳定');
            setTimeout(() => {
                // 使用非阻塞的认证检查，失败时不立即跳转
                checkAuthWithFallback();
            }, 5000); // 延迟5秒
        } else if (isFromLoginPage) {
            // 如果是从登录页面跳转过来但token可能是旧的，延迟验证
            setTimeout(() => {
                checkAuthWithFallback();
            }, 3000); // 延迟3秒
        } else {
            // 否则延迟验证，给页面足够时间加载
            setTimeout(() => {
                checkAuthWithFallback();
            }, 2000); // 延迟2秒
        }
    }
});

// 带有回退机制的认证检查
async function checkAuthWithFallback() {
    try {
        // 首先进行本地状态检查
        const authToken = localStorage.getItem('authToken');
        const userInfo = localStorage.getItem('user');
        
        if (!authToken || !userInfo) {
            console.log('本地没有认证信息，但不立即跳转，让用户手动操作');
            return false;
        }
        
        // 验证本地信息格式
        try {
            const user = JSON.parse(userInfo);
            if (!user.id || !user.username) {
                console.log('本地用户信息格式无效，但不立即跳转');
                return false;
            }
        } catch (e) {
            console.log('本地用户信息解析失败，但不立即跳转');
            return false;
        }
        
        // 进行服务器验证，但失败时不强制跳转
        const isValid = await checkAuth(false); // 不自动重定向
        
        if (!isValid) {
            console.log('服务器认证失败，但保留本地状态，让用户在使用功能时再次验证');
            // 可以在这里显示一个温和的提示，而不是强制跳转
            // showAuthWarning();
        }
        
        return isValid;
    } catch (error) {
        console.error('认证检查出错，但不影响页面使用:', error);
        return true; // 出错时不阻止用户使用页面
    }
}

// 可选：显示认证警告（不强制跳转）
function showAuthWarning() {
    // 可以在页面顶部显示一个温和的提示条
    const existingWarning = document.getElementById('auth-warning');
    if (existingWarning) return; // 避免重复显示
    
    const warningBar = document.createElement('div');
    warningBar.id = 'auth-warning';
    warningBar.className = 'fixed top-0 left-0 right-0 bg-yellow-100 border-b border-yellow-300 text-yellow-800 px-4 py-2 text-sm z-50';
    warningBar.innerHTML = `
        <div class="flex items-center justify-between">
            <span>登录状态可能已过期，如果使用功能时遇到问题，请重新登录</span>
            <button onclick="this.parentElement.parentElement.remove()" class="text-yellow-600 hover:text-yellow-800">
                <i class="ri-close-line"></i>
            </button>
        </div>
    `;
    document.body.insertBefore(warningBar, document.body.firstChild);
    
    // 10秒后自动消失
    setTimeout(() => {
        if (warningBar.parentNode) {
            warningBar.remove();
        }
    }, 10000);
}

// 暴露给全局作用域
window.checkAuth = checkAuth;
window.checkFeatureAccess = checkFeatureAccess; 