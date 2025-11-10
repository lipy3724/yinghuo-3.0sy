# 数据库导入说明

## 问题分析
原始备份文件存在以下问题：
1. 索引键长度超过MySQL限制 (767字节)
2. 表依赖关系导致的导入顺序问题
3. 字符集设置不一致

## 解决方案
已创建修复版本: `mysql_backup_clean.sql`

## 导入步骤

### 方法1: 使用MySQL命令行 (推荐)
```bash
# 1. 登录MySQL
mysql -u root -p

# 2. 在MySQL中执行
source database_backups/backup_20251024035104/mysql_backup_clean.sql;

# 3. 验证导入
USE yinghuo;
SHOW TABLES;
```

### 方法2: 使用命令行导入
```bash
mysql -u root -p < database_backups/backup_20251024035104/mysql_backup_clean.sql
```

### 方法3: 使用Node.js脚本
```bash
node fix_import_issues.js
```

## 验证导入结果
```sql
USE yinghuo;
SHOW TABLES;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM image_histories;
```

## 注意事项
1. 确保MySQL服务正在运行
2. 确保有足够的权限创建数据库和表
3. 如果数据库已存在，建议先备份现有数据
4. 导入过程中可能会有一些警告，这是正常的

生成时间: 2025/10/24 13:37:20
