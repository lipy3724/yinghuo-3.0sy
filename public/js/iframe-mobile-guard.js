// iframe页面专用移动端拦截脚本
// 作用：在移动设备上访问iframe功能页面时显示提示
(function() {
  console.log('iframe移动端拦截脚本已加载');
  
  // 检测是否为移动设备
  const isMobile = /Android|iPhone|iPad|iPod|Mobile|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (!isMobile) {
    console.log('非移动设备，不进行拦截');
    return; // 仅在移动浏览器执行
  }
  
  console.log('iframe页面 - 检测到移动设备');
  
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
    
    // 隐藏页面中的iframe
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
  
  // 在DOM加载完成后显示提示
  function showMobileAlert() {
    if (document.body) {
      createMobileAlert();
    } else {
      // 如果body不存在，等待DOM加载完成
      window.addEventListener('DOMContentLoaded', createMobileAlert);
    }
  }
  
  // 阻止iframe加载
  function blockIframeLoading() {
    // 监听iframe元素创建
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach(node => {
            if (node.tagName === 'IFRAME') {
              console.log('检测到iframe创建，阻止加载');
              node.style.display = 'none';
              node.src = 'about:blank'; // 清空iframe源
            }
          });
        }
      });
    });
    
    // 开始观察DOM变化
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    
    // 立即检查并隐藏现有iframe
    document.addEventListener('DOMContentLoaded', () => {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        console.log('隐藏现有iframe');
        iframe.style.display = 'none';
        iframe.src = 'about:blank'; // 清空iframe源
      });
    });
  }
  
  // 立即执行
  showMobileAlert();
  blockIframeLoading();
})(); 