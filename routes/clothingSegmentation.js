const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid'); // 需要安装uuid包: npm install uuid
const { callClothSegmentationApi } = require('../utils/aliyunApiProxy');
const axios = require('axios');
const { createUnifiedFeatureMiddleware } = require('../middleware/unifiedFeatureUsage');
const uploadFromUrl = require('../utils/uploadFromUrl'); // 新增: OSS 转存工具
const { FeatureUsage } = require('../models/FeatureUsage');

/**
 * 智能服饰分割退款函数
 * 当任务失败时，退还已扣除的积分
 */
async function refundClothSegmentationCredits(userId, taskId, reason = '任务失败') {
    try {
        console.log(`开始处理智能服饰分割退款: 用户ID=${userId}, 任务ID=${taskId}, 原因=${reason}`);
        
        // 查找该功能的使用记录
        const usage = await FeatureUsage.findOne({
            where: {
                userId: userId,
                featureName: 'CLOTH_SEGMENTATION'
            }
        });
        
        if (!usage) {
            console.log(`未找到用户${userId}的智能服饰分割使用记录，无需退款`);
            return false;
        }
        
        // 解析details字段，查找对应的任务记录
        let details = {};
        if (usage.details) {
            try {
                details = JSON.parse(usage.details);
            } catch (e) {
                console.error('解析details字段失败:', e);
                details = {};
            }
        }
        
        // 确保refunds数组存在
        if (!details.refunds) {
            details.refunds = [];
        }
        
        // 查找对应的任务记录
        const tasks = details.tasks || [];
        let task = null;
        
        if (taskId) {
            // 如果提供了taskId，先尝试精确匹配
            task = tasks.find(t => t.taskId === taskId);
            
            // 检查是否已经退款过
            const existingRefund = details.refunds.find(refund => refund.taskId === taskId);
            if (existingRefund) {
                console.log(`任务${taskId}已经退款过，跳过重复退款`);
                return false;
            }
        }
        
        // 如果没找到任务记录或没有提供taskId，尝试从最近的任务中推断
        if (!task && tasks.length > 0) {
            // 按时间排序，取最近的一个没有退款的任务
            const sortedTasks = tasks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            for (const t of sortedTasks) {
                const existingRefund = details.refunds.find(refund => refund.taskId === t.taskId);
                if (!existingRefund) {
                    task = t;
                    console.log(`使用最近的未退款任务记录进行退款: ${task.taskId}`);
                    break;
                }
            }
        }
        
        if (!task) {
            console.log(`未找到任务记录，无法退款`);
            return false;
        }
        
        const creditCost = task.creditCost || 0;
        const isFree = task.isFree || false;
        
        console.log(`找到任务记录: 积分=${creditCost}, 是否免费=${isFree}`);
        
        // 如果是免费使用，只需要回退使用次数，不退还积分
        if (isFree) {
            console.log('免费使用失败，回退使用次数');
            
            // 减少使用次数
            if (usage.usageCount > 0) {
                usage.usageCount -= 1;
            }
            
            // 记录退款信息（标记为免费退款）
            details.refunds.push({
                taskId: task.taskId, // 使用实际的任务ID
                creditCost: 0,
                isFree: true,
                reason: reason,
                refundTime: new Date().toISOString()
            });
            
            usage.details = JSON.stringify(details);
            await usage.save();
            
            console.log(`智能服饰分割免费使用退款完成: 用户ID=${userId}, 回退使用次数`);
            return true;
        }
        
        // 付费使用退款
        if (creditCost > 0) {
            console.log(`开始退还积分: ${creditCost}`);
            
            // 获取用户信息
            const User = require('../models/User');
            const user = await User.findByPk(userId);
            
            if (!user) {
                console.error(`未找到用户ID=${userId}`);
                return false;
            }
            
            // 退还积分
            user.credits += creditCost;
            await user.save();
            
            // 减少该功能的积分消费记录
            if (usage.credits >= creditCost) {
                usage.credits -= creditCost;
            } else {
                usage.credits = 0;
            }
            
            // 减少使用次数
            if (usage.usageCount > 0) {
                usage.usageCount -= 1;
            }
            
            // 记录退款信息
            details.refunds.push({
                taskId: task.taskId, // 使用实际的任务ID
                creditCost: creditCost,
                isFree: false,
                reason: reason,
                refundTime: new Date().toISOString()
            });
            
            usage.details = JSON.stringify(details);
            await usage.save();
            
            console.log(`智能服饰分割积分退款完成: 用户ID=${userId}, 退还积分=${creditCost}, 用户当前积分=${user.credits}`);
            return true;
        }
        
        console.log(`任务${taskId}无需退款: 积分=${creditCost}, 免费=${isFree}`);
        return false;
        
    } catch (error) {
        console.error('智能服饰分割退款失败:', error);
        return false;
    }
}

