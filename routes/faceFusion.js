/**
 * 阿里云图像人脸融合API路由
 * 实现图片换脸功能
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkFeatureAccess, FEATURES } = require('../middleware/featureAccess');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { uploadImageToOSS, getOSSClient } = require('../utils/ossUtils');
const axios = require('axios');
const FacebodyClient = require('@alicloud/facebody20191230');
const OpenapiClient = require('@alicloud/openapi-client');
const TeaUtil = require('@alicloud/tea-util');
const http = require('http');
const https = require('https');
const { saveFaceFusionHistoryOSS } = require('../services/faceFusionHistoryOSS');
const logger = require('../utils/logger');

// 配置multer用于文件上传
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 30 * 1024 * 1024 // 30MB限制，符合最新阿里云要求
    },
    fileFilter: (req, file, cb) => {
        // 只允许JPG、JPEG、PNG、BMP格式
        const allowedMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/bmp',
            'image/x-ms-bmp'
        ];
        if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传JPG、JPEG、PNG、BMP格式的图片文件'), false);
        }
    }
});

// 阿里云人脸融合API配置
const ALIYUN_FACE_FUSION_CONFIG = {
    endpoint: 'facebody.cn-shanghai.aliyuncs.com',
    region: process.env.ALIYUN_REGION || 'cn-shanghai'
};

const sizeOf = require('image-size');

/**
 * 初始化阿里云Facebody客户端
 */
function getFacebodyClient() {
    const config = new OpenapiClient.Config({
        accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID,
        accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET
    });
    
    // 访问的域名
    config.endpoint = ALIYUN_FACE_FUSION_CONFIG.endpoint;
    
    return new FacebodyClient.default(config);
}

/**
 * 从URL获取响应流（用于SDK的Advance方法）
 */
