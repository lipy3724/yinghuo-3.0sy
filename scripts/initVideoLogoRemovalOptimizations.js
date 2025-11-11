/**
 * 视频去标志功能优化初始化脚本
 * 用于启动定时任务和初始化数据库表
 */

const { VideoLogoRemovalTask, setupAssociations } = require('../models/VideoLogoRemovalTask');
const videoLogoRemovalJobs = require('../jobs/videoLogoRemovalJobs');
const sequelize = require('../config/db');

/**
 * 检查表是否存在
 */
async function tableExists(tableName) {
    try {
        const [results] = await sequelize.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = '${tableName}'
        `);
        return results.length > 0;
    } catch (error) {
        console.error('检查表是否存在失败:', error);
        return false;
    }
}

/**
 * 检查索引是否存在
 */
async function indexExists(tableName, indexName) {
    try {
        const [results] = await sequelize.query(`
            SELECT INDEX_NAME 
            FROM INFORMATION_SCHEMA.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = '${tableName}' 
            AND INDEX_NAME = '${indexName}'
        `);
        return results.length > 0;
    } catch (error) {
        console.error('检查索引是否存在失败:', error);
        return false;
    }
}

/**
 * 初始化视频去标志功能优化
 */
async function initVideoLogoRemovalOptimizations() {
    try {
        console.log('🚀 开始初始化视频去标志功能优化...');
        
        // 1. 设置模型关联关系
        console.log('📊 设置数据库模型关联关系...');
        setupAssociations();
        
        // 2. 同步数据库表结构（使用更安全的策略）
        console.log('🗄️ 同步数据库表结构...');
        const tableName = 'video_logo_removal_tasks';
        const exists = await tableExists(tableName);
        
        if (!exists) {
            // 表不存在，创建表
            console.log('📋 表不存在，创建新表...');
            await VideoLogoRemovalTask.sync({ force: false });
            console.log('✅ 表创建完成');
        } else {
            // 表已存在，检查关键索引是否存在
            console.log('📋 表已存在，检查关键索引...');
            const taskIdIndexExists = await indexExists(tableName, 'video_logo_removal_tasks_task_id');
            
            if (!taskIdIndexExists) {
                // 关键索引不存在，尝试添加（但捕获可能的错误）
                try {
                    console.log('🔧 尝试添加taskId唯一索引...');
                    await VideoLogoRemovalTask.sync({ alter: true });
                    console.log('✅ 索引添加成功');
                } catch (syncError) {
                    // 如果是索引数量超限错误，检查索引是否真的不存在
                    if (syncError.original && syncError.original.code === 'ER_TOO_MANY_KEYS') {
                        console.warn('⚠️ 表索引数量已达上限，跳过自动同步');
                        // 再次检查索引是否存在（可能已经存在但sync检测不到）
                        const recheck = await indexExists(tableName, 'video_logo_removal_tasks_task_id');
                        if (recheck) {
                            console.log('✅ taskId索引已存在，继续执行');
                        } else {
                            console.warn('⚠️ taskId索引不存在，但无法自动添加（索引数量超限）');
                            console.warn('⚠️ 建议手动检查并优化表的索引结构');
                        }
                    } else {
                        // 其他错误，重新抛出
                        throw syncError;
                    }
                }
            } else {
                console.log('✅ 关键索引已存在，跳过同步');
            }
        }
        
        console.log('✅ 数据库表结构检查完成');
        
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
        // 如果是索引相关的错误，记录警告但不阻止启动
        if (error.original && error.original.code === 'ER_TOO_MANY_KEYS') {
            console.error('⚠️ 数据库表索引数量超限，但功能仍可正常使用');
            console.error('⚠️ 建议手动优化表的索引结构');
            // 继续执行其他初始化步骤
            try {
                await migrateExistingTasks();
                videoLogoRemovalJobs.start();
                return {
                    success: true,
                    message: '视频去标志功能优化初始化完成（索引警告）',
                    jobStatus: videoLogoRemovalJobs.getStatus(),
                    warning: '表索引数量超限，建议优化索引结构'
                };
            } catch (innerError) {
                throw innerError;
            }
        } else {
            throw error;
        }
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
