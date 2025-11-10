const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { exec } = require('child_process');
const util = require('util');
require('dotenv').config();

const execAsync = util.promisify(exec);

// 获取当前时间戳
function getTimestamp() {
    const now = new Date();
    return now.toISOString()
        .replace(/[:\-T]/g, '')
        .replace(/\..+/, '')
        .slice(0, 14); // YYYYMMDDHHMMSS
}

// 创建备份目录
function createBackupDir() {
    const timestamp = getTimestamp();
    const backupDir = path.join(__dirname, 'database_backups', `backup_${timestamp}`);
    
    if (!fs.existsSync(path.dirname(backupDir))) {
        fs.mkdirSync(path.dirname(backupDir), { recursive: true });
    }
    
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    
    return backupDir;
}

// 备份SQLite数据库
async function backupSQLite(backupDir) {
    console.log('🗃️ 开始备份SQLite数据库...');
    
    const sqliteFiles = [
        'yinghuo.db',
        'database.db', 
        'database.sqlite'
    ];
    
    let backedUpFiles = 0;
    
    for (const file of sqliteFiles) {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size > 0) {
                const backupPath = path.join(backupDir, `${file}.backup`);
                fs.copyFileSync(filePath, backupPath);
                console.log(`✅ SQLite备份完成: ${file} -> ${path.basename(backupPath)}`);
                backedUpFiles++;
            } else {
                console.log(`⚠️ 跳过空文件: ${file}`);
            }
        }
    }
    
    if (backedUpFiles === 0) {
        console.log('⚠️ 未找到有效的SQLite数据库文件');
    }
    
    return backedUpFiles;
}

// 备份MySQL数据库
async function backupMySQL(backupDir) {
    console.log('🐬 开始备份MySQL数据库...');
    
    const dbConfig = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'yinghuo'
    };
    
    let connection;
    
    try {
        // 测试连接
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ MySQL连接成功');
        
        // 获取所有表名
        const [tables] = await connection.execute(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = ?
        `, [dbConfig.database]);
        
        if (tables.length === 0) {
            console.log('⚠️ 数据库中没有找到表');
            return false;
        }
        
        console.log(`📊 找到 ${tables.length} 个表: ${tables.map(t => t.TABLE_NAME).join(', ')}`);
        
        // 生成备份SQL文件
        const timestamp = getTimestamp();
        const backupFile = path.join(backupDir, `mysql_backup_${timestamp}.sql`);
        
        // 构建mysqldump命令
        let mysqldumpCmd = `mysqldump`;
        mysqldumpCmd += ` -h ${dbConfig.host}`;
        mysqldumpCmd += ` -P ${dbConfig.port}`;
        mysqldumpCmd += ` -u ${dbConfig.user}`;
        
        if (dbConfig.password) {
            mysqldumpCmd += ` -p'${dbConfig.password}'`;
        }
        
        mysqldumpCmd += ` --single-transaction`;
        mysqldumpCmd += ` --routines`;
        mysqldumpCmd += ` --triggers`;
        mysqldumpCmd += ` --default-character-set=utf8mb4`;
        mysqldumpCmd += ` ${dbConfig.database}`;
        mysqldumpCmd += ` > "${backupFile}"`;
        
        try {
            await execAsync(mysqldumpCmd);
            
            // 验证备份文件
            if (fs.existsSync(backupFile)) {
                const stats = fs.statSync(backupFile);
                if (stats.size > 0) {
                    console.log(`✅ MySQL备份完成: ${path.basename(backupFile)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                    return true;
                } else {
                    console.log('❌ 备份文件为空');
                    return false;
                }
            } else {
                console.log('❌ 备份文件未生成');
                return false;
            }
        } catch (error) {
            console.log('⚠️ mysqldump命令失败，尝试使用Node.js方式备份...');
            return await backupMySQLWithNode(connection, backupFile, tables);
        }
        
    } catch (error) {
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('❌ MySQL访问被拒绝，请检查用户名和密码');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('❌ 无法连接到MySQL服务器，请确保MySQL服务正在运行');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.log(`❌ 数据库 '${dbConfig.database}' 不存在`);
        } else {
            console.log(`❌ MySQL备份失败: ${error.message}`);
        }
        return false;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// 使用Node.js方式备份MySQL
