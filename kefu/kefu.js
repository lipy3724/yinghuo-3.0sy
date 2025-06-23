const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// 引入用户模型来获取用户信息
const User = require('../models/User');

// 简单的内存存储，实际项目中建议使用数据库
let messages = [];
let messageId = 1;

// 消息存储文件路径
const messagesFilePath = path.join(__dirname, 'messages.json');

// 初始化消息存储
async function initializeMessages() {
    try {
        const data = await fs.readFile(messagesFilePath, 'utf8');
        messages = JSON.parse(data);
        messageId = messages.length > 0 ? Math.max(...messages.map(m => m.id)) + 1 : 1;
    } catch (error) {
        // 文件不存在或为空，使用空数组
        messages = [];
        messageId = 1;
    }
}

// 保存消息到文件
async function saveMessages() {
    try {
        await fs.writeFile(messagesFilePath, JSON.stringify(messages, null, 2));
    } catch (error) {
        console.error('保存消息失败:', error);
    }
}

// 获取所有消息（管理员用）
router.get('/messages', async (req, res) => {
    try {
        // 如果有userId参数，返回该用户的消息
        const userId = req.query.userId;
        const since = req.query.since; // 获取指定时间之后的消息
        
        if (userId) {
            let userMessages = messages.filter(msg => msg.userId === userId);
            
            // 如果有since参数，只返回指定时间之后的消息
            if (since) {
                const sinceDate = new Date(since);
                userMessages = userMessages.filter(msg => new Date(msg.timestamp) > sinceDate);
                
                console.log(`[客服API] 用户${userId}请求${since}之后的消息，找到${userMessages.length}条新消息`);
            }
            
            // 获取用户信息并关联到消息
            const messagesWithUserInfo = await enrichMessagesWithUserInfo(userMessages);
            
            return res.json({
                success: true,
                messages: messagesWithUserInfo.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            });
        }
        
        // 返回所有消息，并关联用户信息
        let allMessages = messages;
        
        // 如果有since参数，只返回指定时间之后的消息
        if (since) {
            const sinceDate = new Date(since);
            allMessages = messages.filter(msg => new Date(msg.timestamp) > sinceDate);
            console.log(`[客服API] 管理员请求${since}之后的消息，找到${allMessages.length}条新消息`);
        }
        
        const enrichedMessages = await enrichMessagesWithUserInfo(allMessages);
        
        res.json({
            success: true,
            messages: enrichedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        });
    } catch (error) {
        console.error('获取消息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取消息失败'
        });
    }
});

// 辅助函数：为消息添加用户信息
async function enrichMessagesWithUserInfo(messageList) {
    const enrichedMessages = [];
    
    // 获取所有唯一的用户ID
    const userIds = [...new Set(messageList.map(msg => msg.userId))];
    
    // 批量查询用户信息
    const users = {};
    for (const userId of userIds) {
        try {
            // 尝试从数据库查询用户信息
            let user = null;
            if (userId.startsWith('user_')) {
                // 如果是数据库用户ID格式，直接查询
                const dbUserId = userId.replace('user_', '').split('_')[0];
                if (!isNaN(dbUserId)) {
                    user = await User.findByPk(parseInt(dbUserId));
                }
            } else if (!isNaN(userId)) {
                // 如果是纯数字ID，直接查询
                user = await User.findByPk(parseInt(userId));
            }
            
            if (user) {
                users[userId] = {
                    id: user.id,
                    username: user.username,
                    phone: user.phone
                };
            } else {
                // 如果数据库中没有找到用户，使用默认信息
                users[userId] = {
                    id: userId,
                    username: `访客${userId.slice(-4)}`,
                    phone: null
                };
            }
        } catch (error) {
            console.error(`查询用户 ${userId} 信息失败:`, error);
            // 出错时使用默认信息
            users[userId] = {
                id: userId,
                username: `访客${userId.slice(-4)}`,
                phone: null
            };
        }
    }
    
    // 为每条消息添加用户信息
    for (const message of messageList) {
        const userInfo = users[message.userId];
        enrichedMessages.push({
            ...message,
            userName: userInfo.username,
            userPhone: userInfo.phone,
            userInfo: userInfo
        });
    }
    
    return enrichedMessages;
}

// 发送消息（RESTful风格）
router.post('/messages', async (req, res) => {
    try {
        const { userId, message, type = 'user' } = req.body;
        
        if (!userId || !message) {
            return res.status(400).json({
                success: false,
                error: '用户ID和消息内容不能为空'
            });
        }
        
        const newMessage = {
            id: messageId++,
            userId: userId,
            message: message,
            type: type, // 'user' 或 'admin'
            timestamp: new Date().toISOString(),
            status: 'unread'
        };
        
        messages.push(newMessage);
        await saveMessages();
        
        res.json({
            success: true,
            message: '消息发送成功',
            data: newMessage
        });
    } catch (error) {
        console.error('发送消息失败:', error);
        res.status(500).json({
            success: false,
            error: '发送消息失败'
        });
    }
});

// 获取用户的消息记录
router.get('/messages/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const userMessages = messages.filter(msg => msg.userId === userId);
        
        res.json({
            success: true,
            messages: userMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取消息失败'
        });
    }
});

// 发送消息
router.post('/send', async (req, res) => {
    try {
        const { userId, userName, message, isAdmin = false } = req.body;
        
        if (!userId || !message) {
            return res.status(400).json({
                success: false,
                message: '用户ID和消息内容不能为空'
            });
        }
        
        const newMessage = {
            id: messageId++,
            userId: userId,
            userName: userName || '访客',
            message: message,
            isAdmin: isAdmin,
            timestamp: new Date().toISOString(),
            status: 'unread' // 消息状态：unread, read
        };
        
        messages.push(newMessage);
        await saveMessages();
        
        res.json({
            success: true,
            message: '消息发送成功',
            data: newMessage
        });
    } catch (error) {
        console.error('发送消息失败:', error);
        res.status(500).json({
            success: false,
            message: '发送消息失败'
        });
    }
});

// 标记消息为已读
router.put('/read/:messageId', async (req, res) => {
    try {
        const messageId = parseInt(req.params.messageId);
        const message = messages.find(m => m.id === messageId);
        
        if (!message) {
            return res.status(404).json({
                success: false,
                message: '消息不存在'
            });
        }
        
        message.status = 'read';
        await saveMessages();
        
        res.json({
            success: true,
            message: '消息已标记为已读'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '标记消息失败'
        });
    }
});

// 删除消息
router.delete('/messages/:messageId', async (req, res) => {
    try {
        const messageId = parseInt(req.params.messageId);
        const messageIndex = messages.findIndex(m => m.id === messageId);
        
        if (messageIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '消息不存在'
            });
        }
        
        messages.splice(messageIndex, 1);
        await saveMessages();
        
        res.json({
            success: true,
            message: '消息删除成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '删除消息失败'
        });
    }
});

// 获取未读消息数量
router.get('/unread-count', async (req, res) => {
    try {
        const unreadCount = messages.filter(msg => msg.status === 'unread' && !msg.isAdmin).length;
        
        res.json({
            success: true,
            count: unreadCount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取未读消息数量失败'
        });
    }
});

// 初始化消息存储
initializeMessages();

module.exports = router; 