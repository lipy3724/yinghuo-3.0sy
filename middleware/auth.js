/**
 * 认证中间件
 */
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../utils/jwt');

/**
 * 验证用户是否已登录
 * 如果请求包含有效的JWT令牌，则将用户信息添加到req.user并继续
 * 否则返回401错误
 */
function requireAuth(req, res, next) {
  try {
    // 从请求头中获取令牌
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      });
    }

    // 提取令牌
    const token = authHeader.split(' ')[1];
    
    // 验证令牌
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 将用户信息添加到请求对象
    req.user = decoded;
    
    // 继续处理请求
    next();
  } catch (error) {
    console.error('认证失败:', error);
    
    // 返回401错误
    return res.status(401).json({
      success: false,
      message: '认证失败，请重新登录'
    });
  }
}

/**
 * 可选认证中间件
 * 如果请求包含有效的JWT令牌，则将用户信息添加到req.user
 * 如果没有令牌或令牌无效，仍然继续处理请求，但req.user将为undefined
 */
function optionalAuth(req, res, next) {
  try {
    // 从请求头中获取令牌
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    // 提取令牌
    const token = authHeader.split(' ')[1];
    
    // 验证令牌
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 将用户信息添加到请求对象
    req.user = decoded;
  } catch (error) {
    // 令牌无效，但不返回错误
    console.warn('可选认证失败:', error);
  }
  
  // 无论认证成功与否，都继续处理请求
  next();
}

/**
 * 检查用户是否为管理员
 * 必须在requireAuth之后使用
 */
function checkAdmin(req, res, next) {
  // 确保用户已经通过认证
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '未认证的请求'
    });
  }
  
  // 检查用户是否为管理员
  if (!req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: '没有管理员权限'
    });
  }
  
  // 用户是管理员，继续处理请求
  next();
}

/**
 * 检查用户是否为客服
 * 必须在requireAuth之后使用
 */
function checkCustomerService(req, res, next) {
  // 确保用户已经通过认证
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '未认证的请求'
    });
  }
  
  // 检查用户是否为客服或管理员
  if (!req.user.isCustomerService && !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: '没有客服权限'
    });
  }
  
  // 用户是客服或管理员，继续处理请求
  next();
}

// 导出中间件
module.exports = {
  requireAuth,
  optionalAuth,
  protect: requireAuth, // 添加别名，兼容现有代码
  checkAdmin,
  checkCustomerService
};