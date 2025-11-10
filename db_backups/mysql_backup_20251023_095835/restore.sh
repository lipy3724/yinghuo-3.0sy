#!/bin/bash
# 数据库恢复脚本

echo "开始恢复数据库..."
echo "警告: 此操作将覆盖现有数据库！"
read -p "确认继续吗？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    /Applications/XAMPP/xamppfiles/bin/mysql -h 127.0.0.1 -P 3306 -u root yinghuo < yinghuo_mysql_backup.sql
    if [ $? -eq 0 ]; then
        echo "✅ 数据库恢复成功"
    else
        echo "❌ 数据库恢复失败"
    fi
else
    echo "恢复操作已取消"
fi
