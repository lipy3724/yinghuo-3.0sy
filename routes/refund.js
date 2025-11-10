const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    refundModelSkinChangerCredits,
    refundClothingSimulationCredits,
    refundCutoutCredits,
    refundGlobalStyleCredits,
    refundTextToImageCredits,
    refundImageEditCredits,
    refundMarketingImagesCredits,
    refundTranslateCredits,
    refundClothSegmentationCredits,
    refundVirtualShoeModelCredits,
    refundVirtualModelVtonCredits,
    refundSceneGeneratorCredits,
    refundImageExpansionCredits,
    refundImageSharpeningCredits,
    refundImageUpscalerCredits,
    refundImageColorizationCredits,
    refundLocalRedrawCredits
} = require('../utils/refundManager');

/**
 * 通用退款请求处理函数
 * @param {Function} refundFunction - 特定功能的退款函数
 * @returns {Function} - Express中间件函数
 */
const createRefundHandler = (refundFunction) => {
    return async (req, res) => {
        try {
            const { taskId, reason } = req.body;
            const userId = req.user.id;
            
            if (!taskId) {
                return res.status(400).json({ 
                    success: false, 
                    message: '缺少任务ID参数' 
                });
            }
            
            console.log(`收到退款请求: 用户ID=${userId}, 任务ID=${taskId}, 原因=${reason || '未提供'}`);
            
            // 调用特定功能的退款函数
            const success = await refundFunction(userId, taskId, reason || '前端请求退款');
            
            if (success) {
                console.log(`退款成功: 用户ID=${userId}, 任务ID=${taskId}`);
                return res.status(200).json({ 
                    success: true, 
                    message: '退款处理成功' 
                });
            } else {
                console.log(`退款失败: 用户ID=${userId}, 任务ID=${taskId}`);
                return res.status(400).json({ 
                    success: false, 
                    message: '退款处理失败，可能是任务不存在或已经退款' 
                });
            }
        } catch (error) {
            console.error('处理退款请求时出错:', error);
            return res.status(500).json({ 
                success: false, 
                message: '服务器处理退款请求时出错: ' + error.message 
            });
        }
    };
};

/**
 * 通用退款请求处理函数 - 不需要认证的版本
 * @param {Function} refundFunction - 特定功能的退款函数
 * @returns {Function} - Express中间件函数
 */
const createPublicRefundHandler = (refundFunction) => {
    return async (req, res) => {
        try {
            const { taskId, reason } = req.body;
            
            if (!taskId) {
                return res.status(400).json({ 
                    success: false, 
                    message: '缺少任务ID参数' 
                });
            }
            
            console.log(`收到公开退款请求: 任务ID=${taskId}, 原因=${reason || '未提供'}`);
            
            // 对于公开接口，我们无法获取用户ID，传null
            const success = await refundFunction(null, taskId, reason || '前端请求退款(公开接口)');
            
            if (success) {
                console.log(`退款成功(公开接口): 任务ID=${taskId}`);
                return res.status(200).json({ 
                    success: true, 
                    message: '退款处理成功' 
                });
            } else {
                console.log(`退款失败(公开接口): 任务ID=${taskId}`);
                return res.status(400).json({ 
                    success: false, 
                    message: '退款处理失败，可能是任务不存在或已经退款' 
                });
            }
        } catch (error) {
            console.error('处理公开退款请求时出错:', error);
            return res.status(500).json({ 
                success: false, 
                message: '服务器处理退款请求时出错: ' + error.message 
            });
        }
    };
};

// 模特肤色替换退款接口
router.post('/model-skin-changer', protect, createRefundHandler(refundModelSkinChangerCredits));

// 模特试衣退款接口
router.post('/clothing-simulation', protect, createRefundHandler(refundClothingSimulationCredits));

// 智能抠图退款接口
router.post('/cutout', protect, createRefundHandler(refundCutoutCredits));

// 全局风格化退款接口
router.post('/global-style', protect, createRefundHandler(refundGlobalStyleCredits));

// 文生图退款接口
router.post('/text-to-image', protect, createRefundHandler(refundTextToImageCredits));

// 图像指令编辑退款接口
router.post('/image-edit', protect, createRefundHandler(refundImageEditCredits));

// 产品营销图退款接口
router.post('/marketing-images', protect, createRefundHandler(refundMarketingImagesCredits));

// 智能翻译退款接口
router.post('/translate', protect, createRefundHandler(refundTranslateCredits));

// 服饰分割退款接口
router.post('/cloth-segmentation', protect, createRefundHandler(refundClothSegmentationCredits));

// 虚拟试穿退款接口
router.post('/virtual-shoe-model', protect, createRefundHandler(refundVirtualShoeModelCredits));

// 虚拟模特试穿退款接口
router.post('/virtual-model-vton', protect, createRefundHandler(refundVirtualModelVtonCredits));

// 场景生成器退款接口
router.post('/scene-generator', protect, createRefundHandler(refundSceneGeneratorCredits));

// 图像扩展退款接口
router.post('/image-expansion', protect, createRefundHandler(refundImageExpansionCredits));

// 图像扩展退款接口 - 公开版本，不需要认证
router.post('/image-expansion-fallback', createPublicRefundHandler(refundImageExpansionCredits));

// 图像模糊变清晰退款接口
router.post('/image-sharpening', protect, createRefundHandler(refundImageSharpeningCredits));

// 图像高清放大退款接口
router.post('/image-upscaler', protect, createRefundHandler(refundImageUpscalerCredits));

// 图像上色退款接口
router.post('/image-colorization', protect, createRefundHandler(refundImageColorizationCredits));

// 局部重绘退款接口
router.post('/local-redraw', protect, createRefundHandler(refundLocalRedrawCredits));

module.exports = router; 