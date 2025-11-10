/**
 * 清除所有客服分配记录和聊天消息的脚本
 */

// 导入必要的模块
require('dotenv').config();
const sequelize = require('./config/db');
const CustomerMessage = require('./models/CustomerMessage');
const CustomerAssignment = require('./models/CustomerAssignment');

async function clearCustomerServiceData() {
  try {
    console.log('开始清除客服系统数据...');
    
    // 清除客服分配记录
    console.log('正在清除客服分配记录...');
    const deletedAssignments = await CustomerAssignment.destroy({
      where: {},
      truncate: true // 使用truncate选项可以更快速地清空表
    });
    console.log(`✅ 已清除所有客服分配记录: ${deletedAssignments} 条记录被删除`);
    
    // 清除聊天记录
    console.log('正在清除客服聊天记录...');
    const deletedMessages = await CustomerMessage.destroy({
      where: {},
      truncate: true // 使用truncate选项可以更快速地清空表
    });
    console.log(`✅ 已清除所有客服聊天记录: ${deletedMessages} 条记录被删除`);
    
    console.log('✅ 客服系统数据清除完成!');
    
    // 关闭数据库连接
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ 清除客服数据失败:', error);
    process.exit(1);
  }
}

// 执行清除操作
clearCustomerServiceData(); 