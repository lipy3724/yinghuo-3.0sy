/**
 * 图生视频任务状态自动同步服务
 * 
 * 功能：
 * 1. 定期检查数据库中pending状态的图生视频任务
 * 2. 查询阿里云API获取最新状态
 * 3. 自动更新数据库中的任务状态
 * 4. 处理积分扣除逻辑
 * 
 * 解决问题：
 * - 图生视频任务在阿里云端已完成，但本地数据库状态仍为pending
 * - 用户不主动查询状态时，任务状态永远不会更新
 */

const axios = require('axios');
const { FeatureUsage } = require('../models/FeatureUsage');
const { saveTaskDetails } = require('../middleware/unifiedFeatureUsage');

class TaskStatusSyncService {
    constructor() {
        this.isRunning = false;
        this.syncInterval = null;
        this.syncIntervalMs = 2 * 60 * 1000; // 2分钟检查一次
        this.maxTaskAge = 24 * 60 * 60 * 1000; // 只检查24小时内的任务
        this.batchSize = 10; // 每次最多处理10个任务
    }

    /**
     * 启动任务状态同步服务
     */
    start() {
        if (this.isRunning) {
            console.log('任务状态同步服务已在运行中');
            return;
        }

        console.log('🚀 启动图生视频任务状态自动同步服务');
        this.isRunning = true;

        // 立即执行一次同步
        this.syncPendingTasks().catch(error => {
            console.error('初始任务同步失败:', error);
        });

        // 设置定时同步
        this.syncInterval = setInterval(() => {
            this.syncPendingTasks().catch(error => {
                console.error('定时任务同步失败:', error);
            });
        }, this.syncIntervalMs);

        console.log(`✅ 任务状态同步服务已启动，每${this.syncIntervalMs / 1000}秒检查一次`);
    }

    /**
     * 停止任务状态同步服务
     */
    stop() {
        if (!this.isRunning) {
            console.log('任务状态同步服务未在运行');
            return;
        }

        console.log('🛑 停止图生视频任务状态自动同步服务');
        this.isRunning = false;

        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        console.log('✅ 任务状态同步服务已停止');
    }

    /**
     * 同步所有待处理的任务状态
     */
    async syncPendingTasks() {
        try {
            console.log('🔄 开始检查待同步的图生视频任务...');

            // 获取所有图生视频功能使用记录
            const imageToVideoUsages = await FeatureUsage.findAll({
                where: {
                    featureName: 'image-to-video'
                },
                order: [['updatedAt', 'DESC']]
            });

            if (imageToVideoUsages.length === 0) {
                console.log('📝 没有找到图生视频使用记录');
                return;
            }

            console.log(`📋 找到 ${imageToVideoUsages.length} 个图生视频使用记录`);

            // 收集所有待处理的任务
            const pendingTasks = [];
            const now = new Date();

            for (const usage of imageToVideoUsages) {
                if (!usage.details) continue;

                try {
                    const details = JSON.parse(usage.details);
                    if (!details.tasks || !Array.isArray(details.tasks)) continue;

                    // 查找pending状态的任务
                    for (const task of details.tasks) {
                        if (task.status === 'pending' && task.taskId) {
                            // 检查任务年龄，只处理24小时内的任务
                            const taskTime = new Date(task.timestamp);
                            const taskAge = now - taskTime;

                            if (taskAge <= this.maxTaskAge) {
                                pendingTasks.push({
                                    taskId: task.taskId,
                                    userId: usage.userId,
                                    usage: usage,
                                    task: task,
                                    taskAge: taskAge
                                });
                            } else {
                                console.log(`⏰ 跳过过期任务: ${task.taskId} (${Math.round(taskAge / 1000 / 60 / 60)}小时前)`);
                            }
                        }
                    }
                } catch (parseError) {
                    console.error(`解析用户 ${usage.userId} 的任务详情失败:`, parseError.message);
                }
            }

            if (pendingTasks.length === 0) {
                console.log('✅ 没有找到需要同步的待处理任务');
                return;
            }

            console.log(`🎯 找到 ${pendingTasks.length} 个待处理任务，开始同步...`);

            // 按批次处理任务，避免同时发起太多请求
            const batches = [];
            for (let i = 0; i < pendingTasks.length; i += this.batchSize) {
                batches.push(pendingTasks.slice(i, i + this.batchSize));
            }

            let totalSynced = 0;
            let totalCompleted = 0;
            let totalFailed = 0;

            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];
                console.log(`📦 处理第 ${batchIndex + 1}/${batches.length} 批任务 (${batch.length} 个任务)`);

                // 并行处理当前批次的任务
                const batchPromises = batch.map(taskInfo => this.syncSingleTask(taskInfo));
                const batchResults = await Promise.allSettled(batchPromises);

                // 统计批次结果
                for (const result of batchResults) {
                    if (result.status === 'fulfilled') {
                        totalSynced++;
                        if (result.value === 'completed') {
                            totalCompleted++;
                        } else if (result.value === 'failed') {
                            totalFailed++;
                        }
                    } else {
                        console.error('任务同步失败:', result.reason);
                    }
                }

                // 批次间稍作延迟，避免请求过于频繁
                if (batchIndex < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            console.log(`🎉 任务状态同步完成: 总计${pendingTasks.length}个，已同步${totalSynced}个，完成${totalCompleted}个，失败${totalFailed}个`);

        } catch (error) {
            console.error('❌ 同步待处理任务时发生错误:', error);
        }
    }

