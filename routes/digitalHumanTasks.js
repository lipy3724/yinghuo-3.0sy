const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const DigitalHumanOSSStorage = require('../services/digitalHumanOSSStorage');

// 获取用户的数字人任务列表
router.get('/tasks', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('🔍 [调试] 获取用户数字人任务列表, 用户ID:', userId);
        
        // 初始化存储服务
        const storage = new DigitalHumanOSSStorage();
        console.log('📦 [调试] 存储服务已初始化');
        
        try {
            // 优先从存储服务获取任务（OSS主存储，本地辅助存储）
            console.log('🔄 [调试] 调用 storage.getUserTasks()...');
            const result = await storage.getUserTasks(userId);
            
            console.log(`✅ [调试] 从${result.storageType}存储获取到 ${result.tasks.length} 个任务`);
            console.log(`📋 [调试] 任务列表详情:`, JSON.stringify(result.tasks.map(t => ({
                id: t.id,
                status: t.status,
                createdAt: t.createdAt,
                videoDuration: t.videoDuration
            })), null, 2));
            console.log(`📊 [调试] 元数据:`, JSON.stringify(result.metadata, null, 2));
            
            // 返回任务列表，包含存储类型信息
            res.json({
                success: true,
                tasks: result.tasks,
                storageType: result.storageType,
                metadata: result.metadata,
                message: result.message
            });
            
        } catch (storageError) {
            console.error('从存储服务获取任务失败，回退到内存获取:', storageError.message);
            
            // 存储服务失败，回退到从内存中获取
            const userTasks = [];
            
            if (global.digitalHumanTasks) {
                for (const taskId in global.digitalHumanTasks) {
                    const task = global.digitalHumanTasks[taskId];
                    if (task && task.userId === userId) {
                        // 构建任务信息
                        const taskInfo = {
                            id: taskId,
                            status: task.status || 'SUCCEEDED',
                            videoUrl: task.videoUrl,
                            audioUrl: task.audioUrl,
                            imageUrl: task.imageUrl,
                            videoDuration: task.videoDuration || 0,
                            originalVideoDuration: task.originalVideoDuration || null,  // ✅ 添加原始视频时长字段
                            apiProcessedDuration: task.apiProcessedDuration || null,    // ✅ 添加API处理后时长字段
                            creditCost: task.creditCost || 0,
                            createdAt: task.timestamp || task.createdAt || new Date().toISOString(),
                            prompt: task.prompt || '视频数字人生成任务',
                            hasChargedCredits: task.hasChargedCredits || false
                        };
                        
                        userTasks.push(taskInfo);
                    }
                }
            }
            
            // 过滤24小时内的任务
            const now = new Date();
            const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            const recentTasks = userTasks.filter(task => {
                const taskTime = new Date(task.createdAt);
                return taskTime >= twentyFourHoursAgo;
            });
            
            // 按创建时间倒序排列，只返回最新的3条记录
            recentTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const tasksToReturn = recentTasks.slice(0, 3);
            
            console.log(`从内存获取到 ${userTasks.length} 个任务，24小时内 ${recentTasks.length} 个，返回最新 ${tasksToReturn.length} 个`);
            
            // 返回内存中的任务列表
            res.json({
                success: true,
                tasks: tasksToReturn,
                storageType: 'memory',
                fallbackReason: storageError.message,
                message: '从内存获取任务列表成功（存储服务不可用）'
            });
        }
        
    } catch (error) {
        console.error('获取数字人任务列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取任务列表失败: ' + error.message
        });
    }
});

