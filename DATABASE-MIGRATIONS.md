# 数据库迁移维护指南

## 问题背景

系统可能出现500错误，尤其是涉及到用户管理页面的操作。这通常是由于数据库表结构与代码模型不匹配导致的。

## 常见错误

1. `Unknown column 'isCustomerService' in 'field list'` - 用户表缺少客服标识字段
2. `Unknown column 'isInternal' in 'field list'` - 用户表缺少内部用户标识字段
3. 其他数据库表结构相关的错误

## 解决方法

### 方法一：使用迁移脚本（推荐）

系统提供了两个迁移脚本：

1. `run-customer-service-migration.js` - 专门为添加客服字段设计
   ```bash
   node run-customer-service-migration.js
   ```

2. `run-all-migrations.js` - 运行所有迁移文件
   ```bash
   node run-all-migrations.js
   ```

### 方法二：手动添加字段

如果迁移脚本不工作，可以手动添加所需字段：

```bash
# 添加isCustomerService字段
node -e "const sequelize = require('./config/db'); async function addColumn() { try { console.log('添加isCustomerService字段...'); await sequelize.query(\"ALTER TABLE users ADD COLUMN isCustomerService TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否为客服人员'\"); console.log('字段添加成功！'); } catch (error) { console.error('Error:', error); } finally { await sequelize.close(); } } addColumn();"
```

## 确认字段添加成功

可以通过以下命令检查数据库表结构：

```bash
# 查看users表结构
node -e "const sequelize = require('./config/db'); async function checkColumns() { try { const [columns] = await sequelize.query('DESCRIBE users'); console.table(columns); } catch (error) { console.error('Error:', error); } finally { await sequelize.close(); } } checkColumns();"
```

## 重启服务器

添加字段后需要重启服务器使更改生效：

```bash
# 查找服务器进程
ps -ef | grep node

# 杀死服务器进程（替换PID为实际进程ID）
kill YOUR_PID_HERE

# 重启服务器
node server.js
```

## 维护注意事项

1. 添加新功能时，如果修改了数据库结构，请创建对应的迁移文件
2. 在迁移文件中同时提供up和down方法，以便回滚
3. 确保在迁移前备份数据库
4. 迁移后进行测试，确保功能正常

## 已添加的迁移文件

目前系统包含以下迁移文件：

- `add_isCustomerService_to_users.js` - 添加客服标识字段
- `create_customer_assignments_table.js` - 创建客户分配表
- `create_customer_messages_table.js` - 创建客户消息表
- `migrate_json_messages_to_db.js` - 将JSON消息迁移到数据库
- `add_ban_fields_to_users.js` - 添加用户封禁相关字段
- `add_last_active_at_to_users.js` - 添加用户最后活跃时间字段
- `create-user-sessions-table.js` - 创建用户会话表
- `add_isInternal_to_users.js` - 添加内部用户标识字段
- `add_remark_to_users.js` - 添加用户备注字段
- `add_qrcode_expire_time.js` - 添加二维码过期时间字段
- `add_sms_columns.js` - 添加短信验证相关字段 