function getResponseFromUrl(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const httpClient = (urlObj.protocol === 'https:') ? https : http;
        
        httpClient.get(url, (response) => {
            if (response.statusCode === 200) {
                resolve(response);
            } else {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            }
        }).on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * 将图片转换为Base64格式
 */
function imageToBase64(buffer) {
    return buffer.toString('base64');
}

/**
 * 验证图片分辨率是否符合阿里云要求
 * 要求：大于等于32×32像素，小于等于8192×8192像素，最长边小于等于8192像素
 */
function validateImageDimensions(buffer) {
    try {
        // 验证 buffer 是否存在且有效
        if (!buffer || !Buffer.isBuffer(buffer)) {
            logger.error('图片buffer无效', {
                bufferType: typeof buffer,
                isBuffer: Buffer.isBuffer(buffer)
            });
            return {
                valid: false,
                error: '图片数据无效，请重新上传图片'
            };
        }

        // 验证 buffer 大小
        if (buffer.length === 0) {
            logger.error('图片buffer为空');
            return {
                valid: false,
                error: '图片文件为空，请重新上传图片'
            };
        }

        // 验证是否为有效的图片格式（检查文件头）
        // 注意：阿里云支持 JPG、JPEG、PNG、BMP 格式，不支持 GIF
        const isJPEG = buffer.length >= 3 && 
            buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
        const isPNG = buffer.length >= 8 && 
            buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
            buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A;
        const isBMP = buffer.length >= 2 &&
            buffer[0] === 0x42 && buffer[1] === 0x4D; // "BM"

        if (!isJPEG && !isPNG && !isBMP) {
            // 记录文件头信息用于调试
            logger.warn('图片格式可能不支持（仅支持JPG、JPEG、PNG、BMP）', {
                fileHeader: buffer.slice(0, 8).toString('hex'),
                bufferLength: buffer.length
            });
            // 不直接返回错误，让 image-size 库尝试解析，它可能支持更多格式
            // 但如果 image-size 也无法解析，会在后续步骤中返回错误
        }

        // 使用 image-size 读取图片尺寸
        const dimensions = sizeOf(buffer);
        
        if (!dimensions || !dimensions.width || !dimensions.height) {
            logger.error('无法从图片中读取尺寸信息', {
                dimensions: dimensions
            });
            return {
                valid: false,
                error: '无法读取图片尺寸信息，请确保图片格式正确（支持JPG、JPEG、PNG、BMP格式）'
            };
        }

        const { width, height } = dimensions;
        
        logger.info('图片尺寸验证', {
            width,
            height,
            bufferSize: buffer.length
        });
        
        // 检查最小尺寸
        if (width < 32 || height < 32) {
            return {
                valid: false,
                error: `图片分辨率过小，当前为${width}×${height}像素，最小要求为32×32像素`
            };
        }
        
        // 检查最大尺寸
        if (width > 8192 || height > 8192) {
            return {
                valid: false,
                error: `图片分辨率过大，当前为${width}×${height}像素，最大支持8192×8192像素`
            };
        }
        
        // 检查最长边
        const maxSide = Math.max(width, height);
        if (maxSide > 8192) {
            return {
                valid: false,
                error: `图片最长边不能超过8192像素，当前最长边为${maxSide}像素`
            };
        }
        
        return {
            valid: true,
            dimensions: { width, height }
        };
    } catch (error) {
        logger.error('读取图片尺寸时发生错误', {
            error: error.message,
            stack: error.stack,
            bufferLength: buffer ? buffer.length : 0
        });
        
        // 根据错误类型提供更具体的错误信息
        let errorMessage = '无法读取图片尺寸信息';
        if (error.message && error.message.includes('unsupported')) {
            errorMessage = '不支持的图片格式，请使用JPG、JPEG、PNG或BMP格式';
        } else if (error.message && error.message.includes('invalid')) {
            errorMessage = '图片文件已损坏，请重新上传';
        } else {
            errorMessage = `无法读取图片尺寸信息：${error.message || '未知错误'}`;
        }
        
        return {
            valid: false,
            error: errorMessage
        };
    }
}

/**
 * 调用阿里云AddFaceImageTemplate接口创建模板
 */
async function createFaceTemplate(imageUrl, context = {}) {
    try {
        const client = getFacebodyClient();
        if (!client) {
            logger.error('初始化阿里云Facebody客户端失败', {
                userId: context.userId,
                templateName: context.templateName
            });
            throw new Error('服务器未完成阿里云接口配置，请联系管理员');
        }

        const request = new FacebodyClient.AddFaceImageTemplateRequest({
            imageURL: imageUrl
        });
        const runtime = new TeaUtil.RuntimeOptions({});

        logger.info('调用阿里云AddFaceImageTemplate接口', {
            userId: context.userId,
            templateName: context.templateName,
            imageUrl
        });

        const response = await client.addFaceImageTemplateWithOptions(request, runtime);
        const body = response?.body;

        logger.info('AddFaceImageTemplate接口返回', {
            userId: context.userId,
            templateName: context.templateName,
            response: body
        });

        if (!body || !body.data || !body.data.templateId) {
            throw new Error('阿里云未返回有效的模板ID');
        }

        return body;
    } catch (error) {
        const aliErrorMessage = error?.data?.Message || error?.message || '阿里云接口调用失败';
        logger.error('创建人脸模板失败', {
            userId: context.userId,
            templateName: context.templateName,
            imageUrl,
            error: aliErrorMessage,
            details: error?.data || error
        });
        throw new Error(`模板创建失败：${aliErrorMessage}`);
    }
}

/**
 * 调用阿里云DetectFace接口检测人脸数量
 */
async function detectFaceCount(imageUrl, context = {}) {
    try {
        const client = getFacebodyClient();
        if (!client) {
            logger.error('初始化阿里云Facebody客户端失败（DetectFace）', {
                userId: context.userId,
                templateName: context.templateName,
                imageUrl
            });
            throw new Error('服务器未完成阿里云接口配置，请联系管理员');
        }

        const request = new FacebodyClient.DetectFaceRequest({
            imageURL: imageUrl,
            landmark: false,
            quality: false
        });
        const runtime = new TeaUtil.RuntimeOptions({});

        logger.info('调用阿里云DetectFace接口', {
            userId: context.userId,
            templateName: context.templateName,
            imageUrl
        });

        const response = await client.detectFaceWithOptions(request, runtime);
        const body = response?.body || {};
        const data = body.data || body.Data || {};

        let faceCount = data.faceCount;
        if (typeof faceCount !== 'number') {
            faceCount = data.FaceCount;
        }

        if (typeof faceCount !== 'number' && Array.isArray(data.faceRectangles)) {
            faceCount = Math.floor(data.faceRectangles.length / 4);
        }
        if (typeof faceCount !== 'number' && Array.isArray(data.FaceRectangles)) {
            faceCount = Math.floor(data.FaceRectangles.length / 4);
        }

        if (typeof faceCount !== 'number') {
            logger.warn('DetectFace接口未返回人脸数量，尝试使用默认值0', {
                userId: context.userId,
                templateName: context.templateName,
                imageUrl,
                data
            });
            faceCount = 0;
        }

        logger.info('DetectFace接口返回', {
            userId: context.userId,
            templateName: context.templateName,
            faceCount,
            requestId: body.requestId || body.RequestId
        });

        return {
            faceCount,
            rawData: data
        };
    } catch (error) {
        const aliErrorMessage = error?.data?.Message || error?.message || '阿里云人脸检测接口调用失败';
        logger.error('人脸数量检测失败', {
            userId: context.userId,
            templateName: context.templateName,
            imageUrl,
            error: aliErrorMessage,
            details: error?.data || error
        });
        throw new Error(`人脸数量检测失败：${aliErrorMessage}`);
    }
}

/**
 * 从人脸检测结果中提取人脸矩形信息
 */
function extractFaceRectangles(data) {
    const rectangles = [];
    if (!data) {
        return rectangles;
    }

    const pushRectangle = (rect) => {
        if (!rect) return;
        const left = Number.parseFloat(rect.left ?? rect.Left);
        const top = Number.parseFloat(rect.top ?? rect.Top);
        const width = Number.parseFloat(rect.width ?? rect.Width);
        const height = Number.parseFloat(rect.height ?? rect.Height);
        if ([left, top, width, height].every((value) => typeof value === 'number' && !Number.isNaN(value))) {
            rectangles.push({ left, top, width, height });
        }
    };

    const parseRectangleArray = (arr) => {
        if (!Array.isArray(arr) || arr.length === 0) {
            return;
        }
        if (typeof arr[0] === 'string') {
            arr.forEach((item) => {
                const parts = item.split(',').map((num) => Number.parseFloat(num));
                if (parts.length === 4 && parts.every((value) => !Number.isNaN(value))) {
                    rectangles.push({
                        left: parts[0],
                        top: parts[1],
                        width: parts[2],
                        height: parts[3]
                    });
                }
            });
        } else {
            for (let i = 0; i + 3 < arr.length; i += 4) {
                const left = Number.parseFloat(arr[i]);
                const top = Number.parseFloat(arr[i + 1]);
                const width = Number.parseFloat(arr[i + 2]);
                const height = Number.parseFloat(arr[i + 3]);
                if ([left, top, width, height].every((value) => !Number.isNaN(value))) {
                    rectangles.push({ left, top, width, height });
                }
            }
        }
    };

    parseRectangleArray(data.faceRectangles || data.FaceRectangles);

    const faceList = data.faceList || data.FaceList;
    if (Array.isArray(faceList)) {
        faceList.forEach((face) => {
            if (!face) return;
            const rect = face.faceRectangle || face.FaceRectangle;
            if (rect) {
                pushRectangle(rect);
            }
        });
    }

    return rectangles;
}

/**
 * 创建人脸模板API
 */
router.post('/create-template', protect, (req, res, next) => {
    // 使用 multer 中间件处理文件上传
    upload.single('templateImage')(req, res, (err) => {
        // 处理 multer 错误
        if (err) {
            logger.error('文件上传错误 - 创建模板', {
                userId: req.user?.id,
                error: err.message,
                code: err.code
            });
            
            // 根据错误类型返回相应的错误信息
            let errorMessage = '文件上传失败';
            if (err.code === 'LIMIT_FILE_SIZE') {
                errorMessage = '图片文件不能超过30MB';
            } else if (err.message && err.message.includes('格式')) {
                errorMessage = err.message;
            } else {
                errorMessage = err.message || '文件上传失败';
            }
            
            return res.status(400).json({
                success: false,
                error: errorMessage
            });
        }
        // 继续处理请求
        next();
    });
}, async (req, res) => {
    try {
        logger.info('收到创建模板请求', {
            userId: req.user.id,
            hasFile: !!req.file,
            templateName: req.body.templateName,
            contentType: req.headers['content-type']
        });

        let templateImageUrl;
        const templateName = req.body.templateName;

        // 验证模板名称
        if (!templateName || !templateName.trim()) {
            logger.warn('模板名称为空', { userId: req.user.id });
            return res.status(400).json({
                success: false,
                error: '模板名称不能为空'
            });
        }

        // 处理上传的文件
        if (req.file) {
            logger.info('处理上传的文件', {
                userId: req.user.id,
                fileName: req.file.originalname,
                fileSize: req.file.size,
                mimeType: req.file.mimetype
            });

            // 验证图片分辨率
            const dimensionCheck = validateImageDimensions(req.file.buffer);
            if (!dimensionCheck.valid) {
                logger.warn('图片分辨率验证失败', {
                    userId: req.user.id,
                    error: dimensionCheck.error
                });
                return res.status(400).json({
                    success: false,
                    error: dimensionCheck.error
                });
            }
            
            try {
                templateImageUrl = await uploadImageToOSS({
                    buffer: req.file.buffer,
                    originalname: req.file.originalname || `face-template-${Date.now()}.jpg`,
                    mimetype: req.file.mimetype || 'image/jpeg'
                });
                logger.info('模板图片已上传到OSS', {
                    userId: req.user.id,
                    templateName,
                    ossUrl: templateImageUrl
                });
            } catch (uploadError) {
                logger.error('模板图片上传OSS失败', {
                    userId: req.user.id,
                    error: uploadError.message
                });
                return res.status(500).json({
                    success: false,
                    error: uploadError.message || '模板图片上传失败'
                });
            }
        } 
        // 处理Base64数据
        else if (req.body.templateImageBase64) {
            logger.info('使用Base64数据', { userId: req.user.id });
            
            try {
                let base64String = req.body.templateImageBase64;
                let mimeType = 'image/jpeg';

                const dataUrlMatch = base64String.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
                if (dataUrlMatch) {
                    mimeType = dataUrlMatch[1];
                    base64String = base64String.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
                }

                const imageBuffer = Buffer.from(base64String, 'base64');

                const dimensionCheck = validateImageDimensions(imageBuffer);
                if (!dimensionCheck.valid) {
                    logger.warn('Base64图片分辨率验证失败', {
                        userId: req.user.id,
                        error: dimensionCheck.error
                    });
                    return res.status(400).json({
                        success: false,
                        error: dimensionCheck.error
                    });
                }

                // 阿里云支持 JPG、JPEG、PNG、BMP 格式
                const normalizedMime = (mimeType || 'image/jpeg').toLowerCase();
                let extension = '.jpg';
                let uploadMimeType = normalizedMime;
                if (normalizedMime === 'image/png') {
                    extension = '.png';
                } else if (normalizedMime === 'image/bmp' || normalizedMime === 'image/x-ms-bmp') {
                    extension = '.bmp';
                    uploadMimeType = 'image/bmp';
                } else if (normalizedMime !== 'image/jpeg' && normalizedMime !== 'image/jpg') {
                    uploadMimeType = 'image/jpeg';
                }

                templateImageUrl = await uploadImageToOSS({
                    buffer: imageBuffer,
                    originalname: `face-template-${Date.now()}${extension}`,
                    mimetype: uploadMimeType
                });

                logger.info('Base64模板图片已上传到OSS', {
                    userId: req.user.id,
                    templateName,
                    ossUrl: templateImageUrl
                });
            } catch (base64Error) {
                logger.error('处理Base64模板图片失败', {
                    userId: req.user.id,
                    error: base64Error.message
                });
                return res.status(400).json({
                    success: false,
                    error: base64Error.message || '模板图片数据无效'
                });
            }
        } 
        else {
            logger.warn('未提供模板图片', { userId: req.user.id });
            return res.status(400).json({
                success: false,
                error: '请提供模板图片，支持文件上传或Base64格式'
            });
        }

        if (!templateImageUrl) {
            logger.error('模板图片URL生成失败', { userId: req.user.id });
            return res.status(500).json({
                success: false,
                error: '模板图片上传失败，请稍后重试'
            });
        }

        // 检查API密钥（兼容新旧环境变量名）
        const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID;
        const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET;
        
        if (!accessKeyId || !accessKeySecret) {
            logger.error('阿里云AccessKey未配置', { userId: req.user.id });
            return res.status(500).json({
                success: false,
                error: '服务器未配置阿里云AccessKey，请联系管理员'
            });
        }

        // 人脸数量检测：阿里云建议单张图片人脸数量不超过5个
        let faceDetectionResult;
        try {
            faceDetectionResult = await detectFaceCount(templateImageUrl, {
                templateName,
                userId: req.user.id
            });
        } catch (faceDetectError) {
            logger.error('人脸数量检测发生错误', {
                userId: req.user.id,
                templateName,
                error: faceDetectError.message
            });
            return res.status(500).json({
                success: false,
                error: faceDetectError.message || '人脸数量检测失败，请稍后重试'
            });
        }

        const detectedFaceCount = faceDetectionResult?.faceCount ?? 0;
        if (detectedFaceCount <= 0) {
            logger.warn('未检测到人脸或检测结果无效', {
                userId: req.user.id,
                templateName,
                detectedFaceCount
            });
            return res.status(400).json({
                success: false,
                error: '未检测到有效人脸，请更换清晰的人脸图片后重试'
            });
        }

        if (detectedFaceCount > 5) {
            logger.warn('检测到过多的人脸', {
                userId: req.user.id,
                templateName,
                detectedFaceCount
            });
            return res.status(400).json({
                success: false,
                warning: true,
                error: `检测到 ${detectedFaceCount} 张人脸。阿里云建议单张图片人脸数量不超过 5 个，请更换包含较少人脸的图片后重试。`
            });
        }

        // 检查人脸区域尺寸是否符合要求（≥64×64像素）
        const faceRectangles = extractFaceRectangles(faceDetectionResult?.rawData);
        if (faceRectangles.length === 0) {
            logger.warn('未能从人脸检测结果中提取人脸区域信息', {
                userId: req.user.id,
                templateName,
                faceDetectionRawData: faceDetectionResult?.rawData
            });
        } else {
            const tooSmallFaces = faceRectangles.filter((rect) => rect.width < 64 || rect.height < 64);
            if (tooSmallFaces.length > 0) {
                const minWidth = Math.min(...tooSmallFaces.map((rect) => rect.width));
                const minHeight = Math.min(...tooSmallFaces.map((rect) => rect.height));
                logger.warn('检测到的人脸区域过小', {
                    userId: req.user.id,
                    templateName,
                    minWidth,
                    minHeight,
                    faceRectangles
                });
                return res.status(400).json({
                    success: false,
                    error: `检测到的人脸区域过小（最小约为 ${Math.floor(minWidth)}×${Math.floor(minHeight)} 像素）。请使用人脸区域不低于 64×64 像素的清晰图片。`
                });
            }
        }

        logger.info('开始创建人脸模板', {
            userId: req.user.id,
            templateName: templateName,
            imageUrl: templateImageUrl
        });

        // 调用阿里云AddFaceImageTemplate接口
        const result = await createFaceTemplate(templateImageUrl, {
            templateName,
            userId: req.user.id
        });

        if (result.data && result.data.templateId) {
            logger.info('模板创建成功', {
                userId: req.user.id,
                templateId: result.data.templateId,
                templateName: templateName
            });
            
            res.json({
                success: true,
                templateId: result.data.templateId,
                templateName: templateName || `template_${Date.now()}`,
                templateImageUrl,
                message: '模板创建成功'
            });
        } else {
            logger.error('模板创建失败：未返回TemplateId', {
                userId: req.user.id,
                result: result
            });
            throw new Error('模板创建失败：未返回TemplateId');
        }

    } catch (error) {
        logger.error('创建人脸模板API错误', {
            userId: req.user?.id,
            error: error.message,
            stack: error.stack
        });
        
        // 根据错误类型返回相应的状态码
        const statusCode = error.message && error.message.includes('400') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            error: error.message || '模板创建失败'
        });
    }
});