// 清空用户的所有数字人任务
router.delete('/tasks/clear-all', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('清空用户所有数字人任务:', userId);
        
        let deletedCount = 0;
        
        if (global.digitalHumanTasks) {
            // 收集需要删除的任务ID
            const taskIdsToDelete = [];
            
            for (const taskId in global.digitalHumanTasks) {
                const task = global.digitalHumanTasks[taskId];
                if (task && task.userId === userId) {
                    taskIdsToDelete.push(taskId);
                }
            }
            
            // 删除任务
            taskIdsToDelete.forEach(taskId => {
                delete global.digitalHumanTasks[taskId];
                deletedCount++;
            });
        }
        
        // 使用存储服务清空任务（OSS主存储，本地辅助存储）
        const storage = new DigitalHumanOSSStorage();
        
        try {
            const result = await storage.clearUserTasks(userId);
            console.log(`用户 ${userId} 的任务已从${result.storageType}存储中清空`);
            
            console.log(`已清空用户 ${userId} 的 ${deletedCount} 个内存任务`);
            
            res.json({
                success: true,
                storageType: result.storageType,
                memoryDeletedCount: deletedCount,
                message: `所有数字人任务已清空（存储: ${result.storageType}，内存: ${deletedCount}个）`
            });
            
        } catch (storageError) {
            console.warn('从存储服务清空任务失败，仅清空内存:', storageError.message);
            
            console.log(`已清空用户 ${userId} 的 ${deletedCount} 个数字人任务`);
            
            res.json({
                success: true,
                storageType: 'memory',
                deletedCount: deletedCount,
                fallbackReason: storageError.message,
                message: `已从内存清空 ${deletedCount} 个数字人任务（存储服务不可用）`
            });
        }
        
    } catch (error) {
        console.error('清空数字人任务失败:', error);
        res.status(500).json({
            success: false,
            message: '清空任务失败: ' + error.message
        });
    }
});

// 删除单个数字人任务
router.delete('/tasks/:taskId', protect, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;
        
        console.log(`删除用户 ${userId} 的数字人任务: ${taskId}`);
        
        // 检查任务是否存在且属于当前用户
        if (!global.digitalHumanTasks || !global.digitalHumanTasks[taskId]) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        const task = global.digitalHumanTasks[taskId];
        if (task.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: '无权删除此任务'
            });
        }
        
        // 删除任务
        delete global.digitalHumanTasks[taskId];
        
        console.log(`已删除用户 ${userId} 的数字人任务: ${taskId}`);
        
        res.json({
            success: true,
            message: '任务已删除'
        });
        
    } catch (error) {
        console.error('删除数字人任务失败:', error);
        res.status(500).json({
            success: false,
            message: '删除任务失败: ' + error.message
        });
    }
});

// 从OSS恢复任务列表
router.post('/tasks/restore', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const { filename } = req.body;
        
        console.log(`用户 ${userId} 请求从OSS恢复任务列表: ${filename || '默认文件'}`);
        
        // 初始化OSS存储服务
        const ossStorage = new DigitalHumanOSSStorage();
        
        // 确定要恢复的文件名
        const targetFilename = filename || `user-${userId}-tasks.json`;
        
        // 从OSS读取任务列表
        const result = await ossStorage.loadTaskList(targetFilename);
        
        if (result.success && result.tasks.length > 0) {
            // 将任务恢复到全局变量中
            if (!global.digitalHumanTasks) {
                global.digitalHumanTasks = {};
            }
            
            let restoredCount = 0;
            result.tasks.forEach(task => {
                if (task.id && task.userId === userId) {
                    global.digitalHumanTasks[task.id] = {
                        userId: task.userId,
                        status: task.status,
                        videoUrl: task.videoUrl,
                        audioUrl: task.audioUrl,
                        imageUrl: task.imageUrl,
                        videoDuration: task.videoDuration,
                        originalVideoDuration: task.originalVideoDuration || null,  // ✅ 恢复原始视频时长字段
                        apiProcessedDuration: task.apiProcessedDuration || null,    // ✅ 恢复API处理后时长字段
                        creditCost: task.creditCost,
                        createdAt: task.createdAt,
                        timestamp: task.createdAt,
                        prompt: task.prompt,
                        hasChargedCredits: task.hasChargedCredits
                    };
                    restoredCount++;
                }
            });
            
            console.log(`已从OSS恢复 ${restoredCount} 个任务到内存中`);
            
            res.json({
                success: true,
                message: `成功从OSS恢复 ${restoredCount} 个任务`,
                restoredCount: restoredCount,
                metadata: result.metadata
            });
        } else {
            res.json({
                success: true,
                message: '没有找到可恢复的任务',
                restoredCount: 0,
                metadata: result.metadata
            });
        }
        
    } catch (error) {
        console.error('从OSS恢复任务列表失败:', error);
        res.status(500).json({
            success: false,
            message: '恢复任务失败: ' + error.message
        });
    }
});

