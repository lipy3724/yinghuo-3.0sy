const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * 图像上色历史记录模型
 */
const ImageColorizationHistory = sequelize.define('ImageColorizationHistory', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    comment: 'UUID作为主键'
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '用户ID'
  },
  originalImage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '原始图片URL'
  },
  resultImage: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '上色后图片URL'
  },
  prompt: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '图像上色',
    comment: '使用的提示词'
  },
  storageType: {
    type: DataTypes.ENUM('local', 'oss'),
    allowNull: false,
    defaultValue: 'local',
    comment: '存储类型：local-本地存储，oss-阿里云OSS'
  },
  ossOriginalPath: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'OSS中原始图片的路径'
  },
  ossResultPath: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'OSS中结果图片的路径'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '创建时间'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '更新时间'
  }
}, {
  tableName: 'image_colorization_histories',
  timestamps: true,
  indexes: [
    {
      name: 'idx_image_colorization_histories_user_id',
      fields: ['userId']
    },
    {
      name: 'idx_image_colorization_histories_created_at',
      fields: ['createdAt']
    },
    {
      name: 'idx_image_colorization_histories_storage_type',
      fields: ['storageType']
    }
  ]
});

module.exports = ImageColorizationHistory;
