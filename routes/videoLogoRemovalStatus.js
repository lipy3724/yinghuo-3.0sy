/**
 * 视频去标志功能状态查询API
 * 提供定时任务状态、数据库统计等信息
 */

const express = require('express');
const router = express.Router();
const sequelize = require('../config/db');
const { VideoLogoRemovalTask } = require('../models/VideoLogoRemovalTask');
const videoLogoRemovalJobs = require('../jobs/videoLogoRemovalJobs');

/**
 * 获取视频去标志功能完整状态
 * GET /api/video-logo-removal/status
 */
router.get('/status', async (req, res) => {
    try {
        console.log('📊 API请求: 获取视频去标志功能状态');
        
        const status = {
            timestamp: new Date().toISOString(),
            database: {},
            jobs: {},
            tasks: {},
            errors: {}
        };
        
        // 1. 数据库连接状态
        try {
            await sequelize.authenticate();
            status.database.connected = true;
            status.database.message = '数据库连接正常';
        } catch (error) {
            status.database.connected = false;
            status.database.message = `数据库连接失败: ${error.message}`;
        }
        
        // 2. 定时任务状态
        try {
            const jobStatus = videoLogoRemovalJobs.getStatus();
            status.jobs = {
                isRunning: jobStatus.isRunning,
                retryJob: jobStatus.retryJob || false,
                cleanupJob: jobStatus.cleanupJob || false,
                syncJob: jobStatus.syncJob || false,
                statsJob: jobStatus.statsJob || false,
                jobCount: jobStatus.jobCount || 0,
                jobs: jobStatus.jobs || []
            };
        } catch (error) {
            status.jobs = {
                isRunning: false,
                error: error.message
            };
        }
        
        // 3. 任务统计
        try {
            // 按状态统计任务
            const taskStats = await VideoLogoRemovalTask.findAll({
                attributes: [
                    'status',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                group: ['status'],
                raw: true
            });
            
            status.tasks.byStatus = {};
            taskStats.forEach(stat => {
                status.tasks.byStatus[stat.status] = parseInt(stat.count);
            });
            
            // 总任务数
            const totalTasks = await VideoLogoRemovalTask.count();
            status.tasks.total = totalTasks;
            
            // 最近任务
            const recentTasks = await VideoLogoRemovalTask.findAll({
                attributes: ['taskId', 'status', 'message', 'createdAt', 'retryCount'],
                order: [['createdAt', 'DESC']],
                limit: 5,
                raw: true
            });
            status.tasks.recent = recentTasks;
            
        } catch (error) {
            status.tasks.error = error.message;
        }
        
        // 4. 错误统计
        try {
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            // 失败任务总数
            const failedCount = await VideoLogoRemovalTask.count({
                where: { status: 'failed' }
            });
            
            // 重试任务总数
            const retryCount = await VideoLogoRemovalTask.count({
                where: {
                    retryCount: {
                        [sequelize.Op.gt]: 0
                    }
                }
            });
            
            // 24小时内错误数
            const recentErrorCount = await VideoLogoRemovalTask.count({
                where: {
                    status: 'failed',
                    createdAt: {
                        [sequelize.Op.gte]: oneDayAgo
                    }
                }
            });
            
            status.errors = {
                failed: failedCount,
                retry: retryCount,
                recent24h: recentErrorCount
            };
            
        } catch (error) {
            status.errors.error = error.message;
        }
        
        res.json({
            success: true,
            data: status
        });
        
    } catch (error) {
        console.error('❌ 获取视频去标志功能状态失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 获取任务详细信息
 * GET /api/video-logo-removal/tasks/:taskId
 */
router.get('/tasks/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        
        const task = await VideoLogoRemovalTask.findOne({
            where: { taskId }
        });
        
        if (!task) {
            return res.status(404).json({
                success: false,
                error: '任务不存在'
            });
        }
        
        res.json({
            success: true,
            data: task
        });
        
    } catch (error) {
        console.error('❌ 获取任务详情失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 手动触发重试任务
 * POST /api/video-logo-removal/retry
 */
router.post('/retry', async (req, res) => {
    try {
        console.log('🔄 API请求: 手动触发任务重试');
        
        await videoLogoRemovalJobs.triggerRetry();
        
        res.json({
            success: true,
            message: '重试任务已触发'
        });
        
    } catch (error) {
        console.error('❌ 触发重试失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 手动触发清理任务
 * POST /api/video-logo志removal/cleanup
 */
router.post('/cleanup', async (req, res) => {
    try {
        console.log('🧹 API请求: 手动触发清理任务');
        
        await videoLogoRemovalJobs.triggerCleanup();
        
        res.json({
            success: true,
            message: '清理任务已触发'
        });
        
    } catch (error) {
        console.error('❌ 触发清理失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
