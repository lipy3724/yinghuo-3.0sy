#!/bin/bash

# 移动端拦截功能部署脚本
# 作用：部署移动端拦截功能，自动拦截手机端用户访问AI功能

echo "开始部署移动端拦截功能..."

# 1. 检查移动端拦截中间件文件是否存在
if [ ! -f "./middleware/mobileGuard.js" ]; then
  echo "创建移动端拦截中间件文件..."
  mkdir -p ./middleware
  cat > ./middleware/mobileGuard.js << 'EOL'
/**
 * 移动端拦截中间件
 * 该中间件自动在所有HTML响应中注入mobile-guard.js脚本引用
 */

function mobileGuardMiddleware(req, res, next) {
  // 保存原始的res.send方法
  const originalSend = res.send;

  // 覆盖res.send方法
  res.send = function(body) {
    // 仅处理HTML响应
    if (typeof body === 'string' && 
        (res.get('Content-Type') || '').includes('text/html') || 
        body.includes('<!DOCTYPE html>') || 
        body.includes('<html>')) {
      
      // 检查是否已经包含mobile-guard.js引用
      if (!body.includes('mobile-guard.js')) {
        // 在</body>标签前添加脚本引用
        body = body.replace(
          '</body>',
          '<script src="/js/mobile-guard.js"></script></body>'
        );
      }
    }
    
    // 调用原始的send方法
    return originalSend.call(this, body);
  };

  next();
}

module.exports = mobileGuardMiddleware;
EOL
  echo "移动端拦截中间件文件已创建！"
else
  echo "移动端拦截中间件文件已存在，跳过创建步骤。"
fi

# 2. 检查app.js是否已经包含移动端拦截中间件
if ! grep -q "mobileGuardMiddleware" ./app.js; then
  echo "正在修改app.js，添加移动端拦截中间件..."
  
  # 使用sed插入中间件导入语句
  sed -i '' 's/const cors = require(.*);\(.*\)/const cors = require\1;\1\n\/\/ 导入移动端拦截中间件\nconst mobileGuardMiddleware = require('\''\.\/middleware\/mobileGuard'\'');/g' ./app.js || {
    echo "无法使用sed修改app.js，尝试使用备份方法..."
    cp ./app.js ./app.js.backup
    # 手动查找适当位置并插入中间件代码
    awk '
      /const cors = require/{
        print;
        print "";
        print "// 导入移动端拦截中间件";
        print "const mobileGuardMiddleware = require('\''./middleware/mobileGuard'\'');";
        next;
      }
      {print}
    ' ./app.js.backup > ./app.js
  }
  
  # 使用sed添加中间件使用语句
  sed -i '' 's/app.use(bodyParser.json());\(.*\)/app.use(bodyParser.json());\1\n\/\/ 使用移动端拦截中间件（必须在静态文件中间件之前）\napp.use(mobileGuardMiddleware);/g' ./app.js || {
    echo "无法使用sed修改app.js中间件使用部分，尝试使用备份方法..."
    cp ./app.js ./app.js.backup2
    # 手动查找适当位置并插入中间件使用代码
    awk '
      /app.use\(bodyParser.json\(\)\);/{
        print;
        print "// 使用移动端拦截中间件（必须在静态文件中间件之前）";
        print "app.use(mobileGuardMiddleware);";
        next;
      }
      {print}
    ' ./app.js.backup2 > ./app.js
  }
  
  echo "app.js已更新，成功添加移动端拦截中间件！"
else
  echo "app.js已包含移动端拦截中间件，跳过修改步骤。"
fi

# 3. 确保public/js目录存在
mkdir -p ./public/js

