const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const { createUnifiedFeatureMiddleware } = require('../middleware/unifiedFeatureUsage');
const { uploadImageToOSS, uploadVideoToOSS, uploadVideoFaceSwapResultToOSS } = require('../utils/ossUtils');
const axios = require('axios');

// 配置multer用于内存存储
const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB限制
        files: 2 // 最多2个文件（1个视频 + 1个图片）
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'video') {
            // 视频文件验证
            const allowedVideoTypes = [
                'video/mp4',           // MP4格式
                'video/avi',           // AVI格式  
                'video/quicktime',     // MOV格式的正确MIME类型
                'video/x-msvideo',     // AVI格式的另一种MIME类型
                'video/x-ms-wmv'       // WMV格式的正确MIME类型
            ];
            if (allowedVideoTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                console.log('🔍 调试 - 上传的视频文件MIME类型:', file.mimetype, '文件名:', file.originalname);
                cb(new Error('只支持MP4、AVI、MOV、WMV格式的视频文件，当前文件类型：' + file.mimetype));
            }
        } else if (file.fieldname === 'image') {
            // 图片文件验证
            const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
            if (allowedImageTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('只支持JPG、JPEG、PNG格式的图片文件'));
            }
        } else {
            cb(new Error('不支持的文件字段'));
        }
    }
});

// 阿里云百练API配置
const ALIYUN_CONFIG = {
    apiKey: process.env.DASHSCOPE_API_KEY || process.env.ALIYUN_API_KEY,
    endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis',
    region: process.env.ALIYUN_REGION || 'cn-beijing'
};

/**
 * @route   POST /api/video-face-swap/create
 * @desc    创建视频换人任务
 * @access  私有
 */
