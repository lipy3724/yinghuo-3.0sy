const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const { createUnifiedFeatureMiddleware } = require('../middleware/unifiedFeatureUsage');
const { uploadImageToOSS, uploadVideoToOSS, uploadVideoFaceSwapResultToOSS, getOSSClient } = require('../utils/ossUtils');
const axios = require('axios');
const crypto = require('crypto');
const videoenhan20200320 = require('@alicloud/videoenhan20200320');
const OpenApi = require('@alicloud/openapi-client');
const Util = require('@alicloud/tea-util');
const { imageSize } = require('image-size');

// 配置multer用于内存存储
const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 120 * 1024 * 1024, // 120MB限制（根据阿里云API要求）
        files: 2 // 最多2个文件（1个视频 + 1个图片）
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'video') {
            // 视频文件验证
            const allowedVideoTypes = [
                'video/mp4',           // MP4格式
                'video/avi',           // AVI格式  
                'video/quicktime',     // MOV格式
                'video/x-msvideo',     // AVI格式的另一种MIME类型
                'video/x-matroska',   // MKV格式
                'video/x-flv',        // FLV格式
                'video/mpeg',         // MPG格式
                'video/MP2T'          // TS格式
            ];
            if (allowedVideoTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                console.log('🔍 调试 - 上传的视频文件MIME类型:', file.mimetype, '文件名:', file.originalname);
                cb(new Error('只支持MP4、AVI、MKV、MOV、FLV、TS、MPG格式的视频文件，当前文件类型：' + file.mimetype));
            }
        } else if (file.fieldname === 'image') {
            // 图片文件验证
            const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
            if (allowedImageTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('只支持JPG、JPEG、PNG格式的图片文件'));
            }
        } else {
            cb(new Error('不支持的文件字段'));
        }
    }
});

/**
 * 验证图片分辨率
 * @param {Buffer} imageBuffer - 图片Buffer
 * @returns {Object} { valid: boolean, width: number, height: number, message: string }
 */
function validateImageResolution(imageBuffer) {
    try {
        const dimensions = imageSize(imageBuffer);
        const { width, height } = dimensions;
        
        // 阿里云限制：≥128x128 且 ≤4000x4000
        if (width < 128 || height < 128) {
            return {
                valid: false,
                width,
                height,
                message: `图片分辨率过小：${width}x${height}，最小支持128x128像素`
            };
        }
        
        if (width > 4000 || height > 4000) {
            return {
                valid: false,
                width,
                height,
                message: `图片分辨率过大：${width}x${height}，最大支持4000x4000像素`
            };
        }
        
        return {
            valid: true,
            width,
            height,
            message: '图片分辨率验证通过'
        };
    } catch (error) {
        console.error('验证图片分辨率失败:', error);
        return {
            valid: false,
            width: 0,
            height: 0,
            message: '无法读取图片分辨率信息'
        };
    }
}

/**
 * 验证视频分辨率（使用ffprobe，如果可用）
 * @param {Buffer} videoBuffer - 视频Buffer
 * @param {string} filename - 文件名
 * @returns {Promise<Object>} { valid: boolean, width: number, height: number, message: string }
 */
