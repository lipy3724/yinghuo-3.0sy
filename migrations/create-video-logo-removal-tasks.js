'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('video_logo_removal_tasks', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      taskId: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        comment: '萤火AI系统生成的任务ID'
      },
      aliyunTaskId: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: '阿里云API返回的RequestId'
      },
      status: {
        type: Sequelize.ENUM('processing', 'completed', 'failed', 'cancelled'),
        allowNull: false,
        defaultValue: 'processing',
        comment: '任务处理状态'
      },
      inputVideoUrl: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: '上传到OSS的原始视频URL'
      },
      resultVideoUrl: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: '处理完成后的视频URL'
      },
      originalFileName: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: '用户上传的原始文件名'
      },
      logoBoxes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '水印/标志区域坐标，JSON格式存储'
      },
      creditCost: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '任务消费的积分数量'
      },
      actualCreditCost: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '基于视频时长计算的实际积分消费'
      },
      isFree: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: '是否为免费任务'
      },
      creditProcessed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: '积分是否已扣除，防止重复扣费'
      },
      videoDuration: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '视频时长（秒），用于积分计算'
      },
      message: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: '任务状态消息或错误信息'
      },
      errorDetails: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '详细错误信息，JSON格式存储'
      },
      retryCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '任务重试次数'
      },
      maxRetries: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
        comment: '最大重试次数'
      },
      nextRetryAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: '下次重试时间'
      },
      startedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: '任务开始处理时间'
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: '任务完成时间'
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: '任务过期时间，超时后自动标记为失败'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // 创建索引
    await queryInterface.addIndex('video_logo_removal_tasks', ['userId'], {
      name: 'video_logo_removal_tasks_user_id'
    });

    await queryInterface.addIndex('video_logo_removal_tasks', ['taskId'], {
      name: 'video_logo_removal_tasks_task_id',
      unique: true
    });

    await queryInterface.addIndex('video_logo_removal_tasks', ['aliyunTaskId'], {
      name: 'video_logo_removal_tasks_aliyun_task_id'
    });

    await queryInterface.addIndex('video_logo_removal_tasks', ['status'], {
      name: 'video_logo_removal_tasks_status'
    });

    await queryInterface.addIndex('video_logo_removal_tasks', ['createdAt'], {
      name: 'video_logo_removal_tasks_created_at'
    });

    await queryInterface.addIndex('video_logo_removal_tasks', ['nextRetryAt'], {
      name: 'video_logo_removal_tasks_next_retry_at'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('video_logo_removal_tasks');
  }
};
