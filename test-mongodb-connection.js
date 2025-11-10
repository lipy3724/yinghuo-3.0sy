require('dotenv').config();
const { MongoClient } = require('mongodb');
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
const logFile = path.join(__dirname, 'mongodb-test-results.log');
fs.writeFileSync(logFile, `MongoDB连接测试 - ${new Date().toISOString()}\n\n`);

// 日志函数
function log(message, color = 'reset') {
  const coloredMessage = `${colors[color]}${message}${colors.reset}`;
  console.log(coloredMessage);
  fs.appendFileSync(logFile, `${message}\n`);
}

// 测试MongoDB连接
async function testMongoDBConnection() {
  log('=== MongoDB连接测试 ===', 'cyan');
  
  // 检查环境变量
  log('\n检查MongoDB环境变量...');
  if (!process.env.MONGODB_URI) {
    log('错误: 缺少必要的MongoDB环境变量: MONGODB_URI', 'red');
    log('请在.env文件中设置MONGODB_URI变量', 'red');
    return;
  }
  
  log('MongoDB配置信息:', 'blue');
  log(`MONGODB_URI: ${process.env.MONGODB_URI.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:******@')}`);
  
  let client;
  try {
    // 尝试连接MongoDB
    log('\n尝试连接MongoDB...');
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    log('MongoDB连接成功!', 'green');
    
    // 获取数据库信息
    const adminDb = client.db('admin');
    const serverInfo = await adminDb.command({ serverStatus: 1 });
    
    log('\n获取MongoDB服务器信息...', 'blue');
    log(`MongoDB版本: ${serverInfo.version}`, 'green');
    log(`进程ID: ${serverInfo.pid}`, 'green');
    log(`正常运行时间: ${serverInfo.uptime.toFixed(2)}秒`, 'green');
    
    // 获取数据库列表
    log('\n获取数据库列表...', 'blue');
    const databasesList = await client.db().admin().listDatabases();
    log(`数据库列表 (${databasesList.databases.length}个):`, 'blue');
    
    for (const db of databasesList.databases) {
      log(`- ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    }
    
    // 获取指定数据库的集合
    const dbName = process.env.MONGODB_URI.split('/').pop().split('?')[0];
    log(`\n获取 "${dbName}" 数据库中的集合...`, 'blue');
    
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    
    if (collections.length === 0) {
      log(`数据库 "${dbName}" 中没有集合`, 'yellow');
    } else {
      log(`数据库 "${dbName}" 中的集合 (${collections.length}个):`, 'blue');
      for (const collection of collections) {
        log(`- ${collection.name}`);
        
        // 获取集合中的文档数量
        const count = await db.collection(collection.name).countDocuments();
        log(`  文档数量: ${count}`);
      }
    }
    
    log('\n=== 测试结果 ===', 'cyan');
    log('所有MongoDB测试通过!', 'green');
    
  } catch (error) {
    log('\n=== 测试失败 ===', 'red');
    log(`错误信息: ${error.message}`, 'red');
    log(`错误代码: ${error.code || 'N/A'}`, 'red');
    
    // 提供常见错误的解决方案
    if (error.message.includes('ECONNREFUSED')) {
      log('\n可能的解决方案:', 'yellow');
      log('1. 确认MongoDB服务是否正在运行');
      log('2. 检查主机名和端口是否正确');
      log('3. 检查防火墙设置是否允许连接');
    } else if (error.message.includes('Authentication failed')) {
      log('\n可能的解决方案:', 'yellow');
      log('1. 检查用户名和密码是否正确');
      log('2. 确认用户是否有权限访问指定的数据库');
    } else if (error.message.includes('ETIMEDOUT')) {
      log('\n可能的解决方案:', 'yellow');
      log('1. 检查网络连接');
      log('2. 确认MongoDB服务器是否接受远程连接');
      log('3. 检查MongoDB服务器负载是否过高');
    }
  } finally {
    // 关闭连接
    if (client) {
      await client.close();
      log('\nMongoDB连接已关闭', 'blue');
    }
  }
}

// 执行测试
testMongoDBConnection();