async function validateVideoResolution(videoBuffer, filename) {
    // 如果系统安装了ffprobe，使用它来获取视频信息
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
        // 将视频Buffer写入临时文件
        const tempDir = require('os').tmpdir();
        const tempFilePath = path.join(tempDir, `temp_video_${Date.now()}_${filename}`);
        fs.writeFileSync(tempFilePath, videoBuffer);
        
        try {
            // 使用ffprobe获取视频信息
            const { stdout } = await execAsync(
                `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of json "${tempFilePath}"`
            );
            
            const videoInfo = JSON.parse(stdout);
            const stream = videoInfo.streams && videoInfo.streams[0];
            
            if (stream) {
                const width = stream.width;
                const height = stream.height;
                
                // 清理临时文件
                fs.unlinkSync(tempFilePath);
                
                // 阿里云限制：>360x360 且 <1920x1920
                if (width <= 360 || height <= 360) {
                    return {
                        valid: false,
                        width,
                        height,
                        message: `视频分辨率过小：${width}x${height}，必须大于360x360像素`
                    };
                }
                
                if (width >= 1920 || height >= 1920) {
                    return {
                        valid: false,
                        width,
                        height,
                        message: `视频分辨率过大：${width}x${height}，必须小于1920x1920像素`
                    };
                }
                
                return {
                    valid: true,
                    width,
                    height,
                    message: '视频分辨率验证通过'
                };
            }
        } catch (ffprobeError) {
            // ffprobe不可用或执行失败，跳过分辨率验证（但记录警告）
            console.warn('⚠️ ffprobe不可用，跳过视频分辨率验证:', ffprobeError.message);
        } finally {
            // 确保清理临时文件
            if (fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (e) {
                    console.error('清理临时文件失败:', e);
                }
            }
        }
    } catch (error) {
        console.error('验证视频分辨率失败:', error);
    }
    
    // 如果无法验证，返回验证通过（但记录警告）
    // 实际验证会在前端进行，这里只做后端补充验证
    console.warn('⚠️ 无法验证视频分辨率，依赖前端验证');
    return {
        valid: true,
        width: 0,
        height: 0,
        message: '后端无法验证视频分辨率，依赖前端验证'
    };
}

/**
 * 检查URL是否包含中文字符
 * @param {string} url - URL地址
 * @returns {boolean} 如果包含中文字符返回true
 */
function containsChinese(url) {
    return /[\u4e00-\u9fa5]/.test(url);
}

/**
 * 创建阿里云视频增强客户端
 */
function createVideoEnhanceClient() {
    const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
    const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
    
    if (!accessKeyId || !accessKeySecret) {
        throw new Error('缺少阿里云API密钥配置');
    }
    
    let config = new OpenApi.Config({
        accessKeyId: accessKeyId,
        accessKeySecret: accessKeySecret,
        connectTimeout: 60000,
        readTimeout: 60000,
    });
    
    // 使用视频增强服务的上海区域端点
    config.endpoint = 'videoenhan.cn-shanghai.aliyuncs.com';
    return new videoenhan20200320.default(config);
}

/**
 * 调用阿里云通用视频人脸融合API (MergeVideoFace)
 * 
 * 对应阿里云API参数：
 * - Action: MergeVideoFace (系统定义参数，固定值)
 * - VideoURL: 输入视频的URL地址，建议使用上海区域OSS链接
 * - ReferenceURL: 参考图片URL地址，用于指定要融合的人脸
 *   - 图片格式：JPEG、JPG、PNG
 *   - 图片分辨率：≥128x128 且 ≤4000x4000 像素
 *   - 图片大小：≤20MB
 *   - URL地址：不能包含中文字符
 * - AddWatermark: 是否添加水印，固定为False（视频换脸功能不添加水印）
 * - Enhance: 是否启用人脸美化增强，默认False
 * 
 * @param {string} videoUrl - 视频URL（对应阿里云VideoURL参数）
 * @param {string} referenceUrl - 人脸参考图片URL（对应阿里云ReferenceURL参数）
 * @param {boolean} enhance - 是否启用人脸美化增强（对应阿里云Enhance参数，默认false）
 * @returns {Promise<Object>} { success: boolean, jobId: string, message: string }
 */