# 4. 创建或更新mobile-guard.js文件
echo "正在创建mobile-guard.js文件..."
cat > ./public/js/mobile-guard.js << 'EOL'
// 手机端拦截脚本
// 作用：在移动设备上阻止进入仅支持桌面端的功能页面，并给出提示
(function () {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (!isMobile) return; // 仅在手机浏览器执行

  // 允许手机端访问的 URL 白名单
  const allowList = new Set([
    '/login.html',
    '/register.html',
    '/phone-login.html',
    '/phone-register.html',
    '/forgot-password.html',
    '/privacy-policy.html',
    '/service-agreement.html',
    '/index.html', // 首页允许
    '/',
    '/credits.html', // 积分页面允许
    '/account.html', // 账户页面允许
    '/credits-usage.html' // 积分使用记录允许
  ]);

  // AI功能路径列表（需要拦截的路径）
  const aiFunctionPaths = new Set([
    '/virtual-model',
    '/virtual-model-redirect.html',
    '/virtual-model-shoes.html',
    '/image-removal.html',
    '/image-expansion.html',
    '/image-sharpen.html',
    '/image-colorization.html',
    '/scene-generator.html',
    '/cutout.html',
    '/local-redraw.html',
    '/global-style.html',
    '/clothing-simulation.html',
    '/clothing-segmentation.html',
    '/model-skin-changer.html',
    '/text-to-image.html',
    '/text-to-video.html',
    '/image-to-video.html',
    '/multi-image-to-video.html',
    '/video-style-repaint.html',
    '/digital-human-video.html',
    '/video-subtitle-remover.html',
    '/amazon-listing.html',
    '/amazon-search-term.html',
    '/amazon-review-analysis.html',
    '/amazon-consumer-insights.html',
    '/amazon-customer-email.html',
    '/fba-claim-email.html',
    '/amazon-review-generator.html',
    '/amazon-review-response.html',
    '/amazon-brand-naming.html',
    '/amazon-post-creator.html',
    '/amazon-video-script.html',
    '/product-comparison.html',
    '/amazon-brand-info.html',
    '/product-improvement-analysis.html',
    '/amazon-keyword-recommender.html',
    '/amazon-case-creator.html',
    '/prompt-editor.html',
    '/diantu.html',
    '/image-upscaler.html',
    '/translate.html',
    '/marketing-images.html'
  ]);

  // 显示友好的提示弹窗
  function showMobileAlert(isPageBlock = false) {
    // 检查是否已经显示了弹窗
    if (document.querySelector('.mobile-guard-alert')) return;
    
    const alertDiv = document.createElement('div');
    alertDiv.className = 'mobile-guard-alert';
    alertDiv.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);">
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 90%; width: 350px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
          <div style="font-size: 60px; margin-bottom: 20px; line-height: 1;">📱→💻</div>
          <h3 style="color: #333; margin-bottom: 15px; font-size: 20px; font-weight: 600;">请在电脑上使用完整功能</h3>
          <p style="color: #666; margin-bottom: 25px; line-height: 1.6; font-size: 16px;">
            为提供最佳体验，此功能仅支持电脑端访问。<br>请使用电脑浏览器访问我们的网站。
          </p>
          <div style="display: flex; justify-content: center; gap: 10px;">
            ${isPageBlock ? 
              `<button onclick="window.history.back()" style="flex: 1; background: #6366f1; color: white; border: none; padding: 12px 15px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 500;">返回上一页</button>` 
              : 
              `<button onclick="this.closest('.mobile-guard-alert').remove()" style="flex: 1; background: #6366f1; color: white; border: none; padding: 12px 15px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 500;">我知道了</button>`
            }
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(alertDiv);
    
    // 添加简单的动画效果
    const popupContent = alertDiv.querySelector('div > div');
    popupContent.style.transform = 'scale(0.9)';
    popupContent.style.opacity = '0';
    popupContent.style.transition = 'all 0.3s ease-out';
    
    // 强制重排后显示动画
    setTimeout(() => {
      popupContent.style.transform = 'scale(1)';
      popupContent.style.opacity = '1';
    }, 10);
  }

  // 检查是否是需要拦截的AI功能链接
  function isAIFunctionLink(url) {
    if (!url || typeof url !== 'string') return false;
    
    // 清理URL，移除查询参数和锚点
    const cleanUrl = url.split('?')[0].split('#')[0];
    
    // 直接检查是否在AI功能路径列表中
    if (aiFunctionPaths.has(cleanUrl)) return true;
    if (aiFunctionPaths.has(url)) return true;
    
    // 检查是否包含checkAuthAndRedirect调用
    if (url.includes('checkAuthAndRedirect')) return true;
    
    // 检查是否是以AI功能路径开头的路径
    for (const path of aiFunctionPaths) {
      if (url.startsWith(path) || cleanUrl.startsWith(path)) return true;
    }
    
    // 检查文件名是否匹配（去掉路径前缀）
    const fileName = cleanUrl.split('/').pop();
    if (fileName && aiFunctionPaths.has('/' + fileName)) return true;
    
    return false;
  }

  // 捕获所有点击事件
  document.addEventListener(
    'click',
    function (e) {
      const link = e.target.closest('a, button, [role="button"], .card, .feature-card, .function-card, .card-body'); // 查找可点击元素
      if (!link) return;

      // 检查data属性中的URL或功能信息
      const dataHref = link.dataset.href || link.dataset.url || link.dataset.link || link.dataset.target;
      const href = link.getAttribute('href');
      const onclick = link.getAttribute('onclick') || '';
      
      // 检查元素类名是否包含功能卡片相关类名
      const isFeatureCard = link.classList && (
        link.classList.contains('feature-card') || 
        link.classList.contains('function-card') || 
        link.classList.contains('ai-feature') ||
        link.classList.contains('feature-item')
      );
      
      // 如果是功能卡片，直接拦截
      if (isFeatureCard) {
        e.preventDefault();
        e.stopPropagation();
        showMobileAlert();
        return false;
      }
      
      // 检查href属性
      if (href) {
        // 跳过锚点链接和纯JavaScript代码
        if (href.startsWith('#') || href === 'javascript:void(0)') return;

        // 外部链接放行
        if (/^https?:\/\//i.test(href) && !href.startsWith(location.origin)) return;

        // 白名单放行
        if (allowList.has(href)) return;

        // 检查是否是AI功能链接
        if (isAIFunctionLink(href)) {
          e.preventDefault();
          e.stopPropagation();
          showMobileAlert();
          return false;
        }
      }
      
      // 检查data-href属性
      if (dataHref && isAIFunctionLink(dataHref)) {
        e.preventDefault();
        e.stopPropagation();
        showMobileAlert();
        return false;
      }

      // 检查onclick属性中的跳转或checkAuthAndRedirect调用
      if (onclick) {
        if (onclick.includes('location.href') || onclick.includes('window.location') || 
            onclick.includes('navigate') || onclick.includes('redirect')) {
          // 尝试提取URL
          const urlMatch = onclick.match(/(location\.href|window\.location|location\.replace)\s*=\s*['"]([^'"]+)['"]/);
          if (urlMatch && urlMatch[2] && isAIFunctionLink(urlMatch[2])) {
            e.preventDefault();
            e.stopPropagation();
            showMobileAlert();
            return false;
          }
        }
        
        // 检查checkAuthAndRedirect调用
        if (onclick.includes('checkAuthAndRedirect')) {
          // 提取URL参数
          const urlMatch = onclick.match(/checkAuthAndRedirect\(['"]([^'"]+)['"]\)/);
          if (urlMatch && urlMatch[1] && isAIFunctionLink(urlMatch[1])) {
            e.preventDefault();
            e.stopPropagation();
            showMobileAlert();
            return false;
          }
        }
      }
    },
    true // 捕获阶段，优先触发
  );

  // 覆盖全局跳转函数
  function overrideGlobalFunctions() {
    // 立即覆盖 checkAuthAndRedirect 函数
    const originalCheckAuthAndRedirect = window.checkAuthAndRedirect;
    window.checkAuthAndRedirect = function (url) {
      console.log('checkAuthAndRedirect 被调用:', url);
      if (url && isAIFunctionLink(url)) {
        showMobileAlert();
        return false;
      }
      // 如果不是AI功能链接，执行原函数
      if (originalCheckAuthAndRedirect) {
        return originalCheckAuthAndRedirect.call(this, url);
      }
      return true;
    };

    // 覆盖其他可能的跳转函数
    const originalWindowOpen = window.open;
    window.open = function(url, name, specs) {
      if (url && !allowList.has(url) && isAIFunctionLink(url)) {
        showMobileAlert();
        return null;
      }
      return originalWindowOpen.call(this, url, name, specs);
    };

    // 覆盖location.href赋值
    const originalLocationHref = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
    if (originalLocationHref && originalLocationHref.set) {
      Object.defineProperty(location, 'href', {
        set: function(url) {
          if (isAIFunctionLink(url)) {
            showMobileAlert();
            return;
          }
          originalLocationHref.set.call(this, url);
        },
        get: originalLocationHref.get
      });
    }
    
    // 覆盖location.replace方法
    const originalReplace = location.replace;
    location.replace = function(url) {
      if (isAIFunctionLink(url)) {
        showMobileAlert();
        return;
      }
      return originalReplace.call(this, url);
    };
  }

  // 使用 Object.defineProperty 确保 checkAuthAndRedirect 始终被覆盖
  function ensureCheckAuthAndRedirectOverride() {
    let interceptedFunction = function(url) {
      console.log('拦截 checkAuthAndRedirect:', url);
      if (url && isAIFunctionLink(url)) {
        showMobileAlert();
        return false;
      }
      // 如果有原始函数，调用它
      if (window._originalCheckAuthAndRedirect) {
        return window._originalCheckAuthAndRedirect.call(this, url);
      }
      return true;
    };

    // 保存原始函数（如果存在）
    if (window.checkAuthAndRedirect && typeof window.checkAuthAndRedirect === 'function') {
      window._originalCheckAuthAndRedirect = window.checkAuthAndRedirect;
    }

    // 使用 defineProperty 确保函数不能被重写
    Object.defineProperty(window, 'checkAuthAndRedirect', {
      value: interceptedFunction,
      writable: false,
      configurable: false
    });
  }

  // 检查当前页面是否需要拦截
  function checkCurrentPage() {
    const currentPath = window.location.pathname;
    const currentUrl = window.location.href;
    
    // 如果当前页面是AI功能页面，直接显示提示并阻止加载
    if (isAIFunctionLink(currentPath) || isAIFunctionLink(currentUrl)) {
      // 阻止页面内容显示
      document.documentElement.style.display = 'none';
      
      // 等待DOM加载完成后显示提示
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          showMobileAlert(true);
        });
      } else {
        showMobileAlert(true);
      }
      
      // 阻止页面脚本执行
      return false;
    }
    return true;
  }

  // 立即检查当前页面
  if (!checkCurrentPage()) {
    // 如果是需要拦截的页面，停止后续脚本执行
    return;
  }

  // 立即执行函数覆盖
  ensureCheckAuthAndRedirectOverride();
  overrideGlobalFunctions();

  // DOM加载完成后再执行一次，确保覆盖后加载的函数
  document.addEventListener('DOMContentLoaded', function() {
    ensureCheckAuthAndRedirectOverride();
    overrideGlobalFunctions();
    
    // 针对功能卡片添加点击事件
    const featureCards = document.querySelectorAll('.feature-card, .function-card, .ai-feature, .feature-item');
    featureCards.forEach(card => {
      card.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showMobileAlert();
        return false;
      }, true);
    });
  });

  // 页面完全加载后再执行一次
  window.addEventListener('load', function() {
    ensureCheckAuthAndRedirectOverride();
    overrideGlobalFunctions();
  });

  // 使用 MutationObserver 监听 DOM 变化，防止函数被重新定义
  if (window.MutationObserver) {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // 延迟执行，确保新添加的脚本已经执行
          setTimeout(function() {
            ensureCheckAuthAndRedirectOverride();
            
            // 检查新添加的节点中是否有功能卡片
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === 1) { // 元素节点
                const cards = node.querySelectorAll?.('.feature-card, .function-card, .ai-feature, .feature-item');
                if (cards) {
                  cards.forEach(card => {
                    card.addEventListener('click', function(e) {
                      e.preventDefault();
                      e.stopPropagation();
                      showMobileAlert();
                      return false;
                    }, true);
                  });
                }
              }
            });
          }, 100);
        }
      });
    });
    
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
})();
EOL
echo "mobile-guard.js文件已创建！"

