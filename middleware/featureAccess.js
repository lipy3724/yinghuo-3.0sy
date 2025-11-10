const User = require('../models/User');
const { FeatureUsage } = require('../models/FeatureUsage');
const { Op } = require('sequelize');
const { DataTypes } = require('sequelize');

// 功能配置
const FEATURES = {
  // 图像处理功能
  'image-upscaler': { creditCost: 10, freeUsage: 1 }, // 图片高清放大
  'marketing-images': { creditCost: 7, freeUsage: 1 }, // 产品营销图
  'cutout': { creditCost: 5, freeUsage: 1 }, // 抠图
  'translate': { creditCost: 5, freeUsage: 1 }, // 智能翻译
  'scene-generator': { creditCost: 7, freeUsage: 1 }, // 场景生成
  'image-removal': { creditCost: 7, freeUsage: 1 }, // 图像物体移除 
  'model-skin-changer': { creditCost: 10, freeUsage: 1 }, // 模特肤色替换
  'clothing-simulation': { creditCost: 10, freeUsage: 1 }, // 模拟试衣
  'text-to-video': { 
    creditCost: (payload) => {
      // 返回0，创建阶段不预扣积分，任务完成后再扣费
      return 0;
    }, 
    freeUsage: 1 
  }, // 文生视频功能，任务完成后扣除66积分 // 文生视频功能，较高积分消耗
  'image-to-video': { 
    creditCost: (payload) => {
      // 返回0，创建阶段不预扣积分，任务完成后再扣费
      return 0;
    }, 
    freeUsage: 1 
  }, // 图生视频功能，任务完成后扣除66积分
  'IMAGE_EDIT': { 
    creditCost: 7, // 🔧 修改：指令编辑功能固定7积分/次，不再按图片数量计费
    freeUsage: 1 
  }, // 图像指令编辑功能 - 首次免费，后续7积分/次
  'LOCAL_REDRAW': { creditCost: 7, freeUsage: 1 }, // 图像局部重绘功能
  'IMAGE_COLORIZATION': { creditCost: 7, freeUsage: 1 }, // 图像上色功能
  'image-expansion': { creditCost: 7, freeUsage: 1 }, // 智能扩图功能
  'VIRTUAL_SHOE_MODEL': { creditCost: 25, freeUsage: 1 }, // 鞋靴虚拟试穿功能
  'TEXT_TO_IMAGE': { creditCost: 7, freeUsage: 1 }, // 文生图片功能
  'IMAGE_SHARPENING': { creditCost: 7, freeUsage: 1 }, // 模糊图片变清晰功能
  'CLOTH_SEGMENTATION': { creditCost: 2, freeUsage: 1 }, // 智能服饰分割功能
  'GLOBAL_STYLE': { creditCost: 7, freeUsage: 1 }, // 全局风格化功能
  'DIANTU': { creditCost: 7, freeUsage: 1 }, // 垫图功能
  'IMAGE_CROP': { creditCost: 0, freeUsage: 999999 }, // 图像裁剪功能（免费）
  'IMAGE_RESIZE': { creditCost: 0, freeUsage: 999999 }, // 图片改尺寸功能（免费）
  'QWEN_IMAGE_EDIT': { 
    creditCost: (payload) => {
      // 创建阶段不扣费，任务完成后再扣费
      return 0;
    },
    freeUsage: 1 
  }, // 通义千问图像编辑功能 - 首次免费，后续按图片数量计费（7积分/张），任务完成时扣费
  
  // 亚马逊功能
  'amazon_video_script': { creditCost: 1, freeUsage: 0 }, // 亚马逊广告视频脚本生成
  'product_improvement_analysis': { creditCost: 1, freeUsage: 0 }, // 选品的改款分析和建议
  'amazon_brand_info': { creditCost: 1, freeUsage: 0 }, // 品牌信息收集和总结
  'amazon_brand_naming': { creditCost: 1, freeUsage: 0 }, // 亚马逊品牌起名
  'amazon_listing': { creditCost: 1, freeUsage: 0 }, // 亚马逊Listing写作与优化
  'amazon_search_term': { creditCost: 1, freeUsage: 0 }, // 亚马逊后台搜索词
  'amazon_review_analysis': { creditCost: 1, freeUsage: 0 }, // 亚马逊客户评论分析
  'amazon_consumer_insights': { creditCost: 1, freeUsage: 0 }, // 亚马逊消费者洞察专家
  'amazon_customer_email': { creditCost: 1, freeUsage: 0 }, // 亚马逊客户邮件回复
  'fba_claim_email': { creditCost: 1, freeUsage: 0 }, // FBA索赔邮件
  'amazon_review_generator': { creditCost: 1, freeUsage: 0 }, // 亚马逊评论生成
  'amazon_review_response': { creditCost: 1, freeUsage: 0 }, // 亚马逊评论回复
  'product_comparison': { creditCost: 1, freeUsage: 0 }, // 产品对比
  'amazon_post_creator': { creditCost: 1, freeUsage: 0 }, // 创建亚马逊Post
  'amazon_keyword_recommender': { creditCost: 1, freeUsage: 0 }, // 亚马逊关键词推荐
  'amazon_case_creator': { creditCost: 1, freeUsage: 0 }, // 亚马逊客服case内容
  
  // 新增功能
  'VIRTUAL_MODEL_VTON': { creditCost: 40, freeUsage: 1 }, // 智能虚拟模特试穿 模型vton1.0
  'VIDEO_SUBTITLE_REMOVER': { 
    creditCost: (duration) => {
      // 计算视频时长应消耗的积分
      // 默认每30秒30积分，不足30秒按30秒计算
      // 返回0，创建阶段不预扣积分，任务完成后再扣费
      return 0; // 修改为0，确保创建任务阶段不扣除积分
    }, 
    freeUsage: 0  // 🔧 修改：视频去除字幕功能无免费次数，所有使用都收费
  }, // 视频去除字幕 30积分/30秒
  'MULTI_IMAGE_TO_VIDEO': { 
    creditCost: (payload) => {
      /*
        计算多图转视频积分：
        - 规则：每 30 秒 30 积分，不足 30 秒按 30 秒计。
        - 兼容调用方传入数字 duration，或整个 req.body 对象。
        - 创建阶段返回0，任务完成后再根据实际时长扣费
      */
      return 0; // 创建阶段不扣费
    }, 
    freeUsage: 0  // 🔧 修改：多图转视频功能无免费次数，所有使用都收费
  }, // 多图转视频 30积分/30秒，任务完成后扣费
  'DIGITAL_HUMAN_VIDEO': { 
    creditCost: (payload) => {
      // 视频数字人功能，在任务完成后根据实际生成视频时长计费
      // 创建阶段不预扣积分，返回0
      console.log(`视频数字人功能创建任务 - 跳过积分预扣，将在任务完成后扣除`);
      return 0;
    }, 
    freeUsage: 0  // 🔧 修改：视频数字人功能无免费次数，所有使用都收费
  },  // 视频数字人 9积分/秒，任务完成后扣费
  'VIDEO_STYLE_REPAINT': { 
    creditCost: (payload) => {
      /*
        视频风格重绘积分计算在任务完成后才能确定(依赖实际时长与分辨率)。
        这里返回 0，使创建任务阶段仅做免费次数判断而不预扣积分。
        后续在任务完成回调里会根据实际值统一扣费。
      */
      return 0;
    }, 
    freeUsage: 0 
  }, // 视频风格重绘功能（按实际时长+分辨率计费，创建阶段不扣费，无免费次数）
  'VIDEO_FACE_SWAP': {
    creditCost: (payload) => {
      // 根据服务模式和视频时长计算积分消耗
      // wan-std (标准模式): 8积分/秒
      // wan-pro (专业模式): 10积分/秒
      const serviceMode = payload && payload.serviceMode ? payload.serviceMode : 'wan-std';
      const videoDuration = payload && payload.videoDuration ? parseFloat(payload.videoDuration) : 1; // 默认1秒
      const ratePerSecond = serviceMode === 'wan-pro' ? 10 : 8;
      
      // 先将视频时长向上取整，再乘以费率
      const totalCredits = Math.ceil(videoDuration) * ratePerSecond;
      console.log(`视频换人积分计算: 模式=${serviceMode}, 时长=${videoDuration}秒, 向上取整=${Math.ceil(videoDuration)}秒, 费率=${ratePerSecond}积分/秒, 总积分=${totalCredits}`);
      
      return totalCredits;
    },
    freeUsage: 0 // 🔧 修改：视频换人功能无免费次数，所有使用都收费
  }, // 视频换人功能 - 标准模式8积分/秒，专业模式10积分/秒
  'VIDEO_LOGO_REMOVAL': { 
    creditCost: (payload) => {
      // 视频去水印/logo功能，在任务完成后根据实际视频时长计费
      // 创建阶段不预扣积分，返回0，任务完成后再根据实际时长扣费
      return 0; // 修改为0，确保创建任务阶段不扣除积分
    }, 
    freeUsage: 0  // 🔧 视频去水印功能无免费次数，所有使用都收费
  }, // 视频去水印/logo功能，任务完成后根据实际时长扣费
  // 可以添加更多功能和对应的积分消耗
};