async function callAliyunMergeVideoFace(videoUrl, referenceUrl, enhance = false) {
    try {
        console.log('🎬 开始调用阿里云通用视频人脸融合API');
        console.log('📹 视频URL:', videoUrl);
        console.log('🖼️ 参考图片URL:', referenceUrl);
        console.log('⚙️ 参数:', { enhance });
        
        // 检查URL是否包含中文字符
        if (containsChinese(videoUrl)) {
            throw new Error('视频URL不能包含中文字符');
        }
        if (containsChinese(referenceUrl)) {
            throw new Error('图片URL不能包含中文字符');
        }
        
        const client = createVideoEnhanceClient();
        
        // 创建请求对象（视频换脸功能不添加水印）
        const mergeVideoFaceRequest = new videoenhan20200320.MergeVideoFaceRequest({
            videoURL: videoUrl,
            referenceURL: referenceUrl,
            addWatermark: false, // 视频换脸功能不添加水印
            enhance: enhance
        });
        
        // 设置运行时选项
        const runtime = new Util.RuntimeOptions({
            connectTimeout: 30000,
            readTimeout: 30000,
            timeout: 30000
        });
        
        // 调用API
        const response = await client.mergeVideoFaceWithOptions(mergeVideoFaceRequest, runtime);
        
        console.log('✅ 阿里云API响应:', JSON.stringify(response.body, null, 2));
        
        if (response && response.body) {
            // 阿里云返回的RequestId就是JobId，用于后续查询结果
            const requestId = response.body.requestId || response.body.RequestId;
            
            if (!requestId) {
                return {
                    success: false,
                    message: 'API返回数据格式错误，缺少RequestId'
                };
            }
            
            return {
                success: true,
                jobId: requestId,
                message: response.body.message || '任务已提交成功'
            };
        } else {
            return {
                success: false,
                message: 'API响应格式错误'
            };
        }
        
    } catch (error) {
        console.error('❌ 调用阿里云通用视频人脸融合API失败:', error);
        
        if (error.code) {
            console.error('错误代码:', error.code);
        }
        if (error.message) {
            console.error('错误消息:', error.message);
        }
        if (error.data) {
            console.error('错误数据:', error.data);
        }
        
        return {
            success: false,
            message: error.message || '调用阿里云API失败',
            error: error.code || 'UNKNOWN_ERROR'
        };
    }
}

/**
 * 查询阿里云任务状态（GetAsyncJobResult接口）
 * 
 * 对应阿里云API：
 * - 接口：GetAsyncJobResult
 * - 功能：根据任务ID查询任务执行状态和结果
 * - 说明：如果任务还在处理中，可稍等一段时间后再进行查询
 * 
 * @param {string} jobId - 任务ID（阿里云返回的RequestId）
 * @returns {Promise<Object>} { success: boolean, data: { Status, Message, VideoUrl, Progress } }
 */
async function queryAliyunTaskStatus(jobId) {
    try {
        console.log(`查询阿里云任务状态: jobId=${jobId}`);
        
        const client = createVideoEnhanceClient();
        
        // 创建查询请求
        const getAsyncJobResultRequest = new videoenhan20200320.GetAsyncJobResultRequest({
            jobId: jobId
        });
        
        // 设置运行时选项
        const runtime = new Util.RuntimeOptions({
            connectTimeout: 30000,
            readTimeout: 30000,
            timeout: 30000
        });
        
        // 调用查询API
        const response = await client.getAsyncJobResultWithOptions(getAsyncJobResultRequest, runtime);
        
        console.log(`阿里云任务状态查询响应: ${JSON.stringify(response.body, null, 2)}`);
        
        if (response && response.body) {
            const responseData = response.body.data || response.body.Data;
            const status = responseData?.Status || responseData?.status || 'Processing';
            
            // 解析result字段中的JSON数据
            let videoUrl = null;
            let progress = 0;
            
            if ((responseData?.result || responseData?.Result) && (status === 'PROCESS_SUCCESS' || status === 'SUCCEEDED')) {
                try {
                    const resultString = responseData.result || responseData.Result;
                    let resultData;
                    
                    if (typeof resultString === 'string') {
                        resultData = JSON.parse(resultString);
                    } else {
                        resultData = resultString;
                    }
                    
                    // 获取视频URL
                    videoUrl = resultData.VideoURL || resultData.VideoUrl || resultData.videoUrl || resultData.video_url || resultData.url || null;
                    progress = 100; // 成功完成时进度为100%
                    
                    console.log('成功解析视频URL:', videoUrl);
                } catch (parseError) {
                    console.error('解析阿里云API result字段失败:', parseError);
                    console.log('原始result数据:', responseData.result || responseData.Result);
                }
            } else if (status === 'PROCESS_FAILED' || status === 'FAILED') {
                progress = 0;
            } else if (status === 'PROCESS_RUNNING' || status === 'RUNNING') {
                progress = 50;
            }
            
            return {
                success: true,
                data: {
                    Status: status,
                    Message: response.body.message || response.body.Message || (status === 'PROCESS_SUCCESS' || status === 'SUCCEEDED' ? '任务处理完成' : '任务处理中'),
                    VideoUrl: videoUrl,
                    Progress: progress,
                    _rawData: responseData
                }
            };
        } else {
            return {
                success: false,
                message: '查询响应格式不正确'
            };
        }
        
    } catch (error) {
        console.error('查询视频人脸融合任务状态失败:', error);
        
        // 如果是任务不存在或其他API错误，返回处理中状态
        if (error.code === 'InvalidParameter.JobNotExist' || error.message?.includes('not exist')) {
            return {
                success: true,
                data: {
                    Status: 'Processing',
                    Message: '任务处理中，请稍后查询',
                    VideoUrl: null,
                    Progress: 20
                }
            };
        }
        
        return {
            success: false,
            message: error.message || '查询任务状态失败',
            error: error
        };
    }
}

