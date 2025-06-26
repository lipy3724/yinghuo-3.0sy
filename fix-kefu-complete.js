/**
 * 客服系统全面修复脚本
 * 
 * 问题：
 * 1. 客户端使用'token'键名获取token，但实际存储在'authToken'中
 * 2. getAuthToken函数存在递归错误
 * 3. 部分API路径未正确更新
 * 
 * 解决方案：
 * 全面修复所有客服组件文件中的问题
 */

const fs = require('fs');
const path = require('path');

// 需要修复的文件列表
const filesToFix = [
  path.join(__dirname, 'components', 'components.js'),
  path.join(__dirname, 'components', 'customer-service.html'),
  path.join(__dirname, 'components', 'customer-service-simple.html'),
  path.join(__dirname, 'components', 'customer-service-ultra-simple.html')
];

// 修复所有文件
filesToFix.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`❌ 文件不存在: ${filePath}`);
    return;
  }
  
  console.log(`🔍 处理文件: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content; // 保存原始内容以检测是否有变化
  
  // 1. 修复API路径 - 确保所有API请求使用新的路径
  content = content.replace(
    /fetch\('\/api\/kefu\/messages/g,
    "fetch('/api/user-kefu/messages"
  );
  
  // 2. 修复token获取 - 将localStorage.getItem('token')替换为localStorage.getItem('authToken')
  content = content.replace(
    /localStorage\.getItem\('token'\)/g,
    "localStorage.getItem('authToken')"
  );
  
  // 3. 修复递归调用问题 - 替换错误的getAuthToken函数实现
  const badAuthTokenFunction = /function getAuthToken\(\) {\s*\/\/ 优先获取authToken，这是普通用户使用的key\s*let token = getAuthToken\(\);/;
  if (content.match(badAuthTokenFunction)) {
    content = content.replace(
      badAuthTokenFunction,
      `function getAuthToken() {
    // 优先获取authToken，这是普通用户使用的key
    let token = localStorage.getItem('authToken');`
    );
  }
  
  // 4. 确保所有文件都有正确的getAuthToken函数，如果需要的话
  if (!content.includes("function getAuthToken()") && 
      (content.includes("Bearer ${getAuthToken()}") || content.includes("${getAuthToken()}"))) {
    // 文件引用了getAuthToken但没有定义它，需要添加此函数
    const authTokenFunction = `
// 获取认证token
function getAuthToken() {
    // 优先获取authToken，这是普通用户使用的key
    let token = localStorage.getItem('authToken');
    
    // 如果没有，尝试获取admin_token，这是管理员使用的key
    if (!token) {
        token = localStorage.getItem('admin_token');
    }
    
    return token;
}
`;
    
    // 在</script>标签前插入函数
    if (content.includes('</script>')) {
      content = content.replace('</script>', authTokenFunction + '</script>');
    }
  }
  
  // 5. 使用getAuthToken函数替换直接调用localStorage.getItem('authToken')
  // 注意：这应该在修复token键名之后执行
  content = content.replace(
    /localStorage\.getItem\('authToken'\)/g,
    "getAuthToken()"
  );
  
  // 6. 修复API请求中的Authorization头 - 确保所有请求都有正确的Authorization头
  const fetchWithoutAuth = /fetch\('\/api\/user-kefu\/messages.*?\{(?!\s*headers)/gs;
  content = content.replace(
    fetchWithoutAuth,
    match => {
      if (match.includes('headers:')) return match; // 已有headers，不需要修改
      // 需要添加headers
      return match.replace(
        '{',
        `{
        headers: {
            'Authorization': \`Bearer \${getAuthToken()}\`
        },`
      );
    }
  );
  
  // 保存修改
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 已修复文件: ${filePath}`);
  } else {
    console.log(`ℹ️ 文件无需修改: ${filePath}`);
  }
});

// 确保kefu-user-api.js文件存在
const userKefuApiPath = path.join(__dirname, 'kefu', 'kefu-user-api.js');
if (!fs.existsSync(userKefuApiPath)) {
  console.log('❌ 用户客服API文件不存在，正在创建...');
  
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

module.exports = router;`;

  fs.writeFileSync(userKefuApiPath, userKefuApiContent);
  console.log('✅ 已创建用户客服API文件');
}

// 更新server.js文件，确保包含用户客服API路由
const serverJsPath = path.join(__dirname, 'server.js');
if (fs.existsSync(serverJsPath)) {
  console.log('更新server.js文件，添加用户客服API路由...');
  
  let serverJsContent = fs.readFileSync(serverJsPath, 'utf8');
  const originalContent = serverJsContent;
  
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
  if (serverJsContent !== originalContent) {
    fs.writeFileSync(serverJsPath, serverJsContent);
    console.log('✅ 已更新server.js文件');
  } else {
    console.log('ℹ️ server.js文件无需修改');
  }
}

console.log('✅ 全面修复完成!');
console.log('请重启服务器并刷新页面以应用更改。'); 