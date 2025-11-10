const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// 从环境变量中获取数据库配置
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
// 处理密码，如果为空字符串则使用null
const DB_PASSWORD = process.env.DB_PASSWORD === '' ? null : process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME || 'image_translator';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_DIALECT = (process.env.DB_DIALECT || 'mysql').toLowerCase();

let sequelize;

if (DB_DIALECT === 'sqlite') {
  const DB_SQLITE_STORAGE = process.env.DB_SQLITE_STORAGE || path.join(__dirname, '..', 'yinghuo.db');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: DB_SQLITE_STORAGE,
    logging: console.log
  });
} else {
  // 创建Sequelize实例 - 连接到MySQL数据库
  // 格式: new Sequelize('数据库名', '用户名', '密码', 配置对象)
  sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    dialect: 'mysql',
    port: DB_PORT,
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
}

// 测试数据库连接
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功。');
  } catch (error) {
    console.error('无法连接到数据库:', error);
  }
};

testConnection();

module.exports = sequelize; 