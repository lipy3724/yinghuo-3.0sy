# 🗄️ 映火AI项目 - XAMPP MySQL数据库备份指南

> **重要说明**: 本项目使用XAMPP中的MySQL数据库作为主数据库，而不是SQLite！  
> **创建时间**: 2025年10月11日  
> **版本**: v1.0  
> **适用项目**: 映火AI图像处理平台  

---

## 📋 数据库概览

### 🎯 正确的数据库配置
- **数据库类型**: MySQL (MariaDB 10.4.28)
- **服务提供**: XAMPP
- **数据库名称**: `yinghuo`
- **连接地址**: 127.0.0.1:3306
- **用户名**: root
- **密码**: 无密码

### 📊 当前数据库状态
- **用户数量**: 18个用户
- **功能使用记录**: 183条记录
- **图片历史记录**: 2条记录
- **客服消息**: 26条消息
- **支付订单**: 69个订单
- **数据表总数**: 11个表

### 🏗️ 数据库表结构
```
1. users - 用户表
2. feature_usages - 功能使用记录
3. image_histories - 图片历史记录
4. customer_messages - 客服消息
5. payment_orders - 支付订单
6. customer_assignments - 客服分配
7. image_colorization_histories - 图片上色历史
8. user_sessions - 用户会话
9. video_results - 视频处理结果
10. SequelizeMeta - 数据库迁移记录
11. migration_history - 迁移历史
```

---

## 🚀 快速备份

### 立即执行XAMPP MySQL备份
```bash
# 进入项目目录
cd /Users/houkai/Documents/Yinghuo1/积分end

# 执行XAMPP MySQL备份
./scripts/xampp-mysql-backup.sh
```

### 备份结果
- **备份文件**: `yinghuo_mysql_backup.sql` (1.9MB)
- **压缩文件**: `mysql_backup_YYYYMMDD_HHMMSS.tar.gz` (293KB)
- **恢复脚本**: `restore.sh`

---

## 📁 备份文件结构

### 最新备份位置
```
db_backups/mysql_backup_20251011_175138/
├── backup_info.txt                    # 详细备份信息
├── yinghuo_mysql_backup.sql          # MySQL数据库备份文件
└── restore.sh                        # 快速恢复脚本

db_backups/mysql_backup_20251011_175138.tar.gz  # 压缩备份文件
```

---

## 🔄 数据库恢复指南

### 方法一：使用快速恢复脚本（推荐）
```bash
# 进入备份目录
cd db_backups/mysql_backup_20251011_175138

# 执行恢复脚本
./restore.sh
```

**恢复选项**:
1. 恢复到原数据库 (yinghuo) - 会覆盖现有数据
2. 恢复到新数据库 (yinghuo_restore) - 保留原数据
3. 查看备份信息
4. 退出

### 方法二：手动恢复到原数据库
```bash
# 确保XAMPP MySQL服务正在运行
# 恢复数据库
/Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot yinghuo < db_backups/mysql_backup_20251011_175138/yinghuo_mysql_backup.sql
```

### 方法三：恢复到新数据库
```bash
# 创建新数据库
/Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "CREATE DATABASE yinghuo_restore;"

# 恢复数据
/Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot yinghuo_restore < db_backups/mysql_backup_20251011_175138/yinghuo_mysql_backup.sql
```

### 方法四：从压缩文件恢复
```bash
# 解压备份文件
tar -xzf db_backups/mysql_backup_20251011_175138.tar.gz -C db_backups/

# 执行恢复
cd db_backups/mysql_backup_20251011_175138
./restore.sh
```

---

## 🔍 备份验证

### 检查XAMPP MySQL服务状态
```bash
# 检查XAMPP状态
sudo /Applications/XAMPP/xamppfiles/xampp status

# 直接测试MySQL连接
/Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "SELECT VERSION();"
```

### 验证备份数据完整性
```bash
# 检查数据库表
/Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "USE yinghuo; SHOW TABLES;"

# 检查数据数量
/Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "
USE yinghuo;
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'feature_usages', COUNT(*) FROM feature_usages
UNION ALL
SELECT 'image_histories', COUNT(*) FROM image_histories
UNION ALL
SELECT 'customer_messages', COUNT(*) FROM customer_messages
UNION ALL
SELECT 'payment_orders', COUNT(*) FROM payment_orders;
"
```

**预期结果**:
```
users: 18
feature_usages: 183
image_histories: 2
customer_messages: 26
payment_orders: 69
```

---

## ⚙️ 自动化备份设置

### 创建每日自动备份
```bash
# 创建每日备份脚本
cat > scripts/daily-xampp-backup.sh << 'EOF'
#!/bin/bash
cd /Users/houkai/Documents/Yinghuo1/积分end
./scripts/xampp-mysql-backup.sh
EOF

chmod +x scripts/daily-xampp-backup.sh
```