# 5. 更新README.md，添加移动端拦截功能说明
if [ -f "./readme.md" ]; then
  # 检查README.md是否已包含移动端拦截功能说明
  if ! grep -q "移动端拦截功能" ./readme.md; then
    echo "正在更新README.md，添加移动端拦截功能说明..."
    
    # 添加功能说明到README.md文件末尾
    cat >> ./readme.md << 'EOL'

## 移动端拦截功能

系统现已添加移动端拦截功能，当用户使用手机访问网站时，将自动拦截对AI功能的访问，并显示友好提示，引导用户使用电脑端访问。

### 功能特点

- 自动检测移动设备
- 拦截对AI功能的访问
- 显示友好的提示弹窗
- 支持白名单配置（登录、注册等页面允许手机访问）

### 实现原理

系统通过以下方式实现移动端拦截：

1. 服务器端添加中间件，自动在所有HTML页面中注入移动端拦截脚本
2. 前端脚本检测设备类型，拦截对AI功能的访问
3. 拦截各类导航方式，包括链接点击、JS跳转、表单提交等

### 配置方法

如需添加更多允许手机访问的页面，修改 `public/js/mobile-guard.js` 文件中的 `allowList` 变量：

```javascript
const allowList = new Set([
  '/login.html',
  '/register.html',
  // 添加更多允许访问的路径...
]);
```

如需添加或移除需要拦截的AI功能页面，修改 `public/js/mobile-guard.js` 文件中的 `aiFunctionPaths` 变量。

### 部署方法

执行以下命令部署移动端拦截功能：

```bash
# 确保脚本有执行权限
chmod +x add-mobile-guard.sh

# 执行部署脚本
./add-mobile-guard.sh
```

部署完成后，重启服务器即可生效。
EOL
    echo "README.md已更新，添加了移动端拦截功能说明！"
  else
    echo "README.md已包含移动端拦截功能说明，跳过更新步骤。"
  fi
else
  echo "未找到README.md文件，跳过更新步骤。"
fi

# 添加执行权限
chmod +x ./add-mobile-guard.sh

echo "移动端拦截功能部署完成！请重启服务器使更改生效。"
echo "重启命令: npm restart 或 pm2 restart <app_name>" 