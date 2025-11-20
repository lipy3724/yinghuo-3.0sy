/* 组件JavaScript文件 - 导航栏和侧边栏交互功能 */

// 立即定义全局翻译函数，避免未定义错误
window.getTranslation = function(key, language) {
    try {
        const currentLang = language || localStorage.getItem('language') || 'zh';
        
        // 尝试从全局translations获取
        if (window.translations && window.translations[currentLang] && window.translations[currentLang][key]) {
            return window.translations[currentLang][key];
        }
        
        // 尝试从导航栏翻译获取
        if (window.navbarTranslations && window.navbarTranslations[currentLang] && window.navbarTranslations[currentLang][key]) {
            return window.navbarTranslations[currentLang][key];
        }
        
        // 返回原键作为后备
        return key;
    } catch (error) {
        console.warn('翻译获取失败:', error);
        return key;
    }
};

// 获取当前语言
function getCurrentLanguage() {
    return localStorage.getItem('language') || 'zh';
}

// 解析翻译 - 使用全局函数
function resolveTranslation(language, key) {
    return window.getTranslation(key, language);
}

// 本地函数别名
function getTranslation(key, language) {
    return window.getTranslation(key, language);
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
    try {
        initializeNavbar();
    } catch (error) {
        console.error('初始化导航栏失败:', error);
    }
    
    try {
        initializeSidebar();
    } catch (error) {
        console.error('初始化侧边栏失败:', error);
    }
    
    try {
        initializeQuickAccess();
    } catch (error) {
        console.error('初始化快捷访问失败:', error);
    }
    
    try {
        initializeAuth();
    } catch (error) {
        console.error('初始化认证失败:', error);
    }
    
    try {
        initializeLanguageSelector();
    } catch (error) {
        console.error('初始化语言选择器失败:', error);
    }
    
    // 监听积分更新事件
    document.addEventListener('creditsUpdated', function(event) {
        if (event.detail && event.detail.credits !== undefined) {
            updateCreditsDisplay(event.detail.credits);
        }
    });
    
    // 监听来自iframe的消息
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'CREDITS_UPDATED') {
            updateCreditsDisplay(event.data.credits);
        }
    });
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
    
    // 语言选择器使用 group-hover CSS 方式，无需 JavaScript 控制显示/隐藏
    console.log('语言选择器使用 group-hover 方式，无需额外初始化');
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
    console.log('🚀 开始初始化快捷访问功能...');

    try {
        if (typeof window !== 'undefined' && window.useQuickAccessV2) {
            console.log('🆕 检测到新版快捷访问系统，跳过旧版初始化');
            return;
        }
    } catch (flagError) {
        console.warn('检查新版快捷访问标记失败:', flagError);
    }
    
    // 多次尝试初始化，确保DOM元素可用
    let attempts = 0;
    const maxAttempts = 5;
    
    function tryInitialize() {
        attempts++;
        console.log(`🔄 尝试初始化快捷访问 (${attempts}/${maxAttempts})`);
        
        try {
            const quickAccessBtn = document.getElementById('quick-access-btn');
            const quickAccessDropdown = document.getElementById('quick-access-dropdown');
            const sidebarFeaturesContainer = document.getElementById('sidebar-features-container');
            
            if (quickAccessBtn && quickAccessDropdown && sidebarFeaturesContainer) {
                console.log('✅ 找到所有必要元素，开始设置快捷访问');
                setupQuickAccessSimple(quickAccessBtn, quickAccessDropdown, sidebarFeaturesContainer);
                return true;
            } else {
                console.log('⚠️ 元素未完全加载:', {
                    quickAccessBtn: !!quickAccessBtn,
                    quickAccessDropdown: !!quickAccessDropdown,
                    sidebarFeaturesContainer: !!sidebarFeaturesContainer
                });
                
                if (attempts < maxAttempts) {
                    setTimeout(tryInitialize, 1000);
                } else {
                    console.error('❌ 达到最大尝试次数，快捷访问初始化失败');
                }
                return false;
            }
        } catch (error) {
            console.error('❌ 快捷访问初始化出错:', error);
            if (attempts < maxAttempts) {
                setTimeout(tryInitialize, 1000);
            }
            return false;
        }
    }
    
    // 立即尝试一次，然后延迟尝试
    setTimeout(tryInitialize, 500);
}