/**
 * 保存任务信息到OSS
 */
async function saveTaskToOSS(userId, taskData) {
    try {
        // 使用统一的OSS客户端获取方法
        const ossClient = getOSSClient();
        if (!ossClient) {
            console.error('❌ 保存任务信息到OSS失败: OSS客户端未初始化');
            return false;
        }
        
        const ossKey = `video-face-fusion/${userId}/${taskData.taskId}.json`;
        await ossClient.put(ossKey, Buffer.from(JSON.stringify(taskData, null, 2)));
        
        console.log('✅ 任务信息已保存到OSS:', ossKey);
        return true;
    } catch (error) {
        console.error('❌ 保存任务信息到OSS失败:', error);
        return false;
    }
}

/**
 * 从OSS读取任务信息
 */
async function getTaskFromOSS(userId, taskId) {
    try {
        // 使用统一的OSS客户端获取方法
        const ossClient = getOSSClient();
        if (!ossClient) {
            console.error('❌ 从OSS读取任务信息失败: OSS客户端未初始化');
            return null;
        }
        
        const ossKey = `video-face-fusion/${userId}/${taskId}.json`;
        const result = await ossClient.get(ossKey);
        const taskData = JSON.parse(result.content.toString());
        
        return taskData;
    } catch (error) {
        console.error('❌ 从OSS读取任务信息失败:', error);
        return null;
    }
}

/**
 * @route   POST /api/video-face-fusion/create
 * @desc    创建视频人脸融合任务（基于阿里云MergeVideoFace接口）
 * @access  私有
 * 
 * 请求参数（FormData格式）：
 * - video: File - 视频文件（必选）
 *   - 支持格式：MP4、AVI、MKV、MOV、FLV、TS、MPG
 *   - 文件大小：≤120MB
 *   - 分辨率：>360x360 且 <1920x1920 像素
 *   - 时长：≤300秒
 *   - 仅支持恒定帧率视频
 * - image: File - 人脸参考图片（必选）
 *   - 支持格式：JPEG、JPG、PNG
 *   - 文件大小：≤20MB
 *   - 分辨率：≥128x128 且 ≤4000x4000 像素
 * - enhance: String - 是否启用人脸美化增强（可选，默认"false"）
 *   - 对应阿里云Enhance参数（Boolean类型）
 * - videoDuration: Number - 视频时长（秒，必选，用于计费计算）
 * 
 * 注意：视频换脸功能不添加水印，addWatermark参数已移除
 */