/**
 * 服饰分割API - 创建任务
 * 使用阿里云视觉智能开放平台的服饰分割能力
 */
router.post('/create-task', protect, createUnifiedFeatureMiddleware('CLOTH_SEGMENTATION'), async (req, res) => {
    try {
        const { imageUrl, clothClasses, returnForm, outMode } = req.body;
        
        // 验证必要的参数
        if (!imageUrl) {
            return res.status(400).json({ message: '缺少图片URL参数' });
        }

        if (!clothClasses || !Array.isArray(clothClasses) || clothClasses.length === 0) {
            return res.status(400).json({ message: '请至少选择一个服饰类别' });
        }

        console.log('收到服饰分割请求:', {
            imageUrl,
            clothClasses,
            returnForm,
            outMode
        });
        
        // 构建符合阿里云标准API的参数格式
        const apiParams = {
            ImageURL: imageUrl,
            ClothClasses: clothClasses,
            OutMode: outMode !== undefined ? outMode : 1  // 默认使用1（指定类别组合分割结果）
        };
        
        // 添加可选参数
        if (returnForm) {
            apiParams.ReturnForm = returnForm;
        }
        
        console.log('调用阿里云API参数:', apiParams);
        
        // 积分已在统一中间件中扣除，先记录任务信息（无论API是否成功）
        const creditCost = req.featureUsage?.creditCost || 0;
        const isFree = req.featureUsage?.isFree || false;
        
        // 生成唯一任务ID
        const taskId = uuidv4();
        
        // 立即保存任务记录到数据库（确保退款时能找到）
        try {
            const { FeatureUsage } = require('../models/FeatureUsage');
            
            // 更新数据库中的使用记录
            let usage = await FeatureUsage.findOne({
                where: { userId: req.user.id, featureName: 'CLOTH_SEGMENTATION' }
            });
            
            if (usage) {
                // 已有记录，只更新任务详情
                let details = {};
                try {
                    details = usage.details ? JSON.parse(usage.details) : {};
                } catch (e) {
                    details = {};
                }
                
                if (!details.tasks) {
                    details.tasks = [];
                }
                
                // 添加新的任务记录
                details.tasks.push({
                    taskId: taskId,
                    creditCost: creditCost,
                    isFree: isFree,
                    timestamp: new Date(),
                    status: 'pending' // 标记为待处理
                });
                
                // 更新使用记录
                usage.details = JSON.stringify(details);
                usage.lastUsedAt = new Date();
                await usage.save();
            }
            
            console.log(`服饰分割任务记录已预保存: 用户ID=${req.user.id}, 任务ID=${taskId}, 积分=${creditCost}, 是否免费=${isFree}`);
        } catch (dbError) {
            console.error('预保存服饰分割使用记录失败:', dbError);
            // 继续处理，不影响用户使用
        }
        
        // 调用阿里云标准API
        try {
            const apiResult = await callClothSegmentationApi(apiParams);
            console.log('阿里云API返回结果:', JSON.stringify(apiResult, null, 2));
            
            // 保存任务信息到全局变量
            if (!global.clothingSegmentationTasks) {
                global.clothingSegmentationTasks = {};
            }
            
            // 记录任务信息
            global.clothingSegmentationTasks[taskId] = {
                userId: req.user.id,
                imageUrl: imageUrl,
                clothClasses: clothClasses,
                creditCost: creditCost,
                timestamp: new Date(),
                status: 'completed',
                result: apiResult
            };
            
            // 更新数据库中的任务状态为成功
            try {
                const { FeatureUsage } = require('../models/FeatureUsage');
                
                let usage = await FeatureUsage.findOne({
                    where: { userId: req.user.id, featureName: 'CLOTH_SEGMENTATION' }
                });
                
                if (usage && usage.details) {
                    let details = JSON.parse(usage.details);
                    if (details.tasks) {
                        // 找到对应的任务并更新状态
                        const task = details.tasks.find(t => t.taskId === taskId);
                        if (task) {
                            task.status = 'completed';
                            usage.details = JSON.stringify(details);
                            await usage.save();
                        }
                    }
                }
                
                console.log(`服饰分割任务状态已更新为完成: 任务ID=${taskId}`);
            } catch (dbError) {
                console.error('更新服饰分割任务状态失败:', dbError);
                // 继续处理，不影响用户使用
            }
            
            // 提取一份可靠的主图 URL
            const extractMain = (result) => {
              if (!result || !result.Data) return null;
              if (result.Data.ImageURL) return result.Data.ImageURL;
              if (result.Data.Elements && result.Data.Elements.length) return result.Data.Elements[0].ImageURL;
              if (result.Data.ClassUrl && Object.keys(result.Data.ClassUrl).length) {
                const first = Object.keys(result.Data.ClassUrl)[0];
                return result.Data.ClassUrl[first];
              }
              return null;
            };

            const originMainUrl = extractMain(apiResult);

            try {
                // 如果主图缺失直接抛错，转入代理逻辑
                if (!originMainUrl) throw new Error('主图 URL 为空');

                apiResult.Data.ImageURL = await uploadFromUrl(originMainUrl, 'cloth-segmentation');

                if (apiResult.Data.ClassUrl && typeof apiResult.Data.ClassUrl === 'object') {
                    const newClassUrl = {};
                    for (const key of Object.keys(apiResult.Data.ClassUrl)) {
                        newClassUrl[key] = await uploadFromUrl(apiResult.Data.ClassUrl[key], 'cloth-segmentation/class');
                    }
                    apiResult.Data.ClassUrl = newClassUrl;
                }
            } catch (ossErr) {
                console.error('上传 OSS 失败，改用代理下载:', ossErr.message);

                const toProxy = (u) => `/api/cloth-segmentation/download?url=${encodeURIComponent(u)}`;
                if (originMainUrl) {
                    apiResult.Data.ImageURL = toProxy(originMainUrl);
                }

                if (apiResult.Data.ClassUrl && typeof apiResult.Data.ClassUrl === 'object') {
                    const newClassUrl = {};
                    Object.keys(apiResult.Data.ClassUrl).forEach(k => {
                        const original = apiResult.Data.ClassUrl[k];
                        newClassUrl[k] = original ? toProxy(original) : original;
                    });
                    apiResult.Data.ClassUrl = newClassUrl;
                }
            }
            
            // 返回标准API结果
            return res.status(200).json(apiResult);
        } catch (apiError) {
            console.error('阿里云API调用失败:', apiError);
            
            // API调用失败，进行退款
            console.log(`智能服饰分割API调用失败，开始退款流程: 用户ID=${req.user.id}, 任务ID=${taskId}`);
            await refundClothSegmentationCredits(req.user.id, taskId, `API调用失败: ${apiError.message}`);
            
            return res.status(500).json({
                RequestId: uuidv4().replace(/-/g, '').toUpperCase(),
                Message: apiError.message || '服务器处理请求时出错',
                Code: apiError.Code || 'InternalError',
                success: false
            });
        }
    } catch (error) {
        console.error('服饰分割API错误:', error);
        
        // 如果有taskId，进行退款
        if (typeof taskId !== 'undefined') {
            console.log(`智能服饰分割服务器错误，开始退款流程: 用户ID=${req.user.id}, 任务ID=${taskId}`);
            await refundClothSegmentationCredits(req.user.id, taskId, `服务器错误: ${error.message}`);
        }
        
        return res.status(500).json({ 
            RequestId: uuidv4().replace(/-/g, '').toUpperCase(),
            Message: '服务器处理请求时出错', 
            Code: 'InternalError',
            success: false
        });
    }
});