// 简化的快捷访问设置
function setupQuickAccessSimple(quickAccessBtn, quickAccessDropdown, sidebarFeaturesContainer) {
    console.log('🔧 开始设置快捷访问事件...');
    
    // 强制清除旧数据并立即更新侧边栏
    localStorage.removeItem('quick-access-features');
    console.log('🗑️ 已清除旧的快捷访问数据');
    
    // 检查翻译系统状态
    console.log('🌐 翻译系统检查:', {
        language: localStorage.getItem('language'),
        hasTranslations: !!window.translations,
        hasGetTranslation: typeof window.getTranslation === 'function',
        translationsKeys: window.translations ? Object.keys(window.translations) : 'none'
    });
    
    // 立即清空侧边栏显示
    const existingItems = sidebarFeaturesContainer.querySelectorAll('.sidebar-feature-item');
    existingItems.forEach(item => item.remove());
    const emptyState = sidebarFeaturesContainer.querySelector('.empty-state');
    if (emptyState) {
        emptyState.classList.remove('hidden');
    }
    console.log('🧹 已清空侧边栏显示');
    
    // 打开快捷访问菜单
    quickAccessBtn.addEventListener('click', function() {
        console.log('🖱️ 点击快捷访问按钮');
        quickAccessDropdown.classList.remove('hidden');
    });
    
    // 关闭快捷访问菜单
    const closeDropdownBtn = document.getElementById('close-dropdown');
    if (closeDropdownBtn) {
        closeDropdownBtn.addEventListener('click', function() {
            console.log('🖱️ 点击关闭按钮');
            quickAccessDropdown.classList.add('hidden');
            saveAndUpdateQuickAccess(sidebarFeaturesContainer);
        });
    }
    
    // 点击背景关闭
    quickAccessDropdown.addEventListener('click', function(e) {
        if (e.target === quickAccessDropdown) {
            console.log('🖱️ 点击背景关闭');
            quickAccessDropdown.classList.add('hidden');
            saveAndUpdateQuickAccess(sidebarFeaturesContainer);
        }
    });
    
    // 初始化时更新侧边栏
    updateQuickAccessSidebar(sidebarFeaturesContainer);
    
    console.log('✅ 快捷访问设置完成');
}

// 功能URL到中文名称的映射 - 完整版本
const urlToChineseName = {
    '/scene-generator.html': '场景图生成',
    '/image-removal.html': '图像智能消除',
    '/image-expansion.html': '智能扩图',
    '/image-sharpen.html': '模糊图片变清晰',
    '/image-upscaler.html': '图像高清放大',
    '/image-colorization.html': '图像上色',
    '/local-redraw.html': '局部重绘',
    '/global-style.html': '全局风格化',
    '/face-swap.html': '人脸替换',
    '/video-face-swap.html': '视频换脸',
    '/product-photography.html': '商品摄影',
    '/avatar-generator.html': '头像生成器',
    '/image-to-video.html': '图生视频',
    '/video-enhancement.html': '视频增强',
    '/text-to-image.html': '文生图',
    '/image-variation.html': '图像变体',
    '/style-transfer.html': '风格迁移',
    '/background-removal.html': '背景消除',
    '/object-removal.html': '物体消除',
    '/image-restoration.html': '图像修复',
    '/credits.html': '积分管理',
    '/credits-usage.html': '积分使用记录'
};

// 强制中文名称映射 - 防止翻译脚本干扰
const forceChineseNames = {
    'feature.scene_generator': '场景图生成',
    'feature.image_removal': '图像智能消除',
    'feature.image_expansion': '智能扩图',
    'feature.image_sharpen': '模糊图片变清晰',
    'feature.image_upscaler': '图像高清放大',
    'feature.image_colorization': '图像上色',
    'feature.local_redraw': '局部重绘',
    'feature.global_style': '全局风格化',
    'feature.face_swap': '人脸替换',
    'feature.video_face_swap': '视频换脸',
    'scene_generator': '场景图生成',
    'image_removal': '图像智能消除',
    'image_expansion': '智能扩图',
    'image_sharpen': '模糊图片变清晰',
    'image_upscaler': '图像高清放大',
    'image_colorization': '图像上色',
    'local_redraw': '局部重绘',
    'global_style': '全局风格化',
    'face_swap': '人脸替换',
    'video_face_swap': '视频换脸'
};