router.post('/create', protect, 
    memoryUpload.fields([
        { name: 'video', maxCount: 1 },
        { name: 'image', maxCount: 1 }
    ]),
    createUnifiedFeatureMiddleware('VIDEO_FACE_FUSION'), 
    async (req, res) => {
    try {
        const userId = req.user.id;
        const { taskId, usageType, creditCost, isFree } = req.featureUsage || {};
        
        console.log('收到视频人脸融合请求:', {
            userId,
            taskId,
            usageType,
            creditCost,
            isFree,
            files: req.files
        });
        
        // 验证文件上传
        if (!req.files || !req.files.video || !req.files.image) {
            return res.status(400).json({
                success: false,
                message: '请同时上传视频文件和人脸图片'
            });
        }
        
        const videoFile = req.files.video[0];
        const imageFile = req.files.image[0];
        
        // 验证文件大小
        if (videoFile.size > 120 * 1024 * 1024) { // 120MB
            return res.status(400).json({
                success: false,
                message: '视频文件大小不能超过120MB'
            });
        }
        
        if (imageFile.size > 20 * 1024 * 1024) { // 20MB
            return res.status(400).json({
                success: false,
                message: '图片文件大小不能超过20MB'
            });
        }
        
        // 验证图片分辨率
        const imageValidation = validateImageResolution(imageFile.buffer);
        if (!imageValidation.valid) {
            return res.status(400).json({
                success: false,
                message: imageValidation.message
            });
        }
        console.log(`✅ 图片分辨率验证通过: ${imageValidation.width}x${imageValidation.height}`);
        
        // 验证视频分辨率（如果ffprobe可用）
        const videoValidation = await validateVideoResolution(videoFile.buffer, videoFile.originalname);
        if (!videoValidation.valid) {
            return res.status(400).json({
                success: false,
                message: videoValidation.message
            });
        }
        if (videoValidation.width > 0 && videoValidation.height > 0) {
            console.log(`✅ 视频分辨率验证通过: ${videoValidation.width}x${videoValidation.height}`);
        }
        
        // 验证视频时长（从请求参数中获取，前端已验证）
        const videoDuration = parseFloat(req.body.videoDuration) || 0;
        if (videoDuration > 300) {
            return res.status(400).json({
                success: false,
                message: '视频时长不能超过300秒'
            });
        }
        
        // 上传文件到OSS（确保文件名不包含中文字符）
        console.log('开始上传文件到OSS...');
        
        // 生成安全的文件名（不包含中文字符）
        const videoExt = path.extname(videoFile.originalname);
        const imageExt = path.extname(imageFile.originalname);
        const safeVideoName = `video_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${videoExt}`;
        const safeImageName = `image_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${imageExt}`;
        
        // 创建临时文件对象（使用安全文件名）
        const safeVideoFile = {
            ...videoFile,
            originalname: safeVideoName
        };
        const safeImageFile = {
            ...imageFile,
            originalname: safeImageName
        };
        
        const videoUrl = await uploadVideoToOSS(safeVideoFile);
        const imageUrl = await uploadImageToOSS(safeImageFile);
        
        console.log('文件上传完成:', { videoUrl, imageUrl });
        
        // 再次检查URL是否包含中文字符（虽然已经处理了文件名，但以防万一）
        if (containsChinese(videoUrl) || containsChinese(imageUrl)) {
            return res.status(500).json({
                success: false,
                message: '文件上传后URL包含中文字符，请重试'
            });
        }
        
        // 获取参数（对应阿里云MergeVideoFace接口参数）
        // FormData会将布尔值转换为字符串，需要转换回布尔值
        const enhance = req.body.enhance === 'true'; // 对应阿里云Enhance参数，默认false
        
        // 调用阿里云通用视频人脸融合API（视频换脸功能不添加水印）
        const apiResponse = await callAliyunMergeVideoFace(
            videoUrl,
            imageUrl,
            enhance
        );
        
        if (!apiResponse.success) {
            return res.status(500).json({
                success: false,
                message: apiResponse.message || '视频人脸融合任务创建失败'
            });
        }
        
        // 保存任务信息到OSS
        const taskData = {
            taskId,
            aliyunJobId: apiResponse.jobId,
            status: 'processing',
            videoUrl: videoUrl,
            imageUrl: imageUrl,
            videoResolution: videoValidation.width > 0 ? `${videoValidation.width}x${videoValidation.height}` : 'unknown',
            imageResolution: `${imageValidation.width}x${imageValidation.height}`,
            videoDuration: videoDuration,
            addWatermark: false, // 视频换脸功能不添加水印
            enhance: enhance,
            createdAt: new Date().toISOString(),
            userId: userId,
            creditCost: creditCost,
            isFree: isFree
        };
        
        await saveTaskToOSS(userId, taskData);
        
        // 返回任务信息（完全参照阿里云MergeVideoFace接口返回格式）
        // 根据阿里云官方文档：创建任务时只返回RequestId和Message，不包含Data字段
        // 同时保留原有字段以保持向后兼容
        const responseMessage = '该调用为异步调用，任务已提交成功，请以 requestId 的值作为jobId 参数调用同类目下 GetAsyncJobResult 接口查询任务执行状态和结果。';
        
        res.json({
            // 阿里云标准格式（创建任务时只返回RequestId和Message，不包含Data字段）
            RequestId: taskId, // 使用萤火AI的taskId作为RequestId
            Message: responseMessage,
            
            // 保持向后兼容的字段
            success: true,
            taskId: taskId,
            message: responseMessage,
            aliyunJobId: apiResponse.jobId
        });
        
    } catch (error) {
        console.error('创建视频人脸融合任务失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '创建任务失败'
        });
    }
});

