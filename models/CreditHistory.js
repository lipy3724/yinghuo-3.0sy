const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// 积分使用记录模型
const CreditHistory = sequelize.define('CreditHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '操作类型，如DIGITAL_HUMAN_VIDEO, TEXT_TO_IMAGE等'
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '积分变动数量，正数为增加，负数为减少'
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '操作描述'
  },
  taskId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '关联的任务ID'
  },
  featureName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '功能名称'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'credit_histories',
  timestamps: true
});

module.exports = {
  CreditHistory
};