// 保存并更新快捷访问
function saveAndUpdateQuickAccess(sidebarFeaturesContainer) {
    console.log('💾 保存并更新快捷访问...');
    
    try {
        const quickAccessDropdown = document.getElementById('quick-access-dropdown');
        if (!quickAccessDropdown) return;
        
        const checkedBoxes = quickAccessDropdown.querySelectorAll('input[type="checkbox"]:checked');
        console.log('✅ 找到选中的复选框数量:', checkedBoxes.length);
        
        const features = Array.from(checkedBoxes).map(checkbox => {
            const url = checkbox.dataset.url;
            
            // 直接硬编码中文名称映射，完全绕过翻译系统
            const directChineseMapping = {
                '/scene-generator.html': '场景图生成',
                '/image-removal.html': '图像智能消除',
                '/image-expansion.html': '智能扩图',
                '/image-sharpen.html': '模糊图片变清晰',
                '/image-upscaler.html': '图像高清放大',
                '/image-colorization.html': '图像上色',
                '/local-redraw.html': '局部重绘',
                '/global-style.html': '全局风格化',
                '/face-swap.html': '人脸替换',
                '/video-face-swap.html': '视频换脸'
            };
            
            const chineseName = directChineseMapping[url] || '功能项';
            
            console.log('💾 直接保存中文名称:', {
                url: url,
                chineseName: chineseName,
                icon: checkbox.dataset.icon,
                bg: checkbox.dataset.bg,
                color: checkbox.dataset.color
            });
            
            return {
                feature: chineseName,  // 直接使用硬编码的中文名称
                icon: checkbox.dataset.icon || 'ri-function-line',
                bg: checkbox.dataset.bg || 'bg-blue-500',
                color: checkbox.dataset.color || 'text-white',
                url: url || '#'
            };
        });
        
        console.log('💾 保存功能列表:', features);
        localStorage.setItem('quick-access-features', JSON.stringify(features));
        
        updateQuickAccessSidebar(sidebarFeaturesContainer);
        
    } catch (error) {
        console.error('❌ 保存快捷访问失败:', error);
    }
}

// 更新快捷访问侧边栏
function updateQuickAccessSidebar(sidebarFeaturesContainer) {
    console.log('🔄 更新快捷访问侧边栏...');
    
    try {
        if (!sidebarFeaturesContainer) {
            console.error('❌ 侧边栏容器未找到');
            return;
        }
        
        const saved = localStorage.getItem('quick-access-features');
        const emptyState = sidebarFeaturesContainer.querySelector('.empty-state');
        
        // 清除现有功能项
        const existingItems = sidebarFeaturesContainer.querySelectorAll('.sidebar-feature-item');
        existingItems.forEach(item => item.remove());
        
        if (saved) {
            const features = JSON.parse(saved);
            console.log('📦 加载保存的功能:', features);
            
            if (features.length > 0) {
                // 隐藏空状态
                if (emptyState) {
                    emptyState.classList.add('hidden');
                }
                
                // 添加功能项
                features.forEach((feature, index) => {
                    console.log(`➕ 正在添加功能项 ${index + 1}:`, feature);
                    const item = createSimpleFeatureItem(feature);
                    sidebarFeaturesContainer.appendChild(item);
                });
                
                console.log('✅ 侧边栏更新完成，共添加', features.length, '个功能');
            } else {
                // 显示空状态
                if (emptyState) {
                    emptyState.classList.remove('hidden');
                }
            }
        } else {
            // 显示空状态
            if (emptyState) {
                emptyState.classList.remove('hidden');
            }
        }
        
    } catch (error) {
        console.error('❌ 更新侧边栏失败:', error);
    }
}

