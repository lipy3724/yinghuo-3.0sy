# 宝塔面板部署说明

## 1. 环境要求
- Node.js 16.x 或以上版本
- PM2 进程管理工具
- MySQL 数据库（如果使用）
- Nginx 反向代理

## 2. 部署步骤

### 2.1 安装 Node.js
1. 在宝塔面板中，进入软件商店
2. 搜索并安装 Node.js 16.x 版本
3. 安装完成后，在终端中验证：
   ```bash
   node -v
   npm -v
   ```

### 2.2 安装 PM2
```bash
npm install pm2 -g
```

### 2.3 项目部署
1. 在宝塔面板中创建网站
2. 将项目文件上传到网站根目录
3. 进入项目目录，安装依赖：
   ```bash
   npm install
   ```
4. 使用 PM2 启动项目：
   ```bash
   pm2 start ecosystem.config.js
   ```

### 2.4 Nginx 配置
在宝塔面板中配置 Nginx，添加以下配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2.5 环境变量配置
1. 在项目根目录创建 `.env` 文件
2. 配置必要的环境变量（根据项目需求）

## 3. 常用命令

### 3.1 PM2 命令
- 查看应用状态：`pm2 status`
- 查看日志：`pm2 logs`
- 重启应用：`pm2 restart custom-image-translator`
- 停止应用：`pm2 stop custom-image-translator`

### 3.2 项目维护
- 更新代码后重启：`pm2 restart custom-image-translator`
- 查看错误日志：`pm2 logs custom-image-translator --err`

## 4. 注意事项
1. 确保服务器防火墙开放了相应端口
2. 定期检查日志文件大小，必要时进行日志轮转
3. 建议配置 SSL 证书，启用 HTTPS
4. 定期备份数据库和上传文件 