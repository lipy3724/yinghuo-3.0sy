/**
 * 图像上色历史记录API路由
 * 参照图像高清放大的存储方式，使用纯OSS存储
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { client } = require('../utils/ossService');

/**
 * @route   GET /api/image-colorization-history/list
 * @desc    获取图像上色历史记录列表
 * @access  Private
 */
router.get('/list', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`获取用户 ${userId} 的图像上色历史记录`);
    
    // 从OSS获取历史记录
    const records = await loadHistoryFromOSS(userId);
    
    // 按时间降序排序
    const sortedRecords = records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // 返回最新的3条记录
    const limitedRecords = sortedRecords.slice(0, 3);
    
    // 为每条记录添加时间显示格式
    limitedRecords.forEach(record => {
      const date = new Date(record.timestamp);
      record.timeDisplay = formatDate(date);
    });
    
    res.json({
      success: true,
      records: limitedRecords
    });
  } catch (error) {
    console.error('获取图像上色历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取历史记录失败: ' + error.message
    });
  }
});

/**
 * @route   POST /api/image-colorization-history/save
 * @desc    保存图像上色历史记录
 * @access  Private
 */
router.post('/save', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { originalImage, resultImage, prompt, metadata } = req.body;
    
    if (!originalImage || !resultImage) {
      return res.status(400).json({
        success: false,
        message: '缺少必要的参数'
      });
    }
    
    // 创建历史记录对象
    const historyRecord = {
      id: generateId(),
      userId,
      originalImage,
      resultImage,
      prompt: prompt || '图像上色',
      metadata: metadata || {},
      timestamp: new Date().toISOString()
    };
    
    // 保存到OSS
    await saveHistoryToOSS(userId, historyRecord);
    
    res.json({
      success: true,
      message: '历史记录已保存',
      record: historyRecord
    });
  } catch (error) {
    console.error('保存图像上色历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: '保存历史记录失败: ' + error.message
    });
  }
});

/**
 * @route   DELETE /api/image-colorization-history/:id
 * @desc    删除图像上色历史记录
 * @access  Private
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const historyId = req.params.id;
    
    // 删除历史记录
    const success = await deleteHistoryFromOSS(userId, historyId);
    
    if (success) {
      res.json({
        success: true,
        message: '历史记录已删除'
      });
    } else {
      res.status(404).json({
        success: false,
        message: '历史记录不存在'
      });
    }
  } catch (error) {
    console.error('删除图像上色历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: '删除历史记录失败: ' + error.message
    });
  }
});

/**
 * @route   POST /api/image-colorization-history/clear
 * @desc    清空图像上色历史记录
 * @access  Private
 */
router.post('/clear', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 清空历史记录
    await clearHistoryFromOSS(userId);
    
    res.json({
      success: true,
      message: '历史记录已清空'
    });
  } catch (error) {
    console.error('清空图像上色历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: '清空历史记录失败: ' + error.message
    });
  }
});

/**
 * 从OSS加载历史记录
 * @param {string} userId 用户ID
 * @returns {Promise<Array>} 历史记录数组
 */
async function loadHistoryFromOSS(userId) {
  try {
    const ossPath = `image-colorization/history/${userId}/records.json`;
    
    console.log(`从OSS加载历史记录: ${ossPath}`);
    
    // 尝试从OSS获取历史记录
    try {
      const result = await client.get(ossPath);
      const records = JSON.parse(result.content.toString());
      
      // 过滤掉超过24小时的记录
      const now = new Date();
      const filteredRecords = records.filter(record => {
        const recordDate = new Date(record.timestamp);
        const hoursDiff = (now - recordDate) / (1000 * 60 * 60);
        return hoursDiff <= 24; // 只保留24小时内的记录
      });
      
      // 如果过滤后的记录数量少于原始记录数量，自动保存过滤后的记录
      if (filteredRecords.length < records.length) {
        console.log(`过滤掉 ${records.length - filteredRecords.length} 条超过24小时的历史记录`);
        // 异步保存过滤后的记录，不等待完成
        saveFilteredRecordsToOSS(userId, filteredRecords).catch(err => {
          console.error('保存过滤后的历史记录失败:', err);
        });
      }
      
      console.log(`从OSS加载到 ${filteredRecords.length} 条有效历史记录（24小时内）`);
      return filteredRecords;
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        console.log('OSS中不存在历史记录文件，返回空数组');
        return [];
      }
      throw error;
    }
  } catch (error) {
    console.error('从OSS加载历史记录失败:', error);
    throw error;
  }
}

/**
 * 保存过滤后的历史记录到OSS
 * @param {string} userId 用户ID
 * @param {Array} records 过滤后的历史记录
 * @returns {Promise<void>}
 */
async function saveFilteredRecordsToOSS(userId, records) {
  try {
    const ossPath = `image-colorization/history/${userId}/records.json`;
    const content = JSON.stringify(records);
    
    await client.put(ossPath, Buffer.from(content), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`过滤后的历史记录已保存到OSS: ${ossPath}`);
  } catch (error) {
    console.error('保存过滤后的历史记录到OSS失败:', error);
    throw error;
  }
}

/**
 * 保存历史记录到OSS
 * @param {string} userId 用户ID
 * @param {Object} record 历史记录对象
 * @returns {Promise<void>}
 */
async function saveHistoryToOSS(userId, record) {
  try {
    // 先加载现有历史记录
    const existingRecords = await loadHistoryFromOSS(userId);
    
    // 添加新记录
    existingRecords.unshift(record);
    
    // 只保留最新的10条记录
    const limitedRecords = existingRecords.slice(0, 10);
    
    // 保存到OSS
    const ossPath = `image-colorization/history/${userId}/records.json`;
    const content = JSON.stringify(limitedRecords);
    
    await client.put(ossPath, Buffer.from(content), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`历史记录已保存到OSS: ${ossPath}`);
  } catch (error) {
    console.error('保存历史记录到OSS失败:', error);
    throw error;
  }
}

/**
 * 从OSS删除历史记录
 * @param {string} userId 用户ID
 * @param {string} historyId 历史记录ID
 * @returns {Promise<boolean>} 是否删除成功
 */
async function deleteHistoryFromOSS(userId, historyId) {
  try {
    // 先加载现有历史记录
    const existingRecords = await loadHistoryFromOSS(userId);
    
    // 查找要删除的记录索引
    const index = existingRecords.findIndex(record => record.id === historyId);
    
    if (index === -1) {
      return false;
    }
    
    // 删除记录
    existingRecords.splice(index, 1);
    
    // 保存更新后的历史记录
    const ossPath = `image-colorization/history/${userId}/records.json`;
    const content = JSON.stringify(existingRecords);
    
    await client.put(ossPath, Buffer.from(content), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`已从OSS删除历史记录: ${historyId}`);
    return true;
  } catch (error) {
    console.error('从OSS删除历史记录失败:', error);
    throw error;
  }
}

/**
 * 清空OSS中的历史记录
 * @param {string} userId 用户ID
 * @returns {Promise<void>}
 */
async function clearHistoryFromOSS(userId) {
  try {
    // 保存空数组到OSS
    const ossPath = `image-colorization/history/${userId}/records.json`;
    const content = JSON.stringify([]);
    
    await client.put(ossPath, Buffer.from(content), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`已清空OSS中的历史记录: ${ossPath}`);
  } catch (error) {
    console.error('清空OSS中的历史记录失败:', error);
    throw error;
  }
}

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * 格式化日期为"YYYY-MM-DD HH:mm"格式
 * @param {Date} date 日期对象
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

module.exports = router;