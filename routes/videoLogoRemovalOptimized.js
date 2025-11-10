const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/auth');
const { createUnifiedFeatureMiddleware } = require('../middleware/unifiedFeatureUsage');
const { uploadVideoToOSS } = require('../utils/ossUtils');
const { FileNameOptimizer, generateSafeOSSPath, sanitizeFileName } = require('../utils/fileNameUtils');
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
 * 智能优化文件名并生成用户友好的建议
 * @param {string} fileName - 原始文件名
 * @returns {Object} 优化结果和建议
 */
function optimizeFileNameWithSuggestion(fileName) {
    const result = FileNameOptimizer.optimizeFileName(fileName, {
        strategy: 'smart',
        maxLength: 50,
        preserveOriginal: true
    });
    
    return {
        optimized: result.optimized,
        isChanged: result.isChanged,
        transformations: result.transformations,
        suggestion: result.suggestion,
        analysis: result.originalAnalysis
    };
}

// 配置multer用于内存存储
const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 1024 * 1024 * 1024, // 1GB限制
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // 检查文件扩展名
        const ext = path.extname(file.originalname).toLowerCase();
        const validExtensions = ['.mp4', '.m4v'];
        
        // 检查MIME类型（支持多种常见的MP4 MIME类型）
        const validMimeTypes = [
            'video/mp4',
            'video/x-mp4',
            'video/mp4v-es',
            'video/quicktime' // 某些MP4文件可能被识别为quicktime
        ];
        
        // 如果扩展名是MP4，或者MIME类型匹配，则接受
        if (validExtensions.includes(ext) || validMimeTypes.includes(file.mimetype)) {
            console.log('✅ 文件验证通过:', {
                filename: file.originalname,
                mimetype: file.mimetype,
                extension: ext
            });
            cb(null, true);
        } else {
            console.log('❌ 文件验证失败:', {
                filename: file.originalname,
                mimetype: file.mimetype,
                extension: ext
            });
            cb(new Error(`只支持MP4格式的视频文件。当前文件：${file.originalname}，类型：${file.mimetype || '未知'}`));
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
    
    const sortedParams = Object.keys(commonParams).sort().reduce((result, key) => {
        result[key] = commonParams[key];
        return result;
    }, {});
    
    const queryString = Object.keys(sortedParams)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(sortedParams[key])}`)
        .join('&');
    
    const stringToSign = `${method}&${encodeURIComponent('/')}&${encodeURIComponent(queryString)}`;
    
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
            timeout: 30000,
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
 * @route   POST /api/video-logo-removal/submit
 * @desc    提交视频去水印/logo任务
 * @access  私有
 */
router.post('/submit', protect, 
    // 处理multer中间件，捕获文件上传错误
    (req, res, next) => {
        memoryUpload.single('video')(req, res, (err) => {
            if (err) {
                console.error('❌ 文件上传错误:', err.message);
                // 如果是multer错误，返回友好的错误信息
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        message: '视频文件大小不能超过1GB'
                    });
                }
                // 文件类型错误
                return res.status(400).json({
                    success: false,
                    message: err.message || '文件上传失败，请检查文件格式和大小'
                });
            }
            next();
        });
    },
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
            file: req.file ? req.file.originalname : 'none',
            fileSize: req.file ? req.file.size : 0,
            mimetype: req.file ? req.file.mimetype : 'none'
        });
        
        // 验证文件上传
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请上传视频文件'
            });
        }
        
        const videoFile = req.file;
        
        // 验证文件大小（1GB限制）
        if (videoFile.size > 1024 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                message: '视频文件大小不能超过1GB'
            });
        }
        
        // 解析标志区域参数（必需）
        let logoBoxes = [];
        try {
            if (req.body.logoBoxes) {
                logoBoxes = JSON.parse(req.body.logoBoxes);
                console.log('🎯 解析到的标志区域:', logoBoxes);
            } else {
                // 如果没有提供水印区域，返回错误
                return res.status(400).json({
                    success: false,
                    message: '请至少选择一个水印区域。在视频预览区域点击并拖拽来选择要去除的水印区域。'
                });
            }
        } catch (parseError) {
            console.warn('⚠️ 解析标志区域参数失败:', parseError.message);
            return res.status(400).json({
                success: false,
                message: '水印区域参数格式错误，请重新选择水印区域'
            });
        }
        
        // 验证水印区域参数
        if (!Array.isArray(logoBoxes) || logoBoxes.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请至少选择一个水印区域。在视频预览区域点击并拖拽来选择要去除的水印区域。'
            });
        }
        
        // 验证每个区域参数格式
        for (let i = 0; i < logoBoxes.length; i++) {
            const box = logoBoxes[i];
            if (!box || typeof box.x !== 'number' || typeof box.y !== 'number' || 
                typeof box.w !== 'number' || typeof box.h !== 'number') {
                return res.status(400).json({
                    success: false,
                    message: `水印区域 ${i + 1} 参数格式错误，请重新选择`
                });
            }
            // 验证坐标范围（0-1之间）
            if (box.x < 0 || box.x > 1 || box.y < 0 || box.y > 1 ||
                box.w <= 0 || box.w > 1 || box.h <= 0 || box.h > 1) {
                return res.status(400).json({
                    success: false,
                    message: `水印区域 ${i + 1} 坐标超出范围，请重新选择`
                });
            }
        }
        
        // 智能优化文件名
        console.log('📤 开始上传视频到OSS...');
        const originalFileName = videoFile.originalname || 'video.mp4';
        const fileNameResult = optimizeFileNameWithSuggestion(originalFileName);
        const ossKey = generateSafeOSSPath(userId, taskId, originalFileName, '_input');
        
        console.log('📁 文件名优化结果:', {
            original: originalFileName,
            optimized: fileNameResult.optimized,
            isChanged: fileNameResult.isChanged,
            transformations: fileNameResult.transformations,
            ossPath: ossKey
        });
        
        // 如果文件名被优化，记录建议信息
        if (fileNameResult.isChanged) {
            console.log('💡 文件名优化建议:', fileNameResult.suggestion);
        }
        
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
        
        // 使用新的服务创建任务
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
                status: task.status,
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
 * @route   GET /api/video-logo-removal/task/:taskId
 * @desc    查询视频去水印任务详细信息（兼容路由）
 * @access  私有
 */
router.get('/task/:taskId', protect, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;
        
        console.log('🔍 查询任务详情:', { taskId, userId });
        
        // 从数据库获取任务信息
        const task = await VideoLogoRemovalService.getTaskById(taskId);
        
        // 验证用户权限
        if (task.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: '无权访问此任务'
            });
        }
        
        res.json({
            success: true,
            data: task
        });
        
    } catch (error) {
        console.error('❌ 查询任务详情失败:', error);
        
        if (error.message === '任务不存在') {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        res.status(500).json({
            success: false,
            message: '查询任务详情失败: ' + error.message
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
        
        // 从数据库获取任务信息
        const task = await VideoLogoRemovalService.getTaskById(taskId);
        
        // 验证用户权限
        if (task.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: '无权访问此任务'
            });
        }
        
        // 如果任务已完成，直接返回结果
        if (task.status === 'completed' || task.status === 'failed') {
            return res.json({
                success: true,
                data: {
                    taskId: taskId,
                    status: task.status,
                    resultVideoUrl: task.resultVideoUrl,
                    message: task.message,
                    updatedAt: task.updatedAt
                }
            });
        }
        
        // 查询阿里云任务状态
        const queryResult = await VideoLogoRemovalService.queryAliyunTaskResult(task.aliyunTaskId);
        
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
        
        // 解析任务状态并更新数据库
        let status = 'processing';
        let resultVideoUrl = null;
        let message = '任务处理中';
        
        if (aliyunData.Status === 'PROCESS_SUCCESS') {
            // 解析结果URL
            try {
                const result = JSON.parse(aliyunData.Result);
                resultVideoUrl = result.VideoUrl;
                
                // 更新任务状态为完成
                const updatedTask = await VideoLogoRemovalService.updateTaskStatus(taskId, 'completed', {
                    resultVideoUrl: resultVideoUrl,
                    videoDuration: aliyunData.VideoDuration
                });
                
                status = updatedTask.status;
                message = updatedTask.message;
                
                console.log('✅ 任务完成:', { taskId, resultVideoUrl });
                
            } catch (parseError) {
                console.error('❌ 解析任务结果失败:', parseError);
                const updatedTask = await VideoLogoRemovalService.updateTaskStatus(taskId, 'failed', {
                    message: '解析任务结果失败',
                    errorDetails: { parseError: parseError.message }
                });
                status = updatedTask.status;
                message = updatedTask.message;
            }
        } else if (aliyunData.Status === 'PROCESS_FAIL') {
            // 更新任务状态为失败
            const updatedTask = await VideoLogoRemovalService.updateTaskStatus(taskId, 'failed', {
                message: '阿里云处理失败',
                errorDetails: aliyunData
            });
            status = updatedTask.status;
            message = updatedTask.message;
        }
        
        res.json({
            success: true,
            data: {
                taskId: taskId,
                status: status,
                resultVideoUrl: resultVideoUrl,
                message: message,
                updatedAt: task.updatedAt
            }
        });
        
    } catch (error) {
        console.error('❌ 查询任务状态失败:', error);
        
        if (error.message === '任务不存在') {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        console.log('📋 获取用户任务历史:', { userId, page, limit });
        
        // 从数据库获取用户的任务历史
        const result = await VideoLogoRemovalService.getUserTasks(userId, limit, offset);
        
        // 格式化返回数据
        const tasks = result.tasks.map(task => ({
            taskId: task.taskId,
            status: task.status,
            inputVideoUrl: task.inputVideoUrl,
            resultVideoUrl: task.resultVideoUrl,
            logoBoxes: task.getLogoBoxes(),
            creditCost: task.creditCost,
            actualCreditCost: task.actualCreditCost,
            isFree: task.isFree,
            videoDuration: task.videoDuration,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            completedAt: task.completedAt,
            message: task.message
        }));
        
        res.json({
            success: true,
            data: {
                tasks: tasks,
                total: result.total,
                page: page,
                limit: limit,
                hasMore: result.hasMore
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
        
        // 从数据库获取任务信息
        const task = await VideoLogoRemovalService.getTaskById(taskId);
        
        // 验证用户权限
        if (task.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: '无权访问此任务'
            });
        }
        
        // 检查任务是否完成
        if (task.status !== 'completed' || !task.resultVideoUrl) {
            return res.status(400).json({
                success: false,
                message: '任务尚未完成或没有可下载的结果'
            });
        }
        
        try {
            // 从结果URL下载视频
            console.log('🌐 从阿里云下载视频:', task.resultVideoUrl);
            
            const response = await axios({
                method: 'GET',
                url: task.resultVideoUrl,
                responseType: 'stream',
                timeout: 300000 // 5分钟超时
            });
            
            // 生成安全的下载文件名
            const originalFileName = task.originalFileName || 'video.mp4';
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
        
        if (error.message === '任务不存在') {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        res.status(500).json({
            success: false,
            message: '下载视频失败: ' + error.message
        });
    }
});

/**
 * @route   GET /api/video-logo-removal/stats
 * @desc    获取用户的视频去水印任务统计
 * @access  私有
 */
router.get('/stats', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        
        console.log('📊 获取用户任务统计:', userId);
        
        const stats = await VideoLogoRemovalService.getTaskStats(userId);
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('❌ 获取任务统计失败:', error);
        res.status(500).json({
            success: false,
            message: '获取任务统计失败: ' + error.message
        });
    }
});

module.exports = router;
