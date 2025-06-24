const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

// 定义客户消息模型
const CustomerMessage = sequelize.define('CustomerMessage', {
  // 消息ID - 主键，自动增长
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // 用户ID - 关联到User表
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // 消息内容
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 2000] // 消息长度限制
    }
  },
  // 消息类型：user(用户发送) 或 admin(客服回复)
  type: {
    type: DataTypes.ENUM('user', 'admin'),
    allowNull: false,
    defaultValue: 'user'
  },
  // 消息状态：unread(未读) 或 read(已读)
  status: {
    type: DataTypes.ENUM('unread', 'read'),
    allowNull: false,
    defaultValue: 'unread'
  },
  // 会话ID - 用于分组对话
  sessionId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '会话标识，用于分组对话'
  },
  // 客服ID - 如果是客服回复，记录是哪个客服
  adminId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // 消息来源渠道
  channel: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'web',
    comment: '消息来源：web, mobile, api等'
  },
  // 用户IP地址
  ipAddress: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  // 用户代理信息
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // 附件信息（JSON格式存储）
  attachments: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '附件信息，如图片、文件等'
  },
  // 消息优先级
  priority: {
    type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
    allowNull: false,
    defaultValue: 'normal'
  },
  // 是否已删除（软删除）
  isDeleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  // 删除时间
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // 消息创建时间
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  // 消息更新时间
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'customer_messages',
  timestamps: true,
  paranoid: false, // 不使用paranoid模式，手动实现软删除
  indexes: [
    // 用户ID索引
    {
      fields: ['userId'],
      name: 'customer_messages_user_id'
    },
    // 消息状态索引
    {
      fields: ['status'],
      name: 'customer_messages_status'
    },
    // 消息类型索引
    {
      fields: ['type'],
      name: 'customer_messages_type'
    },
    // 会话ID索引
    {
      fields: ['sessionId'],
      name: 'customer_messages_session_id'
    },
    // 创建时间索引
    {
      fields: ['createdAt'],
      name: 'customer_messages_created_at'
    },
    // 软删除索引
    {
      fields: ['isDeleted'],
      name: 'customer_messages_is_deleted'
    },
    // 复合索引：用户+状态+类型
    {
      fields: ['userId', 'status', 'type'],
      name: 'customer_messages_user_status_type'
    }
  ]
});

// 设置关联关系
CustomerMessage.belongsTo(User, { 
  foreignKey: 'userId', 
  as: 'user',
  onDelete: 'CASCADE'
});

CustomerMessage.belongsTo(User, { 
  foreignKey: 'adminId', 
  as: 'admin',
  onDelete: 'SET NULL'
});

User.hasMany(CustomerMessage, { 
  foreignKey: 'userId', 
  as: 'customerMessages' 
});

// 实例方法
CustomerMessage.prototype.markAsRead = async function() {
  this.status = 'read';
  await this.save();
  return this;
};

CustomerMessage.prototype.softDelete = async function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save();
  return this;
};

// 类方法
CustomerMessage.getUnreadCount = async function(userId) {
  return await this.count({
    where: {
      userId: userId,
      type: 'user',
      status: 'unread',
      isDeleted: false
    }
  });
};

CustomerMessage.getUserMessages = async function(userId, options = {}) {
  const { limit = 50, offset = 0, includeDeleted = false } = options;
  
  const whereCondition = {
    userId: userId
  };
  
  if (!includeDeleted) {
    whereCondition.isDeleted = false;
  }
  
  return await this.findAll({
    where: whereCondition,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'phone']
      },
      {
        model: User,
        as: 'admin',
        attributes: ['id', 'username'],
        required: false
      }
    ],
    order: [['createdAt', 'ASC']],
    limit: limit,
    offset: offset
  });
};

CustomerMessage.getRecentConversations = async function(options = {}) {
  const { limit = 20 } = options;
  
  // 获取每个用户的最新消息
  const latestMessages = await sequelize.query(`
    SELECT cm1.*, u.username, u.phone
    FROM customer_messages cm1
    INNER JOIN users u ON cm1.userId = u.id
    INNER JOIN (
      SELECT userId, MAX(createdAt) as maxDate
      FROM customer_messages
      WHERE isDeleted = false
      GROUP BY userId
    ) cm2 ON cm1.userId = cm2.userId AND cm1.createdAt = cm2.maxDate
    WHERE cm1.isDeleted = false
    ORDER BY cm1.createdAt DESC
    LIMIT ?
  `, {
    replacements: [limit],
    type: sequelize.QueryTypes.SELECT
  });
  
  return latestMessages;
};

module.exports = CustomerMessage; 