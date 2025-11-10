# 萤火AI客服系统

## 系统简介

这是一个简单而实用的在线客服系统，为萤火AI平台提供用户支持服务。系统采用前后端分离架构，支持实时消息收发、用户管理和消息状态跟踪。

**🆕 数据库版本已发布！** 现在支持MySQL数据库存储，提供更好的性能和扩展性。

## 功能特点

### 用户端功能
- **浮动客服按钮**：固定在页面右下角，点击即可打开聊天窗口
- **实时聊天**：支持文字消息发送和接收
- **未读消息提示**：红色徽章显示未读消息数量
- **历史消息**：自动加载用户的历史对话记录
- **响应式设计**：完美适配桌面端和移动端
- **用户识别**：自动识别登录用户，访客使用临时ID

### 管理员功能
- **双栏布局**：类似微信客服的用户列表+对话界面设计
- **用户列表**：左侧显示所有用户及最新消息预览
- **点击进入对话**：点击用户后查看完整对话记录
- **实时回复**：直接在对话界面回复用户消息
- **消息状态**：标记消息为已读/未读状态
- **统计信息**：显示总消息数、未读消息、用户数、今日消息等
- **未读提醒**：红色徽章显示未读消息数量
- **智能排序**：按最后活跃时间排序用户
- **消息过滤**：可按已读/未读状态过滤用户
- **批量标记**：一键标记当前用户所有消息为已读
- **快捷操作**：支持Ctrl+Enter快速发送回复
- **自动刷新**：每30秒自动刷新消息列表

## 文件结构

```
kefu/
├── kefu.js              # 后端路由和API接口（JSON版本）
├── kefu-db.js           # 后端路由和API接口（数据库版本）⭐️
├── messages.json        # 消息存储文件（JSON版本）
└── README.md           # 本说明文档

models/
└── CustomerMessage.js   # 客户消息数据模型 ⭐️

migrations/
├── create_customer_messages_table.js      # 创建消息表迁移 ⭐️
└── migrate_json_messages_to_db.js         # JSON数据迁移脚本 ⭐️

components/
├── customer-service.html # 客服组件HTML
└── components.js        # 组件加载器

public/
└── adminkefu.html       # 管理员后台页面

migrate-to-db.js         # 数据库迁移执行脚本 ⭐️
```

## 🚀 数据库版本升级指南

### 为什么升级到数据库版本？

1. **性能提升**：数据库查询比JSON文件读写更高效
2. **数据完整性**：支持事务、约束和索引
3. **扩展性**：支持复杂查询、分页、排序
4. **并发安全**：避免JSON文件并发写入问题
5. **数据分析**：可以进行统计分析和报表生成

### 升级步骤

#### 1. 执行数据库迁移

```bash
# 执行迁移脚本
node migrate-to-db.js
```

迁移脚本会自动完成：
- ✅ 创建 `customer_messages` 表
- ✅ 迁移现有JSON数据到数据库
- ✅ 备份原JSON文件
- ✅ 验证迁移结果

#### 2. 更新服务器配置

在 `server.js` 中替换客服路由：

```javascript
// 替换原有的JSON版本
// app.use('/api/kefu', require('./kefu/kefu'));

// 使用新的数据库版本
app.use('/api/kefu', require('./kefu/kefu-db'));
```

#### 3. 测试系统功能

- 测试用户端发送消息
- 测试管理员端回复消息
- 验证消息状态更新
- 检查统计数据准确性

### 数据库表结构

`customer_messages` 表字段说明：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT | 消息ID（主键） |
| userId | INT | 用户ID（外键关联users表） |
| message | TEXT | 消息内容 |
| type | ENUM('user','admin') | 消息类型 |
| status | ENUM('unread','read') | 消息状态 |
| sessionId | VARCHAR(100) | 会话ID |
| adminId | INT | 客服ID（回复消息时） |
| channel | VARCHAR(50) | 消息来源渠道 |
| ipAddress | VARCHAR(50) | 用户IP地址 |
| userAgent | TEXT | 用户代理信息 |
| attachments | JSON | 附件信息 |
| priority | ENUM | 消息优先级 |
| isDeleted | BOOLEAN | 软删除标记 |
| createdAt | DATETIME | 创建时间 |
| updatedAt | DATETIME | 更新时间 |

### 新增API接口

数据库版本新增以下API：

```javascript
// 批量标记用户消息为已读
PUT /api/kefu/read/user/:userId

// 软删除消息
DELETE /api/kefu/messages/:messageId

// 获取最近对话列表
GET /api/kefu/conversations

// 获取用户未读消息数量
GET /api/kefu/unread/:userId
```

## 使用方法

### 1. 用户端使用

客服组件会自动加载到所有页面（除管理员后台）：

1. 用户看到页面右下角的紫色客服按钮
2. 点击按钮打开聊天窗口
3. 输入消息并发送
4. 查看历史对话记录
5. 有新消息时按钮上会显示红色徽章

### 2. 管理员使用

访问管理员后台：`/adminkefu.html`

1. **查看用户列表**：左侧显示所有有消息的用户，包含最新消息预览
2. **选择用户**：点击用户卡片进入对话界面
3. **查看对话**：右侧显示与该用户的完整对话记录
4. **回复消息**：在底部输入框输入回复，点击发送或按Ctrl+Enter
5. **标记已读**：点击"标记已读"按钮将该用户所有未读消息标记为已读
6. **过滤用户**：使用下拉菜单过滤显示不同状态的用户
7. **查看统计**：页面顶部显示实时统计信息

## API接口文档

### 数据库版本API（推荐）

#### 获取消息列表
```http
GET /api/kefu/messages?userId=用户ID&limit=100&offset=0
```

