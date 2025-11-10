#!/usr/bin/env node

const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'yinghuo';
  const port = Number(process.env.DB_PORT || 3306);

  // 尝试无数据库名连接
  const connection = await mysql.createConnection({
    host,
    user,
    password,
    port,
    // 关闭ssl，避免本地XAMPP或旧mysql客户端的TLS握手问题
    ssl: false,
  });

  try {
    await connection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    const [rows] = await connection.query('SHOW DATABASES LIKE ?;', [database]);
    if (rows.length > 0) {
      console.log(`✅ 数据库 ${database} 已存在或创建成功`);
    } else {
      console.error(`❌ 未能创建数据库 ${database}`);
      process.exitCode = 1;
    }
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('创建数据库失败:', err);
  process.exit(1);
});


