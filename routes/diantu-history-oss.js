const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { client } = require('../utils/ossService');

/**
 * @route   GET /api/diantu-history/list
 * @desc    获取垫图历史记录列表
 * @access  Private
 */
router.get('/list', protect, async (req, res) => {
  console.log('收到垫图历史记录请求，路径:', req.originalUrl);
  console.log('认证用户ID:', req.user ? req.user.id : '未认证');
  try {
    const userId = req.user.id;
    
    console.log(`获取用户 ${userId} 的垫图历史记录`);
    
    // 从OSS获取历史记录
    const records = await loadHistoryFromOSS(userId);
    
    // 按时间降序排序
    const sortedRecords = records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // 返回最新的10条记录
    const limitedRecords = sortedRecords.slice(0, 10);
    
    // 为每条记录添加时间显示格式
    limitedRecords.forEach(record => {
      const date = new Date(record.timestamp);
      record.timeDisplay = formatDate(date);
    });
    
    console.log(`返回 ${limitedRecords.length} 条垫图历史记录给用户 ${userId}`);
    
    res.json({
      success: true,
      records: limitedRecords
    });
  } catch (error) {
    console.error('获取垫图历史记录失败:', error);
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    // 即使出错也返回空数组，让前端可以正常处理
    res.json({
      success: true,
      records: [],
      message: '历史记录加载失败，请稍后重试'
    });
  }
});

/**
 * @route   POST /api/diantu-history/save
 * @desc    保存垫图历史记录
 * @access  Private
 */
router.post('/save', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { originalImage, resultImage, prompt, metadata, taskId } = req.body;
    
    if (!resultImage) {
      return res.status(400).json({
        success: false,
        message: '缺少结果图片'
      });
    }
    
    // 创建历史记录对象
    const historyRecord = {
      id: generateId(),
      userId,
      taskId: taskId || generateId(),
      originalImage: originalImage || '',
      resultImage,
      prompt: prompt || '',
      metadata: metadata || {},
      timestamp: new Date().toISOString()
    };
    
    // 保存到OSS
    await saveHistoryToOSS(userId, historyRecord);
    
    res.json({
      success: true,
      message: '垫图历史记录已保存',
      record: historyRecord
    });
  } catch (error) {
    console.error('保存垫图历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: '保存历史记录失败: ' + error.message
    });
  }
});

/**
 * @route   DELETE /api/diantu-history/clear
 * @desc    清空垫图历史记录
 * @access  Private
 */
router.delete('/clear', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 清空历史记录
    await clearHistoryFromOSS(userId);
    
    res.json({
      success: true,
      message: '垫图历史记录已清空'
    });
  } catch (error) {
    console.error('清空垫图历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: '清空历史记录失败: ' + error.message
    });
  }
});

/**
 * 从OSS加载垫图历史记录
 * @param {string} userId 用户ID
 * @returns {Promise<Array>} 历史记录数组
 */
async function loadHistoryFromOSS(userId) {
  try {
    const ossPath = `diantu/history/${userId}/records.json`;
    
    console.log(`从OSS加载垫图历史记录: ${ossPath}`);
    console.log('OSS客户端配置:', {
      region: client.options.region,
      bucket: client.options.bucket,
      endpoint: client.options.endpoint,
      secure: client.options.secure
    });
    
    // 检查OSS客户端是否可用
    if (!client) {
      console.warn('OSS客户端不可用，返回空数组');
      return [];
    }
    
    // 尝试从OSS获取历史记录
    try {
      const result = await client.get(ossPath);
      const content = result.content.toString();
      let records = [];
      
      try {
        records = JSON.parse(content);
        
        // 确保records是数组
        if (!Array.isArray(records)) {
          console.warn('OSS中的垫图历史记录不是数组格式，转换为空数组');
          records = [];
        }
      } catch (parseError) {
        console.error('解析OSS垫图历史记录JSON失败:', parseError);
        records = [];
      }
      
      console.log(`从OSS加载到 ${records.length} 条垫图历史记录`);
      
      // 验证记录格式
      const validRecords = records.filter(record => {
        return record && 
               typeof record === 'object' && 
               !Array.isArray(record) &&
               record.resultImage &&
               record.timestamp;
      });
      
      console.log(`验证后有效垫图记录 ${validRecords.length} 条`);
      return validRecords;
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        console.log('OSS中不存在垫图历史记录文件，返回空数组');
        return [];
      }
      console.error('OSS获取垫图历史记录失败:', error);
      return [];
    }
  } catch (error) {
    console.error('从OSS加载垫图历史记录失败:', error);
    return [];
  }
}

/**
 * 保存垫图历史记录到OSS
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
    
    // 只保留最新的20条记录
    const limitedRecords = existingRecords.slice(0, 20);
    
    // 保存到OSS
    const ossPath = `diantu/history/${userId}/records.json`;
    const content = JSON.stringify(limitedRecords);
    
    await client.put(ossPath, Buffer.from(content), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`垫图历史记录已保存到OSS: ${ossPath}`);
  } catch (error) {
    console.error('保存垫图历史记录到OSS失败:', error);
    throw error;
  }
}

/**
 * 从OSS删除垫图历史记录
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
    const ossPath = `diantu/history/${userId}/records.json`;
    const content = JSON.stringify(existingRecords);
    
    await client.put(ossPath, Buffer.from(content), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`已从OSS删除垫图历史记录: ${historyId}`);
    return true;
  } catch (error) {
    console.error('从OSS删除垫图历史记录失败:', error);
    throw error;
  }
}

/**
 * 清空OSS中的垫图历史记录
 * @param {string} userId 用户ID
 * @returns {Promise<void>}
 */
async function clearHistoryFromOSS(userId) {
  try {
    // 保存空数组到OSS
    const ossPath = `diantu/history/${userId}/records.json`;
    const content = JSON.stringify([]);
    
    await client.put(ossPath, Buffer.from(content), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`已清空OSS中的垫图历史记录: ${ossPath}`);
  } catch (error) {
    console.error('清空OSS中的垫图历史记录失败:', error);
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

// 添加测试路由，用于验证路由是否正常工作
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: '垫图历史记录API测试成功',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /api/diantu-history/list - 获取历史记录列表（需要认证）',
      'POST /api/diantu-history/save - 保存历史记录（需要认证）', 
      'DELETE /api/diantu-history/clear - 清空历史记录（需要认证）',
      'GET /api/diantu-history/test - 测试API连通性（无需认证）'
    ]
  });
});

module.exports = router;
