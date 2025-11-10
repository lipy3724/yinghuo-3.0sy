# 阿里云OSS跨域访问配置指南

## 问题描述
当前项目在访问OSS资源时出现CORS跨域错误：
```
Access to fetch at 'oss-config.js:155' from origin 'http://localhost:8080' has been blocked by CORS policy
```

## 解决方案：在OSS控制台配置跨域规则

### 步骤1：登录阿里云OSS控制台
1. 访问：https://oss.console.aliyun.com/
2. 登录您的阿里云账号
3. 选择对应的地域：`华东1（杭州）`或您配置的地域

### 步骤2：找到您的存储桶
- 存储桶名称：`yinghuo-ai`
- 点击存储桶名称进入管理界面

### 步骤3：配置跨域规则
1. 在左侧菜单中选择"权限管理" → "跨域设置"
2. 点击"设置"或"创建规则"
3. 配置以下参数：

#### 配置参数详情

| 配置项 | 值 | 说明 |
|--------|-----|------|
| **来源（AllowedOrigin）** | `http://localhost:8080` | 允许访问的域名 |
| **允许Methods** | `GET, POST, PUT, DELETE, HEAD` | 允许的HTTP方法 |
| **允许Headers** | `*` | 允许所有请求头 |
| **暴露Headers** | `ETag, x-oss-request-id, Content-Length` | 暴露给客户端的响应头 |
| **缓存时间（秒）** | `0` | 预检请求缓存时间 |

#### 生产环境配置建议

如果您的项目要部署到生产环境，建议添加多个跨域规则：

**规则1：本地开发环境**
- 来源：`http://localhost:8080`
- Methods：`GET, POST, PUT, DELETE, HEAD`
- Headers：`*`

**规则2：生产环境**
- 来源：`https://your-domain.com`（替换为您的实际域名）
- Methods：`GET, POST, PUT, DELETE, HEAD`
- Headers：`*`

**规则3：通用规则（可选，安全性较低）**
- 来源：`*`
- Methods：`GET, HEAD`
- Headers：`*`

### 步骤4：保存并验证
1. 点击"确定"保存配置
2. 等待1-2分钟让配置生效
3. 重新访问您的应用测试功能

## 注意事项

### 安全性建议
1. **避免使用通配符**：不要设置 `AllowedOrigin: *`，这会带来安全风险
2. **最小权限原则**：只开放必要的HTTP方法和请求头
3. **域名白名单**：明确指定允许访问的域名

### 常见问题
1. **配置后仍然出现CORS错误**
   - 等待1-2分钟让配置生效
   - 清除浏览器缓存
   - 检查域名是否完全匹配（包括协议和端口）

2. **多个域名访问**
   - 可以创建多条跨域规则
   - 每个规则对应一个域名或域名模式

3. **HTTPS和HTTP混用**
   - 确保协议匹配（http vs https）
   - 生产环境建议全部使用HTTPS

## 验证配置是否成功

配置完成后，可以通过以下方式验证：

1. **浏览器开发者工具**
   - 打开Network面板
   - 查看OSS请求的响应头
   - 确认包含 `Access-Control-Allow-Origin` 头

2. **命令行测试**
```bash
curl -H "Origin: http://localhost:8080" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     https://yinghuo-ai.oss-cn-shanghai.aliyuncs.com/
```

3. **应用功能测试**
   - 重启本地服务器
   - 测试文生图片历史记录功能
   - 确认不再出现CORS错误

## 配置完成后的效果

正确配置后，您应该能够：
- ✅ 正常获取OSS中的历史记录数据
- ✅ 成功上传图片到OSS
- ✅ 不再看到CORS相关的错误信息
- ✅ 所有图片处理功能正常工作

---

**配置时间**: 2025-09-26
**更新人**: AI助手
**适用版本**: 阿里云OSS当前版本




