/**
 * 客服系统认证问题快速修复脚本
 */

require('dotenv').config();
const User = require('./models/User');
const UserSession = require('./models/UserSession');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./utils/jwt');
const { Op } = require('sequelize');

// JWT过期时间设置为30天
const JWT_EXPIRE = 60 * 60 * 24 * 30;

async function main() {
  try {
    console.log('开始修复客服系统认证问题...');
    
    // 1. 查找所有管理员和客服账号
    const users = await User.findAll({
      where: {
        [Op.or]: [
          { isAdmin: true },
          { isCustomerService: true }
        ]
      }
    });
    
    console.log(`找到 ${users.length} 个管理员和客服账号`);
    
    // 2. 为每个账号创建新的会话
    for (const user of users) {
      console.log(`处理用户: ${user.username} (ID: ${user.id})`);
      
      // 创建JWT payload
      const payload = {
        id: user.id,
        isAdmin: user.isAdmin
      };
      
      // 生成新的JWT令牌
      const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRE
      });
      
      // 计算过期时间
      const expiresAt = new Date();
      expiresAt.setTime(expiresAt.getTime() + JWT_EXPIRE * 1000);
      
      // 创建新的会话记录
      await UserSession.create({
        userId: user.id,
        token: token,
        deviceInfo: 'System Generated',
        ipAddress: '127.0.0.1',
        userAgent: 'Fix Auth Script',
        isActive: true,
        sessionType: user.isAdmin ? 'admin' : 'user',
        expiresAt: expiresAt,
        lastActiveAt: new Date()
      });
      
      console.log(`✅ 已为用户 ${user.username} 创建新的会话，令牌: ${token.substring(0, 20)}...`);
    }
    
    console.log('✅ 修复完成!');
    console.log('请使用以下步骤登录客服系统:');
    console.log('1. 清除浏览器localStorage (在开发者工具中)');
    console.log('2. 访问 /adminkefu-login.html');
    console.log('3. 使用管理员或客服账号登录');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(1);
  }
}

main(); 