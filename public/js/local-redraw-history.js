/**
 * 局部重绘历史记录管理模块
 */
window.LocalRedrawHistory = (function() {
  // 私有变量
  const API_BASE = '/api/local-redraw-history';
  
  /**
   * 获取历史记录
   * @returns {Promise<Array>} 历史记录数组
   */
  async function fetch() {
    try {
      // 从localStorage获取认证令牌
      const authToken = localStorage.getItem('authToken');
      console.log('获取历史记录: 认证令牌状态:', authToken ? '已获取' : '未获取');
      
      // 设置请求头
      const headers = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
        console.log('已设置Authorization请求头');
      } else {
        console.warn('未找到认证令牌，请求可能会失败');
      }
      
      // 发送请求
      console.log(`发送请求到: ${API_BASE}/list`);
      const response = await axios.get(`${API_BASE}/list`, { headers });
      
      console.log('历史记录API响应:', response.status, response.statusText);
      
      if (response.data.success) {
        console.log(`获取到 ${response.data.records?.length || 0} 条历史记录`);
        return response.data.records || [];
      } else {
        console.error('获取历史记录失败:', response.data.message);
        return [];
      }
    } catch (error) {
      console.error('获取历史记录请求失败:', error.message);
      if (error.response) {
        console.error('错误状态码:', error.response.status);
        console.error('错误信息:', error.response.data);
        
        // 如果是认证失败，提示用户登录
        if (error.response.status === 401) {
          console.warn('用户未登录，无法获取历史记录');
          // 可以在这里添加跳转到登录页面的逻辑
        }
      }
      return [];
    }
  }
  
  /**
   * 保存历史记录
   * @param {Object} data 历史记录数据
   * @param {String} data.originalImage 原始图片（Base64或URL）
   * @param {String} data.resultImage 结果图片（Base64或URL）
   * @param {String} data.prompt 提示词
   * @param {String} data.maskImage 蒙版图片（可选）
   * @param {Object} data.metadata 元数据
   * @returns {Promise<Object>} 保存结果
   */
  async function save(data) {
    try {
      // 从localStorage获取认证令牌
      const authToken = localStorage.getItem('authToken');
      console.log('保存历史记录: 认证令牌状态:', authToken ? '已获取' : '未获取');
      
      // 设置请求头
      const headers = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
        console.log('已设置Authorization请求头');
      } else {
        console.warn('未找到认证令牌，请求可能会失败');
      }
      
      // 发送请求
      console.log(`发送请求到: ${API_BASE}/save`);
      const response = await axios.post(`${API_BASE}/save`, data, { headers });
      
      console.log('保存历史记录API响应:', response.status, response.statusText);
      return response.data;
    } catch (error) {
      console.error('保存历史记录失败:', error.message);
      if (error.response) {
        console.error('错误状态码:', error.response.status);
        console.error('错误信息:', error.response.data);
        
        // 如果是认证失败，提示用户登录
        if (error.response.status === 401) {
          console.warn('用户未登录，无法保存历史记录');
        }
      }
      throw error;
    }
  }
  
  /**
   * 删除历史记录
   * @param {String} historyId 历史记录ID
   * @returns {Promise<Object>} 删除结果
   */
  async function remove(historyId) {
    try {
      // 从localStorage获取认证令牌
      const authToken = localStorage.getItem('authToken');
      console.log('删除历史记录: 认证令牌状态:', authToken ? '已获取' : '未获取');
      
      // 设置请求头
      const headers = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
        console.log('已设置Authorization请求头');
      } else {
        console.warn('未找到认证令牌，请求可能会失败');
      }
      
      // 发送请求
      console.log(`发送请求到: ${API_BASE}/${historyId}`);
      const response = await axios.delete(`${API_BASE}/${historyId}`, { headers });
      
      console.log('删除历史记录API响应:', response.status, response.statusText);
      return response.data;
    } catch (error) {
      console.error('删除历史记录失败:', error.message);
      if (error.response) {
        console.error('错误状态码:', error.response.status);
        console.error('错误信息:', error.response.data);
      }
      throw error;
    }
  }
  
  /**
   * 在指定容器中显示历史记录
   * @param {Array} records 历史记录数组
   * @param {String} containerId 容器元素ID
   */
  function display(records, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`找不到ID为 ${containerId} 的容器元素`);
      return;
    }
    
    // 过滤出24小时内的记录
    const now = new Date();
    const validRecords = records.filter(record => {
      const recordDate = new Date(record.timestamp);
      const hoursDiff = (now - recordDate) / (1000 * 60 * 60);
      return hoursDiff <= 24; // 只显示24小时内的记录
    });
    
    console.log(`显示 ${validRecords?.length || 0} 条有效历史记录到容器 ${containerId}（24小时内）`);
    
    // 清空容器
    container.innerHTML = '';
    
    // 如果没有记录，显示提示信息
    if (!validRecords || validRecords.length === 0) {
      // 使用翻译函数获取"暂无历史记录"文本
      const noHistoryText = window.getTranslation ? window.getTranslation('model_weight.no_history') : 'No history records';
      container.innerHTML = `<p class="text-gray-500 col-span-full text-center py-4">${noHistoryText}</p>`;
      return;
    }
    
    // 创建历史记录卡片
    validRecords.forEach(record => {
      const card = createHistoryCard(record, containerId);
      container.appendChild(card);
    });
  }
  
  /**
   * 创建历史记录卡片
   * @param {Object} record 历史记录数据
   * @param {String} containerId 容器ID，用于删除后更新容器
   * @returns {HTMLElement} 历史记录卡片元素
   */
  function createHistoryCard(record, containerId) {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-md overflow-hidden relative history-card';
    card.dataset.id = record.id;
    
    console.log(`创建历史记录卡片: ID=${record.id}`);
    
    // 验证图片数据是否有效
    const isValidImage = record.resultImage && (
      record.resultImage.startsWith('data:image/') || 
      record.resultImage.startsWith('http://') || 
      record.resultImage.startsWith('https://')
    );
    
    // 卡片内容 - 显示结果图
    card.innerHTML = `
      <div class="p-4 pb-12">
        <div class="flex items-center justify-between mb-2">
          <p class="text-sm text-gray-500">${record.timeDisplay || new Date(record.timestamp).toLocaleString()}</p>
          <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">局部重绘</span>
        </div>
        <div class="flex justify-center">
          <div class="w-full max-w-xs">
            <p class="text-xs text-gray-500 mb-1 text-center">结果图</p>
            ${isValidImage ? 
              `<img src="${record.resultImage}" alt="结果图" class="w-full h-auto rounded history-thumbnail" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
               <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-gray-500 text-sm" style="display:none;">图片加载失败</div>` :
              `<div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-gray-500 text-sm">无效的图片数据</div>`
            }
          </div>
        </div>
        ${record.prompt ? `<p class="text-xs text-gray-600 mt-2 text-center truncate" title="${record.prompt}">${record.prompt}</p>` : ''}
      </div>
      <div class="absolute bottom-3 right-4">
        <button class="download-history bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded-md flex items-center text-xs download-history-btn" data-id="${record.id}" ${!isValidImage ? 'disabled' : ''}>
          <i class="ri-download-line mr-1"></i>下载
        </button>
      </div>
    `;
    
    // 绑定下载按钮事件
    const downloadBtn = card.querySelector('.download-history');
    if (downloadBtn && isValidImage) {
      downloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const historyId = downloadBtn.dataset.id;
        console.log(`点击下载按钮: ID=${historyId}`);
        
        // 下载图片
        downloadImage(record.resultImage, `局部重绘-${new Date().toISOString().slice(0,10)}.png`);
      });
    } else if (downloadBtn && !isValidImage) {
      downloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        alert('无法下载：图片数据无效');
      });
    }
    
    return card;
  }
  
  /**
   * 下载图片
   * @param {String} url 图片URL或Base64
   * @param {String} filename 文件名
   */
  function downloadImage(url, filename) {
    console.log(`准备下载图片: ${filename}`);
    
    // 创建一个临时链接
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    // 添加到文档中
    document.body.appendChild(link);
    
    // 模拟点击
    console.log('触发下载...');
    link.click();
    
    // 移除链接
    setTimeout(() => {
      document.body.removeChild(link);
      console.log('下载链接已移除');
    }, 100);
  }
  
  // 公开API
  return {
    fetch,
    save,
    remove,
    display,
    downloadImage
  };
})();
