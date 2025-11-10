/**
 * 视频去标志功能优化初始化脚本
 * 用于启动定时任务和初始化数据库表
 */

const { VideoLogoRemovalTask, setupAssociations } = require('../models/VideoLogoRemovalTask');
const videoLogoRemovalJobs = require('../jobs/videoLogoRemovalJobs');
const sequelize = require('../config/db');

/**
 * 初始化视频去标志功能优化
 */
async function initVideoLogoRemovalOptimizations() {
    try {
        console.log('🚀 开始初始化视频去标志功能优化...');
        
        // 1. 设置模型关联关系
        console.log('📊 设置数据库模型关联关系...');
        setupAssociations();
        
        // 2. 同步数据库表结构
        console.log('🗄️ 同步数据库表结构...');
        await VideoLogoRemovalTask.sync({ alter: true });
        console.log('✅ 数据库表结构同步完成');
        
        // 3. 迁移现有全局变量数据到数据库（如果存在）
        await migrateExistingTasks();
        
        // 4. 启动定时任务
        console.log('⏰ 启动定时任务...');
        videoLogoRemovalJobs.start();
        
        // 5. 执行一次清理和重试
        console.log('🧹 执行初始清理和重试...');
        await videoLogoRemovalJobs.triggerCleanup();
        await videoLogoRemovalJobs.triggerRetry();
        
        console.log('✅ 视频去标志功能优化初始化完成！');
        
        // 返回状态信息
        return {
            success: true,
            message: '视频去标志功能优化初始化完成',
            jobStatus: videoLogoRemovalJobs.getStatus()
        };
        
    } catch (error) {
        console.error('❌ 初始化视频去标志功能优化失败:', error);
        throw error;
    }
}

/**
 * 迁移现有全局变量中的任务数据到数据库
 */
async function migrateExistingTasks() {
    try {
        console.log('🔄 检查是否有现有任务需要迁移...');
        
        if (!global.videoLogoRemovalTasks || Object.keys(global.videoLogoRemovalTasks).length === 0) {
            console.log('✅ 没有现有任务需要迁移');
            return;
        }
        
        const existingTasks = global.videoLogoRemovalTasks;
        const taskIds = Object.keys(existingTasks);
        
        console.log(`📋 发现 ${taskIds.length} 个现有任务，开始迁移...`);
        
        let migratedCount = 0;
        let skippedCount = 0;
        
        for (const taskId of taskIds) {
            const taskData = existingTasks[taskId];
            
            try {
                // 检查任务是否已存在于数据库中
                const existingTask = await VideoLogoRemovalTask.findOne({
                    where: { taskId: taskId }
                });
                
                if (existingTask) {
                    console.log(`⏭️ 任务 ${taskId} 已存在于数据库中，跳过`);
                    skippedCount++;
                    continue;
                }
                
                // 创建新的数据库记录
                const newTask = await VideoLogoRemovalTask.create({
                    userId: taskData.userId,
                    taskId: taskId,
                    aliyunTaskId: taskData.aliyunTaskId,
                    status: taskData.status || 'processing',
                    inputVideoUrl: taskData.inputVideoUrl,
                    resultVideoUrl: taskData.resultVideoUrl || null,
                    originalFileName: taskData.originalFileName || 'video.mp4',
                    creditCost: taskData.creditCost || 0,
                    actualCreditCost: taskData.actualCreditCost || null,
                    isFree: taskData.isFree || false,
                    creditProcessed: taskData.creditProcessed || false,
                    message: taskData.message || null,
                    createdAt: taskData.createdAt || new Date(),
                    updatedAt: taskData.updatedAt || new Date(),
                    completedAt: taskData.status === 'completed' || taskData.status === 'failed' ? 
                        (taskData.updatedAt || new Date()) : null
                });
                
                // 设置标志区域
                if (taskData.logoBoxes) {
                    newTask.setLogoBoxes(taskData.logoBoxes);
                    await newTask.save();
                }
                
                console.log(`✅ 任务 ${taskId} 迁移成功`);
                migratedCount++;
                
            } catch (error) {
                console.error(`❌ 迁移任务 ${taskId} 失败:`, error);
            }
        }
        
        console.log(`🎉 任务迁移完成: 成功 ${migratedCount} 个，跳过 ${skippedCount} 个`);
        
        // 迁移完成后，清空全局变量（可选）
        if (migratedCount > 0) {
            console.log('🧹 清空全局变量中的任务数据...');
            global.videoLogoRemovalTasks = {};
            console.log('✅ 全局变量清理完成');
        }
        
    } catch (error) {
        console.error('❌ 迁移现有任务失败:', error);
        // 不抛出错误，允许初始化继续进行
    }
}

/**
 * 停止视频去标志功能优化
 */
async function stopVideoLogoRemovalOptimizations() {
    try {
        console.log('🛑 停止视频去标志功能优化...');
        
        // 停止定时任务
        videoLogoRemovalJobs.stop();
        
        console.log('✅ 视频去标志功能优化已停止');
        
        return {
            success: true,
            message: '视频去标志功能优化已停止'
        };
        
    } catch (error) {
        console.error('❌ 停止视频去标志功能优化失败:', error);
        throw error;
    }
}

/**
 * 获取优化功能状态
 */
function getOptimizationStatus() {
    return {
        jobStatus: videoLogoRemovalJobs.getStatus(),
        databaseConnected: sequelize.authenticate().then(() => true).catch(() => false)
    };
}

module.exports = {
    initVideoLogoRemovalOptimizations,
    stopVideoLogoRemovalOptimizations,
    getOptimizationStatus,
    migrateExistingTasks
};