// 备份当前任务列表到OSS
router.post('/tasks/backup', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`用户 ${userId} 请求备份任务列表到OSS`);
        
        // 初始化OSS存储服务
        const ossStorage = new DigitalHumanOSSStorage();
        
        // 获取当前用户的任务列表
        const userTasks = [];
        
        if (global.digitalHumanTasks) {
            for (const taskId in global.digitalHumanTasks) {
                const task = global.digitalHumanTasks[taskId];
                if (task && task.userId === userId) {
                    const taskInfo = {
                        id: taskId,
                        userId: task.userId,
                        status: task.status || 'SUCCEEDED',
                        videoUrl: task.videoUrl,
                        audioUrl: task.audioUrl,
                        imageUrl: task.imageUrl,
                        videoDuration: task.videoDuration || 0,
                        originalVideoDuration: task.originalVideoDuration || null,  // ✅ 备份原始视频时长字段
                        apiProcessedDuration: task.apiProcessedDuration || null,    // ✅ 备份API处理后时长字段
                        creditCost: task.creditCost || 0,
                        createdAt: task.timestamp || task.createdAt || new Date().toISOString(),
                        prompt: task.prompt || '视频数字人生成任务',
                        hasChargedCredits: task.hasChargedCredits || false
                    };
                    userTasks.push(taskInfo);
                }
            }
        }
        
        if (userTasks.length === 0) {
            return res.json({
                success: true,
                message: '没有任务需要备份',
                taskCount: 0
            });
        }
        
        // 备份到OSS
        const result = await ossStorage.backupTaskList(userTasks);
        
        console.log(`用户 ${userId} 的 ${userTasks.length} 个任务已备份到OSS: ${result.backupFilename}`);
        
        res.json({
            success: true,
            message: `成功备份 ${userTasks.length} 个任务到OSS`,
            backupFilename: result.backupFilename,
            taskCount: userTasks.length,
            ossPath: result.ossPath
        });
        
    } catch (error) {
        console.error('备份任务列表到OSS失败:', error);
        res.status(500).json({
            success: false,
            message: '备份任务失败: ' + error.message
        });
    }
});

// 列出OSS中的任务列表文件
router.get('/tasks/oss-files', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`用户 ${userId} 请求列出OSS中的任务文件`);
        
        // 初始化OSS存储服务
        const ossStorage = new DigitalHumanOSSStorage();
        
        // 列出所有任务列表文件
        const result = await ossStorage.listTaskListFiles();
        
        // 过滤出当前用户相关的文件
        const userFiles = result.files.filter(file => 
            file.filename.includes(`user-${userId}-`) || 
            file.filename.startsWith('backup-tasks-')
        );
        
        console.log(`找到用户 ${userId} 相关的 ${userFiles.length} 个OSS文件`);
        
        res.json({
            success: true,
            files: userFiles,
            totalCount: userFiles.length,
            message: `找到 ${userFiles.length} 个相关文件`
        });
        
    } catch (error) {
        console.error('列出OSS文件失败:', error);
        res.status(500).json({
            success: false,
            message: '获取文件列表失败: ' + error.message
        });
    }
});

// 删除OSS中的任务列表文件
router.delete('/tasks/oss-files/:filename', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const { filename } = req.params;
        
        console.log(`用户 ${userId} 请求删除OSS文件: ${filename}`);
        
        // 安全检查：只允许删除用户自己的文件
        if (!filename.includes(`user-${userId}-`) && !filename.startsWith('backup-tasks-')) {
            return res.status(403).json({
                success: false,
                message: '无权删除此文件'
            });
        }
        
        // 初始化OSS存储服务
        const ossStorage = new DigitalHumanOSSStorage();
        
        // 删除文件
        const result = await ossStorage.deleteTaskList(filename);
        
        console.log(`用户 ${userId} 已删除OSS文件: ${filename}`);
        
        res.json({
            success: true,
            message: `文件 ${filename} 已删除`,
            filename: result.filename
        });
        
    } catch (error) {
        console.error('删除OSS文件失败:', error);
        res.status(500).json({
            success: false,
            message: '删除文件失败: ' + error.message
        });
    }
});

/**
 * @route   GET /api/digital-human/tasks/cleanup
 * @desc    清理过期的数字人任务记录
 * @access  私有
 */