async function backupMySQLWithNode(connection, backupFile, tables) {
    console.log('📝 使用Node.js方式生成SQL备份...');
    
    try {
        let sqlContent = `-- MySQL Database Backup\n`;
        sqlContent += `-- Generated on: ${new Date().toISOString()}\n`;
        sqlContent += `-- Database: ${process.env.DB_NAME || 'yinghuo'}\n\n`;
        sqlContent += `SET NAMES utf8mb4;\n`;
        sqlContent += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;
        
        for (const table of tables) {
            const tableName = table.TABLE_NAME;
            console.log(`📋 备份表: ${tableName}`);
            
            // 获取表结构
            const [createTable] = await connection.execute(`SHOW CREATE TABLE \`${tableName}\``);
            sqlContent += `-- Table structure for ${tableName}\n`;
            sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
            sqlContent += `${createTable[0]['Create Table']};\n\n`;
            
            // 获取表数据
            const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);
            
            if (rows.length > 0) {
                sqlContent += `-- Data for table ${tableName}\n`;
                sqlContent += `INSERT INTO \`${tableName}\` VALUES\n`;
                
                const values = rows.map(row => {
                    const rowValues = Object.values(row).map(value => {
                        if (value === null) return 'NULL';
                        if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
                        if (value instanceof Date) {
                            // 处理有效的日期
                            if (!isNaN(value.getTime())) {
                                return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
                            } else {
                                return 'NULL';
                            }
                        }
                        if (typeof value === 'object' && value !== null) {
                            // 处理其他对象类型，如Buffer等
                            return `'${JSON.stringify(value).replace(/'/g, "\\'")}'`;
                        }
                        return value;
                    });
                    return `(${rowValues.join(',')})`;
                });
                
                sqlContent += values.join(',\n') + ';\n\n';
            }
        }
        
        sqlContent += `SET FOREIGN_KEY_CHECKS = 1;\n`;
        
        fs.writeFileSync(backupFile, sqlContent, 'utf8');
        
        const stats = fs.statSync(backupFile);
        console.log(`✅ Node.js MySQL备份完成: ${path.basename(backupFile)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return true;
        
    } catch (error) {
        console.log(`❌ Node.js备份失败: ${error.message}`);
        return false;
    }
}

// 备份配置文件
function backupConfig(backupDir) {
    console.log('⚙️ 备份配置文件...');
    
    const configFiles = [
        'package.json',
        'server.js',
        'config/db.js',
        '.env'
    ];
    
    const configDir = path.join(backupDir, 'config');
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir);
    }
    
    let backedUpConfigs = 0;
    
    for (const file of configFiles) {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            const backupPath = path.join(configDir, path.basename(file));
            fs.copyFileSync(filePath, backupPath);
            console.log(`✅ 配置文件备份: ${file}`);
            backedUpConfigs++;
        }
    }
    
    return backedUpConfigs;
}

// 生成备份报告
function generateReport(backupDir, results) {
    const reportFile = path.join(backupDir, 'backup_report.md');
    const timestamp = new Date().toISOString();
    
    let report = `# 数据库备份报告\n\n`;
    report += `**备份时间**: ${timestamp}\n`;
    report += `**备份目录**: ${path.basename(backupDir)}\n\n`;
    
    report += `## 备份结果\n\n`;
    report += `- SQLite文件: ${results.sqlite ? '✅ 成功' : '❌ 失败'}\n`;
    report += `- MySQL数据库: ${results.mysql ? '✅ 成功' : '❌ 失败'}\n`;
    report += `- 配置文件: ${results.config > 0 ? '✅ 成功' : '❌ 失败'}\n\n`;
    
    if (results.sqlite) {
        report += `## SQLite备份\n`;
        report += `- 备份了 ${results.sqliteCount} 个SQLite文件\n\n`;
    }
    
    if (results.mysql) {
        report += `## MySQL备份\n`;
        report += `- 数据库: ${process.env.DB_NAME || 'yinghuo'}\n`;
        report += `- 主机: ${process.env.DB_HOST || '127.0.0.1'}\n\n`;
    }
    
    report += `## 配置文件备份\n`;
    report += `- 备份了 ${results.config} 个配置文件\n\n`;
    
    report += `## 恢复说明\n\n`;
    report += `### SQLite恢复\n`;
    report += `\`\`\`bash\n`;
    report += `cp backup_dir/yinghuo.db.backup ./yinghuo.db\n`;
    report += `\`\`\`\n\n`;
    
    report += `### MySQL恢复\n`;
    report += `\`\`\`bash\n`;
    report += `mysql -h 127.0.0.1 -u root -p yinghuo < mysql_backup_*.sql\n`;
    report += `\`\`\`\n`;
    
    fs.writeFileSync(reportFile, report);
    console.log(`📋 备份报告已生成: ${path.basename(reportFile)}`);
}

// 主备份函数
async function performBackup() {
    console.log('🚀 开始数据库备份...\n');
    
    const backupDir = createBackupDir();
    console.log(`📁 备份目录: ${backupDir}\n`);
    
    const results = {
        sqlite: false,
        sqliteCount: 0,
        mysql: false,
        config: 0
    };
    
    try {
        // 备份SQLite
        results.sqliteCount = await backupSQLite(backupDir);
        results.sqlite = results.sqliteCount > 0;
        
        console.log('');
        
        // 备份MySQL
        results.mysql = await backupMySQL(backupDir);
        
        console.log('');
        
        // 备份配置文件
        results.config = backupConfig(backupDir);
        
        console.log('');
        
        // 生成报告
        generateReport(backupDir, results);
        
        console.log('\n🎉 数据库备份完成！');
        console.log(`📁 备份位置: ${backupDir}`);
        
        if (results.sqlite || results.mysql) {
            console.log('✅ 至少一个数据库备份成功');
        } else {
            console.log('⚠️ 没有成功备份任何数据库');
        }
        
    } catch (error) {
        console.error('❌ 备份过程中发生错误:', error.message);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    performBackup();
}

module.exports = { performBackup };
