const cron = require('node-cron');
const VideoLogoRemovalService = require('../services/videoLogoRemovalService');

/**
 * 视频去标志任务定时作业
 * 负责处理任务重试、清理过期任务等定时任务
 */
class VideoLogoRemovalJobs {
  
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }
  
  /**
   * 启动所有定时任务
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ 视频去标志定时任务已在运行中');
      return;
    }
    
    console.log('🚀 启动视频去标志定时任务...');
    
    // 任务重试作业 - 每2分钟执行一次
    const retryJob = cron.schedule('*/2 * * * *', async () => {
      try {
        await VideoLogoRemovalService.retryFailedTasks();
      } catch (error) {
        console.error('❌ 任务重试作业执行失败:', error);
      }
    }, {
      scheduled: false,
      name: 'video-logo-removal-retry'
    });
    
    // 清理过期任务作业 - 每10分钟执行一次
    const cleanupJob = cron.schedule('*/10 * * * *', async () => {
      try {
        await VideoLogoRemovalService.cleanupExpiredTasks();
      } catch (error) {
        console.error('❌ 清理过期任务作业执行失败:', error);
      }
    }, {
      scheduled: false,
      name: 'video-logo-removal-cleanup'
    });
    
    // 任务状态同步作业 - 每5分钟执行一次
    const syncJob = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.syncProcessingTasks();
      } catch (error) {
        console.error('❌ 任务状态同步作业执行失败:', error);
      }
    }, {
      scheduled: false,
      name: 'video-logo-removal-sync'
    });
    
    // 统计报告作业 - 每小时执行一次
    const statsJob = cron.schedule('0 * * * *', async () => {
      try {
        await this.generateStatsReport();
      } catch (error) {
        console.error('❌ 统计报告作业执行失败:', error);
      }
    }, {
      scheduled: false,
      name: 'video-logo-removal-stats'
    });
    
    // 存储作业引用
    this.jobs.set('retry', retryJob);
    this.jobs.set('cleanup', cleanupJob);
    this.jobs.set('sync', syncJob);
    this.jobs.set('stats', statsJob);
    
    // 启动所有作业
    this.jobs.forEach((job, name) => {
      job.start();
      console.log(`✅ 启动定时任务: ${name}`);
    });
    
    this.isRunning = true;
    console.log('✅ 所有视频去标志定时任务启动完成');
  }
  
  /**
   * 停止所有定时任务
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ 视频去标志定时任务未在运行');
      return;
    }
    
    console.log('🛑 停止视频去标志定时任务...');
    
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`✅ 停止定时任务: ${name}`);
    });
    
    this.jobs.clear();
    this.isRunning = false;
    console.log('✅ 所有视频去标志定时任务已停止');
  }
  
  /**
   * 同步处理中的任务状态
   */
  async syncProcessingTasks() {
    try {
      console.log('🔄 开始同步处理中的任务状态...');
      
      const { VideoLogoRemovalTask } = require('../models/VideoLogoRemovalTask');
      
      // 查找所有处理中的任务
      const processingTasks = await VideoLogoRemovalTask.findAll({
        where: {
          status: 'processing'
        },
        order: [['createdAt', 'ASC']]
      });
      
      if (processingTasks.length === 0) {
        console.log('✅ 没有处理中的任务需要同步');
        return;
      }
      
      console.log(`📋 找到 ${processingTasks.length} 个处理中的任务`);
      
      for (const task of processingTasks) {
        try {
          // 查询阿里云任务状态
          const result = await VideoLogoRemovalService.queryAliyunTaskResult(task.aliyunTaskId);
          
          if (result.success && result.data?.Data) {
            const aliyunData = result.data.Data;
            
            if (aliyunData.Status === 'PROCESS_SUCCESS') {
              // 任务成功完成
              const resultData = JSON.parse(aliyunData.Result);
              await VideoLogoRemovalService.updateTaskStatus(task.taskId, 'completed', {
                resultVideoUrl: resultData.VideoUrl,
                videoDuration: aliyunData.VideoDuration
              });
              
              console.log(`✅ 任务 ${task.taskId} 同步完成`);
              
            } else if (aliyunData.Status === 'PROCESS_FAIL') {
              // 任务失败
              await VideoLogoRemovalService.updateTaskStatus(task.taskId, 'failed', {
                message: '阿里云处理失败',
                errorDetails: aliyunData
              });
              
              console.log(`❌ 任务 ${task.taskId} 处理失败`);
            }
            // 如果状态是 PROCESSING，继续等待
          } else {
            console.log(`⚠️ 任务 ${task.taskId} 查询状态失败，稍后重试`);
          }
          
        } catch (error) {
          console.error(`❌ 同步任务 ${task.taskId} 时发生错误:`, error);
        }
      }
      
      console.log('✅ 任务状态同步完成');
      
    } catch (error) {
      console.error('❌ 同步处理中的任务状态时发生错误:', error);
    }
  }
  
  /**
   * 生成统计报告
   */
  async generateStatsReport() {
    try {
      console.log('📊 生成视频去标志任务统计报告...');
      
      const stats = await VideoLogoRemovalService.getTaskStats();
      
      console.log('📈 视频去标志任务统计:');
      console.log(`   总任务数: ${stats.total}`);
      console.log(`   处理中: ${stats.processing}`);
      console.log(`   已完成: ${stats.completed}`);
      console.log(`   失败: ${stats.failed}`);
      console.log(`   已取消: ${stats.cancelled}`);
      
      // 计算成功率
      const successRate = stats.total > 0 ? 
        ((stats.completed / (stats.completed + stats.failed)) * 100).toFixed(2) : 0;
      console.log(`   成功率: ${successRate}%`);
      
      // 如果失败任务过多，发出警告
      if (stats.failed > stats.completed && stats.total > 10) {
        console.warn('⚠️ 警告: 失败任务数量超过成功任务，请检查系统状态');
      }
      
    } catch (error) {
      console.error('❌ 生成统计报告时发生错误:', error);
    }
  }
  
  /**
   * 手动触发任务重试
   */
  async triggerRetry() {
    try {
      console.log('🔄 手动触发任务重试...');
      await VideoLogoRemovalService.retryFailedTasks();
      console.log('✅ 手动重试完成');
    } catch (error) {
      console.error('❌ 手动触发重试失败:', error);
      throw error;
    }
  }
  
  /**
   * 手动触发清理过期任务
   */
  async triggerCleanup() {
    try {
      console.log('🧹 手动触发清理过期任务...');
      await VideoLogoRemovalService.cleanupExpiredTasks();
      console.log('✅ 手动清理完成');
    } catch (error) {
      console.error('❌ 手动触发清理失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取作业状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      jobs: Array.from(this.jobs.keys()),
      jobCount: this.jobs.size
    };
  }
}

// 创建单例实例
const videoLogoRemovalJobs = new VideoLogoRemovalJobs();

module.exports = videoLogoRemovalJobs;