/**
 * 图片换脸API - 使用TemplateId进行人脸融合
 * 根据阿里云接入要求，必须先创建模板获得TemplateId
 */
/**
 * 将Base64图片上传到OSS并返回URL
 */
async function uploadBase64ImageToOSS(base64Data, filename = 'face-fusion.jpg') {
    try {
        // 将Base64数据转换为Buffer
        // 如果已经是纯Base64字符串，直接使用；如果包含data URI前缀，先去除
        let base64String = base64Data;
        if (base64Data.includes(',')) {
            base64String = base64Data.split(',')[1];
        } else if (base64Data.startsWith('data:')) {
            base64String = base64Data.replace(/^data:image\/\w+;base64,/, '');
        }
        
        const imageBuffer = Buffer.from(base64String, 'base64');
        
        // 创建临时文件对象
        const tempFile = {
            buffer: imageBuffer,
            originalname: filename,
            mimetype: 'image/jpeg'
        };
        
        // 上传到OSS
        const imageUrl = await uploadImageToOSS(tempFile);
        return imageUrl;
    } catch (error) {
        console.error('上传图片到OSS失败:', error);
        throw new Error('上传图片到OSS失败: ' + error.message);
    }
}

/**
 * 从临时URL下载图片并上传到OSS保存（阿里云返回的临时URL有效期30分钟）
 */
