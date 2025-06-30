/* 组件JavaScript文件 - 导航栏和侧边栏交互功能 */

// 检查用户权限并重定向 - 核心功能函数
function checkAuthAndRedirect(url) {
    const token = getAuthToken();
    if (token) {
        // 在新标签页中打开功能页面
        window.open(url, '_blank');
    } else {
        // 登录页面在当前页面打开
        window.location.href = '/login.html?redirect=' + encodeURIComponent(url);
    }
}

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
    // 延迟初始化，确保导航栏HTML已加载
    setTimeout(() => {
        initializeComponents();
    }, 300);
});

// 如果页面已经加载完成，立即初始化
if (document.readyState === 'loading') {
    // 文档仍在加载中，等待DOMContentLoaded
} else {
    // 文档已经加载完成
    setTimeout(() => {
        initializeComponents();
    }, 300);
}

// 初始化所有组件
function initializeComponents() {
    initializeNavbar();
    initializeSidebar();
    initializeQuickAccess();
    initializeAuth();
}

// 初始化导航栏功能
function initializeNavbar() {
    console.log('初始化导航栏功能...');
    
    // 功能中心下拉菜单
    const featuresMenuBtn = document.getElementById('features-menu-btn');
    const featuresDropdown = document.getElementById('features-dropdown');
    
    console.log('功能中心按钮:', featuresMenuBtn);
    console.log('功能中心下拉菜单:', featuresDropdown);
    
    if (featuresMenuBtn && featuresDropdown) {
        console.log('功能中心下拉菜单初始化成功');
        let isMenuOpen = false;
        let hideTimeout;
        
        // 显示菜单
        function showMenu() {
            clearTimeout(hideTimeout);
            if (!isMenuOpen) {
                featuresDropdown.classList.remove('hidden');
                setTimeout(() => {
                    featuresDropdown.classList.add('visible');
                }, 10);
                isMenuOpen = true;
                
                // 更新箭头图标
                const arrow = featuresMenuBtn.querySelector('.arrow-icon');
                if (arrow) {
                    arrow.classList.remove('ri-arrow-down-s-line');
                    arrow.classList.add('ri-arrow-up-s-line');
                }
            }
        }
        
        // 隐藏菜单
        function hideMenu() {
            if (isMenuOpen) {
                featuresDropdown.classList.remove('visible');
                hideTimeout = setTimeout(() => {
                    featuresDropdown.classList.add('hidden');
                }, 150);
                isMenuOpen = false;
                
                // 更新箭头图标
                const arrow = featuresMenuBtn.querySelector('.arrow-icon');
                if (arrow) {
                    arrow.classList.remove('ri-arrow-up-s-line');
                    arrow.classList.add('ri-arrow-down-s-line');
                }
            }
        }
        
        // 事件监听
        featuresMenuBtn.addEventListener('mouseenter', showMenu);
        featuresMenuBtn.addEventListener('mouseleave', () => {
            hideTimeout = setTimeout(hideMenu, 100);
        });
        
        featuresDropdown.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
        });
        featuresDropdown.addEventListener('mouseleave', hideMenu);
    } else {
        console.log('功能中心下拉菜单元素未找到');
    }
    
    // 积分中心下拉菜单
    const creditsMenuBtn = document.getElementById('credits-menu-btn');
    const creditsDropdown = document.getElementById('credits-dropdown');
    
    console.log('积分中心按钮:', creditsMenuBtn);
    console.log('积分中心下拉菜单:', creditsDropdown);
    
    if (creditsMenuBtn && creditsDropdown) {
        console.log('积分中心下拉菜单初始化成功');
        let isCreditsMenuOpen = false;
        let creditsHideTimeout;
        
        // 显示菜单
        function showCreditsMenu() {
            clearTimeout(creditsHideTimeout);
            if (!isCreditsMenuOpen) {
                creditsDropdown.classList.remove('hidden');
                isCreditsMenuOpen = true;
                
                // 更新箭头图标
                const arrow = creditsMenuBtn.querySelector('.arrow-icon');
                if (arrow) {
                    arrow.classList.remove('ri-arrow-down-s-line');
                    arrow.classList.add('ri-arrow-up-s-line');
                }
            }
        }
        
        // 隐藏菜单
        function hideCreditsMenu() {
            if (isCreditsMenuOpen) {
                creditsHideTimeout = setTimeout(() => {
                    creditsDropdown.classList.add('hidden');
                }, 150);
                isCreditsMenuOpen = false;
                
                // 更新箭头图标
                const arrow = creditsMenuBtn.querySelector('.arrow-icon');
                if (arrow) {
                    arrow.classList.remove('ri-arrow-up-s-line');
                    arrow.classList.add('ri-arrow-down-s-line');
                }
            }
        }
        
        // 事件监听
        creditsMenuBtn.addEventListener('mouseenter', showCreditsMenu);
        creditsMenuBtn.addEventListener('mouseleave', () => {
            creditsHideTimeout = setTimeout(hideCreditsMenu, 100);
        });
        
        creditsDropdown.addEventListener('mouseenter', () => {
            clearTimeout(creditsHideTimeout);
        });
        creditsDropdown.addEventListener('mouseleave', hideCreditsMenu);
    } else {
        console.log('积分中心下拉菜单元素未找到');
    }
    
    // 用户菜单下拉
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdown = document.getElementById('user-dropdown');
    
    console.log('用户菜单按钮:', userMenuBtn);
    console.log('用户菜单下拉:', userDropdown);
    
    if (userMenuBtn && userDropdown) {
        console.log('用户菜单下拉初始化成功');
        let isUserMenuOpen = false;
        let userHideTimeout;
        
        // 显示菜单
        function showUserMenu() {
            clearTimeout(userHideTimeout);
            if (!isUserMenuOpen) {
                userDropdown.classList.remove('hidden');
                isUserMenuOpen = true;
                
                // 更新箭头图标
                const arrow = userMenuBtn.querySelector('.arrow-icon');
                if (arrow) {
                    arrow.classList.remove('ri-arrow-down-s-line');
                    arrow.classList.add('ri-arrow-up-s-line');
                }
            }
        }
        
        // 隐藏菜单
        function hideUserMenu() {
            if (isUserMenuOpen) {
                userHideTimeout = setTimeout(() => {
                    userDropdown.classList.add('hidden');
                }, 150);
                isUserMenuOpen = false;
                
                // 更新箭头图标
                const arrow = userMenuBtn.querySelector('.arrow-icon');
                if (arrow) {
                    arrow.classList.remove('ri-arrow-up-s-line');
                    arrow.classList.add('ri-arrow-down-s-line');
                }
            }
        }
        
        // 事件监听
        userMenuBtn.addEventListener('mouseenter', showUserMenu);
        userMenuBtn.addEventListener('mouseleave', () => {
            userHideTimeout = setTimeout(hideUserMenu, 100);
        });
        
        userDropdown.addEventListener('mouseenter', () => {
            clearTimeout(userHideTimeout);
        });
        userDropdown.addEventListener('mouseleave', hideUserMenu);
    } else {
        console.log('用户菜单下拉元素未找到');
    }
}