// 获取正确的中文名称
function getCorrectChineseName(feature) {
    let chineseName = feature.feature;
    
    console.log('🔍 原始功能名称:', chineseName, '语言:', localStorage.getItem('language'));
    
    // 第一步：如果是翻译键，尝试使用翻译函数
    if (chineseName && chineseName.startsWith('feature.')) {
        // 尝试使用全局翻译函数
        if (typeof window.getTranslation === 'function') {
            const translated = window.getTranslation(chineseName);
            console.log('🌐 翻译结果:', chineseName, '->', translated);
            if (translated && translated !== chineseName) {
                return translated;
            }
        }
        
        // 如果翻译失败，使用我们的映射
        chineseName = forceChineseNames[chineseName] || urlToChineseName[feature.url] || '未知功能';
    }
    
    // 第二步：根据URL映射
    if (!chineseName || chineseName === '未知功能') {
        chineseName = urlToChineseName[feature.url] || '未知功能';
    }
    
    // 第三步：最后的安全检查
    if (chineseName.includes('feature.') || chineseName.includes('_')) {
        chineseName = urlToChineseName[feature.url] || '功能项';
    }
    
    console.log('✅ 最终中文名称:', chineseName);
    return chineseName;
}

// 创建简单的功能项 - 直接显示中文名称
function createSimpleFeatureItem(feature) {
    console.log('🏗️ 创建功能项:', feature);
    
    // 直接使用保存的中文名称
    const chineseName = feature.feature || '功能项';
    console.log('📝 直接显示名称:', chineseName);
    
    const item = document.createElement('li');
    item.className = 'sidebar-feature-item';
    
    const link = document.createElement('a');
    link.href = 'javascript:void(0)';
    link.className = 'flex items-center p-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors duration-200';
    
    link.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('🖱️ 点击功能项:', chineseName);
        if (feature.url && feature.url !== '#') {
            window.location.href = feature.url;
        }
    });
    
    // 使用最简单的innerHTML方式，但强制设置中文
    link.innerHTML = `
        <div class="flex-shrink-0 w-8 h-8 ${feature.bg || 'bg-blue-500'} rounded-lg flex items-center justify-center mr-3">
            <i class="${feature.icon || 'ri-function-line'} ${feature.color || 'text-white'} text-sm"></i>
        </div>
        <span class="text-sm font-medium" data-no-translate="true" translate="no">${chineseName}</span>
    `;
    
    console.log('✅ 功能项创建完成，HTML:', link.innerHTML);
    
    item.appendChild(link);
    return item;
}