    /**
     * 同步单个任务的状态
     * @param {Object} taskInfo - 任务信息对象
     * @returns {Promise<string>} - 返回任务最终状态：'completed', 'failed', 'pending'
     */
    async syncSingleTask(taskInfo) {
        const { taskId, userId, usage, task } = taskInfo;

        try {
            console.log(`🔍 检查任务状态: ${taskId} (用户${userId})`);

            // 查询阿里云API获取最新状态
            const response = await axios.get(
                `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`
                    },
                    timeout: 10000
                }
            );

            const apiStatus = response.data.output?.task_status;
            console.log(`📡 阿里云任务状态: ${taskId} -> ${apiStatus}`);

            // 处理任务完成的情况
            if (apiStatus === 'SUCCEEDED') {
                console.log(`✅ 任务已完成，开始更新数据库: ${taskId}`);

                // 获取任务的免费标记
                const isFree = task.isFree || false;
                const creditCost = isFree ? 0 : 66;

                // 使用统一的saveTaskDetails函数更新任务状态并处理积分扣除
                await saveTaskDetails(usage, {
                    taskId: taskId,
                    featureName: 'image-to-video',
                    status: 'completed',
                    statusCode: 'SUCCEEDED',
                    creditCost: creditCost,
                    isFree: isFree,
                    extraData: {
                        videoUrl: response.data.output.video_url,
                        originalImage: (global.imageToVideoTasks && global.imageToVideoTasks[taskId]) ? global.imageToVideoTasks[taskId].imageUrl : '未知',
                        syncedAt: new Date().toISOString(),
                        syncSource: 'auto-sync-service'
                    },
                    operationText: '图生视频'
                });

                // 更新全局变量（如果存在）
                if (global.imageToVideoTasks && global.imageToVideoTasks[taskId]) {
                    global.imageToVideoTasks[taskId].status = 'SUCCEEDED';
                    global.imageToVideoTasks[taskId].videoUrl = response.data.output.video_url;
                    global.imageToVideoTasks[taskId].completedAt = new Date();
                    global.imageToVideoTasks[taskId].hasChargedCredits = true;
                }

                console.log(`🎉 任务状态同步成功: ${taskId}, 积分=${creditCost}, 免费=${isFree}`);
                return 'completed';

            } else if (apiStatus === 'FAILED') {
                console.log(`❌ 任务已失败，更新数据库: ${taskId}`);

                // 更新任务状态为失败
                await saveTaskDetails(usage, {
                    taskId: taskId,
                    featureName: 'image-to-video',
                    status: 'FAILED',
                    statusCode: 'FAILED',
                    creditCost: 0, // 失败任务不扣积分
                    isFree: task.isFree || false,
                    operationText: '图生视频',
                    extraData: {
                        errorMessage: response.data.message || '任务执行失败',
                        syncedAt: new Date().toISOString(),
                        syncSource: 'auto-sync-service'
                    }
                });

                // 更新全局变量（如果存在）
                if (global.imageToVideoTasks && global.imageToVideoTasks[taskId]) {
                    global.imageToVideoTasks[taskId].status = 'FAILED';
                    global.imageToVideoTasks[taskId].errorMessage = response.data.message || '任务执行失败';
                    global.imageToVideoTasks[taskId].completedAt = new Date();
                }

                console.log(`💔 任务失败状态同步完成: ${taskId}`);
                return 'failed';

            } else {
                // 任务仍在进行中
                console.log(`⏳ 任务仍在进行中: ${taskId} (${apiStatus})`);
                return 'pending';
            }

        } catch (error) {
            // 如果是404错误，说明任务不存在或已过期
            if (error.response && error.response.status === 404) {
                console.log(`🗑️ 任务不存在或已过期: ${taskId}`);
                
                // 将任务标记为失败
                await saveTaskDetails(usage, {
                    taskId: taskId,
                    featureName: 'image-to-video',
                    status: 'FAILED',
                    statusCode: 'NOT_FOUND',
                    creditCost: 0,
                    isFree: task.isFree || false,
                    operationText: '图生视频',
                    extraData: {
                        errorMessage: '任务不存在或已过期',
                        syncedAt: new Date().toISOString(),
                        syncSource: 'auto-sync-service'
                    }
                });

                return 'failed';
            }

            console.error(`❌ 同步任务 ${taskId} 时发生错误:`, error.message);
            throw error;
        }
    }

    /**
     * 手动触发一次任务状态同步
     * @returns {Promise<Object>} 同步结果统计
     */
    async manualSync() {
        console.log('🔧 手动触发任务状态同步...');
        
        const startTime = new Date();
        await this.syncPendingTasks();
        const endTime = new Date();
        
        const result = {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: endTime - startTime,
            success: true
        };
        
        console.log(`✅ 手动同步完成，耗时 ${result.duration}ms`);
        return result;
    }

    /**
     * 获取服务状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            syncIntervalMs: this.syncIntervalMs,
            maxTaskAge: this.maxTaskAge,
            batchSize: this.batchSize,
            nextSyncIn: this.isRunning && this.syncInterval ? 
                this.syncIntervalMs - (Date.now() % this.syncIntervalMs) : null
        };
    }
}

// 创建全局单例
const taskStatusSyncService = new TaskStatusSyncService();

module.exports = taskStatusSyncService;
