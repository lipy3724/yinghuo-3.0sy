/**
 * 运行单个迁移脚本
 * 
 * 使用方法：node run-migration.js <迁移脚本路径>
 * 例如：node run-migration.js migrations/colorization/20250918_add_oss_fields_to_colorization_history.js
 */

const path = require('path');
const sequelize = require('./config/db');
const { Sequelize } = require('sequelize');

// 获取迁移脚本路径
const migrationPath = process.argv[2];

if (!migrationPath) {
  console.error('请提供迁移脚本路径');
  console.error('使用方法：node run-migration.js <迁移脚本路径>');
  process.exit(1);
}

// 加载迁移脚本
let migration;
try {
  const fullPath = path.resolve(__dirname, migrationPath);
  console.log(`加载迁移脚本: ${fullPath}`);
  migration = require(fullPath);
} catch (error) {
  console.error(`加载迁移脚本失败: ${error.message}`);
  process.exit(1);
}

// 创建查询接口
const queryInterface = sequelize.getQueryInterface();

// 运行迁移
async function runMigration() {
  try {
    console.log('开始执行迁移...');
    
    // 执行迁移的up方法
    await migration.up(queryInterface, Sequelize);
    
    console.log('迁移执行成功');
    process.exit(0);
  } catch (error) {
    console.error(`迁移执行失败: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// 连接数据库并运行迁移
sequelize.authenticate()
  .then(() => {
    console.log('数据库连接成功');
    return runMigration();
  })
  .catch(error => {
    console.error(`数据库连接失败: ${error.message}`);
    process.exit(1);
  });
