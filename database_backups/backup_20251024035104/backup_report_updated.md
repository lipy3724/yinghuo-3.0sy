# 数据库备份报告

**备份时间**: 2025-10-24T03:51:04.528Z  
**备份目录**: backup_20251024035104  
**更新时间**: 2025-10-24T03:53:22.000Z

## 备份结果

- ✅ SQLite文件: **成功** (1个文件)
- ✅ MySQL数据库: **成功** (14个表)
- ✅ 配置文件: **成功** (4个文件)

## 详细信息

### SQLite备份
- **文件**: `yinghuo.db.backup` (64 KB)
- **状态**: ✅ 完整备份
- **内容**: 项目的SQLite数据库

### MySQL备份
- **文件**: `mysql_backup_20251024035322.sql` (2.13 MB)
- **数据库**: yinghuo
- **表数量**: 14个表
- **数据插入**: 11个表有数据
- **状态**: ✅ 完整备份

#### 备份的表:
1. `credit_histories` - 积分历史记录
2. `customer_assignments` - 客服分配记录
3. `customer_messages` - 客服消息记录
4. `feature_usages` - 功能使用记录
5. `image_colorization_histories` - 图片上色历史
6. `image_histories` - 图片处理历史
7. `migration_history` - 数据库迁移历史
8. `payment_orders` - 支付订单
9. `SequelizeMeta` - Sequelize元数据
10. `users` - 用户表 (36个用户)
11. `users_backup_20251023` - 用户备份表
12. `users_backup_20251024` - 用户备份表
13. `user_sessions` - 用户会话
14. `video_results` - 视频结果

### 配置文件备份
- `package.json` - 项目依赖配置
- `server.js` - 服务器主文件
- `config/db.js` - 数据库配置
- `.env` - 环境变量配置

## 恢复说明

### SQLite恢复
```bash
# 恢复SQLite数据库
cp database_backups/backup_20251024035104/yinghuo.db.backup ./yinghuo.db
```

### MySQL恢复
```bash
# 恢复MySQL数据库
mysql -h 127.0.0.1 -u root -p yinghuo < database_backups/backup_20251024035104/mysql_backup_20251024035322.sql
```

### 配置文件恢复
```bash
# 恢复配置文件
cp database_backups/backup_20251024035104/config/* ./
```

## 备份验证

- ✅ SQLite文件完整性检查通过
- ✅ MySQL备份文件语法正确
- ✅ 包含所有表结构和数据
- ✅ 配置文件完整

## 注意事项

1. 恢复前请先备份当前数据
2. MySQL恢复需要确保目标数据库存在
3. 恢复后需要重启应用服务
4. 建议定期执行数据库备份

---
*备份脚本: backup_database.js*  
*生成时间: 2025-10-24 11:53*
