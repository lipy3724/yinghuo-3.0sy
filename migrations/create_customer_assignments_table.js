const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

async function up() {
  try {
    console.log('开始创建客服分配表...');
    
    // 创建customer_assignments表
    await sequelize.query(`
      CREATE TABLE customer_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        adminId INT NOT NULL,
        status ENUM('active', 'inactive', 'transferred') NOT NULL DEFAULT 'active' COMMENT '分配状态：active-活跃，inactive-非活跃，transferred-已转移',
        assignedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '分配时间',
        lastActiveAt DATETIME NULL COMMENT '最后活跃时间',
        assignmentMethod ENUM('auto', 'manual', 'transfer') NOT NULL DEFAULT 'auto' COMMENT '分配方式：auto-自动分配，manual-手动分配，transfer-转移分配',
        notes TEXT NULL COMMENT '分配备注信息',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_assignment (userId),
        FOREIGN KEY (userId) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (adminId) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客服分配表'
    `);
    console.log('创建customer_assignments表成功');
    
    // 创建索引
    await sequelize.query(`
      CREATE INDEX idx_customer_assignments_user_id ON customer_assignments (userId)
    `);
    console.log('创建userId索引成功');
    
    await sequelize.query(`
      CREATE INDEX idx_customer_assignments_admin_id ON customer_assignments (adminId)
    `);
    console.log('创建adminId索引成功');
    
    await sequelize.query(`
      CREATE INDEX idx_customer_assignments_status ON customer_assignments (status)
    `);
    console.log('创建status索引成功');
    
    await sequelize.query(`
      CREATE INDEX idx_customer_assignments_assigned_at ON customer_assignments (assignedAt)
    `);
    console.log('创建assignedAt索引成功');
    
    console.log('客服分配表创建完成');
    return true;
  } catch (error) {
    console.error('创建客服分配表失败:', error);
    throw error;
  }
}

async function down() {
  try {
    console.log('开始删除客服分配表...');
    
    await sequelize.query(`DROP TABLE IF EXISTS customer_assignments`);
    
    console.log('客服分配表删除完成');
    return true;
  } catch (error) {
    console.error('删除客服分配表失败:', error);
    throw error;
  }
}

module.exports = { up, down }; 