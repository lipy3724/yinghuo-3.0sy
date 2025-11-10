/**
 * 数据库迁移运行器
 * 用于执行数据库迁移文件
 */

const fs = require('fs');
const path = require('path');
const sequelize = require('../config/db');

/**
 * 运行所有迁移文件
 */
async function runMigrations() {
    try {
        console.log('🚀 开始运行数据库迁移...');
        
        // 确保数据库连接正常
        await sequelize.authenticate();
        console.log('✅ 数据库连接成功');
        
        // 获取迁移文件目录
        const migrationsDir = path.join(__dirname, '..', 'migrations');
        
        // 检查迁移目录是否存在
        if (!fs.existsSync(migrationsDir)) {
            console.log('📁 创建迁移目录:', migrationsDir);
            fs.mkdirSync(migrationsDir, { recursive: true });
        }
        
        // 读取所有迁移文件
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.js'))
            .sort(); // 按文件名排序执行
        
        if (migrationFiles.length === 0) {
            console.log('📝 没有找到迁移文件');
            return;
        }
        
        console.log(`📋 找到 ${migrationFiles.length} 个迁移文件:`);
        migrationFiles.forEach(file => console.log(`   - ${file}`));
        
        // 创建迁移历史表（如果不存在）
        await createMigrationTable();
        
        // 执行每个迁移文件
        for (const file of migrationFiles) {
            await runSingleMigration(file, migrationsDir);
        }
        
        console.log('🎉 所有迁移执行完成！');
        
    } catch (error) {
        console.error('❌ 迁移执行失败:', error);
        process.exit(1);
    } finally {
        // 关闭数据库连接
        await sequelize.close();
    }
}

/**
 * 创建迁移历史表
 */
async function createMigrationTable() {
    try {
        // 检查数据库类型
        const dialect = sequelize.getDialect();
        
        let createTableSQL;
        if (dialect === 'sqlite') {
            createTableSQL = `
                CREATE TABLE IF NOT EXISTS migration_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    migration_name VARCHAR(255) NOT NULL UNIQUE,
                    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;
        } else {
            createTableSQL = `
                CREATE TABLE IF NOT EXISTS migration_history (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    migration_name VARCHAR(255) NOT NULL UNIQUE,
                    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;
        }
        
        await sequelize.query(createTableSQL);
        console.log('✅ 迁移历史表已准备就绪');
        
        // 等待一秒确保表创建完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        
    } catch (error) {
        console.error('❌ 创建迁移历史表失败:', error);
        throw error;
    }
}

/**
 * 执行单个迁移文件
 */
async function runSingleMigration(filename, migrationsDir) {
    try {
        // 检查是否已经执行过
        const [results] = await sequelize.query(
            'SELECT * FROM migration_history WHERE migration_name = ?',
            { replacements: [filename] }
        );
        
        if (results.length > 0) {
            console.log(`⏭️  跳过已执行的迁移: ${filename}`);
            return;
        }
        
        console.log(`🔄 执行迁移: ${filename}`);
        
        // 加载迁移文件
        const migrationPath = path.join(migrationsDir, filename);
        const migration = require(migrationPath);
        
        // 执行up方法
        if (typeof migration.up === 'function') {
            await migration.up(sequelize.getQueryInterface(), sequelize.constructor);
            
            // 记录到迁移历史
            await sequelize.query(
                'INSERT INTO migration_history (migration_name) VALUES (?)',
                { replacements: [filename] }
            );
            
            console.log(`✅ 迁移完成: ${filename}`);
        } else {
            console.warn(`⚠️  迁移文件 ${filename} 没有up方法`);
        }
        
    } catch (error) {
        console.error(`❌ 执行迁移 ${filename} 失败:`, error);
        throw error;
    }
}

/**
 * 回滚迁移（可选功能）
 */
async function rollbackMigration(filename) {
    try {
        console.log(`🔄 回滚迁移: ${filename}`);
        
        const migrationsDir = path.join(__dirname, '..', 'migrations');
        const migrationPath = path.join(migrationsDir, filename);
        const migration = require(migrationPath);
        
        if (typeof migration.down === 'function') {
            await migration.down(sequelize.getQueryInterface(), sequelize.constructor);
            
            // 从迁移历史中删除记录
            await sequelize.query(
                'DELETE FROM migration_history WHERE migration_name = ?',
                { replacements: [filename] }
            );
            
            console.log(`✅ 回滚完成: ${filename}`);
        } else {
            console.warn(`⚠️  迁移文件 ${filename} 没有down方法`);
        }
        
    } catch (error) {
        console.error(`❌ 回滚迁移 ${filename} 失败:`, error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const command = process.argv[2];
    const filename = process.argv[3];
    
    if (command === 'rollback' && filename) {
        rollbackMigration(filename).then(() => {
            console.log('回滚完成');
            process.exit(0);
        }).catch(error => {
            console.error('回滚失败:', error);
            process.exit(1);
        });
    } else {
        runMigrations();
    }
}

module.exports = {
    runMigrations,
    rollbackMigration
};
