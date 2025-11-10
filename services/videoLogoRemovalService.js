const { VideoLogoRemovalTask } = require('../models/VideoLogoRemovalTask');
const { FeatureUsage } = require('../models/FeatureUsage');
const { saveTaskDetails } = require('../middleware/unifiedFeatureUsage');
const axios = require('axios');

/**
 * 视频去标志任务管理服务
 * 提供任务的创建、查询、更新和重试功能
 */
class VideoLogoRemovalService {
  
  /**
   * 创建新任务
   */
  static async createTask(taskData) {
    try {
      console.log('📝 创建视频去标志任务:', taskData);
      
      const task = await VideoLogoRemovalTask.create({
        userId: taskData.userId,
        taskId: taskData.taskId,
        aliyunTaskId: taskData.aliyunTaskId,
        inputVideoUrl: taskData.inputVideoUrl,
        originalFileName: taskData.originalFileName,
        creditCost: taskData.creditCost || 0,
        isFree: taskData.isFree || false
      });
      
      // 设置标志区域
      if (taskData.logoBoxes) {
        task.setLogoBoxes(taskData.logoBoxes);
        await task.save();
      }
      
      // 标记任务开始
      task.markAsStarted();
      await task.save();
      
      console.log('✅ 任务创建成功:', task.taskId);
      return task;
      
    } catch (error) {
      console.error('❌ 创建任务失败:', error);
      throw error;
    }
  }
  
  /**
   * 根据任务ID查询任务
   */
  static async getTaskById(taskId) {
    try {
      const task = await VideoLogoRemovalTask.findOne({
        where: { taskId }
      });
      
      if (!task) {
        throw new Error('任务不存在');
      }
      
      return task;
    } catch (error) {
      console.error('❌ 查询任务失败:', error);
      throw error;
    }
  }
  
  /**
   * 根据用户ID查询任务历史
   */
  static async getUserTasks(userId, limit = 20, offset = 0) {
    try {
      const { count, rows } = await VideoLogoRemovalTask.findAndCountAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });
      
