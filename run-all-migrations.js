#!/usr/bin/env node

const path = require('path');
const fs = require('fs').promises;
const sequelize = require('./config/db');

// 迁移文件名正则，匹配如 add_field_to_table.js 或 create_table.js 的文件
const MIGRATION_FILE_REGEX = /^([a-z0-9_-]+)\.js$/i;

async function runAllMigrations() {
    try {
        console.log('🚀 开始执行所有数据库迁移...\n');
        
        // 1. 测试数据库连接
        console.log('📡 测试数据库连接...');
        await sequelize.authenticate();
        console.log('✅ 数据库连接成功\n');
        
        // 2. 获取所有迁移文件
        console.log('📋 获取迁移文件列表...');
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = await fs.readdir(migrationsDir);
        
        // 过滤出合法的迁移文件
        const migrationFiles = files.filter(file => MIGRATION_FILE_REGEX.test(file));
        console.log(`✅ 找到 ${migrationFiles.length} 个迁移文件\n`);
        
        // 3. 按顺序执行每个迁移
        console.log('🔄 按顺序执行迁移...');
        
        for (const file of migrationFiles) {
            const migrationName = file.replace('.js', '');
            console.log(`🔹 执行迁移: ${migrationName}`);
            
            try {
                // 导入迁移文件
                const migration = require(path.join(migrationsDir, file));
                
                // 执行迁移的up方法
                await migration.up(sequelize.getQueryInterface(), sequelize.constructor);
                console.log(`  ✅ 迁移 ${migrationName} 成功`);
            } catch (migrationError) {
                // 如果字段已存在等非严重错误，继续执行
                if (migrationError.message.includes('already exists')) {
                    console.log(`  ⚠️ 迁移 ${migrationName} 跳过: ${migrationError.message}`);
                } else {
                    throw migrationError;
                }
            }
        }
        
        console.log('\n🎉 所有迁移执行完成！');
        
    } catch (error) {
        console.error('❌ 迁移过程中出错:', error);
    } finally {
        await sequelize.close();
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    runAllMigrations();
}

module.exports = runAllMigrations; 