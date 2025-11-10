/**
 * 阿里云百炼API路由
 * 提供安全的阿里云API代理服务
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// 阿里云API配置
const ALIYUN_CONFIG = {
    endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation',
    apiKey: process.env.ALIYUN_API_KEY,
    region: process.env.ALIYUN_REGION || 'cn-beijing'
};

/**
 * 获取API配置信息（不包含敏感信息）
 */
router.get('/config', protect, (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                endpoint: ALIYUN_CONFIG.endpoint,
                region: ALIYUN_CONFIG.region,
                hasApiKey: !!ALIYUN_CONFIG.apiKey,
                supportedFeatures: [
                    'image-enhancement',
                    'background-removal', 
                    'image-super-resolution',
                    'image-colorization'
                ]
            }
        });
    } catch (error) {
        console.error('获取API配置失败:', error);
        res.status(500).json({
            success: false,
            error: '获取API配置失败'
        });
    }
});

/**
 * 图像处理API代理
 */
router.post('/image-process', protect, async (req, res) => {
    try {
        const { feature, imageBase64, parameters = {} } = req.body;

        // 验证必要参数
        if (!feature || !imageBase64) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数：feature 和 imageBase64'
            });
        }

        // 检查API密钥
        if (!ALIYUN_CONFIG.apiKey) {
            return res.status(500).json({
                success: false,
                error: '服务器未配置阿里云API密钥，请联系管理员'
            });
        }

        // 验证功能类型
        const supportedFeatures = [
            'image-enhancement',
            'background-removal',
            'image-super-resolution', 
            'image-colorization'
        ];

        if (!supportedFeatures.includes(feature)) {
            return res.status(400).json({
                success: false,
                error: `不支持的功能类型: ${feature}`
            });
        }

        // 构建请求数据
        const requestData = {
            model: getModelForFeature(feature),
            input: {
                image: imageBase64,
                ...parameters.input
            },
            parameters: {
                ...getDefaultParameters(feature),
                ...parameters.parameters
            }
        };

        console.log(`开始处理${feature}请求，用户ID: ${req.user.id}`);

        // 调用阿里云API
        const response = await fetch(ALIYUN_CONFIG.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ALIYUN_CONFIG.apiKey}`,
                'X-DashScope-Async': 'enable'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('阿里云API调用失败:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            
            throw new Error(`阿里云API调用失败: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('阿里云API响应:', result);

        // 处理响应
        if (result.output && result.output.task_id) {
            // 异步任务
            res.json({
                success: true,
                taskId: result.output.task_id,
                message: '任务已提交，请使用任务ID查询结果',
                feature: feature
            });
        } else if (result.output && result.output.results) {
            // 同步结果
            res.json({
                success: true,
                result: result.output.results[0],
                feature: feature
            });
        } else {
            // 其他格式的结果
            res.json({
                success: true,
                result: result,
                feature: feature
            });
        }

    } catch (error) {
        console.error('图像处理API错误:', error);
        res.status(500).json({
            success: false,
            error: error.message || '图像处理失败'
        });
    }
});

/**
 * 查询异步任务结果
 */
router.get('/task/:taskId', protect, async (req, res) => {
    try {
        const { taskId } = req.params;
        
        if (!ALIYUN_CONFIG.apiKey) {
            return res.status(500).json({
                success: false,
                error: '服务器未配置阿里云API密钥'
            });
        }

        console.log(`查询任务状态: ${taskId}, 用户ID: ${req.user.id}`);

        const response = await fetch(`${ALIYUN_CONFIG.endpoint}/${taskId}`, {
            headers: {
                'Authorization': `Bearer ${ALIYUN_CONFIG.apiKey}`
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
        console.error('任务查询错误:', error);
        res.status(500).json({
            success: false,
            error: error.message || '任务查询失败'
        });
    }
});

/**
 * 根据功能类型获取对应的模型
 */
function getModelForFeature(feature) {
    const modelMap = {
        'image-enhancement': 'wanx-image-enhancement-v1',
        'background-removal': 'wanx-background-generation-v2', 
        'image-super-resolution': 'wanx-image-super-resolution-v1',
        'image-colorization': 'wanx-image-colorization-v1'
    };
    return modelMap[feature] || 'wanx-image-enhancement-v1';
}

/**
 * 获取功能的默认参数
 */
function getDefaultParameters(feature) {
    const defaultParams = {
        'image-enhancement': {
            enhancement_type: 'auto',
            strength: 0.8
        },
        'background-removal': {
            output_format: 'png',
            return_form: 'url'
        },
        'image-super-resolution': {
            scale_factor: 2,
            model_type: 'real-esrgan'
        },
        'image-colorization': {
            color_mode: 'auto',
            strength: 0.8
        }
    };
    return defaultParams[feature] || {};
}

/**
 * 健康检查
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        timestamp: new Date().toISOString(),
        hasApiKey: !!ALIYUN_CONFIG.apiKey,
        endpoint: ALIYUN_CONFIG.endpoint
    });
});

module.exports = router;
