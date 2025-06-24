const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

// 定义客服分配模型
const CustomerAssignment = sequelize.define('CustomerAssignment', {
  // 分配ID - 主键，自动增长
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
    },
    unique: true, // 一个用户只能分配给一个客服
    comment: '被分配的用户ID'
  },
  // 客服ID - 关联到User表
  adminId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: '分配的客服ID'
  },
  // 分配状态
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'transferred'),
    allowNull: false,
    defaultValue: 'active',
    comment: '分配状态：active-活跃，inactive-非活跃，transferred-已转移'
  },
  // 分配时间
  assignedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '分配时间'
  },
  // 最后活跃时间
  lastActiveAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后活跃时间'
  },
  // 分配方式
  assignmentMethod: {
    type: DataTypes.ENUM('auto', 'manual', 'transfer'),
    allowNull: false,
    defaultValue: 'auto',
    comment: '分配方式：auto-自动分配，manual-手动分配，transfer-转移分配'
  },
  // 备注信息
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '分配备注信息'
  }
}, {
  tableName: 'customer_assignments',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['adminId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['assignedAt']
    }
  ]
});

// 定义关联关系
CustomerAssignment.belongsTo(User, {
  as: 'customer',
  foreignKey: 'userId'
});

CustomerAssignment.belongsTo(User, {
  as: 'admin',
  foreignKey: 'adminId'
});

// 实例方法
CustomerAssignment.prototype.updateLastActive = function() {
  this.lastActiveAt = new Date();
  return this.save();
};

CustomerAssignment.prototype.deactivate = function() {
  this.status = 'inactive';
  return this.save();
};

CustomerAssignment.prototype.transfer = function(newAdminId, notes = null) {
  this.adminId = newAdminId;
  this.status = 'transferred';
  this.assignmentMethod = 'transfer';
  if (notes) {
    this.notes = notes;
  }
  return this.save();
};

// 静态方法
CustomerAssignment.findByUserId = function(userId) {
  return this.findOne({
    where: { 
      userId: userId,
      status: 'active'
    },
    include: [
      {
        model: User,
        as: 'admin',
        attributes: ['id', 'username', 'isAdmin', 'isInternal']
      }
    ]
  });
};

CustomerAssignment.findByAdminId = function(adminId) {
  return this.findAll({
    where: { 
      adminId: adminId,
      status: 'active'
    },
    include: [
      {
        model: User,
        as: 'customer',
        attributes: ['id', 'username', 'phone']
      }
    ]
  });
};

// 获取在线客服列表（有活跃分配的客服）
CustomerAssignment.getActiveAdmins = async function() {
  const assignments = await this.findAll({
    where: { status: 'active' },
    include: [
      {
        model: User,
        as: 'admin',
        attributes: ['id', 'username', 'isAdmin', 'isInternal'],
        where: {
          [require('sequelize').Op.or]: [
            { isAdmin: true },
            { isInternal: true }
          ]
        }
      }
    ],
    group: ['adminId'],
    order: [['assignedAt', 'ASC']]
  });
  
  return assignments.map(assignment => assignment.admin);
};

// 自动分配客服
CustomerAssignment.autoAssignCustomerService = async function(userId) {
  try {
    // 首次分配逻辑
    console.log(`🎯 用户 ${userId} 首次发送消息，开始自动分配客服...`);
    
    // 🔍 检查是否存在任何状态的分配记录（包括inactive）
    const existingAnyAssignment = await this.findOne({
      where: {
        userId: userId
      },
      include: [
        {
          model: User,
          as: 'admin',
          attributes: ['id', 'username', 'isAdmin', 'isInternal']
        }
      ]
    });
    
    if (existingAnyAssignment) {
      console.log(`🔄 发现用户 ${userId} 已有分配记录（状态: ${existingAnyAssignment.status}），检查是否需要重新分配`);
      
      // 检查现有分配是否分配给管理员
      if (existingAnyAssignment.admin && existingAnyAssignment.admin.isAdmin && !existingAnyAssignment.admin.isInternal) {
        console.log(`🔄 现有分配给管理员 ${existingAnyAssignment.admin.username}，需要重新分配给内部用户`);
        
        // 将旧分配标记为非活跃
        await existingAnyAssignment.update({
          status: 'inactive',
          notes: `重新分配给内部用户 - 原分配给管理员 ${existingAnyAssignment.admin.username}`
        });
        
        // 继续执行新分配逻辑（不返回，让代码继续执行到创建新分配）
      } else {
        // 如果记录存在且分配给内部用户，重新激活它
        if (existingAnyAssignment.status !== 'active') {
          await existingAnyAssignment.update({
            status: 'active',
            assignmentMethod: 'auto',
            assignedAt: new Date(),
            lastActiveAt: new Date(),
            notes: `重新激活分配给客服 ${existingAnyAssignment.admin.username}`
          });
          
          console.log(`✅ 用户 ${userId} 的分配已重新激活，分配给客服 ${existingAnyAssignment.admin.username}`);
          return existingAnyAssignment;
        } else {
          // 如果已经是活跃状态，更新活跃时间
          await existingAnyAssignment.updateLastActive();
          console.log(`✅ 用户 ${userId} 分配已存在且活跃，更新活跃时间`);
          return existingAnyAssignment;
        }
      }
    }
    
    // 只获取内部用户作为可用客服
    const availableAdmins = await User.findAll({
      where: {
        isInternal: true
      },
      attributes: ['id', 'username', 'isAdmin', 'isInternal']
    });
    
    if (availableAdmins.length === 0) {
      throw new Error('没有可用的内部客服人员');
    }
    
    // 获取每个客服当前的工作负载
    const adminWorkloads = await Promise.all(
      availableAdmins.map(async (admin) => {
        const activeAssignments = await this.count({
          where: {
            adminId: admin.id,
            status: 'active'
          }
        });
        
        return {
          adminId: admin.id,
          admin: admin,
          workload: activeAssignments
        };
      })
    );
    
    // 按工作负载排序，选择负载最少的客服
    adminWorkloads.sort((a, b) => a.workload - b.workload);
    
    // 如果负载相同，随机选择
    const minWorkload = adminWorkloads[0].workload;
    const availableAdminsWithMinWorkload = adminWorkloads.filter(
      item => item.workload === minWorkload
    );
    
    const selectedAdmin = availableAdminsWithMinWorkload[
      Math.floor(Math.random() * availableAdminsWithMinWorkload.length)
    ];
    
    // 创建分配记录
    const assignment = await this.create({
      userId: userId,
      adminId: selectedAdmin.adminId,
      status: 'active',
      assignmentMethod: 'auto',
      assignedAt: new Date(),
      lastActiveAt: new Date(),
      notes: `自动分配给客服 ${selectedAdmin.admin.username}`
    });
    
    // 加载关联数据
    await assignment.reload({
      include: [
        {
          model: User,
          as: 'admin',
          attributes: ['id', 'username', 'isAdmin', 'isInternal']
        }
      ]
    });
    
    console.log(`🎯 用户 ${userId} 自动分配给客服 ${selectedAdmin.admin.username} (ID: ${selectedAdmin.adminId})`);
    
    return assignment;
    
  } catch (error) {
    console.error('自动分配客服失败:', error);
    throw error;
  }
};