async function downloadAndSaveImageToOSS(tempImageUrl, userId, taskId) {
    try {
        const client = getOSSClient();
        if (!client) {
            console.error('保存图片到OSS失败: OSS客户端未初始化');
            throw new Error('OSS客户端未初始化，请检查OSS配置');
        }

        console.log(`开始下载临时图片并保存到OSS: ${tempImageUrl}`);
        
        // 下载图片
        const response = await axios({
            method: 'GET',
            url: tempImageUrl,
            responseType: 'arraybuffer',
            timeout: 60000 // 60秒超时
        });

        const imageBuffer = Buffer.from(response.data);
        const contentType = response.headers['content-type'] || 'image/jpeg';
        
        // 生成OSS路径
        const timestamp = Date.now();
        const ossPath = `face-fusion/${userId}/${taskId}_${timestamp}.jpg`;
        
        // 上传到OSS
        const putOptions = {
            headers: {
                'Content-Type': contentType
            }
        };
        
        const result = await client.put(ossPath, imageBuffer, putOptions);
        console.log(`图片已保存到OSS: ${result.url}`);
        
        return result.url; // 返回永久URL
    } catch (error) {
        console.error('下载并保存图片到OSS失败:', error);
        // 如果保存失败，返回原始临时URL（至少30分钟内可用）
        console.warn('使用原始临时URL:', tempImageUrl);
        return tempImageUrl;
    }
}

