/**
 * 定时清理图像上色历史记录脚本
 * 
 * 该脚本用于定时清理超过24小时的图像上色历史记录，只保留每个用户最近24小时内的3条记录
 * 可以通过cron任务定期执行该脚本
 */

const { Op } = require('sequelize');
const ImageColorizationHistory = require('../models/ImageColorizationHistory');
const { deleteColorizationHistoryFromOSS } = require('../utils/imageColorizationOssStorage');
const sequelize = require('../config/db');

// 连接数据库
async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
  } catch (error) {
    console.error('数据库连接失败:', error);
    process.exit(1);
  }
}

// 获取所有用户ID
async function getAllUserIds() {
  try {
    const users = await ImageColorizationHistory.findAll({
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('userId')), 'userId']
      ],
      raw: true
    });
    
    return users.map(user => user.userId);
  } catch (error) {
    console.error('获取用户ID失败:', error);
    return [];
  }
}

// 清理单个用户的历史记录
async function cleanupUserHistory(userId) {
  try {
    console.log(`正在清理用户 ${userId} 的历史记录...`);
    
    // 计算24小时前的时间点
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // 查找该用户24小时内的记录
    const recentRecords = await ImageColorizationHistory.findAll({
      where: {
        userId,
        createdAt: {
          [Op.gte]: yesterday
        }
      },
      order: [['createdAt', 'DESC']],
      limit: 3
    });
    
    // 如果有超过3条记录，只保留最新的3条
    if (recentRecords.length > 3) {
      const recentIds = recentRecords.slice(0, 3).map(record => record.id);
      
      // 查找需要删除的记录（24小时内但不在保留列表中的记录）
      const recordsToDelete = await ImageColorizationHistory.findAll({
        where: {
          userId,
          createdAt: {
            [Op.gte]: yesterday
          },
          id: {
            [Op.notIn]: recentIds
          }
        }
      });
      
      // 删除这些记录
      for (const record of recordsToDelete) {
        if (record.storageType === 'oss') {
          if (record.originalImage) {
            await deleteColorizationHistoryFromOSS(record.originalImage);
          }
          if (record.resultImage) {
            await deleteColorizationHistoryFromOSS(record.resultImage);
          }
        }
        await record.destroy();
      }
      
      console.log(`已删除用户 ${userId} 的 ${recordsToDelete.length} 条24小时内多余记录`);
    }
    
    // 删除24小时前的所有记录
    const oldRecords = await ImageColorizationHistory.findAll({
      where: {
        userId,
        createdAt: {
          [Op.lt]: yesterday
        }
      }
    });
    
    // 删除这些记录
    for (const record of oldRecords) {
      if (record.storageType === 'oss') {
        if (record.originalImage) {
          await deleteColorizationHistoryFromOSS(record.originalImage);
        }
        if (record.resultImage) {
          await deleteColorizationHistoryFromOSS(record.resultImage);
        }
      }
      await record.destroy();
    }
    
    console.log(`已删除用户 ${userId} 的 ${oldRecords.length} 条24小时前的记录`);
    return oldRecords.length + (recentRecords.length > 3 ? recentRecords.length - 3 : 0);
  } catch (error) {
    console.error(`清理用户 ${userId} 的历史记录失败:`, error);
    return 0;
  }
}

// 主函数
async function main() {
  try {
    console.log('开始清理图像上色历史记录...');
    
    // 连接数据库
    await connectDB();
    
    // 获取所有用户ID
    const userIds = await getAllUserIds();
    console.log(`共有 ${userIds.length} 个用户有历史记录`);
    
    // 清理每个用户的历史记录
    let totalDeleted = 0;
    for (const userId of userIds) {
      const deleted = await cleanupUserHistory(userId);
      totalDeleted += deleted;
    }
    
    console.log(`清理完成，共删除 ${totalDeleted} 条记录`);
    process.exit(0);
  } catch (error) {
    console.error('清理历史记录失败:', error);
    process.exit(1);
  }
}

// 执行主函数
main();