// 🔄 重新分配客服（超时或手动触发）
CustomerAssignment.reassignCustomerService = async function(userId, reason = '重新分配') {
  try {
    // 只获取内部用户作为可用客服
    const availableAdmins = await User.findAll({
      where: {
        isInternal: true
      },
      attributes: ['id', 'username', 'isAdmin', 'isInternal']
    });
    
    if (availableAdmins.length === 0) {
      throw new Error('没有可用的内部客服人员进行重新分配');
    }
    
    // 获取每个客服当前的工作负载
    const adminWorkloads = await Promise.all(
      availableAdmins.map(async (admin) => {
        const activeAssignments = await this.count({
          where: {
            adminId: admin.id,
            status: 'active'
          }
        });
        
        return {
          adminId: admin.id,
          admin: admin,
          workload: activeAssignments
        };
      })
    );
    
    // 按工作负载排序，选择负载最少的客服
    adminWorkloads.sort((a, b) => a.workload - b.workload);
    
    // 如果负载相同，随机选择
    const minWorkload = adminWorkloads[0].workload;
    const availableAdminsWithMinWorkload = adminWorkloads.filter(
      item => item.workload === minWorkload
    );
    
    const selectedAdmin = availableAdminsWithMinWorkload[
      Math.floor(Math.random() * availableAdminsWithMinWorkload.length)
    ];
    
    // 创建新的分配记录
    const newAssignment = await this.create({
      userId: userId,
      adminId: selectedAdmin.adminId,
      status: 'active',
      assignmentMethod: 'auto',
      assignedAt: new Date(),
      lastActiveAt: new Date(),
      notes: `${reason} - 重新分配给客服 ${selectedAdmin.admin.username}`
    });
    
    // 加载关联数据
    await newAssignment.reload({
      include: [
        {
          model: User,
          as: 'admin',
          attributes: ['id', 'username', 'isAdmin', 'isInternal']
        }
      ]
    });
    
    console.log(`🔄 用户 ${userId} 重新分配给客服 ${selectedAdmin.admin.username} (ID: ${selectedAdmin.adminId}) - 原因: ${reason}`);
    
    return newAssignment;
    
  } catch (error) {
    console.error('重新分配客服失败:', error);
    throw error;
  }
};

// 🕐 批量检查并处理超时的分配
CustomerAssignment.checkAndHandleTimeouts = async function() {
  try {
    const now = new Date();
    const timeoutHours = 12;
    const timeoutThreshold = new Date(now.getTime() - (timeoutHours * 60 * 60 * 1000));
    
    // 查找所有超时的活跃分配
    const timeoutAssignments = await this.findAll({
      where: {
        status: 'active',
        [require('sequelize').Op.or]: [
          {
            lastActiveAt: {
              [require('sequelize').Op.lt]: timeoutThreshold
            }
          },
          {
            lastActiveAt: null,
            assignedAt: {
              [require('sequelize').Op.lt]: timeoutThreshold
            }
          }
        ]
      },
      include: [
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'admin',
          attributes: ['id', 'username']
        }
      ]
    });
    
    if (timeoutAssignments.length > 0) {
      console.log(`⏰ 发现 ${timeoutAssignments.length} 个超时分配，开始处理...`);
      
      // 批量将超时分配标记为非活跃
      await this.update(
        { 
          status: 'inactive',
          notes: `${timeoutHours}小时无活动，自动标记为非活跃`
        },
        {
          where: {
            id: {
              [require('sequelize').Op.in]: timeoutAssignments.map(a => a.id)
            }
          }
        }
      );
      
      console.log(`✅ 已将 ${timeoutAssignments.length} 个超时分配标记为非活跃`);
      
      return timeoutAssignments.length;
    }
    
    return 0;
    
  } catch (error) {
    console.error('检查超时分配失败:', error);
    throw error;
  }
};

module.exports = CustomerAssignment; 