/**
 * @route   GET /api/video-face-fusion/status/:taskId
 * @desc    查询任务状态
 * @access  私有
 */
router.get('/status/:taskId', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const { taskId } = req.params;
        
        // 从OSS读取任务信息
        const taskData = await getTaskFromOSS(userId, taskId);
        
        if (!taskData) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 如果任务已完成，直接返回（参照阿里云GetAsyncJobResult接口返回格式）
        if (taskData.status === 'completed' && taskData.resultUrl) {
            // 根据阿里云标准，Data.Result应该是JSON字符串格式
            const resultData = {
                VideoURL: taskData.resultUrl // 注意：阿里云使用VideoURL（大写）
            };
            
            return res.json({
                // 阿里云标准格式（Data.Result为JSON字符串）
                RequestId: taskId,
                Data: {
                    Status: 'PROCESS_SUCCESS',
                    JobId: taskData.aliyunJobId, // 根据阿里云标准，Data中包含JobId字段
                    Result: JSON.stringify(resultData) // 根据阿里云标准，Result为JSON字符串
                },
                Message: '任务处理完成',
                
                // 保持向后兼容的字段
                success: true,
                taskId: taskId,
                status: 'completed',
                videoUrl: taskData.resultUrl,
                progress: 100,
                message: '任务处理完成'
            });
        }
        
        // 查询阿里云任务状态
        const statusResponse = await queryAliyunTaskStatus(taskData.aliyunJobId);
        
        if (!statusResponse.success) {
            return res.status(500).json({
                success: false,
                message: statusResponse.message || '查询任务状态失败'
            });
        }
        
        const { Status, VideoUrl, Progress } = statusResponse.data;
        
        // 如果任务完成，保存结果并更新任务状态
        if (Status === 'PROCESS_SUCCESS' || Status === 'SUCCEEDED') {
            if (VideoUrl) {
                // 上传结果视频到OSS
                try {
                    const resultUrl = await uploadVideoFaceSwapResultToOSS(VideoUrl, userId, taskId);
                    
                    // 更新任务数据
                    taskData.status = 'completed';
                    taskData.resultUrl = resultUrl;
                    taskData.completedAt = new Date().toISOString();
                    await saveTaskToOSS(userId, taskData);
                    
                    // 调用统一功能使用记录系统保存任务详情
                    const { saveTaskDetails } = require('../middleware/unifiedFeatureUsage');
                    const { FeatureUsage } = require('../models/FeatureUsage');
                    
                    const featureUsage = await FeatureUsage.findOne({
                        where: { userId, featureName: 'VIDEO_FACE_FUSION' }
                    });
                    
                    if (featureUsage) {
                        await saveTaskDetails(featureUsage, {
                            taskId: taskId,
                            status: 'completed',
                            featureName: 'VIDEO_FACE_FUSION',
                            creditCost: taskData.isFree ? 0 : taskData.creditCost,
                            isFree: taskData.isFree,
                            extraData: {
                                videoUrl: resultUrl,
                                aliyunJobId: taskData.aliyunJobId,
                                videoDuration: taskData.videoDuration
                            }
                        });
                    }
                    
                    // 返回结果（参照阿里云GetAsyncJobResult接口返回格式）
                    // 根据阿里云标准，Data.Result应该是JSON字符串格式
                    const resultData = {
                        VideoURL: resultUrl // 注意：阿里云使用VideoURL（大写）
                    };
                    
                    return res.json({
                        // 阿里云标准格式（Data.Result为JSON字符串）
                        RequestId: taskId,
                        Data: {
                            Status: 'PROCESS_SUCCESS',
                            JobId: taskData.aliyunJobId, // 根据阿里云标准，Data中包含JobId字段
                            Result: JSON.stringify(resultData) // 根据阿里云标准，Result为JSON字符串
                        },
                        Message: '任务处理完成',
                        
                        // 保持向后兼容的字段
                        success: true,
                        taskId: taskId,
                        status: 'completed',
                        videoUrl: resultUrl,
                        progress: 100,
                        message: '任务处理完成'
                    });
                } catch (uploadError) {
                    console.error('上传结果视频失败:', uploadError);
                    // 即使上传失败，也返回阿里云的URL（参照阿里云GetAsyncJobResult接口返回格式）
                    // 根据阿里云标准，Data.Result应该是JSON字符串格式
                    const resultData = {
                        VideoURL: VideoUrl // 注意：阿里云使用VideoURL（大写），这里是临时URL
                    };
                    
                    return res.json({
                        // 阿里云标准格式（Data.Result为JSON字符串）
                        RequestId: taskId,
                        Data: {
                            Status: 'PROCESS_SUCCESS',
                            JobId: taskData.aliyunJobId, // 根据阿里云标准，Data中包含JobId字段
                            Result: JSON.stringify(resultData) // 根据阿里云标准，Result为JSON字符串
                        },
                        Message: '任务处理完成（注意：返回的是临时URL，有效期30分钟）',
                        
                        // 保持向后兼容的字段
                        success: true,
                        taskId: taskId,
                        status: 'completed',
                        videoUrl: VideoUrl,
                        progress: 100,
                        message: '任务处理完成（注意：返回的是临时URL，有效期30分钟）',
                        warning: '结果视频上传到OSS失败，返回临时URL'
                    });
                }
            }
        }
        
        // 返回当前状态（参照阿里云GetAsyncJobResult接口返回格式）
        const currentStatus = Status === 'PROCESS_RUNNING' || Status === 'RUNNING' ? 'PROCESS_RUNNING' : 
                              Status === 'PROCESS_FAILED' || Status === 'FAILED' ? 'PROCESS_FAILED' : 
                              Status === 'PROCESS_SUCCESS' || Status === 'SUCCEEDED' ? 'PROCESS_SUCCESS' : 'PROCESS_RUNNING';
        
        // 根据阿里云标准，Data.Result应该是JSON字符串格式（任务完成时）或null（处理中/失败时）
        let resultString = null;
        if (currentStatus === 'PROCESS_SUCCESS' && VideoUrl) {
            const resultData = {
                VideoURL: VideoUrl // 注意：阿里云使用VideoURL（大写）
            };
            resultString = JSON.stringify(resultData);
        }
        
        // 构建Data对象（根据阿里云标准）
        const dataObject = {
            Status: currentStatus,
            JobId: taskData.aliyunJobId // 根据阿里云标准，Data中包含JobId字段
        };
        
        // 只有在有Result数据时才添加Result字段（根据阿里云标准）
        if (resultString) {
            dataObject.Result = resultString;
        }
        
        res.json({
            // 阿里云标准格式（Data.Result为JSON字符串，仅在任务完成时包含）
            RequestId: taskId,
            Data: dataObject,
            Message: statusResponse.data.Message || '任务处理中',
            
            // 保持向后兼容的字段
            success: true,
            taskId: taskId,
            status: Status === 'PROCESS_RUNNING' || Status === 'RUNNING' ? 'processing' : 
                   Status === 'PROCESS_FAILED' || Status === 'FAILED' ? 'failed' : 'processing',
            videoUrl: VideoUrl || null,
            progress: Progress,
            message: statusResponse.data.Message || '任务处理中'
        });
        
    } catch (error) {
        console.error('查询任务状态失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '查询任务状态失败'
        });
    }
});

