const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

/**
 * 视频去标志任务模型
 * 用于持久化存储视频去标志任务的状态和详细信息
 */
const VideoLogoRemovalTask = sequelize.define('VideoLogoRemovalTask', {
  // 主键ID
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
      model: 'Users',
      key: 'id'
    }
  },
  
  // 萤火AI任务ID（UUID）
  taskId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '萤火AI系统生成的任务ID'
  },
  
  // 阿里云任务ID（RequestId）
  aliyunTaskId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '阿里云API返回的RequestId'
  },
  
  // 任务状态
  status: {
    type: DataTypes.ENUM('processing', 'completed', 'failed', 'cancelled'),
    allowNull: false,
    defaultValue: 'processing',
    comment: '任务处理状态'
  },
  
  // 输入视频URL
  inputVideoUrl: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: '上传到OSS的原始视频URL'
  },
  
  // 输出视频URL
  resultVideoUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '处理完成后的视频URL'
  },
  
  // 原始文件名
  originalFileName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '用户上传的原始文件名'
  },
  
  // 标志区域坐标（JSON格式）
  logoBoxes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '水印/标志区域坐标，JSON格式存储'
  },
  
  // 积分消费
  creditCost: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '任务消费的积分数量'
  },
  
  // 实际积分消费（任务完成后计算）
  actualCreditCost: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '基于视频时长计算的实际积分消费'
  },
  
  // 是否免费任务
  isFree: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '是否为免费任务'
  },
  
  // 积分是否已处理
  creditProcessed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '积分是否已扣除，防止重复扣费'
  },
  
  // 视频时长（秒）
  videoDuration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '视频时长（秒），用于积分计算'
  },
  
  // 任务消息
  message: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '任务状态消息或错误信息'
  },
  
  // 错误详情（JSON格式）
  errorDetails: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '详细错误信息，JSON格式存储'
  },
  
  // 重试次数
  retryCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '任务重试次数'
  },
  
  // 最大重试次数
  maxRetries: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3,
    comment: '最大重试次数'
  },
  
  // 下次重试时间
  nextRetryAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '下次重试时间'
  },
  
  // 任务开始时间
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '任务开始处理时间'
  },
  
  // 任务完成时间
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '任务完成时间'
  },
  
  // 任务过期时间
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '任务过期时间，超时后自动标记为失败'
  }
}, {
  tableName: 'video_logo_removal_tasks',
  timestamps: true,
  indexes: [
    // 用户ID索引
    {
      fields: ['userId'],
      name: 'video_logo_removal_tasks_user_id'
    },
    // 任务ID唯一索引
    {
      unique: true,
      fields: ['taskId'],
      name: 'video_logo_removal_tasks_task_id'
    },
    // 阿里云任务ID索引
    {
      fields: ['aliyunTaskId'],
      name: 'video_logo_removal_tasks_aliyun_task_id'
    },
    // 状态索引
    {
      fields: ['status'],
      name: 'video_logo_removal_tasks_status'
    },
    // 创建时间索引
    {
      fields: ['createdAt'],
      name: 'video_logo_removal_tasks_created_at'
    },
    // 下次重试时间索引（用于定时任务）
    {
      fields: ['nextRetryAt'],
      name: 'video_logo_removal_tasks_next_retry_at'
    }
  ]
});

// 设置关联关系
const setupAssociations = () => {
  VideoLogoRemovalTask.belongsTo(User, { 
    foreignKey: 'userId', 
    as: 'user' 
  });
  User.hasMany(VideoLogoRemovalTask, { 
    foreignKey: 'userId', 
    as: 'videoLogoRemovalTasks' 
  });
};

// 实例方法：获取标志区域
VideoLogoRemovalTask.prototype.getLogoBoxes = function() {
  if (!this.logoBoxes) return [];
  try {
    return JSON.parse(this.logoBoxes);
  } catch (error) {
    console.error('解析logoBoxes失败:', error);
    return [];
  }
};

// 实例方法：设置标志区域
VideoLogoRemovalTask.prototype.setLogoBoxes = function(boxes) {
  this.logoBoxes = JSON.stringify(boxes || []);
};

// 实例方法：获取错误详情
VideoLogoRemovalTask.prototype.getErrorDetails = function() {
  if (!this.errorDetails) return null;
  try {
    return JSON.parse(this.errorDetails);
  } catch (error) {
    console.error('解析errorDetails失败:', error);
    return null;
  }
};

// 实例方法：设置错误详情
VideoLogoRemovalTask.prototype.setErrorDetails = function(details) {
  this.errorDetails = JSON.stringify(details || {});
};

// 实例方法：检查是否可以重试
VideoLogoRemovalTask.prototype.canRetry = function() {
  return this.retryCount < this.maxRetries && 
         this.status === 'failed' && 
         (!this.nextRetryAt || new Date() >= this.nextRetryAt);
};

// 实例方法：计算下次重试时间（指数退避）
VideoLogoRemovalTask.prototype.calculateNextRetryTime = function() {
  const baseDelay = 60000; // 1分钟基础延迟
  const exponentialDelay = Math.pow(2, this.retryCount) * baseDelay;
  const maxDelay = 30 * 60 * 1000; // 最大30分钟
  const delay = Math.min(exponentialDelay, maxDelay);
  
  return new Date(Date.now() + delay);
};

// 实例方法：标记任务开始
VideoLogoRemovalTask.prototype.markAsStarted = function() {
  this.status = 'processing';
  this.startedAt = new Date();
  this.expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30分钟后过期
};

// 实例方法：标记任务完成
VideoLogoRemovalTask.prototype.markAsCompleted = function(resultVideoUrl, videoDuration = null) {
  this.status = 'completed';
  this.resultVideoUrl = resultVideoUrl;
  this.completedAt = new Date();
  this.message = '任务完成';
  
  if (videoDuration) {
    this.videoDuration = videoDuration;
    // 计算实际积分消费：5积分/30秒，不满30秒按30秒计算
    const billingUnits = Math.ceil(videoDuration / 30);
    this.actualCreditCost = billingUnits * 5;
  }
};

// 实例方法：标记任务失败
VideoLogoRemovalTask.prototype.markAsFailed = function(message, errorDetails = null) {
  this.status = 'failed';
  this.message = message;
  this.completedAt = new Date();
  
  if (errorDetails) {
    this.setErrorDetails(errorDetails);
  }
  
  // 如果可以重试，设置下次重试时间
  if (this.canRetry()) {
    this.retryCount += 1;
    this.nextRetryAt = this.calculateNextRetryTime();
    console.log(`任务 ${this.taskId} 将在 ${this.nextRetryAt} 进行第 ${this.retryCount} 次重试`);
  }
};

// 静态方法：查找需要重试的任务
VideoLogoRemovalTask.findTasksForRetry = function() {
  return this.findAll({
    where: {
      status: 'failed',
      nextRetryAt: {
        [sequelize.Sequelize.Op.lte]: new Date()
      },
      retryCount: {
        [sequelize.Sequelize.Op.lt]: sequelize.col('maxRetries')
      }
    },
    order: [['nextRetryAt', 'ASC']]
  });
};

// 静态方法：清理过期任务
VideoLogoRemovalTask.cleanupExpiredTasks = function() {
  return this.update(
    { 
      status: 'failed', 
      message: '任务超时',
      completedAt: new Date()
    },
    {
      where: {
        status: 'processing',
        expiresAt: {
          [sequelize.Sequelize.Op.lt]: new Date()
        }
      }
    }
  );
};

module.exports = {
  VideoLogoRemovalTask,
  setupAssociations
};
