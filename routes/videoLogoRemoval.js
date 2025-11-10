const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const { createUnifiedFeatureMiddleware } = require('../middleware/unifiedFeatureUsage');
const { uploadVideoToOSS, uploadVideoLogoRemovalResultToOSS } = require('../utils/ossUtils');
const axios = require('axios');
const VideoLogoRemovalService = require('../services/videoLogoRemovalService');
const { VideoLogoRemovalTask } = require('../models/VideoLogoRemovalTask');

/**
 * 验证URL是否包含中文字符
 * 阿里云API要求URL地址不能包含中文字符
 */
function validateUrlCharacters(url) {
    const chineseRegex = /[\u4e00-\u9fa5]/;
    if (chineseRegex.test(url)) {
        throw new Error('视频URL不能包含中文字符，请确保文件名和路径只包含英文字符和数字');
    }
    return true;
}

/**
 * 规范化文件名，确保只包含英文字母、数字、下划线和连字符
 */
function sanitizeFileName(fileName) {
    // 移除文件扩展名
    const ext = path.extname(fileName);
    const nameWithoutExt = path.basename(fileName, ext);
    
    // 替换中文字符和特殊字符为下划线
    const sanitized = nameWithoutExt
        .replace(/[\u4e00-\u9fa5]/g, '_')  // 替换中文字符
        .replace(/[^a-zA-Z0-9_-]/g, '_')  // 替换其他特殊字符
        .replace(/_+/g, '_')              // 合并多个下划线
        .replace(/^_|_$/g, '');           // 移除开头和结尾的下划线
    
    // 如果处理后为空，使用默认名称
    const finalName = sanitized || 'video';
    
    return finalName + ext;
}

/**
 * 生成安全的OSS文件路径
 */
function generateSafeOSSPath(userId, taskId, originalFileName, suffix = '') {
    const sanitizedFileName = sanitizeFileName(originalFileName);
    const baseName = path.basename(sanitizedFileName, path.extname(sanitizedFileName));
    const ext = path.extname(sanitizedFileName);
    
    return `video-logo-removal/${userId}/${taskId}_${baseName}${suffix}${ext}`;
}

// 配置multer用于内存存储
const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 1024 * 1024 * 1024, // 1GB限制（根据阿里云API要求）
        files: 1 // 只允许1个视频文件
    },
    fileFilter: (req, file, cb) => {
        // 视频文件验证 - 只支持MP4格式
        if (file.mimetype === 'video/mp4') {
            cb(null, true);
        } else {
            console.log('🔍 调试 - 上传的视频文件MIME类型:', file.mimetype, '文件名:', file.originalname);
            cb(new Error('只支持MP4格式的视频文件，当前文件类型：' + file.mimetype));
        }
    }
});

// 阿里云视觉智能开放平台配置
const ALIYUN_VIAPI_CONFIG = {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
    endpoint: 'https://videoenhan.cn-shanghai.aliyuncs.com',
    region: 'cn-shanghai'
};

/**
 * 生成阿里云API签名
 */