/**
 * 服饰分割API - 查询任务状态
 * 用于获取异步任务的执行状态和结果
 */
router.get('/task-status/:taskId', protect, async (req, res) => {
    try {
        const { taskId } = req.params;
        
        if (!taskId) {
            return res.status(400).json({
                success: false,
                message: '任务ID不能为空'
            });
        }
        
        console.log(`查询服饰分割任务状态: ${taskId}`);
        
        // 从环境变量获取API密钥
        const apiKey = process.env.DASHSCOPE_API_KEY;
        
        if (!apiKey) {
            throw new Error('缺少阿里云DashScope API密钥配置');
        }
        
        // 准备请求头
        const headers = {
            'Authorization': `Bearer ${apiKey}`
        };
        
        // 查询任务状态
        const response = await axios.get(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, { headers });
        
        console.log('查询任务状态响应:', response.status, JSON.stringify(response.data, null, 2));
        
        const taskStatus = response.data.output.task_status;
        
        // 如果任务成功完成
        if (taskStatus === 'SUCCEEDED') {
            // 处理结果
            const result = {
                RequestId: response.data.request_id,
                Data: {
                    Elements: [],
                    ImageURL: '',
                    ClassUrl: {}
                }
            };
            
            // 提取主图URL
            if (response.data.output.results && response.data.output.results.length > 0) {
                if (response.data.output.results[0].url) {
                    result.Data.ImageURL = response.data.output.results[0].url;
                }
            } else if (response.data.output.result_url) {
                result.Data.ImageURL = response.data.output.result_url;
            } else if (response.data.output.image_url) {
                result.Data.ImageURL = response.data.output.image_url;
            }
            
            // 提取分类图URL
            if (response.data.output.class_urls) {
                result.Data.ClassUrl = response.data.output.class_urls;
            }
            
            return res.status(200).json(result);
        }
        // 如果任务失败
        else if (taskStatus === 'FAILED') {
            // 任务失败，进行退款
            console.log(`智能服饰分割任务失败，开始退款流程: 用户ID=${req.user.id}, 任务ID=${taskId}`);
            const failureReason = response.data.output.message || '服饰分割任务失败';
            await refundClothSegmentationCredits(req.user.id, taskId, failureReason);
            
            return res.status(500).json({
                success: false,
                RequestId: response.data.request_id,
                Message: failureReason,
                Code: response.data.output.code || 'TaskFailed',
                Data: null
            });
        }
        // 如果任务仍在处理中
        else {
            return res.status(200).json({
                success: true,
                RequestId: response.data.request_id,
                Message: '服饰分割任务正在处理中',
                taskStatus: taskStatus,
                Data: {
                    TaskId: taskId,
                    TaskStatus: taskStatus
                }
            });
        }
    } catch (error) {
        console.error('查询服饰分割任务状态出错:', error);
        
        if (error.response) {
            // 阿里云API错误
            return res.status(error.response.status || 500).json({
                success: false,
                message: '查询任务状态失败: ' + (error.response.data.message || error.message),
                error: error.response.data
            });
        }
        
        return res.status(500).json({
            success: false,
            message: '服务器错误，无法查询任务状态',
            error: error.message
        });
    }
});

// 下载代理路由, 避免 Mixed-Content
router.get('/download', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('缺少 url 参数');
  try {
    const response = await axios.get(url, { responseType: 'stream' });
    res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    response.data.pipe(res);
  } catch (e) {
    console.error('[proxy-download] 失败:', e.message);
    res.status(500).send('文件下载失败');
  }
});

module.exports = router; 