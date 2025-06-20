# 萤火AI 组件系统使用说明

## 📁 文件结构

```
components/
├── navbar-full.html      # 完整版导航栏（首页用）
├── navbar-simple.html    # 简化版导航栏（功能页面用）
├── sidebar.html          # 侧边栏组件
├── styles.css           # 组件样式文件
├── components.js        # 组件JavaScript功能
└── README.md           # 使用说明文档
```

## 🚀 快速开始

### 1. 在首页使用完整版导航栏

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>萤火AI - 首页</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css" rel="stylesheet">
    <link rel="stylesheet" href="/components/styles.css">
</head>
<body class="bg-gray-50">
    <!-- 引入完整版导航栏 -->
    <div id="navbar-container"></div>
    
    <!-- 引入侧边栏 -->
    <div id="sidebar-container"></div>
    
    <!-- 主内容区域 -->
    <div class="main-content">
        <h1>首页内容</h1>
        <!-- 你的页面内容 -->
    </div>
    
    <script src="/components/components.js"></script>
    <script>
        // 加载导航栏和侧边栏
        fetch('/components/navbar-full.html')
            .then(response => response.text())
            .then(html => {
                document.getElementById('navbar-container').innerHTML = html;
            });
            
        fetch('/components/sidebar.html')
            .then(response => response.text())
            .then(html => {
                document.getElementById('sidebar-container').innerHTML = html;
            });
    </script>
</body>
</html>
```

### 2. 在功能页面使用简化版导航栏

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>功能页面 - 萤火AI</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css" rel="stylesheet">
    <link rel="stylesheet" href="/components/styles.css">
</head>
<body class="bg-gray-50">
    <!-- 引入简化版导航栏 -->
    <div id="navbar-container"></div>
    
    <!-- 主内容区域（无侧边栏，全宽） -->
    <div class="main-content" style="margin-left: 0;">
        <h1>功能页面内容</h1>
        <!-- 你的功能页面内容 -->
    </div>
    
    <script src="/components/components.js"></script>
    <script>
        // 加载简化版导航栏
        fetch('/components/navbar-simple.html')
            .then(response => response.text())
            .then(html => {
                document.getElementById('navbar-container').innerHTML = html;
            });
    </script>
</body>
</html>
```

## 📋 组件详细说明

### 🧭 导航栏组件

#### 完整版导航栏 (navbar-full.html)
- **用途**: 首页和主要页面
- **功能**: 
  - Logo和品牌标识
  - 快捷功能链接（AI营销图、图片翻译、商品换背景）
  - 功能中心下拉菜单（包含所有功能分类）
  - 积分中心下拉菜单
  - 下载中心链接
  - 用户登录/注册和用户菜单

#### 简化版导航栏 (navbar-simple.html)
- **用途**: 功能页面和子页面
- **功能**:
  - Logo和品牌标识（点击返回首页）
  - 返回首页按钮
- **设计理念**: 简化版导航栏不包含登录功能，假设用户已在首页完成登录。这样设计避免了登录状态同步问题，让功能页面更加简洁专注。

### 📱 侧边栏组件 (sidebar.html)

- **功能**:
  - 快捷访问按钮
  - 自定义功能快捷方式
  - 折叠/展开功能
  - 本地存储用户偏好

### 🎨 样式文件 (styles.css)

包含所有组件的样式定义：
- 导航栏样式
- 侧边栏样式
- 下拉菜单样式
- 响应式设计
- 动画效果

### ⚡ JavaScript功能 (components.js)

提供所有交互功能：
- 导航栏下拉菜单控制
- 侧边栏折叠/展开
- 快捷访问功能管理
- 本地存储管理
- Toast消息提示

## 🔧 高级用法

### 自定义样式

如果需要自定义样式，可以在你的页面中添加额外的CSS：

```html
<style>
/* 自定义导航栏背景色 */
.navbar {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* 自定义侧边栏宽度 */
.sidebar {
    width: 20rem;
}

.main-content {
    margin-left: 20rem;
}
</style>
```

### 添加新的功能到快捷访问

在侧边栏组件中的快捷访问下拉菜单里添加新功能：

```html
<label class="feature-checkbox-item">
    <input type="checkbox" 
           data-feature="新功能名称" 
           data-icon="ri-新图标-line" 
           data-bg="bg-purple-100" 
           data-color="text-purple-500" 
           data-url="/new-feature.html">
    <span>新功能名称</span>
</label>
```

### 动态加载组件

使用JavaScript动态加载组件：

```javascript
async function loadComponent(componentPath, containerId) {
    try {
        const response = await fetch(componentPath);
        const html = await response.text();
        document.getElementById(containerId).innerHTML = html;
    } catch (error) {
        console.error('Failed to load component:', error);
    }
}

// 使用示例
loadComponent('/components/navbar-full.html', 'navbar-container');
loadComponent('/components/sidebar.html', 'sidebar-container');
```

## 🎯 最佳实践

1. **统一引入**: 在所有页面中统一引入必要的CSS和JS文件
2. **按需加载**: 根据页面类型选择合适的导航栏版本
3. **样式隔离**: 自定义样式时使用特定的类名避免冲突
4. **性能优化**: 使用缓存机制避免重复加载组件
5. **响应式设计**: 确保组件在不同设备上正常显示

## 📱 响应式支持

组件已经包含响应式设计，支持：
- 桌面端 (≥1024px)
- 平板端 (768px - 1023px)  
- 移动端 (<768px)

## 🔄 更新和维护

当需要更新组件时：
1. 修改对应的组件文件
2. 清除浏览器缓存
3. 测试所有使用该组件的页面

## 🆘 常见问题

### Q: 组件加载失败怎么办？
A: 检查文件路径是否正确，确保服务器可以访问components目录

### Q: 样式不生效怎么办？
A: 确保正确引入了styles.css文件，检查CSS优先级

### Q: JavaScript功能不工作怎么办？
A: 确保引入了components.js文件，检查浏览器控制台是否有错误

### Q: 如何禁用侧边栏？
A: 不加载sidebar.html组件，并将main-content的margin-left设为0

## 📞 技术支持

如有问题，请查看：
1. 浏览器开发者工具控制台
2. 网络请求状态
3. 文件路径是否正确

---

**注意**: 使用这些组件前，请确保你的项目已经正确配置了Tailwind CSS和Remix Icons。 