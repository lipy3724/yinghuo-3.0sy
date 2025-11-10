/**
 * 错误处理工具
 * 提供统一的错误处理和显示功能
 */

(function() {
  // 创建全局错误处理器
  window.ErrorHandler = {
    /**
     * 处理API错误
     * @param {Object} error - 错误对象
     * @param {string} error.message - 错误消息
     * @param {string} [error.errorCode] - 错误代码
     * @param {string} [error.type] - 错误类型
     * @param {string} [error.description] - 错误详细描述
     * @param {string} [containerId='error-message-container'] - 错误消息容器ID
     */
    handleApiError: function(error, containerId) {
      // 默认容器ID
      containerId = containerId || 'error-message-container';
      
      // 查找容器
      const container = document.getElementById(containerId);
      if (!container) {
        console.error('错误消息容器未找到:', containerId);
        // 如果找不到容器，使用alert显示错误
        alert(error.message || '发生错误，请稍后再试');
        return;
      }
      
      // 清除容器中的现有错误
      container.innerHTML = '';
      
      // 创建错误消息元素
      const errorElement = document.createElement('div');
      errorElement.className = 'error-message';
      
      // 根据错误代码设置特定样式
      if (error.errorCode) {
        if (error.errorCode.includes('API_') || error.errorCode === 'NO_TRIAL_RESOURCE') {
          errorElement.classList.add('api-error');
        } else if (error.errorCode.includes('AUTH_') || error.errorCode === 'UNAUTHORIZED') {
          errorElement.classList.add('auth-error');
        } else if (error.errorCode.includes('NETWORK_') || error.errorCode === 'CONNECTION_ERROR') {
          errorElement.classList.add('network-error');
        }
      }
      
      // 根据错误类型设置消息类型
      if (error.type === 'warning') {
        errorElement.className = 'warning-message';
      } else if (error.type === 'info') {
        errorElement.className = 'info-message';
      } else if (error.type === 'success') {
        errorElement.className = 'success-message';
      }
      
      // 构建错误消息内容
      let titleIcon = '<i class="ri-error-warning-line error-icon"></i>';
      if (error.type === 'warning') {
        titleIcon = '<i class="ri-alert-line error-icon"></i>';
      } else if (error.type === 'info') {
        titleIcon = '<i class="ri-information-line error-icon"></i>';
      } else if (error.type === 'success') {
        titleIcon = '<i class="ri-checkbox-circle-line error-icon"></i>';
      }
      
      const errorTitle = error.title || '操作失败';
      const errorCode = error.errorCode ? `<span class="error-code">${error.errorCode}</span>` : '';
      const errorDescription = error.description ? `<div class="error-description">${error.description}</div>` : '';
      
      // 设置错误消息HTML
      errorElement.innerHTML = `
        <div class="error-title">${titleIcon}${errorTitle}${errorCode}</div>
        <div>${error.message}</div>
        ${errorDescription}
        <button class="close-btn" aria-label="关闭">&times;</button>
      `;
      
      // 添加关闭按钮事件
      const closeButton = errorElement.querySelector('.close-btn');
      if (closeButton) {
        closeButton.addEventListener('click', function() {
          errorElement.remove();
        });
      }
      
      // 添加错误消息到容器
      container.appendChild(errorElement);
      
      // 自动滚动到错误消息
      errorElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // 如果是成功消息，3秒后自动消失
      if (error.type === 'success') {
        setTimeout(function() {
          if (errorElement.parentNode) {
            errorElement.remove();
          }
        }, 3000);
      }
      
      // 记录错误到控制台
      if (error.type === 'error' || !error.type) {
        console.error('API错误:', error);
      } else {
        console.log(`${error.type || 'info'}:`, error);
      }
      
      return errorElement;
    },
    
    /**
     * 处理网络错误
     * @param {Error} error - 错误对象
     * @param {string} [containerId='error-message-container'] - 错误消息容器ID
     */
    handleNetworkError: function(error, containerId) {
      return this.handleApiError({
        message: '网络连接错误，请检查您的网络连接',
        errorCode: 'NETWORK_ERROR',
        title: '网络错误',
        description: error.message
      }, containerId);
    },
    
    /**
     * 处理认证错误
     * @param {string} message - 错误消息
     * @param {string} [containerId='error-message-container'] - 错误消息容器ID
     */
    handleAuthError: function(message, containerId) {
      const error = {
        message: message || '您的登录已过期，请重新登录',
        errorCode: 'AUTH_ERROR',
        title: '认证错误',
        type: 'warning'
      };
      
      const errorElement = this.handleApiError(error, containerId);
      
      // 3秒后重定向到登录页面
      setTimeout(function() {
        window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
      }, 3000);
      
      return errorElement;
    },
    
    /**
     * 显示成功消息
     * @param {string} message - 成功消息
     * @param {string} [containerId='error-message-container'] - 消息容器ID
     */
    showSuccess: function(message, containerId) {
      return this.handleApiError({
        message: message,
        title: '操作成功',
        type: 'success'
      }, containerId);
    },
    
    /**
     * 显示信息消息
     * @param {string} message - 信息消息
     * @param {string} [containerId='error-message-container'] - 消息容器ID
     */
    showInfo: function(message, containerId) {
      return this.handleApiError({
        message: message,
        title: '提示信息',
        type: 'info'
      }, containerId);
    },
    
    /**
     * 显示警告消息
     * @param {string} message - 警告消息
     * @param {string} [containerId='error-message-container'] - 消息容器ID
     */
    showWarning: function(message, containerId) {
      return this.handleApiError({
        message: message,
        title: '警告',
        type: 'warning'
      }, containerId);
    },
    
    /**
     * 清除所有错误消息
     * @param {string} [containerId='error-message-container'] - 错误消息容器ID
     */
    clearErrors: function(containerId) {
      containerId = containerId || 'error-message-container';
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
      }
    }
  };
  
  // 添加全局错误处理
  window.addEventListener('error', function(event) {
    console.error('全局错误:', event.error);
    // 不自动显示全局JavaScript错误，避免对用户造成困扰
  });
  
  // 添加未处理的Promise拒绝处理
  window.addEventListener('unhandledrejection', function(event) {
    console.error('未处理的Promise拒绝:', event.reason);
    // 不自动显示未处理的Promise拒绝，避免对用户造成困扰
  });
  
  console.log('错误处理器已初始化');
})();