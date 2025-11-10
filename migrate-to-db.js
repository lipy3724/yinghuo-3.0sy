#!/usr/bin/env node

const path = require('path');
const fs = require('fs').promises;
const sequelize = require('./config/db');

// 导入迁移文件
const createTableMigration = require('./migrations/create_customer_messages_table');
const migrateDataMigration = require('./migrations/migrate_json_messages_to_db');

async function executemigrations() {
    try {
        console.log('🚀 开始执行数据库迁移...\n');
        
        // 1. 测试数据库连接
        console.log('📡 测试数据库连接...');
        await sequelize.authenticate();
        console.log('✅ 数据库连接成功\n');
        
        // 2. 创建customer_messages表
        console.log('📋 创建customer_messages表...');
        await createTableMigration.up(sequelize.getQueryInterface(), sequelize.constructor);
        console.log('✅ customer_messages表创建成功\n');
        
        // 3. 迁移JSON数据到数据库
        console.log('📦 迁移JSON消息数据到数据库...');
        await migrateDataMigration.up(sequelize.getQueryInterface(), sequelize.constructor);
        console.log('✅ 数据迁移完成\n');
        
        // 4. 验证迁移结果
        console.log('🔍 验证迁移结果...');
        const [results] = await sequelize.query('SELECT COUNT(*) as count FROM customer_messages');
        const totalMessages = results[0].count;
        console.log(`✅ 数据库中共有 ${totalMessages} 条消息记录\n`);
        
        // 5. 显示表结构
        console.log('📊 表结构信息:');
        const [tableInfo] = await sequelize.query(`
            SELECT 
                COLUMN_NAME as '字段名',
                DATA_TYPE as '数据类型',
                IS_NULLABLE as '允许为空',
                COLUMN_DEFAULT as '默认值',
                COLUMN_COMMENT as '注释'
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'customer_messages' 
            AND TABLE_SCHEMA = DATABASE()
            ORDER BY ORDINAL_POSITION
        `);
        
        console.table(tableInfo);
        
        console.log('\n🎉 所有迁移执行完成！');
        console.log('\n📝 接下来的步骤:');
        console.log('1. 更新server.js，使用新的数据库API');
        console.log('2. 测试客服系统功能');
        console.log('3. 备份原有的JSON文件');
        
    } catch (error) {
        console.error('❌ 迁移过程中出错:', error);
        
        // 尝试回滚
        try {
            console.log('\n🔄 尝试回滚迁移...');
            await migrateDataMigration.down(sequelize.getQueryInterface(), sequelize.constructor);
            await createTableMigration.down(sequelize.getQueryInterface(), sequelize.constructor);
            console.log('✅ 回滚完成');
        } catch (rollbackError) {
            console.error('❌ 回滚失败:', rollbackError);
        }
    } finally {
        await sequelize.close();
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    executemigrations();
}

module.exports = executemigrations; 