// 初始化侧边栏功能
function initializeSidebar() {
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const body = document.body;
    
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', function() {
            body.classList.toggle('sidebar-collapsed');
            
            // 保存状态到localStorage
            const isCollapsed = body.classList.contains('sidebar-collapsed');
            localStorage.setItem('sidebar-collapsed', isCollapsed);
        });
        
        // 恢复侧边栏状态
        const savedState = localStorage.getItem('sidebar-collapsed');
        if (savedState === 'true') {
            body.classList.add('sidebar-collapsed');
        }
    }
}

// 初始化快捷访问功能
function initializeQuickAccess() {
    const quickAccessBtn = document.getElementById('quick-access-btn');
    const quickAccessDropdown = document.getElementById('quick-access-dropdown');
    const closeDropdownBtn = document.getElementById('close-dropdown');
    const selectedCountSpan = document.getElementById('selected-count');
    const sidebarFeaturesContainer = document.getElementById('sidebar-features-container');
    
    if (quickAccessBtn && quickAccessDropdown) {
        // 打开快捷访问菜单
        quickAccessBtn.addEventListener('click', function() {
            quickAccessDropdown.classList.remove('hidden');
            updateSelectedCount();
            loadSavedFeatures();
        });
        
        // 关闭快捷访问菜单
        if (closeDropdownBtn) {
            closeDropdownBtn.addEventListener('click', function() {
                quickAccessDropdown.classList.add('hidden');
                saveSelectedFeatures();
                updateSidebar();
            });
        }
        
        // 点击背景关闭
        quickAccessDropdown.addEventListener('click', function(e) {
            if (e.target === quickAccessDropdown) {
                quickAccessDropdown.classList.add('hidden');
                saveSelectedFeatures();
                updateSidebar();
            }
        });
        
        // 复选框变化事件
        const checkboxes = quickAccessDropdown.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                updateSelectedCount();
                
                // 限制最多选择10个
                const checkedCount = quickAccessDropdown.querySelectorAll('input[type="checkbox"]:checked').length;
                if (checkedCount >= 10) {
                    const uncheckedBoxes = quickAccessDropdown.querySelectorAll('input[type="checkbox"]:not(:checked)');
                    uncheckedBoxes.forEach(box => {
                        box.disabled = true;
                        box.parentElement.style.opacity = '0.5';
                    });
                } else {
                    const disabledBoxes = quickAccessDropdown.querySelectorAll('input[type="checkbox"]:disabled');
                    disabledBoxes.forEach(box => {
                        box.disabled = false;
                        box.parentElement.style.opacity = '1';
                    });
                }
            });
        });
    }
    
    // 更新选中数量显示
    function updateSelectedCount() {
        if (selectedCountSpan) {
            const checkedCount = quickAccessDropdown.querySelectorAll('input[type="checkbox"]:checked').length;
            selectedCountSpan.textContent = `(${checkedCount}/10)`;
        }
    }
    
    // 保存选中的功能
    function saveSelectedFeatures() {
        const checkedBoxes = quickAccessDropdown.querySelectorAll('input[type="checkbox"]:checked');
        const features = Array.from(checkedBoxes).map(checkbox => ({
            feature: checkbox.dataset.feature,
            icon: checkbox.dataset.icon,
            bg: checkbox.dataset.bg,
            color: checkbox.dataset.color,
            url: checkbox.dataset.url
        }));
        
        localStorage.setItem('quick-access-features', JSON.stringify(features));
    }
    
    // 加载保存的功能
    function loadSavedFeatures() {
        const saved = localStorage.getItem('quick-access-features');
        if (saved) {
            const features = JSON.parse(saved);
            const checkboxes = quickAccessDropdown.querySelectorAll('input[type="checkbox"]');
            
            // 先取消所有选中
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            
            // 设置保存的选中状态
            features.forEach(feature => {
                const checkbox = quickAccessDropdown.querySelector(`input[data-feature="${feature.feature}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }
    }
    
    // 更新侧边栏显示
    function updateSidebar() {
        if (!sidebarFeaturesContainer) return;
        
        const saved = localStorage.getItem('quick-access-features');
        const emptyState = sidebarFeaturesContainer.querySelector('.empty-state');
        
        if (saved) {
            const features = JSON.parse(saved);
            
            if (features.length > 0) {
                // 隐藏空状态
                if (emptyState) {
                    emptyState.classList.add('hidden');
                }
                
                // 清除现有内容（除了空状态）
                const existingItems = sidebarFeaturesContainer.querySelectorAll('.sidebar-feature-item');
                existingItems.forEach(item => item.remove());
                
                // 添加功能项
                features.forEach(feature => {
                    const item = createSidebarFeatureItem(feature);
                    sidebarFeaturesContainer.appendChild(item);
                });
            } else {
                // 显示空状态
                if (emptyState) {
                    emptyState.classList.remove('hidden');
                }
                
                // 清除所有功能项
                const existingItems = sidebarFeaturesContainer.querySelectorAll('.sidebar-feature-item');
                existingItems.forEach(item => item.remove());
            }
        }
    }
    
    // 创建侧边栏功能项
    function createSidebarFeatureItem(feature) {
        const item = document.createElement('li');
        item.className = 'sidebar-feature-item';
        
        item.innerHTML = `
            <a href="javascript:void(0)" onclick="checkAuthAndRedirect('${feature.url}')" 
               class="flex items-center p-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                <div class="flex-shrink-0 w-8 h-8 ${feature.bg} rounded-lg flex items-center justify-center mr-3">
                    <i class="${feature.icon} ${feature.color} text-sm"></i>
                </div>
                <span class="text-sm font-medium">${feature.feature}</span>
            </a>
        `;
        
        return item;
    }
    
    // 初始加载侧边栏
    updateSidebar();
}

// 初始化用户认证相关功能
function initializeAuth() {
    console.log('初始化认证功能...');
    
    // 检查登录状态并更新UI
    updateNavbarLoginStatus();
}

// 检查用户登录状态并更新导航栏UI
function updateNavbarLoginStatus() {
    const token = getAuthToken();
    const userInfo = localStorage.getItem('user');
    
    const loginBtn = document.getElementById('login-btn');
    const userInfoEl = document.getElementById('user-info');
    
    console.log('登录状态检查 - Token:', !!token, 'UserInfo:', !!userInfo);
    console.log('登录按钮:', loginBtn, '用户信息元素:', userInfoEl);
    
    if (token && userInfo && loginBtn && userInfoEl) {
        try {
            const user = JSON.parse(userInfo);
            console.log('用户信息:', user);
            
            // 更新UI显示登录状态
            loginBtn.classList.add('hidden');
            userInfoEl.classList.remove('hidden');
            
            const usernameDisplay = document.getElementById('username-display');
            if (usernameDisplay) {
                usernameDisplay.textContent = user.username || '用户';
            }
            
            // 添加登出功能
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                // 移除可能存在的旧事件监听器
                const newLogoutBtn = logoutBtn.cloneNode(true);
                logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
                
                newLogoutBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('user');
                    
                    // 检查当前是否在home.html页面
                    const isHomePage = window.location.pathname.includes('home.html') || window.location.pathname === '/' || window.location.pathname === '/index.html';
                    
                    // 如果不在home页面，才进行跳转
                    if (!isHomePage) {
                    window.location.href = '/';
                    } else {
                        // 在home页面，只更新UI状态
                        console.log('在home页面退出登录，不进行跳转');
                        // 如果存在这些元素，更新UI状态
                        const userInfo = document.getElementById('user-info');
                        const loginBtn = document.getElementById('login-btn');
                        if (userInfo) userInfo.classList.add('hidden');
                        if (loginBtn) loginBtn.classList.remove('hidden');
                    }
                });
            }
        } catch (e) {
            console.error('解析用户信息出错:', e);
        }
    } else if (loginBtn && userInfoEl) {
        // 用户未登录，显示登录按钮
        loginBtn.classList.remove('hidden');
        userInfoEl.classList.add('hidden');
    }
}

// 工具函数：显示Toast消息
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white z-50 transition-all duration-300 transform translate-x-full opacity-0`;
    
    // 根据类型设置背景色
    switch (type) {
        case 'success':
            toast.classList.add('bg-green-500');
            break;
        case 'error':
            toast.classList.add('bg-red-500');
            break;
        case 'warning':
            toast.classList.add('bg-yellow-500');
            break;
        default:
            toast.classList.add('bg-blue-500');
    }
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // 显示动画
    setTimeout(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// 客服组件加载器
window.loadCustomerService = function() {
    console.log('开始加载客服组件...');
    
    return fetch('/components/customer-service-ultra-simple.html')
        .then(response => {
            console.log('客服组件请求响应:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.text();
        })
        .then(html => {
            // 检查是否已经加载了客服组件
            if (document.getElementById('cs-float-button')) {
                console.log('客服组件已存在，跳过加载');
                return;
            }
            
            console.log('插入客服组件HTML...');
            
            // 直接插入HTML到body
            document.body.insertAdjacentHTML('beforeend', html);
            
            // 验证组件是否成功插入
            const floatBtn = document.getElementById('cs-float-button');
            const chatWindow = document.getElementById('cs-chat-window');
            
            if (floatBtn && chatWindow) {
                console.log('客服组件加载成功，按钮和窗口元素已找到');
                // 等待一段时间确保脚本执行完成
                setTimeout(() => {
                    if (typeof window.toggleChatWindow === 'function') {
                        console.log('客服组件JavaScript函数已就绪');
                    } else {
                        console.error('客服组件JavaScript函数未定义');
                    }
                }, 500);
            } else {
                console.error('客服组件加载失败，未找到必要元素');
            }
        })
        .catch(error => {
            console.error('客服组件加载失败:', error);
        });
};

// 自动加载客服组件
function initCustomerService() {
    // 排除管理员后台页面
    if (window.location.pathname.includes('adminkefu.html')) {
        console.log('管理员后台页面，跳过客服组件加载');
        return;
    }
    
    // 只在首页和home.html页面显示客服图标
    const currentPath = window.location.pathname;
    if (currentPath === '/' || currentPath === '/index.html' || currentPath === '/home.html') {
        console.log('首页或home页面，加载客服组件');
        window.loadCustomerService();
    } else {
        console.log('非首页或home页面，跳过客服组件加载');
    }
}

// 页面加载完成后初始化客服组件
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCustomerService);
} else {
    // 如果DOM已经加载完成，立即执行
    initCustomerService();
}

// ============ 客服系统JavaScript函数 ============
// 全局变量
window.csIsChatOpen = false;
window.csCurrentUserId = null;
window.csUnreadCount = 0;

// 调试日志函数
function csLog(message) {
    console.log('[客服系统] ' + message);
}

// 简化的用户ID获取函数
function getUserId() {
    // 检查缓存，如果有缓存直接返回，不输出日志
    if (window.csCurrentUserId && typeof window.csCurrentUserId === 'number') {
        return window.csCurrentUserId;
    }
    
    csLog('🔍 获取用户ID');
    
    // 尝试从localStorage获取用户信息
    try {
        var userInfo = localStorage.getItem('user');
        if (userInfo && userInfo !== 'null') {
            var user = JSON.parse(userInfo);
            if (user && user.id && !isNaN(user.id)) {
                var realUserId = parseInt(user.id);
                window.csCurrentUserId = realUserId;
                csLog('✅ 用户ID: ' + realUserId);
                return realUserId;
            }
        }
    } catch (error) {
        csLog('❌ 解析用户信息失败: ' + error.message);
    }
    
    // 生成访客ID
    var guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    csLog('⚠️ 生成访客ID');
    return guestId;
}

// 切换聊天窗口 - 全局函数
window.toggleChatWindow = function() {
    csLog('🖱️ 切换聊天窗口');
    var chatWindow = document.getElementById('cs-chat-window');
    
    if (!chatWindow) {
        csLog('❌ 找不到聊天窗口元素');
        return;
    }
    
    if (window.csIsChatOpen) {
        window.closeChatWindow();
    } else {
        window.openChatWindow();
    }
};

// 打开聊天窗口
window.openChatWindow = function() {
    csLog('📖 打开聊天窗口');
    var chatWindow = document.getElementById('cs-chat-window');
    
    if (chatWindow) {
        chatWindow.classList.add('show');
        window.csIsChatOpen = true;
        loadMessages();
        focusInput();
    }
};

// 关闭聊天窗口
window.closeChatWindow = function() {
    csLog('📕 关闭聊天窗口');
    var chatWindow = document.getElementById('cs-chat-window');
    
    if (chatWindow) {
        chatWindow.classList.remove('show');
        window.csIsChatOpen = false;
    }
};

// 发送消息
window.sendMessage = function() {
    var input = document.getElementById('cs-chat-input');
    var message = input.value.trim();
    
    if (!message) {
        csLog('❌ 消息为空');
        return;
    }
    
    csLog('📤 发送消息: ' + message);
    
    // 显示用户消息
    addMessage(message, 'user');
    
    // 用户发送消息时强制滚动到底部
    var messagesContainer = document.getElementById('cs-chat-messages');
    if (messagesContainer) {
        smartScrollToBottom(messagesContainer, true);
    }
    
    // 清空输入框
    input.value = '';
    
    // 发送到服务器
    sendToServer(message);
};

// 添加消息到界面
function addMessage(content, type) {
    var messagesContainer = document.getElementById('cs-chat-messages');
    var messageDiv = document.createElement('div');
    messageDiv.className = 'cs-message ' + type;
    
    var now = new Date();
    var timeStr = now.getHours().toString().padStart(2, '0') + ':' + 
                  now.getMinutes().toString().padStart(2, '0');
    
    // 为管理员消息添加头像，用户消息保持简洁
    if (type === 'admin') {
        messageDiv.innerHTML = 
            '<div class="cs-message-content">' + escapeHtml(content) + '</div>' +
            '<div class="cs-message-footer" style="display: flex !important; align-items: center !important; gap: 6px !important; margin-top: 4px !important; flex-direction: row !important;">' +
                '<img src="/public/images/favicon.png" class="cs-message-avatar" alt="客服头像" style="width: 16px; height: 16px; max-width: 16px; max-height: 16px; margin-left: -10px;">' +
                '<div class="cs-message-time" style="font-size: 11px !important; color: #999 !important; margin-top: 0px !important; white-space: nowrap !important;">' + timeStr + '</div>' +
            '</div>';
    } else {
        // 用户消息保持简洁样式
        messageDiv.innerHTML = 
            '<div class="cs-message-content">' + escapeHtml(content) + '</div>' +
            '<div class="cs-message-time">' + timeStr + '</div>';
    }
    
    messagesContainer.appendChild(messageDiv);
    
    // 为新消息添加点击事件
    addClickEventToMessage(messageDiv);
    
    smartScrollToBottom(messagesContainer);
}

// HTML转义
function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 智能滚动到底部 - 只有用户在底部附近时才自动滚动
function smartScrollToBottom(messagesContainer, force = false) {
    if (!messagesContainer) return;
    
    // 如果强制滚动（比如用户发送消息时），直接滚动到底部
    if (force) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return;
    }
    
    // 检查用户是否在底部附近（距离底部100px以内）
    var isNearBottom = messagesContainer.scrollTop + messagesContainer.clientHeight >= messagesContainer.scrollHeight - 100;
    
    // 只有在底部附近时才自动滚动
    if (isNearBottom) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// 发送消息到服务器
function sendToServer(message) {
    var userId = getUserId();
    
    // 检查是否为访客ID
    if (userId.toString().startsWith('guest_')) {
        csLog('⚠️ 访客用户，显示登录提示');
        addMessage('抱歉，您需要先登录才能使用客服功能。请点击右上角登录按钮进行登录。', 'admin');
        return;
    }
    
    // 确保userId是数字类型
    if (isNaN(userId)) {
        csLog('❌ 用户ID格式错误: ' + userId);
        addMessage('抱歉，您的登录信息有误，请重新登录后再试。', 'admin');
        return;
    }
    
    csLog('📡 发送到服务器，用户ID: ' + userId);
    
    fetch('/api/user-kefu/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
            userId: parseInt(userId),
            message: message,
            type: 'user'
        })
    })
    .then(function(response) {
        csLog('📡 服务器响应: ' + response.status);
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        return response.json();
    })
    .then(function(data) {
        if (data.success) {
            csLog('✅ 消息发送成功');
        } else {
            csLog('❌ 消息发送失败: ' + (data.error || '未知错误'));
            addMessage('消息发送失败，请稍后重试。', 'admin');
        }
    })
    .catch(function(error) {
        csLog('❌ 发送失败: ' + error.message);
        if (error.message.includes('404')) {
            addMessage('客服服务暂时不可用，请稍后重试。', 'admin');
        } else {
            addMessage('网络连接异常，请检查网络后重试。', 'admin');
        }
    });
}

// 加载历史消息
function loadMessages() {
    var userId = getUserId();
    
    // 如果是访客用户，不加载历史消息
    if (userId.toString().startsWith('guest_')) {
        csLog('⚠️ 访客用户，不加载历史消息');
        return;
    }
    
    if (isNaN(userId)) {
        csLog('❌ 用户ID格式错误，无法加载历史消息');
        return;
    }
    
    // 检查是否已经加载过历史消息（会话级别缓存）
    var sessionKey = 'cs_messages_loaded_' + userId;
    var hasLoadedMessages = sessionStorage.getItem(sessionKey);
    
    // 检查聊天窗口是否已有历史消息（除了默认欢迎消息）
    var messagesContainer = document.getElementById('cs-chat-messages');
    var existingMessages = messagesContainer ? messagesContainer.querySelectorAll('.cs-message') : [];
    var hasVisibleMessages = existingMessages.length > 1; // 大于1是因为有默认欢迎消息
    
    if (hasLoadedMessages === 'true' && hasVisibleMessages) {
        csLog('📋 本次会话已加载过历史消息，且聊天窗口有消息，跳过重复加载');
        return;
    }
    
    if (hasLoadedMessages === 'true' && !hasVisibleMessages) {
        csLog('🔄 检测到页面刷新，重新加载历史消息');
    }
    
    csLog('📥 加载历史消息');
    
    fetch('/api/user-kefu/messages?userId=' + parseInt(userId), {
        headers: {
            'Authorization': `Bearer ${getAuthToken()}`
        }
    })
    .then(function(response) {
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        return response.json();
    })
    .then(function(data) {
        if (data.success && data.messages) {
            csLog('✅ 加载了 ' + data.messages.length + ' 条历史消息');
            displayMessages(data.messages);
            
            // 标记本次会话已加载过历史消息
            sessionStorage.setItem(sessionKey, 'true');
            
            // 设置最后消息时间
            if (data.messages.length > 0) {
                const latestMessage = data.messages.reduce((latest, msg) => {
                    return new Date(msg.timestamp) > new Date(latest.timestamp) ? msg : latest;
                });
                lastMessageTime = latestMessage.timestamp;
            }
        }
    })
    .catch(function(error) {
        csLog('❌ 加载消息失败: ' + error.message);
    });
}

// 显示消息列表
function displayMessages(messages) {
    var messagesContainer = document.getElementById('cs-chat-messages');
    if (!messagesContainer) return;
    
    // 保存默认欢迎消息
    var welcomeMsg = messagesContainer.querySelector('.cs-message.admin');
    var welcomeHTML = '';
    if (welcomeMsg) {
        welcomeHTML = welcomeMsg.outerHTML;
    }
    
    // 清空消息容器
    messagesContainer.innerHTML = '';
    
    // 重新添加欢迎消息
    if (welcomeHTML) {
        messagesContainer.insertAdjacentHTML('beforeend', welcomeHTML);
    }
    
    // 清空已显示消息记录，避免重复
    displayedMessageIds.clear();
    
    // 添加历史消息
    for (var i = 0; i < messages.length; i++) {
        var msg = messages[i];
        addMessage(msg.message, msg.type);
        
        // 记录历史消息ID，避免轮询时重复显示
        var messageKey = msg.id || (msg.userId + '_' + msg.message + '_' + msg.timestamp);
        displayedMessageIds.add(messageKey);
    }
    
    // 为欢迎消息添加点击事件
    var welcomeMsgElement = messagesContainer.querySelector('.cs-message.admin');
    if (welcomeMsgElement) {
        welcomeMsgElement.addEventListener('click', function(e) {
            // 移除所有消息的选中状态
            var allMessages = messagesContainer.querySelectorAll('.cs-message');
            allMessages.forEach(function(msg) {
                msg.classList.remove('selected');
            });
            
            // 为当前消息添加选中状态
            welcomeMsgElement.classList.add('selected');
        });
    }
    
    // 初始加载历史消息后，强制滚动到底部
    if (messages.length > 0) {
        smartScrollToBottom(messagesContainer, true);
    }
    
    csLog('✅ 显示了欢迎消息 + ' + messages.length + ' 条历史消息');
}

// 聚焦输入框
function focusInput() {
    setTimeout(function() {
        var input = document.getElementById('cs-chat-input');
        if (input) {
            input.focus();
        }
    }, 100);
}

// 设置回车发送
function setupInputEvents() {
    var input = document.getElementById('cs-chat-input');
    if (input) {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                window.sendMessage();
            }
        });
    }
}