/**
 * @route   GET /api/video-face-fusion/tasks
 * @desc    获取用户的任务列表（仅显示24小时内的最新一条记录）
 * @access  私有
 */
router.get('/tasks', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 使用统一的OSS客户端获取方法
        const ossClient = getOSSClient();
        if (!ossClient) {
            console.error('获取任务列表失败: OSS客户端未初始化');
            return res.status(500).json({
                success: false,
                message: 'OSS配置错误，无法获取任务列表。请检查OSS环境变量配置。'
            });
        }
        
        const prefix = `video-face-fusion/${userId}/`;
        const result = await ossClient.list({
            prefix: prefix,
            'max-keys': 1000
        });
        
        const tasks = [];
        for (const obj of result.objects || []) {
            if (obj.name.endsWith('.json')) {
                try {
                    const fileResult = await ossClient.get(obj.name);
                    const taskData = JSON.parse(fileResult.content.toString());
                    tasks.push(taskData);
                } catch (error) {
                    console.error(`读取任务文件失败: ${obj.name}`, error);
                }
            }
        }
        
        // 过滤24小时内的任务
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const recentTasks = tasks.filter(task => {
            if (!task.createdAt) return false;
            const taskDate = new Date(task.createdAt);
            return taskDate >= twentyFourHoursAgo;
        }).sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        // 只返回最新的1条记录
        const displayTasks = recentTasks.slice(0, 1);
        
        console.log(`过滤后的视频换脸任务数量: ${displayTasks.length}`);
        
        res.json({
            success: true,
            tasks: displayTasks,
            total: displayTasks.length,
            page: 1,
            limit: 1
        });
        
    } catch (error) {
        console.error('获取任务列表失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '获取任务列表失败'
        });
    }
});

