/**
 * 图像编辑历史记录路由 - 简化版
 * 用于指令编辑功能的历史记录管理
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadToOSS, deleteFromOSS, listOSSFiles } = require('../api-utils');
const path = require('path');

/**
 * 保存图像编辑历史记录
 * @route   POST /api/image-edit-history-simple/save
 * @access  Private
 */
router.post('/save', protect, async (req, res) => {
    try {
        const { originalImage, resultImage, prompt, function: editFunction, metadata, taskId } = req.body;
        const userId = req.user.id;
        
        console.log('保存图像编辑历史记录，用户ID:', userId);
        console.log('任务ID:', taskId);
        console.log('提示词:', prompt);
        
        if (!originalImage || !resultImage || !prompt) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数'
            });
        }
        
        // 创建历史记录对象
        const historyRecord = {
            id: taskId || Date.now().toString(),
            userId: userId,
            originalImage: originalImage,
            resultImage: resultImage,
            prompt: prompt,
            function: editFunction || 'description_edit',
            metadata: metadata || {},
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        
        // 保存到OSS
        const ossFileName = `image-edit-history/${userId}/${historyRecord.id}.json`;
        const historyData = JSON.stringify(historyRecord, null, 2);
        
        await uploadToOSS(Buffer.from(historyData), ossFileName, 'image-edit-history');
        
        console.log('历史记录已保存到OSS:', ossFileName);
        
        res.json({
            success: true,
            message: '历史记录保存成功',
            recordId: historyRecord.id
        });
        
    } catch (error) {
        console.error('保存历史记录失败:', error);
        res.status(500).json({
            success: false,
            message: '保存历史记录失败: ' + error.message
        });
    }
});

/**
 * 获取图像编辑历史记录列表
 * @route   GET /api/image-edit-history-simple/list
 * @access  Private
 */
router.get('/list', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const { hours = 24, limit = 10 } = req.query;
        
        console.log('获取历史记录，用户ID:', userId, '时间范围:', hours, '小时，限制:', limit, '条');
        
        // 从OSS获取用户的历史记录
        const prefix = `image-edit-history/${userId}/`;
        const files = await listOSSFiles(prefix);
        
        console.log('OSS中找到', files.length, '个历史记录文件');
        
        if (!files || files.length === 0) {
            return res.json({
                success: true,
                records: [],
                total: 0
            });
        }
        
        // 获取文件内容并解析
        const records = [];
        const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
        
        for (const file of files) {
            try {
                // 下载文件内容
                const response = await fetch(file.url);
                const content = await response.text();
                const record = JSON.parse(content);
                
                // 检查时间范围
                const recordTime = new Date(record.timestamp || record.createdAt);
                if (recordTime >= cutoffTime) {
                    records.push(record);
                }
            } catch (parseError) {
                console.error('解析历史记录文件失败:', file.name, parseError);
                continue;
            }
        }
        
        // 按时间倒序排序
        records.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.createdAt).getTime();
            const timeB = new Date(b.timestamp || b.createdAt).getTime();
            return timeB - timeA;
        });
        
        // 限制返回数量
        const limitedRecords = records.slice(0, parseInt(limit));
        
        console.log('返回', limitedRecords.length, '条历史记录');
        
        res.json({
            success: true,
            records: limitedRecords,
            total: records.length
        });
        
    } catch (error) {
        console.error('获取历史记录失败:', error);
        res.status(500).json({
            success: false,
            message: '获取历史记录失败: ' + error.message
        });
    }
});

/**
 * 清空图像编辑历史记录
 * @route   DELETE /api/image-edit-history-simple/clear
 * @access  Private
 */
router.delete('/clear', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        
        console.log('清空历史记录，用户ID:', userId);
        
        // 从OSS获取用户的历史记录文件列表
        const prefix = `image-edit-history/${userId}/`;
        const files = await listOSSFiles(prefix);
        
        console.log('准备删除', files.length, '个历史记录文件');
        
        // 删除所有历史记录文件
        let deletedCount = 0;
        for (const file of files) {
            try {
                await deleteFromOSS(file.name);
                deletedCount++;
            } catch (deleteError) {
                console.error('删除文件失败:', file.name, deleteError);
            }
        }
        
        console.log('成功删除', deletedCount, '个历史记录文件');
        
        res.json({
            success: true,
            message: `已清空 ${deletedCount} 条历史记录`,
            deletedCount: deletedCount
        });
        
    } catch (error) {
        console.error('清空历史记录失败:', error);
        res.status(500).json({
            success: false,
            message: '清空历史记录失败: ' + error.message
        });
    }
});

module.exports = router;