      return {
        tasks: rows,
        total: count,
        hasMore: offset + limit < count
      };
    } catch (error) {
      console.error('❌ 查询用户任务历史失败:', error);
      throw error;
    }
  }
  
  /**
   * 更新任务状态
   */
  static async updateTaskStatus(taskId, status, data = {}) {
    try {
      const task = await this.getTaskById(taskId);
      
      switch (status) {
        case 'completed':
          task.markAsCompleted(data.resultVideoUrl, data.videoDuration);
          
          // 处理积分扣除
          if (!task.creditProcessed && !task.isFree) {
            await this.processCredits(task);
          }
          break;
          
        case 'failed':
          task.markAsFailed(data.message, data.errorDetails);
          break;
          
        case 'cancelled':
          task.status = 'cancelled';
          task.message = data.message || '任务已取消';
          task.completedAt = new Date();
          break;
      }
      
      await task.save();
      console.log(`✅ 任务 ${taskId} 状态更新为: ${status}`);
      
      return task;
    } catch (error) {
      console.error('❌ 更新任务状态失败:', error);
      throw error;
    }
  }
  
  /**
   * 处理积分扣除
   */
  static async processCredits(task) {
    try {
      if (task.creditProcessed || task.isFree) {
        return;
      }
      
      const videoDuration = task.videoDuration || 30; // 默认30秒
      const billingUnits = Math.ceil(videoDuration / 30);
      const totalCredits = billingUnits * 5;
      
      console.log(`💰 处理积分扣除: 任务=${task.taskId}, 时长=${videoDuration}秒, 积分=${totalCredits}`);
      
      // 查找功能使用记录
      const featureUsage = await FeatureUsage.findOne({
        where: { 
          userId: task.userId, 
          featureName: 'VIDEO_LOGO_REMOVAL' 
        }
      });
      
      if (featureUsage) {
        await saveTaskDetails(featureUsage, {
          taskId: task.taskId,
          status: 'completed',
          featureName: 'VIDEO_LOGO_REMOVAL',
          creditCost: totalCredits,
          isFree: false,
          extraData: {
            videoDuration: videoDuration,
            billingUnits: billingUnits,
            resultVideoUrl: task.resultVideoUrl,
            aliyunTaskId: task.aliyunTaskId
          }
        });
        
        // 更新任务积分信息
        task.actualCreditCost = totalCredits;
        task.creditProcessed = true;
        await task.save();
        
        console.log('✅ 积分扣除成功:', totalCredits);
      }
    } catch (error) {
      console.error('❌ 处理积分扣除失败:', error);
      // 不抛出错误，避免影响任务完成状态
    }
  }
  
  /**
   * 查询阿里云任务结果（带重试机制）
   */
  static async queryAliyunTaskResult(aliyunTaskId, maxRetries = 3) {
    const crypto = require('crypto');
    
    // 阿里云配置
    const ALIYUN_VIAPI_CONFIG = {
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
      endpoint: 'https://videoenhan.cn-shanghai.aliyuncs.com',
      region: 'cn-shanghai'
    };
    
    // 生成签名
    function generateSignature(params, method = 'GET') {
      const commonParams = {
        'Action': 'GetAsyncJobResult',
        'Version': '2020-03-20',
        'AccessKeyId': ALIYUN_VIAPI_CONFIG.accessKeyId,
        'SignatureMethod': 'HMAC-SHA1',
        'Timestamp': new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        'SignatureVersion': '1.0',
        'SignatureNonce': Math.random().toString(36).substring(2, 15),
        'Format': 'JSON',
        ...params
      };
      
      const sortedParams = Object.keys(commonParams).sort().reduce((result, key) => {
        result[key] = commonParams[key];
        return result;
      }, {});
      
      const queryString = Object.keys(sortedParams)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(sortedParams[key])}`)
        .join('&');
      
      const stringToSign = `${method}&${encodeURIComponent('/')}&${encodeURIComponent(queryString)}`;
      
      const signature = crypto
        .createHmac('sha1', ALIYUN_VIAPI_CONFIG.accessKeySecret + '&')
        .update(stringToSign)
        .digest('base64');
      
      return {
        ...sortedParams,
        'Signature': signature
      };
    }
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 查询阿里云任务结果 (第${attempt}次尝试):`, aliyunTaskId);
        
        const apiParams = { JobId: aliyunTaskId };
        const signedParams = generateSignature(apiParams, 'GET');
        
        const queryString = Object.keys(signedParams)
          .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(signedParams[key])}`)
          .join('&');
        
        const requestUrl = `${ALIYUN_VIAPI_CONFIG.endpoint}/?${queryString}`;
        
        const response = await axios.get(requestUrl, {
          timeout: 15000 + (attempt * 5000), // 递增超时时间
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        console.log('✅ 阿里云API响应成功');
        return {
          success: true,
          data: response.data
        };
        
      } catch (error) {
        lastError = error;
        console.error(`❌ 第${attempt}次查询失败:`, error.message);
        
        // 如果是最后一次尝试，或者是不可重试的错误，直接返回
        if (attempt === maxRetries || this.isNonRetryableError(error)) {
          break;
        }
        
        // 等待后重试（指数退避）
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`⏳ ${delay}ms后进行第${attempt + 1}次重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return {
      success: false,
      error: lastError?.message || '查询失败',
      details: lastError?.response?.data
    };
  }
  
  /**
   * 判断是否为不可重试的错误
   */
  static isNonRetryableError(error) {
    if (!error.response) return false;
    
    const status = error.response.status;
    const errorCode = error.response.data?.Code;
    
    // 4xx错误通常不需要重试（除了429）
    if (status >= 400 && status < 500 && status !== 429) {
      return true;
    }
    
    // 特定的阿里云错误码不需要重试
    const nonRetryableCodes = [
      'InvalidParameter',
      'MissingParameter',
      'InvalidAccessKeyId',
      'SignatureDoesNotMatch'
    ];
    
    return nonRetryableCodes.includes(errorCode);
  }
  
  /**
   * 处理任务重试
   */
  static async retryFailedTasks() {
    try {
      console.log('🔄 开始处理失败任务重试...');
      
      const tasksToRetry = await VideoLogoRemovalTask.findTasksForRetry();
      
      if (tasksToRetry.length === 0) {
        console.log('✅ 没有需要重试的任务');
        return;
      }
      
      console.log(`📋 找到 ${tasksToRetry.length} 个需要重试的任务`);
      
      for (const task of tasksToRetry) {
        try {
          console.log(`🔄 重试任务: ${task.taskId} (第${task.retryCount + 1}次)`);
          
          // 查询阿里云任务状态
          const result = await this.queryAliyunTaskResult(task.aliyunTaskId);
          
          if (result.success && result.data?.Data) {
            const aliyunData = result.data.Data;
            
            if (aliyunData.Status === 'PROCESS_SUCCESS') {
              // 任务成功完成
              const resultData = JSON.parse(aliyunData.Result);
              await this.updateTaskStatus(task.taskId, 'completed', {
                resultVideoUrl: resultData.VideoUrl,
                videoDuration: aliyunData.VideoDuration
              });
              
              console.log(`✅ 任务 ${task.taskId} 重试成功`);
              
            } else if (aliyunData.Status === 'PROCESS_FAIL') {
              // 任务失败
              await this.updateTaskStatus(task.taskId, 'failed', {
                message: '阿里云处理失败',
                errorDetails: aliyunData
              });
              
              console.log(`❌ 任务 ${task.taskId} 重试后仍然失败`);
            } else {
              // 任务仍在处理中，重置重试时间
              task.nextRetryAt = task.calculateNextRetryTime();
              await task.save();
              
              console.log(`⏳ 任务 ${task.taskId} 仍在处理中，稍后重试`);
            }
          } else {
            // 查询失败，标记任务失败
            await this.updateTaskStatus(task.taskId, 'failed', {
              message: '查询任务状态失败: ' + result.error,
              errorDetails: result.details
            });
            
            console.log(`❌ 任务 ${task.taskId} 查询失败`);
          }
          
        } catch (error) {
          console.error(`❌ 重试任务 ${task.taskId} 时发生错误:`, error);
          
          // 更新重试信息
          task.retryCount += 1;
          task.nextRetryAt = task.calculateNextRetryTime();
          await task.save();
        }
      }
      
      console.log('✅ 任务重试处理完成');
      
    } catch (error) {
      console.error('❌ 处理任务重试时发生错误:', error);
    }
  }
  
  /**
   * 清理过期任务
   */
  static async cleanupExpiredTasks() {
    try {
      console.log('🧹 开始清理过期任务...');
      
      const [affectedCount] = await VideoLogoRemovalTask.cleanupExpiredTasks();
      
      if (affectedCount > 0) {
        console.log(`✅ 清理了 ${affectedCount} 个过期任务`);
      } else {
        console.log('✅ 没有过期任务需要清理');
      }
      
    } catch (error) {
      console.error('❌ 清理过期任务时发生错误:', error);
    }
  }
  
  /**
   * 获取任务统计信息
   */
  static async getTaskStats(userId = null) {
    try {
      const whereClause = userId ? { userId } : {};
      
      const stats = await VideoLogoRemovalTask.findAll({
        attributes: [
          'status',
          [VideoLogoRemovalTask.sequelize.fn('COUNT', '*'), 'count']
        ],
        where: whereClause,
        group: ['status'],
        raw: true
      });
      
      const result = {
        total: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      };
      
      stats.forEach(stat => {
        result[stat.status] = parseInt(stat.count);
        result.total += parseInt(stat.count);
      });
      
      return result;
    } catch (error) {
      console.error('❌ 获取任务统计信息失败:', error);
      throw error;
    }
  }
}

module.exports = VideoLogoRemovalService;