function generateSignature(params, method = 'POST') {
    const crypto = require('crypto');
    
    // 添加公共参数
    const commonParams = {
        'Action': 'EraseVideoLogo',
        'Version': '2020-03-20',
        'AccessKeyId': ALIYUN_VIAPI_CONFIG.accessKeyId,
        'SignatureMethod': 'HMAC-SHA1',
        'Timestamp': new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        'SignatureVersion': '1.0',
        'SignatureNonce': Math.random().toString(36).substring(2, 15),
        'Format': 'JSON',
        ...params
    };
    
    // 对参数进行排序
    const sortedParams = Object.keys(commonParams).sort().reduce((result, key) => {
        result[key] = commonParams[key];
        return result;
    }, {});
    
    // 构造待签名字符串
    const queryString = Object.keys(sortedParams)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(sortedParams[key])}`)
        .join('&');
    
    const stringToSign = `${method}&${encodeURIComponent('/')}&${encodeURIComponent(queryString)}`;
    
    // 生成签名
    const signature = crypto
        .createHmac('sha1', ALIYUN_VIAPI_CONFIG.accessKeySecret + '&')
        .update(stringToSign)
        .digest('base64');
    
    return {
        ...sortedParams,
        'Signature': signature
    };
}

/**
 * 调用阿里云视频标志擦除API
 */
async function callAliyunEraseVideoLogo(videoUrl, logoBoxes = []) {
    try {
        console.log('🎬 开始调用阿里云视频标志擦除API');
        console.log('📹 视频URL:', videoUrl);
        console.log('🎯 标志区域:', logoBoxes);
        
        // 验证URL字符合规性
        try {
            validateUrlCharacters(videoUrl);
            console.log('✅ URL字符验证通过');
        } catch (urlError) {
            console.error('❌ URL字符验证失败:', urlError.message);
            return {
                success: false,
                error: urlError.message,
                code: 'URL_INVALID_CHARACTERS'
            };
        }
        
        // 准备API参数
        const apiParams = {
            VideoUrl: videoUrl
        };
        
        // 添加标志区域参数（如果有指定）
        if (logoBoxes && logoBoxes.length > 0) {
            logoBoxes.forEach((box, index) => {
                if (index < 2) { // 最多支持2个区域
                    apiParams[`Boxes.${index + 1}.X`] = box.x;
                    apiParams[`Boxes.${index + 1}.Y`] = box.y;
                    apiParams[`Boxes.${index + 1}.W`] = box.w;
                    apiParams[`Boxes.${index + 1}.H`] = box.h;
                }
            });
        }
        
        // 生成签名参数
        const signedParams = generateSignature(apiParams);
        
        // 构造请求URL
        const queryString = Object.keys(signedParams)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(signedParams[key])}`)
            .join('&');
        
        const requestUrl = `${ALIYUN_VIAPI_CONFIG.endpoint}/?${queryString}`;
        
        console.log('🔗 请求URL:', requestUrl.substring(0, 100) + '...');
        
        // 发送请求
        const response = await axios.post(requestUrl, null, {
            timeout: 30000, // 30秒超时
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        console.log('✅ 阿里云API响应状态:', response.status);
        console.log('📄 阿里云API响应数据:', JSON.stringify(response.data, null, 2));
        
        return {
            success: true,
            data: response.data
        };
        
    } catch (error) {
        console.error('❌ 调用阿里云视频标志擦除API失败:', error);
        
        if (error.response) {
            console.error('📄 错误响应数据:', error.response.data);
            console.error('📊 错误响应状态:', error.response.status);
        }
        
        return {
            success: false,
            error: error.message,
            details: error.response?.data
        };
    }
}

/**
 * 查询异步任务结果
 */
