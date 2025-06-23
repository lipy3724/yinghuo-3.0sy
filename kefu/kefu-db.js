const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');

// 引入模型
const User = require('../models/User');
const CustomerMessage = require('../models/CustomerMessage');
const CustomerAssignment = require('../models/CustomerAssignment');

// 获取所有消息（管理员用）
router.get('/messages', async (req, res) => {
    try {
        const { userId, limit = 100, offset = 0, adminId } = req.query;
        
        const whereCondition = {
            isDeleted: false
        };
        
        // 如果指定了客服ID，只返回该客服负责的用户消息
        if (adminId) {
            // 获取该客服负责的所有用户
            const assignments = await CustomerAssignment.findAll({
                where: {
                    adminId: parseInt(adminId),
                    status: 'active'
                },
                attributes: ['userId']
            });
            
            const assignedUserIds = assignments.map(assignment => assignment.userId);
            
            if (assignedUserIds.length > 0) {
                whereCondition.userId = {
                    [Op.in]: assignedUserIds
                };
            } else {
                // 如果该客服没有分配任何用户，返回空结果
                return res.json({
                    success: true,
                    messages: [],
                    total: 0
                });
            }
        }
        
        // 如果指定了用户ID，只返回该用户的消息
        if (userId) {
            // 解析用户ID
            let dbUserId = null;
            if (userId.toString().startsWith('user_')) {
                const extracted = userId.replace('user_', '').split('_')[0];
                if (!isNaN(extracted)) {
                    dbUserId = parseInt(extracted);
                }
            } else if (!isNaN(userId)) {
                dbUserId = parseInt(userId);
            }
            
            if (dbUserId) {
                whereCondition.userId = dbUserId;
            } else {
                return res.json({
                    success: true,
                    messages: []
                });
            }
        }
        
        const messages = await CustomerMessage.findAll({
            where: whereCondition,
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
            order: [['createdAt', userId ? 'ASC' : 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        // 格式化消息数据以兼容前端
        const formattedMessages = messages.map(msg => ({
            id: msg.id,
            userId: `user_${msg.userId}_${msg.user.username}`,
            userName: msg.user.username,
            userPhone: msg.user.phone,
            userInfo: {
                id: msg.user.id,
                username: msg.user.username,
                phone: msg.user.phone
            },
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
        console.error('获取消息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取消息失败',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 发送消息
router.post('/messages', async (req, res) => {
    try {
        const { userId, message, type = 'user', adminId, priority = 'normal' } = req.body;
        
        if (!userId || !message) {
            return res.status(400).json({
                success: false,
                error: '用户ID和消息内容不能为空'
            });
        }
        
        // 解析用户ID
        let dbUserId = null;
        if (userId.toString().startsWith('user_')) {
            const extracted = userId.replace('user_', '').split('_')[0];
            if (!isNaN(extracted)) {
                dbUserId = parseInt(extracted);
            }
        } else if (!isNaN(userId)) {
            dbUserId = parseInt(userId);
        }
        
        if (!dbUserId) {
            return res.status(400).json({
                success: false,
                error: '无效的用户ID格式'
            });
        }
        
        // 检查用户是否存在
        const user = await User.findByPk(dbUserId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        // 🎯 如果是用户首次发送消息，自动分配客服
        let assignedAdminId = adminId;
        if (type === 'user') {
            try {
                // 检查用户是否已有分配的客服
                let assignment = await CustomerAssignment.findByUserId(dbUserId);
                
                if (!assignment) {
                    // 首次发送消息，自动分配客服
                    console.log(`🎯 用户 ${dbUserId} 首次发送消息，开始自动分配客服...`);
                    assignment = await CustomerAssignment.autoAssignCustomerService(dbUserId);
                    console.log(`✅ 用户 ${dbUserId} 已分配给客服 ${assignment.admin.username} (ID: ${assignment.adminId})`);
                } else {
                    // 更新最后活跃时间
                    await assignment.updateLastActive();
                    console.log(`🔄 更新用户 ${dbUserId} 与客服 ${assignment.admin.username} 的活跃时间`);
                }
                
                // 如果是用户消息，将分配的客服ID记录到消息中（用于后续分析）
                assignedAdminId = assignment.adminId;
                
            } catch (error) {
                console.error('自动分配客服失败:', error);
                // 分配失败不影响消息发送，继续处理
            }
        }
        
        // 获取请求信息
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        
        // 🛡️ 防重复提交检查
        const duplicateCheckTime = new Date(Date.now() - 5000); // 5秒内
        const recentMessage = await CustomerMessage.findOne({
            where: {
                userId: dbUserId,
                message: message,
                type: type,
                createdAt: {
                    [require('sequelize').Op.gte]: duplicateCheckTime
                }
            },
            order: [['createdAt', 'DESC']]
        });
        
        if (recentMessage) {
            console.log(`🚫 检测到重复消息，用户${dbUserId}在5秒内发送了相同内容`);
            return res.status(400).json({
                success: false,
                error: '请勿重复发送相同消息'
            });
        }
        
        // 创建消息
        const newMessage = await CustomerMessage.create({
            userId: dbUserId,
            message: message,
            type: type,
            status: 'unread',
            adminId: assignedAdminId || null,
            channel: 'web',
            ipAddress: ipAddress,
            userAgent: userAgent,
            priority: priority
        });
        
        // 加载关联数据
        await newMessage.reload({
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username', 'phone']
                },
                {
                    model: User,
                    as: 'admin',
                    attributes: ['id', 'username'],
                    required: false
                }
            ]
        });
        
        // 格式化返回数据
        const formattedMessage = {
            id: newMessage.id,
            userId: `user_${newMessage.userId}_${newMessage.user.username}`,
            userName: newMessage.user.username,
            userPhone: newMessage.user.phone,
            message: newMessage.message,
            type: newMessage.type,
            status: newMessage.status,
            timestamp: newMessage.createdAt,
            isAdmin: newMessage.type === 'admin',
            assignedAdminId: assignedAdminId // 返回分配的客服ID
        };
        
        res.json({
            success: true,
            message: '消息发送成功',
            data: formattedMessage
        });
        
    } catch (error) {
        console.error('发送消息失败:', error);
        res.status(500).json({
            success: false,
            error: '发送消息失败',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 标记消息为已读
router.put('/read/:messageId', async (req, res) => {
    try {
        const messageId = parseInt(req.params.messageId);
        
        const message = await CustomerMessage.findByPk(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: '消息不存在'
            });
        }
        
        await message.markAsRead();
        
        res.json({
            success: true,
            message: '消息已标记为已读'
        });
        
    } catch (error) {
        console.error('标记消息已读失败:', error);
        res.status(500).json({
            success: false,
            message: '标记消息失败',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 批量标记用户消息为已读
router.put('/read/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // 解析用户ID
        let dbUserId = null;
        if (userId.toString().startsWith('user_')) {
            const extracted = userId.replace('user_', '').split('_')[0];
            if (!isNaN(extracted)) {
                dbUserId = parseInt(extracted);
            }
        } else if (!isNaN(userId)) {
            dbUserId = parseInt(userId);
        }
        
        if (!dbUserId) {
            return res.status(400).json({
                success: false,
                error: '无效的用户ID格式'
            });
        }
        
        // 批量更新该用户的未读消息
        const [updatedCount] = await CustomerMessage.update(
            { status: 'read' },
            {
                where: {
                    userId: dbUserId,
                    type: 'user',
                    status: 'unread',
                    isDeleted: false
                }
            }
        );
        
        res.json({
            success: true,
            message: `已标记 ${updatedCount} 条消息为已读`
        });
        
    } catch (error) {
        console.error('批量标记已读失败:', error);
        res.status(500).json({
            success: false,
            message: '批量标记失败',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 删除消息（软删除）
router.delete('/messages/:messageId', async (req, res) => {
    try {
        const messageId = parseInt(req.params.messageId);
        
        const message = await CustomerMessage.findByPk(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: '消息不存在'
            });
        }
        
        await message.softDelete();
        
        res.json({
            success: true,
            message: '消息已删除'
        });
        
    } catch (error) {
        console.error('删除消息失败:', error);
        res.status(500).json({
            success: false,
            message: '删除消息失败',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 获取未读消息数量
router.get('/unread/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // 解析用户ID
        let dbUserId = null;
        if (userId.toString().startsWith('user_')) {
            const extracted = userId.replace('user_', '').split('_')[0];
            if (!isNaN(extracted)) {
                dbUserId = parseInt(extracted);
            }
        } else if (!isNaN(userId)) {
            dbUserId = parseInt(userId);
        }
        
        if (!dbUserId) {
            return res.json({
                success: true,
                count: 0
            });
        }
        
        const count = await CustomerMessage.getUnreadCount(dbUserId);
        
        res.json({
            success: true,
            count: count
        });
        
    } catch (error) {
        console.error('获取未读消息数量失败:', error);
        res.status(500).json({
            success: false,
            message: '获取未读消息数量失败',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 获取最近对话列表
router.get('/conversations', async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        
        const conversations = await CustomerMessage.getRecentConversations({
            limit: parseInt(limit)
        });
        
        res.json({
            success: true,
            conversations: conversations
        });
        
    } catch (error) {
        console.error('获取对话列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取对话列表失败',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 兼容旧API - 发送消息
router.post('/send', async (req, res) => {
    // 重定向到新的消息API
    req.body.type = req.body.isAdmin ? 'admin' : 'user';
    return router.handle(req, res);
});

// 获取客服分配信息
router.get('/assignments', async (req, res) => {
    try {
        const { adminId, userId } = req.query;
        
        let whereCondition = { status: 'active' };
        
        if (adminId) {
            whereCondition.adminId = parseInt(adminId);
        }
        
        if (userId) {
            let dbUserId = null;
            if (userId.toString().startsWith('user_')) {
                const extracted = userId.replace('user_', '').split('_')[0];
                if (!isNaN(extracted)) {
                    dbUserId = parseInt(extracted);
                }
            } else if (!isNaN(userId)) {
                dbUserId = parseInt(userId);
            }
            
            if (dbUserId) {
                whereCondition.userId = dbUserId;
            }
        }
        
        const assignments = await CustomerAssignment.findAll({
            where: whereCondition,
            include: [
                {
                    model: User,
                    as: 'customer',
                    attributes: ['id', 'username', 'phone']
                },
                {
                    model: User,
                    as: 'admin',
                    attributes: ['id', 'username', 'isAdmin', 'isInternal']
                }
            ],
            order: [['assignedAt', 'DESC']]
        });
        
        res.json({
            success: true,
            assignments: assignments
        });
        
    } catch (error) {
        console.error('获取分配信息失败:', error);
        res.status(500).json({
            success: false,
            error: '获取分配信息失败'
        });
    }
});

// 手动分配客服
router.post('/assignments', async (req, res) => {
    try {
        const { userId, adminId, notes } = req.body;
        
        if (!userId || !adminId) {
            return res.status(400).json({
                success: false,
                error: '用户ID和客服ID不能为空'
            });
        }
        
        // 解析用户ID
        let dbUserId = null;
        if (userId.toString().startsWith('user_')) {
            const extracted = userId.replace('user_', '').split('_')[0];
            if (!isNaN(extracted)) {
                dbUserId = parseInt(extracted);
            }
        } else if (!isNaN(userId)) {
            dbUserId = parseInt(userId);
        }
        
        if (!dbUserId) {
            return res.status(400).json({
                success: false,
                error: '无效的用户ID格式'
            });
        }
        
        // 检查是否已有分配
        const existingAssignment = await CustomerAssignment.findByUserId(dbUserId);
        
        if (existingAssignment) {
            // 转移分配
            await existingAssignment.transfer(parseInt(adminId), notes);
            
            res.json({
                success: true,
                message: '客服分配已转移',
                assignment: existingAssignment
            });
        } else {
            // 创建新分配
            const assignment = await CustomerAssignment.create({
                userId: dbUserId,
                adminId: parseInt(adminId),
                status: 'active',
                assignmentMethod: 'manual',
                notes: notes || '手动分配'
            });
            
            await assignment.reload({
                include: [
                    {
                        model: User,
                        as: 'customer',
                        attributes: ['id', 'username', 'phone']
                    },
                    {
                        model: User,
                        as: 'admin',
                        attributes: ['id', 'username', 'isAdmin', 'isInternal']
                    }
                ]
            });
            
            res.json({
                success: true,
                message: '客服分配成功',
                assignment: assignment
            });
        }
        
    } catch (error) {
        console.error('分配客服失败:', error);
        res.status(500).json({
            success: false,
            error: '分配客服失败'
        });
    }
});

// 手动触发超时检查
router.post('/assignments/check-timeout', async (req, res) => {
    try {
        const timeoutCount = await CustomerAssignment.checkAndHandleTimeouts();
        
        res.json({
            success: true,
            message: `检查完成，处理了 ${timeoutCount} 个超时分配`,
            timeoutCount: timeoutCount
        });
        
    } catch (error) {
        console.error('手动检查超时失败:', error);
        res.status(500).json({
            success: false,
            error: '检查超时失败'
        });
    }
});

// 获取分配统计信息
router.get('/assignments/stats', async (req, res) => {
    try {
        const { Op } = require('sequelize');
        
        // 获取活跃分配统计
        const activeAssignments = await CustomerAssignment.findAll({
            where: { status: 'active' },
            include: [
                {
                    model: User,
                    as: 'admin',
                    attributes: ['id', 'username', 'isAdmin', 'isInternal'],
                    where: {
                        [Op.or]: [
                            { isAdmin: true },
                            { isInternal: true }
                        ]
                    }
                }
            ]
        });
        
        // 按客服分组统计
        const adminStats = {};
        let totalAssignments = 0;
        let nearTimeoutCount = 0;
        let timeoutCount = 0;
        
        const now = new Date();
        
        activeAssignments.forEach(assignment => {
            const adminId = assignment.adminId;
            const adminName = assignment.admin.username;
            const lastActiveTime = new Date(assignment.lastActiveAt || assignment.assignedAt);
            const hoursSinceLastActive = (now - lastActiveTime) / (1000 * 60 * 60);
            
            if (!adminStats[adminId]) {
                adminStats[adminId] = {
                    adminId: adminId,
                    name: adminName,
                    isAdmin: assignment.admin.isAdmin,
                    isInternal: assignment.admin.isInternal,
                    activeCount: 0,
                    nearTimeoutCount: 0,
                    timeoutCount: 0
                };
            }
            
            adminStats[adminId].activeCount++;
            totalAssignments++;
            
            if (hoursSinceLastActive >= 12) {
                adminStats[adminId].timeoutCount++;
                timeoutCount++;
            } else if (hoursSinceLastActive >= 10) {
                adminStats[adminId].nearTimeoutCount++;
                nearTimeoutCount++;
            }
        });
        
        // 获取所有可用客服（包括没有分配的）
        const allAdmins = await User.findAll({
            where: {
                [Op.or]: [
                    { isAdmin: true },
                    { isInternal: true }
                ]
            },
            attributes: ['id', 'username', 'isAdmin', 'isInternal']
        });
        
        // 补充没有分配的客服
        allAdmins.forEach(admin => {
            if (!adminStats[admin.id]) {
                adminStats[admin.id] = {
                    adminId: admin.id,
                    name: admin.username,
                    isAdmin: admin.isAdmin,
                    isInternal: admin.isInternal,
                    activeCount: 0,
                    nearTimeoutCount: 0,
                    timeoutCount: 0
                };
            }
        });
        
        res.json({
            success: true,
            stats: {
                totalAssignments: totalAssignments,
                nearTimeoutCount: nearTimeoutCount,
                timeoutCount: timeoutCount,
                adminStats: Object.values(adminStats)
            }
        });
        
    } catch (error) {
        console.error('获取分配统计失败:', error);
        res.status(500).json({
            success: false,
            error: '获取分配统计失败'
        });
    }
});

// 重新分配特定用户
router.post('/assignments/reassign', async (req, res) => {
    try {
        const { userId, newAdminId, reason } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: '用户ID不能为空'
            });
        }
        
        // 解析用户ID
        let dbUserId = null;
        if (userId.toString().startsWith('user_')) {
            const extracted = userId.replace('user_', '').split('_')[0];
            if (!isNaN(extracted)) {
                dbUserId = parseInt(extracted);
            }
        } else if (!isNaN(userId)) {
            dbUserId = parseInt(userId);
        }
        
        if (!dbUserId) {
            return res.status(400).json({
                success: false,
                error: '无效的用户ID格式'
            });
        }
        
        // 获取现有分配
        const existingAssignment = await CustomerAssignment.findByUserId(dbUserId);
        
        if (!existingAssignment) {
            return res.status(404).json({
                success: false,
                error: '用户没有现有分配'
            });
        }
        
        // 将现有分配标记为非活跃
        await existingAssignment.deactivate();
        
        let newAssignment;
        
        if (newAdminId) {
            // 手动指定新客服
            newAssignment = await CustomerAssignment.create({
                userId: dbUserId,
                adminId: parseInt(newAdminId),
                status: 'active',
                assignmentMethod: 'manual',
                assignedAt: new Date(),
                lastActiveAt: new Date(),
                notes: reason || '手动重新分配'
            });
        } else {
            // 自动重新分配
            newAssignment = await CustomerAssignment.reassignCustomerService(
                dbUserId, 
                reason || '手动触发重新分配'
            );
        }
        
        await newAssignment.reload({
            include: [
                {
                    model: User,
                    as: 'admin',
                    attributes: ['id', 'username', 'isAdmin', 'isInternal']
                }
            ]
        });
        
        res.json({
            success: true,
            message: '重新分配成功',
            assignment: newAssignment
        });
        
    } catch (error) {
        console.error('重新分配失败:', error);
        res.status(500).json({
            success: false,
            error: '重新分配失败'
        });
    }
});

module.exports = router; 