// 客服系统初始化
function initCustomerServiceFunctions() {
    csLog('🚀 客服系统函数初始化');
    setupInputEvents();
    
    // 为初始欢迎消息添加点击事件
    setTimeout(function() {
        var messagesContainer = document.getElementById('cs-chat-messages');
        if (messagesContainer) {
            var welcomeMsg = messagesContainer.querySelector('.cs-message.admin');
            if (welcomeMsg) {
                addClickEventToMessage(welcomeMsg);
            }
        }
    }, 500); // 延迟500ms确保DOM已完全加载
    
    csLog('✅ 客服系统函数初始化完成');
}

// 消息轮询相关变量
let messagePollingInterval = null;
let lastMessageTime = null;
let displayedMessageIds = new Set(); // 记录已显示的消息ID

// 开始消息轮询
function startMessagePolling() {
    // 如果已经在轮询，先停止
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
    }
    
    csLog('🔄 开始消息轮询 (每5秒)');
    
    // 每5秒检查一次新消息（降低频率）
    messagePollingInterval = setInterval(function() {
        checkForNewMessages();
    }, 5000);
}

// 停止消息轮询
function stopMessagePolling() {
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
        messagePollingInterval = null;
        csLog('⏹️ 停止消息轮询');
    }
}

// 为消息元素添加点击事件
function addClickEventToMessage(messageElement) {
    if (!messageElement) return;
    
    messageElement.addEventListener('click', function(e) {
        // 移除所有消息的选中状态
        var messagesContainer = document.getElementById('cs-chat-messages');
        var allMessages = messagesContainer.querySelectorAll('.cs-message');
        allMessages.forEach(function(msg) {
            msg.classList.remove('selected');
        });
        
        // 为当前消息添加选中状态
        messageElement.classList.add('selected');
    });
}

