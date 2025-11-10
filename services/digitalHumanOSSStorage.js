const OSS = require('ali-oss');
const path = require('path');
const fs = require('fs').promises;

/**
 * 数字人任务存储服务
 * 主存储：阿里云OSS
 * 辅助存储：本地文件系统（OSS失败时的降级方案）
 */
class DigitalHumanOSSStorage {
    constructor() {
        // 检查OSS配置是否完整
        const accessKeyId = process.env.OSS_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID;
        const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET;
        const bucket = process.env.OSS_BUCKET;
        
        this.ossConfigured = !!(accessKeyId && accessKeySecret && bucket);
        
        if (this.ossConfigured) {
            try {
                this.client = new OSS({
                    region: process.env.OSS_REGION || 'oss-cn-hangzhou',
                    accessKeyId: accessKeyId,
                    accessKeySecret: accessKeySecret,
                    bucket: bucket
                });
                console.log('[DigitalHumanStorage] OSS客户端初始化成功');
            } catch (error) {
                console.warn('[DigitalHumanStorage] OSS客户端初始化失败:', error.message);
                this.ossConfigured = false;
                this.client = null;
            }
        } else {
            console.warn('[DigitalHumanStorage] OSS配置不完整，将仅使用本地存储');
            this.client = null;
        }
        
        // OSS存储路径配置
        this.taskListPath = 'digital-human/task-lists/';
        this.defaultTaskListFile = 'default-tasks.json';
        
        // 本地存储路径配置（降级方案）
        this.localStoragePath = path.join(process.cwd(), 'uploads', 'digital-human', 'tasks');
        this.ensureLocalStorageDir();
    }

    /**
     * 确保本地存储目录存在
     */
    async ensureLocalStorageDir() {
        try {
            await fs.mkdir(this.localStoragePath, { recursive: true });
        } catch (error) {
            console.error('[DigitalHumanStorage] 创建本地存储目录失败:', error);
        }
    }

    /**
     * 保存数字人任务列表（主存储：OSS，辅助存储：本地）
     * @param {Array} tasks - 任务列表数组
     * @param {string} filename - 文件名（可选，默认为default-tasks.json）
     * @returns {Promise<Object>} 保存结果
     */
    async saveTaskList(tasks, filename = this.defaultTaskListFile) {
        // 验证任务数据格式
        if (!Array.isArray(tasks)) {
            throw new Error('任务列表必须是数组格式');
        }

        // 准备保存的数据
        const taskData = {
            tasks: tasks,
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            totalTasks: tasks.length,
            storageType: 'primary' // 标记存储类型
        };

        const dataBuffer = Buffer.from(JSON.stringify(taskData, null, 2));

        // 如果OSS可用，优先尝试保存到OSS（主存储）
        if (this.ossConfigured && this.client) {
            try {
                console.log(`[DigitalHumanStorage] 尝试保存任务列表到OSS: ${filename}`);
                
                const ossPath = path.join(this.taskListPath, filename).replace(/\\/g, '/');
                const result = await this.client.put(ossPath, dataBuffer);
                
                console.log(`[DigitalHumanStorage] 任务列表成功保存到OSS: ${result.name}`);
                
                // OSS保存成功，同时异步保存到本地作为备份
                this.saveToLocalAsync(tasks, filename).catch(error => {
                    console.warn('[DigitalHumanStorage] 本地备份失败:', error.message);
                });
                
                return {
                    success: true,
                    storageType: 'oss',
                    ossPath: result.name,
                    url: result.url,
                    taskCount: tasks.length,
                    message: '任务列表保存到OSS成功'
                };

            } catch (ossError) {
                console.error('[DigitalHumanStorage] OSS保存失败，尝试本地存储:', ossError.message);
            }
        } else {
            console.log('[DigitalHumanStorage] OSS不可用，直接使用本地存储');
        }
        
        // OSS失败或不可用，使用本地存储
        try {
            const localResult = await this.saveToLocal(tasks, filename);
            
            console.log(`[DigitalHumanStorage] 任务列表已保存到本地: ${filename}`);
            
            return {
                success: true,
                storageType: 'local',
                localPath: localResult.localPath,
                taskCount: tasks.length,
                message: this.ossConfigured ? '任务列表已保存到本地存储（OSS不可用）' : '任务列表已保存到本地存储',
                fallbackReason: this.ossConfigured ? 'OSS保存失败' : 'OSS未配置'
            };
            
        } catch (localError) {
            console.error('[DigitalHumanStorage] 本地存储失败:', localError.message);
            throw new Error(`存储失败 - 本地: ${localError.message}`);
        }
    }

