const cron = require('node-cron');
const ImageHistory = require('../models/ImageHistory');
const CustomerMessage = require('../models/CustomerMessage');
const { Op } = require('sequelize');

/**
 * 清除过期的下载中心记录
 * 每小时执行一次，清除24小时前的记录
 */
function startCleanupTasks() {
  // 每小时的第0分钟执行清理任务
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('开始执行下载中心过期记录清理任务...');
      
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // 清除过期的下载记录（只清理图片记录，不清理视频记录）
      const deletedCount = await ImageHistory.destroy({
        where: {
          createdAt: {
            [Op.lt]: twentyFourHoursAgo
          },
          type: {
            [Op.and]: [
              { [Op.notLike]: '%VIDEO%' },
              { [Op.notLike]: '%video%' },
              { [Op.notIn]: [
                'TEXT_TO_VIDEO_NO_DOWNLOAD',
                'IMAGE_TO_VIDEO_NO_DOWNLOAD',
                'MULTI_IMAGE_TO_VIDEO_NO_DOWNLOAD',
                'DIGITAL_HUMAN_VIDEO_NO_DOWNLOAD',
                'VIDEO_STYLE_REPAINT_NO_DOWNLOAD',
                'VIDEO_SUBTITLE_REMOVER_NO_DOWNLOAD',
                'text-to-video',
                'image-to-video',
                'multi-image-to-video',
                'video-style-repaint',
                'digital-human-video',
                'video-subtitle-remover'
              ]}
            ]
          }
        }
      });
      
      if (deletedCount > 0) {
        console.log(`✅ 下载中心清理任务完成：已清除 ${deletedCount} 条过期记录`);
      } else {
        console.log('✅ 下载中心清理任务完成：无过期记录需要清除');
      }

      // 清理客服聊天记录
      await cleanupCustomerMessages();
    } catch (error) {
      console.error('❌ 下载中心清理任务失败:', error);
    }
  });
  
  console.log('📅 下载中心定时清理任务已启动 (每小时执行一次，保留最近24小时记录)');
  console.log('📅 客服聊天记录清理任务已启动 (每小时执行一次，保留最近12小时记录)');
}

/**
 * 清理过期的客服聊天记录
 * 使用软删除方式，将超过配置时间的记录标记为已删除
 * @param {number} customHours - 可选的自定义保存小时数
 */
async function cleanupCustomerMessages(customHours) {
  try {
    console.log('开始执行客服聊天记录清理任务...');
    
    // 获取配置的保存时间，默认12小时
    const retentionHours = customHours || 
      parseInt(process.env.CUSTOMER_MESSAGE_RETENTION_HOURS) || 12;
    
    console.log(`客服聊天记录保存时间设置为 ${retentionHours} 小时`);
    
    const cutoffTime = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
    
    // 使用软删除方式清理过期消息
    const [updatedCount] = await CustomerMessage.update(
      {
        isDeleted: true,
        deletedAt: new Date()
      },
      {
        where: {
          createdAt: {
            [Op.lt]: cutoffTime
          },
          isDeleted: false
        }
      }
    );
    
    if (updatedCount > 0) {
      console.log(`✅ 客服聊天记录清理任务完成：已标记 ${updatedCount} 条过期记录为已删除`);
    } else {
      console.log('✅ 客服聊天记录清理任务完成：无过期记录需要清除');
    }
    
    return updatedCount;
  } catch (error) {
    console.error('❌ 客服聊天记录清理任务失败:', error);
    return 0;
  }
}

/**
 * 手动执行清理任务
 */
async function manualCleanup() {
  try {
    console.log('开始手动清理过期下载记录...');
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const deletedCount = await ImageHistory.destroy({
      where: {
        createdAt: {
          [Op.lt]: twentyFourHoursAgo
        },
        type: {
          [Op.and]: [
            { [Op.notLike]: '%VIDEO%' },
            { [Op.notLike]: '%video%' },
            { [Op.notIn]: [
              'TEXT_TO_VIDEO_NO_DOWNLOAD',
              'IMAGE_TO_VIDEO_NO_DOWNLOAD',
              'MULTI_IMAGE_TO_VIDEO_NO_DOWNLOAD',
              'DIGITAL_HUMAN_VIDEO_NO_DOWNLOAD',
              'VIDEO_STYLE_REPAINT_NO_DOWNLOAD',
              'VIDEO_SUBTITLE_REMOVER_NO_DOWNLOAD',
              'text-to-video',
              'image-to-video',
              'multi-image-to-video',
              'video-style-repaint',
              'digital-human-video',
              'video-subtitle-remover'
            ]}
          ]
        }
      }
    });
    
    console.log(`✅ 手动清理完成：已清除 ${deletedCount} 条过期记录`);
    
    // 同时清理客服聊天记录
    const messageCount = await cleanupCustomerMessages();
    console.log(`✅ 手动清理客服聊天记录完成：已标记 ${messageCount} 条过期记录为已删除`);
    
    return { 
      deletedImageCount: deletedCount,
      deletedMessageCount: messageCount 
    };
  } catch (error) {
    console.error('❌ 手动清理失败:', error);
    throw error;
  }
}

module.exports = {
  startCleanupTasks,
  manualCleanup,
  cleanupCustomerMessages
}; 