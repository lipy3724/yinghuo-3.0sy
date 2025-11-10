const fs = require('fs').promises;
const path = require('path');
const { Sequelize } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('开始迁移JSON消息数据到数据库...');
      
      // 读取JSON文件
      const messagesFilePath = path.join(__dirname, '../kefu/messages.json');
      
      let jsonMessages = [];
      try {
        const data = await fs.readFile(messagesFilePath, 'utf8');
        jsonMessages = JSON.parse(data);
        console.log(`找到 ${jsonMessages.length} 条JSON消息记录`);
      } catch (error) {
        console.log('未找到JSON消息文件或文件为空，跳过迁移');
        return;
      }
      
      if (jsonMessages.length === 0) {
        console.log('JSON消息文件为空，跳过迁移');
        return;
      }
      
      // 处理每条消息
      const migratedMessages = [];
      
      for (const msg of jsonMessages) {
        try {
          // 解析用户ID
          let dbUserId = null;
          
          if (msg.userId) {
            if (msg.userId.toString().startsWith('user_')) {
              // 格式：user_1750644891453_x2oil8615
              const extracted = msg.userId.replace('user_', '').split('_')[0];
              if (!isNaN(extracted)) {
                dbUserId = parseInt(extracted);
              }
            } else if (!isNaN(msg.userId)) {
              // 纯数字ID
              dbUserId = parseInt(msg.userId);
            }
          }
          
          // 如果无法解析用户ID，跳过该消息
          if (!dbUserId) {
            console.log(`跳过无效用户ID的消息: ${msg.userId}`);
            continue;
          }
          
          // 检查用户是否存在
          const userExists = await queryInterface.rawSelect('users', {
            where: { id: dbUserId }
          }, ['id']);
          
          if (!userExists) {
            console.log(`用户ID ${dbUserId} 不存在，跳过消息: ${msg.id}`);
            continue;
          }
          
          // 构建消息数据
          const messageData = {
            userId: dbUserId,
            message: msg.message || '',
            type: msg.type || (msg.isAdmin ? 'admin' : 'user'),
            status: msg.status || 'unread',
            channel: 'web',
            priority: 'normal',
            isDeleted: false,
            createdAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
            updatedAt: msg.timestamp ? new Date(msg.timestamp) : new Date()
          };
          
          migratedMessages.push(messageData);
          
        } catch (error) {
          console.error(`处理消息 ${msg.id} 时出错:`, error);
        }
      }
      
      if (migratedMessages.length > 0) {
        // 批量插入到数据库
        await queryInterface.bulkInsert('customer_messages', migratedMessages);
        console.log(`成功迁移 ${migratedMessages.length} 条消息到数据库`);
        
        // 备份原JSON文件
        const backupPath = messagesFilePath + '.backup.' + Date.now();
        await fs.copyFile(messagesFilePath, backupPath);
        console.log(`原JSON文件已备份到: ${backupPath}`);
        
      } else {
        console.log('没有有效的消息需要迁移');
      }
      
    } catch (error) {
      console.error('迁移过程中出错:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // 回滚时清空customer_messages表
    await queryInterface.bulkDelete('customer_messages', null, {});
    console.log('已清空customer_messages表');
  }
}; 