/**
 * 数据库同步脚本
 * 用于同步数据库表结构，确保字段类型正确
 */

const sequelize = require('../config/db');
const ImageHistory = require('../models/ImageHistory');

async function syncDatabase() {
  try {
    console.log('开始同步数据库表结构...');
    
    // 同步 ImageHistory 表，alter: true 会修改现有表结构
    await ImageHistory.sync({ alter: true });
    console.log('ImageHistory 表同步完成');
    
    // 测试数据库连接
    await sequelize.authenticate();
    console.log('数据库连接测试成功');
    
    console.log('数据库同步完成！');
    process.exit(0);
  } catch (error) {
    console.error('数据库同步失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  syncDatabase();
}

module.exports = { syncDatabase };