// 检查新消息
function checkForNewMessages() {
    // 如果聊天窗口已关闭，停止轮询
    if (!window.csIsChatOpen) {
        stopMessagePolling();
        return;
    }
    
    // 使用缓存的用户ID，避免重复调用getUserId()
    var userId = window.csCurrentUserId;
    
    // 如果没有缓存的用户ID，获取一次
    if (!userId) {
        userId = getUserId();
        // 如果仍然是访客ID或无效ID，停止轮询
        if (userId.toString().startsWith('guest_') || isNaN(userId)) {
            stopMessagePolling();
            return;
        }
        // 缓存有效的用户ID
        window.csCurrentUserId = userId;
    }
    
    // 如果是访客用户，不检查新消息
    if (userId.toString().startsWith('guest_')) {
        return;
    }
    
    if (isNaN(userId)) {
        return;
    }
    
    // 构建请求URL，包含最后消息时间参数
    var url = '/api/user-kefu/messages?userId=' + parseInt(userId);
    if (lastMessageTime) {
        url += '&since=' + encodeURIComponent(lastMessageTime);
    }
    
    fetch(url, {
        headers: {
            'Authorization': `Bearer ${getAuthToken()}`
        }
    })
    .then(function(response) {
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        return response.json();
    })
    .then(function(data) {
        if (data.success && data.messages && data.messages.length > 0) {
            var adminMessagesCount = 0;
            var latestMessageTime = lastMessageTime;
            
            // 只显示新消息，并进行去重
            for (var i = 0; i < data.messages.length; i++) {
                var msg = data.messages[i];
                
                // 更新最新消息时间（无论是否显示）
                var msgTime = msg.timestamp || msg.createdAt;
                if (msgTime && (!latestMessageTime || new Date(msgTime) > new Date(latestMessageTime))) {
                    latestMessageTime = msgTime;
                }
                
                // 只处理管理员消息（避免重复显示用户自己的消息）
                if (msg.type === 'admin') {
                    // 生成消息唯一标识
                    var messageKey = msg.id || (msg.userId + '_' + msg.message + '_' + msg.timestamp);
                    
                    // 检查是否已经显示过这条消息
                    if (!displayedMessageIds.has(messageKey)) {
                        // 创建消息元素
                        var messagesContainer = document.getElementById('cs-chat-messages');
                        var messageDiv = document.createElement('div');
                        messageDiv.className = 'cs-message ' + msg.type;
                        
                        var timeStr = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        
                        messageDiv.innerHTML = 
                            '<div class="cs-message-content">' + escapeHtml(msg.message) + '</div>' +
                            '<div class="cs-message-footer" style="display: flex !important; align-items: center !important; gap: 6px !important; margin-top: 4px !important; flex-direction: row !important;">' +
                                '<img src="/public/images/favicon.png" class="cs-message-avatar" alt="客服头像" style="width: 16px; height: 16px; max-width: 16px; max-height: 16px; margin-left: -10px;">' +
                                '<div class="cs-message-time" style="font-size: 11px !important; color: #999 !important; margin-top: 0px !important; white-space: nowrap !important;">' + timeStr + '</div>' +
                            '</div>';
                        
                        messagesContainer.appendChild(messageDiv);
                        
                        // 为新消息添加点击事件
                        addClickEventToMessage(messageDiv);
                        
                        displayedMessageIds.add(messageKey);
                        adminMessagesCount++;
                    }
                }
            }
            
            // 更新最后消息时间，防止重复获取相同消息
            if (latestMessageTime) {
                lastMessageTime = latestMessageTime;
            }
            
            if (adminMessagesCount > 0) {
                csLog('📨 收到 ' + adminMessagesCount + ' 条新的管理员消息');
            }
            // 如果没有管理员消息，则静默处理，不输出日志
            
            // 如果聊天窗口是打开的，智能滚动处理
            if (window.csIsChatOpen) {
                // 只有用户在底部附近时才自动滚动，避免打断用户查看历史记录
                var messagesContainer = document.getElementById('cs-chat-messages');
                smartScrollToBottom(messagesContainer);
            } else {
                // 如果聊天窗口关闭，更新未读计数
                var adminMessages = data.messages.filter(m => m.type === 'admin');
                if (adminMessages.length > 0) {
                    updateUnreadCount(adminMessages.length);
                }
            }
        } else {
            // 即使没有新消息，也要更新时间戳为当前时间，避免重复查询
            if (!lastMessageTime) {
                lastMessageTime = new Date().toISOString();
            }
        }
    })
    .catch(function(error) {
        // 静默处理轮询错误，避免控制台spam
        if (error.message.includes('404')) {
            // 如果API不存在，停止轮询
            stopMessagePolling();
        }
    });
}

