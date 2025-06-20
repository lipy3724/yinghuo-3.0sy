/* 组件JavaScript文件 - 导航栏和侧边栏交互功能 */

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
    initializeComponents();
});

// 初始化所有组件
function initializeComponents() {
    initializeNavbar();
    initializeSidebar();
    initializeQuickAccess();
    initializeAuth();
}

// 初始化导航栏功能
function initializeNavbar() {
    // 功能中心下拉菜单
    const featuresMenuBtn = document.getElementById('features-menu-btn');
    const featuresDropdown = document.getElementById('features-dropdown');
    
    if (featuresMenuBtn && featuresDropdown) {
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
    }
    
    // 积分中心下拉菜单
    const creditsMenuBtn = document.getElementById('credits-menu-btn');
    const creditsDropdown = document.getElementById('credits-dropdown');
    
    if (creditsMenuBtn && creditsDropdown) {
        creditsMenuBtn.addEventListener('click', function(e) {
            e.preventDefault();
            creditsDropdown.classList.toggle('hidden');
            
            const arrow = creditsMenuBtn.querySelector('.arrow-icon');
            if (arrow) {
                if (creditsDropdown.classList.contains('hidden')) {
                    arrow.classList.remove('ri-arrow-up-s-line');
                    arrow.classList.add('ri-arrow-down-s-line');
                } else {
                    arrow.classList.remove('ri-arrow-down-s-line');
                    arrow.classList.add('ri-arrow-up-s-line');
                }
            }
        });
        
        // 点击外部关闭
        document.addEventListener('click', function(e) {
            if (!creditsMenuBtn.contains(e.target) && !creditsDropdown.contains(e.target)) {
                creditsDropdown.classList.add('hidden');
                const arrow = creditsMenuBtn.querySelector('.arrow-icon');
                if (arrow) {
                    arrow.classList.remove('ri-arrow-up-s-line');
                    arrow.classList.add('ri-arrow-down-s-line');
                }
            }
        });
    }
    
    // 用户菜单下拉
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdown = document.getElementById('user-dropdown');
    
    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', function(e) {
            e.preventDefault();
            userDropdown.classList.toggle('hidden');
            
            const arrow = userMenuBtn.querySelector('.arrow-icon');
            if (arrow) {
                if (userDropdown.classList.contains('hidden')) {
                    arrow.classList.remove('ri-arrow-up-s-line');
                    arrow.classList.add('ri-arrow-down-s-line');
                } else {
                    arrow.classList.remove('ri-arrow-down-s-line');
                    arrow.classList.add('ri-arrow-up-s-line');
                }
            }
        });
        
        // 点击外部关闭
        document.addEventListener('click', function(e) {
            if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.add('hidden');
                const arrow = userMenuBtn.querySelector('.arrow-icon');
                if (arrow) {
                    arrow.classList.remove('ri-arrow-up-s-line');
                    arrow.classList.add('ri-arrow-down-s-line');
                }
            }
        });
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
    // 这里可以添加用户认证相关的初始化代码
    // 例如检查登录状态、更新用户信息显示等
    
    // 登出按钮
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // 调用登出处理函数（需要在其他地方定义）
            if (typeof handleLogout === 'function') {
                handleLogout();
            }
        });
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