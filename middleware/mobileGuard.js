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
        ((res.get('Content-Type') || '').includes('text/html') || 
        body.includes('<!DOCTYPE html>') || 
        body.includes('<html>'))) {
      
      // 检查是否已经包含mobile-guard.js引用
      if (!body.includes('mobile-guard.js')) {
        // 优先在DOCTYPE后立即添加脚本，确保最早执行
        if (body.includes('<!DOCTYPE html>')) {
          body = body.replace(
            '<!DOCTYPE html>',
            '<!DOCTYPE html><script>console.log("移动端拦截初始化");</script><script src="/js/mobile-guard.js"></script>'
          );
        }
        // 如果找不到DOCTYPE，尝试在html标签开始处添加
        else if (body.includes('<html')) {
          const htmlTagRegex = /(<html[^>]*>)/i;
          body = body.replace(
            htmlTagRegex,
            '$1<script>console.log("移动端拦截初始化");</script><script src="/js/mobile-guard.js"></script>'
          );
        }
        // 如果找不到html标签，尝试在head标签开始处添加
        else if (body.includes('<head>')) {
          body = body.replace(
            '<head>',
            '<head><script>console.log("移动端拦截初始化");</script><script src="/js/mobile-guard.js"></script>'
          );
        }
        // 最后尝试在body标签开始处添加
        else if (body.includes('<body>')) {
          body = body.replace(
            '<body>',
            '<body><script>console.log("移动端拦截初始化");</script><script src="/js/mobile-guard.js"></script>'
          );
        }
      }
      
      // 添加调试信息，确认脚本已注入
      console.log(`移动端拦截中间件: 已处理响应，URL=${req.originalUrl}, 脚本已注入=${body.includes('mobile-guard.js')}`);
    }
    
    // 调用原始的send方法
    return originalSend.call(this, body);
  };

  next();
}

module.exports = mobileGuardMiddleware; 