/**
 * CORS中间件
 * 用于解决跨域访问问题
 */

/**
 * 创建CORS中间件
 * 
 * @param {Object} options - 配置选项
 * @param {string|string[]} options.allowOrigins - 允许的来源，可以是字符串或字符串数组，默认为'*'
 * @param {string} options.allowMethods - 允许的HTTP方法，默认为'GET, POST, OPTIONS'
 * @param {string} options.allowHeaders - 允许的HTTP头，默认为'Content-Type, Authorization'
 * @param {boolean} options.allowCredentials - 是否允许凭证，默认为true
 * @param {number} options.maxAge - 预检请求的缓存时间，默认为86400秒（1天）
 * @returns {Function} Express中间件函数
 */
function corsMiddleware(options = {}) {
  const {
    allowOrigins = '*',
    allowMethods = 'GET, POST, OPTIONS',
    allowHeaders = 'Content-Type, Authorization, X-Requested-With',
    allowCredentials = true,
    maxAge = 86400
  } = options;

  return (req, res, next) => {
    // 确定允许的来源
    let origin;
    if (allowOrigins === '*') {
      // 如果允许所有来源，使用请求的来源或默认为*
      origin = req.headers.origin || '*';
    } else if (Array.isArray(allowOrigins)) {
      // 如果是数组，检查请求的来源是否在允许的列表中
      origin = allowOrigins.includes(req.headers.origin) 
        ? req.headers.origin 
        : allowOrigins[0] || '*';
    } else {
      // 如果是字符串，直接使用
      origin = allowOrigins;
    }

    // 设置CORS头部
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', allowMethods);
    res.header('Access-Control-Allow-Headers', allowHeaders);
    
    if (allowCredentials) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    
    res.header('Access-Control-Max-Age', maxAge.toString());

    // 如果是OPTIONS请求，直接返回200
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    // 继续处理请求
    next();
  };
}

module.exports = corsMiddleware;