/**
 * @route   DELETE /api/video-face-fusion/tasks/:taskId
 * @desc    删除任务
 * @access  私有
 */
router.delete('/tasks/:taskId', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const { taskId } = req.params;
        
        // 使用统一的OSS客户端获取方法
        const ossClient = getOSSClient();
        if (!ossClient) {
            console.error('删除任务失败: OSS客户端未初始化');
            return res.status(500).json({
                success: false,
                message: 'OSS配置错误，无法删除任务。请检查OSS环境变量配置。'
            });
        }
        
        const ossKey = `video-face-fusion/${userId}/${taskId}.json`;
        
        try {
            await ossClient.delete(ossKey);
            res.json({
                success: true,
                message: '任务已删除'
            });
        } catch (error) {
            if (error.code === 'NoSuchKey') {
                res.status(404).json({
                    success: false,
                    message: '任务不存在'
                });
            } else {
                throw error;
            }
        }
        
    } catch (error) {
        console.error('删除任务失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '删除任务失败'
        });
    }
});

/**
 * @route   POST /api/video-face-fusion/clear-all-tasks
 * @desc    清空当前用户的所有视频换脸任务记录
 * @access  私有
 */
router.post('/clear-all-tasks', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`🗑️ [视频换脸] 用户 ${userId} 请求清空所有任务记录`);
        
        // 使用统一的OSS客户端获取方法
        const ossClient = getOSSClient();
        if (!ossClient) {
            console.error('清空任务失败: OSS客户端未初始化');
            return res.status(500).json({
                success: false,
                message: 'OSS配置错误，无法清空任务。请检查OSS环境变量配置。'
            });
        }
        
        const prefix = `video-face-fusion/${userId}/`;
        const result = await ossClient.list({
            prefix: prefix,
            'max-keys': 1000
        });
        
        let deletedCount = 0;
        const deletePromises = [];
        
        for (const obj of result.objects || []) {
            if (obj.name.endsWith('.json')) {
                deletePromises.push(
                    ossClient.delete(obj.name).then(() => {
                        deletedCount++;
                    }).catch(error => {
                        console.error(`删除任务文件失败: ${obj.name}`, error);
                    })
                );
            }
        }
        
        await Promise.all(deletePromises);
        
        console.log(`✅ [视频换脸] 已为用户 ${userId} 清空 ${deletedCount} 条任务记录`);
        
        return res.json({
            success: true,
            message: '所有任务记录已清空',
            deleted: deletedCount
        });
    } catch (error) {
        console.error('❌ 清空视频换脸任务记录失败:', error);
        return res.status(500).json({
            success: false,
            error: '清空任务记录失败',
            message: error.message || '清空任务记录失败'
        });
    }
});

module.exports = router;

