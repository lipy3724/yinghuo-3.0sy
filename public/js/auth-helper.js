/**
 * 认证辅助工具
 * 用于管理认证令牌和设置全局请求头
 */
window.AuthHelper = (function() {
  // 私有变量
  const TOKEN_KEY = 'authToken';
  const USER_KEY = 'user';
  
  /**
   * 初始化认证设置
   * 从localStorage加载令牌并设置全局请求头
   */
  function init() {
    console.log('初始化认证设置');
    
    // 从localStorage获取认证令牌
    const token = localStorage.getItem(TOKEN_KEY);
    
    if (token) {
      console.log('找到认证令牌，设置全局请求头');
      // 设置全局请求头
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn('未找到认证令牌');
    }
    
    // 监听存储变化
    window.addEventListener('storage', handleStorageChange);
  }
  
  /**
   * 处理存储变化事件
   * 当localStorage中的令牌变化时更新全局请求头
   * @param {StorageEvent} event 存储事件
   */
  function handleStorageChange(event) {
    if (event.key === TOKEN_KEY) {
      if (event.newValue) {
        console.log('认证令牌已更新，设置全局请求头');
        axios.defaults.headers.common['Authorization'] = `Bearer ${event.newValue}`;
      } else {
        console.log('认证令牌已删除，移除全局请求头');
        delete axios.defaults.headers.common['Authorization'];
      }
    }
  }
  
  /**
   * 获取当前认证令牌
   * @returns {string|null} 认证令牌
   */
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }
  
  /**
   * 设置认证令牌
   * @param {string} token 认证令牌
   */
  function setToken(token) {
    if (token) {
      console.log('设置新的认证令牌');
      localStorage.setItem(TOKEN_KEY, token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn('尝试设置空令牌');
    }
  }
  
  /**
   * 清除认证令牌
   */
  function clearToken() {
    console.log('清除认证令牌');
    localStorage.removeItem(TOKEN_KEY);
    delete axios.defaults.headers.common['Authorization'];
  }
  
  /**
   * 获取当前用户信息
   * @returns {Object|null} 用户信息
   */
  function getUser() {
    const userStr = localStorage.getItem(USER_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        console.error('解析用户信息失败:', error);
        return null;
      }
    }
    return null;
  }
  
  /**
   * 检查是否已认证
   * @returns {boolean} 是否已认证
   */
  function isAuthenticated() {
    return !!getToken();
  }
  
  // 初始化
  init();
  
  // 公开API
  return {
    getToken,
    setToken,
    clearToken,
    getUser,
    isAuthenticated
  };
})();
