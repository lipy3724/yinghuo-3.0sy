/**
 * 客服系统用户API修复脚本
 * 
 * 问题：普通用户无法访问客服API，因为这些API需要客服权限
 * 解决方案：添加专门为普通用户设计的客服API端点
 */

const fs = require('fs');
const path = require('path');

// 创建用户客服API路由文件
const userKefuApiPath = path.join(__dirname, 'kefu', 'kefu-user-api.js');

console.log('创建用户客服API路由文件:', userKefuApiPath);

const userKefuApiContent = `const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');

// 引入模型
const User = require('../models/User');
const CustomerMessage = require('../models/CustomerMessage');
const CustomerAssignment = require('../models/CustomerAssignment');

// 引入认证中间件，但只使用protect，不使用checkCustomerService
const { protect } = require('../middleware/auth');

/**
 * 普通用户获取自己的客服消息
 * 这个API不需要客服权限，任何已登录用户都可以访问
 */
router.get('/messages', protect, async (req, res) => {
    try {
        // 用户只能查看自己的消息
        const userId = req.user.id;
        const { limit = 100, offset = 0 } = req.query;
        
        const messages = await CustomerMessage.findAll({
            where: {
                userId: userId,
                isDeleted: false
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username', 'phone'],
                    required: true
                },
                {
                    model: User,
                    as: 'admin',
                    attributes: ['id', 'username'],
                    required: false
                }
            ],
            order: [['createdAt', 'ASC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        // 格式化消息数据
        const formattedMessages = messages.map(msg => ({
            id: msg.id,
            userId: \`user_\${msg.userId}_\${msg.user.username}\`,
            userName: msg.user.username,
            userPhone: msg.user.phone,
            message: msg.message,
            type: msg.type,
            status: msg.status,
            timestamp: msg.createdAt,
            isAdmin: msg.type === 'admin',
            adminInfo: msg.admin ? {
                id: msg.admin.id,
                username: msg.admin.username
            } : null,
            channel: msg.channel,
            priority: msg.priority
        }));
        
        res.json({
            success: true,
            messages: formattedMessages,
            total: formattedMessages.length
        });
        
    } catch (error) {
        console.error('获取用户消息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取消息失败',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * 普通用户发送客服消息
 * 这个API不需要客服权限，任何已登录用户都可以访问
 */
router.post('/messages', protect, async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user.id;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                error: '消息内容不能为空'
            });
        }
        
        // 检查用户是否存在
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        // 检查用户是否已有分配的客服
        let assignment = await CustomerAssignment.findOne({
            where: {
                userId: userId,
                status: 'active'
            },
            include: [
                {
                    model: User,
                    as: 'admin',
                    attributes: ['id', 'username'],
                    required: true
                }
            ]
        });
        
        // 如果没有分配客服，自动分配一个
        if (!assignment) {
            console.log(\`用户 \${userId} 首次发送消息，开始自动分配客服...\`);
            
            // 查找可用的客服（简单实现：选择第一个客服或管理员）
            const availableAdmin = await User.findOne({
                where: {
                    [Op.or]: [
                        { isAdmin: true },
                        { isCustomerService: true }
                    ]
                },
                order: [['lastActiveAt', 'DESC']]  // 选择最近活跃的客服
            });
            
            if (!availableAdmin) {
                return res.status(500).json({
                    success: false,
                    error: '无可用客服，请稍后再试'
                });
            }
            
            // 创建分配记录
            assignment = await CustomerAssignment.create({
                userId: userId,
                adminId: availableAdmin.id,
                status: 'active',
                assignmentMethod: 'auto',
                assignedAt: new Date(),
                lastActiveAt: new Date(),
                notes: '系统自动分配'
            });
            
            console.log(\`用户 \${userId} 已分配给客服 ID: \${availableAdmin.id}\`);
            
            // 重新查询以获取管理员信息
            assignment = await CustomerAssignment.findOne({
                where: {
                    id: assignment.id
                },
                include: [
                    {
                        model: User,
                        as: 'admin',
                        attributes: ['id', 'username'],
                        required: true
                    }
                ]
            });
        }
        
        // 创建消息记录
        const newMessage = await CustomerMessage.create({
            userId: userId,
            adminId: null,  // 用户发送的消息没有adminId
            message: message,
            type: 'user',   // 用户发送的消息类型为'user'
            status: 'unread',
            channel: 'web',
            priority: 'normal'
        });
        
        res.json({
            success: true,
            message: '消息发送成功',
            data: {
                id: newMessage.id,
                message: newMessage.message,
                timestamp: newMessage.createdAt,
                assignment: {
                    adminId: assignment.adminId,
                    adminName: assignment.admin.username
                }
            }
        });
        
    } catch (error) {
        console.error('发送消息失败:', error);
        res.status(500).json({
            success: false,
            message: '发送消息失败',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
`;