    /**
     * 保存任务列表到本地文件系统
     * @param {Array} tasks - 任务列表数组
     * @param {string} filename - 文件名
     * @returns {Promise<Object>} 保存结果
     */
    async saveToLocal(tasks, filename) {
        const taskData = {
            tasks: tasks,
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            totalTasks: tasks.length,
            storageType: 'fallback' // 标记为降级存储
        };

        const localFilePath = path.join(this.localStoragePath, filename);
        await fs.writeFile(localFilePath, JSON.stringify(taskData, null, 2), 'utf8');
        
        return {
            success: true,
            localPath: localFilePath,
            taskCount: tasks.length
        };
    }

    /**
     * 异步保存到本地（用于备份）
     * @param {Array} tasks - 任务列表数组
     * @param {string} filename - 文件名
     */
    async saveToLocalAsync(tasks, filename) {
        try {
            await this.saveToLocal(tasks, filename);
            console.log(`[DigitalHumanStorage] 本地备份完成: ${filename}`);
        } catch (error) {
            console.error('[DigitalHumanStorage] 本地备份失败:', error);
        }
    }

    /**
     * 读取数字人任务列表（主存储：OSS，辅助存储：本地）
     * @param {string} filename - 文件名（可选，默认为default-tasks.json）
     * @returns {Promise<Object>} 任务列表结果
     */
    async loadTaskList(filename = this.defaultTaskListFile) {
        // 如果OSS可用，优先尝试从OSS读取（主存储）
        if (this.ossConfigured && this.client) {
            try {
                console.log(`[DigitalHumanStorage] 尝试从OSS读取任务列表: ${filename}`);
                
                const ossPath = path.join(this.taskListPath, filename).replace(/\\/g, '/');
                const result = await this.client.get(ossPath);
                const taskData = JSON.parse(result.content.toString());
                
                console.log(`[DigitalHumanStorage] 从OSS读取成功，共${taskData.tasks.length}个任务`);
                
                return {
                    success: true,
                    storageType: 'oss',
                    tasks: taskData.tasks || [],
                    metadata: {
                        lastUpdated: taskData.lastUpdated,
                        version: taskData.version,
                        totalTasks: taskData.totalTasks,
                        storageType: taskData.storageType || 'oss'
                    },
                    message: '从OSS读取任务列表成功'
                };

            } catch (ossError) {
                // OSS读取失败，记录日志但继续尝试本地读取
                if (ossError.code === 'NoSuchKey') {
                    console.log(`[DigitalHumanStorage] OSS中不存在文件 ${filename}，尝试本地读取`);
                } else {
                    console.error(`[DigitalHumanStorage] OSS读取失败，尝试本地读取:`, ossError.message);
                }
            }
        } else {
            console.log('[DigitalHumanStorage] OSS不可用，直接使用本地存储');
        }
        
        // OSS失败或不可用，尝试从本地读取
        try {
            const localResult = await this.loadFromLocal(filename);
            
            console.log(`[DigitalHumanStorage] 从本地读取成功，共${localResult.tasks.length}个任务`);
            
            return {
                success: true,
                storageType: 'local',
                tasks: localResult.tasks,
                metadata: {
                    ...localResult.metadata,
                    fallbackReason: this.ossConfigured ? 'OSS读取失败或文件不存在' : 'OSS未配置'
                },
                message: '从本地存储读取任务列表成功'
            };
            
        } catch (localError) {
            console.log(`[DigitalHumanStorage] 本地也无数据，返回空列表`);
            
            // 两个存储都没有数据，返回空列表
            return {
                success: true,
                storageType: 'empty',
                tasks: [],
                metadata: {
                    lastUpdated: null,
                    version: '1.0',
                    totalTasks: 0,
                    fallbackReason: this.ossConfigured ? `OSS和本地都无数据` : `OSS未配置，本地无数据`
                },
                message: '任务列表为空'
            };
        }
    }