async function queryAsyncJobResult(jobId) {
    try {
        console.log('🔍 查询异步任务结果, JobId:', jobId);
        
        const apiParams = {
            Action: 'GetAsyncJobResult',
            JobId: jobId
        };
        
        // 生成签名参数
        const signedParams = generateSignature(apiParams, 'GET');
        
        // 构造请求URL
        const queryString = Object.keys(signedParams)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(signedParams[key])}`)
            .join('&');
        
        const requestUrl = `${ALIYUN_VIAPI_CONFIG.endpoint}/?${queryString}`;
        
        // 发送GET请求
        const response = await axios.get(requestUrl, {
            timeout: 15000, // 15秒超时
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        console.log('✅ 查询任务结果响应:', JSON.stringify(response.data, null, 2));
        
        return {
            success: true,
            data: response.data
        };
        
    } catch (error) {
        console.error('❌ 查询异步任务结果失败:', error);
        
        return {
            success: false,
            error: error.message,
            details: error.response?.data
        };
    }
}

/**
 * @route   POST /api/video-logo-removal/submit
 * @desc    提交视频去水印/logo任务
 * @access  私有
 */
router.post('/submit', protect, 
    memoryUpload.single('video'),
    createUnifiedFeatureMiddleware('VIDEO_LOGO_REMOVAL'), 
    async (req, res) => {
    try {
        const userId = req.user.id;
        const { taskId, usageType, creditCost, isFree } = req.featureUsage || {};
        
        console.log('📥 收到视频去水印请求:', {
            userId,
            taskId,
            usageType,
            creditCost,
            isFree,
            file: req.file ? req.file.originalname : 'none'
        });
        
        // 验证文件上传
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请上传视频文件'
            });
        }
        
        const videoFile = req.file;
        
        // 添加调试日志
        console.log('📋 接收到的文件信息:', {
            originalname: videoFile.originalname,
            mimetype: videoFile.mimetype,
            size: videoFile.size,
            hasBuffer: !!videoFile.buffer,
            bufferType: videoFile.buffer ? typeof videoFile.buffer : 'undefined',
            isBuffer: videoFile.buffer ? Buffer.isBuffer(videoFile.buffer) : false,
            bufferLength: videoFile.buffer ? videoFile.buffer.length : 0
        });
        
        // 验证文件大小（1GB限制）
        if (videoFile.size > 1024 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                message: '视频文件大小不能超过1GB'
            });
        }
        
        // 解析标志区域参数
        let logoBoxes = [];
        try {
            if (req.body.logoBoxes) {
                logoBoxes = JSON.parse(req.body.logoBoxes);
                console.log('🎯 解析到的标志区域:', logoBoxes);
            }
        } catch (parseError) {
            console.warn('⚠️ 解析标志区域参数失败:', parseError.message);
        }
        
        // 上传视频到OSS - 使用安全的文件名
        console.log('📤 开始上传视频到OSS...');
        const originalFileName = videoFile.originalname || 'video.mp4';
        const ossKey = generateSafeOSSPath(userId, taskId, originalFileName, '_input');
        
        console.log('📁 原始文件名:', originalFileName);
        console.log('📁 安全OSS路径:', ossKey);
        
        // 上传视频到OSS
        let videoUrl;
        try {
            // 验证buffer存在
            if (!videoFile.buffer) {
                throw new Error('视频文件buffer不存在，请重新上传文件');
            }
            
            videoUrl = await uploadVideoToOSS(
                videoFile.buffer,
                ossKey,
                videoFile.mimetype
            );
        } catch (uploadError) {
            console.error('❌ OSS上传失败:', uploadError);
            return res.status(500).json({
                success: false,
                message: '上传视频到OSS失败: ' + uploadError.message
            });
        }
        console.log('✅ 视频上传成功, URL:', videoUrl);
        
        // 调用阿里云视频标志擦除API
        const apiResult = await callAliyunEraseVideoLogo(videoUrl, logoBoxes);
        
        if (!apiResult.success) {
            let errorMessage = '调用阿里云API失败: ' + apiResult.error;
            
            // 针对URL字符问题提供更友好的错误提示
            if (apiResult.code === 'URL_INVALID_CHARACTERS') {
                errorMessage = '视频文件名包含中文字符，请重新上传文件名只包含英文字母和数字的视频文件';
            }
            
            return res.status(500).json({
                success: false,
                message: errorMessage,
                code: apiResult.code,
                details: apiResult.details
            });
        }
        
        // 提取任务ID（RequestId）
        const aliyunTaskId = apiResult.data.RequestId;
        
        if (!aliyunTaskId) {
            return res.status(500).json({
                success: false,
                message: '阿里云API未返回有效的任务ID',
                details: apiResult.data
            });
        }
        
        // 保存任务信息到数据库
        const task = await VideoLogoRemovalService.createTask({
            userId: userId,
            taskId: taskId,
            aliyunTaskId: aliyunTaskId,
            inputVideoUrl: videoUrl,
            originalFileName: originalFileName,
            logoBoxes: logoBoxes,
            creditCost: creditCost,
            isFree: isFree
        });
        
        console.log('✅ 任务提交成功:', {
            taskId,
            aliyunTaskId,
            status: task.status
        });
        
        // 返回成功响应
        res.json({
            success: true,
            message: '视频去水印任务提交成功',
            data: {
                taskId: taskId,
                aliyunTaskId: aliyunTaskId,
                status: 'processing',
                estimatedTime: '预计需要2-5分钟处理',
                inputVideoUrl: videoUrl
            }
        });
        
    } catch (error) {
        console.error('❌ 提交视频去水印任务失败:', error);
        res.status(500).json({
            success: false,
            message: '提交任务失败: ' + error.message
        });
    }
});

/**
 * @route   GET /api/video-logo-removal/status/:taskId
 * @desc    查询视频去水印任务状态
 * @access  私有
 */
router.get('/status/:taskId', protect, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;
        
        console.log('🔍 查询任务状态:', { taskId, userId });
        
        // 从全局变量获取任务信息
        const taskInfo = global.videoLogoRemovalTasks?.[taskId];
        
        if (!taskInfo) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 验证用户权限
        if (taskInfo.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: '无权访问此任务'
            });
        }
        
        // 如果任务已完成，直接返回结果
        if (taskInfo.status === 'completed' || taskInfo.status === 'failed') {
            return res.json({
                success: true,
                data: {
                    taskId: taskId,
                    status: taskInfo.status,
                    resultVideoUrl: taskInfo.resultVideoUrl,
                    message: taskInfo.message,
                    updatedAt: taskInfo.updatedAt
                }
            });
        }
        
        // 查询阿里云任务状态
        const queryResult = await queryAsyncJobResult(taskInfo.aliyunTaskId);
        
        if (!queryResult.success) {
            console.error('❌ 查询阿里云任务状态失败:', queryResult.error);
            return res.status(500).json({
                success: false,
                message: '查询任务状态失败: ' + queryResult.error
            });
        }
        
        const aliyunData = queryResult.data.Data;
        
        if (!aliyunData) {
            return res.json({
                success: true,
                data: {
                    taskId: taskId,
                    status: 'processing',
                    message: '任务处理中，请稍后查询'
                }
            });
        }
        
        // 解析任务状态
        let status = 'processing';
        let resultVideoUrl = null;
        let message = '任务处理中';
        
        if (aliyunData.Status === 'PROCESS_SUCCESS') {
            status = 'completed';
            message = '任务完成';
            
            // 解析结果URL
            try {
                const result = JSON.parse(aliyunData.Result);
                resultVideoUrl = result.VideoUrl;
                
                // 更新任务信息
                taskInfo.status = 'completed';
                taskInfo.resultVideoUrl = resultVideoUrl;
                taskInfo.message = message;
                taskInfo.updatedAt = new Date();
                
                console.log('✅ 任务完成:', { taskId, resultVideoUrl });
                
                // 🔄 异步上传结果视频到OSS（不阻塞用户响应）
                uploadVideoLogoRemovalResultToOSS(resultVideoUrl, userId, taskId)
                    .then(ossResult => {
                        if (ossResult.success) {
                            console.log('✅ 视频去水印结果已成功存储到OSS:', ossResult.url);
                            // 更新任务信息，添加OSS URL
                            taskInfo.ossResultUrl = ossResult.url;
                            taskInfo.ossPath = ossResult.ossPath;
                            taskInfo.videoSize = ossResult.size;
                        } else {
                            console.error('❌ OSS存储失败:', ossResult.error);
                            // OSS存储失败不影响主流程，用户仍可使用阿里云临时URL
                        }
                    })
                    .catch(error => {
                        console.error('❌ OSS存储异常:', error);
                        // OSS存储异常不影响主流程
                    });
                
                // 🔧 任务完成时扣除积分（按新的计费规则：5积分/30秒，不满30秒按30秒计算）
                if (!taskInfo.creditProcessed && !taskInfo.isFree) {
                    try {
                        // 获取视频时长（这里需要从阿里云API或其他方式获取）
                        // 暂时使用默认时长，实际应该从API结果中获取
                        const videoDuration = aliyunData.VideoDuration || 30; // 默认30秒
                        
                        // 计算积分：5积分/30秒，不满30秒按30秒计算
                        const billingUnits = Math.ceil(videoDuration / 30);
                        const totalCredits = billingUnits * 5;
                        
                        console.log(`💰 视频去水印积分计算: 视频时长=${videoDuration}秒, 计费单位=${billingUnits}个30秒, 总积分=${totalCredits}`);
                        
                        // 调用统一功能使用记录系统扣除积分
                        const { saveTaskDetails } = require('../middleware/unifiedFeatureUsage');
                        const { FeatureUsage } = require('../models/FeatureUsage');
                        
                        // 查找功能使用记录
                        const featureUsage = await FeatureUsage.findOne({
                            where: { userId: userId, featureName: 'VIDEO_LOGO_REMOVAL' }
                        });
                        
                        if (featureUsage) {
                            await saveTaskDetails(featureUsage, {
                                taskId: taskId,
                                status: 'completed',
                                featureName: 'VIDEO_LOGO_REMOVAL',
                                creditCost: totalCredits,
                                isFree: false,
                                extraData: {
                                    videoDuration: videoDuration,
                                    billingUnits: billingUnits,
                                    resultVideoUrl: resultVideoUrl,
                                    aliyunTaskId: taskInfo.aliyunTaskId
                                }
                            });
                            
                            // 标记积分已处理，避免重复扣除
                            taskInfo.creditProcessed = true;
                            taskInfo.actualCreditCost = totalCredits;
                            
                            console.log('✅ 视频去水印积分扣除成功:', totalCredits);
                        }
                    } catch (creditError) {
                        console.error('❌ 扣除积分失败:', creditError);
                    }
                }
                
            } catch (parseError) {
                console.error('❌ 解析任务结果失败:', parseError);
                status = 'failed';
                message = '解析任务结果失败';
            }
        } else if (aliyunData.Status === 'PROCESS_FAIL') {
            status = 'failed';
            message = '任务处理失败';
            
            // 更新任务信息
            taskInfo.status = 'failed';
            taskInfo.message = message;
            taskInfo.updatedAt = new Date();
        }
        
        res.json({
            success: true,
            data: {
                taskId: taskId,
                status: status,
                resultVideoUrl: resultVideoUrl,
                ossResultUrl: taskInfo.ossResultUrl, // OSS存储的永久URL（如果可用）
                message: message,
                updatedAt: taskInfo.updatedAt,
                videoSize: taskInfo.videoSize, // 视频文件大小
                storageInfo: {
                    hasOSSBackup: !!taskInfo.ossResultUrl,
                    aliyunTempUrl: resultVideoUrl, // 阿里云临时URL（24小时有效）
                    ossUrl: taskInfo.ossResultUrl // OSS永久URL
                }
            }
        });
        
    } catch (error) {
        console.error('❌ 查询任务状态失败:', error);
        res.status(500).json({
            success: false,
            message: '查询任务状态失败: ' + error.message
        });
    }
});

/**
 * @route   GET /api/video-logo-removal/history
 * @desc    获取用户的视频去水印任务历史
 * @access  私有
 */
router.get('/history', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        
        console.log('📋 获取用户任务历史:', userId);
        
        // 从全局变量获取用户的所有任务
        const userTasks = [];
        
        if (global.videoLogoRemovalTasks) {
            Object.keys(global.videoLogoRemovalTasks).forEach(taskId => {
                const task = global.videoLogoRemovalTasks[taskId];
                if (task.userId === userId) {
                    userTasks.push({
                        taskId: taskId,
                        status: task.status,
                        inputVideoUrl: task.inputVideoUrl,
                        resultVideoUrl: task.resultVideoUrl,
                        ossResultUrl: task.ossResultUrl, // OSS存储的永久URL
                        logoBoxes: task.logoBoxes,
                        creditCost: task.creditCost,
                        isFree: task.isFree,
                        createdAt: task.createdAt,
                        updatedAt: task.updatedAt,
                        message: task.message,
                        videoSize: task.videoSize, // 视频文件大小
                        storageInfo: {
                            hasOSSBackup: !!task.ossResultUrl,
                            aliyunTempUrl: task.resultVideoUrl, // 阿里云临时URL（24小时有效）
                            ossUrl: task.ossResultUrl // OSS永久URL
                        }
                    });
                }
            });
        }
        
        // 按创建时间倒序排列
        userTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json({
            success: true,
            data: {
                tasks: userTasks,
                total: userTasks.length
            }
        });
        
    } catch (error) {
        console.error('❌ 获取任务历史失败:', error);
        res.status(500).json({
            success: false,
            message: '获取任务历史失败: ' + error.message
        });
    }
});

/**
 * @route   GET /api/video-logo-removal/download/:taskId
 * @desc    下载处理完成的视频
 * @access  私有
 */
router.get('/download/:taskId', protect, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;
        
        console.log('📥 开始下载视频:', { taskId, userId });
        
        // 从全局变量获取任务信息
        const taskInfo = global.videoLogoRemovalTasks?.[taskId];
        
        if (!taskInfo) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 验证用户权限
        if (taskInfo.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: '无权访问此任务'
            });
        }
        
        // 检查任务是否完成
        if (taskInfo.status !== 'completed' || (!taskInfo.resultVideoUrl && !taskInfo.ossResultUrl)) {
            return res.status(400).json({
                success: false,
                message: '任务尚未完成或没有可下载的结果'
            });
        }
        
        try {
            // 优先使用OSS存储的视频，回退到阿里云临时URL
            const videoUrl = taskInfo.ossResultUrl || taskInfo.resultVideoUrl;
            const isOSSUrl = !!taskInfo.ossResultUrl;
            
            console.log('🌐 下载视频:', { 
                videoUrl, 
                isOSSUrl, 
                taskId,
                ossAvailable: !!taskInfo.ossResultUrl,
                aliyunAvailable: !!taskInfo.resultVideoUrl
            });
            
            const response = await axios({
                method: 'GET',
                url: videoUrl,
                responseType: 'stream',
                timeout: 300000 // 5分钟超时
            });
            
            // 生成安全的下载文件名
            const originalFileName = taskInfo.originalFileName || 'video.mp4';
            const safeFileName = sanitizeFileName(originalFileName);
            const downloadFileName = safeFileName.replace(/\.(mp4|avi|mov|mkv)$/i, '_logo_removed$&');
            
            console.log('📁 原始文件名:', originalFileName);
            console.log('📁 下载文件名:', downloadFileName);
            
            // 设置响应头
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);
            res.setHeader('Cache-Control', 'no-cache');
            
            // 管道传输视频数据
            response.data.pipe(res);
            
            // 处理下载完成
            response.data.on('end', () => {
                console.log('✅ 视频下载完成:', downloadFileName);
            });
            
            // 处理下载错误
            response.data.on('error', (error) => {
                console.error('❌ 视频下载流错误:', error);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: '下载视频时发生错误'
                    });
                }
            });
            
        } catch (downloadError) {
            console.error('❌ 下载视频失败:', downloadError);
            
            if (downloadError.code === 'ECONNABORTED') {
                return res.status(408).json({
                    success: false,
                    message: '下载超时，请稍后重试'
                });
            }
            
            return res.status(500).json({
                success: false,
                message: '下载视频失败: ' + downloadError.message
            });
        }
        
    } catch (error) {
        console.error('❌ 下载视频失败:', error);
        res.status(500).json({
            success: false,
            message: '下载视频失败: ' + error.message
        });
    }
});

module.exports = router;
