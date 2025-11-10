#!/usr/bin/env node

const path = require('path');
const sequelize = require('./config/db');

// 导入迁移文件
const addIsCustomerServiceMigration = require('./migrations/add_isCustomerService_to_users');

async function executeCustomerServiceMigration() {
    try {
        console.log('🚀 开始执行 isCustomerService 字段迁移...\n');
        
        // 1. 测试数据库连接
        console.log('📡 测试数据库连接...');
        await sequelize.authenticate();
        console.log('✅ 数据库连接成功\n');
        
        // 2. 添加 isCustomerService 字段
        console.log('📋 向users表添加isCustomerService字段...');
        await addIsCustomerServiceMigration.up(sequelize.getQueryInterface(), sequelize.constructor);
        console.log('✅ isCustomerService字段添加成功\n');
        
        // 3. 验证迁移结果
        console.log('🔍 验证迁移结果...');
        const [columns] = await sequelize.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'users' 
            AND TABLE_SCHEMA = DATABASE()
            AND COLUMN_NAME = 'isCustomerService'
        `);
        
        if (columns.length > 0) {
            console.log('✅ isCustomerService字段存在于users表中\n');
        } else {
            throw new Error('isCustomerService字段未成功添加到users表');
        }
        
        console.log('🎉 迁移执行完成！');
        
    } catch (error) {
        console.error('❌ 迁移过程中出错:', error);
        
        if (error.message.includes('already exists')) {
            console.log('💡 提示: isCustomerService字段已经存在于表中，不需要再次添加');
        } else {
            // 尝试回滚
            try {
                console.log('\n🔄 尝试回滚迁移...');
                await addIsCustomerServiceMigration.down(sequelize.getQueryInterface(), sequelize.constructor);
                console.log('✅ 回滚完成');
            } catch (rollbackError) {
                console.error('❌ 回滚失败:', rollbackError);
            }
        }
    } finally {
        await sequelize.close();
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    executeCustomerServiceMigration();
}

module.exports = executeCustomerServiceMigration; 