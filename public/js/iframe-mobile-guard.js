// iframe页面专用移动端拦截脚本
// 作用：在移动设备上访问iframe功能页面时显示提示
(function() {
  console.log('iframe移动端拦截脚本已加载');
  
  // 改进的移动设备检测逻辑
  function isMobileDevice() {
    // 检查用户代理
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    if (/android|iphone|ipod|ipad|windows phone|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())) {
      // 进一步检查屏幕尺寸以排除平板和大屏设备
      return window.innerWidth < 768; // 只有小屏移动设备才算移动设备
    }
    return false;
  }

  // 在真正的移动设备上执行拦截
  const shouldBlock = isMobileDevice();
  
  if (!shouldBlock) {
    console.log('非移动设备或大屏设备，不进行拦截');
    return; // 不拦截
  }
  
  console.log('iframe页面 - 检测到移动设备，执行拦截');
  
  // 创建并显示提示弹窗
  function createMobileAlert() {
    console.log('iframe页面 - 创建移动端提示');
    
    // 创建弹窗容器
    const alertContainer = document.createElement('div');
    alertContainer.style.position = 'fixed';
    alertContainer.style.top = '0';
    alertContainer.style.left = '0';
    alertContainer.style.width = '100%';
    alertContainer.style.height = '100%';
    alertContainer.style.backgroundColor = 'rgba(0,0,0,0.7)';
    alertContainer.style.zIndex = '10000';
    alertContainer.style.display = 'flex';
    alertContainer.style.alignItems = 'center';
    alertContainer.style.justifyContent = 'center';
    alertContainer.style.backdropFilter = 'blur(5px)';
    
    // 创建弹窗内容
    const alertContent = document.createElement('div');
    alertContent.style.background = 'white';
    alertContent.style.padding = '30px';
    alertContent.style.borderRadius = '15px';
    alertContent.style.maxWidth = '90%';
    alertContent.style.width = '350px';
    alertContent.style.textAlign = 'center';
    alertContent.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
    
    // 创建图标
    const iconDiv = document.createElement('div');
    iconDiv.style.fontSize = '60px';
    iconDiv.style.marginBottom = '20px';
    iconDiv.style.lineHeight = '1';
    iconDiv.textContent = '📱→💻';
    
    // 创建标题
    const title = document.createElement('h3');
    title.style.color = '#333';
    title.style.marginBottom = '15px';
    title.style.fontSize = '20px';
    title.style.fontWeight = '600';
    title.textContent = '请在电脑上使用完整功能';
    
    // 创建说明文本
    const description = document.createElement('p');
    description.style.color = '#666';
    description.style.marginBottom = '25px';
    description.style.lineHeight = '1.6';
    description.style.fontSize = '16px';
    description.innerHTML = '为提供最佳体验，请使用电脑浏览器访问我们的网站yinghuo.ai';
    
    // 组装弹窗
    alertContent.appendChild(iconDiv);
    alertContent.appendChild(title);
    alertContent.appendChild(description);
    alertContainer.appendChild(alertContent);
    
    // 添加到页面
    document.body.appendChild(alertContainer);
    
    // 隐藏页面中的iframe（不更改src属性，避免触发CSP规则）
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      iframe.style.display = 'none';
    });
    
    // 添加动画效果
    alertContent.style.transform = 'scale(0.9)';
    alertContent.style.opacity = '0';
    alertContent.style.transition = 'all 0.3s ease-out';
    
    setTimeout(() => {
      alertContent.style.transform = 'scale(1)';
      alertContent.style.opacity = '1';
    }, 10);
  }
  
  // 延迟执行，确保不与CSP冲突
  setTimeout(() => {
    // 如果DOM已加载，立即显示提示
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      createMobileAlert();
    } else {
      // 等待DOM加载完成后处理
      document.addEventListener('DOMContentLoaded', createMobileAlert);
    }
  }, 500);
})(); 