// 更新未读消息计数
function updateUnreadCount(newCount) {
    window.csUnreadCount += newCount;
    
    var floatBtn = document.getElementById('cs-float-button');
    if (floatBtn && window.csUnreadCount > 0) {
        // 添加未读消息提示
        var badge = floatBtn.querySelector('.cs-unread-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'cs-unread-badge';
            badge.style.cssText = `
                position: absolute;
                top: -5px;
                right: -5px;
                background: #ff4757;
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                z-index: 10001;
            `;
            floatBtn.appendChild(badge);
        }
        badge.textContent = window.csUnreadCount > 99 ? '99+' : window.csUnreadCount.toString();
    }
}

// 清除未读计数
function clearUnreadCount() {
    window.csUnreadCount = 0;
    var floatBtn = document.getElementById('cs-float-button');
    if (floatBtn) {
        var badge = floatBtn.querySelector('.cs-unread-badge');
        if (badge) {
            badge.remove();
        }
    }
}

// 修改打开聊天窗口函数，添加轮询
window.openChatWindow = function() {
    csLog('📖 打开聊天窗口');
    var chatWindow = document.getElementById('cs-chat-window');
    
    if (chatWindow) {
        chatWindow.classList.add('show');
        window.csIsChatOpen = true;
        clearUnreadCount();
        
        // 缓存用户ID，避免轮询时重复获取
        var userId = getUserId();
        if (!userId.toString().startsWith('guest_') && !isNaN(userId)) {
            window.csCurrentUserId = userId;
        }
        
        loadMessages();
        focusInput();
        
        // 延迟3秒后开始消息轮询，避免与初始加载冲突
        setTimeout(function() {
            if (window.csIsChatOpen) {
                startMessagePolling();
            }
        }, 3000);
    }
};

