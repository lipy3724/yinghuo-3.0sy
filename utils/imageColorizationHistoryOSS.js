/**
 * 图像上色历史记录OSS版工具函数
 */

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const ImageColorizationHistory = require('../models/ImageColorizationHistory');
const { saveColorizationHistoryToOSS, deleteColorizationHistoryFromOSS } = require('./imageColorizationOssStorage');

/**
 * 保存图像上色历史记录（OSS版）
 * @param {number} userId - 用户ID
 * @param {object} historyItem - 历史记录项
 * @param {string} historyItem.originalImage - 原始图片URL
 * @param {string} historyItem.resultImage - 上色后图片URL
 * @param {string} historyItem.prompt - 使用的提示词
 * @returns {Promise<string>} 记录ID
 */
const saveColorizationHistoryOSS = async (userId, historyItem) => {
  try {
    console.log('开始保存图像上色历史记录到OSS');
    
    // 确保必要的字段存在
    if (!historyItem || !historyItem.resultImage) {
      console.error('保存失败: 结果图片URL不能为空');
      throw new Error('结果图片URL不能为空');
    }

    // 上传图像到OSS并获取OSS URL
    console.log('上传图像到OSS');
    const ossHistoryItem = await saveColorizationHistoryToOSS(userId, historyItem);
    console.log('上传图像到OSS成功');
    
    if (!ossHistoryItem || !ossHistoryItem.resultImage) {
      console.error('保存失败: OSS上传后的结果图片URL为空');
      throw new Error('OSS上传后的结果图片URL为空');
    }
    
    const recordId = uuidv4();
    console.log('生成记录ID:', recordId);
    
    try {
      // 检查OSS URL格式
      let ossOriginalPath = null;
      if (ossHistoryItem.originalImage) {
        try {
          ossOriginalPath = ossHistoryItem.originalImage.includes('aliyuncs.com') ? 
            ossHistoryItem.originalImage.split('/').slice(3).join('/') : 
            null;
        } catch (pathError) {
          console.error('解析原始图像OSS路径失败:', pathError);
          ossOriginalPath = null;
        }
      }
      
      let ossResultPath = null;
      try {
        ossResultPath = ossHistoryItem.resultImage.includes('aliyuncs.com') ? 
          ossHistoryItem.resultImage.split('/').slice(3).join('/') : 
          null;
      } catch (pathError) {
        console.error('解析结果图像OSS路径失败:', pathError);
        ossResultPath = null;
      }
      
      // 保存记录到数据库
      console.log('保存记录到数据库');
      await ImageColorizationHistory.create({
        id: recordId,
        userId: userId,
        originalImage: ossHistoryItem.originalImage || null,
        resultImage: ossHistoryItem.resultImage,
        prompt: ossHistoryItem.prompt || '图像上色',
        storageType: ossResultPath ? 'oss' : 'local',
        ossOriginalPath: ossOriginalPath,
        ossResultPath: ossResultPath
      });
      
      console.log(`已保存用户 ${userId} 的图像上色历史记录到数据库`);
    } catch (dbError) {
      console.error('保存记录到数据库失败:', dbError);
      throw new Error(`保存记录到数据库失败: ${dbError.message}`);
    }
    
    // 清理旧记录，只保留最近24小时内的3条记录
    try {
      console.log('清理旧记录');
      await cleanupOldRecords(userId);
      console.log('清理旧记录完成');
    } catch (cleanupError) {
      console.error('清理旧记录失败:', cleanupError);
      // 不抛出异常，因为主要功能已经完成
    }
    
    return recordId;
  } catch (error) {
    console.error('保存图像上色历史记录到OSS失败:', error);
    throw error;
  }
};

/**
 * 获取图像上色历史记录（OSS版）
 * @param {number} userId - 用户ID
 * @param {object} options - 选项
 * @param {number} options.limit - 限制返回的记录数量
 * @param {boolean} options.last24Hours - 是否只返回最近24小时的记录
 * @returns {Promise<Array>} 历史记录数组
 */