#### 发送消息
```http
POST /api/kefu/messages
Content-Type: application/json

{
  "userId": "用户ID",
  "message": "消息内容",
  "type": "user|admin",
  "adminId": "客服ID（可选）",
  "priority": "normal|high|urgent"
}
```

#### 标记消息已读
```http
PUT /api/kefu/read/:messageId
```

#### 批量标记用户消息已读
```http
PUT /api/kefu/read/user/:userId
```

#### 获取未读消息数量
```http
GET /api/kefu/unread/:userId
```

#### 获取对话列表
```http
GET /api/kefu/conversations?limit=20
```

#### 删除消息（软删除）
```http
DELETE /api/kefu/messages/:messageId
```

### JSON版本API（兼容）

#### 获取所有消息
```http
GET /api/kefu/messages
```

#### 发送消息
```http
POST /api/kefu/send
Content-Type: application/json

{
  "userId": "用户ID",
  "userName": "用户名",
  "message": "消息内容",
  "isAdmin": false
}
```

## 数据存储

### 数据库版本（推荐）
使用MySQL数据库存储，提供：
- 🚀 更好的性能
- 🔒 数据完整性保证
- 📊 复杂查询支持
- 🔍 全文搜索能力
- 📈 统计分析功能

### JSON版本（兼容）
使用JSON文件存储，位置：`kefu/messages.json`

## 高级功能

### 1. 消息优先级
支持4个优先级：`low`, `normal`, `high`, `urgent`

### 2. 软删除
消息不会真正删除，只是标记为已删除，便于数据恢复

### 3. 会话管理
支持会话ID分组，便于管理长对话

### 4. 多渠道支持
记录消息来源：`web`, `mobile`, `api`等

### 5. 用户行为跟踪
记录用户IP、浏览器信息等

### 6. 附件支持
预留附件字段，支持图片、文件等

## 性能优化

### 数据库索引
系统自动创建以下索引：
- 用户ID索引
- 消息状态索引
- 消息类型索引
- 创建时间索引
- 复合索引（用户+状态+类型）

### 查询优化
- 分页查询避免大量数据加载
- 软删除过滤提高查询效率
- 关联查询减少API调用次数

## 自定义配置

### 修改样式
客服组件的样式定义在 `components/customer-service.html` 中，可以修改：
- 浮动按钮位置和样式
- 聊天窗口大小和颜色
- 消息气泡样式
- 移动端适配

### 修改行为
在 `components/customer-service.html` 的JavaScript部分可以修改：
- 消息检查频率（默认30秒）
- 用户ID生成规则
- 错误处理逻辑

### 扩展数据模型
可以在 `models/CustomerMessage.js` 中添加：
- 新的字段定义
- 自定义验证规则
- 实例方法和类方法
- 关联关系

## 安全注意事项

1. **权限控制**：建议为管理员后台添加登录验证
2. **输入验证**：消息内容已限制长度，支持XSS过滤
3. **SQL注入防护**：使用Sequelize ORM防止SQL注入
4. **数据加密**：敏感信息可加密存储
5. **访问限制**：可添加IP白名单或频率限制

## 扩展建议

### WebSocket支持
为实现真正的实时通信，可以集成WebSocket：
```javascript
// 使用Socket.io
const io = require('socket.io')(server);
io.on('connection', (socket) => {
  // 处理实时消息
});
```

### 通知系统
集成消息推送服务：
- 邮件通知：新消息邮件提醒
- 短信通知：重要消息短信推送
- 桌面通知：浏览器原生通知

### 数据分析
利用数据库数据进行分析：
- 用户活跃度统计
- 客服响应时间分析
- 问题分类统计
- 满意度调查

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查数据库配置 `config/db.js`
   - 确认数据库服务正在运行
   - 验证用户名密码正确

2. **迁移脚本执行失败**
   - 检查数据库权限
   - 确认表不存在冲突
   - 查看详细错误日志

3. **消息发送失败**
   - 检查用户ID格式
   - 确认用户存在于users表
   - 验证API接口路径

4. **前端显示异常**
   - 检查API返回数据格式
   - 确认JavaScript无错误
   - 验证用户权限

### 调试方法

1. **后端调试**
   ```bash
   # 开启详细日志
   NODE_ENV=development node server.js
   ```

2. **数据库调试**
   ```sql
   -- 检查消息表数据
   SELECT * FROM customer_messages ORDER BY createdAt DESC LIMIT 10;
   
   -- 检查用户关联
   SELECT cm.*, u.username FROM customer_messages cm 
   JOIN users u ON cm.userId = u.id;
   ```

3. **前端调试**
   - 打开浏览器开发者工具
   - 查看Console选项卡的错误信息
   - 检查Network选项卡的API请求

## 更新日志

### v2.0.0 (2025-01-27) - 数据库版本 🎉
- ✨ 新增MySQL数据库支持
- ✨ 新增CustomerMessage数据模型
- ✨ 新增数据库迁移脚本
- ✨ 新增消息优先级和软删除
- ✨ 新增会话管理和多渠道支持
- ✨ 新增用户行为跟踪
- ✨ 新增批量操作API
- 🚀 大幅提升查询性能
- 🔧 优化API接口设计
- 📚 完善文档和示例

### v1.1.0 (2025-01-27) - JSON版本
- ✨ 完整的前后端客服系统
- ✨ 美化的管理员界面
- ✨ 实时消息统计
- ✨ 用户列表和对话管理
- 🎨 现代化UI设计
- 📱 移动端适配

## 技术支持

如有问题或建议，请联系技术团队或在项目中提交Issue。

---

**萤火AI客服系统** - 让客户服务更简单、更高效！ 🔥 
**更新频率**：根据用户反馈持续优化 