// 修改关闭聊天窗口函数，停止轮询
window.closeChatWindow = function() {
    csLog('📕 关闭聊天窗口');
    var chatWindow = document.getElementById('cs-chat-window');
    
    if (chatWindow) {
        chatWindow.classList.remove('show');
        window.csIsChatOpen = false;
        
        // 停止消息轮询
        stopMessagePolling();
        
        // 不清理会话缓存，让历史消息在整个浏览器会话中只加载一次
        // 这样可以避免刷新页面后重复显示历史消息
        
        // 清理显示记录（可选，避免内存累积）
        if (displayedMessageIds.size > 100) {
            displayedMessageIds.clear();
            lastMessageTime = null;
        }
    }
};

// 在组件加载后初始化客服功能
setTimeout(function() {
    if (document.getElementById('cs-chat-input')) {
        initCustomerServiceFunctions();
    }
}, 1000);

csLog('📝 客服组件脚本加载完成');

// 导出函数供外部使用
window.ComponentsJS = {
    initializeComponents,
    initializeNavbar,
    initializeSidebar,
    initializeQuickAccess,
    initializeAuth,
    showToast
};

// 获取认证token
function getAuthToken() {
    // 优先获取authToken，这是普通用户使用的key
    let token = localStorage.getItem('authToken');
    
    // 如果没有，尝试获取admin_token，这是管理员使用的key
    if (!token) {
        token = localStorage.getItem('admin_token');
    }
    
    return token;
} 