const getColorizationHistoryOSS = async (userId, options = {}) => {
  try {
    const { limit = 3, last24Hours = true } = options;
    
    let whereClause = { 
      userId,
      storageType: 'oss'
    };
    
    // 如果需要过滤最近24小时的记录
    if (last24Hours) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      whereClause.createdAt = {
        [Op.gte]: yesterday
      };
    }
    
    const records = await ImageColorizationHistory.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: limit
    });
    
    if (records.length === 0) {
      console.log(`用户 ${userId} 没有OSS图像上色历史记录`);
      return [];
    }
    
    // 转换为普通对象数组
    const history = records.map(record => record.get({ plain: true }));
    
    console.log(`已获取用户 ${userId} 的 ${history.length} 条OSS图像上色历史记录`);
    return history;
  } catch (error) {
    console.error('获取OSS图像上色历史记录失败:', error);
    throw error;
  }
};

/**
 * 清除用户的所有图像上色历史记录（OSS版）
 * @param {number} userId - 用户ID
 * @returns {Promise<number>} 删除的记录数量
 */
const clearColorizationHistoryOSS = async (userId) => {
  try {
    // 获取所有需要删除的记录
    const records = await ImageColorizationHistory.findAll({
      where: { 
        userId,
        storageType: 'oss'
      }
    });
    
    // 删除OSS中的文件
    for (const record of records) {
      if (record.originalImage) {
        await deleteColorizationHistoryFromOSS(record.originalImage);
      }
      if (record.resultImage) {
        await deleteColorizationHistoryFromOSS(record.resultImage);
      }
    }
    
    // 从数据库中删除记录
    const result = await ImageColorizationHistory.destroy({
      where: { 
        userId,
        storageType: 'oss'
      }
    });
    
    console.log(`已清除用户 ${userId} 的 ${result} 条OSS图像上色历史记录`);
    return result;
  } catch (error) {
    console.error('清除OSS图像上色历史记录失败:', error);
    throw error;
  }
};

/**
 * 清理旧记录，只保留最近24小时内的3条记录
 * @param {number} userId - 用户ID
 * @returns {Promise<number>} 删除的记录数量
 */
const cleanupOldRecords = async (userId) => {
  try {
    // 获取用户的所有OSS记录
    const allRecords = await ImageColorizationHistory.findAll({
      where: { 
        userId,
        storageType: 'oss'
      },
      order: [['createdAt', 'DESC']]
    });
    
    // 如果记录数小于等于3，无需清理
    if (allRecords.length <= 3) {
      return 0;
    }
    
    // 计算24小时前的时间点
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // 筛选出需要保留的记录（最近24小时内的3条记录）
    const recentRecords = allRecords.filter(record => 
      new Date(record.createdAt) >= yesterday
    ).slice(0, 3);
    
    // 筛选出需要删除的记录
    const recordsToDelete = allRecords.filter(record => 
      !recentRecords.some(r => r.id === record.id)
    );
    
    // 删除OSS中的文件和数据库中的记录
    for (const record of recordsToDelete) {
      if (record.originalImage) {
        await deleteColorizationHistoryFromOSS(record.originalImage);
      }
      if (record.resultImage) {
        await deleteColorizationHistoryFromOSS(record.resultImage);
      }
      
      await record.destroy();
    }
    
    console.log(`已清理用户 ${userId} 的 ${recordsToDelete.length} 条旧OSS图像上色历史记录`);
    return recordsToDelete.length;
  } catch (error) {
    console.error('清理旧OSS图像上色历史记录失败:', error);
    throw error;
  }
};

module.exports = {
  saveColorizationHistoryOSS,
  getColorizationHistoryOSS,
  clearColorizationHistoryOSS,
  cleanupOldRecords
};
