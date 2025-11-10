const express = require('express');
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
            userId: `user_${msg.userId}_${msg.user.username}`,
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
                    required: false
                }
            ]
        });
        
        // 如果没有分配客服，自动分配一个
        if (!assignment) {
            console.log(`用户 ${userId} 首次发送消息，开始自动分配客服...`);
            
            try {
                // 使用自动分配客服功能
                assignment = await CustomerAssignment.autoAssignCustomerService(userId);
                console.log(`用户 ${userId} 已成功分配给客服，分配ID: ${assignment.id}, 客服ID: ${assignment.adminId}`);
            } catch (assignError) {
                console.error(`自动分配客服失败:`, assignError);
                
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
                
                console.log(`查找可用客服结果:`, availableAdmin ? 
                          `找到客服 ID: ${availableAdmin.id}, 用户名: ${availableAdmin.username}` : 
                          '未找到可用客服');
                
                if (!availableAdmin) {
                    return res.status(500).json({
                        success: false,
                        error: '无可用客服，请稍后再试'
                    });
                }
                
                try {
                    // 创建分配记录
                    assignment = await CustomerAssignment.create({
                        userId: userId,
                        adminId: availableAdmin.id,
                        status: 'active',
                        assignmentMethod: 'auto',
                        assignedAt: new Date(),
                        lastActiveAt: new Date(),
                        notes: '系统自动分配（备用方案）'
                    });
                    
                    console.log(`用户 ${userId} 已分配给客服 ID: ${availableAdmin.id}, 分配记录ID: ${assignment.id}`);
                    
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
                                required: false // 改为false，避免因为管理员不存在导致查询失败
                            }
                        ]
                    });
                    
                    // 检查分配是否成功获取到管理员信息
                    if (!assignment || !assignment.admin) {
                        console.error(`分配记录创建成功但未能获取管理员信息，分配ID: ${assignment ? assignment.id : 'unknown'}`);
                        // 使用之前查询到的可用管理员信息
                        assignment = {
                            adminId: availableAdmin.id,
                            admin: {
                                id: availableAdmin.id,
                                username: availableAdmin.username
                            }
                        };
                    }
                } catch (fallbackError) {
                    console.error(`创建客服分配记录失败:`, fallbackError);
                    // 即使分配失败，也允许用户发送消息
                    assignment = {
                        adminId: availableAdmin.id,
                        admin: {
                            id: availableAdmin.id,
                            username: availableAdmin.username
                        }
                    };
                }
            }
        } else {
            console.log(`用户 ${userId} 已有分配的客服，分配ID: ${assignment.id}, 客服ID: ${assignment.adminId}`);
            // 更新最后活跃时间
            if (assignment.updateLastActive) {
                await assignment.updateLastActive();
            }
        }
        
        // 创建消息记录
        try {
            const newMessage = await CustomerMessage.create({
                userId: userId,
                adminId: assignment && assignment.adminId ? assignment.adminId : null,  // 关联到分配的客服ID
                message: message,
                type: 'user',   // 用户发送的消息类型为'user'
                status: 'unread',
                channel: 'web',
                priority: 'normal'
            });
            
            console.log(`用户 ${userId} 成功创建新消息，ID: ${newMessage.id}，关联客服ID: ${assignment && assignment.adminId ? assignment.adminId : '无'}`);
            
            res.json({
                success: true,
                message: '消息发送成功',
                data: {
                    id: newMessage.id,
                    message: newMessage.message,
                    timestamp: newMessage.createdAt,
                    assignment: assignment ? {
                        adminId: assignment.adminId,
                        adminName: assignment.admin ? assignment.admin.username : '未知客服'
                    } : null
                }
            });
        } catch (messageError) {
            console.error(`创建消息记录失败:`, messageError);
            res.status(500).json({
                success: false,
                message: '消息保存失败',
                error: process.env.NODE_ENV === 'development' ? messageError.message : undefined
            });
        }
        
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