router.post('/create', protect, 
    memoryUpload.fields([
        { name: 'video', maxCount: 1 },
        { name: 'image', maxCount: 1 }
    ]),
    createUnifiedFeatureMiddleware('VIDEO_FACE_SWAP'), 
    async (req, res) => {
    try {
        const userId = req.user.id;
        const { taskId, usageType, creditCost, isFree } = req.featureUsage || {};
        
        console.log('收到视频换人请求:', {
            userId,
            taskId,
            usageType,
            creditCost,
            isFree,
            files: req.files
        });
        
        // 验证文件上传
        if (!req.files || !req.files.video || !req.files.image) {
            return res.status(400).json({
                success: false,
                message: '请同时上传视频文件和人脸图片'
            });
        }
        
        const videoFile = req.files.video[0];
        const imageFile = req.files.image[0];
        
        // 验证文件大小
        if (videoFile.size > 50 * 1024 * 1024) { // 50MB
            return res.status(400).json({
                success: false,
                message: '视频文件大小不能超过50MB'
            });
        }
        
        if (imageFile.size > 10 * 1024 * 1024) { // 10MB
            return res.status(400).json({
                success: false,
                message: '图片文件大小不能超过10MB'
            });
        }
        
        // 上传文件到OSS
        console.log('开始上传文件到OSS...');
        const videoUrl = await uploadVideoToOSS(videoFile);
        const imageUrl = await uploadImageToOSS(imageFile);
        
        console.log('文件上传完成:', { videoUrl, imageUrl });
        
        // 检查API密钥
        if (!ALIYUN_CONFIG.apiKey) {
            return res.status(500).json({
                success: false,
                message: '阿里云API密钥未配置，请联系管理员'
            });
        }
        
        // 获取服务模式（默认标准模式）和视频时长
        const serviceMode = req.body.serviceMode || 'wan-std';
        const videoDuration = parseFloat(req.body.videoDuration) || 1; // 默认1秒
        
        console.log('视频换人参数:', {
            serviceMode,
            videoDuration: videoDuration + '秒',
            creditCost
        });
        
        // 调用阿里云百练视频换人API
        const apiResponse = await callAliyunFaceSwapAPI({
            videoUrl,
            imageUrl,
            taskId,
            serviceMode
        });
        
        if (!apiResponse.success) {
            return res.status(500).json({
                success: false,
                message: apiResponse.message || '视频换人任务创建失败'
            });
        }
        
        // 保存任务信息到OSS
        await saveTaskToOSS(userId, {
            taskId,
            aliyunTaskId: apiResponse.taskId,
            status: 'processing',
            videoUrl,
            imageUrl,
            serviceMode,
            videoDuration,
            createdAt: new Date().toISOString(),
            usageType,
            creditCost,
            isFree
        });
        
        // 返回成功响应
        res.json({
            success: true,
            message: '视频换人任务创建成功',
            data: {
                taskId,
                aliyunTaskId: apiResponse.taskId,
                status: 'processing',
                serviceMode,
                estimatedTime: serviceMode === 'wan-pro' ? '预计需要3-8分钟（高质量模式）' : '预计需要2-5分钟（标准模式）',
                creditCost: isFree ? 0 : creditCost,
                isFree
            }
        });
        
    } catch (error) {
        console.error('视频换人任务创建失败:', error);
        res.status(500).json({
            success: false,
            message: '视频换人任务创建失败',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/video-face-swap/status/:taskId
 * @desc    查询视频换人任务状态
 * @access  私有
 */
router.get('/status/:taskId', protect, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;
        
        console.log('查询视频换人任务状态:', { taskId, userId });
        
        // 从OSS获取任务信息
        const taskInfo = await getTaskFromOSS(userId, taskId);
        
        if (!taskInfo) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 检查任务是否过期（24小时）
        const createdAt = new Date(taskInfo.createdAt);
        const now = new Date();
        const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
        
        if (hoursDiff > 24) {
            taskInfo.status = 'expired';
            taskInfo.expiredAt = new Date().toISOString();
            await saveTaskToOSS(userId, taskInfo);
            
            return res.json({
                success: true,
                data: {
                    ...taskInfo,
                    message: '任务已过期（超过24小时），请重新创建任务'
                }
            });
        }
        
        // 如果任务已完成，直接返回结果
        if (taskInfo.status === 'completed' || taskInfo.status === 'failed' || taskInfo.status === 'expired') {
            return res.json({
                success: true,
                data: taskInfo
            });
        }
        
        // 查询阿里云任务状态
        const aliyunStatus = await queryAliyunTaskStatus(taskInfo.aliyunTaskId);
        
        if (aliyunStatus.success) {
            // 更新任务状态
            taskInfo.status = aliyunStatus.status;
            taskInfo.lastCheckedAt = new Date().toISOString();
            
            if (aliyunStatus.status === 'completed') {
                taskInfo.resultVideoUrl = aliyunStatus.resultVideoUrl;
                taskInfo.completedAt = new Date().toISOString();
                
                // 将结果视频存储到OSS
                try {
                    console.log('开始将视频换人结果存储到OSS...');
                    const ossResultUrl = await uploadVideoFaceSwapResultToOSS(
                        aliyunStatus.resultVideoUrl, 
                        userId, 
                        taskInfo.taskId
                    );
                    taskInfo.ossResultVideoUrl = ossResultUrl;
                    console.log('视频换人结果已存储到OSS:', ossResultUrl);
                } catch (ossError) {
                    console.error('存储视频换人结果到OSS失败:', ossError);
                    // 不抛出错误，保留原始URL作为备用
                    taskInfo.ossError = ossError.message;
                }
                
                // 使用统一的任务完成处理，包括积分扣除
                const { saveTaskDetails } = require('../middleware/unifiedFeatureUsage');
                
                // 确保任务信息包含计费所需的参数
                taskInfo.featureName = 'VIDEO_FACE_SWAP';
                taskInfo.status = 'completed';
                
                // 从OSS任务信息中获取视频时长和服务模式
                if (!taskInfo.videoDuration || !taskInfo.serviceMode) {
                    console.log('从OSS任务信息补充计费参数...');
                    // 如果当前任务信息缺少参数，尝试从OSS获取完整信息
                    // 这里可以添加从OSS获取完整任务信息的逻辑
                }
                
                // 获取用户的功能使用记录
                const { FeatureUsage } = require('../models/FeatureUsage');
                let usage = await FeatureUsage.findOne({
                    where: { userId, featureName: 'VIDEO_FACE_SWAP' }
                });
                
                if (usage) {
                    await saveTaskDetails(usage, taskInfo);
                } else {
                    console.error('未找到用户的视频换人功能使用记录');
                }
            } else if (aliyunStatus.status === 'failed') {
                taskInfo.error = aliyunStatus.error;
                taskInfo.failedAt = new Date().toISOString();
            }
            
            // 更新OSS中的任务信息
            await saveTaskToOSS(userId, taskInfo);
        }
        
        // 计算预估剩余时间
        const estimatedTime = calculateEstimatedTime(taskInfo);
        
        res.json({
            success: true,
            data: {
                ...taskInfo,
                estimatedTime,
                remainingHours: Math.max(0, 24 - hoursDiff).toFixed(1)
            }
        });
        
    } catch (error) {
        console.error('查询视频换人任务状态失败:', error);
        res.status(500).json({
            success: false,
            message: '查询任务状态失败',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/video-face-swap/poll/:taskId
 * @desc    轮询视频换人任务状态（自动轮询接口）
 * @access  私有
 */
router.post('/poll/:taskId', protect, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;
        const { maxAttempts = 120, interval = 5000 } = req.body; // 默认轮询2分钟，每5秒一次
        
        console.log('开始轮询任务状态:', { taskId, userId, maxAttempts, interval });
        
        // 从OSS获取任务信息
        const taskInfo = await getTaskFromOSS(userId, taskId);
        
        if (!taskInfo) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 检查任务是否过期
        const createdAt = new Date(taskInfo.createdAt);
        const now = new Date();
        const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
        
        if (hoursDiff > 24) {
            return res.json({
                success: true,
                data: {
                    ...taskInfo,
                    status: 'expired',
                    message: '任务已过期（超过24小时）'
                }
            });
        }
        
        // 如果任务已经完成，直接返回
        if (taskInfo.status === 'completed' || taskInfo.status === 'failed') {
            return res.json({
                success: true,
                data: taskInfo
            });
        }
        
        // 开始轮询
        let attempts = 0;
        const pollResult = await new Promise((resolve) => {
            const pollInterval = setInterval(async () => {
                attempts++;
                
                try {
                    console.log(`轮询第${attempts}次，任务ID: ${taskId}`);
                    
                    // 查询阿里云任务状态
                    const aliyunStatus = await queryAliyunTaskStatus(taskInfo.aliyunTaskId);
                    
                    if (aliyunStatus.success) {
                        taskInfo.status = aliyunStatus.status;
                        taskInfo.lastCheckedAt = new Date().toISOString();
                        
                        if (aliyunStatus.status === 'completed') {
                            taskInfo.resultVideoUrl = aliyunStatus.resultVideoUrl;
                            taskInfo.completedAt = new Date().toISOString();
                            
                            // 将结果视频存储到OSS
                            try {
                                console.log('轮询中：开始将视频换人结果存储到OSS...');
                                const ossResultUrl = await uploadVideoFaceSwapResultToOSS(
                                    aliyunStatus.resultVideoUrl, 
                                    userId, 
                                    taskInfo.taskId
                                );
                                taskInfo.ossResultVideoUrl = ossResultUrl;
                                console.log('轮询中：视频换人结果已存储到OSS:', ossResultUrl);
                            } catch (ossError) {
                                console.error('轮询中：存储视频换人结果到OSS失败:', ossError);
                                // 不抛出错误，保留原始URL作为备用
                                taskInfo.ossError = ossError.message;
                            }
                            
                            // 使用统一的任务完成处理，包括积分扣除
                            const { saveTaskDetails } = require('../middleware/unifiedFeatureUsage');
                            const { FeatureUsage } = require('../models/FeatureUsage');
                            
                            // 确保任务信息包含计费所需的参数
                            taskInfo.featureName = 'VIDEO_FACE_SWAP';
                            taskInfo.status = 'completed';
                            
                            // 获取用户的功能使用记录
                            let usage = await FeatureUsage.findOne({
                                where: { userId, featureName: 'VIDEO_FACE_SWAP' }
                            });
                            
                            if (usage) {
                                await saveTaskDetails(usage, taskInfo);
                            } else {
                                console.error('未找到用户的视频换人功能使用记录');
                            }
                            
                            await saveTaskToOSS(userId, taskInfo);
                            clearInterval(pollInterval);
                            resolve({ success: true, data: taskInfo });
                            return;
                        } else if (aliyunStatus.status === 'failed') {
                            taskInfo.error = aliyunStatus.error;
                            taskInfo.failedAt = new Date().toISOString();
                            
                            await saveTaskToOSS(userId, taskInfo);
                            clearInterval(pollInterval);
                            resolve({ success: true, data: taskInfo });
                            return;
                        }
                        
                        // 更新处理中的状态
                        await saveTaskToOSS(userId, taskInfo);
                    }
                    
                    // 检查是否超过最大尝试次数
                    if (attempts >= maxAttempts) {
                        clearInterval(pollInterval);
                        resolve({
                            success: true,
                            data: {
                                ...taskInfo,
                                message: `轮询超时，已尝试${attempts}次，请稍后手动查询`
                            }
                        });
                    }
                    
                } catch (error) {
                    console.error(`轮询第${attempts}次失败:`, error);
                    
                    if (attempts >= maxAttempts) {
                        clearInterval(pollInterval);
                        resolve({
                            success: false,
                            message: '轮询过程中发生错误',
                            error: error.message
                        });
                    }
                }
            }, interval);
        });
        
        res.json(pollResult);
        
    } catch (error) {
        console.error('轮询任务状态失败:', error);
        res.status(500).json({
            success: false,
            message: '轮询失败',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/video-face-swap/tasks
 * @desc    获取视频换人任务列表（24小时内最新1条）
 * @access  私有
 */
router.get('/tasks', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        
        console.log(`获取视频换人任务列表: userId=${userId}`);
        
        // 从OSS加载任务列表
        const history = await getTaskHistoryFromOSS(userId, {
            page: 1,
            limit: 1000 // 获取所有任务用于过滤
        });
        
        // 过滤24小时内的任务
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const recentTasks = history.tasks.filter(task => {
            if (!task.createdAt) return false;
            const taskDate = new Date(task.createdAt);
            return taskDate >= twentyFourHoursAgo;
        }).sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        // 只返回最新的1条记录
        const displayTasks = recentTasks.slice(0, 1);
        
        console.log(`过滤后的视频换人任务数量: ${displayTasks.length}`);
        
        // 转换数据格式以匹配前端期望
        const formattedTasks = displayTasks.map(task => ({
            taskId: task.taskId,
            status: mapTaskStatus(task.status),
            serviceMode: task.serviceMode || 'wan-std',
            creditCost: task.creditCost || 8,
            createdAt: task.createdAt,
            completedAt: task.completedAt,
            ossResultVideoUrl: task.ossResultVideoUrl,
            resultVideoUrl: task.resultVideoUrl,
            error: task.error,
            isFree: task.isFree || false
        }));
        
        res.json({
            success: true,
            data: {
                tasks: formattedTasks,
                total: formattedTasks.length,
                page: 1,
                limit: 1,
                totalPages: formattedTasks.length > 0 ? 1 : 0
            }
        });
        
    } catch (error) {
        console.error('获取视频换人任务列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取任务列表失败',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/video-face-swap/history
 * @desc    获取视频换人历史记录
 * @access  私有
 */
router.get('/history', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;
        
        console.log('获取视频换人历史记录:', { userId, page, limit });
        
        // 从OSS获取历史记录
        const history = await getTaskHistoryFromOSS(userId, {
            page: parseInt(page),
            limit: parseInt(limit)
        });
        
        res.json({
            success: true,
            data: history
        });
        
    } catch (error) {
        console.error('获取视频换人历史记录失败:', error);
        res.status(500).json({
            success: false,
            message: '获取历史记录失败',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/video-face-swap/batch-status
 * @desc    批量查询任务状态
 * @access  私有
 */
router.post('/batch-status', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const { taskIds } = req.body;
        
        if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请提供有效的任务ID列表'
            });
        }
        
        console.log('批量查询任务状态:', { userId, taskIds });
        
        const results = [];
        
        for (const taskId of taskIds) {
            try {
                const taskInfo = await getTaskFromOSS(userId, taskId);
                
                if (taskInfo) {
                    // 检查是否需要更新状态
                    if (taskInfo.status === 'processing') {
                        const aliyunStatus = await queryAliyunTaskStatus(taskInfo.aliyunTaskId);
                        
                        if (aliyunStatus.success) {
                            taskInfo.status = aliyunStatus.status;
                            taskInfo.lastCheckedAt = new Date().toISOString();
                            
                            if (aliyunStatus.status === 'completed') {
                                taskInfo.resultVideoUrl = aliyunStatus.resultVideoUrl;
                                taskInfo.completedAt = new Date().toISOString();
                                
                                // 将结果视频存储到OSS
                                try {
                                    console.log('批量查询中：开始将视频换人结果存储到OSS...');
                                    const ossResultUrl = await uploadVideoFaceSwapResultToOSS(
                                        aliyunStatus.resultVideoUrl, 
                                        userId, 
                                        taskInfo.taskId
                                    );
                                    taskInfo.ossResultVideoUrl = ossResultUrl;
                                    console.log('批量查询中：视频换人结果已存储到OSS:', ossResultUrl);
                                } catch (ossError) {
                                    console.error('批量查询中：存储视频换人结果到OSS失败:', ossError);
                                    // 不抛出错误，保留原始URL作为备用
                                    taskInfo.ossError = ossError.message;
                                }
                            } else if (aliyunStatus.status === 'failed') {
                                taskInfo.error = aliyunStatus.error;
                                taskInfo.failedAt = new Date().toISOString();
                            }
                            
                            await saveTaskToOSS(userId, taskInfo);
                        }
                    }
                    
                    results.push({
                        taskId,
                        success: true,
                        data: taskInfo
                    });
                } else {
                    results.push({
                        taskId,
                        success: false,
                        message: '任务不存在'
                    });
                }
            } catch (error) {
                console.error(`查询任务 ${taskId} 失败:`, error);
                results.push({
                    taskId,
                    success: false,
                    message: error.message
                });
            }
        }
        
        res.json({
            success: true,
            data: results
        });
        
    } catch (error) {
        console.error('批量查询任务状态失败:', error);
        res.status(500).json({
            success: false,
            message: '批量查询失败',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/video-face-swap/clear-all-tasks
 * @desc    清空所有视频换人任务记录
 * @access  私有
 */
router.post('/clear-all-tasks', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`[视频换人] 用户 ${userId} 请求清空所有任务记录`);
        
        // 清空用户的视频换人任务记录
        await clearAllTasksFromOSS(userId);
        
        console.log(`[视频换人] 用户 ${userId} 的所有任务记录已清空`);
        
        res.json({
            success: true,
            message: '所有视频换人任务记录已清空'
        });
        
    } catch (error) {
        console.error('清空视频换人任务记录失败:', error);
        res.status(500).json({
            success: false,
            message: '清空任务记录失败',
            error: error.message
        });
    }
});

/**
 * @route   DELETE /api/video-face-swap/tasks/:taskId
 * @desc    删除单个任务记录
 * @access  私有
 */
router.delete('/tasks/:taskId', protect, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;
        
        console.log('删除视频换人任务:', { taskId, userId });
        
        // 从OSS删除任务记录
        const deleted = await deleteTaskFromOSS(userId, taskId);
        
        if (deleted) {
            res.json({
                success: true,
                message: '任务记录已删除'
            });
        } else {
            res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
    } catch (error) {
        console.error('删除任务记录失败:', error);
        res.status(500).json({
            success: false,
            message: '删除失败',
            error: error.message
        });
    }
});

/**
 * @route   DELETE /api/video-face-swap/task/:taskId
 * @desc    删除任务记录（兼容旧接口）
 * @access  私有
 */
router.delete('/task/:taskId', protect, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;
        
        console.log('删除视频换人任务:', { taskId, userId });
        
        // 从OSS删除任务记录
        const deleted = await deleteTaskFromOSS(userId, taskId);
        
        if (deleted) {
            res.json({
                success: true,
                message: '任务记录已删除'
            });
        } else {
            res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
    } catch (error) {
        console.error('删除任务记录失败:', error);
        res.status(500).json({
            success: false,
            message: '删除失败',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/video-face-swap/stats
 * @desc    获取用户视频换人统计信息
 * @access  私有
 */
router.get('/stats', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        
        console.log('获取视频换人统计信息:', { userId });
        
        const stats = await getUserVideoFaceSwapStats(userId);
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('获取统计信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取统计信息失败',
            error: error.message
        });
    }
});

/**
 * 调用阿里云百练视频换人API
 */
async function callAliyunFaceSwapAPI({ videoUrl, imageUrl, taskId, serviceMode = 'wan-std' }) {
    try {
        console.log('调用阿里云百练视频换人API:', { videoUrl, imageUrl, taskId, serviceMode });
        
        const requestData = {
            model: 'wan2.2-animate-mix',
            input: {
                image_url: imageUrl,
                video_url: videoUrl
            },
            parameters: {
                check_image: true,
                mode: serviceMode
            }
        };
        
        const response = await axios.post(ALIYUN_CONFIG.endpoint, requestData, {
            headers: {
                'Authorization': `Bearer ${ALIYUN_CONFIG.apiKey}`,
                'Content-Type': 'application/json',
                'X-DashScope-Async': 'enable' // 启用异步模式
            },
            timeout: 30000 // 30秒超时
        });
        
        console.log('阿里云API响应:', response.data);
        
        if (response.data.output && response.data.output.task_id) {
            return {
                success: true,
                taskId: response.data.output.task_id,
                status: 'processing'
            };
        } else {
            return {
                success: false,
                message: response.data.message || '任务创建失败'
            };
        }
        
    } catch (error) {
        console.error('调用阿里云API失败:', error);
        return {
            success: false,
            message: error.response?.data?.message || error.message || 'API调用失败'
        };
    }
}

/**
 * 映射任务状态以匹配前端期望
 */
function mapTaskStatus(status) {
    const statusMap = {
        'processing': 'RUNNING',
        'completed': 'SUCCEEDED', 
        'failed': 'FAILED',
        'expired': 'FAILED',
        'pending': 'PENDING'
    };
    return statusMap[status] || 'PENDING';
}

/**
 * 计算预估剩余时间
 */
function calculateEstimatedTime(taskInfo) {
    const createdAt = new Date(taskInfo.createdAt);
    const now = new Date();
    const elapsedMinutes = (now - createdAt) / (1000 * 60);
    
    // 根据服务模式估算处理时间
    const estimatedTotalMinutes = taskInfo.serviceMode === 'wan-pro' ? 
        (3 * 60 + 8 * 60) / 2 : // 专业模式：3-8分钟，取平均5.5分钟
        (2 * 60 + 5 * 60) / 2;  // 标准模式：2-5分钟，取平均3.5分钟
    
    const remainingMinutes = Math.max(0, estimatedTotalMinutes - elapsedMinutes);
    
    if (remainingMinutes > 60) {
        return `预计还需 ${Math.ceil(remainingMinutes / 60)} 小时`;
    } else if (remainingMinutes > 1) {
        return `预计还需 ${Math.ceil(remainingMinutes)} 分钟`;
    } else {
        return '即将完成';
    }
}


/**
 * 查询阿里云任务状态
 */
async function queryAliyunTaskStatus(aliyunTaskId) {
    try {
        console.log('查询阿里云任务状态:', aliyunTaskId);
        
        // 使用正确的查询端点
        const queryEndpoint = `https://dashscope.aliyuncs.com/api/v1/tasks/${aliyunTaskId}`;
        
        const response = await axios.get(queryEndpoint, {
            headers: {
                'Authorization': `Bearer ${ALIYUN_CONFIG.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10秒超时
        });
        
        console.log('阿里云状态查询响应:', response.data);
        
        const responseData = response.data;
        
        // 处理不同的响应格式
        let taskStatus = null;
        let output = null;
        
        if (responseData.output) {
            // 标准格式
            output = responseData.output;
            taskStatus = output.task_status;
        } else if (responseData.task_status) {
            // 直接格式
            taskStatus = responseData.task_status;
            output = responseData;
        }
        
        if (taskStatus) {
            let status = 'processing';
            let resultVideoUrl = null;
            let error = null;
            
            if (taskStatus === 'SUCCEEDED') {
                status = 'completed';
                // 检查多种可能的视频URL位置
                resultVideoUrl = output.video_url || 
                               output.result_url || 
                               (output.results && output.results.video_url);
                
                console.log('提取的视频URL:', {
                    video_url: output.video_url,
                    result_url: output.result_url,
                    results_video_url: output.results && output.results.video_url,
                    final_resultVideoUrl: resultVideoUrl
                });
            } else if (taskStatus === 'FAILED') {
                status = 'failed';
                error = output.message || output.error || '任务处理失败';
            } else if (taskStatus === 'RUNNING' || taskStatus === 'PENDING') {
                status = 'processing';
            }
            
            return {
                success: true,
                status,
                resultVideoUrl,
                error,
                taskStatus
            };
        }
        
        return {
            success: false,
            message: '无法获取任务状态',
            responseData
        };
        
    } catch (error) {
        console.error('查询阿里云任务状态失败:', error);
        
        // 提供更详细的错误信息
        let errorMessage = '状态查询失败';
        if (error.response) {
            errorMessage = `API调用失败: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`;
            console.error('API响应错误:', error.response.data);
        } else if (error.request) {
            errorMessage = '网络请求失败，请检查网络连接';
        } else {
            errorMessage = error.message || '未知错误';
        }
        
        return {
            success: false,
            message: errorMessage,
            error: error.response?.data || error.message
        };
    }
}

/**
 * 保存任务到OSS
 */
async function saveTaskToOSS(userId, taskData) {
    try {
        const { getOSSClient } = require('../utils/ossUtils');
        const client = getOSSClient();
        
        const ossKey = `video-face-swap/${userId}/${taskData.taskId}.json`;
        
        await client.put(ossKey, Buffer.from(JSON.stringify(taskData, null, 2)));
        
        console.log('任务信息已保存到OSS:', ossKey);
        
    } catch (error) {
        console.error('保存任务到OSS失败:', error);
        throw error;
    }
}

/**
 * 从OSS获取任务信息
 */
async function getTaskFromOSS(userId, taskId) {
    try {
        const { getOSSClient } = require('../utils/ossUtils');
        const client = getOSSClient();
        
        const ossKey = `video-face-swap/${userId}/${taskId}.json`;
        
        const result = await client.get(ossKey);
        return JSON.parse(result.content.toString());
        
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            return null;
        }
        console.error('从OSS获取任务信息失败:', error);
        throw error;
    }
}

/**
 * 从OSS获取历史记录
 */
async function getTaskHistoryFromOSS(userId, { page = 1, limit = 10 }) {
    try {
        const { getOSSClient } = require('../utils/ossUtils');
        const client = getOSSClient();
        
        const prefix = `video-face-swap/${userId}/`;
        
        const result = await client.list({
            prefix,
            'max-keys': 1000 // 最多获取1000个文件
        });
        
        if (!result.objects || result.objects.length === 0) {
            return {
                tasks: [],
                total: 0,
                page,
                limit,
                totalPages: 0
            };
        }
        
        // 获取所有任务文件
        const taskPromises = result.objects.map(async (obj) => {
            try {
                const taskResult = await client.get(obj.name);
                const taskData = JSON.parse(taskResult.content.toString());
                return taskData;
            } catch (error) {
                console.error('读取任务文件失败:', obj.name, error);
                return null;
            }
        });
        
        const tasks = (await Promise.all(taskPromises))
            .filter(task => task !== null)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // 分页处理
        const total = tasks.length;
        const totalPages = Math.ceil(total / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedTasks = tasks.slice(startIndex, endIndex);
        
        return {
            tasks: paginatedTasks,
            total,
            page,
            limit,
            totalPages
        };
        
    } catch (error) {
        console.error('从OSS获取历史记录失败:', error);
        throw error;
    }
}


/**
 * 从OSS删除任务记录
 */
async function deleteTaskFromOSS(userId, taskId) {
    try {
        const { getOSSClient } = require('../utils/ossUtils');
        const client = getOSSClient();
        
        const ossKey = `video-face-swap/${userId}/${taskId}.json`;
        
        // 检查文件是否存在
        try {
            await client.head(ossKey);
        } catch (error) {
            if (error.code === 'NoSuchKey') {
                return false; // 文件不存在
            }
            throw error;
        }
        
        // 删除文件
        await client.delete(ossKey);
        
        console.log('任务记录已从OSS删除:', ossKey);
        return true;
        
    } catch (error) {
        console.error('从OSS删除任务记录失败:', error);
        throw error;
    }
}

/**
 * 清空用户的所有视频换人任务记录
 */
async function clearAllTasksFromOSS(userId) {
    try {
        const { getOSSClient } = require('../utils/ossUtils');
        const client = getOSSClient();
        
        const prefix = `video-face-swap/${userId}/`;
        
        // 列出所有任务文件
        const result = await client.list({
            prefix,
            'max-keys': 1000
        });
        
        if (!result.objects || result.objects.length === 0) {
            console.log(`用户 ${userId} 没有视频换人任务记录需要清空`);
            return;
        }
        
        // 批量删除所有任务文件
        const deletePromises = result.objects.map(obj => {
            return client.delete(obj.name);
        });
        
        await Promise.all(deletePromises);
        
        console.log(`已清空用户 ${userId} 的 ${result.objects.length} 个视频换人任务记录`);
        
    } catch (error) {
        console.error('清空视频换人任务记录失败:', error);
        throw error;
    }
}

/**
 * 获取用户视频换人统计信息
 */
async function getUserVideoFaceSwapStats(userId) {
    try {
        const { getOSSClient } = require('../utils/ossUtils');
        const client = getOSSClient();
        
        const prefix = `video-face-swap/${userId}/`;
        
        // 列出所有任务文件
        const result = await client.list({
            prefix,
            'max-keys': 1000
        });
        
        if (!result.objects) {
            return {
                totalTasks: 0,
                completedTasks: 0,
                failedTasks: 0,
                processingTasks: 0,
                expiredTasks: 0,
                totalCreditUsed: 0,
                averageProcessingTime: 0,
                successRate: 0
            };
        }
        
        // 统计数据
        let totalTasks = 0;
        let completedTasks = 0;
        let failedTasks = 0;
        let processingTasks = 0;
        let expiredTasks = 0;
        let totalCreditUsed = 0;
        let totalProcessingTime = 0;
        let completedTasksWithTime = 0;
        
        for (const obj of result.objects) {
            try {
                const taskResult = await client.get(obj.name);
                const taskData = JSON.parse(taskResult.content.toString());
                
                totalTasks++;
                
                // 统计状态
                switch (taskData.status) {
                    case 'completed':
                        completedTasks++;
                        
                        // 计算处理时间
                        if (taskData.createdAt && taskData.completedAt) {
                            const processingTime = (new Date(taskData.completedAt) - new Date(taskData.createdAt)) / (1000 * 60); // 分钟
                            totalProcessingTime += processingTime;
                            completedTasksWithTime++;
                        }
                        break;
                    case 'failed':
                        failedTasks++;
                        break;
                    case 'processing':
                        processingTasks++;
                        break;
                    case 'expired':
                        expiredTasks++;
                        break;
                }
                
                // 统计积分使用
                if (taskData.creditCost && !taskData.isFree) {
                    totalCreditUsed += taskData.creditCost;
                }
                
            } catch (error) {
                console.error('解析任务数据失败:', error);
            }
        }
        
        // 计算平均处理时间
        const averageProcessingTime = completedTasksWithTime > 0 ? 
            Math.round(totalProcessingTime / completedTasksWithTime) : 0;
        
        // 计算成功率
        const successRate = totalTasks > 0 ? 
            Math.round((completedTasks / totalTasks) * 100) : 0;
        
        return {
            totalTasks,
            completedTasks,
            failedTasks,
            processingTasks,
            expiredTasks,
            totalCreditUsed,
            averageProcessingTime, // 分钟
            successRate // 百分比
        };
        
    } catch (error) {
        console.error('获取统计信息失败:', error);
        throw error;
    }
}

/**
 * 安全下载代理接口
 * 解决跨域下载安全问题
 */
router.get('/download', protect, async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                message: '缺少下载链接参数'
            });
        }
        
        // 验证URL安全性
        if (!url.startsWith('https://') && !url.startsWith('http://')) {
            return res.status(400).json({
                success: false,
                message: '无效的下载链接'
            });
        }
        
        // 验证是否为OSS链接（可选的安全检查）
        const allowedDomains = [
            'oss-cn-',  // 阿里云OSS
            'cos.',     // 腾讯云COS
            'obs.',     // 华为云OBS
            'localhost', // 本地测试
            '127.0.0.1'  // 本地测试
        ];
        
        const isAllowedDomain = allowedDomains.some(domain => url.includes(domain));
        if (!isAllowedDomain) {
            console.warn('尝试下载非允许域名的文件:', url);
            // 不直接拒绝，但记录日志
        }
        
        console.log('代理下载请求:', url);
        
        // 通过服务器代理下载文件
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 30000, // 30秒超时
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        // 设置响应头
        res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="video-face-swap-${Date.now()}.mp4"`);
        res.setHeader('Content-Length', response.headers['content-length'] || '');
        
        // 添加安全头
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        
        // 流式传输文件
        response.data.pipe(res);
        
        // 处理流错误
        response.data.on('error', (error) => {
            console.error('下载流错误:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: '下载过程中发生错误'
                });
            }
        });
        
    } catch (error) {
        console.error('代理下载失败:', error);
        
        if (!res.headersSent) {
            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                res.status(404).json({
                    success: false,
                    message: '文件不存在或无法访问'
                });
            } else if (error.code === 'ETIMEDOUT') {
                res.status(408).json({
                    success: false,
                    message: '下载超时，请重试'
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: '下载失败: ' + error.message
                });
            }
        }
    }
});

module.exports = router;