    /**
     * 从本地文件系统读取任务列表
     * @param {string} filename - 文件名
     * @returns {Promise<Object>} 任务列表结果
     */
    async loadFromLocal(filename) {
        const localFilePath = path.join(this.localStoragePath, filename);
        
        try {
            const fileContent = await fs.readFile(localFilePath, 'utf8');
            const taskData = JSON.parse(fileContent);
            
            return {
                success: true,
                tasks: taskData.tasks || [],
                metadata: {
                    lastUpdated: taskData.lastUpdated,
                    version: taskData.version,
                    totalTasks: taskData.totalTasks,
                    storageType: taskData.storageType || 'local'
                }
            };
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error('本地文件不存在');
            }
            throw new Error(`读取本地文件失败: ${error.message}`);
        }
    }

    /**
     * 列出OSS中所有的任务列表文件
     * @returns {Promise<Array>} 文件列表
     */
    async listTaskListFiles() {
        try {
            console.log('[DigitalHumanOSS] 开始列出所有任务列表文件');
            
            const result = await this.client.list({
                prefix: this.taskListPath,
                'max-keys': 100
            });

            const files = result.objects || [];
            const taskListFiles = files
                .filter(file => file.name.endsWith('.json'))
                .map(file => ({
                    filename: path.basename(file.name),
                    fullPath: file.name,
                    size: file.size,
                    lastModified: file.lastModified,
                    url: `https://${this.client.options.bucket}.${this.client.options.region}.aliyuncs.com/${file.name}`
                }));

            console.log(`[DigitalHumanOSS] 找到${taskListFiles.length}个任务列表文件`);
            
            return {
                success: true,
                files: taskListFiles,
                totalCount: taskListFiles.length,
                message: '文件列表获取成功'
            };

        } catch (error) {
            console.error('[DigitalHumanOSS] 列出文件失败:', error);
            throw new Error(`列出文件失败: ${error.message}`);
        }
    }

    /**
     * 删除OSS中的任务列表文件
     * @param {string} filename - 要删除的文件名
     * @returns {Promise<Object>} 删除结果
     */
    async deleteTaskList(filename) {
        try {
            console.log(`[DigitalHumanOSS] 开始删除任务列表文件: ${filename}`);
            
            // 构建完整的OSS路径
            const ossPath = path.join(this.taskListPath, filename).replace(/\\/g, '/');
            
            // 删除文件
            await this.client.delete(ossPath);
            
            console.log(`[DigitalHumanOSS] 任务列表文件删除成功: ${filename}`);
            
            return {
                success: true,
                filename: filename,
                message: '任务列表文件删除成功'
            };

        } catch (error) {
            console.error('[DigitalHumanOSS] 删除任务列表文件失败:', error);
            throw new Error(`删除任务列表文件失败: ${error.message}`);
        }
    }

    /**
     * 备份当前任务列表
     * @param {Array} tasks - 要备份的任务列表
     * @returns {Promise<Object>} 备份结果
     */
    async backupTaskList(tasks) {
        try {
            // 生成带时间戳的备份文件名
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFilename = `backup-tasks-${timestamp}.json`;
            
            console.log(`[DigitalHumanOSS] 开始备份任务列表: ${backupFilename}`);
            
            const result = await this.saveTaskList(tasks, backupFilename);
            
            return {
                success: true,
                backupFilename: backupFilename,
                ossPath: result.ossPath,
                taskCount: tasks.length,
                message: '任务列表备份成功'
            };

        } catch (error) {
            console.error('[DigitalHumanOSS] 备份任务列表失败:', error);
            throw new Error(`备份任务列表失败: ${error.message}`);
        }
    }

    /**
     * 验证OSS连接
     * @returns {Promise<boolean>} 连接状态
     */
    async testConnection() {
        if (!this.ossConfigured || !this.client) {
            console.log('[DigitalHumanStorage] OSS未配置或客户端未初始化');
            return false;
        }
        
        try {
            console.log('[DigitalHumanStorage] 开始测试OSS连接');
            
            // 尝试列出bucket信息
            await this.client.getBucketInfo();
            
            console.log('[DigitalHumanStorage] OSS连接测试成功');
            return true;

        } catch (error) {
            console.error('[DigitalHumanStorage] OSS连接测试失败:', error);
            return false;
        }
    }

    /**
     * 添加单个任务到存储
     * @param {Object} task - 任务对象
     * @param {string} userId - 用户ID
     * @returns {Promise<Object>} 添加结果
     */
    async addTask(task, userId) {
        try {
            const filename = `user-${userId}-tasks.json`;
            
            // 先读取现有任务列表
            const result = await this.loadTaskList(filename);
            const existingTasks = result.tasks || [];
            
            // 添加新任务到开头
            const newTask = {
                ...task,
                id: task.id || task.taskId,
                // ✅ 确保 createdAt 总是 ISO 字符串格式（即使传入的是 Date 对象）
                createdAt: task.createdAt ? (task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt) : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            existingTasks.unshift(newTask);
            
            // 过滤24小时内的任务并只保留最新3个
            const now = new Date();
            const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            const recentTasks = existingTasks.filter(t => {
                const taskTime = new Date(t.createdAt);
                return taskTime >= twentyFourHoursAgo;
            });
            
            const tasksToSave = recentTasks
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 3);
            
            // 保存更新后的任务列表
            const saveResult = await this.saveTaskList(tasksToSave, filename);
            
            console.log(`[DigitalHumanStorage] 用户 ${userId} 的任务已添加，当前保存 ${tasksToSave.length} 个任务`);
            
            return {
                success: true,
                task: newTask,
                totalTasks: tasksToSave.length,
                storageType: saveResult.storageType,
                message: '任务添加成功'
            };
            
        } catch (error) {
            console.error('[DigitalHumanStorage] 添加任务失败:', error);
            throw new Error(`添加任务失败: ${error.message}`);
        }
    }

    /**
     * 获取用户的任务列表
     * @param {string} userId - 用户ID
     * @returns {Promise<Object>} 任务列表结果
     */
    async getUserTasks(userId) {
        try {
            const filename = `user-${userId}-tasks.json`;
            console.log(`🔍 [调试-Storage] 开始获取用户 ${userId} 的任务列表，文件名: ${filename}`);
            
            const result = await this.loadTaskList(filename);
            console.log(`📦 [调试-Storage] loadTaskList 返回结果:`, JSON.stringify({
                storageType: result.storageType,
                tasksCount: result.tasks?.length || 0,
                metadata: result.metadata
            }, null, 2));
            
            // 过滤24小时内的任务
            const now = new Date();
            const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            console.log(`⏰ [调试-Storage] 当前时间: ${now.toISOString()}, 24小时前: ${twentyFourHoursAgo.toISOString()}`);
            
            const recentTasks = (result.tasks || []).filter(task => {
                const taskTime = new Date(task.createdAt);
                const isRecent = taskTime >= twentyFourHoursAgo;
                console.log(`📅 [调试-Storage] 任务 ${task.id}: 创建于 ${task.createdAt}, 是否在24小时内: ${isRecent}`);
                return isRecent;
            });
            
            console.log(`✅ [调试-Storage] 过滤后得到 ${recentTasks.length} 个24小时内的任务`);
            
            // 按创建时间倒序排列，只返回最新的3条记录
            const tasksToReturn = recentTasks
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 3);
            
            console.log(`[DigitalHumanStorage] 用户 ${userId} 共有 ${result.tasks.length} 个任务，24小时内 ${recentTasks.length} 个，返回最新 ${tasksToReturn.length} 个`);
            console.log(`📋 [调试-Storage] 最终返回的任务:`, JSON.stringify(tasksToReturn.map(t => ({
                id: t.id,
                status: t.status,
                createdAt: t.createdAt,
                videoDuration: t.videoDuration
            })), null, 2));
            
            return {
                success: true,
                tasks: tasksToReturn,
                storageType: result.storageType,
                metadata: result.metadata,
                message: `获取任务列表成功，来源: ${result.storageType}`
            };
            
        } catch (error) {
            console.error('❌ [调试-Storage] 获取用户任务失败:', error);
            console.error('❌ [调试-Storage] 错误堆栈:', error.stack);
            throw new Error(`获取用户任务失败: ${error.message}`);
        }
    }

    /**
     * 删除用户的所有任务
     * @param {string} userId - 用户ID
     * @returns {Promise<Object>} 删除结果
     */
    async clearUserTasks(userId) {
        try {
            const filename = `user-${userId}-tasks.json`;
            
            // 保存空的任务列表
            const saveResult = await this.saveTaskList([], filename);
            
            console.log(`[DigitalHumanStorage] 用户 ${userId} 的所有任务已清空`);
            
            return {
                success: true,
                storageType: saveResult.storageType,
                message: '所有任务已清空'
            };
            
        } catch (error) {
            console.error('[DigitalHumanStorage] 清空用户任务失败:', error);
            throw new Error(`清空用户任务失败: ${error.message}`);
        }
    }

    /**
     * 同步本地数据到OSS
     * @param {string} userId - 用户ID
     * @returns {Promise<Object>} 同步结果
     */
    async syncLocalToOSS(userId) {
        if (!this.ossConfigured || !this.client) {
            throw new Error('OSS未配置或不可用，无法进行同步');
        }
        
        try {
            const filename = `user-${userId}-tasks.json`;
            
            // 从本地读取任务
            const localResult = await this.loadFromLocal(filename);
            
            // 尝试保存到OSS
            const ossPath = path.join(this.taskListPath, filename).replace(/\\/g, '/');
            const taskData = {
                tasks: localResult.tasks,
                lastUpdated: new Date().toISOString(),
                version: '1.0',
                totalTasks: localResult.tasks.length,
                storageType: 'synced'
            };
            
            const result = await this.client.put(ossPath, Buffer.from(JSON.stringify(taskData, null, 2)));
            
            console.log(`[DigitalHumanStorage] 用户 ${userId} 的本地数据已同步到OSS`);
            
            return {
                success: true,
                syncedTasks: localResult.tasks.length,
                ossPath: result.name,
                message: '本地数据已同步到OSS'
            };
            
        } catch (error) {
            console.error('[DigitalHumanStorage] 同步到OSS失败:', error);
            throw new Error(`同步到OSS失败: ${error.message}`);
        }
    }
}

module.exports = DigitalHumanOSSStorage;