fs.writeFileSync(userKefuApiPath, userKefuApiContent);

// 更新server.js文件，添加新的路由
const serverJsPath = path.join(__dirname, 'server.js');

console.log('更新server.js文件，添加用户客服API路由...');

// 读取server.js文件
let serverJsContent = fs.readFileSync(serverJsPath, 'utf8');

// 添加引入用户客服API路由的代码
if (!serverJsContent.includes('userKefuRoutes')) {
  const importLine = "const kefuRoutes = require('./kefu/kefu-db');";
  const newImportLine = importLine + "\nconst userKefuRoutes = require('./kefu/kefu-user-api');";
  serverJsContent = serverJsContent.replace(importLine, newImportLine);
}

// 添加使用用户客服API路由的代码
if (!serverJsContent.includes('/api/user-kefu')) {
  const useLine = "app.use('/api/kefu', kefuRoutes);";
  const newUseLine = useLine + "\n// 用户客服API路由\napp.use('/api/user-kefu', userKefuRoutes);";
  serverJsContent = serverJsContent.replace(useLine, newUseLine);
}

// 保存修改后的server.js文件
fs.writeFileSync(serverJsPath, serverJsContent);

// 更新前端客服组件，使用新的API端点
const componentsJsPath = path.join(__dirname, 'components', 'components.js');

console.log('更新前端客服组件，使用新的API端点...');

// 读取components.js文件
let componentsJsContent = fs.readFileSync(componentsJsPath, 'utf8');

// 修改API端点
componentsJsContent = componentsJsContent.replace(
  /fetch\('\/api\/kefu\/messages'/g,
  "fetch('/api/user-kefu/messages'"
);

componentsJsContent = componentsJsContent.replace(
  /fetch\('\/api\/kefu\/messages\?userId=/g,
  "fetch('/api/user-kefu/messages?userId="
);

// 保存修改后的components.js文件
fs.writeFileSync(componentsJsPath, componentsJsContent);

// 更新其他客服组件文件
const customerServiceSimplePath = path.join(__dirname, 'components', 'customer-service-simple.html');
if (fs.existsSync(customerServiceSimplePath)) {
  console.log('更新customer-service-simple.html...');
  let content = fs.readFileSync(customerServiceSimplePath, 'utf8');
  content = content.replace(
    /fetch\('\/api\/kefu\/messages'/g,
    "fetch('/api/user-kefu/messages'"
  );
  content = content.replace(
    /fetch\('\/api\/kefu\/messages\?userId=/g,
    "fetch('/api/user-kefu/messages?userId="
  );
  fs.writeFileSync(customerServiceSimplePath, content);
}

const customerServicePath = path.join(__dirname, 'components', 'customer-service.html');
if (fs.existsSync(customerServicePath)) {
  console.log('更新customer-service.html...');
  let content = fs.readFileSync(customerServicePath, 'utf8');
  content = content.replace(
    /fetch\('\/api\/kefu\/messages'/g,
    "fetch('/api/user-kefu/messages'"
  );
  content = content.replace(
    /fetch\('\/api\/kefu\/messages\?userId=/g,
    "fetch('/api/user-kefu/messages?userId="
  );
  fs.writeFileSync(customerServicePath, content);
}

console.log('✅ 修复完成!');
console.log('请重启服务器并刷新页面以应用更改。'); 