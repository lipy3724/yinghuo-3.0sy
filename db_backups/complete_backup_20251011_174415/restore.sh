#!/bin/bash

# 快速恢复脚本
# 使用方法: ./restore.sh [backup_dir]

set -e

BACKUP_DIR="${1:-$(dirname "$0")}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "开始恢复数据库..."
echo "备份目录: $BACKUP_DIR"
echo "项目目录: $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# 恢复SQLite数据库
if [ -f "$BACKUP_DIR/yinghuo.db" ]; then
    echo "恢复SQLite数据库..."
    cp "$BACKUP_DIR/yinghuo.db" ./yinghuo.db
    echo "SQLite数据库恢复完成"
fi

# 恢复其他数据库文件
for db_file in database.db database.sqlite; do
    if [ -f "$BACKUP_DIR/$db_file" ]; then
        cp "$BACKUP_DIR/$db_file" ./$db_file
        echo "已恢复 $db_file"
    fi
done

echo "数据库恢复完成！"
echo "请检查数据完整性并重启应用程序。"
