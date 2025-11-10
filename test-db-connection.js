require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 彩色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// 日志文件
const logFile = path.join(__dirname, 'db-test-results.log');
fs.writeFileSync(logFile, `数据库连接测试 - ${new Date().toISOString()}\n\n`);

// 日志函数
function log(message, color = 'reset') {
  const coloredMessage = `${colors[color]}${message}${colors.reset}`;
  console.log(coloredMessage);
  fs.appendFileSync(logFile, `${message}\n`);
}

// 测试数据库连接
async function testDatabaseConnection() {
  log('=== 数据库连接测试 ===', 'cyan');
  
  // 检查环境变量
  log('\n检查数据库环境变量...');
  const requiredVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PORT'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    log(`错误: 缺少必要的数据库环境变量: ${missingVars.join(', ')}`, 'red');
    log('请在.env文件中设置这些变量', 'red');
    return;
  }
  
  log('数据库配置信息:', 'blue');
  log(`DB_HOST: ${process.env.DB_HOST}`);
  log(`DB_USER: ${process.env.DB_USER}`);
  log(`DB_NAME: ${process.env.DB_NAME}`);
  log(`DB_PORT: ${process.env.DB_PORT || '3306'}`);
  log('DB_PASSWORD: ******');
  
  try {
    // 尝试连接数据库
    log('\n尝试连接数据库...');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      connectTimeout: 10000
    });
    
    log('数据库连接成功!', 'green');
    
    // 测试查询
    log('\n执行测试查询...');
    const [rows] = await connection.query('SELECT 1 as result');
    log(`查询结果: ${JSON.stringify(rows[0])}`, 'green');
    
    // 获取数据库信息
    log('\n获取数据库信息...');
    const [dbInfoRows] = await connection.query('SELECT VERSION() as version');
    log(`数据库版本: ${dbInfoRows[0].version}`, 'green');
    
    // 获取表信息
    log('\n获取数据库表信息...');
    const [tables] = await connection.query('SHOW TABLES');
    log(`数据库中的表 (${tables.length}个):`, 'blue');
    
    const tableNames = tables.map(table => Object.values(table)[0]);
    for (const tableName of tableNames) {
      log(`- ${tableName}`);
    }
    
    // 测试事务
    log('\n测试数据库事务...');
    await connection.beginTransaction();
    log('事务开始', 'blue');
    await connection.commit();
    log('事务提交成功', 'green');
    
    // 关闭连接
    await connection.end();
    log('\n数据库连接已关闭', 'blue');
    
    log('\n=== 测试结果 ===', 'cyan');
    log('所有数据库测试通过!', 'green');
    
  } catch (error) {
    log('\n=== 测试失败 ===', 'red');
    log(`错误信息: ${error.message}`, 'red');
    log(`错误代码: ${error.code}`, 'red');
    log(`SQL状态: ${error.sqlState}`, 'red');
    
    // 提供常见错误的解决方案
    if (error.code === 'ECONNREFUSED') {
      log('\n可能的解决方案:', 'yellow');
      log('1. 确认数据库服务是否正在运行');
      log('2. 检查主机名和端口是否正确');
      log('3. 检查防火墙设置是否允许连接');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      log('\n可能的解决方案:', 'yellow');
      log('1. 检查用户名和密码是否正确');
      log('2. 确认用户是否有权限从当前主机连接');
      log('3. 尝试重置用户密码');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      log('\n可能的解决方案:', 'yellow');
      log('1. 确认数据库名称是否正确');
      log('2. 确认数据库是否已创建');
      log(`3. 执行以下SQL创建数据库: CREATE DATABASE ${process.env.DB_NAME};`);
    } else if (error.code === 'ETIMEDOUT') {
      log('\n可能的解决方案:', 'yellow');
      log('1. 检查网络连接');
      log('2. 确认数据库服务器是否接受远程连接');
      log('3. 检查数据库服务器负载是否过高');
    }
  }
}

// 执行测试
testDatabaseConnection();
