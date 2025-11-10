/**
 * 文生图片历史记录管理模块
 */
window.TextToImageHistory = (function() {
  // 私有变量
  const API_BASE = '/api/text-to-image/history';
  const OSS_API_BASE = '/api/text-to-image/history-oss';
  
  /**
   * 获取OSS历史记录
   * @param {Object} options 选项
   * @param {Number} options.hours 获取最近N小时的记录，默认24
   * @param {Number} options.limit 限制数量，默认50
   * @returns {Promise<Array>} OSS历史记录数组
   */
  async function fetchOSS(options = {}) {
    try {
      console.log('[OSS历史记录] 开始获取OSS历史记录');
      
      // 从localStorage获取认证令牌
      const authToken = localStorage.getItem('authToken');
      console.log('[OSS历史记录] 认证令牌状态:', authToken ? '已获取' : '未获取');
      
      // 设置请求头
      const headers = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
        console.log('[OSS历史记录] 已设置Authorization请求头');
      } else {
        console.warn('[OSS历史记录] 未找到认证令牌，请求可能会失败');
      }
      
      // 构建查询参数
      const queryParams = new URLSearchParams();
      if (options.hours) queryParams.append('hours', options.hours);
      if (options.limit) queryParams.append('limit', options.limit);
      
      // 添加缓存破坏参数
      queryParams.append('t', Date.now());
      queryParams.append('_', Math.random());
      
      const queryString = queryParams.toString();
      
      // 发送请求
      console.log(`[OSS历史记录] 发送请求到: ${OSS_API_BASE}?${queryString}`);
      const response = await axios.get(`${OSS_API_BASE}?${queryString}`, { 
        headers,
        cache: 'no-cache'
      });
      
      console.log('[OSS历史记录] API响应:', response.status, response.statusText);
      
      if (response.data && response.data.success) {
        const records = response.data.data.records || [];
        console.log(`[OSS历史记录] 获取成功，记录数: ${records.length}`);
        
        // 转换OSS记录格式为前端兼容格式
        const convertedRecords = records.map(record => ({
          id: record.recordId,
          userId: record.userId,
          imageUrl: record.images.generated.ossUrl, // 使用OSS URL
          originalImageUrl: record.images.generated.originalUrl, // 保留原始URL
          prompt: record.prompt,
          negativePrompt: record.negativePrompt || '',
          size: record.size,
          model: record.model,
          parameters: record.parameters,
          timestamp: record.timestamp,
          createdAt: record.timestamp,
          source: 'oss', // 标记为OSS来源
          metadata: {
            recordId: record.recordId,
            ossPath: record.images.generated.ossPath,
            metadataUrl: record.metadataUrl,
            version: record.version
          }
        }));
        
        return convertedRecords;
      } else {
        console.error('[OSS历史记录] API返回错误:', response.data);
        return [];
      }
    } catch (error) {
      console.error('[OSS历史记录] 获取失败:', error);
      if (error.response) {
        console.error('[OSS历史记录] 错误响应:', error.response.status, error.response.data);
      }
      return [];
    }
  }

  /**
   * 获取内存历史记录
   * @param {Object} options 选项
   * @param {Number} options.limit 限制数量，默认10
   * @param {Boolean} options.last24Hours 是否只获取最近24小时的记录
   * @returns {Promise<Array>} 内存历史记录数组
   */
  async function fetchMemory(options = {}) {
    try {
      // 从localStorage获取认证令牌
      const authToken = localStorage.getItem('authToken');
      console.log('获取文生图片历史记录: 认证令牌状态:', authToken ? '已获取' : '未获取');
      
      // 设置请求头
      const headers = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
        console.log('已设置Authorization请求头');
      } else {
        console.warn('未找到认证令牌，请求可能会失败');
      }
      
      // 构建查询参数
      const queryParams = new URLSearchParams();
      if (options.limit) queryParams.append('limit', options.limit);
      if (options.last24Hours) queryParams.append('last24Hours', options.last24Hours);
      
      // 添加缓存破坏参数
      queryParams.append('t', Date.now());
      queryParams.append('_', Math.random());
      
      const queryString = queryParams.toString();
      
      // 发送请求
      console.log(`发送请求到: ${API_BASE}?${queryString}`);
      const response = await axios.get(`${API_BASE}?${queryString}`, { 
        headers,
        // 确保不使用缓存
        cache: 'no-cache'
      });
      
      console.log('文生图片历史记录API响应:', response.status, response.statusText);
      
      if (response.data.success) {
        console.log(`获取到 ${response.data.data?.tasks?.length || 0} 条文生图片历史记录`);
        return response.data.data?.tasks || [];
      } else {
        console.error('获取文生图片历史记录失败:', response.data.message);
        return [];
      }
    } catch (error) {
      console.error('获取文生图片历史记录请求失败:', error.message);
      if (error.response) {
        console.error('错误状态码:', error.response.status);
        console.error('错误信息:', error.response.data);
      }
      return [];
    }
  }
  
  /**
   * 保存历史记录
   * @param {Object} data 历史记录数据
   * @param {String} data.prompt 提示词
   * @param {String} data.imageUrl 生成的图片URL
   * @param {String} data.originalImageUrl 原始图片URL（如果有）
   * @param {Object} data.options 生成选项
   * @returns {Promise<Object>} 保存结果
   */
  async function save(data) {
    try {
      // 从localStorage获取认证令牌
      const authToken = localStorage.getItem('authToken');
      console.log('保存文生图片历史记录: 认证令牌状态:', authToken ? '已获取' : '未获取');
      
      // 设置请求头
      const headers = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
        console.log('已设置Authorization请求头');
      } else {
        console.warn('未找到认证令牌，请求可能会失败');
        return { success: false, message: '未登录，无法保存历史记录' };
      }
      
      // 发送请求
      console.log(`发送请求到: ${API_BASE}`, data);
      const response = await axios.post(API_BASE, data, { headers });
      
      console.log('保存文生图片历史记录API响应:', response.status, response.statusText);
      
      return response.data;
    } catch (error) {
      console.error('保存文生图片历史记录请求失败:', error.message);
      if (error.response) {
        console.error('错误状态码:', error.response.status);
        console.error('错误信息:', error.response.data);
      }
      return { 
        success: false, 
        message: '保存历史记录失败: ' + (error.response?.data?.message || error.message) 
      };
    }
  }
  
  /**
   * 清空历史记录
   * @returns {Promise<Object>} 清空结果
   */
  async function clear() {
    try {
      // 从localStorage获取认证令牌
      const authToken = localStorage.getItem('authToken');
      console.log('清空文生图片历史记录: 认证令牌状态:', authToken ? '已获取' : '未获取');
      
      // 设置请求头
      const headers = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
        console.log('已设置Authorization请求头');
      } else {
        console.warn('未找到认证令牌，请求可能会失败');
        return { success: false, message: '未登录，无法清空历史记录' };
      }
      
      // 发送请求
      console.log(`发送请求到: ${API_BASE}`);
      const response = await axios.delete(API_BASE, { headers });
      
      console.log('清空文生图片历史记录API响应:', response.status, response.statusText);
      
      return response.data;
    } catch (error) {
      console.error('清空文生图片历史记录请求失败:', error.message);
      if (error.response) {
        console.error('错误状态码:', error.response.status);
        console.error('错误信息:', error.response.data);
      }
      return { 
        success: false, 
        message: '清空历史记录失败: ' + (error.response?.data?.message || error.message) 
      };
    }
  }
  
  /**
   * 渲染历史记录到容器
   * @param {String} containerId 容器ID
   * @param {Object} options 选项
   * @returns {Promise<void>}
   */
  async function render(containerId, options = {}) {
    try {
      console.log(`开始渲染文生图片历史记录到容器 ${containerId}`);
      
      // 获取容器元素
      const container = document.getElementById(containerId);
      if (!container) {
        console.error(`未找到容器元素: ${containerId}`);
        return;
      }
      
      // 清空容器
      container.innerHTML = '';
      
      // 显示加载中
      container.innerHTML = '<div class="text-center my-4"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">加载历史记录中...</p></div>';
      
      // 获取历史记录
      let records = [];
      try {
        records = await fetch(options);
      } catch (fetchError) {
        console.error('获取历史记录失败:', fetchError);
        container.innerHTML = `<div class="alert alert-danger" role="alert">
          <h4 class="alert-heading">加载历史记录失败</h4>
          <p>${fetchError.message || '服务器连接错误'}</p>
          <hr>
          <p class="mb-0">请稍后再试或联系管理员</p>
          <button class="btn btn-outline-danger mt-2" onclick="TextToImageHistory.render('${containerId}', ${JSON.stringify(options)})">
            <i class="bi bi-arrow-clockwise"></i> 重试
          </button>
        </div>`;
        return;
      }
      
      // 清空容器
      container.innerHTML = '';
      
      // 检查是否有记录
      if (!records || records.length === 0) {
        // 使用翻译函数获取"暂无历史记录"文本
        const noHistoryText = window.getTranslation ? window.getTranslation('text_to_image.no_history') : 'No history records';
        container.innerHTML = `<div class="text-center my-4"><p class="text-muted">${noHistoryText}</p></div>`;
        return;
      }
      
      // 创建历史记录列表
      const historyList = document.createElement('div');
      historyList.className = 'row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4';
      
      // 渲染每条记录
      records.forEach(record => {
        // 创建卡片
        const card = document.createElement('div');
        card.className = 'col';
        
        // 格式化日期
        const date = record.created_at ? new Date(record.created_at) : new Date();
        const dateStr = date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // 处理图片URL，如果是外部URL，使用代理
        let displayImageUrl = record.imageUrl;
        if (displayImageUrl && !displayImageUrl.startsWith(window.location.origin) && 
            !displayImageUrl.startsWith('data:') && !displayImageUrl.startsWith('blob:')) {
          // 使用代理URL
          displayImageUrl = `${ossConfig.proxyImageEndpoint}?url=${encodeURIComponent(displayImageUrl)}`;
        }
        
        // 卡片内容
        card.innerHTML = `
          <div class="card h-100">
            <img src="${displayImageUrl}" class="card-img-top" alt="生成的图片" 
                 onerror="this.onerror=null; this.src='/img/image-placeholder.png';">
            <div class="card-body">
              <h5 class="card-title">文生图片</h5>
              <p class="card-text text-truncate" title="${record.prompt || '无提示词'}">
                ${record.prompt || '无提示词'}
              </p>
            </div>
            <div class="card-footer d-flex justify-content-between align-items-center">
              <small class="text-muted">${dateStr}</small>
              <div class="btn-group">
                <button class="btn btn-sm btn-outline-success save-btn" data-id="${record.id}">
                  <i class="bi bi-download"></i>
                </button>
              </div>
            </div>
          </div>
        `;
        
        // 添加到列表
        historyList.appendChild(card);
      });
      
      // 添加到容器
      container.appendChild(historyList);
      
      // 绑定事件
      bindEvents(container, records);
      
      console.log(`文生图片历史记录渲染完成，共 ${records.length} 条记录`);
    } catch (error) {
      console.error('渲染文生图片历史记录失败:', error);
      
      // 获取容器元素
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = `<div class="alert alert-danger" role="alert">加载历史记录失败: ${error.message}</div>`;
      }
    }
  }
  
  /**
   * 绑定事件
   * @param {HTMLElement} container 容器元素
   * @param {Array} records 历史记录数组
   */
  function bindEvents(container, records) {
    // 保存按钮
    container.querySelectorAll('.save-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const record = records.find(r => r.id === id);
        if (record) {
          await saveToDownloadCenter(record);
        }
      });
    });
  }
  
  
  /**
   * 保存到下载中心
   * @param {Object} record 历史记录
   * @returns {Promise<void>}
   */
  async function saveToDownloadCenter(record) {
    try {
      console.log('保存文生图片到下载中心:', record);
      
      // 检查是否登录
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        alert('请先登录再保存图片');
        return;
      }
      
      // 显示加载提示
      const loadingToast = showToast('正在保存到下载中心...', 'info');
      
      // 处理图片URL，确保使用原始URL而不是代理URL
      let imageUrl = record.imageUrl;
      
      // 发送请求
      try {
        const response = await axios.post('/api/save-to-downloads', {
          imageUrl: imageUrl,
          title: '文生图片',
          description: record.prompt || '无提示词',
          type: 'TEXT_TO_IMAGE'
        }, {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        });
        
        // 隐藏加载提示
        hideToast(loadingToast);
        
        // 显示结果
        if (response.data.success) {
          showToast('已保存到下载中心', 'success');
        } else {
          console.error('保存失败，服务器返回错误:', response.data);
          showToast('保存失败: ' + response.data.message, 'danger');
        }
      } catch (apiError) {
        console.error('API请求失败:', apiError);
        
        // 隐藏加载提示
        hideToast(loadingToast);
        
        // 显示详细错误信息
        let errorMessage = '保存失败';
        if (apiError.response) {
          errorMessage += ': ' + (apiError.response.data?.message || apiError.response.statusText);
          console.error('错误详情:', apiError.response.data);
        } else if (apiError.request) {
          errorMessage += ': 服务器未响应';
          console.error('无响应:', apiError.request);
        } else {
          errorMessage += ': ' + apiError.message;
        }
        
        showToast(errorMessage, 'danger');
      }
    } catch (error) {
      console.error('保存到下载中心过程中发生错误:', error);
      showToast('保存失败: ' + (error.message || '未知错误'), 'danger');
    }
  }
  
  /**
   * 显示提示消息
   * @param {String} message 消息内容
   * @param {String} type 类型：success, info, warning, danger
   * @returns {Object} Toast实例
   */
  function showToast(message, type = 'info') {
    // 创建Toast容器（如果不存在）
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
      toastContainer.style.zIndex = '5';
      document.body.appendChild(toastContainer);
    }
    
    // 创建唯一ID
    const id = 'toast-' + Date.now();
    
    // 创建Toast元素
    const toastHtml = `
      <div id="${id}" class="toast align-items-center text-white bg-${type}" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">
            ${message}
          </div>
          <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>
    `;
    
    // 添加到容器
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    // 获取Toast元素
    const toastElement = document.getElementById(id);
    
    // 创建Toast实例
    const toast = new bootstrap.Toast(toastElement, {
      autohide: type !== 'info',
      delay: 3000
    });
    
    // 显示Toast
    toast.show();
    
    // 返回Toast实例和元素，用于手动隐藏
    return {
      instance: toast,
      element: toastElement
    };
  }
  
  /**
   * 隐藏提示消息
   * @param {Object} toast Toast实例
   */
  function hideToast(toast) {
    if (toast && toast.instance) {
      toast.instance.hide();
      // 延迟移除元素
      setTimeout(() => {
        if (toast.element && toast.element.parentNode) {
          toast.element.parentNode.removeChild(toast.element);
        }
      }, 500);
    }
  }

  /**
   * 综合获取历史记录（OSS + 内存）
   * @param {Object} options 选项
   * @param {Number} options.limit 限制数量，默认50
   * @param {Boolean} options.preferOSS 是否优先使用OSS记录，默认true
   * @returns {Promise<Array>} 综合历史记录数组
   */
  async function fetch(options = {}) {
    console.log('[综合历史记录] 开始获取历史记录');
    
    const { limit = 50, preferOSS = true } = options;
    
    try {
      if (preferOSS) {
        // 优先获取OSS记录
        console.log('[综合历史记录] 优先获取OSS历史记录');
        const ossRecords = await fetchOSS({ hours: 48, limit });
        
        if (ossRecords.length > 0) {
          console.log(`[综合历史记录] 获取到 ${ossRecords.length} 条OSS记录`);
          return ossRecords;
        } else {
          console.log('[综合历史记录] OSS记录为空，获取内存记录');
          const memoryRecords = await fetchMemory({ limit, last24Hours: true });
          console.log(`[综合历史记录] 获取到 ${memoryRecords.length} 条内存记录`);
          return memoryRecords;
        }
      } else {
        // 优先获取内存记录
        console.log('[综合历史记录] 优先获取内存历史记录');
        const memoryRecords = await fetchMemory({ limit, last24Hours: true });
        
        if (memoryRecords.length > 0) {
          console.log(`[综合历史记录] 获取到 ${memoryRecords.length} 条内存记录`);
          return memoryRecords;
        } else {
          console.log('[综合历史记录] 内存记录为空，获取OSS记录');
          const ossRecords = await fetchOSS({ hours: 48, limit });
          console.log(`[综合历史记录] 获取到 ${ossRecords.length} 条OSS记录`);
          return ossRecords;
        }
      }
    } catch (error) {
      console.error('[综合历史记录] 获取失败:', error);
      return [];
    }
  }

  /**
   * 清空OSS历史记录
   * @returns {Promise<Boolean>} 是否成功
   */
  async function clearOSS() {
    try {
      console.log('[OSS历史记录] 开始清空OSS历史记录');
      
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        console.error('[OSS历史记录] 清空失败: 未找到认证令牌');
        return false;
      }
      
      const response = await axios.delete(OSS_API_BASE, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[OSS历史记录] 清空响应:', response.status, response.statusText);
      
      if (response.data && response.data.success) {
        console.log(`[OSS历史记录] 清空成功，删除了 ${response.data.data.totalDeleted} 个文件`);
        return true;
      } else {
        console.error('[OSS历史记录] 清空失败:', response.data);
        return false;
      }
    } catch (error) {
      console.error('[OSS历史记录] 清空失败:', error);
      if (error.response) {
        console.error('[OSS历史记录] 错误响应:', error.response.status, error.response.data);
      }
      return false;
    }
  }

  /**
   * 综合清空历史记录（OSS + 内存）
   * @returns {Promise<Boolean>} 是否成功
   */
  async function clearAll() {
    console.log('[综合历史记录] 开始清空所有历史记录');
    
    try {
      // 并行清空OSS和内存记录
      const [ossResult, memoryResult] = await Promise.all([
        clearOSS(),
        clear() // 原有的内存清空功能
      ]);
      
      console.log('[综合历史记录] 清空结果 - OSS:', ossResult, ', 内存:', memoryResult);
      
      // 只要有一个成功就算成功
      return ossResult || memoryResult;
    } catch (error) {
      console.error('[综合历史记录] 清空失败:', error);
      return false;
    }
  }
  
  // 公开API
  return {
    // 综合功能（推荐使用）
    fetch,         // 综合获取（OSS + 内存）
    clearAll,      // 综合清空（OSS + 内存）
    
    // 分别的功能
    fetchOSS,      // 只获取OSS记录
    fetchMemory,   // 只获取内存记录
    clearOSS,      // 只清空OSS记录
    clear,         // 只清空内存记录（原有功能）
    
    // 其他功能
    save,
    render
  };
})();


