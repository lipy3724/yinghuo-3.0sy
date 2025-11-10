# 数据库备份报告

**备份时间**: 2025-10-24T03:51:04.528Z
**备份目录**: backup_20251024035104

## 备份结果

- SQLite文件: ✅ 成功
- MySQL数据库: ❌ 失败
- 配置文件: ✅ 成功

## SQLite备份
- 备份了 1 个SQLite文件

## 配置文件备份
- 备份了 4 个配置文件

## 恢复说明

### SQLite恢复
```bash
cp backup_dir/yinghuo.db.backup ./yinghuo.db
```

### MySQL恢复
```bash
mysql -h 127.0.0.1 -u root -p yinghuo < mysql_backup_*.sql
```