// 旧的复杂函数保留但不使用
function setupQuickAccess(quickAccessBtn, quickAccessDropdown, closeDropdownBtn, selectedCountSpan, sidebarFeaturesContainer) {
    
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
        console.log('💾 开始保存选中的功能...');
        const checkedBoxes = quickAccessDropdown.querySelectorAll('input[type="checkbox"]:checked');
        console.log('✅ 找到选中的复选框数量:', checkedBoxes.length);
        
        const features = Array.from(checkedBoxes).map(checkbox => {
            const feature = {
                feature: checkbox.dataset.feature,
                icon: checkbox.dataset.icon,
                bg: checkbox.dataset.bg,
                color: checkbox.dataset.color,
                url: checkbox.dataset.url
            };
            console.log('📝 保存功能:', feature);
            return feature;
        });
        
        console.log('💾 保存到localStorage的功能列表:', features);
        localStorage.setItem('quick-access-features', JSON.stringify(features));
        console.log('✅ 功能保存完成');
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
        console.log('🔄 开始更新侧边栏...');
        
        if (!sidebarFeaturesContainer) {
            console.error('❌ 找不到 sidebarFeaturesContainer 元素');
            return;
        }
        
        const saved = localStorage.getItem('quick-access-features');
        console.log('📦 从localStorage获取的数据:', saved);
        
        const emptyState = sidebarFeaturesContainer.querySelector('.empty-state');
        console.log('🔍 空状态元素:', emptyState);
        
        if (saved) {
            const features = JSON.parse(saved);
            console.log('✅ 解析的功能列表:', features);
            
            if (features.length > 0) {
                // 隐藏空状态
                if (emptyState) {
                    emptyState.classList.add('hidden');
                    console.log('🙈 隐藏空状态');
                }
                
                // 清除现有内容（除了空状态）
                const existingItems = sidebarFeaturesContainer.querySelectorAll('.sidebar-feature-item');
                console.log('🗑️ 清除现有项目数量:', existingItems.length);
                existingItems.forEach(item => item.remove());
                
                // 添加功能项
                features.forEach(feature => {
                    console.log('➕ 添加功能项:', feature.feature);
                    const item = createSidebarFeatureItem(feature);
                    sidebarFeaturesContainer.appendChild(item);
                });
                
                console.log('✅ 侧边栏更新完成，共添加', features.length, '个功能');
            } else {
                // 显示空状态
                if (emptyState) {
                    emptyState.classList.remove('hidden');
                    console.log('👁️ 显示空状态');
                }
                
                // 清除所有功能项
                const existingItems = sidebarFeaturesContainer.querySelectorAll('.sidebar-feature-item');
                existingItems.forEach(item => item.remove());
                console.log('🗑️ 清除所有功能项');
            }
        } else {
            console.log('📭 没有保存的功能数据');
            // 显示空状态
            if (emptyState) {
                emptyState.classList.remove('hidden');
                console.log('👁️ 显示空状态（无数据）');
            }
        }
    }
    
    // 创建侧边栏功能项
    function createSidebarFeatureItem(feature) {
        const item = document.createElement('li');
        item.className = 'sidebar-feature-item';
        
        const link = document.createElement('a');
        link.href = 'javascript:void(0)';
        link.className = 'flex items-center p-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors duration-200';
        
        // 添加点击事件处理
        link.addEventListener('click', function(e) {
            e.preventDefault();
            // 检查认证并重定向
            if (typeof window.checkAuthAndRedirect === 'function') {
                window.checkAuthAndRedirect(feature.url);
            } else {
                // 如果没有认证检查函数，直接跳转
                window.location.href = feature.url;
            }
        });
        
        link.innerHTML = `
            <div class="flex-shrink-0 w-8 h-8 ${feature.bg} rounded-lg flex items-center justify-center mr-3">
                <i class="${feature.icon} ${feature.color} text-sm"></i>
            </div>
            <span class="text-sm font-medium">${feature.feature}</span>
        `;
        
        item.appendChild(link);
        return item;
    }
    
    // 初始加载侧边栏
    updateSidebar();
}

// 初始化用户认证相关功能
function initializeAuth() {
    console.log('初始化认证功能...');
    
    // 确保auth-check.js已加载，如果没有则动态加载
    loadAuthCheckScript().then(() => {
        // 检查登录状态并更新UI
        updateNavbarLoginStatus();
    });
}

