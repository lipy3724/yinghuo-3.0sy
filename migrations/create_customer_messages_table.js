const { Sequelize } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('customer_messages', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM('user', 'admin'),
        allowNull: false,
        defaultValue: 'user'
      },
      status: {
        type: Sequelize.ENUM('unread', 'read'),
        allowNull: false,
        defaultValue: 'unread'
      },
      sessionId: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: '会话标识，用于分组对话'
      },
      adminId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      channel: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'web',
        comment: '消息来源：web, mobile, api等'
      },
      ipAddress: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      attachments: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: '附件信息，如图片、文件等'
      },
      priority: {
        type: Sequelize.ENUM('low', 'normal', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'normal'
      },
      isDeleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 添加索引
    await queryInterface.addIndex('customer_messages', ['userId'], {
      name: 'customer_messages_user_id'
    });
    
    await queryInterface.addIndex('customer_messages', ['status'], {
      name: 'customer_messages_status'
    });
    
    await queryInterface.addIndex('customer_messages', ['type'], {
      name: 'customer_messages_type'
    });
    
    await queryInterface.addIndex('customer_messages', ['sessionId'], {
      name: 'customer_messages_session_id'
    });
    
    await queryInterface.addIndex('customer_messages', ['createdAt'], {
      name: 'customer_messages_created_at'
    });
    
    await queryInterface.addIndex('customer_messages', ['isDeleted'], {
      name: 'customer_messages_is_deleted'
    });
    
    await queryInterface.addIndex('customer_messages', ['userId', 'status', 'type'], {
      name: 'customer_messages_user_status_type'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // 删除表
    await queryInterface.dropTable('customer_messages');
  }
}; 