### 设置定时任务
```bash
# 添加到crontab（每日凌晨2点备份）
echo "0 2 * * * cd /Users/houkai/Documents/Yinghuo1/积分end && ./scripts/daily-xampp-backup.sh" | crontab -

# 查看定时任务
crontab -l
```

---

## 🛡️ 重要注意事项

### ⚠️ 数据库配置澄清
1. **主数据库**: XAMPP MySQL `yinghuo` 数据库
2. **SQLite文件**: `yinghuo.db` 是旧的或测试用的，数据量很少
3. **生产数据**: 全部在XAMPP MySQL中

### 🔧 XAMPP要求
- **XAMPP必须启动**: 确保XAMPP控制面板中MySQL服务正在运行
- **端口配置**: 默认端口3306，确保没有冲突
- **权限设置**: root用户无密码（XAMPP默认配置）

### 📊 备份策略
- **备份频率**: 建议每日备份
- **保留策略**: 保留最近7个备份
- **存储位置**: `db_backups/` 目录
- **压缩存储**: 自动压缩备份文件节省空间

---

## 🚨 故障排除

### 常见问题

#### 1. XAMPP MySQL无法连接
```bash
# 检查XAMPP状态
sudo /Applications/XAMPP/xamppfiles/xampp status

# 启动XAMPP MySQL
sudo /Applications/XAMPP/xamppfiles/xampp startmysql

# 检查端口占用
lsof -i :3306
```

#### 2. 备份文件过大
```bash
# 检查数据库大小
/Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "
SELECT 
    table_schema as 'Database',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as 'Size (MB)'
FROM information_schema.tables 
WHERE table_schema = 'yinghuo'
GROUP BY table_schema;
"
```

#### 3. 恢复后数据不一致
```bash
# 检查数据库完整性
/Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "USE yinghuo; CHECK TABLE users, feature_usages, image_histories;"

# 重新统计表信息
/Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "USE yinghuo; ANALYZE TABLE users, feature_usages, image_histories;"
```

#### 4. 权限问题
```bash
# 检查MySQL用户权限
/Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "SHOW GRANTS FOR 'root'@'localhost';"

# 重置root权限（如果需要）
/Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost';"
```

---

## 📈 备份监控

### 备份状态检查脚本
```bash
# 创建XAMPP MySQL备份状态检查脚本
cat > scripts/check-xampp-backup-status.sh << 'EOF'
#!/bin/bash

echo "XAMPP MySQL备份状态检查"
echo "======================"

# 检查XAMPP MySQL服务
if /Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "SELECT 1;" >/dev/null 2>&1; then
    echo "✅ XAMPP MySQL服务: 正常"
else
    echo "❌ XAMPP MySQL服务: 异常"
fi

# 检查最新备份
LATEST_BACKUP=$(find db_backups -name "mysql_backup_*" -type d | sort | tail -1)
if [ -n "$LATEST_BACKUP" ]; then
    echo "✅ 最新备份: $(basename "$LATEST_BACKUP")"
    echo "   备份大小: $(du -sh "$LATEST_BACKUP" | cut -f1)"
else
    echo "❌ 未找到备份文件"
fi

# 检查数据库数据量
echo ""
echo "数据库统计:"
/Applications/XAMPP/bin/mysql -h127.0.0.1 -uroot -e "
USE yinghuo;
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'feature_usages', COUNT(*) FROM feature_usages
UNION ALL SELECT 'image_histories', COUNT(*) FROM image_histories;
" 2>/dev/null || echo "无法获取数据库统计"
EOF

chmod +x scripts/check-xampp-backup-status.sh
```

### 使用监控脚本
```bash
./scripts/check-xampp-backup-status.sh
```

---

## 📞 技术支持

### 相关文档
- `README.md` - 项目总体说明
- `数据库配置说明.md` - 数据库配置详情
- `故障排查指南.md` - 常见问题解决方案

### 备份文件位置
- **备份目录**: `db_backups/mysql_backup_*/`
- **压缩文件**: `db_backups/mysql_backup_*.tar.gz`
- **日志文件**: `logs/mysql_backup.log`

### 紧急恢复联系
如遇到严重数据库问题：
1. 立即停止应用程序
2. 使用最新备份恢复
3. 检查数据完整性
4. 重启应用程序

---

## 📝 备份检查清单

### 每日检查
- [ ] XAMPP MySQL服务是否正常运行
- [ ] 备份脚本是否成功执行
- [ ] 备份文件是否正常生成
- [ ] 磁盘空间是否充足

### 每周检查
- [ ] 测试备份恢复流程
- [ ] 验证数据完整性
- [ ] 清理过期备份文件
- [ ] 检查备份日志

### 每月检查
- [ ] 全面测试恢复流程
- [ ] 备份到异地存储
- [ ] 更新备份策略
- [ ] 文档更新

---

**最后更新**: 2025年10月11日 17:51:38  
**备份状态**: ✅ XAMPP MySQL备份正常运行  
**下次备份**: 建议设置每日自动备份  
**数据库**: XAMPP MySQL `yinghuo` (18用户, 183功能记录, 69订单)










