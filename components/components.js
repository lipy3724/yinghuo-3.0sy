/* 组件JavaScript文件 - 导航栏和侧边栏交互功能 */

// 检查用户权限并重定向 - 核心功能函数
function checkAuthAndRedirect(url) {
    const token = localStorage.getItem('authToken');
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
    const token = localStorage.getItem('authToken');
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
                    window.location.href = '/';
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

// 导出函数供外部使用
window.ComponentsJS = {
    initializeComponents,
    initializeNavbar,
    initializeSidebar,
    initializeQuickAccess,
    initializeAuth,
    showToast
}; 