/**
 * 调用阿里云MergeImageFace接口进行人脸融合（使用官方SDK）
 */
async function performFaceFusion(templateId, userImageBase64, options = {}) {
    try {
        // 先将Base64图片上传到OSS获取URL
        console.log('正在上传用户图片到OSS...');
        const imageUrl = await uploadBase64ImageToOSS(userImageBase64, 'face-fusion-user.jpg');
        console.log('图片上传成功，OSS URL:', imageUrl);
        
        // 初始化SDK客户端
        const client = getFacebodyClient();
        
        // 创建请求对象（使用Advance方法支持URL）
        const mergeImageFaceRequest = new FacebodyClient.MergeImageFaceAdvanceRequest();
        mergeImageFaceRequest.templateId = templateId;
        
        // 从URL获取响应流
        const imageUrlStream = await getResponseFromUrl(imageUrl);
        mergeImageFaceRequest.imageURLObject = imageUrlStream;
        
        // 设置可选参数（按照API文档设置默认值）
        mergeImageFaceRequest.modelVersion = options.modelVersion || 'v1'; // 默认v1（脸型适配）
        mergeImageFaceRequest.addWatermark = options.addWatermark !== undefined ? options.addWatermark : false; // 默认false（不添加水印）
        mergeImageFaceRequest.watermarkType = options.watermarkType || 'EN'; // 默认EN（英文水印）
        
        console.log('调用MergeImageFace接口进行人脸融合（使用官方SDK）...');
        
        // 创建运行时选项
        const runtime = new TeaUtil.RuntimeOptions({});
        
        // 调用SDK方法
        const mergeImageFaceResponse = await client.mergeImageFaceAdvance(mergeImageFaceRequest, runtime);
        
        console.log('MergeImageFace接口响应:', JSON.stringify(mergeImageFaceResponse, null, 2));
        
        // 处理响应（SDK返回的数据结构）
        // 根据阿里云API文档，返回格式为：{"RequestId": "...", "Data": {"ImageURL": "..."}}
        // SDK可能会将字段名转换为驼峰命名，需要兼容处理
        if (mergeImageFaceResponse.body) {
            const body = mergeImageFaceResponse.body;
            const data = body.data || body.Data; // 兼容大小写
            const requestId = body.requestId || body.RequestId || mergeImageFaceResponse.headers['x-acs-request-id'];
            
            // 兼容处理ImageURL字段（可能是imageURL或ImageURL）
            const imageUrl = data?.imageURL || data?.ImageURL;
            
            if (imageUrl) {
                // 阿里云返回的ImageURL是临时地址，有效期30分钟
                // 需要下载并保存到自己的OSS，以便长期保存
                const tempImageUrl = imageUrl;
                
                console.log('获取到临时图片URL:', tempImageUrl);
                console.log('RequestId:', requestId);
                
                // 返回包含RequestId和临时URL的数据
                return {
                    ImageURL: tempImageUrl, // 临时URL（30分钟有效）
                    RequestId: requestId,   // 请求ID
                    tempImageUrl: tempImageUrl // 用于后续保存
                };
            } else {
                console.error('响应数据中未找到ImageURL字段，完整响应:', JSON.stringify(mergeImageFaceResponse, null, 2));
                throw new Error('人脸融合失败：未返回结果图片URL');
            }
        } else {
            console.error('响应格式错误，完整响应:', JSON.stringify(mergeImageFaceResponse, null, 2));
            throw new Error('人脸融合失败：响应数据格式错误');
        }

    } catch (error) {
        console.error('执行人脸融合失败:', error);
        
        // 处理SDK错误
        if (error.data && error.data.code) {
            throw new Error(`人脸融合失败: ${error.data.code} - ${error.data.message || error.data.message}`);
        } else if (error.message) {
            throw new Error(`人脸融合失败: ${error.message}`);
        } else {
            throw error;
        }
    }
}