router.get('/tasks/cleanup', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        
        console.log(`清理用户过期数字人任务: userId=${userId}`);
        
        // 初始化OSS存储服务
        const ossStorage = new DigitalHumanOSSStorage();
        
        // 从OSS加载任务列表
        try {
            const result = await ossStorage.loadTaskList(`user-${userId}-tasks.json`);
            const allTasks = result.tasks || [];
            
            // 过滤24小时内的任务
            const now = new Date();
            const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            const recentTasks = allTasks.filter(task => {
                const taskTime = new Date(task.createdAt);
                return taskTime >= twentyFourHoursAgo;
            });
            
            const expiredCount = allTasks.length - recentTasks.length;
            
            // 只保存最新的3个任务
            const tasksToSave = recentTasks.slice(0, 3);
            
            // 保存清理后的任务列表
            if (tasksToSave.length > 0) {
                await ossStorage.saveTaskList(tasksToSave, `user-${userId}-tasks.json`);
            }
            
            console.log(`清理完成: 原有 ${allTasks.length} 个任务，过期 ${expiredCount} 个，保留 ${tasksToSave.length} 个`);
            
            res.json({
                success: true,
                message: '任务清理完成',
                data: {
                    originalCount: allTasks.length,
                    expiredCount: expiredCount,
                    remainingCount: tasksToSave.length
                }
            });
            
        } catch (ossError) {
            if (ossError.message.includes('任务列表文件不存在')) {
                res.json({
                    success: true,
                    message: '没有需要清理的任务',
                    data: {
                        originalCount: 0,
                        expiredCount: 0,
                        remainingCount: 0
                    }
                });
            } else {
                throw ossError;
            }
        }
        
    } catch (error) {
        console.error('清理过期任务出错:', error);
        res.status(500).json({
            success: false,
            message: '清理任务失败: ' + error.message
        });
    }
});

// 同步本地数据到OSS
router.post('/tasks/sync-to-oss', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`用户 ${userId} 请求同步本地数据到OSS`);
        
        // 初始化存储服务
        const storage = new DigitalHumanOSSStorage();
        
        try {
            const result = await storage.syncLocalToOSS(userId);
            
            res.json({
                success: true,
                syncedTasks: result.syncedTasks,
                ossPath: result.ossPath,
                message: result.message
            });
            
        } catch (error) {
            console.error('同步到OSS失败:', error);
            res.status(500).json({
                success: false,
                message: `同步失败: ${error.message}`
            });
        }
        
    } catch (error) {
        console.error('同步本地数据到OSS失败:', error);
        res.status(500).json({
            success: false,
            message: '同步失败: ' + error.message
        });
    }
});

// 获取存储状态信息
router.get('/storage/status', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 初始化存储服务
        const storage = new DigitalHumanOSSStorage();
        
        // 测试OSS连接
        const ossConnected = await storage.testConnection();
        
        // 检查本地存储
        let localTasksCount = 0;
        try {
            const localResult = await storage.loadFromLocal(`user-${userId}-tasks.json`);
            localTasksCount = localResult.tasks.length;
        } catch (error) {
            // 本地文件不存在或读取失败
        }
        
        // 检查OSS存储
        let ossTasksCount = 0;
        let ossLastUpdated = null;
        if (ossConnected) {
            try {
                const ossResult = await storage.loadTaskList(`user-${userId}-tasks.json`);
                if (ossResult.storageType === 'oss') {
                    ossTasksCount = ossResult.tasks.length;
                    ossLastUpdated = ossResult.metadata.lastUpdated;
                }
            } catch (error) {
                // OSS文件不存在或读取失败
            }
        }
        
        // 检查内存存储
        let memoryTasksCount = 0;
        if (global.digitalHumanTasks) {
            for (const taskId in global.digitalHumanTasks) {
                const task = global.digitalHumanTasks[taskId];
                if (task && task.userId === userId) {
                    memoryTasksCount++;
                }
            }
        }
        
        res.json({
            success: true,
            storage: {
                oss: {
                    connected: ossConnected,
                    tasksCount: ossTasksCount,
                    lastUpdated: ossLastUpdated
                },
                local: {
                    tasksCount: localTasksCount
                },
                memory: {
                    tasksCount: memoryTasksCount
                }
            },
            message: '存储状态获取成功'
        });
        
    } catch (error) {
        console.error('获取存储状态失败:', error);
        res.status(500).json({
            success: false,
            message: '获取存储状态失败: ' + error.message
        });
    }
});

module.exports = router;