// 检查用户登录状态并更新导航栏UI
async function updateNavbarLoginStatus() {
    const token = getAuthToken();
    const userInfo = localStorage.getItem('user');
    
    const loginBtn = document.getElementById('login-btn');
    const userInfoEl = document.getElementById('user-info');
    
    console.log('登录状态检查 - Token:', !!token, 'UserInfo:', !!userInfo);
    console.log('登录按钮:', loginBtn, '用户信息元素:', userInfoEl);
    
    // 如果有认证检查函数，先进行认证验证
    if (typeof window.checkAuth === 'function' && token && userInfo) {
        try {
            console.log('执行认证检查...');
            const isAuthenticated = await window.checkAuth(false); // 不自动跳转
            if (!isAuthenticated) {
                console.log('认证检查失败，清除本地存储');
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
                // 更新UI为未登录状态
                if (loginBtn && userInfoEl) {
                    loginBtn.classList.remove('hidden');
                    userInfoEl.classList.add('hidden');
                }
                return;
            }
        } catch (error) {
            console.error('认证检查出错:', error);
            // 继续执行UI更新，不阻塞界面
        }
    }
    
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
            // 清除无效的用户信息
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            if (loginBtn && userInfoEl) {
                loginBtn.classList.remove('hidden');
                userInfoEl.classList.add('hidden');
            }
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

// 动态加载认证检查脚本
function loadAuthCheckScript() {
    return new Promise((resolve) => {
        // 检查是否已经存在 checkAuth 函数
        if (typeof window.checkAuth === 'function') {
            console.log('认证脚本已存在，跳过加载');
            resolve();
            return;
        }
        
        // 检查是否已经加载了auth-check.js脚本
        const existingScript = document.querySelector('script[src*="auth-check.js"]');
        if (existingScript) {
            console.log('认证脚本已在DOM中，等待加载完成');
            // 等待脚本加载完成
            existingScript.onload = resolve;
            existingScript.onerror = resolve; // 即使加载失败也继续
            return;
        }
        
        console.log('动态加载认证检查脚本...');
        const script = document.createElement('script');
        script.src = '/public/js/auth-check.js';
        script.onload = () => {
            console.log('认证检查脚本加载成功');
            resolve();
        };
        script.onerror = (error) => {
            console.error('认证检查脚本加载失败:', error);
            resolve(); // 即使加载失败也继续，避免阻塞
        };
        document.head.appendChild(script);
    });
}

// 全局认证检查和重定向函数
window.checkAuthAndRedirect = function(url) {
    console.log('🔐 检查认证并重定向到:', url);
    
    // 检查是否有认证token
    const token = getAuthToken();
    const userInfo = localStorage.getItem('user');
    
    if (!token || !userInfo) {
        console.log('❌ 用户未登录，重定向到登录页');
        window.location.href = '/login.html';
        return;
    }
    
    // 如果有认证检查函数，先进行验证
    if (typeof window.checkAuth === 'function') {
        window.checkAuth(true).then(isAuthenticated => {
            if (isAuthenticated) {
                console.log('✅ 认证通过，跳转到:', url);
                window.location.href = url;
            } else {
                console.log('❌ 认证失败，重定向到登录页');
                window.location.href = '/login.html';
            }
        }).catch(error => {
            console.error('认证检查出错:', error);
            // 出错时直接跳转
            window.location.href = url;
        });
    } else {
        // 没有认证检查函数，直接跳转
        console.log('⚠️ 没有认证检查函数，直接跳转到:', url);
        window.location.href = url;
    }
};

// 导出函数供外部使用
window.ComponentsJS = {
    initializeComponents,
    initializeNavbar,
    initializeSidebar,
    initializeQuickAccess,
    initializeAuth,
    showToast,
    loadAuthCheckScript,
    checkAuthAndRedirect: window.checkAuthAndRedirect
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

// getTranslation函数在文件末尾定义

// 更新积分显示
function updateCreditsDisplay(credits) {
    console.log('更新积分显示:', credits);
    
    // 更新导航栏中的积分显示
    const creditsElements = document.querySelectorAll('#user-credits, .header-credits, .credits-display');
    if (creditsElements.length > 0) {
        creditsElements.forEach(el => {
            el.textContent = credits;
        });
    }
}

// 语言系统相关变量
let currentLanguage = localStorage.getItem('language') || 'zh';

// 导航栏内置翻译数据，避免与全局 translations 冲突
const navbarTranslations = {
    zh: {
        "text.select_language": "选择语言",
        "nav.credits_center": "积分中心",
        "nav.recharge_center": "积分充值中心",
        "nav.download_center": "下载中心",
        "credits_management": "积分管理",
        "credits_usage": "积分使用情况",
        "my_account": "我的账户",
        "logout": "退出登录",
        "login_register": "登录/注册",
        
        // 积分管理页面翻译
        "page.credits_title": "积分管理 - 萤火AI",
        "page.credits_management": "积分管理",
        "credits.balance": "积分余额",
        "credits.unit": "积分",
        "credits.last_recharge": "上次充值",
        "credits.never_recharged": "从未充值",
        "credits.recharge_button": "充值积分",
        "credits.recharge_title": "积分充值",
        "credits.recharge_amount": "充值金额",
        "credits.payment_method": "支付方式",
        "credits.confirm_recharge": "确认充值",
        "credits.pricing_list": "功能价格列表",
        "credits.free_trial": "免费试用",
        "credits.times": "次",
        "credits.resolution_pricing_note": "不同分辨率价格不同，按实际选择计费",
        "currency.yuan": "元",
        "payment.alipay": "支付宝",
        "time.second": "秒",
        "feature.video_style_repaint": "视频风格重绘",
        
        // 下载中心页面翻译
        "page.download_center_title": "下载中心 - 萤火AI",
        "download_center.title": "下载中心",
        "download_center.search_placeholder": "搜索图片...",
        "download_center.warm_tip": "温馨提示：",
        "download_center.expiration_notice": "下载中心的图片和视频仅保存12小时，请及时下载保存到本地。",
        "download_center.no_images": "暂无图片记录",
        "download_center.all_images": "全部图片",
        "download_center.grid_view": "网格",
        "download_center.list_view": "列表",
        "download_center.all": "全选",
        "download_center.view": "视图:",
        
        // 功能名称翻译
        "feature.image_translation": "图片翻译",
        "feature.marketing_image": "营销图生成",
        "feature.smart_cutout": "智能抠图",
        "feature.scene_generation": "场景图生成",
        "feature.smart_removal": "智能消除",
        "feature.model_skin_change": "模特换肤",
        "feature.virtual_try_on": "虚拟试衣",
        "feature.global_stylization": "全局风格化",
        "feature.smart_photo_segmentation": "智能照片分割",
        "feature.text_to_image": "文生图片",
        "feature.image_upscaling": "图像高清放大",
        "feature.instruction_editing": "指令编辑",
        "feature.image_instruction_editing": "图像指令编辑",
        "feature.smart_expansion": "智能扩图",
        "feature.blur_to_clear": "模糊图片变清晰",
        "feature.image_colorization": "图像上色",
        "feature.padding_image": "垫图",
        "feature.local_redraw": "局部重绘",
        "feature.smart_clothing_segmentation": "智能服饰分割"
    },
    en: {
        "text.select_language": "Select Language",
        "nav.credits_center": "Credits Center",
        "nav.recharge_center": "Recharge Center",
        "nav.download_center": "Download Center",
        "credits_management": "Credits Management",
        "credits_usage": "Credits Usage",
        "my_account": "My Account",
        "logout": "Logout",
        "login_register": "Login/Register",
        
        // 积分管理页面翻译
        "page.credits_title": "Credits Management - YingHuo AI",
        "page.credits_management": "Credits Management",
        "credits.balance": "Credits Balance",
        "credits.unit": "Credits",
        "credits.last_recharge": "Last Recharge",
        "credits.never_recharged": "Never Recharged",
        "credits.recharge_button": "Recharge Credits",
        "credits.recharge_title": "Credits Recharge",
        "credits.recharge_amount": "Recharge Amount",
        "credits.payment_method": "Payment Method",
        "credits.confirm_recharge": "Confirm Recharge",
        "credits.pricing_list": "Feature Pricing List",
        "credits.free_trial": "Free Trial",
        "credits.times": "times",
        "credits.resolution_pricing_note": "Different resolutions have different prices, charged according to actual selection",
        "currency.yuan": "¥",
        "payment.alipay": "Alipay",
        "time.second": "sec",
        "feature.video_style_repaint": "Video Style Repaint",
        
        // 下载中心页面翻译
        "page.download_center_title": "Download Center - YingHuo AI",
        "download_center.title": "Download Center",
        "download_center.search_placeholder": "Search images...",
        "download_center.warm_tip": "Warm Tip:",
        "download_center.expiration_notice": "Images and videos in the download center are only saved for 12 hours, please download and save them locally in time.",
        "download_center.no_images": "No image records",
        "download_center.all_images": "All Images",
        "download_center.grid_view": "Grid",
        "download_center.list_view": "List",
        "download_center.all": "All",
        "download_center.view": "View:",
        
        // 功能名称翻译
        "feature.image_translation": "Image Translation",
        "feature.marketing_image": "Marketing Image Generation",
        "feature.smart_cutout": "Smart Cutout",
        "feature.scene_generation": "Scene Generation",
        "feature.smart_removal": "Smart Removal",
        "feature.model_skin_change": "Model Skin Change",
        "feature.virtual_try_on": "Virtual Try-On",
        "feature.global_stylization": "Global Stylization",
        "feature.smart_photo_segmentation": "Smart Photo Segmentation",
        "feature.text_to_image": "Text to Image",
        "feature.image_upscaling": "Image Upscaling",
        "feature.instruction_editing": "Instruction Editing",
        "feature.image_instruction_editing": "Image Instruction Editing",
        "feature.smart_expansion": "Smart Expansion",
        "feature.blur_to_clear": "Blur to Clear",
        "feature.image_colorization": "Image Colorization",
        "feature.padding_image": "Padding Image",
        "feature.local_redraw": "Local Redraw",
        "feature.smart_clothing_segmentation": "Smart Clothing Segmentation"
    }
};

// 语言选择器事件处理函数（避免重复绑定）
let languageSelectorInitialized = false;

// 初始化语言选择器
function initializeLanguageSelector() {
    console.log('🔵 开始初始化语言选择器...');
    
    // 查找所有语言选项（直接查找，不依赖容器）
    const languageOptions = document.querySelectorAll('.language-option');
    if (languageOptions.length === 0) {
        console.log('⚠️ 语言选择器选项未找到，将在navbar加载后重试');
        if (!languageSelectorInitialized) {
            setTimeout(() => {
                initializeLanguageSelector();
            }, 500);
        }
        return;
    }

    console.log('✅ 语言选择器选项找到:', languageOptions.length, '个');
    console.log('💾 从localStorage读取的语言:', localStorage.getItem('language'));
    console.log('🎯 当前语言变量值:', currentLanguage);

    // 设置初始语言状态 - 为当前语言选项添加active样式
    languageOptions.forEach(option => {
        const lang = option.getAttribute('data-lang');
        if (lang === currentLanguage) {
            option.classList.add('bg-purple-50', 'text-purple-600');
            console.log('🔧 当前语言选项已标记:', lang);
        }
    });
    
    // 立即更新页面文本
    console.log('📝 开始初始化页面翻译...');
    if (typeof updatePageText === 'function') {
        updatePageText(currentLanguage);
    }

    // 为每个语言选项添加点击事件（参考home.html的实现）
    languageOptions.forEach(option => {
        // 确保选项可以接收点击事件
        option.style.pointerEvents = 'auto';
        option.style.cursor = 'pointer';
        
        // 绑定点击事件
        option.addEventListener('click', function(e) {
            // 阻止事件冒泡，确保点击能正确触发
            e.preventDefault();
            e.stopPropagation();
            
            const selectedLanguage = this.getAttribute('data-lang');
            console.log('🔄 用户选择了新语言:', selectedLanguage);
            
            if (!selectedLanguage) {
                console.error('❌ 语言选项没有data-lang属性');
                return;
            }
            
            // 移除所有选项的active样式
            languageOptions.forEach(opt => {
                opt.classList.remove('bg-purple-50', 'text-purple-600');
            });
            
            // 为当前选项添加active样式
            this.classList.add('bg-purple-50', 'text-purple-600');
            
            currentLanguage = selectedLanguage;
            
            // 保存到本地存储
            localStorage.setItem('language', selectedLanguage);
            console.log('💾 语言已保存到localStorage:', selectedLanguage);
            
            // 更新页面文本
            if (typeof updatePageText === 'function') {
                updatePageText(selectedLanguage);
            }
            
            // 触发语言变化事件，通知其他组件更新
            const languageChangeEvent = new CustomEvent('languageChanged', {
                detail: { language: selectedLanguage }
            });
            document.dispatchEvent(languageChangeEvent);
            // 同时向 window 派发，确保所有页面/组件都能收到
            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(languageChangeEvent);
            }
            console.log('🔔 已触发语言变化事件:', selectedLanguage);
            
            console.log('✅ 语言切换完成:', selectedLanguage === 'zh' ? '中文' : 'English');
        }, true); // 使用捕获阶段，确保事件能触发
        
        console.log('✅ 语言选项事件绑定完成:', option.getAttribute('data-lang'));
    });
}