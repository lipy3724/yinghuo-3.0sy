/**
 * 视频去标志功能专用迁移脚本
 * 只运行视频去标志相关的迁移
 */

const sequelize = require('../config/db');
const { VideoLogoRemovalTask } = require('../models/VideoLogoRemovalTask');

/**
 * 运行视频去标志功能迁移
 */
async function migrateVideoLogoRemoval() {
    try {
        console.log('🚀 开始视频去标志功能数据库迁移...');
        
        // 确保数据库连接正常
        await sequelize.authenticate();
        console.log('✅ 数据库连接成功');
        
        // 同步VideoLogoRemovalTask模型到数据库
        console.log('📊 创建video_logo_removal_tasks表...');
        await VideoLogoRemovalTask.sync({ force: false, alter: true });
        console.log('✅ video_logo_removal_tasks表创建/更新完成');
        
        // 验证表结构
        console.log('🔍 验证表结构...');
        const tableInfo = await sequelize.query(`
            ${sequelize.getDialect() === 'sqlite' ? 
                "PRAGMA table_info(video_logo_removal_tasks)" : 
                "DESCRIBE video_logo_removal_tasks"
            }
        `);
        
        console.log('📋 表结构验证完成，字段数量:', tableInfo[0].length);
        
        // 创建索引（如果不存在）
        console.log('🔧 创建数据库索引...');
        await createIndexes();
        
        console.log('🎉 视频去标志功能迁移完成！');
        
        return {
            success: true,
            message: '视频去标志功能迁移完成',
            tableFields: tableInfo[0].length
        };
        
    } catch (error) {
        console.error('❌ 迁移失败:', error);
        throw error;
    }
}

/**
 * 创建必要的索引
 */
async function createIndexes() {
    try {
        const dialect = sequelize.getDialect();
        
        const indexes = [
            {
                name: 'idx_video_logo_tasks_user_id',
                field: 'userId',
                sql: dialect === 'sqlite' ? 
                    'CREATE INDEX IF NOT EXISTS idx_video_logo_tasks_user_id ON video_logo_removal_tasks(userId)' :
                    'CREATE INDEX idx_video_logo_tasks_user_id ON video_logo_removal_tasks(userId)'
            },
            {
                name: 'idx_video_logo_tasks_task_id',
                field: 'taskId',
                sql: dialect === 'sqlite' ? 
                    'CREATE UNIQUE INDEX IF NOT EXISTS idx_video_logo_tasks_task_id ON video_logo_removal_tasks(taskId)' :
                    'CREATE UNIQUE INDEX idx_video_logo_tasks_task_id ON video_logo_removal_tasks(taskId)'
            },
            {
                name: 'idx_video_logo_tasks_status',
                field: 'status',
                sql: dialect === 'sqlite' ? 
                    'CREATE INDEX IF NOT EXISTS idx_video_logo_tasks_status ON video_logo_removal_tasks(status)' :
                    'CREATE INDEX idx_video_logo_tasks_status ON video_logo_removal_tasks(status)'
            },
            {
                name: 'idx_video_logo_tasks_created_at',
                field: 'createdAt',
                sql: dialect === 'sqlite' ? 
                    'CREATE INDEX IF NOT EXISTS idx_video_logo_tasks_created_at ON video_logo_removal_tasks(createdAt)' :
                    'CREATE INDEX idx_video_logo_tasks_created_at ON video_logo_removal_tasks(createdAt)'
            }
        ];
        
        for (const index of indexes) {
            try {
                await sequelize.query(index.sql);
                console.log(`✅ 索引创建成功: ${index.name}`);
            } catch (error) {
                // 如果索引已存在，忽略错误
                if (error.message.includes('already exists') || 
                    error.message.includes('Duplicate key name') ||
                    error.message.includes('duplicate column name')) {
                    console.log(`⏭️  索引已存在: ${index.name}`);
                } else {
                    console.warn(`⚠️  创建索引失败 ${index.name}:`, error.message);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ 创建索引失败:', error);
        // 不抛出错误，索引创建失败不应该阻止迁移
    }
}

/**
 * 检查表是否存在
 */
async function checkTableExists() {
    try {
        const dialect = sequelize.getDialect();
        
        let checkSQL;
        if (dialect === 'sqlite') {
            checkSQL = "SELECT name FROM sqlite_master WHERE type='table' AND name='video_logo_removal_tasks'";
        } else {
            checkSQL = "SHOW TABLES LIKE 'video_logo_removal_tasks'";
        }
        
        const [results] = await sequelize.query(checkSQL);
        return results.length > 0;
        
    } catch (error) {
        console.error('检查表存在性失败:', error);
        return false;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    migrateVideoLogoRemoval()
        .then((result) => {
            console.log('✅ 迁移成功:', result);
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ 迁移失败:', error);
            process.exit(1);
        })
        .finally(() => {
            // 关闭数据库连接
            sequelize.close();
        });
}

module.exports = {
    migrateVideoLogoRemoval,
    checkTableExists,
    createIndexes
};