router.post('/face-swap', protect, checkFeatureAccess('FACE_FUSION'), upload.single('userImage'), async (req, res) => {
    try {
        let userImageBase64;
        const templateId = req.body.templateId;

        // 检查必要参数
        if (!templateId) {
            return res.status(400).json({
                success: false,
                error: '请提供TemplateId，需要先创建模板'
            });
        }

        // 处理用户图片
        if (req.file) {
            // 验证图片分辨率
            const dimensionCheck = validateImageDimensions(req.file.buffer);
            if (!dimensionCheck.valid) {
                return res.status(400).json({
                    success: false,
                    error: dimensionCheck.error
                });
            }
            
            userImageBase64 = imageToBase64(req.file.buffer);
        } 
        else if (req.body.userImageBase64) {
            userImageBase64 = req.body.userImageBase64;
        } 
        else {
            return res.status(400).json({
                success: false,
                error: '请提供用户图片，支持文件上传或Base64格式'
            });
        }

        // 检查API密钥（兼容新旧环境变量名）
        const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID;
        const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET;
        
        if (!accessKeyId || !accessKeySecret) {
            return res.status(500).json({
                success: false,
                error: '服务器未配置阿里云AccessKey，请联系管理员'
            });
        }

        // 生成任务ID
        const taskId = `face-fusion-${Date.now()}-${uuidv4().substring(0, 8)}`;
        
        console.log(`开始处理人脸融合请求，用户ID: ${req.user.id}, TemplateId: ${templateId}, TaskId: ${taskId}`);

        // 准备选项参数
        const options = {
            modelVersion: req.body.modelVersion || 'v1',
            addWatermark: req.body.addWatermark === 'true' || req.body.addWatermark === true,
            watermarkType: req.body.watermarkType || 'EN'
        };

        // 调用阿里云人脸融合API（使用TemplateId）
        const result = await performFaceFusion(templateId, userImageBase64, options);

        // 下载临时图片并保存到OSS（阿里云返回的URL有效期30分钟）
        let permanentImageUrl = result.ImageURL;
        if (result.tempImageUrl) {
            try {
                console.log('开始下载临时图片并保存到OSS...');
                permanentImageUrl = await downloadAndSaveImageToOSS(result.tempImageUrl, req.user.id, taskId);
                console.log('图片已保存到OSS，永久URL:', permanentImageUrl);
            } catch (saveError) {
                console.error('保存图片到OSS失败，使用临时URL:', saveError);
                // 如果保存失败，使用临时URL（30分钟内有效）
                permanentImageUrl = result.tempImageUrl;
            }
        }

        // 任务完成，调用track-usage API扣费
        try {
            const trackUsageResponse = await fetch(`${req.protocol}://${req.get('host')}/api/credits/track-usage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': req.headers.authorization
                },
                body: JSON.stringify({
                    action: 'use',
                    featureName: 'FACE_FUSION',
                    taskId: taskId
                    // creditCost会在track-usage API中根据功能配置自动计算
                })
            });

            const trackUsageResult = await trackUsageResponse.json();
            
            if (!trackUsageResult.success) {
                console.error('扣费失败:', trackUsageResult);
                // 扣费失败不影响返回结果，但记录错误
            } else {
                console.log(`任务完成，扣费成功: TaskId=${taskId}, 积分=${trackUsageResult.data?.creditCost || 0}, 是否免费=${trackUsageResult.data?.isFree || false}`);
            }
        } catch (chargeError) {
            console.error('调用track-usage API失败:', chargeError);
            // 扣费失败不影响返回结果，但记录错误
        }

        // 保存历史记录（异步，不阻塞响应）
        try {
            // 获取用户图片URL（如果有）
            let userImageUrl = null;
            if (req.body.userImageBase64) {
                // 如果用户提供了Base64图片，可以上传到OSS获取URL
                // 这里暂时使用null，因为原始图片可能已经在OSS中
                userImageUrl = null;
            }
            
            const historyItem = {
                templateId: templateId,
                originalImage: userImageUrl, // 原始用户图片（可选）
                resultImage: permanentImageUrl, // 处理结果图片
                taskId: taskId,
                createdAt: new Date().toISOString()
            };
            
            // 异步保存历史记录，不阻塞响应
            saveFaceFusionHistoryOSS(req.user.id, historyItem)
                .then(recordId => {
                    logger.info('图片换脸历史记录保存成功', {
                        userId: req.user.id,
                        taskId: taskId,
                        recordId: recordId
                    });
                })
                .catch(historyError => {
                    logger.error('图片换脸历史记录保存失败', {
                        userId: req.user.id,
                        taskId: taskId,
                        error: historyError.message
                    });
                    // 历史记录保存失败不影响主流程
                });
        } catch (historyError) {
            logger.error('保存历史记录时发生错误', {
                userId: req.user.id,
                taskId: taskId,
                error: historyError.message
            });
            // 历史记录保存失败不影响主流程
        }

        res.json({
            success: true,
            result: {
                ImageURL: permanentImageUrl, // 永久URL（已保存到OSS）
                RequestId: result.RequestId, // 请求ID
                originalTempUrl: result.tempImageUrl // 原始临时URL（用于参考）
            },
            taskId: taskId,
            message: '人脸融合处理完成'
        });

    } catch (error) {
        console.error('人脸融合API错误:', error);
        res.status(500).json({
            success: false,
            error: error.message || '人脸融合处理失败'
        });
    }
});

/**
 * 查询人脸融合任务结果
 */
router.get('/task/:taskId', protect, async (req, res) => {
    try {
        const { taskId } = req.params;
        
        if (!ALIYUN_FACE_FUSION_CONFIG.apiKey) {
            return res.status(500).json({
                success: false,
                error: '服务器未配置阿里云API密钥'
            });
        }

        console.log(`查询人脸融合任务状态: ${taskId}, 用户ID: ${req.user.id}`);

        const response = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
            headers: {
                'Authorization': `Bearer ${ALIYUN_FACE_FUSION_CONFIG.apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`任务查询失败: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        res.json({
            success: true,
            result: result,
            taskId: taskId
        });

    } catch (error) {
        console.error('人脸融合任务查询错误:', error);
        res.status(500).json({
            success: false,
            error: error.message || '任务查询失败'
        });
    }
});

/**
 * 获取人脸融合功能配置信息
 */
router.get('/config', protect, (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                hasApiKey: !!ALIYUN_FACE_FUSION_CONFIG.apiKey,
                supportedFormats: ['jpg', 'jpeg', 'png', 'bmp'],
                maxFileSize: '30MB',
                features: {
                    fusionStrength: {
                        min: 0.0,
                        max: 1.0,
                        default: 0.8,
                        description: '融合强度，数值越高融合效果越明显'
                    },
                    outputQuality: {
                        min: 50,
                        max: 100,
                        default: 95,
                        description: '输出图片质量'
                    },
                    keepOriginalSize: {
                        default: true,
                        description: '是否保持原图尺寸'
                    }
                }
            }
        });
    } catch (error) {
        console.error('获取人脸融合配置失败:', error);
        res.status(500).json({
            success: false,
            error: '获取配置失败'
        });
    }
});

/**
 * 健康检查
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        timestamp: new Date().toISOString(),
        hasApiKey: !!ALIYUN_FACE_FUSION_CONFIG.apiKey,
        service: 'face-fusion'
    });
});

module.exports = router;