/**
 * 检查用户是否可以使用特定功能
 * @param {string} featureName 功能名称
 */
const checkFeatureAccess = (featureName) => {
  return async (req, res, next) => {
    const featureConfig = FEATURES[featureName];
    
    if (!featureConfig) {
      return res.status(400).json({
        success: false,
        message: '无效的功能名称'
      });
    }

    try {
      const userId = req.user.id;
      
      // 获取今天的日期，仅用于记录
      const today = new Date().toISOString().split('T')[0];
      
      // 查找或创建该用户对该功能的使用记录
      let [usage, created] = await FeatureUsage.findOrCreate({
        where: {
          userId,
          featureName
        },
        defaults: {
          usageCount: 0,
          lastUsedAt: new Date(),
          resetDate: today
        }
      });
      
      // 检查是否在免费使用次数内
      if (usage.usageCount < featureConfig.freeUsage) {
        // 在免费使用次数内，允许使用
        console.log(`用户ID ${userId} 使用 ${featureName} 功能的免费次数 ${usage.usageCount + 1}/${featureConfig.freeUsage}`);
        
        // 更新使用次数
        usage.usageCount += 1;
        usage.lastUsedAt = new Date();
        await usage.save();
        
        // 获取用户信息，以便正确设置remainingCredits
        const user = await User.findByPk(userId);
        
        // 将免费使用信息添加到请求对象
        req.featureUsage = {
          usageType: 'free',
          creditCost: 0,
          isFree: true,
          remainingCredits: user.credits,
          shouldUseTrackUsage: true, // 标记应该使用track-usage API
          usage: usage // 传递usage对象，方便后续保存任务详情
        };
        
        next();
        return;
      }
      
      // 超过免费次数，需要检查积分是否足够
      let creditCost = 0;
      
      // 处理积分计算
      if (typeof featureConfig.creditCost === 'function') {
        // 动态计算积分的功能
        if (featureName === 'DIGITAL_HUMAN_VIDEO') {
          // 数字人视频功能，在结果返回后根据生成视频时长计费
          // 这里仅做权限检查，不预先扣除积分
          console.log(`数字人视频功能权限检查，积分将在任务完成后根据实际生成视频时长扣除`);
          creditCost = 20; // 仅检查用户是否有至少20积分，实际不会扣除
          
          // 添加动态积分计算函数到请求对象，供后续使用
          req.featureUsage = req.featureUsage || {};
          req.featureUsage.getDynamicCredits = (videoDuration) => Math.ceil(videoDuration) * 9;
        }
        else if (featureName === 'VIDEO_STYLE_REPAINT') {
          // 视频风格重绘功能，不预先扣除积分，而是在任务完成后扣除
          console.log(`视频风格重绘功能权限检查 - 跳过积分扣除`);
          creditCost = 10; // 仅检查用户是否有至少10积分，实际不会扣除
        }
        
        else if (featureName === 'text-to-video') {
          // 文生视频功能，在任务完成后扣除积分
          console.log(`文生视频功能权限检查 - 跳过积分扣除`);
          creditCost = 66; // 检查用户是否有足够的积分（66积分）
        }
        else if (featureName === 'image-to-video') {
          // 图生视频功能，在任务完成后扣除积分
          console.log(`图生视频功能权限检查 - 跳过积分扣除`);
          creditCost = 66; // 检查用户是否有足够的积分（66积分）
        }
        else if (featureName === 'MULTI_IMAGE_TO_VIDEO') {
          // 多图转视频功能，在任务完成后根据实际时长扣除积分
          console.log(`多图转视频功能权限检查 - 跳过积分扣除`);
          creditCost = 30; // 仅检查用户是否有至少30积分，实际不会扣除
        }else if (featureName === 'VIDEO_SUBTITLE_REMOVER') {
          // 视频去除字幕功能，不预先扣除积分，而是在任务完成后扣除
          console.log(`视频去除字幕功能权限检查 - 跳过积分扣除`);
          creditCost = 30; // 仅检查用户是否有至少30积分，实际不会扣除
        }
        else {
          // 其他需要动态计算积分的功能
          creditCost = featureConfig.creditCost(req.body);
        }
      } else {
        // 固定积分消耗
        creditCost = featureConfig.creditCost;
      }
      
      // 检查用户积分是否足够
      const user = await User.findByPk(userId);
      
      if (user.credits < creditCost) {
        // 获取功能的实际所需积分
        let actualCreditCost = creditCost;
        
        // 对于特殊功能，显示实际需要的积分
        if (featureName === 'text-to-video' || featureName === 'image-to-video') {
          actualCreditCost = 66; // 文生视频和图生视频固定需要66积分
        } else if (featureName === 'DIGITAL_HUMAN_VIDEO') {
          actualCreditCost = '9积分/秒'; // 数字人视频按时长计费
        } else if (featureName === 'MULTI_IMAGE_TO_VIDEO' || featureName === 'VIDEO_SUBTITLE_REMOVER') {
          actualCreditCost = '30积分/30秒'; // 多图转视频和视频去字幕按时长计费
        }
        
        return res.status(402).json({
          success: false,
          message: `您的免费试用次数已用完，积分不足。此功能需要${actualCreditCost}积分，您当前有${user.credits}积分。`,
          data: {
            requiredCredits: creditCost,
            actualRequiredCredits: actualCreditCost,
            currentCredits: user.credits,
            freeUsageLimit: featureConfig.freeUsage,
            freeUsageUsed: usage.usageCount
          }
        });
      }
      
      // 积分足够，允许使用功能
      // 更新使用次数
      usage.usageCount += 1;
      usage.lastUsedAt = new Date();
      await usage.save();
      
      // 不在这里扣除积分，而是标记需要使用track-usage API
      req.featureUsage = {
        usageType: 'paid',
        creditCost: creditCost,
        isFree: false,
        remainingCredits: user.credits,
        shouldUseTrackUsage: true, // 标记应该使用track-usage API
        usage: usage // 传递usage对象，方便后续保存任务详情
      };
      
      console.log(`用户ID ${userId} 使用 ${featureName} 功能权限检查通过，需要消耗 ${creditCost} 积分`);
      
      next();
    } catch (error) {
      console.error('功能访问权限检查出错:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误，无法验证功能访问权限',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

// 导出模块
module.exports = {
  checkFeatureAccess,
  FEATURES
}; 