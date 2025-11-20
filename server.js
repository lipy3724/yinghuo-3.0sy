// 首先加载环境变量（使用绝对路径确保正确加载）
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const sequelize = require('./config/db');
const fs = require('fs');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const crypto = require('crypto');
const multer = require('multer');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
// 初始化全局变量，用于存储图像智能消除任务信息
global.imageRemovalTasks = {};
// 初始化全局变量，用于存储模糊图片变清晰任务信息
global.imageSharpeningTasks = {};
// 初始化全局变量，用于存储垫图任务信息
global.diantuTasks = {};
// 初始化全局变量，用于存储文生图片任务信息
global.textToImageTasks = {};
// 初始化全局变量，用于存储图生视频任务信息
global.imageToVideoTasks = {};
// 初始化全局变量，用于存储多图转视频任务信息
global.multiImageToVideoTasks = {};
// 初始化全局变量，用于存储视频风格重绘任务信息
global.videoStyleRepaintTasks = {};
// 初始化全局变量，用于存储视频去除字幕任务信息
global.videoSubtitleTasks = {};
// 初始化全局变量，用于存储视频数字人任务信息
global.digitalHumanTasks = {};
// 初始化全局变量，用于存储图片高清放大任务信息
global.imageUpscalerTasks = {};
// 初始化全局变量，用于存储场景图生成任务信息
global.sceneGeneratorTasks = {};
// 初始化全局变量，用于存储图像上色任务信息
global.imageColorizationTasks = {};
// 初始化全局变量，用于存储局部重绘任务信息
global.localRedrawTasks = {};
// 初始化全局变量，用于存储全局风格化任务信息
global.globalStyleTasks = {};
// 初始化全局变量，用于存储垫图任务信息
global.diantuTasks = {};
// 初始化全局变量，用于存储模特换肤任务信息
global.modelSkinChangerTasks = {};
// 初始化全局变量，用于存储模特试衣任务信息
global.clothingSimulationTasks = {};
// 初始化全局变量，用于存储指令编辑任务信息
global.imageEditTasks = {};
// 初始化全局变量，用于存储通义千问图像编辑任务信息
global.qwenImageEditTasks = {};
// 初始化全局变量，用于存储文生视频任务信息
global.textToVideoTasks = {};
// 初始化全局变量，用于存储智能扩图任务信息
global.imageExpansionTasks = {};
// 初始化全局变量，用于存储AI营销图任务信息
global.marketingImagesTasks = {};
// 初始化全局变量，用于存储图片翻译任务信息
global.translateTasks = {};
// 初始化全局变量，用于存储图片换背景任务信息
global.cutoutTasks = {};
// 环境变量已在文件顶部加载
// 导入数据库
// sequelize已在文件顶部引入
// const sequelize = require('./config/db');
// 导入用户模型
const User = require('./models/User');
// 导入功能使用记录模型
const { FeatureUsage, setupAssociations } = require('./models/FeatureUsage');
// 导入图片历史记录模型
const ImageHistory = require('./models/ImageHistory');
// 导入支付订单模型
const PaymentOrder = require('./models/PaymentOrder');
// 导入认证路由
const authRoutes = require('./routes/auth');
// 导入积分管理路由
const creditsRoutes = require('./routes/credits');
// 导入管理员路由
const adminRoutes = require('./routes/admin');
// 导入文生视频路由
const textToVideoRoutes = require('./routes/textToVideo');
// 导入数字人任务路由
const digitalHumanTasksRoutes = require('./routes/digitalHumanTasks');
// 导入图像编辑路由
const imageEditRoutes = require('./routes/imageEdit');
// 导入通义千问图像编辑路由
const qwenImageEditRoutes = require('./routes/qwenImageEdit');
// 导入文生图片路由
const textToImageRoutes = require('./routes/textToImage');
// 导入下载中心路由
const downloadsRoutes = require('./routes/downloads');
// 导入服饰分割路由
const clothingSegmentationRoutes = require('./routes/clothingSegmentation');
// 导入全局风格化路由
const globalStyleRoutes = require('./routes/globalStyle');
const fixDiantuResultRoutes = require('./routes/fix-diantu-result');
// 导入亚马逊Listing路由
const amazonListingRoutes = require('./routes/amazon-listing-api');
// 导入客服路由（数据库版本）
const kefuRoutes = require('./kefu/kefu-db');
// 导入人脸融合路由
const faceFusionRoutes = require('./routes/faceFusion');
// 导入功能访问检查路由
const featureAccessRoutes = require('./routes/featureAccess');
// 导入认证中间件
const { protect } = require('./middleware/auth');
// 导入功能访问中间件和功能配置
const { FEATURES, checkFeatureAccess } = require('./middleware/featureAccess');
const { createUnifiedFeatureMiddleware } = require('./middleware/unifiedFeatureUsage');
// 导入数据库同步函数
const syncDatabase = require('./config/sync-db');
// 导入清理任务
const { startCleanupTasks } = require('./utils/cleanupTasks');
// 导入阿里云API工具
const axios = require('axios');

// 引入图像高清放大API工具
const { uploadToOSS, callUpscaleApi } = require('./api-utils');

// 引入阿里云API工具
const { 
  callClothSegmentationApi, 
  callDashScopeClothSegmentation, 
  callVideoSubtitleRemovalApi, 
  checkAsyncJobStatus
} = require('./utils/aliyunApiProxy');

// 引入视频工具函数
const { v4: uuidv4 } = require('uuid');
const https = require('https');
const OSS = require('ali-oss');

/**
 * 图片高清放大任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @returns {Promise<boolean>} - 退款是否成功
 */
// 导入退款管理模块
const refundManager = require('./utils/refundManager');

/**
 * 鞋靴虚拟试穿任务失败时的退款函数
 * @param {number} userId - 用户ID
 * @param {string} taskId - 任务ID
 */
async function refundVirtualShoeModelCredits(userId, taskId) {
  try {
    console.log(`开始处理鞋靴虚拟试穿任务失败退款: 用户ID=${userId}, 任务ID=${taskId}`);
    
    // 检查全局任务记录中是否有该任务的积分信息
    let creditCost = 0;
    let wasRefunded = false;
    
    if (global.virtualShoeModelTasks && global.virtualShoeModelTasks[taskId]) {
      const taskInfo = global.virtualShoeModelTasks[taskId];
      creditCost = taskInfo.creditCost || 0;
      wasRefunded = taskInfo.refunded || false;
      
      // 如果已经退款过了，不重复退款
      if (wasRefunded) {
        console.log(`任务 ${taskId} 已经退款过，跳过退款处理`);
        return;
      }
      
      // 标记为已退款，防止重复退款
      global.virtualShoeModelTasks[taskId].refunded = true;
    }
    
    // 如果没有积分消耗信息，从功能配置中获取
    if (creditCost === 0) {
      const { FEATURES } = require('./middleware/featureAccess');
      const featureConfig = FEATURES['VIRTUAL_SHOE_MODEL'];
      creditCost = featureConfig ? featureConfig.creditCost : 25;
      console.log(`从功能配置获取积分消耗: ${creditCost}`);
    }
    
    // 查找最近的该功能使用记录
    const recentUsage = await FeatureUsage.findOne({
      where: {
        userId: userId,
        featureName: 'VIRTUAL_SHOE_MODEL'
      },
      order: [['createdAt', 'DESC']]
    });
    
    if (!recentUsage) {
      console.log(`未找到用户 ${userId} 的鞋靴虚拟试穿使用记录，无法执行退款`);
      return;
    }
    
    // 检查该使用记录是否为免费使用
    const { FEATURES } = require('./middleware/featureAccess');
    const featureConfig = FEATURES['VIRTUAL_SHOE_MODEL'];
    
    if (recentUsage.usageCount <= featureConfig.freeUsage) {
      console.log(`用户 ${userId} 使用的是免费次数 (${recentUsage.usageCount}/${featureConfig.freeUsage})，仅回退使用次数，无需退还积分`);
      
      // 即使是免费使用，任务失败时也要回退使用次数，保留免费机会
      if (recentUsage.usageCount > 0) {
        recentUsage.usageCount -= 1;
        await recentUsage.save();
        console.log(`✅ 已回退免费使用次数: 用户ID=${userId}, 当前使用次数=${recentUsage.usageCount}/${featureConfig.freeUsage}`);
      }
      return;
    }
    
    // 如果有积分消耗，执行退款
    if (creditCost > 0) {
      // 获取用户信息
      const user = await User.findByPk(userId);
      if (!user) {
        console.error(`未找到用户 ${userId}，无法执行退款`);
        return;
      }
      
      // 退还积分
      const originalCredits = user.credits;
      user.credits += creditCost;
      await user.save();
      
      // 完全撤销这次使用记录，而不是仅仅减少使用次数
      if (recentUsage.usageCount > 0) {
        recentUsage.usageCount -= 1;
        
        // 清除这次使用产生的积分消费记录
        recentUsage.credits = Math.max(0, (recentUsage.credits || 0) - creditCost);
        
        // 如果使用次数回到免费范围内，清除相关的付费记录
        const { FEATURES } = require('./middleware/featureAccess');
        const featureConfig = FEATURES['VIRTUAL_SHOE_MODEL'];
        if (recentUsage.usageCount < featureConfig.freeUsage) {
          // 回到免费使用范围，清除所有付费相关的记录
          recentUsage.credits = 0;
        }
        
        await recentUsage.save();
      }
      
      console.log(`✅ 鞋靴虚拟试穿任务失败退款成功: 用户ID=${userId}, 任务ID=${taskId}, 退款积分=${creditCost}, 原积分=${originalCredits}, 现积分=${user.credits}`);
      console.log(`📊 使用记录已更新: 使用次数=${recentUsage.usageCount}, 积分消费=${recentUsage.credits}`);
      
      // 在详情中记录退款信息（用于审计）
      try {
        const details = JSON.parse(recentUsage.details || '{}');
        if (!details.refunds) {
          details.refunds = [];
        }
        details.refunds.push({
          taskId: taskId,
          refundCredits: creditCost,
          refundTime: new Date(),
          reason: '任务失败自动退款',
          note: '已从积分使用情况中移除此次消费记录'
        });
        recentUsage.details = JSON.stringify(details);
        await recentUsage.save();
      } catch (detailError) {
        console.error('记录退款详情失败:', detailError);
      }
    } else {
      console.log(`用户 ${userId} 任务 ${taskId} 无积分消耗，无需退款`);
    }
    
  } catch (error) {
    console.error('鞋靴虚拟试穿退款处理错误:', error);
    throw error;
  }
}

// 引入阿里云SDK - 视频增强服务
const videoenhan20200320 = require('@alicloud/videoenhan20200320');
const OpenApi = require('@alicloud/openapi-client');
const Util = require('@alicloud/tea-util');

// 阿里云配置
const ossClient = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
  secure: process.env.OSS_SECURE === 'true',
  timeout: parseInt(process.env.OSS_TIMEOUT || '60000'),
  endpoint: `https://${process.env.OSS_REGION.startsWith('oss-') ? process.env.OSS_REGION : 'oss-' + process.env.OSS_REGION}.aliyuncs.com` // 根据OSS_REGION动态指定Endpoint
});

const app = express();
const port = process.env.PORT || 8080;

// API密钥和密钥配置 - 从环境变量中获取
const APP_KEY = process.env.IMAGE_REMOVAL_APP_KEY;
const SECRET_KEY = process.env.IMAGE_REMOVAL_SECRET_KEY;
const SIGN_METHOD_SHA256 = "sha256";
const SIGN_METHOD_HMAC_SHA256 = "HmacSHA256";
// 阿里云API相关配置 - 确保从环境变量中获取
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || 'default-api-key-replacement';
// 输出API KEY前5个字符，用于调试（不要输出全部，避免安全风险）
console.log('DASHSCOPE_API_KEY配置状态:', DASHSCOPE_API_KEY ? DASHSCOPE_API_KEY.substring(0, 5) + '...' : '未配置');

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// 配置文件上传 - 磁盘存储
const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// 配置文件上传 - 内存存储（用于图像高清放大等需要直接处理文件的功能）
const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  }
});

const diskUpload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  }
});

const memoryUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  }
});

// 配置视频上传 - 磁盘存储
const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads', 'videos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'video-' + uniqueSuffix + ext);
  }
});

const videoUpload = multer({
  storage: videoStorage,
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB限制
  },
  fileFilter: function (req, file, cb) {
    // 只接受MP4格式
    if (file.mimetype === 'video/mp4') {
      cb(null, true);
    } else {
      cb(new Error('只支持MP4格式的视频文件'));
    }
  }
});

// 中间件配置
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: false
}));
app.use(bodyParser.json({ limit: '500mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '500mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 设置服务器的CSP头
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy', 
    "default-src 'self'; media-src 'self' blob: data: * https://*.aliyuncs.com https://*.alicdn.com https://*.aliyun.com https://*.dashscope.aliyuncs.com https://*.oss-cn-shanghai.aliyuncs.com https://yinghuo-ai.oss-cn-shanghai.aliyuncs.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://www.googletagmanager.com https://g.alicdn.com https://a.alicdn.com; connect-src 'self' https://api.openai.com https://exlzvpf9e2.execute-api.ap-southeast-1.amazonaws.com https://*.googleapis.com https://*.aliyuncs.com; img-src 'self' data: https: blob: https://*.aliyuncs.com https://*.alicdn.com https://*.aliyun.com https://*.oss-cn-shanghai.aliyuncs.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; font-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; frame-src 'self' https://editor.d.design https://g.alicdn.com https://a.alicdn.com"
  );
  next();
});

// 创建代理中间件
const editorProxy = createProxyMiddleware({
  target: 'https://editor.d.design',
  changeOrigin: true,
  onProxyRes: function(proxyRes, req, res) {
    // 修改响应头处理跨域
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    
    // 记录请求日志
    console.log(`编辑器代理: ${req.method} ${req.path} -> ${proxyRes.statusCode}`);
  },
  onError: function(err, req, res) {
    console.error('代理错误:', err);
    res.status(500).send('代理服务器错误');
  },
  // 添加超时设置，防止请求阻塞
  timeout: 30000,
  proxyTimeout: 30000
});

// 添加用户认证路由
app.use('/api/auth', authRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/admin', adminRoutes);
// 添加调试路由
app.use('/api/debug', require('./routes/debug'));
// 添加API通用路由
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);
// 添加文生视频路由
app.use('/api/text-to-video', textToVideoRoutes);
// 添加图生视频路由映射 - 将/api/image-to-video请求转发到textToVideo路由
app.use('/api/image-to-video', textToVideoRoutes);
// 添加数字人任务路由
app.use('/api/digital-human', digitalHumanTasksRoutes);
// 添加图像编辑路由
app.use('/api/image-edit', imageEditRoutes);
// 添加通义千问图像编辑路由
app.use('/api/qwen-image-edit', qwenImageEditRoutes);
// 添加图像编辑历史记录路由（简化版）
app.use('/api/image-edit-history-simple', require('./routes/image-edit-history-simple'));
// 添加OSS存储管理路由
app.use('/api/oss', require('./routes/ossManagement'));
// 添加文生图片路由
app.use('/api/text-to-image', textToImageRoutes);

// 文生图片历史记录API路由
const textToImageHistoryRouter = require('./routes/text-to-image-history');
app.use('/api/text-to-image/history', textToImageHistoryRouter);
console.log('已注册文生图片历史记录API路由: /api/text-to-image/history');

// 文生图片OSS历史记录API路由
const textToImageHistoryOSSRouter = require('./routes/text-to-image-history-oss');
app.use('/api/text-to-image/history-oss', textToImageHistoryOSSRouter);
console.log('已注册文生图片OSS历史记录API路由: /api/text-to-image/history-oss');

// 添加图片代理路由 - 已迁移到OSS，暂时注释
const proxyImageHandler = require('./routes/proxy-image');
app.use('/api/proxy-image', proxyImageHandler);

// 添加OSS STS Token路由
const stsTokenRouter = require('./api/oss/sts-token');
app.use('/api/oss', stsTokenRouter);
console.log('已注册OSS STS Token API路由: /api/oss/sts-token');

// 添加退款路由
app.use('/api/refund', require('./routes/refund'));
// 添加图像高清放大路由
app.use('/api/upscale', require('./routes/upscale'));
// 添加阿里云API路由
app.use('/api/aliyun', require('./routes/aliyun-api'));
// 人脸融合API路由
app.use('/api/face-fusion', faceFusionRoutes);
// 添加视频换人路由
app.use('/api/video-face-swap', require('./routes/videoFaceSwap'));
// 添加视频换脸路由（通用视频人脸融合）
app.use('/api/video-face-fusion', require('./routes/videoFaceFusion'));

// 视频去水印/logo功能路由
// 使用优化版本的视频去标志路由
app.use('/api/video-logo-removal', require('./routes/videoLogoRemovalOptimized'));
// 视频去标志功能状态查询路由
app.use('/api/video-logo-removal-status', require('./routes/videoLogoRemovalStatus'));

// 🔄 添加任务状态同步管理接口
app.get('/api/admin/task-sync/status', protect, async (req, res) => {
  try {
    // 检查管理员权限
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '需要管理员权限'
      });
    }

    const taskStatusSyncService = require('./services/taskStatusSyncService');
    const status = taskStatusSyncService.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('获取任务同步服务状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取服务状态失败'
    });
  }
});

app.post('/api/admin/task-sync/manual', protect, async (req, res) => {
  try {
    // 检查管理员权限
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '需要管理员权限'
      });
    }

    const taskStatusSyncService = require('./services/taskStatusSyncService');
    const result = await taskStatusSyncService.manualSync();
    
    res.json({
      success: true,
      message: '手动同步完成',
      data: result
    });
  } catch (error) {
    console.error('手动同步失败:', error);
    res.status(500).json({
      success: false,
      message: '手动同步失败: ' + error.message
    });
  }
});

// 添加管理员系统路由 - 访问管理员页面
app.get('/admin', (req, res) => {
  res.redirect('/admin-login.html');
});

// 添加无扩展名URL支持 - 让用户可以访问 /home 而不需要 .html
const htmlPages = [
  'home',
  'login', 
  'register',
  'phone-login',
  'phone-register',
  'translate',
  'text-to-image',
  'cutout',
  'marketing-images',
  'scene-generator',
  'image-removal',
  'model-skin-changer',
  'clothing-simulation',
  'image-upscaler',
  'local-redraw',
  'image-colorization',
  'image-expansion',
  'cloth-segmentation',
  'global-style',
  'diantu',
  'text-to-video',
  'image-to-video',
  'multi-image-to-video',
  'video-style-repaint',
  'video-subtitle-remover',
  'digital-human-video',
  'download-center',
  'credits',
  'admin-login',
  'admin-dashboard'
];

// 为每个页面添加无扩展名路由
htmlPages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    const filePath = path.join(__dirname, `${page}.html`);
    // 检查文件是否存在
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      // 如果根目录没有，检查public目录
      const publicFilePath = path.join(__dirname, 'public', `${page}.html`);
      if (fs.existsSync(publicFilePath)) {
        res.sendFile(publicFilePath);
      } else {
        res.status(404).send('页面未找到');
      }
    }
  });
});

// 多图转视频API - 使用统一中间件和multer处理文件上传
app.post('/api/multi-image-to-video', protect, createUnifiedFeatureMiddleware('MULTI_IMAGE_TO_VIDEO'), memoryUpload.array('images', 40), async (req, res) => {
    try {
        console.log('收到多图转视频请求:', JSON.stringify(req.body, null, 2));
        console.log('上传的文件数量:', req.files ? req.files.length : 0);
        console.log('转场风格参数:', req.body.transition, '类型:', typeof req.body.transition);
        
        // 验证请求数据
        const { 
            sceneType: scene, 
            width, 
            height, 
            style, 
            transition, 
            duration, 
            durationAdaption, 
            smartEffect, 
            puzzleEffect, 
            mute,
            music 
        } = req.body;
        
        console.log('收到多图转视频请求，转场效果参数:', transition);
        
        // 检查上传的图片文件
        if (!req.files || req.files.length < 2) {
            return res.status(400).json({ success: false, message: '请至少提供2张图片' });
        }
        
        if (req.files.length > 40) {
            return res.status(400).json({ success: false, message: '图片数量不能超过40张' });
        }
        
        // 验证其他参数
        if (width && (width < 32 || width > 2160)) {
            return res.status(400).json({ success: false, message: '视频宽度应在32-2160范围内' });
        }
        
        if (height && (height < 32 || height > 2160)) {
            return res.status(400).json({ success: false, message: '视频高度应在32-2160范围内' });
        }
        
        if (duration && (duration < 5 || duration > 60)) {
            return res.status(400).json({ success: false, message: '视频时长应在5-60秒范围内' });
        }
        
        // 从统一中间件获取积分使用信息
        const userId = req.user.id;
        const { usageType, creditCost, isFree, taskId: unifiedTaskId } = req.featureUsage;
        
        // 使用统一中间件生成的任务ID
        const taskId = unifiedTaskId;
        console.log('使用统一中间件生成的任务ID:', taskId, '类型:', typeof taskId);
        
        // 计算最终积分：免费使用时为 0
        const creditCostFinal = isFree ? 0 : creditCost;
        
        // 继续处理请求
        
        // 准备API请求数据
        // 镜头转场风格映射 - 支持15种风格
        const transitionStyleMap = {
            'basic': 'basic',         // 无
            'slow': 'slow',           // 舒缓
            'fast': 'fast',           // 动感
            'normal': 'normal',       // 自然
            'ink': 'ink',             // 水墨
            'glitch': 'glitch',       // 机械故障
            'shift': 'shift',         // 切换
            'mosaic': 'mosaic',       // 马赛克
            'shutter': 'shutter',     // 百叶窗
            'zoom': 'zoom',           // 缩放
            'mask': 'mask',           // 遮罩
            'brush': 'brush',         // 笔刷
            'wind': 'wind',           // 风舞
            'smog': 'smog'            // 烟雾
        };
        
        // 所有可用的转场风格列表（用于随机选择）
        const availableTransitionStyles = [
            'basic', 'slow', 'fast', 'normal', 'ink', 'glitch', 
            'shift', 'mosaic', 'shutter', 'zoom', 'mask', 
            'brush', 'wind', 'smog'
        ];
        
        // 上传图片文件到OSS并构建文件列表
        const fileList = [];
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            try {
                // 上传文件到OSS
                const imageUrl = await uploadFileToOSS(file, 'multi-image-to-video');
                fileList.push({
                    Type: 'image',
                    FileUrl: imageUrl,
                    FileName: `image_${i}.jpg`
                });
            } catch (uploadError) {
                console.error(`上传第${i+1}张图片失败:`, uploadError);
                return res.status(500).json({ 
                    success: false, 
                    message: `上传第${i+1}张图片失败: ${uploadError.message}` 
                });
            }
        }
        
        // 如果有音乐文件，添加到文件列表
        if (music && music !== 'none') {
            // 如果是预设音乐，使用对应的URL
            // 这里假设预设音乐的值就是音乐文件的URL
            fileList.push({
                Type: 'audio',
                FileUrl: music,
                FileName: 'background_music.mp3'
            });
        }
        
        // 转场效果映射处理
        let mappedTransition;
        if (!transition || transition === '') {
            // 如果没有设置转场风格，则随机选择
            const randomIndex = Math.floor(Math.random() * availableTransitionStyles.length);
            mappedTransition = availableTransitionStyles[randomIndex];
            console.log(`未设置转场风格，随机选择: "${mappedTransition}"`);
        } else {
            // 使用用户选择的转场风格
            mappedTransition = transitionStyleMap[transition] || transition || 'normal';
            console.log(`转场效果映射: "${transition}" -> "${mappedTransition}"`);
        }
        
        console.log('可用的转场风格映射:', JSON.stringify(transitionStyleMap, null, 2));
        console.log('最终API参数中的转场风格:', mappedTransition);
        console.log('转场风格参数类型:', typeof transition, '值:', transition);
        
        // 设置API参数 - 根据阿里云视频增强API文档格式，使用大写参数名
        const requestData = {
            Scene: scene || 'general',        // 使用指定场景或默认为通用场景
            FileList: fileList,               // 文件列表
            Width: width || 1280,             // 设置默认输出分辨率
            Height: height || 720,
            Style: style || 'normal',         // 视频节奏：normal(普通)、fast(快)、slow(慢)
            Duration: parseInt(duration) || 10, // 计算总时长
            DurationAdaption: false, // 禁用自动调整时长，使用用户指定的时长
            TransitionStyle: mappedTransition, // 转场风格
            SmartEffect: smartEffect !== undefined ? smartEffect : true, // 启用智能特效
            PuzzleEffect: puzzleEffect || false, // 不使用动态拼图
            Mute: mute !== undefined ? mute : ((!music || music === 'none')) // 如果没有音乐则静音
        };
        
        console.log('准备调用阿里云API，参数:', JSON.stringify(requestData, null, 2));
        
        // 获取阿里云访问密钥
        const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID || '';
        const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET || '';
        if (!accessKeyId || !accessKeySecret) {
            return res.status(500).json({ success: false, message: '服务器配置错误：缺少阿里云访问密钥' });
        }
        
        // 检查是否有有效的阿里云访问密钥，决定是使用真实调用还是模拟调用
        const isValidApiKey = accessKeyId && accessKeyId.length > 10 && accessKeySecret && accessKeySecret.length > 10;
        
        // 声明aliCloudRequestId变量，用于后续判断
        let aliCloudRequestId = null;
        
        if (isValidApiKey) {
            try {
                console.log('使用真实API调用多图转视频服务');
                console.log('阿里云访问密钥ID:', accessKeyId.substring(0, 10) + '...');
                console.log('阿里云访问密钥Secret:', accessKeySecret.substring(0, 10) + '...');
                // 使用@alicloud/pop-core等SDK进行签名和调用
                const Core = require('@alicloud/pop-core');
                
                // 创建POP Core客户端
                const client = new Core({
                    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
                    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
                    endpoint: 'https://videoenhan.cn-shanghai.aliyuncs.com',
                    apiVersion: '2020-03-20'
                });
                
                // 调用生成视频API
                console.log('准备调用阿里云GenerateVideo API，参数详情:');
                console.log('- Scene:', requestData.Scene);
                console.log('- Width:', requestData.Width);
                console.log('- Height:', requestData.Height);
                console.log('- Style:', requestData.Style);
                console.log('- Duration:', requestData.Duration);
                console.log('- TransitionStyle:', requestData.TransitionStyle);
                console.log('- SmartEffect:', requestData.SmartEffect);
                console.log('- PuzzleEffect:', requestData.PuzzleEffect);
                console.log('- Mute:', requestData.Mute);
                console.log('- FileList数量:', requestData.FileList.length);
                
                const response = await client.request('GenerateVideo', requestData, {
                    method: 'POST'
                });
                
                console.log('阿里云API响应:', JSON.stringify(response, null, 2));
                
                // 检查API响应
                if (response && response.RequestId) {
                    aliCloudRequestId = response.RequestId;
                    console.log('从API响应获取阿里云RequestId:', aliCloudRequestId, '类型:', typeof aliCloudRequestId);
                    
                    // 保存阿里云RequestId到任务详情中
                    try {
                        const { saveTaskDetails } = require('./middleware/unifiedFeatureUsage');
                        await saveTaskDetails(req.featureUsage.usage, {
                            taskId: taskId,
                            creditCost: creditCostFinal,
                            isFree: isFree,
                            aliCloudRequestId: aliCloudRequestId, // 保存阿里云RequestId
                            extraData: {
                                description: '多图转视频',
                                imageCount: req.files.length,
                                duration: duration || 5,
                                // 🎯 保存视频参数，确保前端可以显示具体的转场风格、视频风格等信息
                                transition: mappedTransition,  // 保存实际使用的转场风格
                                style: style,
                                sceneType: scene
                            },
                            // 添加操作描述字段，用于在使用记录中显示
                            operationText: `处理${duration || 5}秒视频`
                        });
                        console.log(`阿里云RequestId已保存到任务详情: ${aliCloudRequestId}`);
                    } catch (saveError) {
                        console.error('保存阿里云RequestId失败:', saveError);
                    }
                } else {
                    console.error('API响应格式错误，缺少RequestId，响应:', JSON.stringify(response, null, 2));
                    throw new Error('API响应格式错误，缺少RequestId');
                }
            } catch (apiError) {
                console.error('调用多图转视频API失败:', apiError);
                console.error('API错误详情:', {
                    message: apiError.message,
                    code: apiError.code,
                    status: apiError.status,
                    data: apiError.data,
                    response: apiError.response?.data
                });
                
                // 准备错误信息
                const errorMessage = apiError.message || apiError.code || '调用阿里云API失败';
                const errorDetails = {
                    message: errorMessage,
                    code: apiError.code || 'API_ERROR',
                    status: apiError.status || 500,
                    details: apiError.data || {},
                    response: apiError.response?.data || {}
                };
                
                console.error('返回错误详情:', errorDetails);
                
                // 将错误信息保存到任务中
                try {
                    const { saveTaskDetails } = require('./middleware/unifiedFeatureUsage');
                    await saveTaskDetails(req.featureUsage.usage, {
                        taskId: taskId,
                        creditCost: creditCostFinal,
                        isFree: isFree,
                        status: 'FAILED',
                        error: errorMessage,
                        errorDetails: errorDetails,
                        extraData: {
                            description: '多图转视频',
                            imageCount: req.files.length,
                            duration: duration || 10
                        }
                    });
                    console.log(`错误信息已保存到任务详情: ${taskId}`);
                } catch (saveError) {
                    console.error('保存错误信息失败:', saveError);
                }
                
                return res.status(500).json({
                    success: false,
                    message: `视频生成失败: ${errorMessage}`,
                    error: errorMessage,
                    details: errorDetails,
                    taskId: taskId
                });
            }
        } else {
            // 本地测试模式
            console.log(`[测试模式] 使用统一任务ID: ${taskId}`);
            
            // 将任务数据保存到内存临时存储
            global.taskCache = global.taskCache || {};
            global.taskCache[taskId] = {
                createdAt: Date.now(),
                params: requestData,
                status: 'PENDING'
            };
            
            // 在测试模式下，模拟任务完成（延迟5秒）
            setTimeout(async () => {
                try {
                    console.log(`[测试模式] 模拟任务完成: ${taskId}`);
                    
                    // 模拟生成视频URL
                    const mockVideoUrl = `https://example.com/videos/multi-image-${taskId}.mp4`;
                    const mockCoverUrl = `https://example.com/covers/multi-image-${taskId}.jpg`;
                    
                    // 更新任务状态
                    if (global.taskCache[taskId]) {
                        global.taskCache[taskId].status = 'SUCCEEDED';
                        global.taskCache[taskId].videoUrl = mockVideoUrl;
                        global.taskCache[taskId].videoCoverUrl = mockCoverUrl;
                        global.taskCache[taskId].videoDuration = duration || 10;
                        global.taskCache[taskId].videoWidth = width || 1280;
                        global.taskCache[taskId].videoHeight = height || 720;
                        global.taskCache[taskId].completedAt = new Date().toISOString();
                    }
                    
                    // 更新数据库中的任务状态
                    const { FeatureUsage } = require('./models/FeatureUsage');
                    const tasks = await FeatureUsage.findAll({
                        where: {
                            userId: userId,
                            featureName: 'MULTI_IMAGE_TO_VIDEO'
                        }
                    });
                    
                    for (const task of tasks) {
                        if (task.details) {
                            try {
                                const taskDetails = JSON.parse(task.details);
                                if (taskDetails.tasks && Array.isArray(taskDetails.tasks)) {
                                    const foundTask = taskDetails.tasks.find(t => t.taskId === taskId);
                                    if (foundTask) {
                                        foundTask.status = 'SUCCEEDED';
                                        foundTask.videoUrl = mockVideoUrl;
                                        foundTask.videoCoverUrl = mockCoverUrl;
                                        foundTask.videoDuration = duration || 5;
                                        foundTask.videoWidth = width || 1280;
                                        foundTask.videoHeight = height || 720;
                                        foundTask.completedAt = new Date().toISOString();
                                        
                                        await FeatureUsage.update(
                                            { details: JSON.stringify(taskDetails) },
                                            { where: { id: task.id } }
                                        );
                                        
                                        console.log(`[测试模式] 任务状态已更新到数据库: ${taskId}`);
                                        break;
                                    }
                                }
                            } catch (e) {
                                console.error('更新测试任务状态失败:', e);
                            }
                        }
                    }
                    
                } catch (error) {
                    console.error('[测试模式] 模拟任务完成失败:', error);
                }
            }, 5000); // 5秒后模拟完成
        }
        
        // 保存任务信息到全局变量，用于积分统计
        if (!global.multiImageToVideoTasks) {
            global.multiImageToVideoTasks = {};
        }
        
        // 记录用户的任务信息
        global.multiImageToVideoTasks[taskId] = {
            userId: userId,
            creditCost: creditCostFinal,
            hasChargedCredits: false, // 修复：始终标记为未扣费，确保任务完成后会扣费
            timestamp: new Date(),
            imageCount: req.files.length,
            duration: duration || 5,
            description: '多图转视频',
            taskId: taskId,
            isFree: isFree
        };
        
        console.log(`多图转视频任务信息已保存: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCostFinal}, 是否免费=${isFree}`);
        
        // 创建任务对象用于OSS存储
        const taskForOSS = {
            id: taskId,
            status: 'PENDING',
            videoUrl: null,
            videoCoverUrl: null,
            videoDuration: null,
            videoWidth: width || 1280,
            videoHeight: height || 720,
            imageCount: req.files.length,
            duration: duration || 5,
            sceneType: scene,
            style: style,
            transition: mappedTransition, // 🔧 修复：保存实际使用的转场风格，而不是用户选择的原始值
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            creditCost: creditCostFinal,
            isFree: isFree
        };
        
        // 保存任务到OSS存储
        try {
            await addMultiImageToVideoTaskToOSS(userId, taskForOSS);
            console.log(`多图转视频任务ID=${taskId}已保存到OSS存储`);
        } catch (ossError) {
            console.error('保存任务到OSS失败:', ossError);
            // 继续处理，不影响主要功能
        }
        
        // 使用统一中间件的saveTaskDetails函数保存任务详情（仅在第一次保存失败时执行）
        // 如果阿里云API调用成功，任务详情已经在上面保存过了，这里不需要重复保存
        if (!aliCloudRequestId) {
            try {
                const { saveTaskDetails } = require('./middleware/unifiedFeatureUsage');
                await saveTaskDetails(req.featureUsage.usage, {
                    taskId: taskId,
                    creditCost: creditCostFinal,
                    isFree: isFree,
                    extraData: {
                        description: '多图转视频',
                        imageCount: req.files.length,
                        duration: duration || 10
                    }
                });
                console.log(`多图转视频任务ID=${taskId}已通过统一中间件保存到数据库（降级模式）`);
            } catch (dbError) {
                console.error('通过统一中间件保存任务信息失败:', dbError);
                // 继续处理，不影响主要功能
            }
        } else {
            console.log(`多图转视频任务ID=${taskId}已通过阿里云API保存到数据库，跳过重复保存`);
        }
        
        // 返回任务ID给前端
        console.log('返回给前端的taskId:', taskId, '类型:', typeof taskId);
        return res.json({
            success: true,
            taskId: taskId,
            message: '任务提交成功，正在处理中'
        });
        
    } catch (error) {
        console.error('多图转视频API错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器内部错误',
            path: '/api/multi-image-to-video'
        });
    }
});

// 获取多图转视频任务列表（从OSS存储）
app.get('/api/multi-image-to-video/tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`获取多图转视频任务列表: userId=${userId}`);
    
    // 从OSS加载任务列表
    const tasks = await loadMultiImageToVideoTasksFromOSS(userId);
    
    console.log(`从OSS找到 ${tasks.length} 个多图转视频任务`);
    
    res.json({
      success: true,
      data: tasks
    });
    
  } catch (error) {
    console.error('获取多图转视频任务列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取任务列表失败',
      error: error.message
    });
  }
});

// ==================== 多图转视频OSS存储相关函数 ====================

// OSS存储相关函数
const { client } = require('./utils/ossService');

/**
 * 从OSS加载多图转视频任务列表
 * @param {string} userId - 用户ID
 * @returns {Promise<Array>} 任务列表
 */
async function loadMultiImageToVideoTasksFromOSS(userId) {
    try {
        const ossPath = `multi-image-to-video/tasks/${userId}/tasks.json`;
        
        console.log(`从OSS加载多图转视频任务列表: ${ossPath}`);
        
        // 尝试从OSS获取任务列表
        const result = await client.get(ossPath);
        const tasksData = JSON.parse(result.content.toString());
        
        console.log(`从OSS加载到 ${tasksData.length} 个多图转视频任务`);
        return tasksData;
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            console.log('OSS中不存在多图转视频任务文件，返回空数组');
            return [];
        }
        console.error('从OSS加载多图转视频任务列表失败:', error);
        throw error;
    }
}

/**
 * 保存多图转视频任务列表到OSS
 * @param {string} userId - 用户ID
 * @param {Array} tasks - 任务列表
 * @returns {Promise<void>}
 */
async function saveMultiImageToVideoTasksToOSS(userId, tasks) {
    try {
        const ossPath = `multi-image-to-video/tasks/${userId}/tasks.json`;
        
        console.log(`保存多图转视频任务列表到OSS: ${ossPath}, 任务数量: ${tasks.length}`);
        
        // 过滤24小时内的任务
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const recentTasks = tasks.filter(task => {
            const taskTime = new Date(task.createdAt);
            return taskTime >= twentyFourHoursAgo;
        });
        
        // 按创建时间降序排序，确保最新的任务在前面
        const sortedTasks = recentTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // 只保存最新的1个任务，符合显示要求
        const tasksToSave = sortedTasks.slice(0, 1);
        
        console.log(`过滤后24小时内多图转视频任务: ${recentTasks.length} 个，保存最新: ${tasksToSave.length} 个`);
        
        const tasksJson = JSON.stringify(tasksToSave, null, 2);
        
        await client.put(ossPath, Buffer.from(tasksJson, 'utf8'), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`多图转视频任务列表已保存到OSS: ${ossPath}`);
    } catch (error) {
        console.error('保存多图转视频任务列表到OSS失败:', error);
        throw error;
    }
}

/**
 * 添加多图转视频任务到OSS存储
 * @param {string} userId - 用户ID
 * @param {Object} task - 任务对象
 * @returns {Promise<void>}
 */
async function addMultiImageToVideoTaskToOSS(userId, task) {
    try {
        // 先加载现有任务
        const existingTasks = await loadMultiImageToVideoTasksFromOSS(userId);
        
        // 添加新任务到开头
        existingTasks.unshift(task);
        
        // 保存更新后的任务列表（会自动过滤24小时内的任务并只保存最新1条）
        await saveMultiImageToVideoTasksToOSS(userId, existingTasks);
        
        console.log(`多图转视频任务已添加到OSS: ${task.id}`);
    } catch (error) {
        console.error('添加多图转视频任务到OSS失败:', error);
        throw error;
    }
}

/**
 * 更新OSS中的多图转视频任务
 * @param {string} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {Object} updates - 更新内容
 * @returns {Promise<void>}
 */
async function updateMultiImageToVideoTaskInOSS(userId, taskId, updates) {
    try {
        // 先加载现有任务
        const existingTasks = await loadMultiImageToVideoTasksFromOSS(userId);
        
        // 如果OSS中没有任务（可能已被用户清空），则不进行更新
        if (existingTasks.length === 0) {
            console.log(`OSS中无任务记录，跳过更新任务: ${taskId}（可能已被用户清空）`);
            return;
        }
        
        // 找到并更新任务
        const taskIndex = existingTasks.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
            existingTasks[taskIndex] = { ...existingTasks[taskIndex], ...updates };
            
            // 保存更新后的任务列表
            await saveMultiImageToVideoTasksToOSS(userId, existingTasks);
            
            console.log(`多图转视频任务已更新到OSS: ${taskId}`);
        } else {
            console.warn(`未找到要更新的多图转视频任务: ${taskId}`);
        }
    } catch (error) {
        console.error('更新多图转视频任务到OSS失败:', error);
        throw error;
    }
}

/**
 * 从OSS删除多图转视频任务
 * @param {string} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @returns {Promise<void>}
 */
async function deleteMultiImageToVideoTaskFromOSS(userId, taskId) {
    try {
        // 先加载现有任务
        const existingTasks = await loadMultiImageToVideoTasksFromOSS(userId);
        
        // 过滤掉要删除的任务
        const filteredTasks = existingTasks.filter(task => task.id !== taskId);
        
        // 保存更新后的任务列表
        await saveMultiImageToVideoTasksToOSS(userId, filteredTasks);
        
        console.log(`多图转视频任务已从OSS删除: ${taskId}`);
    } catch (error) {
        console.error('从OSS删除多图转视频任务失败:', error);
        throw error;
    }
}

// ==================== 视频风格重绘OSS存储相关函数 ====================

/**
 * 从OSS加载视频风格重绘任务列表
 * @param {string} userId - 用户ID
 * @returns {Promise<Array>} 任务列表
 */
async function loadVideoStyleRepaintTasksFromOSS(userId) {
    try {
        const ossPath = `video-style-repaint/tasks/${userId}/tasks.json`;
        
        console.log(`从OSS加载视频风格重绘任务列表: ${ossPath}`);
        
        // 尝试从OSS获取任务列表
        const result = await client.get(ossPath);
        const tasksData = JSON.parse(result.content.toString());
        
        console.log(`从OSS加载到 ${tasksData.length} 个视频风格重绘任务`);
        return tasksData;
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            console.log('OSS中不存在视频风格重绘任务文件，返回空数组');
            return [];
        }
        console.error('从OSS加载视频风格重绘任务列表失败:', error);
        throw error;
    }
}

/**
 * 保存视频风格重绘任务列表到OSS
 * @param {string} userId - 用户ID
 * @param {Array} tasks - 任务列表
 * @returns {Promise<void>}
 */
async function saveVideoStyleRepaintTasksToOSS(userId, tasks) {
    try {
        const ossPath = `video-style-repaint/tasks/${userId}/tasks.json`;
        
        console.log(`保存视频风格重绘任务列表到OSS: ${ossPath}, 任务数量: ${tasks.length}`);
        
        // 过滤24小时内的任务
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const recentTasks = tasks.filter(task => {
            const taskTime = new Date(task.createdAt);
            return taskTime >= twentyFourHoursAgo;
        });
        
        // 按创建时间降序排序，确保最新的任务在前面
        const sortedTasks = recentTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // 保存所有24小时内的任务（不限制数量，与多图转视频不同）
        const tasksToSave = sortedTasks;
        
        console.log(`保存 ${tasksToSave.length} 个视频风格重绘任务到OSS`);
        
        // 保存到OSS
        const tasksJson = JSON.stringify(tasksToSave, null, 2);
        await client.put(ossPath, Buffer.from(tasksJson, 'utf8'), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`视频风格重绘任务列表已保存到OSS: ${ossPath}`);
    } catch (error) {
        console.error('保存视频风格重绘任务列表到OSS失败:', error);
        throw error;
    }
}

/**
 * 添加视频风格重绘任务到OSS存储
 * @param {string} userId - 用户ID
 * @param {Object} task - 任务对象
 * @returns {Promise<void>}
 */
async function addVideoStyleRepaintTaskToOSS(userId, task) {
    try {
        // 先加载现有任务
        const existingTasks = await loadVideoStyleRepaintTasksFromOSS(userId);
        
        // 添加新任务到开头
        existingTasks.unshift(task);
        
        // 保存更新后的任务列表
        await saveVideoStyleRepaintTasksToOSS(userId, existingTasks);
        
        console.log(`视频风格重绘任务已添加到OSS: ${task.taskId}`);
    } catch (error) {
        console.error('添加视频风格重绘任务到OSS失败:', error);
        throw error;
    }
}

/**
 * 更新OSS中的视频风格重绘任务
 * @param {string} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {Object} updates - 更新内容
 * @returns {Promise<void>}
 */
async function updateVideoStyleRepaintTaskInOSS(userId, taskId, updates) {
    try {
        // 先加载现有任务
        const existingTasks = await loadVideoStyleRepaintTasksFromOSS(userId);
        
        // 如果OSS中没有任务，可能是创建时保存失败，创建一个基础的任务记录
        if (existingTasks.length === 0) {
            console.log(`OSS中无任务记录，为任务${taskId}创建基础记录`);
            const baseTask = {
                taskId: taskId,
                status: 'PENDING',
                prompt: updates.prompt || '',
                style: updates.style || 0,
                videoUrl: '',
                originalVideoUrl: updates.originalVideoUrl || '',
                quality: updates.quality || '540P',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isFree: updates.isFree || false
            };
            existingTasks.push(baseTask);
        }
        
        // 找到并更新任务
        const taskIndex = existingTasks.findIndex(task => task.taskId === taskId);
        if (taskIndex !== -1) {
            existingTasks[taskIndex] = { ...existingTasks[taskIndex], ...updates };
            
            // 保存更新后的任务列表
            await saveVideoStyleRepaintTasksToOSS(userId, existingTasks);
            
            console.log(`视频风格重绘任务已更新到OSS: ${taskId}`);
        } else {
            console.warn(`未找到要更新的视频风格重绘任务: ${taskId}，需要创建新记录`);
            // 如果仍然找不到任务，创建一个新的记录
            // 从数据库获取更完整的任务信息
            let taskInfoFromDB = {};
            try {
                const featureUsage = await FeatureUsage.findOne({
                    where: {
                        userId: userId,
                        featureName: 'VIDEO_STYLE_REPAINT'
                    },
                    order: [['lastUsedAt', 'DESC']]
                });
                
                if (featureUsage && featureUsage.details) {
                    const details = JSON.parse(featureUsage.details);
                    // 检查是否是当前任务
                    if (details.tasks && details.tasks.find(t => t.taskId === taskId)) {
                        taskInfoFromDB = {
                            prompt: details.prompt || '',
                            style: details.style || 0,
                            originalVideoUrl: details.originalVideoUrl || '',
                            quality: details.quality || `${details.min_len || details.resolution || 540}P`,
                            isFree: details.isFree || false
                        };
                        console.log(`从数据库获取任务 ${taskId} 的详细信息:`, taskInfoFromDB);
                    }
                }
            } catch (dbError) {
                console.error('从数据库获取任务信息失败:', dbError);
            }
            
            const newTask = {
                taskId: taskId,
                status: updates.status || 'PENDING',
                prompt: updates.prompt || taskInfoFromDB.prompt || '',
                style: updates.style || taskInfoFromDB.style || 0,
                videoUrl: updates.videoUrl || '',
                originalVideoUrl: updates.originalVideoUrl || taskInfoFromDB.originalVideoUrl || '',
                quality: updates.quality || taskInfoFromDB.quality || '540P',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isFree: updates.isFree || taskInfoFromDB.isFree || false,
                ...updates
            };
            existingTasks.unshift(newTask); // 添加到开头
            
            // 保存任务列表
            await saveVideoStyleRepaintTasksToOSS(userId, existingTasks);
            
            console.log(`视频风格重绘任务已创建并保存到OSS: ${taskId}`);
        }
    } catch (error) {
        console.error('更新视频风格重绘任务到OSS失败:', error);
        throw error;
    }
}

/**
 * 从OSS删除视频风格重绘任务
 * @param {string} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @returns {Promise<void>}
 */
async function deleteVideoStyleRepaintTaskFromOSS(userId, taskId) {
    try {
        // 先加载现有任务
        const existingTasks = await loadVideoStyleRepaintTasksFromOSS(userId);
        
        // 过滤掉要删除的任务
        const filteredTasks = existingTasks.filter(task => task.taskId !== taskId);
        
        // 保存更新后的任务列表
        await saveVideoStyleRepaintTasksToOSS(userId, filteredTasks);
        
        console.log(`视频风格重绘任务已从OSS删除: ${taskId}`);
    } catch (error) {
        console.error('从OSS删除视频风格重绘任务失败:', error);
        throw error;
    }
}

// ==================== 视频风格重绘任务管理API ====================

// 调试API：获取数据库中的视频风格重绘任务记录
app.get('/api/debug/video-style-repaint/db-tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`调试：获取数据库中的视频风格重绘任务记录: userId=${userId}`);
    
    // 查询数据库中的FeatureUsage记录
    const featureUsage = await FeatureUsage.findAll({
      where: {
        userId: userId,
        featureName: 'VIDEO_STYLE_REPAINT'
      },
      order: [['lastUsedAt', 'DESC']],
      limit: 10
    });
    
    const dbTasks = featureUsage.map(record => {
      let details = {};
      try {
        details = JSON.parse(record.details || '{}');
      } catch (e) {
        details = { parseError: true };
      }
      
      return {
        id: record.id,
        userId: record.userId,
        usageCount: record.usageCount,
        lastUsedAt: record.lastUsedAt,
        credits: record.credits,
        details: details
      };
    });
    
    console.log(`从数据库找到 ${dbTasks.length} 条视频风格重绘记录`);
    
    res.json({
      success: true,
      count: dbTasks.length,
      data: dbTasks
    });
    
  } catch (error) {
    console.error('获取数据库任务记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取数据库任务记录失败',
      error: error.message
    });
  }
});

// 修复API：将数据库中的完成任务同步到OSS存储
app.post('/api/debug/video-style-repaint/fix-missing-tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`开始修复缺失的视频风格重绘任务: userId=${userId}`);
    
    // 1. 获取数据库中的任务记录
    const featureUsage = await FeatureUsage.findAll({
      where: {
        userId: userId,
        featureName: 'VIDEO_STYLE_REPAINT'
      },
      order: [['lastUsedAt', 'DESC']],
      limit: 50 // 最多处理最近50条记录
    });
    
    console.log(`从数据库找到 ${featureUsage.length} 条记录`);
    
    // 2. 获取OSS中现有的任务
    const existingTasks = await loadVideoStyleRepaintTasksFromOSS(userId);
    const existingTaskIds = new Set(existingTasks.map(task => task.taskId));
    
    console.log(`OSS中已有 ${existingTasks.length} 个任务`);
    
    // 3. 找到需要同步的任务
    const tasksToSync = [];
    
    for (const record of featureUsage) {
      try {
        const details = JSON.parse(record.details || '{}');
        const tasks = details.tasks || [];
        
        // 如果有多个任务，处理每一个
        if (tasks.length > 0) {
          for (const task of tasks) {
            if (task.taskId && !existingTaskIds.has(task.taskId)) {
              // 这是一个缺失的任务，需要同步
              const taskForOSS = {
                taskId: task.taskId,
                status: 'SUCCEEDED', // 假设数据库中的任务都是已完成的
                prompt: details.prompt || `风格${task.style || 0}`,
                style: task.style || 0,
                videoUrl: '', // 需要从阿里云API查询
                originalVideoUrl: '',
                quality: `${task.min_len || task.resolution || 540}P`,
                createdAt: task.timestamp || record.lastUsedAt,
                updatedAt: new Date().toISOString(),
                isFree: task.isFree || false
              };
              
              tasksToSync.push(taskForOSS);
            }
          }
        }
      } catch (parseError) {
        console.error('解析任务详情失败:', parseError);
        continue;
      }
    }
    
    console.log(`找到 ${tasksToSync.length} 个需要同步的任务`);
    
    // 4. 查询每个任务的状态并同步到OSS
    let syncedCount = 0;
    let failedCount = 0;
    
    for (const task of tasksToSync) {
      try {
        // 查询任务状态以获取结果URL
        console.log(`查询任务状态: ${task.taskId}`);
        
        const statusResponse = await axios.get(
          `https://dashscope.aliyuncs.com/api/v1/tasks/${task.taskId}`,
          {
            headers: {
              'Authorization': `Bearer ${DASHSCOPE_API_KEY}`
            }
          }
        );
        
        if (statusResponse.data.output?.task_status === 'SUCCEEDED') {
          // 提取视频URL
          const possibleUrls = [
            statusResponse.data.output?.result_url,
            statusResponse.data.output?.result_video_url,
            statusResponse.data.output?.video_url,
            statusResponse.data.output?.output_url,
            statusResponse.data.output?.url,
            statusResponse.data.output?.result?.url,
            statusResponse.data.output?.result?.video_url,
            statusResponse.data.output?.video?.url,
            statusResponse.data.output?.output?.url,
            statusResponse.data.output?.output?.video_url,
            statusResponse.data.output?.video_urls?.[0],
            statusResponse.data.output?.result_urls?.[0]
          ];
          
          const videoUrl = possibleUrls.find(url => url && url.trim()) || '';
          
          if (videoUrl) {
            task.videoUrl = videoUrl;
            task.status = 'SUCCEEDED';
          } else {
            task.status = 'FAILED';
            task.errorMessage = '未找到结果视频URL';
          }
        } else if (statusResponse.data.output?.task_status === 'FAILED') {
          task.status = 'FAILED';
          task.errorMessage = statusResponse.data.output?.message || '任务执行失败';
        } else {
          // 任务可能还在进行中，跳过
          console.log(`任务 ${task.taskId} 状态为 ${statusResponse.data.output?.task_status}，跳过同步`);
          continue;
        }
        
        // 将任务添加到OSS
        await addVideoStyleRepaintTaskToOSS(userId, task);
        syncedCount++;
        console.log(`✅ 任务 ${task.taskId} 同步成功`);
        
      } catch (error) {
        console.error(`❌ 同步任务 ${task.taskId} 失败:`, error.message);
        failedCount++;
      }
    }
    
    console.log(`修复完成: 成功同步 ${syncedCount} 个任务，失败 ${failedCount} 个任务`);
    
    res.json({
      success: true,
      message: `修复完成: 成功同步 ${syncedCount} 个任务，失败 ${failedCount} 个任务`,
      syncedCount,
      failedCount,
      totalFound: tasksToSync.length
    });
    
  } catch (error) {
    console.error('修复缺失任务失败:', error);
    res.status(500).json({
      success: false,
      message: '修复缺失任务失败',
      error: error.message
    });
  }
});

// 获取视频风格重绘任务列表（从OSS存储）
app.get('/api/video-style-repaint/tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`获取视频风格重绘任务列表: userId=${userId}`);
    
    // 从OSS加载任务列表
    const tasks = await loadVideoStyleRepaintTasksFromOSS(userId);
    
    // 过滤24小时内的任务
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentTasks = tasks.filter(task => {
      const taskTime = new Date(task.createdAt);
      return taskTime >= twentyFourHoursAgo;
    });
    
    // 按创建时间降序排序
    recentTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 去重：同一taskId只保留最新的记录（状态为SUCCEEDED的优先）
    const uniqueTasks = [];
    const seenTaskIds = new Set();
    
    for (const task of recentTasks) {
      if (!seenTaskIds.has(task.taskId)) {
        seenTaskIds.add(task.taskId);
        uniqueTasks.push(task);
      } else {
        // 如果已经有这个taskId，检查是否当前任务状态更好
        const existingIndex = uniqueTasks.findIndex(t => t.taskId === task.taskId);
        const existingTask = uniqueTasks[existingIndex];
        
        // 如果当前任务是SUCCEEDED而现有任务不是，则替换
        if (task.status === 'SUCCEEDED' && existingTask.status !== 'SUCCEEDED') {
          uniqueTasks[existingIndex] = task;
        }
      }
    }
    
    console.log(`从OSS找到 ${tasks.length} 个任务，24小时内 ${recentTasks.length} 个，去重后 ${uniqueTasks.length} 个`);
    
    res.json({
      success: true,
      data: uniqueTasks
    });
    
  } catch (error) {
    console.error('获取视频风格重绘任务列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取任务列表失败',
      error: error.message
    });
  }
});

// 内部修复接口 - 为视频风格重绘任务添加videoUrl
app.post('/internal/fix-video-style-repaint-task', protect, async (req, res) => {
  try {
    const { userId, taskId, videoUrl } = req.body;
    
    if (!userId || !taskId || !videoUrl) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: userId, taskId, videoUrl'
      });
    }
    
    console.log(`内部修复视频风格重绘任务: userId=${userId}, taskId=${taskId}`);
    
    // 更新OSS中的任务
    const taskUpdates = {
      videoUrl: videoUrl,
      updatedAt: new Date().toISOString()
    };
    
    await updateVideoStyleRepaintTaskInOSS(userId, taskId, taskUpdates);
    
    console.log(`任务 ${taskId} 的videoUrl已更新为: ${videoUrl}`);
    
    res.json({
      success: true,
      message: '任务videoUrl修复成功',
      taskId: taskId,
      videoUrl: videoUrl
    });
    
  } catch (error) {
    console.error('内部修复任务失败:', error);
    res.status(500).json({
      success: false,
      message: '修复任务失败',
      error: error.message
    });
  }
});

// 清空所有视频风格重绘任务
app.delete('/api/video-style-repaint/tasks/clear-all', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`清空所有视频风格重绘任务: userId=${userId}`);
    
    // 1. 直接删除OSS中的任务文件
    const ossPath = `video-style-repaint/tasks/${userId}/tasks.json`;
    
    try {
      await client.delete(ossPath);
      console.log(`OSS任务文件已删除: ${ossPath}`);
    } catch (ossError) {
      if (ossError.code === 'NoSuchKey') {
        console.log('OSS中不存在视频风格重绘任务文件');
      } else {
        console.error('删除OSS任务文件失败:', ossError);
      }
    }
    
    // 2. 清空FeatureUsage表中的视频风格重绘记录
    try {
      const { FeatureUsage } = require('./models/FeatureUsage');
      await FeatureUsage.destroy({
        where: {
          userId: userId,
          featureName: 'VIDEO_STYLE_REPAINT'
        }
      });
      console.log('数据库中的视频风格重绘记录已清空');
    } catch (dbError) {
      console.error('清空数据库记录失败:', dbError);
    }
    
    res.json({
      success: true,
      message: '所有视频风格重绘任务已清空'
    });
    
  } catch (error) {
    console.error('清空视频风格重绘任务失败:', error);
    res.status(500).json({
      success: false,
      message: '清空任务失败',
      error: error.message
    });
  }
});

// 删除指定视频风格重绘任务
app.delete('/api/video-style-repaint/tasks/:taskId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    
    console.log(`删除视频风格重绘任务: userId=${userId}, taskId=${taskId}`);
    
    // 从OSS删除任务
    await deleteVideoStyleRepaintTaskFromOSS(userId, taskId);
    
    res.json({
      success: true,
      message: '任务删除成功'
    });
    
  } catch (error) {
    console.error('删除视频风格重绘任务失败:', error);
    res.status(500).json({
      success: false,
      message: '删除任务失败',
      error: error.message
    });
  }
});

// 清理过期视频风格重绘任务
app.post('/api/video-style-repaint/tasks/cleanup', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`清理过期视频风格重绘任务: userId=${userId}`);
    
    // 加载现有任务
    const existingTasks = await loadVideoStyleRepaintTasksFromOSS(userId);
    
    // 重新保存任务列表（会自动过滤24小时内的任务）
    await saveVideoStyleRepaintTasksToOSS(userId, existingTasks);
    
    res.json({
      success: true,
      message: '过期任务清理完成'
    });
    
  } catch (error) {
    console.error('清理视频风格重绘任务失败:', error);
    res.status(500).json({
      success: false,
      message: '清理任务失败',
      error: error.message
    });
  }
});

// 清空所有多图转视频任务 - 必须放在 :taskId 路由之前，避免路由冲突
app.delete('/api/multi-image-to-video/tasks/clear-all', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`清空所有多图转视频任务: userId=${userId}`);
    
    // 1. 直接删除OSS中的任务文件
    const ossPath = `multi-image-to-video/tasks/${userId}/tasks.json`;
    
    try {
      await client.delete(ossPath);
      console.log(`已删除OSS任务文件: ${ossPath}`);
    } catch (deleteError) {
      if (deleteError.code === 'NoSuchKey') {
        console.log('OSS任务文件不存在，无需删除');
      } else {
        throw deleteError;
      }
    }
    
    // 2. 清空数据库中的任务记录，防止任务完成回调重新生成
    try {
      const { FeatureUsage } = require('./models/FeatureUsage');
      
      // 查找用户的多图转视频功能使用记录
      const usage = await FeatureUsage.findOne({
        where: {
          userId: userId,
          featureName: 'MULTI_IMAGE_TO_VIDEO'
        }
      });
      
      if (usage && usage.details) {
        // 清空任务详情，但保留使用次数等其他信息
        const details = JSON.parse(usage.details);
        details.tasks = []; // 清空任务列表
        
        usage.details = JSON.stringify(details);
        await usage.save();
        
        console.log(`已清空数据库中的多图转视频任务记录: userId=${userId}`);
      } else {
        console.log(`未找到用户的多图转视频功能使用记录: userId=${userId}`);
      }
    } catch (dbError) {
      console.error('清空数据库任务记录失败:', dbError);
      // 不抛出错误，因为OSS已经清空成功
    }
    
    // 3. 清空全局任务缓存（如果存在）
    if (global.multiImageToVideoTasks) {
      const userTaskIds = Object.keys(global.multiImageToVideoTasks).filter(taskId => 
        global.multiImageToVideoTasks[taskId].userId === userId
      );
      
      userTaskIds.forEach(taskId => {
        delete global.multiImageToVideoTasks[taskId];
      });
      
      console.log(`已清空全局任务缓存中的 ${userTaskIds.length} 个任务`);
    }
    
    res.json({
      success: true,
      message: '所有任务已彻底清空'
    });
    
  } catch (error) {
    console.error('清空多图转视频任务失败:', error);
    res.status(500).json({
      success: false,
      message: '清空任务失败',
      error: error.message
    });
  }
});

// 删除指定多图转视频任务
app.delete('/api/multi-image-to-video/tasks/:taskId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    
    console.log(`删除多图转视频任务: userId=${userId}, taskId=${taskId}`);
    
    // 从OSS删除任务
    await deleteMultiImageToVideoTaskFromOSS(userId, taskId);
    
    res.json({
      success: true,
      message: '任务删除成功'
    });
    
  } catch (error) {
    console.error('删除多图转视频任务失败:', error);
    res.status(500).json({
      success: false,
      message: '删除任务失败',
      error: error.message
    });
  }
});

// 清理过期多图转视频任务
app.post('/api/multi-image-to-video/tasks/cleanup', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`清理过期多图转视频任务: userId=${userId}`);
    
    // 加载现有任务
    const existingTasks = await loadMultiImageToVideoTasksFromOSS(userId);
    
    // 重新保存任务列表（会自动过滤24小时内的任务）
    await saveMultiImageToVideoTasksToOSS(userId, existingTasks);
    
    res.json({
      success: true,
      message: '过期任务清理完成'
    });
    
  } catch (error) {
    console.error('清理多图转视频任务失败:', error);
    res.status(500).json({
      success: false,
      message: '清理任务失败',
      error: error.message
    });
  }
});

// 清空多图转视频任务（兼容旧接口）
app.delete('/api/multi-image-to-video/tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`清空多图转视频任务: userId=${userId}`);
    
    // 从统一功能使用记录中删除任务
    const { FeatureUsage } = require('./models/FeatureUsage');
    const deletedCount = await FeatureUsage.destroy({
      where: {
        userId: userId,
        featureName: 'MULTI_IMAGE_TO_VIDEO'
      }
    });
    
    console.log(`已删除 ${deletedCount} 个多图转视频任务`);
    
    res.json({
      success: true,
      message: `已清空 ${deletedCount} 个任务`,
      deletedCount: deletedCount
    });
    
  } catch (error) {
    console.error('清空多图转视频任务失败:', error);
    res.status(500).json({
      success: false,
      message: '清空任务失败',
      error: error.message
    });
  }
});

// 查询多图转视频任务状态
app.get('/api/multi-image-to-video/status/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    
    console.log(`查询多图转视频任务状态: taskId=${taskId}, userId=${userId}`);
    
    // 从统一功能使用记录中查找任务
    const { FeatureUsage } = require('./models/FeatureUsage');
    const tasks = await FeatureUsage.findAll({
      where: {
        userId: userId,
        featureName: 'MULTI_IMAGE_TO_VIDEO'
      }
    });
    
    // 在任务详情中查找匹配的任务ID
    let task = null;
    for (const t of tasks) {
      if (t.details) {
        try {
          const taskDetails = JSON.parse(t.details);
          if (taskDetails.tasks && Array.isArray(taskDetails.tasks)) {
            const foundTask = taskDetails.tasks.find(task => task.taskId === taskId);
            if (foundTask) {
              task = {
                id: t.id,
                status: t.status,
                details: t.details,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
                foundTask: foundTask
              };
              break;
            }
          }
        } catch (e) {
          console.error('解析任务详情失败:', e);
        }
      }
    }
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }
    
    const foundTask = task.foundTask;
    
    // 如果任务已经失败，确保错误信息被正确传递
    if (foundTask.status === 'FAILED') {
      console.log(`任务已失败: ${taskId}, 错误信息: ${foundTask.error}`);
      console.log(`错误详情:`, foundTask.errorDetails);
      
        // 如果错误信息为空，尝试从任务详情中提取
        if (!foundTask.error) {
          console.log('任务失败但错误信息为空，尝试从任务详情中提取...');
          console.log('完整任务对象:', JSON.stringify(foundTask, null, 2));
          
          // 尝试从多个字段提取错误信息
          foundTask.error = foundTask.errorMessage || foundTask.message || foundTask.errorDetails?.message || '任务处理失败：未知错误';
          
          // 如果仍然没有错误详情，构建一个默认的
          if (!foundTask.errorDetails) {
            foundTask.errorDetails = {
              message: foundTask.error,
              code: 'UNKNOWN_ERROR',
              status: 'FAILED',
              timestamp: new Date().toISOString()
            };
          }
          
          console.log('提取后的错误信息:', foundTask.error);
          console.log('提取后的错误详情:', foundTask.errorDetails);
          
          // 根据任务ID判断可能的失败原因
          if (taskId.includes('MULTI_IMAGE_TO_VIDEO')) {
            foundTask.error = '多图转视频处理失败：可能是转场风格不支持或图片上传失败';
            foundTask.errorDetails.possibleCauses = [
              '转场风格参数不支持',
              '图片上传到OSS失败',
              '阿里云API调用失败',
              '参数验证失败'
            ];
          }
        }
    }
    
    // 如果任务还在处理中，尝试从阿里云API获取最新状态
    if (foundTask.status === 'PENDING' || foundTask.status === 'RUNNING' || !foundTask.status) {
      try {
        // 检查是否有阿里云RequestId
        const aliCloudRequestId = foundTask.aliCloudRequestId;
        console.log(`任务状态检查: taskId=${taskId}, 当前状态=${foundTask.status}, aliCloudRequestId=${aliCloudRequestId}`);
        
        // 在测试模式下，检查内存缓存中的任务状态
        if (!aliCloudRequestId && global.taskCache && global.taskCache[taskId]) {
          const cachedTask = global.taskCache[taskId];
          console.log(`[测试模式] 检查内存缓存任务状态: ${taskId}, 状态: ${cachedTask.status}`);
          
          if (cachedTask.status === 'SUCCEEDED') {
            foundTask.status = 'SUCCEEDED';
            foundTask.videoUrl = cachedTask.videoUrl || null;
            foundTask.videoCoverUrl = cachedTask.videoCoverUrl || null;
            foundTask.videoDuration = cachedTask.videoDuration || null;
            foundTask.videoWidth = cachedTask.videoWidth || null;
            foundTask.videoHeight = cachedTask.videoHeight || null;
            
            console.log(`[测试模式] 从内存缓存更新任务状态: ${taskId}`);
            console.log(`- videoUrl: ${foundTask.videoUrl}`);
            console.log(`- videoCoverUrl: ${foundTask.videoCoverUrl}`);
            console.log(`- videoDuration: ${foundTask.videoDuration}`);
            console.log(`- videoWidth: ${foundTask.videoWidth}`);
            console.log(`- videoHeight: ${foundTask.videoHeight}`);
            
            // 使用统一的saveTaskDetails函数更新任务状态并处理积分扣除
            try {
              const { saveTaskDetails } = require('./middleware/unifiedFeatureUsage');
              
              // 获取功能使用记录
              const usage = await FeatureUsage.findOne({
                where: { 
                  userId: userId, 
                  featureName: 'MULTI_IMAGE_TO_VIDEO' 
                }
              });
              
              if (usage) {
                // 🔧 重要修复：从任务创建时保存的extraData中获取用户指定的时长，而不是阿里云返回的实际视频时长
                // 因为积分计算应该基于用户提交时选择的时长，而不是实际生成的视频时长
                let videoDuration = 5; // 默认5秒
                
                // 优先从extraData.duration获取用户指定的时长
                if (foundTask.extraData && foundTask.extraData.duration) {
                  videoDuration = parseInt(foundTask.extraData.duration) || 5;
                  console.log(`[测试模式] 使用extraData中保存的用户指定时长: ${videoDuration}秒`);
                }
                // 如果extraData中没有，尝试从metadata.duration获取
                else if (foundTask.metadata && foundTask.metadata.duration) {
                  videoDuration = parseInt(foundTask.metadata.duration) || 5;
                  console.log(`[测试模式] 使用metadata中保存的用户指定时长: ${videoDuration}秒`);
                }
                // 最后才使用阿里云返回的实际时长（不推荐）
                else if (foundTask.videoDuration) {
                  videoDuration = parseInt(foundTask.videoDuration) || 5;
                  console.warn(`[测试模式] ⚠️ 使用阿里云返回的实际视频时长: ${videoDuration}秒（可能与用户指定时长不同）`);
                }
                
                console.log(`[测试模式] 多图转视频任务完成，用于积分计算的时长: ${videoDuration}秒`);
                
                  // 检查是否为免费使用 - 动态计算积分和免费判断
                  let isFree = false;
                  let creditCost = 0;
                  
                  // 首先根据视频时长计算积分成本
                  const baseCredits = 30; // 每30秒30积分
                  const actualCreditCost = Math.ceil(videoDuration / 30) * baseCredits;
                  
                  try {
                    const details = JSON.parse(usage.details || '{}');
                    const currentTask = (details.tasks || []).find(t => t.taskId === taskId);
                    
                    if (currentTask && currentTask.status === 'completed') {
                      // 如果任务已完成并存在于详情中，使用已保存的信息
                      isFree = currentTask.isFree || false;
                      creditCost = currentTask.creditCost || 0;
                      console.log(`[测试模式] 从已完成任务详情获取: 任务ID=${taskId}, 免费=${isFree}, 积分=${creditCost}`);
                    } else {
                      // 任务尚未完成，需要进行免费判断
                      // 检查已完成的付费任务数量（排除当前任务）
                      const completedPaidTasks = (details.tasks || []).filter(t => 
                        (t.status === 'SUCCEEDED' || t.status === 'completed') && 
                        t.creditCost > 0 && 
                        !t.isFree &&
                        t.taskId !== taskId // 排除当前任务
                      ).length;
                      
                      // 如果没有已完成的付费任务，则当前任务免费
                      isFree = completedPaidTasks === 0;
                      creditCost = isFree ? 0 : actualCreditCost;
                      
                      console.log(`[测试模式] 动态计算积分: 任务ID=${taskId}, 视频时长=${videoDuration}秒, 已完成付费任务数=${completedPaidTasks}, 免费=${isFree}, 积分=${creditCost}`);
                    }
                  } catch (e) {
                    console.error('解析任务详情失败:', e);
                    // 解析失败时，假设为首次使用（免费）
                    isFree = true;
                    creditCost = 0;
                  }
                
                console.log(`[测试模式] 多图转视频任务完成积分计算: 任务ID=${taskId}, 视频时长=${videoDuration}秒, 免费使用=${isFree}, 积分消耗=${creditCost}`);
                
                // 调用saveTaskDetails函数，传入status='completed'参数，触发积分扣除逻辑
                await saveTaskDetails(usage, {
                  taskId: taskId,
                  featureName: 'MULTI_IMAGE_TO_VIDEO',
                  status: 'completed', // 触发任务完成后扣费逻辑
                  creditCost: creditCost,
                  isFree: isFree,
                  videoUrl: foundTask.videoUrl,
                  videoCoverUrl: foundTask.videoCoverUrl,
                  videoDuration: videoDuration,
                  videoWidth: foundTask.videoWidth,
                  videoHeight: foundTask.videoHeight,
                  metadata: {
                    duration: videoDuration,
                    durationText: `${videoDuration}秒`
                  },
                  operationText: `处理${videoDuration}秒视频`
                });
                
                console.log(`[测试模式] 多图转视频任务完成，已触发积分扣除逻辑: 任务ID=${taskId}, 积分=${creditCost}, 免费=${isFree}`);
                
                // 更新任务状态，确保前端能正确显示视频信息和积分消耗
                foundTask.creditCost = creditCost;
                foundTask.isFree = isFree;
                foundTask.videoDuration = videoDuration;
              } else {
                console.error(`[测试模式] 未找到用户ID=${userId}的MULTI_IMAGE_TO_VIDEO功能使用记录`);
              }
            } catch (updateError) {
              console.error('[测试模式] 更新任务状态和积分扣除失败:', updateError);
            }
          } else if (cachedTask.status === 'FAILED') {
            foundTask.status = 'FAILED';
            foundTask.error = cachedTask.error || '任务处理失败';
            console.log(`[测试模式] 任务失败: ${taskId}, 错误: ${foundTask.error}`);
          } else {
            foundTask.status = 'RUNNING';
            console.log(`[测试模式] 任务处理中: ${taskId}, 状态: ${cachedTask.status}`);
          }
        } else if (aliCloudRequestId) {
          console.log(`查询阿里云任务状态: ${aliCloudRequestId}`);
          
          // 使用阿里云POP Core SDK查询任务状态
          const Core = require('@alicloud/pop-core');
          const client = new Core({
            accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
            accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
            endpoint: 'https://videoenhan.cn-shanghai.aliyuncs.com',
            apiVersion: '2020-03-20'
          });
          
          const response = await client.request('GetAsyncJobResult', {
            JobId: aliCloudRequestId
          }, {
            method: 'POST'
          });
          
          console.log('阿里云任务状态查询响应:', JSON.stringify(response, null, 2));
          
          if (response && response.Data) {
            const jobData = response.Data;
            const status = jobData.Status;
            
            console.log('阿里云任务数据详情:', JSON.stringify(jobData, null, 2));
            console.log('任务状态:', status);
            console.log('Result字段:', jobData.Result);
            
            // 更新任务状态 - 支持多种状态值
            if (status === 'SUCCEEDED' || status === 'PROCESS_SUCCESS') {
              foundTask.status = 'SUCCEEDED';
              
              // 阿里云视频增强API的标准响应格式
              let result = {};
              try {
                if (typeof jobData.Result === 'string') {
                  result = JSON.parse(jobData.Result);
                } else {
                  result = jobData.Result || {};
                }
              } catch (parseError) {
                console.error('解析Result字段JSON失败:', parseError);
                result = {};
              }
              console.log('Result字段内容:', JSON.stringify(result, null, 2));
              
              // 按照阿里云视频增强API文档的字段名提取
              foundTask.videoUrl = result.VideoUrl || null;
              foundTask.videoCoverUrl = result.VideoCoverUrl || null;
              foundTask.videoDuration = result.Duration || null;
              foundTask.videoWidth = result.Width || null;
              foundTask.videoHeight = result.Height || null;
              
              console.log('提取的视频信息:');
              console.log('- videoUrl:', foundTask.videoUrl);
              console.log('- videoCoverUrl:', foundTask.videoCoverUrl);
              console.log('- videoDuration:', foundTask.videoDuration);
              console.log('- videoWidth:', foundTask.videoWidth);
              console.log('- videoHeight:', foundTask.videoHeight);
              
              // 如果标准字段为空，尝试其他可能的字段名
              if (!foundTask.videoUrl) {
                console.log('标准VideoUrl字段为空，尝试其他字段名...');
                foundTask.videoUrl = result.videoUrl || result.video_url || result.url || result.Url || null;
                foundTask.videoCoverUrl = result.videoCoverUrl || result.video_cover_url || result.coverUrl || result.CoverUrl || null;
                foundTask.videoDuration = result.duration || result.videoDuration || result.video_duration || null;
                foundTask.videoWidth = result.width || result.videoWidth || result.video_width || null;
                foundTask.videoHeight = result.height || result.videoHeight || result.video_height || null;
                
                console.log('尝试其他字段后的视频信息:');
                console.log('- videoUrl:', foundTask.videoUrl);
                console.log('- videoCoverUrl:', foundTask.videoCoverUrl);
                console.log('- videoDuration:', foundTask.videoDuration);
                console.log('- videoWidth:', foundTask.videoWidth);
                console.log('- videoHeight:', foundTask.videoHeight);
              }
              
              console.log(`多图转视频任务完成: ${taskId}, 视频URL: ${foundTask.videoUrl}`);
              
              // 使用统一的saveTaskDetails函数更新任务状态并处理积分扣除
              try {
                const { saveTaskDetails } = require('./middleware/unifiedFeatureUsage');
                const { FeatureUsage } = require('./models/FeatureUsage');
                
                // 获取功能使用记录
                const usage = await FeatureUsage.findOne({
                  where: { 
                    userId: userId, 
                    featureName: 'MULTI_IMAGE_TO_VIDEO' 
                  }
                });
                
                if (usage) {
                  // 🔧 重要修复：从任务创建时保存的extraData中获取用户指定的时长，而不是阿里云返回的实际视频时长
                  // 因为积分计算应该基于用户提交时选择的时长，而不是实际生成的视频时长
                  let videoDuration = 5; // 默认5秒
                  
                  // 优先从extraData.duration获取用户指定的时长
                  if (foundTask.extraData && foundTask.extraData.duration) {
                    videoDuration = parseInt(foundTask.extraData.duration) || 5;
                    console.log(`使用extraData中保存的用户指定时长: ${videoDuration}秒`);
                  }
                  // 如果extraData中没有，尝试从metadata.duration获取
                  else if (foundTask.metadata && foundTask.metadata.duration) {
                    videoDuration = parseInt(foundTask.metadata.duration) || 5;
                    console.log(`使用metadata中保存的用户指定时长: ${videoDuration}秒`);
                  }
                  // 最后才使用阿里云返回的实际时长（不推荐）
                  else if (foundTask.videoDuration) {
                    videoDuration = parseInt(foundTask.videoDuration) || 5;
                    console.warn(`⚠️ 使用阿里云返回的实际视频时长: ${videoDuration}秒（可能与用户指定时长不同）`);
                  }
                  
                  console.log(`多图转视频任务完成，用于积分计算的时长: ${videoDuration}秒`);
                  
                  // 🔧 重要修复：不要重新计算免费状态，应该使用已保存的任务详情
                  let isFree = false;
                  let creditCost = 0;
                  
                  // 首先根据视频时长计算积分成本
                  const baseCredits = 30; // 每30秒30积分
                  const actualCreditCost = Math.ceil(videoDuration / 30) * baseCredits;
                  
                  try {
                    const details = JSON.parse(usage.details || '{}');
                    
                    // 🔧 关键修复：从已保存的任务详情中读取免费状态，不要重新计算
                    // 因为免费状态已经在unifiedFeatureUsage.js中正确计算过了
                    const currentTask = (details.tasks || []).find(t => t.taskId === taskId);
                    
                    if (currentTask) {
                      // 使用已保存的免费状态和积分
                      isFree = currentTask.isFree;
                      creditCost = currentTask.creditCost || 0;
                      console.log(`使用已保存的任务状态: 任务ID=${taskId}, 免费=${isFree}, 积分=${creditCost}`);
                    } else {
                      // 如果任务不存在（不应该发生），则进行免费判断
                      // 🔧 重要修复：基于所有历史任务总数判断，而不仅仅是已完成任务
                      const totalTasks = (details.tasks || []).length;
                      
                      isFree = totalTasks === 0;
                      creditCost = isFree ? 0 : actualCreditCost;
                      console.log(`⚠️ 任务不存在，重新计算: 任务ID=${taskId}, 历史任务总数=${totalTasks}, 免费=${isFree}, 积分=${creditCost}`);
                    }
                  } catch (e) {
                    console.error('解析任务详情失败:', e);
                    // 解析失败时，假设为首次使用（免费）
                    isFree = true;
                    creditCost = 0;
                  }
                  
                  console.log(`多图转视频任务完成积分计算: 任务ID=${taskId}, 视频时长=${videoDuration}秒, 免费使用=${isFree}, 积分消耗=${creditCost}`);
                  
                  // 调用saveTaskDetails函数，传入status='completed'参数，触发积分扣除逻辑
                  await saveTaskDetails(usage, {
                    taskId: taskId,
                    featureName: 'MULTI_IMAGE_TO_VIDEO',
                    status: 'completed', // 触发任务完成后扣费逻辑
                    creditCost: creditCost,
                    isFree: isFree,
                    videoUrl: foundTask.videoUrl,
                    videoCoverUrl: foundTask.videoCoverUrl,
                    videoDuration: videoDuration,
                    videoWidth: foundTask.videoWidth,
                    videoHeight: foundTask.videoHeight,
                    metadata: {
                      duration: videoDuration,
                      durationText: `${videoDuration}秒`
                    },
                    operationText: `处理${videoDuration}秒视频`
                  });
                  
                  console.log(`多图转视频任务完成，已触发积分扣除逻辑: 任务ID=${taskId}, 积分=${creditCost}, 免费=${isFree}`);
                  
                  // 更新任务状态，确保前端能正确显示视频信息和积分消耗
                  foundTask.creditCost = creditCost;
                  foundTask.isFree = isFree;
                  foundTask.videoDuration = videoDuration;
                } else {
                  console.error(`未找到用户ID=${userId}的MULTI_IMAGE_TO_VIDEO功能使用记录`);
                }
              } catch (updateError) {
                console.error('更新任务状态和积分扣除失败:', updateError);
              }
            } else if (status === 'FAILED' || status === 'PROCESS_FAILED') {
              foundTask.status = 'FAILED';
              foundTask.error = jobData.Result?.Error || '任务处理失败';
              foundTask.errorDetails = {
                message: foundTask.error,
                code: 'TASK_FAILED',
                status: status,
                details: jobData.Result || {}
              };
              console.log(`多图转视频任务失败: ${taskId}, 错误: ${foundTask.error}`);
              
              // 🔧 重要修复：任务失败时也需要保存积分信息到数据库和OSS
              try {
                // 查找用户的多图转视频功能使用记录
                const { FeatureUsage } = require('./models/FeatureUsage');
                const usage = await FeatureUsage.findOne({
                  where: {
                    userId: userId,
                    featureName: 'MULTI_IMAGE_TO_VIDEO'
                  }
                });
                
                if (usage) {
                  // 调用saveTaskDetails保存失败任务的积分信息
                  const { saveTaskDetails } = require('./middleware/unifiedFeatureUsage');
                  await saveTaskDetails(usage, {
                    taskId: taskId,
                    featureName: 'MULTI_IMAGE_TO_VIDEO',
                    status: 'FAILED', // 失败状态也需要处理积分
                    creditCost: 0, // 失败任务通常不扣积分
                    isFree: true,
                    error: foundTask.error,
                    errorDetails: foundTask.errorDetails
                  });
                  
                  console.log(`✅ 已保存失败任务的积分信息: 任务ID=${taskId}, 免费=true`);
                } else {
                  console.error(`未找到用户ID=${userId}的MULTI_IMAGE_TO_VIDEO功能使用记录`);
                }
              } catch (saveError) {
                console.error('保存失败任务积分信息失败:', saveError);
              }
            } else if (status === 'RUNNING' || status === 'PROCESSING' || status === 'PENDING') {
              foundTask.status = 'RUNNING';
              console.log(`多图转视频任务处理中: ${taskId}, 状态: ${status}`);
            } else {
              console.log(`多图转视频任务未知状态: ${taskId}, 状态: ${status}`);
            }
          }
        }
      } catch (apiError) {
        console.error('查询阿里云任务状态失败:', apiError);
        
        // 如果API调用失败，将任务状态设置为失败
        foundTask.status = 'FAILED';
        foundTask.error = apiError.message || '查询任务状态失败';
        foundTask.errorDetails = {
          message: apiError.message,
          code: apiError.code,
          status: apiError.status,
          details: apiError.data || {}
        };
        
        console.error('任务状态查询失败，设置任务为失败状态:', foundTask.error);
      }
    }
    
    const formattedTask = {
      id: taskId,
      status: foundTask.status || 'PENDING',
      videoUrl: foundTask.videoUrl || null,
      videoCoverUrl: foundTask.videoCoverUrl || null,
      videoDuration: foundTask.videoDuration || null,
      videoWidth: foundTask.videoWidth || null,
      videoHeight: foundTask.videoHeight || null,
      imageCount: foundTask.extraData?.imageCount || 0,
      duration: foundTask.extraData?.duration || 10,
      createdAt: foundTask.timestamp || task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      // 添加错误信息字段
      error: foundTask.error || null,
      errorDetails: foundTask.errorDetails || null,
      // 添加积分相关信息
      creditCost: foundTask.creditCost || 0,
      isFree: foundTask.isFree || false,
      // 🎯 添加视频参数字段，确保前端可以显示具体的转场风格、视频风格等信息
      transition: foundTask.extraData?.transition || null,
      style: foundTask.extraData?.style || null,
      sceneType: foundTask.extraData?.sceneType || null
    };
    
    // 添加调试信息
    console.log(`任务状态查询返回: taskId=${taskId}, status=${formattedTask.status}`);
    console.log(`错误信息: error=${formattedTask.error}, errorDetails=`, formattedTask.errorDetails);
    console.log(`完整任务对象:`, JSON.stringify(formattedTask, null, 2));
    
    // 如果任务失败，确保响应中包含错误信息
    const responseData = {
      success: true,
      task: formattedTask
    };
    
    // 如果任务失败，同时在顶级字段中提供错误信息
    if (formattedTask.status === 'FAILED') {
      responseData.result = {
        error: formattedTask.error || '任务处理失败',
        errorCode: formattedTask.errorDetails?.code || 'TASK_FAILED'
      };
      responseData.message = formattedTask.error || '任务处理失败';
      responseData.error = formattedTask.error || '任务处理失败';
      
      console.log('任务失败，构建错误响应:', JSON.stringify(responseData, null, 2));
    }

    res.json(responseData);
    
  } catch (error) {
    console.error('查询多图转视频任务状态失败:', error);
    res.status(500).json({
      success: false,
      message: '查询任务状态失败',
      error: error.message
    });
  }
});

// 任务状态查询API
app.get('/api/task-status/:taskId', protect, async (req, res) => {
    try {
        const { taskId } = req.params;
        
        if (!taskId) {
            return res.status(400).json({ success: false, message: '缺少任务ID' });
        }
        
        console.log(`查询任务状态, taskId: ${taskId}`);
        
        // 检查是否是模拟任务ID
        if (taskId.startsWith('mock-task-')) {
            // 从内存缓存中获取任务信息
            const taskInfo = global.taskCache && global.taskCache[taskId];
            
            if (!taskInfo) {
                return res.status(404).json({
                    success: false,
                    message: '任务不存在'
                });
            }
            
            // 模拟任务处理时间
            const elapsedTime = (Date.now() - taskInfo.createdAt) / 1000; // 经过的秒数
            
            let status, videoUrl;
            
            if (elapsedTime < 10) {
                // 10秒内显示为等待中
                status = 'PENDING';
            } else if (elapsedTime < 30) {
                // 10-30秒显示为处理中
                status = 'RUNNING';
                // 更新任务状态
                taskInfo.status = status;
            } else {
                // 30秒后显示为完成
                status = 'SUCCEEDED';
                // 更新任务状态
                taskInfo.status = status;
                
                // 生成一个示例视频URL
                if (!taskInfo.videoUrl) {
                    // 实际项目中这应该是真实的视频URL
                    videoUrl = '/uploads/sample-output.mp4';
                    taskInfo.videoUrl = videoUrl;
                } else {
                    videoUrl = taskInfo.videoUrl;
                }
            }
            
            // 如果有错误信息，在PENDING阶段后直接返回失败
            if (taskInfo.errorInfo && elapsedTime >= 10) {
                return res.json({
                    success: false,
                    status: 'failed',
                    message: taskInfo.errorInfo.message || '处理失败',
                    code: taskInfo.errorInfo.code || 'ERROR',
                    requestId: `mock-req-${Date.now()}`
                });
            }
            
            return res.json({
                success: true,
                status: status === 'SUCCEEDED' ? 'completed' : status === 'RUNNING' ? 'processing' : 'pending',
                message: `任务${status === 'SUCCEEDED' ? '已完成' : status === 'RUNNING' ? '处理中' : '排队中'}`,
                videoUrl: status === 'SUCCEEDED' ? videoUrl : null,
                requestId: `mock-req-${Date.now()}`
            });
        }
        
        // 获取API密钥
        const apiKey = process.env.DASHSCOPE_API_KEY || '';
        if (!apiKey) {
            return res.status(500).json({ success: false, message: '服务器配置错误：缺少API密钥' });
        }
        
        // 检查是否有有效的API密钥，决定是使用真实调用还是模拟调用
        const isValidApiKey = apiKey && apiKey.length > 10 && apiKey !== 'default-api-key-replacement';
        
        if (isValidApiKey) {
            try {
                console.log('查询真实任务状态:', taskId);
                // 使用@alicloud/pop-core等SDK进行调用
                const Core = require('@alicloud/pop-core');
                
                // 创建POP Core客户端
                const client = new Core({
                    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
                    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
                    endpoint: 'https://videoenhan.cn-shanghai.aliyuncs.com',
                    apiVersion: '2020-03-20'
                });
                
                // 查询任务状态API
                const response = await client.request('GetAsyncJobResult', {
                    JobId: taskId
                }, {
                    method: 'GET'
                });
                
                console.log('任务状态API响应:', JSON.stringify(response, null, 2));
                
                // 解析任务状态
                if (response && response.Data) {
                    const jobData = response.Data;
                    const status = jobData.Status;
                    
                    // 检查状态值是否为空
                    if (!status || status === null || status === undefined) {
                        console.log(`[多图转视频] 状态值为空:`, {
                            status: status,
                            jobData: jobData,
                            response: response
                        });
                        return res.json({
                            success: true,
                            status: 'processing',
                            message: '任务正在处理中',
                            originalStatus: 'NULL_OR_UNDEFINED'
                        });
                    }
                    
                    console.log(`[多图转视频] 阿里云API完整响应:`, JSON.stringify(response, null, 2));
                    console.log(`[多图转视频] 阿里云API状态: ${status}`);
                    console.log(`[多图转视频] 状态类型: ${typeof status}`);
                    console.log(`[多图转视频] 状态长度: ${status ? status.length : 'null'}`);
                    
                    // 根据任务状态返回对应信息
                    if (status === 'PROCESS_SUCCESS' || status === 'SUCCEEDED') {
                        // 任务成功，解析结果JSON
                        let result = {};
                        try {
                            if (typeof jobData.Result === 'string') {
                                result = JSON.parse(jobData.Result);
                            } else {
                                result = jobData.Result;
                            }
                            
                            // 如果任务成功完成，触发积分扣除
                            const taskId = req.params.taskId;
                            if (global.multiImageToVideoTasks && global.multiImageToVideoTasks[taskId]) {
                                // 检查是否已扣除积分
                                const hasChargedCredits = global.multiImageToVideoTasks[taskId].hasChargedCredits || false;
                                if (!hasChargedCredits) {
                                    try {
                                        const userId = global.multiImageToVideoTasks[taskId].userId;
                                        
                                        // 查询用户的功能使用记录，重新检查免费次数使用情况
                                        const { FeatureUsage } = require('./models/FeatureUsage');
                                        const { saveTaskDetails } = require('./middleware/unifiedFeatureUsage');
                                        
                                        let usage = await FeatureUsage.findOne({
                                            where: { userId, featureName: 'MULTI_IMAGE_TO_VIDEO' }
                                        });
                                        
                                        if (usage) {
                                            // 获取功能配置
                                            const { FEATURES } = require('./middleware/featureAccess');
                                            const featureConfig = FEATURES['MULTI_IMAGE_TO_VIDEO'] || { freeUsage: 1 };
                                            
                                            // 重新判断是否为免费使用 - 基于当前的使用次数
                                            // 由于usageCount已经在中间件中被更新，我们需要检查这是否是免费使用的任务
                                            // 如果usageCount <= freeUsage，说明这次使用是在免费范围内的
                                            const isFree = usage.usageCount <= featureConfig.freeUsage;
                                            
                                            console.log(`重新检查免费次数使用情况: 用户ID=${userId}, 功能=MULTI_IMAGE_TO_VIDEO, 当前使用次数=${usage.usageCount}, 免费次数=${featureConfig.freeUsage}, 是否免费=${isFree}`);
                                            
                                            // 更新全局变量中的免费标记
                                            if (global.multiImageToVideoTasks && global.multiImageToVideoTasks[taskId]) {
                                                global.multiImageToVideoTasks[taskId].isFree = isFree;
                                            }
                                        
                                            // 计算视频时长和积分消耗
                                            let videoDuration = 0;
                                            if (result.Duration) {
                                                videoDuration = parseFloat(result.Duration);
                                            } else if (result.duration) {
                                                videoDuration = parseFloat(result.duration);
                                            } else {
                                                // 默认时长
                                                videoDuration = 5;
                                            }
                                            
                                            // 计算积分消耗：每30秒30积分，不满30秒按30秒计算
                                            const creditCost = isFree ? 0 : Math.ceil(videoDuration / 30) * 30;
                                            
                                            console.log(`多图转视频任务完成: 任务ID=${taskId}, 用户ID=${userId}, 视频时长=${videoDuration}秒, 免费使用=${isFree}, 实际积分消耗=${creditCost}`);
                                            
                                            // 调用saveTaskDetails函数，传入status='completed'参数和视频时长，触发统一的积分扣除逻辑
                                            await saveTaskDetails(usage, {
                                                taskId: taskId,
                                                featureName: 'MULTI_IMAGE_TO_VIDEO',
                                                status: 'completed', // 添加status参数，触发任务完成后扣费逻辑
                                                creditCost: creditCost,
                                                isFree: isFree,
                                                metadata: {
                                                    duration: videoDuration,
                                                    durationText: `${videoDuration}秒`
                                                },
                                                // 添加操作描述，用于前端显示
                                                operationText: `处理${videoDuration}秒视频`
                                            });
                                            
                                            console.log(`已触发多图转视频任务完成扣费逻辑: 任务ID=${taskId}, 视频时长=${videoDuration}秒, 积分=${creditCost}, 免费=${isFree}`);
                                            
                                            // 标记为已扣除积分，避免重复计算
                                            global.multiImageToVideoTasks[taskId].hasChargedCredits = true;
                                        } else {
                                            console.log(`未找到用户ID=${userId}的MULTI_IMAGE_TO_VIDEO功能使用记录`);
                                        }
                                    } catch (error) {
                                        console.error('处理多图转视频任务完成扣费逻辑失败:', error);
                                    }
                                } else {
                                    console.log(`多图转视频任务 ${taskId} 已扣除积分，跳过重复计算`);
                                }
                            }
                        } catch (e) {
                            console.error('解析任务结果错误:', e);
                            result = { VideoUrl: null };
                        }
                        
                        // 如果生成的视频需要保存到本地，可以下载到服务器
                        if (result.VideoUrl) {
                            try {
                                // 创建目录确保存在
                                const uploadDir = path.join(__dirname, 'uploads', 'multi-image-videos');
                                if (!fs.existsSync(uploadDir)) {
                                    fs.mkdirSync(uploadDir, { recursive: true });
                                }
                                
                                // 可以选择下载视频到本地服务器（可选步骤）
                                // 这里仅记录，不实际下载
                                console.log('视频生成完成，URL:', result.VideoUrl);
                            } catch (saveError) {
                                console.error('保存视频错误:', saveError);
                            }
                        }
                        
                        // 更新任务详情到数据库
                        try {
                            const { FeatureUsage } = require('./models/FeatureUsage');
                            const usage = await FeatureUsage.findOne({
                                where: { 
                                    userId: global.multiImageToVideoTasks[taskId].userId, 
                                    featureName: 'MULTI_IMAGE_TO_VIDEO' 
                                }
                            });
                            
                            if (usage) {
                                const taskDetails = {
                                    taskId: taskId,
                                    videoUrl: result.VideoUrl || null,
                                    videoCoverUrl: result.VideoCoverUrl || null,
                                    videoDuration: result.Duration || result.duration || 10,
                                    videoWidth: result.Width || result.width || null,
                                    videoHeight: result.Height || result.height || null,
                                    imageCount: global.multiImageToVideoTasks[taskId].imageCount || 0,
                                    duration: global.multiImageToVideoTasks[taskId].duration || 10,
                                    status: 'SUCCEEDED'
                                };
                                
                                usage.taskDetails = JSON.stringify(taskDetails);
                                usage.status = 'SUCCEEDED';
                                await usage.save();
                                
                                console.log(`多图转视频任务详情已更新到数据库: 任务ID=${taskId}`);
                            }
                        } catch (dbError) {
                            console.error('更新多图转视频任务详情失败:', dbError);
                        }
                        
                        // 更新OSS中的任务状态
                        try {
                            const userId = global.multiImageToVideoTasks[taskId].userId;
                            const taskUpdates = {
                                status: 'SUCCEEDED',
                                videoUrl: result.VideoUrl || null,
                                videoCoverUrl: result.VideoCoverUrl || null,
                                videoDuration: result.Duration || result.duration || 10,
                                videoWidth: result.Width || result.width || null,
                                videoHeight: result.Height || result.height || null,
                                updatedAt: new Date().toISOString()
                            };
                            
                            await updateMultiImageToVideoTaskInOSS(userId, taskId, taskUpdates);
                            console.log(`多图转视频任务状态已更新到OSS: 任务ID=${taskId}`);
                        } catch (ossError) {
                            console.error('更新多图转视频任务状态到OSS失败:', ossError);
                        }
                        
                        return res.json({
                            success: true,
                            task: {
                                id: taskId,
                                status: 'SUCCEEDED',
                                videoUrl: result.VideoUrl || null,
                                videoCoverUrl: result.VideoCoverUrl || null,
                                videoDuration: result.Duration || result.duration || 10,
                                videoWidth: result.Width || result.width || null,
                                videoHeight: result.Height || result.height || null,
                                imageCount: global.multiImageToVideoTasks[taskId]?.imageCount || 0,
                                duration: global.multiImageToVideoTasks[taskId]?.duration || 10,
                                createdAt: global.multiImageToVideoTasks[taskId]?.createdAt || new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            },
                            originalStatus: status
                        });
                    } else if (status === 'PROCESS_FAILED') {
                        // 任务失败
                        const errorMessage = jobData.Result?.Error || '视频生成失败';
                        const errorDetails = {
                            message: errorMessage,
                            code: 'PROCESS_FAILED',
                            status: status,
                            details: jobData.Result || {}
                        };
                        
                        return res.json({
                            success: false,
                            task: {
                                id: taskId,
                                status: 'FAILED',
                                videoUrl: null,
                                videoCoverUrl: null,
                                videoDuration: null,
                                videoWidth: null,
                                videoHeight: null,
                                imageCount: global.multiImageToVideoTasks[taskId]?.imageCount || 0,
                                duration: global.multiImageToVideoTasks[taskId]?.duration || 10,
                                createdAt: global.multiImageToVideoTasks[taskId]?.createdAt || new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                                error: errorMessage,
                                errorDetails: errorDetails
                            },
                            message: errorMessage,
                            error: errorMessage,
                            errorDetails: errorDetails,
                            originalStatus: status
                        });
                    } else if (status === 'SUCCEEDED') {
                        // 任务成功（另一种状态值）
                        let result = {};
                        try {
                            if (typeof jobData.Result === 'string') {
                                result = JSON.parse(jobData.Result);
                            } else {
                                result = jobData.Result;
                            }
                        } catch (parseError) {
                            console.error('解析结果JSON失败:', parseError);
                            result = {};
                        }
                        
                        return res.json({
                            success: true,
                            task: {
                                id: taskId,
                                status: 'SUCCEEDED',
                                videoUrl: result.VideoUrl || null,
                                videoCoverUrl: result.VideoCoverUrl || null,
                                videoDuration: result.Duration || result.duration || 10,
                                videoWidth: result.Width || result.width || null,
                                videoHeight: result.Height || result.height || null,
                                imageCount: global.multiImageToVideoTasks[taskId]?.imageCount || 0,
                                duration: global.multiImageToVideoTasks[taskId]?.duration || 10,
                                createdAt: global.multiImageToVideoTasks[taskId]?.createdAt || new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            },
                            originalStatus: status
                        });
                    } else if (status === 'FAILED') {
                        // 任务失败（另一种状态值）
                        const errorMessage = jobData.Result?.Error || '视频生成失败';
                        const errorDetails = {
                            message: errorMessage,
                            code: 'FAILED',
                            status: status,
                            details: jobData.Result || {}
                        };
                        
                        return res.json({
                            success: false,
                            task: {
                                id: taskId,
                                status: 'FAILED',
                                videoUrl: null,
                                videoCoverUrl: null,
                                videoDuration: null,
                                videoWidth: null,
                                videoHeight: null,
                                imageCount: global.multiImageToVideoTasks[taskId]?.imageCount || 0,
                                duration: global.multiImageToVideoTasks[taskId]?.duration || 10,
                                createdAt: global.multiImageToVideoTasks[taskId]?.createdAt || new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                                error: errorMessage,
                                errorDetails: errorDetails
                            },
                            message: errorMessage,
                            error: errorMessage,
                            errorDetails: errorDetails,
                            originalStatus: status
                        });
                    } else if (status === 'RUNNING' || status === 'PENDING' || status === 'QUEUED' || 
                               status === 'PROCESSING' || status === 'WAITING' || status === 'IN_PROGRESS' ||
                               status === 'STARTING' || status === 'INITIALIZING') {
                        // 任务正在处理中
                        return res.json({
                            success: true,
                            task: {
                                id: taskId,
                                status: 'PROCESSING',
                                videoUrl: null,
                                videoCoverUrl: null,
                                videoDuration: null,
                                videoWidth: null,
                                videoHeight: null,
                                imageCount: global.multiImageToVideoTasks[taskId]?.imageCount || 0,
                                duration: global.multiImageToVideoTasks[taskId]?.duration || 10,
                                createdAt: global.multiImageToVideoTasks[taskId]?.createdAt || new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            },
                            message: '任务正在处理中',
                            originalStatus: status
                        });
                    } else {
                        // 未知状态 - 记录详细信息并当作处理中处理
                        console.log(`[多图转视频] 未知状态: ${status}`);
                        console.log(`[多图转视频] 状态详细信息:`, {
                            status: status,
                            type: typeof status,
                            length: status ? status.length : 'null',
                            trimmed: status ? status.trim() : 'null',
                            upperCase: status ? status.toUpperCase() : 'null'
                        });
                        
                        // 对于未知状态，我们假设任务仍在处理中
                        return res.json({
                            success: true,
                            task: {
                                id: taskId,
                                status: 'PROCESSING',
                                videoUrl: null,
                                videoCoverUrl: null,
                                videoDuration: null,
                                videoWidth: null,
                                videoHeight: null,
                                imageCount: global.multiImageToVideoTasks[taskId]?.imageCount || 0,
                                duration: global.multiImageToVideoTasks[taskId]?.duration || 10,
                                createdAt: global.multiImageToVideoTasks[taskId]?.createdAt || new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            },
                            message: '任务正在处理中',
                            originalStatus: status || 'UNKNOWN'
                        });
                    }
                } else {
                    throw new Error('API响应格式错误');
                }
            } catch (apiError) {
                console.error('查询任务状态失败:', apiError);
                
                return res.status(500).json({
                    success: false,
                    status: 'failed',
                    message: '查询任务状态失败: ' + (apiError.message || '未知错误')
                });
            }
        } else {
            // 本地测试模式，检查内存缓存中的任务状态
            console.log('[测试模式] 检查内存缓存中的任务状态');
            
            if (global.taskCache && global.taskCache[taskId]) {
                const cachedTask = global.taskCache[taskId];
                console.log(`[测试模式] 内存缓存任务状态: ${taskId}, 状态: ${cachedTask.status}`);
                
                if (cachedTask.status === 'SUCCEEDED') {
                    // 更新数据库中的任务状态
                    try {
                        const taskDetails = JSON.parse(task.details);
                        const taskIndex = taskDetails.tasks.findIndex(t => t.taskId === taskId);
                        if (taskIndex !== -1) {
                            taskDetails.tasks[taskIndex].status = 'SUCCEEDED';
                            taskDetails.tasks[taskIndex].videoUrl = cachedTask.videoUrl;
                            taskDetails.tasks[taskIndex].videoCoverUrl = cachedTask.videoCoverUrl;
                            taskDetails.tasks[taskIndex].videoDuration = cachedTask.videoDuration;
                            taskDetails.tasks[taskIndex].videoWidth = cachedTask.videoWidth;
                            taskDetails.tasks[taskIndex].videoHeight = cachedTask.videoHeight;
                            taskDetails.tasks[taskIndex].completedAt = cachedTask.completedAt;
                            
                            await FeatureUsage.update(
                                { details: JSON.stringify(taskDetails) },
                                { where: { id: task.id } }
                            );
                            console.log(`[测试模式] 任务状态已更新到数据库: ${taskId}`);
                        }
                    } catch (updateError) {
                        console.error('[测试模式] 更新任务状态到数据库失败:', updateError);
                    }
                    
                    return res.json({
                        success: true,
                        task: {
                            id: taskId,
                            status: 'SUCCEEDED',
                            videoUrl: cachedTask.videoUrl,
                            videoCoverUrl: cachedTask.videoCoverUrl,
                            videoDuration: cachedTask.videoDuration,
                            videoWidth: cachedTask.videoWidth,
                            videoHeight: cachedTask.videoHeight,
                            imageCount: foundTask.extraData?.imageCount || 0,
                            duration: foundTask.extraData?.duration || 10,
                            createdAt: foundTask.timestamp || task.createdAt.toISOString(),
                            updatedAt: new Date().toISOString()
                        },
                        result: {
                            videoUrl: cachedTask.videoUrl,
                            videoCoverUrl: cachedTask.videoCoverUrl,
                            videoDuration: cachedTask.videoDuration,
                            videoWidth: cachedTask.videoWidth,
                            videoHeight: cachedTask.videoHeight
                        },
                        message: '视频生成成功',
                        error: null
                    });
                } else if (cachedTask.status === 'FAILED') {
                    return res.json({
                        success: true,
                        task: {
                            id: taskId,
                            status: 'FAILED',
                            videoUrl: null,
                            videoCoverUrl: null,
                            videoDuration: null,
                            videoWidth: null,
                            videoHeight: null,
                            imageCount: foundTask.extraData?.imageCount || 0,
                            duration: foundTask.extraData?.duration || 10,
                            createdAt: foundTask.timestamp || task.createdAt.toISOString(),
                            updatedAt: new Date().toISOString(),
                            error: cachedTask.error || '任务处理失败',
                            errorDetails: cachedTask.errorDetails || null
                        },
                        result: {},
                        message: cachedTask.error || '任务处理失败',
                        error: cachedTask.error || '任务处理失败'
                    });
                } else {
                    return res.json({
                        success: true,
                        task: {
                            id: taskId,
                            status: 'RUNNING',
                            videoUrl: null,
                            videoCoverUrl: null,
                            videoDuration: null,
                            videoWidth: null,
                            videoHeight: null,
                            imageCount: foundTask.extraData?.imageCount || 0,
                            duration: foundTask.extraData?.duration || 10,
                            createdAt: foundTask.timestamp || task.createdAt.toISOString(),
                            updatedAt: new Date().toISOString()
                        },
                        result: {},
                        message: '任务处理中',
                        error: null
                    });
                }
            } else {
                // 没有找到缓存任务，返回默认状态
                return res.json({
                    success: true,
                    task: {
                        id: taskId,
                        status: 'PENDING',
                        videoUrl: null,
                        videoCoverUrl: null,
                        videoDuration: null,
                        videoWidth: null,
                        videoHeight: null,
                        imageCount: foundTask.extraData?.imageCount || 0,
                        duration: foundTask.extraData?.duration || 10,
                        createdAt: foundTask.timestamp || task.createdAt.toISOString(),
                        updatedAt: new Date().toISOString()
                    },
                    result: {},
                    message: '任务排队中',
                    error: null
                });
            }
        }
        
    } catch (error) {
        console.error('查询任务状态API错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 添加下载中心路由
app.use('/api/downloads', downloadsRoutes);
// 添加上传图片路由 - 直接使用textToVideo路由中的上传图片处理函数
app.post('/api/upload-image', protect, upload.single('image'), async (req, res) => {
  try {
    // 添加调试日志
    console.log('=== 图片上传调试信息 ===');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('isMultipart:', req.is('multipart/*'));
    console.log('req.file:', req.file);
    console.log('req.body:', req.body);
    console.log('========================');
    
    if (!req.file) {
      return res.status(400).json({ 
        code: 'InvalidParameter',
        message: '未提供图片文件',
        request_id: null
      });
    }
    
    // 获取上传的文件路径
    const filePath = req.file.path;
    let imageUrl;
    
    try {
      // 确保文件存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`上传的文件不存在: ${filePath}`);
      }
      
      // 使用OSS服务上传图片到阿里云
      console.log('开始将图片上传到阿里云OSS...');
      const { uploadFile } = require('./utils/ossService');
      imageUrl = await uploadFile(filePath, 'images/');
      console.log('图片已成功上传到阿里云OSS:', imageUrl);
      
      if (!imageUrl || !imageUrl.startsWith('http')) {
        throw new Error('OSS未返回有效的URL');
      }
    } catch (ossError) {
      console.error('上传到阿里云OSS失败:', ossError);
      // 返回错误，不使用本地URL
      return res.status(500).json({
        code: 'OssUploadFailed',
        message: '上传图片到OSS失败: ' + ossError.message,
        request_id: null
      });
    }
    
    // 返回统一的响应格式
    return res.json({
      output: {
        img_url: imageUrl
      },
      imageUrl: imageUrl, // 兼容旧代码
      url: imageUrl, // 兼容旧代码
      request_id: Date.now().toString() // 生成一个唯一ID作为请求ID
    });
  } catch (error) {
    console.error('图片上传处理错误:', error);
    return res.status(500).json({
      code: 'InternalServerError',
      message: '图片上传处理失败: ' + error.message,
      request_id: null
    });
  }
});
app.use('/api/upload/image', require('./routes/textToVideo').uploadImageRoute);

// 添加智能扩图API路由
app.use('/api/image-expansion', require('./routes/imageExpansion'));
app.use('/api/image-expansion/history', require('./routes/image-expansion-history'));
app.use('/api/image-expansion-fix', require('./routes/image-expansion-fix'));

// 通用图片上传接口 - 上传到OSS
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传图片' });
    }
    
    // 导入OSS服务
    const { uploadFile } = require('./utils/ossService');
    
    // 上传到OSS
    const imageUrl = await uploadFile(req.file.path, 'images/');
    
    console.log('图片已上传到OSS:', imageUrl);
    res.json({ imageUrl });
  } catch (error) {
    console.error('上传图片失败:', error);
    res.status(500).json({ error: '上传图片失败: ' + error.message });
  }
});

// [已废弃] 临时Base64图片上传接口 - 不需要认证（用于指令编辑界面）
// 注意：此接口已被废弃，指令编辑功能现在使用 /api/text-to-video/upload-image 直接上传到OSS
app.post('/api/upload-base64', async (req, res) => {
  console.warn('[废弃接口] /api/upload-base64 被调用，建议使用 /api/text-to-video/upload-image');
  
  // 返回废弃通知，但仍提供功能以保证兼容性
  res.status(410).json({
    success: false,
    message: '此接口已废弃，请使用 /api/text-to-video/upload-image 进行图片上传',
    deprecated: true,
    recommendation: 'Use /api/text-to-video/upload-image instead'
  });
  return;
  
  // 原有代码保留但不执行
  try {
    const { image, type } = req.body;
    
    if (!image) {
      return res.status(400).json({ 
        success: false,
        message: '未提供图片数据' 
      });
    }
    
    if (type !== 'base64') {
      return res.status(400).json({ 
        success: false,
        message: '只支持Base64格式' 
      });
    }
    
    // 处理Base64数据
    let base64Data = image;
    if (base64Data.startsWith('data:')) {
      base64Data = base64Data.split(',')[1];
    }
    
    // 将Base64转换为Buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // 生成临时文件名
    const tempFileName = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
    const tempFilePath = path.join('uploads', tempFileName);
    
    // 确保uploads目录存在
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads', { recursive: true });
    }
    
    // 写入临时文件
    fs.writeFileSync(tempFilePath, imageBuffer);
    
    try {
      // 导入OSS服务
      const { uploadFile } = require('./utils/ossService');
      
      // 尝试上传到OSS
      try {
        const imageUrl = await uploadFile(tempFilePath, 'images/');
        console.log('Base64图片已上传到OSS:', imageUrl);
        
        // 删除临时文件
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        
        res.json({
          success: true,
          url: imageUrl,
          imageUrl: imageUrl,
          output: {
            img_url: imageUrl
          }
        });
      } catch (ossError) {
        console.error('上传到OSS失败，使用本地存储:', ossError);
        
        // OSS失败时使用本地存储作为降级方案
        const publicPath = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(publicPath)) {
          fs.mkdirSync(publicPath, { recursive: true });
        }
        
        const fileName = `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
        const publicFilePath = path.join(publicPath, fileName);
        
        // 复制文件到public目录
        fs.copyFileSync(tempFilePath, publicFilePath);
        
        // 删除临时文件
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        
        // 返回错误，提示需要配置OSS
        console.log('Base64图片已保存到本地，但万象API无法访问本地地址');
        throw new Error('图片上传失败：万象API需要公网可访问的图片URL，请配置OSS存储服务');
      }
    } catch (error) {
      console.error('处理图片上传失败:', error);
      
      // 删除临时文件
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      
      res.status(500).json({
        success: false,
        message: '处理图片上传失败: ' + error.message
      });
    }
  } catch (error) {
    console.error('处理Base64图片上传失败:', error);
    res.status(500).json({
      success: false,
      message: '处理图片上传失败: ' + error.message
    });
  }
});
// 添加服饰分割路由
app.use('/api/cloth-segmentation', clothingSegmentationRoutes);
// 添加全局风格化路由
app.use('/api/global-style', globalStyleRoutes);
// 添加全局风格化历史记录路由
const { router: globalStyleHistoryRoutes } = require('./routes/global-style-history');
app.use('/api/global-style-history', globalStyleHistoryRoutes);
app.use('/api/fix-diantu-result', fixDiantuResultRoutes);
// 添加亚马逊Listing路由
app.use('/api/amazon-listing', amazonListingRoutes);
// 客服路由
app.use('/api/kefu', kefuRoutes);
// 用户客服API路由
app.use('/api/user-kefu', require('./kefu/kefu-user-api'));

// 功能访问检查API路由
app.use('/api/feature-access', featureAccessRoutes);

// 兼容旧版API路径
app.use('/api', featureAccessRoutes);

// 视频风格重绘下载代理（必须在404处理之前注册）
app.get('/api/video-style-repaint/download', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('缺少 url 参数');
  try {
    const axios = require('axios');
    const response = await axios.get(url, { responseType: 'stream' });
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'attachment; filename="video-style-repaint.mp4"');
    response.data.pipe(res);
  } catch (err) {
    console.error('[video-style-repaint/download] 代理下载失败:', err.message);
    res.status(500).send('下载失败');
  }
});

// 视频去除字幕下载代理
app.get('/api/video-subtitle-removal/download', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    console.error('[video-subtitle-removal/download] 缺少URL参数');
    return res.status(400).send('缺少 url 参数');
  }
  
  console.log('[video-subtitle-removal/download] 请求下载视频:', url);
  
  try {
    const axios = require('axios');
    const response = await axios.get(url, { 
      responseType: 'stream',
      timeout: 30000, // 30秒超时
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    console.log('[video-subtitle-removal/download] 视频类型:', contentType);
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'attachment; filename="video-download.mp4"');
    
    response.data.pipe(res);
    
    // 添加错误处理
    response.data.on('error', (err) => {
      console.error('[video-subtitle-removal/download] 流处理错误:', err.message);
      if (!res.headersSent) {
        res.status(500).send('下载过程中出错');
      }
    });
  } catch (err) {
    console.error('[video-subtitle-removal/download] 代理下载失败:', err.message);
    if (err.response) {
      console.error('  状态码:', err.response.status);
      console.error('  响应头:', JSON.stringify(err.response.headers));
    }
    res.status(500).send('下载失败: ' + err.message);
  }
});

// 获取直接下载的OSS签名URL - 新增API
app.get('/api/direct-download', async (req, res) => {
  const { url, filename } = req.query;
  if (!url) {
    console.error('[direct-download] 缺少URL参数');
    return res.status(400).json({
      success: false,
      message: '缺少URL参数'
    });
  }
  
  console.log('[direct-download] 请求生成OSS直接下载链接:', url);
  
  try {
    // 导入OSS服务
    const { generateSignedUrl, uploadFile } = require('./utils/ossService');
    
    // 生成临时签名URL (15分钟有效)
    const signedUrl = await generateSignedUrl(url, 15);
    
    // 返回签名URL
    res.json({
      success: true,
      url: signedUrl,
      expiresIn: '15分钟'
    });
  } catch (error) {
    console.error('[direct-download] 生成签名URL失败:', error);
    
    // 如果生成签名URL失败，返回错误并提供回退到代理下载的选项
    res.status(500).json({
      success: false,
      message: '生成直接下载链接失败',
      error: error.message,
      fallbackUrl: `/api/download?url=${encodeURIComponent(url)}&filename=${filename || 'download.mp4'}`
    });
  }
});

// 通用下载API - 用于所有类型的文件下载，包括视频数字人
app.get('/api/download', async (req, res) => {
  const { url: rawUrl, filename } = req.query;
  if (!rawUrl) {
    console.error('[download] 缺少URL参数');
    return res.status(400).json({
      success: false,
      message: '缺少URL参数'
    });
  }
  
  // 尝试解码URL（如果已编码）
  let url = rawUrl;
  try {
    // 只解码一次，避免双重解码问题
    if (rawUrl.includes('%')) {
      url = decodeURIComponent(rawUrl);
      console.log('[download] URL已解码');
    }
  } catch (e) {
    console.warn('[download] URL解码失败，使用原始URL:', e.message);
    url = rawUrl;
  }
  
  // 检查URL是否有效
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.error('[download] 无效的URL格式:', url.substring(0, 100));
    return res.status(400).json({
      success: false,
      message: '无效的URL格式，必须以http://或https://开头'
    });
  }
  
  // 记录日志，但限制URL长度避免日志过大
  const logUrl = url.length > 150 ? url.substring(0, 150) + '...' : url;
  console.log('[download] 请求下载/代理文件:', logUrl);
  
  try {
    // 允许跨域访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type');
    
    // 添加CSP头，允许从任何源加载媒体
    res.setHeader('Content-Security-Policy', "default-src 'self'; media-src * blob: data:; img-src * blob: data:; connect-src *;");
    
    // 首先发送HEAD请求检查文件是否存在及其大小
    const axios = require('axios');
    let fileInfo;
    
    try {
      console.log('[download] 发送HEAD请求检查文件:', logUrl);
      fileInfo = await axios.head(url, {
        timeout: 10000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': '*/*',
          'Cache-Control': 'no-cache'
        },
        validateStatus: function (status) {
          return status >= 200 && status < 400; // 接受2xx和3xx的状态码
        }
      });
      
      console.log('[download] 文件信息获取成功:', {
        contentType: fileInfo.headers['content-type'],
        contentLength: fileInfo.headers['content-length'],
        status: fileInfo.status
      });
    } catch (headError) {
      console.error('[download] HEAD请求失败，尝试直接GET请求:', headError.message);
      // 如果HEAD请求失败，继续尝试GET请求
    }
    
    // 获取请求中的Range头，以支持断点续传和视频跳转
    const rangeHeader = req.headers.range;
    let requestOptions = {
      timeout: 60000, // 60秒超时
      maxRedirects: 5,
      responseType: 'stream', // 使用流式处理大文件
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity', // 避免压缩，以便正确处理Range
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      },
      validateStatus: function (status) {
        return status >= 200 && status < 400; // 接受2xx和3xx的状态码
      }
    };
    
    // 如果有Range头，添加到请求中
    if (rangeHeader) {
      console.log('[download] 收到Range请求:', rangeHeader);
      requestOptions.headers['Range'] = rangeHeader;
    }
    
    console.log('[download] 开始下载文件:', logUrl);
    const response = await axios.get(url, requestOptions);
    
    // 获取内容类型和大小
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const contentLength = response.headers['content-length'];
    
    console.log('[download] 文件下载成功:', {
      contentType,
      contentLength: contentLength ? `${Math.round(contentLength / 1024)} KB` : '未知大小',
      status: response.status
    });
    
    // 设置正确的内容类型
    res.setHeader('Content-Type', contentType);
    
    // 如果是视频文件，确保设置正确的视频MIME类型
    if (contentType.includes('video') || url.toLowerCase().endsWith('.mp4')) {
      if (!contentType.includes('mp4')) {
        res.setHeader('Content-Type', 'video/mp4');
      }
    }
    
    // 复制所有相关的响应头
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    if (response.headers['content-range']) {
      res.setHeader('Content-Range', response.headers['content-range']);
      res.status(206); // 部分内容
    } else if (rangeHeader) {
      res.status(206); // 如果客户端请求了范围但源服务器没有返回Content-Range，仍然设置206
    } else {
      res.status(200);
    }
    
    // 设置文件名，优先使用请求中提供的文件名
    const downloadFilename = filename || (url.split('/').pop().split('?')[0] || 'download-file');
    
    // 根据请求类型设置不同的Content-Disposition
    // 如果是直接访问（如视频标签），使用inline；如果是下载，使用attachment
    const isDirectAccess = req.query.direct === 'true' || 
                          (!filename && (contentType.includes('video') || contentType.includes('audio')));
    
    if (isDirectAccess) {
      // 用于直接在浏览器中查看
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloadFilename)}"`);
    } else {
      // 用于下载
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFilename)}"`);
    }
    
    // 设置缓存控制 - 允许短期缓存以提高视频播放性能
    res.setHeader('Cache-Control', 'public, max-age=600'); // 10分钟缓存
    
    // 流式传输数据
    response.data.pipe(res);
    
    // 处理错误
    response.data.on('error', (error) => {
      console.error('[download] 流传输过程中出错:', error);
      if (!res.headersSent) {
        res.status(500).send('下载过程中出错: ' + error.message);
      } else {
        res.end();
      }
    });
    
    // 处理完成
    response.data.on('end', () => {
      console.log('[download] 文件传输完成:', url);
    });
    
  } catch (err) {
    console.error('[download] 代理下载失败:', err.message);
    
    // 提供更详细的错误信息
    let errorDetails = err.message;
    if (err.response) {
      console.error('[download] 响应状态码:', err.response.status);
      errorDetails += ` (状态码: ${err.response.status})`;
      
      if (err.response.headers) {
        console.error('[download] 响应头:', JSON.stringify(err.response.headers));
      }
      
      if (err.response.data) {
        try {
          const dataStr = err.response.data.toString().substring(0, 200);
          console.error('[download] 响应数据片段:', dataStr);
          errorDetails += ` - ${dataStr}`;
        } catch (e) {
          console.error('[download] 无法读取响应数据');
        }
      }
    } else if (err.request) {
      console.error('[download] 请求已发送但未收到响应');
      errorDetails += ' (请求超时或网络错误)';
    } else {
      console.error('[download] 请求配置错误:', err.message);
    }
    
    // 检查是否已发送响应头
    if (!res.headersSent) {
      // 根据错误类型返回不同的状态码
      let statusCode = 500;
      if (err.response) {
        statusCode = err.response.status >= 400 && err.response.status < 600 ? err.response.status : 500;
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        statusCode = 503; // 服务不可用
      }
      
      // 返回JSON错误信息，便于前端处理
      res.status(statusCode).json({
        success: false,
        message: `下载失败: ${errorDetails}`,
        url: logUrl
      });
    } else {
      // 如果已经发送了部分响应，则结束响应
      res.end();
    }
  }
});

// 在路由配置部分的开头处添加数字人视频处理路由

// 静态文件服务 - 这应该在代理之前，确保静态文件优先
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// 添加根目录的HTML文件访问支持
app.use(express.static(path.join(__dirname)));

// 添加日志中间件，记录所有请求路径
app.use((req, res, next) => {
  console.log(`接收请求: ${req.method} ${req.url}`);
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`响应请求: ${req.method} ${req.url} - 状态: ${res.statusCode}`);
    return originalSend.call(this, data);
  };
  next();
});

// 添加用户认证路由
app.use('/api/auth', authRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/admin', adminRoutes);
// 添加文生视频路由
app.use('/api/text-to-video', textToVideoRoutes);
// 添加图像编辑路由
// 添加文生图片路由
app.use('/api/text-to-image', textToImageRoutes);

// 添加日志中间件，记录所有请求路径
app.use((req, res, next) => {
  console.log(`接收请求: ${req.method} ${req.url}`);
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`响应请求: ${req.method} ${req.url} - 状态: ${res.statusCode}`);
    return originalSend.call(this, data);
  };
  next();
});

// 注册视频数字人API路由 - 确保这个路由在其他API路由之前注册
// 导入数字人视频中间件
const { createDigitalHumanMiddleware } = require('./middleware/unifiedFeatureUsage');

// 创建数字人视频中间件实例
const digitalHumanMiddleware = createDigitalHumanMiddleware((videoDuration) => {
  // 根据视频时长计算积分：每秒 9 积分；必须先向上取整到秒，再乘 9，
  // 否则 2.3 秒视频会被错误扣为 ceil(2.3*9)=21 而非 27。
  return Math.ceil(videoDuration) * 9;
});

// 使用已定义在文件底部的配置和处理函数
app.post('/api/digital-human/upload', protect, digitalHumanMiddleware, async (req, res) => {
  console.log('进入数字人视频上传路由 - 预处理');
  
  try {
    // 获取用户ID
    const userId = req.user.id;
    
    // 用户验证和权限检查已由中间件处理
    console.log('数字人视频功能权限检查通过，积分将在任务完成后根据实际生成视频时长扣除');
    
    // 继续处理上传请求...
    if (!digitalHumanUpload) {
      console.error('digitalHumanUpload未定义，检查配置是否正确加载');
      return res.status(500).json({
        success: false,
        message: '服务器配置错误'
      });
    }
    
    // 使用Promise包装multer的中间件处理
    await new Promise((resolve, reject) => {
    digitalHumanUpload.fields([
      { name: 'video', maxCount: 1 },
      { name: 'audio', maxCount: 1 },
      { name: 'image', maxCount: 1 }
    ])(req, res, (err) => {
      if (err) {
        console.error('文件上传中间件错误:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    }).catch(err => {
      throw new Error('文件上传失败: ' + (err.message || '未知错误'));
    });
    
    // 如果执行到这里，说明文件上传成功，可以继续处理
    console.log('文件上传成功，继续处理请求');
  console.log('接收到数字人视频上传请求', req.files ? Object.keys(req.files).length : '无文件');
  
    // 检查是否上传了必要的文件
    if (!req.files || !req.files.video || !req.files.audio) {
      return res.status(400).json({
        success: false,
        message: '请上传视频和音频文件'
      });
    }

    const videoFile = req.files.video[0];
    const audioFile = req.files.audio[0];
    const imageFile = req.files.image ? req.files.image[0] : null;
    
    console.log('收到数字人视频请求，上传文件信息：', {
      video: videoFile.originalname,
      audio: audioFile.originalname,
      image: imageFile ? imageFile.originalname : '无参考图片'
    });

      // 上传文件到阿里云OSS - 直接使用内存buffer
      console.log('开始上传视频到OSS...');
      const videoUrl = await uploadFileToOSS(videoFile.buffer, 'digital-human/videos');
      console.log('开始上传音频到OSS...');
      const audioUrl = await uploadFileToOSS(audioFile.buffer, 'digital-human/audios');
      
      let imageUrl = null;
      if (imageFile) {
        console.log('开始上传图片到OSS...');
        imageUrl = await uploadFileToOSS(imageFile.buffer, 'digital-human/images');
      }

      console.log('文件上传到OSS成功，URL:', {
        videoUrl: videoUrl,
        audioUrl: audioUrl,
        imageUrl: imageUrl
      });

      // 分析视频时长并检查/扣除积分
      let actualCreditCost = 0;
      let isChargedCredits = false;
      
      try {
        // ✅ 获取前端传递的实际视频时长（如果有）
        const frontendVideoDuration = req.body.videoDuration ? parseFloat(req.body.videoDuration) : null;
        console.log('前端传递的视频时长:', frontendVideoDuration, '秒');
        
        console.log('开始分析上传视频的时长...');
        // ✅ 优先使用前端传递的实际时长，如果没有则从视频文件分析
        const videoDuration = await getVideoDuration(videoUrl, frontendVideoDuration);
        console.log(`最终使用的视频时长: ${videoDuration}秒`);
        
        // 检查是否为免费使用
        if (!req.featureUsage?.isFree) {
          // 计算需要的积分
          const getDynamicCredits = req.featureUsage.getDynamicCredits;
          actualCreditCost = getDynamicCredits ? getDynamicCredits(videoDuration) : Math.ceil(videoDuration) * 9;
          
          console.log(`视频时长${videoDuration}秒，需要积分: ${actualCreditCost}`);
          
          // 检查用户积分是否足够
          const user = await User.findByPk(req.user.id);
          if (user.credits >= actualCreditCost) {
            // 有足够积分但先不扣费，等任务完成后按真实时长一次性结算
            // 这里只进行余额校验，预留额度
            isChargedCredits = false;
            
            // 更新使用次数
            const usage = req.featureUsage.usage;
            usage.usageCount += 1;
            usage.lastUsedAt = new Date();
            await usage.save();
            
            console.log(`用户ID ${req.user.id} 扣除 ${actualCreditCost} 积分，剩余 ${user.credits} 积分`);
          } else {
            // 积分不足，拒绝请求
            return res.status(402).json({
              success: false,
              message: `积分不足，需要 ${actualCreditCost} 积分，当前只有 ${user.credits} 积分`,
              data: {
                requiredCredits: actualCreditCost,
                currentCredits: user.credits,
                videoDuration: videoDuration
              }
            });
          }
        } else {
          // 免费使用，更新使用次数
          const usage = req.featureUsage.usage;
          usage.usageCount += 1;
          usage.lastUsedAt = new Date();
          await usage.save();
          
          console.log(`用户ID ${req.user.id} 使用免费次数(${usage.usageCount}/${req.featureUsage.featureConfig.freeUsage})，视频时长: ${videoDuration}秒`);
        }
        
        // 保存视频时长到请求对象
        req.uploadVideoDuration = videoDuration;
        
      } catch (durationError) {
        console.error('分析视频时长失败:', durationError);
        return res.status(500).json({
          success: false,
          message: '无法分析视频时长，请重试'
        });
      }

      // 调用VideoRetalk API创建任务
      console.log('开始创建VideoRetalk任务...');
      // 从请求参数中获取是否需要扩展视频
      const videoExtension = req.body.videoExtension === 'true' || req.body.videoExtension === true;
      
        const taskId = await createVideoRetalkTask(videoUrl, audioUrl, imageUrl, videoExtension);
        console.log('VideoRetalk任务创建成功, 任务ID:', taskId);
        
        // 存储任务信息（包含用户ID）以便后续扣除积分
        if (req.user && req.user.id) {
          // 使用内存或数据库存储任务与用户关联
          if (!global.digitalHumanTasks) {
            global.digitalHumanTasks = {};
          }
          
          global.digitalHumanTasks[taskId] = {
            userId: req.user.id,
            hasChargedCredits: isChargedCredits, // 标记是否已扣除积分
            createdAt: new Date().toISOString(), // ✅ 确保是ISO字符串格式
            isFree: req.featureUsage?.isFree, // 标记是否为免费使用
            getDynamicCredits: req.featureUsage?.getDynamicCredits, // 动态积分计算函数
            actualCreditCost: actualCreditCost, // 实际扣除的积分
            uploadVideoDuration: req.uploadVideoDuration || 0 // 上传时分析的视频时长
          };
          
          console.log(`已关联任务ID ${taskId} 到用户ID ${req.user.id}`);
        }
        
        // 返回任务ID
        return res.status(200).json({
          success: true,
          taskId: taskId,
          message: '任务已提交，请使用任务ID查询处理状态'
        });
    
  } catch (error) {
    console.error('数字人视频处理失败:', error);
    return res.status(500).json({
      success: false,
      message: '处理失败: ' + error.message
    });
  }
});

// 查询VideoRetalk任务状态
app.get('/api/digital-human/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    console.log('查询任务状态:', taskId);
    
    // 检查是否为mock任务ID
    if (taskId.startsWith('mock-task-')) {
      const timestamp = parseInt(taskId.split('-').pop());
      const elapsedSeconds = (Date.now() - timestamp) / 1000;
      
      // 模拟不同阶段的任务状态
      let status = 'PENDING';
      if (elapsedSeconds > 5 && elapsedSeconds <= 15) {
        status = 'RUNNING';
      } else if (elapsedSeconds > 15) {
        status = 'SUCCEEDED';
      }
      
      // 模拟响应
      const response = {
        success: true,
        status: status,
        message: status === 'SUCCEEDED' ? '处理完成' : '处理中',
        requestId: `mock-request-${Date.now()}`
      };
      
      // 如果任务完成，提供一个示例视频URL
      if (status === 'SUCCEEDED') {
        response.videoUrl = 'http://localhost:8080/uploads/sample-output.mp4'; 
      }
      
      console.log('返回模拟任务状态:', response);
      return res.json(response);
    }
    
    // 如果不是mock ID，调用真实API
    const status = await checkVideoRetalkTaskStatus(taskId);
    
              // 如果任务成功完成且有视频URL，计算并扣除积分
    if (status.status === 'SUCCEEDED' && status.videoUrl) {
      try {
        // 保存任务详情，如果积分已在上传时扣除则不重复扣除
        if (global.digitalHumanTasks && 
            global.digitalHumanTasks[taskId]) {
          
          const taskInfo = global.digitalHumanTasks[taskId];
          const userId = taskInfo.userId;
          
          if (userId) {
            console.log(`开始为任务 ${taskId} (用户ID: ${userId}) 保存任务详情`);
            
            // 获取视频时长 - 从实际生成的视频文件获取
            let videoDuration = 0;
            let apiDuration = 0; // API返回的时长（可能只是音频处理时长）
            
            // 记录调试信息
            console.log('完整响应状态数据:', JSON.stringify(status, null, 2));
            
            // 🎯 重要：优先从实际视频文件获取时长（这是真实的输出视频时长）
            try {
              videoDuration = await getVideoDuration(status.videoUrl, null, status);
              console.log(`✅ 从实际视频文件获取时长: ${videoDuration}秒`);
              
              // 记录API返回的时长用于对比
              if (status.usage && status.usage.video_duration) {
                apiDuration = parseFloat(status.usage.video_duration);
                console.log(`📊 API返回的usage.video_duration: ${apiDuration}秒`);
                
                // 如果两个时长差异较大，记录警告
                const diff = Math.abs(videoDuration - apiDuration);
                if (diff > 2) {
                  console.warn(`⚠️ 时长差异较大: 实际视频${videoDuration}秒, API返回${apiDuration}秒, 差异${diff}秒`);
                  console.warn(`⚠️ 将使用实际视频时长（${videoDuration}秒）进行计费`);
                }
              }
            } catch (durationError) {
              console.error('从视频文件获取时长失败，尝试使用API返回值:', durationError);
              
              // 如果无法从视频文件获取，则使用API返回的时长
              if (status.usage && status.usage.video_duration && !isNaN(parseFloat(status.usage.video_duration))) {
                videoDuration = Math.ceil(parseFloat(status.usage.video_duration));
                console.log(`使用API响应的usage.video_duration: ${status.usage.video_duration}秒，取整后: ${videoDuration}秒`);
              } else if (status.videoDuration && !isNaN(parseFloat(status.videoDuration))) {
                videoDuration = Math.ceil(parseFloat(status.videoDuration));
                console.log(`使用API返回的videoDuration: ${videoDuration}秒`);
              } else {
                // 尝试从URL中提取视频ID并查找对应的任务
              const videoIdMatch = status.videoUrl.match(/\/([^\/]+)\.mp4/);
              if (videoIdMatch && videoIdMatch[1]) {
                const videoId = videoIdMatch[1];
                console.log(`尝试从URL中提取视频ID: ${videoId}`);
                
                // 从任务中获取视频时长
                if (global.digitalHumanTasks[videoId] && 
                    global.digitalHumanTasks[videoId].status && 
                    global.digitalHumanTasks[videoId].status.usage && 
                    global.digitalHumanTasks[videoId].status.usage.video_duration) {
                  videoDuration = Math.ceil(parseFloat(global.digitalHumanTasks[videoId].status.usage.video_duration));
                  console.log(`从任务缓存中获取视频时长: ${videoDuration}秒`);
                } else {
                  // 使用视频时长参数
                  const durationMatch = status.videoUrl.match(/duration=(\d+(\.\d+)?)/i);
                  if (durationMatch && durationMatch[1] && !isNaN(parseFloat(durationMatch[1]))) {
                    videoDuration = Math.ceil(parseFloat(durationMatch[1]));
                    console.log(`从URL参数中提取视频时长: ${videoDuration}秒`);
                  } else {
                    // 不再设置默认秒数，保持为0以便后续逻辑处理
                    videoDuration = 0;
                    console.log('⚠️ 无法获取准确时长，保持为0等待后续处理');
                  }
                }
              } else {
                // 不再设置默认秒数，保持为0以便后续逻辑处理
                videoDuration = 0;
                console.log('⚠️ 无法从URL解析到视频ID，保持为0等待后续处理');
              }
              }
            }
            
            // 🔧 修复：即使无法获取实际视频时长，也要使用API返回的时长进行处理
            if (videoDuration <= 0 || videoDuration === null) {
              console.log('⚠️ 无法获取实际视频时长，尝试使用API返回的时长');
              
              // 使用API返回的时长作为备选
              if (status.usage && status.usage.video_duration && !isNaN(parseFloat(status.usage.video_duration))) {
                videoDuration = Math.ceil(parseFloat(status.usage.video_duration));
                console.log(`✅ 使用API返回的usage.video_duration作为备选: ${status.usage.video_duration}秒，取整后: ${videoDuration}秒`);
              } else {
                // 不再设置3秒默认值，保持为0并交由后续校验处理
                videoDuration = 0;
                console.log('⚠️ API也未返回时长，保持为0等待后续处理');
              }
            }
            
            // 确保视频时长至少为1秒
            if (videoDuration < 1) {
              videoDuration = 1;
              console.log(`⚠️ 视频时长小于1秒，设置为最小值: ${videoDuration}秒`);
            }
            
            console.log(`🎯 最终确定的视频时长: ${videoDuration}秒，开始处理积分和记录`);
            
            const taskInfo = global.digitalHumanTasks[taskId];
            // 确保isFree默认为false，避免错误地将任务标记为免费
            const isFree = taskInfo && taskInfo.isFree === true ? true : false;
            const hasChargedCredits = taskInfo && taskInfo.hasChargedCredits ? taskInfo.hasChargedCredits : false;
            
            // 🔧 计费逻辑：使用实际生成的视频时长
            // 从任务记录中获取原始视频时长（用户上传的真实时长）
            let originalVideoDuration = taskInfo && taskInfo.uploadVideoDuration ? taskInfo.uploadVideoDuration : null;
            
            // 🎯 计费使用实际生成的视频时长（而不是API返回的usage.video_duration）
            let billingDuration = Math.ceil(videoDuration);
            console.log(`✅ 使用实际生成的视频时长计费: ${videoDuration}秒（取整${billingDuration}秒），API返回: ${apiDuration}秒，原始上传: ${originalVideoDuration}秒`);
            
            console.log(`视频数字人计费: 原始上传时长=${originalVideoDuration}秒, 实际生成时长=${videoDuration}秒, API返回时长=${apiDuration}秒, 计费时长=${billingDuration}秒, 费率=9积分/秒`);
            
            const uploadCreditCost = taskInfo && taskInfo.actualCreditCost ? taskInfo.actualCreditCost : Math.ceil(billingDuration) * 9;
            
            // 若上传阶段已扣费，则沿用 uploadCreditCost；
            // 否则根据API返回的实际视频时长计算积分（每秒9积分）
            let finalCreditCost = hasChargedCredits ? uploadCreditCost : Math.ceil(billingDuration) * 9;
            
            // 如果是免费使用，则不扣除积分
            if (isFree) {
              finalCreditCost = 0;
            }
            
            console.log(`任务 ${taskId} 积分处理: 扣除=${finalCreditCost} (${isFree ? '免费' : '付费'})，原始时长=${originalVideoDuration}秒，API时长=${videoDuration}秒，计费时长=${billingDuration}秒，上传时已处理=${hasChargedCredits}`);
            
            // 使用统一的任务详情保存函数
            const { saveTaskDetails } = require('./middleware/unifiedFeatureUsage');
            
            // 获取或创建功能使用记录
            const { FeatureUsage } = require('./models/FeatureUsage');
            let usage = await FeatureUsage.findOne({
              where: { userId, featureName: 'DIGITAL_HUMAN_VIDEO' }
            });
            
            if (!usage) {
              usage = await FeatureUsage.create({
                userId,
                featureName: 'DIGITAL_HUMAN_VIDEO',
                usageCount: 0,
                credits: 0,
                lastUsedAt: new Date(),
                resetDate: new Date().toISOString().split('T')[0],
                details: JSON.stringify({ tasks: [] })
              });
            }
            
            await saveTaskDetails(usage, {
              taskId: taskId,
              creditCost: finalCreditCost,
              isFree: isFree,
              featureName: 'DIGITAL_HUMAN_VIDEO', // 添加功能名称参数
              status: 'completed', // 添加状态参数
              extraData: {
                videoDuration: videoDuration,                     // ✅ 使用API返回的实际时长（计费依据）
                originalVideoDuration: originalVideoDuration,     // ✅ 保存原始上传时长（仅作参考）
                uploadCreditCost: uploadCreditCost,
                finalCreditCost: finalCreditCost
              }
            });
            
            // 标记为已处理
            global.digitalHumanTasks[taskId].hasChargedCredits = true;
            global.digitalHumanTasks[taskId].creditCost = finalCreditCost;
            global.digitalHumanTasks[taskId].videoDuration = videoDuration;              // ✅ 使用API返回的实际时长
            global.digitalHumanTasks[taskId].originalVideoDuration = originalVideoDuration; // ✅ 保存原始时长（参考）
            global.digitalHumanTasks[taskId].timestamp = new Date();
            
            // 直接更新用户表中的积分，确保积分管理页面能正确显示
            if (!isFree && finalCreditCost > 0) {
              const user = await User.findByPk(userId);
              if (user) {
                // 不在这里扣除积分，因为handleTaskCompletion函数已经处理了积分扣除
                // 只检查是否已扣除，如果没有扣除，则记录日志
                if (!hasChargedCredits) {
                  console.log(`[数字人视频] 积分将由handleTaskCompletion函数处理，跳过重复扣除: 用户ID=${userId}, 积分=${finalCreditCost}`);
                } else {
                  // 如果已经扣除过积分，但金额不一致，进行调整
                  const previousCost = taskInfo.actualCreditCost || 0;
                  if (previousCost !== finalCreditCost) {
                    const diff = finalCreditCost - previousCost;
                    if (diff !== 0) {
                      // 如果差额为正，补扣积分；如果为负，退还积分
                      user.credits -= diff;
                      await user.save();
                      console.log(`调整用户积分: 用户ID=${userId}, 调整=${diff}, 最终积分=${finalCreditCost}, 剩余=${user.credits}`);
                    } else {
                      // 即使积分金额没有变化，也要确保User表中的积分已被扣除
                      // 这是为了解决积分不显示在积分管理页面的问题
                      console.log(`确认用户积分状态: 用户ID=${userId}, 积分=${finalCreditCost}, 当前余额=${user.credits}`);
                      
                      // 检查用户是否已经被扣除过积分
                      const { FeatureUsage } = require('./models/FeatureUsage');
                      const usage = await FeatureUsage.findOne({
                        where: { userId, featureName: 'DIGITAL_HUMAN_VIDEO' }
                      });
                      
                      if (usage) {
                        try {
                          const details = JSON.parse(usage.details || '{}');
                          const tasks = details.tasks || [];
                          const taskRecord = tasks.find(t => t.taskId === taskId);
                          
                          // 如果找不到任务记录或未标记为已扣费，则扣除积分
                          if (!taskRecord || !taskRecord.hasChargedToUser) {
                            user.credits -= finalCreditCost;
                            await user.save();
                            
                            // 更新任务记录
                            if (taskRecord) {
                              taskRecord.hasChargedToUser = true;
                              usage.details = JSON.stringify({ ...details, tasks });
                              await usage.save();
                            }
                            
                            console.log(`补充扣除用户积分: 用户ID=${userId}, 积分=${finalCreditCost}, 剩余=${user.credits}`);
                          }
                        } catch (parseError) {
                          console.error('解析任务详情失败:', parseError);
                        }
                      }
                    }
                  }
                }
              }
            }
            
            console.log(`数字人视频任务ID ${taskId} 详情保存完成，积分 ${finalCreditCost} (${isFree ? '免费' : '付费'})，原始时长 ${originalVideoDuration}秒，API时长 ${videoDuration}秒，计费时长 ${billingDuration}秒`);
            
            // 使用新的存储服务保存任务（OSS主存储，本地辅助存储）
            try {
              console.log(`🚀 [调试] 开始保存任务到存储，任务ID=${taskId}, 用户ID=${userId}`);
              
              const DigitalHumanOSSStorage = require('./services/digitalHumanOSSStorage');
              const storage = new DigitalHumanOSSStorage();
              
              const taskForStorage = {
                id: taskId,
                taskId: taskId, // 保持兼容性
                status: 'SUCCEEDED',
                videoUrl: status.videoUrl,
                audioUrl: taskInfo.audioUrl || null,
                imageUrl: taskInfo.imageUrl || null,
                videoDuration: videoDuration,  // ✅ 使用API返回的实际视频时长（显示和计费依据）
                originalVideoDuration: originalVideoDuration,  // ✅ 保存原始上传时长（仅作参考）
                creditCost: finalCreditCost,
                createdAt: taskInfo.createdAt || new Date().toISOString(),
                prompt: '视频数字人生成任务',
                hasChargedCredits: true,
                userId: userId, // 添加用户ID
                featureName: 'DIGITAL_HUMAN_VIDEO' // 添加功能名称，确保使用记录正确显示
              };
              
              console.log(`📝 [调试] 任务数据准备完成:`, JSON.stringify(taskForStorage, null, 2));
              
              // 使用新的存储服务添加任务（优先OSS，失败时本地）
              console.log(`💾 [调试] 调用 storage.addTask() 保存任务...`);
              const saveResult = await storage.addTask(taskForStorage, userId);
              
              console.log(`✅ [调试] 数字人任务 ${taskId} 已保存成功！`);
              console.log(`📦 [调试] 保存结果:`, JSON.stringify(saveResult, null, 2));
              console.log(`🗂️  [调试] 存储类型: ${saveResult.storageType}`);
              console.log(`📊 [调试] 当前任务总数: ${saveResult.totalTasks}`);
              
              if (saveResult.storageType === 'local') {
                console.warn(`⚠️ [调试] 任务 ${taskId} 因OSS不可用已保存到本地存储`);
              }
              
              // 注释掉这段代码，因为handleTaskCompletion函数已经处理了积分扣除和记录
              // 这里重复创建CreditHistory记录会导致双倍扣费问题
              console.log(`✅ 跳过重复创建积分记录: 用户ID=${userId}, 积分=${finalCreditCost}, 任务ID=${taskId}，handleTaskCompletion已处理`);
              
              // 检查CreditHistory记录是否已存在
              try {
                const { CreditHistory } = require('./models/CreditHistory');
                const existingRecord = await CreditHistory.findOne({
                  where: {
                    userId: userId,
                    taskId: taskId,
                    featureName: 'DIGITAL_HUMAN_VIDEO'
                  }
                });
                
                if (existingRecord) {
                  console.log(`✅ 确认积分记录已存在: 用户ID=${userId}, 积分=${finalCreditCost}, 任务ID=${taskId}`);
                } else {
                  console.log(`⚠️ 未找到积分记录，但不创建新记录，避免重复扣费: 任务ID=${taskId}`);
                }
              } catch (creditHistoryError) {
                console.error('❌ 检查积分使用记录失败:', creditHistoryError);
              }
              
            } catch (storageError) {
              console.error('❌ [调试] 保存数字人任务失败:', storageError);
              console.error('❌ [调试] 错误堆栈:', storageError.stack);
              
              // 如果新存储服务完全失败，记录错误但不影响响应
              console.warn('⚠️ [调试] 存储服务失败，任务信息仍保留在内存中');
            }
          }
        }
      } catch (detailsError) {
        console.error('保存任务详情失败，但不影响正常响应:', detailsError);
      }
    }
    
    return res.status(200).json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('查询数字人视频任务状态失败:', error);
    return res.status(500).json({
      success: false,
      message: '查询失败: ' + error.message
    });
  }
});

/**
 * 获取视频时长
 * @param {String} videoUrl - 视频URL
 * @returns {Promise<number>} 视频时长（秒）
 * 
 * 注意：视频风格重绘功能已不再使用此函数，而是直接使用前端传递的准确时长
 * 此函数主要用于其他可能需要估算视频时长的功能
 */
async function getVideoDuration(videoUrl, actualDuration = null, statusData = null) {
  try {
    console.log('尝试获取视频时长:', videoUrl);
    
    // 只使用前端传递的实际时长
    if (actualDuration !== null && !isNaN(parseFloat(actualDuration))) {
      const duration = Math.ceil(parseFloat(actualDuration));
      console.log(`使用前端传递的实际视频时长: ${duration}秒`);
      return duration;
    }
    
    // 从完整响应数据中获取videoDuration字段
    if (statusData && statusData.videoDuration && !isNaN(parseFloat(statusData.videoDuration))) {
      const duration = Math.ceil(parseFloat(statusData.videoDuration));
      console.log(`从响应数据的videoDuration字段获取时长: ${duration}秒`);
      return duration;
    }
    
    // 从视频URL中直接提取videoDuration参数
    if (videoUrl && videoUrl.includes('videoDuration=')) {
      try {
        const url = new URL(videoUrl);
        const videoDuration = url.searchParams.get('videoDuration');
        if (videoDuration && !isNaN(parseFloat(videoDuration))) {
          const duration = Math.ceil(parseFloat(videoDuration));
          console.log(`从URL参数中提取视频时长: ${duration}秒`);
          return duration;
        }
      } catch (urlError) {
        console.error('从URL提取视频时长失败:', urlError);
      }
    }
    
    // 如果是阿里云OSS的URL，尝试从URL中提取信息
    if (videoUrl && videoUrl.includes('aliyuncs.com')) {
      try {
        // 从URL中提取时长信息
        const durationMatch = videoUrl.match(/duration=(\d+(\.\d+)?)/i);
        if (durationMatch && durationMatch[1] && !isNaN(parseFloat(durationMatch[1]))) {
          const duration = Math.ceil(parseFloat(durationMatch[1]));
          console.log(`从URL中提取视频时长: ${duration}秒`);
          return duration;
        }
      } catch (ossError) {
        console.error('从阿里云OSS URL提取视频时长失败:', ossError);
      }
    }
    
    // 如果上述方法都失败，尝试从API返回的usage数据中获取
    if (global.digitalHumanTasks && videoUrl) {
      // 尝试从URL中提取taskId
      const taskIdMatch = videoUrl.match(/\/([^\/]+)\.mp4/);
      if (taskIdMatch && taskIdMatch[1]) {
        const possibleTaskId = taskIdMatch[1];
        const task = global.digitalHumanTasks[possibleTaskId];
        if (task && task.status && task.status.usage && task.status.usage.video_duration) {
          const duration = Math.ceil(parseFloat(task.status.usage.video_duration));
          console.log(`从任务状态中获取视频时长: ${duration}秒`);
          return duration;
        }
      }
    }
    
    console.warn('无法通过任何方式获取视频时长，返回null');
    return null;
  } catch (error) {
    console.error('获取视频时长失败:', error);
    return null;
  }
}

// 获取用户积分的API端点
app.get('/api/user/credits', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId, {
      attributes: ['credits']
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    res.json({
      success: true,
      credits: user.credits
    });
  } catch (error) {
    console.error('获取用户积分失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 功能使用跟踪接口（用于免费功能的使用记录）
app.post('/api/credits/track-usage', protect, async (req, res) => {
  try {
    const { action, featureName } = req.body;
    const userId = req.user.id;
    
    console.log(`跟踪功能使用: userId=${userId}, action=${action}, featureName=${featureName}`);
    
    // 检查是否为免费功能
    const freeFeatures = ['IMAGE_RESIZE', 'IMAGE_CROP'];
    
    if (!freeFeatures.includes(featureName)) {
      return res.status(400).json({
        success: false,
        message: '此功能不支持免费跟踪'
      });
    }
    
    // 创建功能使用记录
    const usage = await FeatureUsage.create({
      userId: userId,
      featureName: featureName,
      action: action || 'use',
      credits: 0, // 免费功能积分为0
      isFree: true, // 标记为免费使用
      status: 'completed',
      details: JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'free_feature',
        description: `免费使用${featureName}功能`
      }),
      lastUsedAt: new Date()
    });
    
    console.log('免费功能使用记录已创建:', usage.id);
    
    res.json({
      success: true,
      data: {
        id: usage.id,
        featureName: featureName,
        isFree: true,
        credits: 0,
        timestamp: usage.createdAt
      }
    });
    
  } catch (error) {
    console.error('跟踪功能使用失败:', error);
    res.status(500).json({
      success: false,
      message: '跟踪功能使用失败',
      error: error.message
    });
  }
});

// 虚拟模特试穿功能 - 直接嵌入iframe编辑器
app.get('/virtual-model', async (req, res) => {
  try {
    let userId = "guest"; // 默认访客ID
    
    // 从认证token中获取用户ID
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.id) {
          userId = decoded.id;
        }
      } catch (error) {
        console.error('解析token失败:', error.message);
      }
    } else {
      // 尝试从cookie中获取
      const token = req.cookies && req.cookies.authToken;
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded && decoded.id) {
            userId = decoded.id;
          }
        } catch (error) {
          console.error('解析cookie token失败:', error.message);
        }
      }
    }
    
    // 检查用户积分
    let checkFeature = true;
    if (userId !== "guest") {
      try {
        const user = await User.findByPk(userId);
        if (user) {
          // 获取功能配置
          const featureConfig = FEATURES['virtual-model'] || { creditCost: 10, freeUsage: 3 };
          
          // 检查是否有足够的免费使用次数或积分
          const usageCount = user.featureUsage && user.featureUsage['virtual-model'] ? user.featureUsage['virtual-model'] : 0;
          
          if (usageCount < featureConfig.freeUsage || user.credits >= featureConfig.creditCost) {
            checkFeature = true;
          } else {
            checkFeature = false;
          }
        }
      } catch (error) {
        console.error('检查用户积分失败:', error);
      }
    }
    
    if (!checkFeature) {
      // 如果积分不足，重定向到积分页面
      return res.redirect('/credits.html?feature=virtual-model');
    }
    
    // 现在，我们不再直接渲染HTML，而是重定向到静态HTML页面
    // 这样可以避免iframe加载问题，使用我们优化过的HTML页面
    console.log('重定向到virtual-model-redirect.html');
    return res.redirect('/virtual-model-redirect.html');
    
  } catch (error) {
    console.error('构建编辑器页面失败:', error);
    // 如果出错，发送一个简单的错误页面
    res.status(500).send(`
      <html>
        <head><title>错误</title></head>
        <body>
          <h1>加载编辑器时出错</h1>
          <p>${error.message}</p>
          <a href="/">返回首页</a>
        </body>
      </html>
    `);
  }
});

// 受保护的API路由示例 - 需要登录才能访问
app.get('/api/protected', protect, (req, res) => {
  res.json({
    success: true,
    message: '这是受保护的路由，只有登录用户才能访问',
    user: req.user
  });
});

// 应用代理到特定API路径
app.use('/editor', editorProxy);
app.use('/editor-proxy', editorProxy);
app.use('/rest', editorProxy);
app.use('/api/rest', editorProxy);

// 导入智能扩图历史记录路由
const imageExpansionHistoryRoutes = require('./routes/image-expansion-history');
// 注册智能扩图历史记录API路由
app.use('/api/image-expansion-history', imageExpansionHistoryRoutes);

// 导入模糊图片变清晰历史记录路由
const imageSharpenHistoryRoutes = require('./routes/image-sharpen-history');
// 注册模糊图片变清晰历史记录API路由
app.use('/api/image-sharpen-history', imageSharpenHistoryRoutes);

// 导入图片换脸历史记录路由
const faceFusionHistoryRoutes = require('./routes/face-fusion-history');
// 注册图片换脸历史记录API路由
app.use('/api/face-fusion-history', faceFusionHistoryRoutes);


// 导入图像上色功能路由
const imageColorizationRoutes = require('./routes/imageColorization');
// 注册图像上色功能API路由
app.use('/api/image-colorization', imageColorizationRoutes);

// 导入图像上色历史记录路由
const imageColorizationHistoryRoutes = require('./routes/image-colorization-history');
// 注册图像上色历史记录API路由
app.use('/api/image-colorization-history', imageColorizationHistoryRoutes);

// 导入垫图OSS历史记录路由
const diantuHistoryOSSRoutes = require('./routes/diantu-history-oss');
// 注册垫图OSS历史记录API路由
app.use('/api/diantu-history', diantuHistoryOSSRoutes);

// 导入智能服饰分割历史记录路由
const clothSegmentationHistoryRoutes = require('./routes/cloth-segmentation-history');
// 注册智能服饰分割历史记录API路由
app.use('/api/cloth-segmentation/history', clothSegmentationHistoryRoutes);

// 导入图像高清放大历史记录路由
const imageUpscalerHistoryRoutes = require('./routes/image-upscaler-history');
// 注册图像高清放大历史记录API路由
app.use('/api/image-upscaler-history', imageUpscalerHistoryRoutes);

// 导入局部重绘历史记录路由
const localRedrawHistoryRoutes = require('./routes/local-redraw-history');
// 注册局部重绘历史记录API路由
app.use('/api/local-redraw-history', localRedrawHistoryRoutes);

// 添加上传到OSS的路由
const uploadToOssRouter = require('./routes/upload-to-oss');
app.use('/api/upload-to-oss', uploadToOssRouter);

// 添加垫图历史记录路由（旧版本，已弃用）
// const diantuHistoryRouter = require('./routes/diantu-history');
// app.use('/api/diantu-history', diantuHistoryRouter);

// 处理编辑器路径上的其他请求，但确保静态文件优先
app.use('/editor/*', editorProxy);
app.use('/*.html', (req, res, next) => {
  // 如果是已知的静态HTML文件，则跳过代理
  const requestPath = req.path;
  const htmlPath = path.join(__dirname, 'public', requestPath);
  if (fs.existsSync(htmlPath)) {
    return next();
  }
  // 否则交给代理处理
  editorProxy(req, res, next);
});

// 添加阿里云OSS代理中间件
const ossResourcesProxy = createProxyMiddleware({
  target: 'https://aidge-fe.oss-ap-southeast-1.aliyuncs.com',
  changeOrigin: true,
  secure: false,
  onProxyRes: function(proxyRes, req, res) {
    // 删除可能导致CORS问题的响应头
    delete proxyRes.headers['content-security-policy'];
    delete proxyRes.headers['x-frame-options'];
    
    // 修改响应头处理跨域
    proxyRes.headers['access-control-allow-origin'] = '*';
    proxyRes.headers['access-control-allow-methods'] = 'GET, OPTIONS';
    
    // 添加缓存控制以提高性能
    proxyRes.headers['cache-control'] = 'public, max-age=86400';
    
    console.log(`OSS资源代理: ${req.method} ${req.path} -> ${proxyRes.statusCode}`);
  },
  onError: function(err, req, res) {
    console.error('OSS资源代理错误:', err);
    res.status(502).send('代理服务器错误: ' + err.message);
  }
});

// 应用OSS资源代理
app.use('/oss-resources', ossResourcesProxy);

// 创建阿里云CDN资源的代理中间件
const aliyunCdnProxy = createProxyMiddleware({
  target: 'https://aliyun-cdn.aidc-ai.com',
  changeOrigin: true,
  pathRewrite: {
    '^/aliyun-cdn': ''
  },
  onProxyRes: function(proxyRes, req, res) {
    // 设置CORS头
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    // 删除可能导致CORS问题的头
    delete proxyRes.headers['x-frame-options'];
    delete proxyRes.headers['x-content-type-options'];
    delete proxyRes.headers['x-xss-protection'];
    delete proxyRes.headers['content-security-policy'];
    
    // 设置缓存控制
    if (req.url.match(/\.(ttf|woff|woff2|eot|svg|jpg|jpeg|png|gif|css|js)$/i)) {
      proxyRes.headers['Cache-Control'] = 'public, max-age=86400';
    }
    
    // 记录代理请求
    console.log(`[Aliyun CDN Proxy] ${req.method} ${req.url}`);
  },
  logLevel: 'silent'
});

// 只为特定路径启用CORS
app.use('/virtual-model-proxy', (req, res, next) => {
  // 设置允许跨域访问的域名，*表示允许任何域名
  res.setHeader('Access-Control-Allow-Origin', '*');
  // 设置允许的请求方法
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  // 设置允许的请求头
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  // 设置预检请求的缓存时间
  res.setHeader('Access-Control-Max-Age', '1728000');
  // 允许发送Cookie
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // 对OPTIONS请求直接返回200
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// 应用虚拟模特编辑器代理 - 注释掉，不使用代理
// app.use('/virtual-model-proxy', virtualModelEditorProxy);

// 应用阿里云CDN代理
app.use('/aliyun-cdn', aliyunCdnProxy);

// 创建阿里云OSS字体资源的代理中间件
const aliyunOssFontProxy = createProxyMiddleware({
  target: 'https://aidge-fe.oss-ap-southeast-1.aliyuncs.com',
  changeOrigin: true,
  pathRewrite: {
    '^/fonts': '/fonts'
  },
  onProxyRes: function(proxyRes, req, res) {
    // 删除所有可能导致CORS问题的响应头
    delete proxyRes.headers['content-security-policy'];
    delete proxyRes.headers['x-frame-options'];
    delete proxyRes.headers['x-content-type-options'];
    
    // 设置CORS头允许所有来源
    proxyRes.headers['access-control-allow-origin'] = '*';
    proxyRes.headers['access-control-allow-methods'] = 'GET, OPTIONS';
    
    // 为字体文件设置缓存
    if (req.url.match(/\.(woff|woff2|ttf|eot)/i)) {
      proxyRes.headers['cache-control'] = 'public, max-age=604800';
    }
    
    console.log(`阿里云字体代理: ${req.method} ${req.path} -> ${proxyRes.statusCode}`);
  }
});

// 为fonts路径添加CORS中间件
app.use('/fonts', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// 应用阿里云OSS字体资源代理
app.use('/fonts', aliyunOssFontProxy);

/**
 * 将二进制数组转换为大写的十六进制字符串
 * 对标Java中的byte2hex方法
 */
function byte2hex(bytes) {
  let sign = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    let hex = (byte & 0xFF).toString(16);
    if (hex.length === 1) {
      sign += '0';
    }
    sign += hex.toUpperCase();
  }
  return sign;
}

/**
 * HMAC-SHA256加密实现
 * 对标Java中的encryptHMACSHA256方法
 */
function encryptHMACSHA256(data, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(data, 'utf8');
  return hmac.digest();
}

/**
 * 签名API请求
 * 对标Java中的signApiRequest方法
 */
function signApiRequest(params, appSecret, signMethod, apiName) {
  // 第一步：检查参数是否已经排序
  const keys = Object.keys(params).sort();
  
  // 第二步和第三步：把API名和参数串在一起
  let query = apiName;
  
  for (const key of keys) {
    const value = params[key];
    if (key && value) {
      query += key + value;
    }
  }
  
  console.log('Query string for signing:', query);
  
  // 第四步：使用加密算法
  let bytes;
  if (signMethod === SIGN_METHOD_SHA256) {
    bytes = encryptHMACSHA256(query, appSecret);
  }
  
  // 第五步：把二进制转化为大写的十六进制
  return byte2hex(bytes);
}

/**
 * 获取签名响应
 * 对标Java中的getSignResponse方法
 */
function getSignResponse(params, api) {
  try {
    const time = Date.now();
    const signParams = { ...params };
    
    signParams.app_key = APP_KEY;
    signParams.sign_method = SIGN_METHOD_SHA256;
    signParams.timestamp = String(time);
    
    const signStr = signApiRequest(signParams, SECRET_KEY, SIGN_METHOD_SHA256, api);
    
    return {
      signStr: signStr,
      appKey: APP_KEY,
      targetAppKey: APP_KEY,
      signMethod: SIGN_METHOD_SHA256,
      timestamp: time
    };
  } catch (error) {
    console.error('Generate sign error:', error);
    return null;
  }
}

// 签名API - 使用文档要求的路径/open/api/signature
app.post('/open/api/signature', (req, res) => {
  try {
    console.log('接收签名请求:', JSON.stringify(req.body, null, 2));
    const { api, params } = req.body;
    
    // 验证入参格式
    if (!api) {
      console.error('入参错误: 缺少api字段');
      return res.status(400).json({
        code: 400,
        message: "缺少api字段",
        success: false,
        requestId: Date.now().toString(),
        data: null,
        result: null
      });
    }
    
    if (!params) {
      console.error('入参错误: 缺少params字段');
      return res.status(400).json({
        code: 400,
        message: "缺少params字段",
        success: false,
        requestId: Date.now().toString(),
        data: null,
        result: null
      });
    }
    
    console.log(`✅ 入参格式正确: api=${api}, params包含${Object.keys(params).length}个参数`);
    
    // 使用新的签名方法
    const signData = getSignResponse(params, api);
    
    if (!signData) {
      throw new Error('生成签名失败');
    }
    
    // 构造符合要求的返回结果
    const result = {
      code: 200,
      message: "",
      success: true,
      requestId: signData.timestamp.toString() + Math.floor(Math.random() * 1000).toString(),
      data: signData,
      result: null
    };
    
    console.log('签名结果:', JSON.stringify(result, null, 2));
    res.json(result);
  } catch (error) {
    console.error('生成签名失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message,
      success: false,
      requestId: Date.now().toString(),
      data: null,
      result: null
    });
  }
});

// 同时支持新的/api/signature路径
app.post('/api/signature', (req, res) => {
  try {
    console.log('接收签名请求(新路径):', JSON.stringify(req.body, null, 2));
    const { api, params } = req.body;
    
    // 验证入参格式
    if (!api) {
      console.error('入参错误: 缺少api字段');
      return res.status(400).json({
        code: 400,
        message: "缺少api字段",
        success: false,
        requestId: Date.now().toString(),
        data: null,
        result: null
      });
    }
    
    if (!params) {
      console.error('入参错误: 缺少params字段');
      return res.status(400).json({
        code: 400,
        message: "缺少params字段",
        success: false,
        requestId: Date.now().toString(),
        data: null,
        result: null
      });
    }
    
    console.log(`✅ 入参格式正确: api=${api}, params包含${Object.keys(params).length}个参数`);
    
    // 使用新的签名方法
    const signData = getSignResponse(params, api);
    
    if (!signData) {
      throw new Error('生成签名失败');
    }
    
    // 构造符合要求的返回结果
    const result = {
      code: 200,
      message: "",
      success: true,
      requestId: signData.timestamp.toString() + Math.floor(Math.random() * 1000).toString(),
      data: signData,
      result: null
    };
    
    console.log('签名结果(新路径):', JSON.stringify(result, null, 2));
    res.json(result);
  } catch (error) {
    console.error('生成签名失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message,
      success: false,
      requestId: Date.now().toString(),
      data: null,
      result: null
    });
  }
});

// 图片上传接口 - 移动到后面，避免与/api/upload/image冲突

// 保存结果API（需登录，确保写入到当前用户）
app.post('/api/save-result', protect, async (req, res) => {
  try {
    console.log('接收到保存结果请求:', req.body);
    const resultData = req.body;
    const timestamp = Date.now();
    
    // 验证关键字段
    if (!resultData.processedImageUrl) {
      console.error('保存失败：缺少处理后图片URL');
      return res.status(400).json({ 
        success: false, 
        error: '保存失败', 
        message: '缺少处理后图片URL'
      });
    }
    
    // 使用认证中间件提供的用户ID
    const userId = req.user?.id || null;
    console.log('保存结果：当前用户ID:', userId);
    
    // 检查是否为文生图片类型，如果是，先检查是否已存在相同图片
    if (resultData.processType === '文生图片' || resultData.type === 'TEXT_TO_IMAGE') {
      // 检查是否已存在相同图片的历史记录
      const existingRecord = await ImageHistory.findOne({
        where: {
          userId,
          processedImageUrl: resultData.processedImageUrl,
          type: 'TEXT_TO_IMAGE'
        }
      });

      if (existingRecord) {
        console.log('文生图片已存在于历史记录中，不再重复保存:', {
          userId,
          imageUrl: resultData.processedImageUrl.substring(0, 50) + '...',
          recordId: existingRecord.id
        });
        
        return res.json({
          success: true,
          message: '图片已在下载中心',
          data: {
            id: existingRecord.id,
            imageUrl: existingRecord.processedImageUrl
          }
        });
      }
      
      // 检查是否是来自前端的手动保存请求，而不是自动保存
      // 如果请求中没有明确的saveAction字段为manual，则拒绝保存
      if (!resultData.saveAction || resultData.saveAction !== 'manual') {
        console.log('拒绝自动保存文生图片到下载中心:', {
          userId,
          imageUrl: resultData.processedImageUrl.substring(0, 50) + '...'
        });
        
        return res.json({
          success: false,
          message: '文生图片需要手动点击保存到下载中心按钮才能保存',
          requireManualSave: true
        });
      }
      
      console.log('用户手动请求保存文生图片到下载中心:', {
        userId,
        imageUrl: resultData.processedImageUrl.substring(0, 50) + '...'
      });
    }
    
    // 检查原始图片是否为base64格式，如果是且过大，则考虑转存为文件或使用OSS
    const maxUrlLength = 16777215; // LONGTEXT字段最大长度
    const maxAllowedPacket = 4194304; // 假设MySQL max_allowed_packet为4MB
    let originalImageUrl = resultData.originalImageUrl;
    let processedImageUrl = resultData.processedImageUrl;
    
    // 处理原始图片URL
    if (originalImageUrl && originalImageUrl.length > maxAllowedPacket) {
      console.log(`原始图片URL过大 (${originalImageUrl.length} 字符)，超出MySQL max_allowed_packet限制，将转为OSS存储`);
      // 这里应该添加将base64转为文件并上传到OSS的逻辑
      // 暂时先截断，防止数据库错误
      originalImageUrl = null; // 暂时不保存原始图片
    } else if (originalImageUrl && originalImageUrl.length > 1000000) {
      console.log(`原始图片URL较大 (${originalImageUrl.length} 字符)，已使用LONGTEXT字段存储`);
    }
    
    // 处理处理后的图片URL
    if (processedImageUrl && processedImageUrl.length > maxAllowedPacket) {
      console.log(`处理后图片URL过大 (${processedImageUrl.length} 字符)，超出MySQL max_allowed_packet限制，将转为OSS存储`);
      // 这里应该添加将base64转为文件并上传到OSS的逻辑
      // 暂时先使用OSS上已有的图片URL
      if (resultData.imageUrl && resultData.imageUrl.startsWith('http')) {
        processedImageUrl = resultData.imageUrl;
        console.log('使用OSS图片URL替代base64数据');
      } else {
        // 如果没有OSS URL，暂时截断base64数据
        processedImageUrl = processedImageUrl.substring(0, maxAllowedPacket - 1000);
        console.log('截断过长的base64数据以适应数据库限制');
      }
    } else if (processedImageUrl && processedImageUrl.length > 1000000) {
      console.log(`处理后图片URL较大 (${processedImageUrl.length} 字符)，已使用LONGTEXT字段存储`);
    }
    
    // 保存到数据库
    console.log('准备保存到数据库，数据:', {
      userId: userId,
      processType: resultData.processType,
      originalImageUrl: originalImageUrl ? originalImageUrl.substring(0, 50) + '...' : null,
      processedImageUrl: processedImageUrl.substring(0, 50) + '...'
    });
    
    const imageHistory = await ImageHistory.create({
      userId: userId,
      originalImageUrl: originalImageUrl,
      processedImageUrl: processedImageUrl,
      imageUrl: processedImageUrl,
      type: resultData.type || 'IMAGE_EDIT',
      processType: resultData.processType || '图片处理',
      processTime: resultData.processTime || new Date(),
      description: resultData.description,
      metadata: resultData.metadata || {}
    });
    
    console.log('保存图片历史记录成功:', imageHistory.id);
    
    // 数据已保存到数据库，不再额外生成JSON文件备份
    // console.log('数据已保存到数据库，跳过JSON文件备份');
    
    res.json({ 
      success: true, 
      timestamp,
      id: imageHistory.id 
    });
    
    // 移除营销图补偿逻辑 — 每次点击立即生成已在前端调用 /track-usage 完成扣费
  } catch (error) {
    console.error('保存结果失败:', error);
    res.status(500).json({ error: '保存结果失败', message: error.message });
  }
});

// 获取历史结果API（需登录，仅返回当前用户记录）
app.get('/api/history', protect, async (req, res) => {
  try {
    console.log('接收到获取历史记录请求');
    const userId = req.user.id;
    // 查询条件：仅当前用户
    const whereClause = { userId };
    
    // 支持按类型过滤
    if (req.query.type) {
      // 处理文生图片历史记录特殊情况
      if (req.query.type === 'TEXT_TO_IMAGE_HISTORY') {
        // 使用条件来匹配所有文生图片相关类型
        whereClause[sequelize.Op.or] = [
          { type: 'TEXT_TO_IMAGE' },
          { type: 'TEXT_TO_IMAGE_HISTORY' },
          { taskType: 'TEXT_TO_IMAGE' },
          { processType: 'TEXT_TO_IMAGE' }
        ];
        console.log('历史记录请求：按文生图片类型过滤');
      } else {
        // 其他类型正常处理
        whereClause.type = req.query.type;
        console.log('历史记录请求：按类型过滤', req.query.type);
      }
    }
    
    console.log('查询条件:', whereClause);
    
    // 检查数据库连接
    try {
      await sequelize.authenticate();
      console.log('数据库连接正常');
    } catch (dbError) {
      console.error('数据库连接错误:', dbError);
      return res.status(500).json({ 
        success: false, 
        error: '数据库连接错误', 
        message: '无法连接到数据库，请稍后再试' 
      });
    }
    
    // 查询数据库
    const records = await ImageHistory.findAll({
      where: whereClause,
      order: [['processTime', 'DESC']],
      limit: 50
    });
    
    console.log(`查询成功，找到 ${records.length} 条记录`);
    
    // 检查每条记录的有效性
    const validRecords = records.map(record => {
      const data = record.toJSON();
      // 确保关键字段存在
      if (!data.processedImageUrl) {
        console.warn(`记录 ${data.id} 缺少处理后图片URL`);
      }
      return data;
    });
    
    res.json({ 
      success: true,
      results: validRecords,
      count: validRecords.length
    });
  } catch (error) {
    console.error('获取历史记录失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取历史记录失败', 
      message: error.message 
    });
  }
});

// 删除单个历史记录API
app.delete('/api/delete-image/:id', async (req, res) => {
  try {
    const imageId = req.params.id;
    
    // 从请求中获取用户信息（如果已登录）
    let userId = null;
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          userId = decoded.id;
        } catch (error) {
          console.log('Token验证失败，将作为公共记录处理', error.message);
        }
      }
    }
    
    // 查找记录
    const imageRecord = await ImageHistory.findByPk(imageId);
    
    if (!imageRecord) {
      return res.status(404).json({ 
        success: false, 
        message: '图片记录不存在' 
      });
    }
    
    // 检查权限（如果是用户的记录，需要验证用户ID匹配）
    if (imageRecord.userId !== null && imageRecord.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: '无权删除此图片记录' 
      });
    }
    
    // 删除记录
    await imageRecord.destroy();
    
    // 不再需要删除JSON文件，因为已经停止创建
    
    res.json({ 
      success: true, 
      message: '成功删除图片记录'
    });
  } catch (error) {
    console.error('删除图片记录失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '删除图片记录失败', 
      message: error.message 
    });
  }
});

// 批量删除历史记录API
app.post('/api/delete-images', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: '无效的请求参数，缺少有效的图片ID列表' 
      });
    }
    
    // 从请求中获取用户信息（如果已登录）
    let userId = null;
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          userId = decoded.id;
        } catch (error) {
          console.log('Token验证失败，将作为公共记录处理', error.message);
        }
      }
    }
    
    // 查询条件 - 仅删除用户有权限删除的记录
    const whereClause = {
      id: ids
    };
    
    // 如果用户已登录，只允许删除自己的或公共记录
    if (userId) {
      whereClause.userId = [userId, null];
    } else {
      // 未登录用户只能删除公共记录
      whereClause.userId = null;
    }
    
    // 执行批量删除
    const result = await ImageHistory.destroy({
      where: whereClause
    });
    
    res.json({ 
      success: true, 
      message: `成功删除${result}条图片记录`,
      deletedCount: result
    });
  } catch (error) {
    console.error('批量删除图片记录失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '批量删除图片记录失败', 
      message: error.message 
    });
  }
});

// 添加测试多图转视频端点（绕过认证）
app.post('/api/test-multi-image-to-video', memoryUpload.array('images', 40), async (req, res) => {
    try {
        console.log('收到测试多图转视频请求:', JSON.stringify(req.body, null, 2));
        console.log('上传的文件数量:', req.files ? req.files.length : 0);
        console.log('转场风格参数:', req.body.transition, '类型:', typeof req.body.transition);
        
        const { transition = 'slide', duration = 10, music = 'none' } = req.body;
        
        // 验证参数
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请上传至少一张图片'
            });
        }
        
        if (req.files.length > 40) {
            return res.status(400).json({
                success: false,
                message: '最多只能上传40张图片'
            });
        }
        
        // 生成任务ID
        const taskId = `TEST_MULTI_IMAGE_TO_VIDEO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 创建任务记录
        const task = {
            id: taskId,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            parameters: {
                imageCount: req.files.length,
                transition: transition,
                duration: parseInt(duration),
                music: music
            },
            error: null,
            errorDetails: null
        };
        
        // 存储任务到内存缓存
        if (!global.taskCache) {
            global.taskCache = {};
        }
        global.taskCache[taskId] = task;
        
        console.log('测试任务已创建:', taskId);
        
        // 模拟处理过程
        setTimeout(async () => {
            try {
                console.log('开始处理测试任务:', taskId);
                
                // 模拟处理成功，测试正常流程
                task.status = 'SUCCESS';
                task.videoUrl = 'https://example.com/test-video.mp4';
                task.videoCoverUrl = 'https://example.com/test-cover.jpg';
                task.videoDuration = parseInt(duration) || 10;
                task.videoWidth = 1920;
                task.videoHeight = 1080;
                task.error = null;
                task.errorDetails = null;
                
                console.log('测试任务处理完成（成功）:', taskId);
            } catch (error) {
                console.error('测试任务处理错误:', error);
                task.status = 'FAILED';
                task.error = error.message;
                task.errorDetails = {
                    message: error.message,
                    code: 'PROCESSING_ERROR',
                    status: 'FAILED',
                    timestamp: new Date().toISOString()
                };
            }
        }, 2000);
        
        res.json({
            success: true,
            taskId: taskId,
            message: '测试任务已创建，正在处理中...'
        });
        
    } catch (error) {
        console.error('测试多图转视频API错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 添加API测试端点
app.get('/test-api-call', (req, res) => {
  try {
    // 准备API参数
    const apiDomain = 'cn-api.aidc-ai.com';
    const apiName = '/ai/image/cut/out'; // 以裁剪API为例
    const timestamp = Date.now();
    
    // 创建参数
    const params = {
      app_key: APP_KEY,
      sign_method: SIGN_METHOD_SHA256,
      timestamp: String(timestamp)
    };
    
    // 生成签名
    const sign = signApiRequest(params, SECRET_KEY, SIGN_METHOD_SHA256, apiName);
    
    // 构建API URL
    const apiUrl = `https://${apiDomain}/rest${apiName}?partner_id=aidge&sign_method=sha256&sign_ver=v2&app_key=${APP_KEY}&timestamp=${timestamp}&sign=${sign}`;
    
    // 构建请求数据
    const requestData = {
      imageUrl: "https://ae01.alicdn.com/kf/Sa78257f1d9a34dad8ee494178db12ec8l.jpg",
      backGroundType: "WHITE_BACKGROUND"
    };
    
    // 返回测试信息
    res.send(`
      <h1>API调用测试</h1>
      <p>以下是调用API的示例，您可以复制到命令行执行：</p>
      <pre>
curl -X POST '${apiUrl}' \\
--header 'Content-Type: application/json' \\
--header 'x-iop-trial: true' \\
--data '${JSON.stringify(requestData)}'
      </pre>
      
      <p>API信息:</p>
      <ul>
        <li>API域名: ${apiDomain}</li>
        <li>API路径: ${apiName}</li>
        <li>AppKey: ${APP_KEY}</li>
        <li>时间戳: ${timestamp}</li>
        <li>签名: ${sign}</li>
      </ul>
      
      <p>签名生成方法:</p>
      <pre>
// 1. 构造参数
const params = {
  app_key: "${APP_KEY}",
  sign_method: "${SIGN_METHOD_SHA256}",
  timestamp: "${timestamp}"
};

// 2. 构造签名字符串
let query = "${apiName}";
for (const key of Object.keys(params).sort()) {
  query += key + params[key];
}
// query = "${apiName}app_key${APP_KEY}sign_method${SIGN_METHOD_SHA256}timestamp${timestamp}"

// 3. HMAC-SHA256加密
const hmac = crypto.createHmac('sha256', "${SECRET_KEY}");
hmac.update(query);
const signature = hmac.digest();

// 4. 转成大写十六进制
const sign = byte2hex(signature);
// sign = "${sign}"
</pre>
      
      <p><strong>注意:</strong> 这只是一个演示。实际使用中，您需要从服务器端发起API请求，而不是从浏览器。</p>
    `);
  } catch (error) {
    console.error('生成API测试失败:', error);
    res.status(500).send('生成API测试失败: ' + error.message);
  }
});

// 添加API代理调用端点 - 实际调用API
app.post('/api/call-service', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: '缺少imageUrl参数' });
    }
    
    // 准备API参数
    const apiDomain = 'cn-api.aidc-ai.com';
    const apiName = '/ai/image/cut/out'; // 以裁剪API为例
    
    // 创建参数
    const params = {
      app_key: APP_KEY,
      sign_method: SIGN_METHOD_SHA256,
      timestamp: String(Date.now())
    };
    
    // 生成签名
    const sign = signApiRequest(params, SECRET_KEY, SIGN_METHOD_SHA256, apiName);
    
    // 构建API URL
    const apiUrl = `https://${apiDomain}/rest${apiName}?partner_id=aidge&sign_method=sha256&sign_ver=v2&app_key=${params.app_key}&timestamp=${params.timestamp}&sign=${sign}`;
    
    // 构建请求数据
    const requestData = {
      imageUrl: imageUrl,
      backGroundType: "WHITE_BACKGROUND"
    };
    
    console.log('调用API:', apiUrl);
    console.log('请求数据:', requestData);
    
    // 这里应该使用适当的HTTP客户端库发起请求
    // 例如node-fetch或axios
    // 为了简单演示，这里返回模拟数据
    res.json({
      success: true,
      message: '这是一个模拟的API调用响应。实际应用中，您需要使用node-fetch或axios等库发起HTTP请求到API服务器。',
      requestUrl: apiUrl,
      requestData: requestData
    });
  } catch (error) {
    console.error('API调用失败:', error);
    res.status(500).json({ error: 'API调用失败', message: error.message });
  }
});

// API路由 - 图像高清放大 - 使用统一中间件
app.post('/api/image-upscaler', protect, createUnifiedFeatureMiddleware('image-upscaler'), memoryUpload.single('image'), async (req, res) => {
  try {
    console.log('接收到图像高清放大请求');
    
    // 检查请求
    if (!req.file) {
      return res.status(400).json({ success: false, message: '没有上传图片' });
    }
    
    const upscaleFactor = parseInt(req.body.upscaleFactor) || 2;
    if (upscaleFactor < 2 || upscaleFactor > 4) {
      return res.status(400).json({ success: false, message: '放大倍数必须在2-4之间' });
    }
    
    // 从统一中间件获取积分使用信息
    const userId = req.user.id;
    const { usageType, creditCost, isFree } = req.featureUsage;
    
    // 读取上传的图片文件
    const imageBuffer = req.file.buffer;
    const originalName = req.file.originalname;
    
    console.log(`处理图片: ${originalName}, 放大倍数: ${upscaleFactor}`);
    
    // 生成唯一任务ID - 提前生成以便在失败时使用
    const taskId = `upscale-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    try {
      // 1. 上传图片到OSS获取可公开访问的URL
      console.log('上传图片到OSS...');
      const imageUrl = await uploadToOSS(imageBuffer, originalName, 'upscaler');
      
      // 2. 保存任务信息到全局变量（先设置为PENDING状态）
      global.imageUpscalerTasks = global.imageUpscalerTasks || {};
      global.imageUpscalerTasks[taskId] = {
        userId: userId,
        creditCost: isFree ? 0 : creditCost,
        hasChargedCredits: !isFree,
        timestamp: new Date(),
        imageUrl: imageUrl,
        upscaleFactor: upscaleFactor,
        isFree: isFree,
        status: 'PENDING',
        taskId: taskId,
        originalUrl: imageUrl,
        createdAt: new Date().toISOString()
      };
      
      console.log(`图像高清放大任务信息已保存: 用户ID=${userId}, 任务ID=${taskId}, 积分=${creditCost}, 是否免费=${isFree}`);
      
      // 使用统一中间件的saveTaskDetails函数保存任务详情
      try {
        const { saveTaskDetails } = require('./middleware/unifiedFeatureUsage');
        await saveTaskDetails(req.featureUsage.usage, {
          taskId: taskId,
          creditCost: creditCost,
          isFree: isFree,
          extraData: {
            upscaleFactor: upscaleFactor,
            imageUrl: imageUrl,
            status: 'PENDING'
          }
        });
        console.log(`图像高清放大任务ID=${taskId}已通过统一中间件保存到数据库`);
      } catch (saveError) {
        console.error('通过统一中间件保存任务信息失败:', saveError);
        // 继续响应，不中断流程
      }
      
      // 3. 立即返回任务ID，不等待处理完成
      console.log('任务已提交，返回任务ID');
      res.json({
        success: true,
        taskId: taskId,
        status: 'PENDING',
        message: '任务已提交，正在处理中...'
      });
      
      // 4. 异步处理图像高清放大（在后台进行）
      console.log('开始异步处理图像高清放大...');
      processUpscaleTaskAsync(taskId, imageUrl, upscaleFactor);
    } catch (error) {
      console.error('图像处理失败:', error);
      
      // 调用退款函数
      try {
        await refundManager.refundImageUpscalerCredits(userId, taskId, '任务失败');
        console.log(`已为任务ID=${taskId}执行退款处理`);
      } catch (refundError) {
        console.error('执行退款失败:', refundError);
      }
      
      // 根据错误类型返回不同的错误信息
      let errorMessage = '图像处理失败，请稍后重试';
      let errorCode = 'PROCESSING_ERROR';
      
      if (error.message.includes('OSS')) {
        errorMessage = '图片上传失败，请稍后重试';
        errorCode = 'OSS_ERROR';
      } else if (error.message.includes('API')) {
        errorMessage = '图像处理API调用失败，请稍后重试';
        errorCode = 'API_ERROR';
      } else if (error.message.includes('未返回结果URL')) {
        errorMessage = '图像处理成功但未能获取结果，请稍后重试';
        errorCode = 'MISSING_RESULT_URL';
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('连接')) {
        errorMessage = '网络连接错误，请检查网络设置';
        errorCode = 'NETWORK_ERROR';
      } else if (error.message.includes('timeout') || error.message.includes('超时')) {
        errorMessage = '请求超时，请稍后重试';
        errorCode = 'TIMEOUT_ERROR';
      }
      
      return res.status(500).json({ 
        success: false, 
        message: errorMessage,
        errorDetail: error.message,
        errorCode: errorCode,
        originalUrl: imageUrl // 返回原图URL，以便前端可以显示
      });
    }
  } catch (error) {
    console.error('处理图像高清放大请求出错:', error);
    return res.status(500).json({ 
      success: false, 
      message: '服务器内部错误，请稍后重试',
      errorDetail: error.message,
      errorCode: 'SERVER_ERROR'
    });
  }
});

// 异步处理图像高清放大任务
async function processUpscaleTaskAsync(taskId, imageUrl, upscaleFactor) {
  try {
    console.log(`开始异步处理任务ID=${taskId}的图像高清放大`);
    
    // 更新任务状态为RUNNING
    if (global.imageUpscalerTasks[taskId]) {
      global.imageUpscalerTasks[taskId].status = 'RUNNING';
      console.log(`任务ID=${taskId}状态已更新为RUNNING`);
    }
    
    // 调用图像高清放大API
    let apiResult;
    try {
      apiResult = await callUpscaleApi(imageUrl, upscaleFactor);
      console.log(`任务ID=${taskId}的API调用成功:`, apiResult);
    } catch (apiError) {
      console.error(`任务ID=${taskId}的API调用失败:`, apiError);
      throw new Error(`图像处理API调用失败: ${apiError.message || '未知错误'}`);
    }
    
    // 检查API返回结果格式，适应不同的返回结构
    const resultUrl = apiResult.data && apiResult.data.imageUrl 
      ? apiResult.data.imageUrl 
      : (apiResult.imageUrl || '');
      
    if (!resultUrl) {
      console.error(`任务ID=${taskId}的API返回结果中没有图片URL:`, apiResult);
      throw new Error('图像处理成功但未返回结果URL');
    }
    
    // 更新任务信息
    if (global.imageUpscalerTasks[taskId]) {
      global.imageUpscalerTasks[taskId].status = 'SUCCEEDED';
      global.imageUpscalerTasks[taskId].resultUrl = resultUrl;
      global.imageUpscalerTasks[taskId].completedAt = new Date().toISOString();
      console.log(`任务ID=${taskId}状态已更新为SUCCEEDED，结果URL=${resultUrl}`);
    }
    
     // 更新数据库中的任务信息
     try {
       const { FeatureUsage } = require('./models/FeatureUsage');
       const taskInfo = global.imageUpscalerTasks[taskId];
       if (taskInfo && taskInfo.userId) {
         // 查找对应用户的image-upscaler功能记录
         const featureUsage = await FeatureUsage.findOne({
           where: {
             userId: taskInfo.userId,
             featureName: 'image-upscaler'
           },
           order: [['createdAt', 'DESC']]
         });
         
         if (featureUsage) {
           // 更新details字段中的任务信息
           const details = JSON.parse(featureUsage.details || '{}');
           if (!details.tasks) details.tasks = [];
           
           // 查找或添加任务记录
           const taskIndex = details.tasks.findIndex(t => t.taskId === taskId);
           const taskData = {
             taskId: taskId,
             status: 'SUCCEEDED',
             resultUrl: resultUrl,
             completedAt: new Date().toISOString(),
             creditCost: taskInfo.creditCost || 0
           };
           
           if (taskIndex >= 0) {
             details.tasks[taskIndex] = { ...details.tasks[taskIndex], ...taskData };
           } else {
             details.tasks.push(taskData);
           }
           
           await featureUsage.update({
             details: JSON.stringify(details),
             lastUsedAt: new Date()
           });
         }
       }
       console.log(`已更新任务ID=${taskId}的数据库记录为SUCCEEDED状态`);
     } catch (updateError) {
       console.error(`更新任务ID=${taskId}的数据库记录失败:`, updateError);
     }
    
    console.log(`任务ID=${taskId}的图像高清放大处理完成`);
  } catch (error) {
    console.error(`任务ID=${taskId}的异步处理失败:`, error);
    
    // 更新任务状态为FAILED
    if (global.imageUpscalerTasks[taskId]) {
      global.imageUpscalerTasks[taskId].status = 'FAILED';
      global.imageUpscalerTasks[taskId].errorMessage = error.message;
      global.imageUpscalerTasks[taskId].failedAt = new Date().toISOString();
      console.log(`任务ID=${taskId}状态已更新为FAILED，错误信息=${error.message}`);
    }
    
     // 更新数据库中的任务信息
     try {
       const { FeatureUsage } = require('./models/FeatureUsage');
       const taskInfo = global.imageUpscalerTasks[taskId];
       if (taskInfo && taskInfo.userId) {
         // 查找对应用户的image-upscaler功能记录
         const featureUsage = await FeatureUsage.findOne({
           where: {
             userId: taskInfo.userId,
             featureName: 'image-upscaler'
           },
           order: [['createdAt', 'DESC']]
         });
         
         if (featureUsage) {
           // 更新details字段中的任务信息
           const details = JSON.parse(featureUsage.details || '{}');
           if (!details.tasks) details.tasks = [];
           
           // 查找或添加任务记录
           const taskIndex = details.tasks.findIndex(t => t.taskId === taskId);
           const taskData = {
             taskId: taskId,
             status: 'FAILED',
             errorMessage: error.message,
             failedAt: new Date().toISOString(),
             creditCost: taskInfo.creditCost || 0
           };
           
           if (taskIndex >= 0) {
             details.tasks[taskIndex] = { ...details.tasks[taskIndex], ...taskData };
           } else {
             details.tasks.push(taskData);
           }
           
           await featureUsage.update({
             details: JSON.stringify(details),
             lastUsedAt: new Date()
           });
         }
       }
       console.log(`已更新任务ID=${taskId}的数据库记录为FAILED状态`);
     } catch (updateError) {
       console.error(`更新任务ID=${taskId}的数据库记录失败:`, updateError);
     }
    
    // 执行退款
    try {
      const taskInfo = global.imageUpscalerTasks[taskId];
      if (taskInfo && taskInfo.hasChargedCredits) {
        await refundManager.refundImageUpscalerCredits(taskInfo.userId, taskId, error.message);
        console.log(`已为任务ID=${taskId}执行退款处理`);
      }
    } catch (refundError) {
      console.error(`任务ID=${taskId}的退款处理失败:`, refundError);
    }
  }
}

// 获取单个图像高清放大任务状态
app.get('/api/image-upscaler/tasks/:taskId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    
    console.log(`获取图像高清放大任务状态: userId=${userId}, taskId=${taskId}`);
    
    // 首先从全局任务缓存中查找
    if (global.imageUpscalerTasks && global.imageUpscalerTasks[taskId]) {
      const task = global.imageUpscalerTasks[taskId];
      
      // 验证任务属于当前用户
      if (task.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: '无权访问此任务'
        });
      }
      
      console.log(`从全局缓存返回任务状态: ${task.status}`);
      return res.json({
        success: true,
        taskId: taskId,
        status: task.status,
        resultUrl: task.resultUrl,
        originalUrl: task.originalUrl,
        upscaleFactor: task.upscaleFactor,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        error: task.error
      });
    }
    
    // 如果全局缓存中没有，从数据库中查找
    const { FeatureUsage } = require('./models/FeatureUsage');
    const featureUsage = await FeatureUsage.findOne({
      where: {
        userId: userId,
        featureName: 'image-upscaler'
      },
      order: [['createdAt', 'DESC']]
    });
    
    let task = null;
    if (featureUsage && featureUsage.details) {
      const details = JSON.parse(featureUsage.details || '{}');
      const taskInfo = details.tasks?.find(t => t.taskId === taskId);
      if (taskInfo) {
        task = {
          ...taskInfo,
          createdAt: featureUsage.createdAt,
          updatedAt: featureUsage.updatedAt
        };
      }
    }
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }
    
    console.log(`从数据库返回任务状态: ${task.status}`);
    
    return res.json({
      success: true,
      taskId: taskId,
      status: task.status,
      resultUrl: task.resultUrl,
      originalUrl: task.originalUrl,
      upscaleFactor: task.upscaleFactor,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
      error: task.errorMessage
    });
    
  } catch (error) {
    console.error('获取图像高清放大任务状态失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 获取图像高清放大任务列表
app.get('/api/image-upscaler/tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`获取图像高清放大任务列表: userId=${userId}`);
    
    // 从统一功能使用记录中获取任务
    const { FeatureUsage } = require('./models/FeatureUsage');
    const tasks = await FeatureUsage.findAll({
      where: {
        userId: userId,
        featureName: 'image-upscaler'
      },
      order: [['createdAt', 'DESC']],
      limit: 50 // 限制返回最近50个任务
    });
    
    // 格式化任务数据
    const formattedTasks = tasks.map(task => {
      const extraData = task.extraData || {};
      return {
        taskId: task.taskId,
        status: task.status || 'SUCCEEDED', // 默认已完成
        upscaleFactor: extraData.upscaleFactor || 2,
        originalUrl: extraData.imageUrl || '',
        resultUrl: extraData.resultUrl || extraData.imageUrl || '',
        createdAt: task.createdAt,
        errorMessage: task.errorMessage
      };
    });
    
    console.log(`找到 ${formattedTasks.length} 个图像高清放大任务`);
    
    return res.json({
      success: true,
      tasks: formattedTasks
    });
  } catch (error) {
    console.error('获取图像高清放大任务列表出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取单个图像高清放大任务状态
app.get('/api/image-upscaler/task/:taskId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.taskId;
    
    console.log(`获取图像高清放大任务状态: userId=${userId}, taskId=${taskId}`);
    
    // 从统一功能使用记录中获取任务
    const { FeatureUsage } = require('./models/FeatureUsage');
    const featureUsage = await FeatureUsage.findOne({
      where: {
        userId: userId,
        featureName: 'image-upscaler'
      },
      order: [['createdAt', 'DESC']]
    });
    
    let task = null;
    if (featureUsage && featureUsage.details) {
      const details = JSON.parse(featureUsage.details || '{}');
      const taskInfo = details.tasks?.find(t => t.taskId === taskId);
      if (taskInfo) {
        task = {
          ...taskInfo,
          createdAt: featureUsage.createdAt,
          updatedAt: featureUsage.updatedAt
        };
      }
    }
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }
    
    // 格式化任务数据，优先从全局变量获取最新状态
    let formattedTask = {
      taskId: task.taskId || taskId,
      status: task.status || 'SUCCEEDED',
      upscaleFactor: task.upscaleFactor || 2,
      originalUrl: task.originalUrl || '',
      resultUrl: task.resultUrl || task.originalUrl || '',
      createdAt: task.createdAt,
      errorMessage: task.errorMessage
    };
    
    // 如果全局变量中有更新的任务状态，使用全局变量的数据
    if (global.imageUpscalerTasks && global.imageUpscalerTasks[taskId]) {
      const globalTask = global.imageUpscalerTasks[taskId];
      formattedTask = {
        ...formattedTask,
        status: globalTask.status || formattedTask.status,
        resultUrl: globalTask.resultUrl || formattedTask.resultUrl,
        errorMessage: globalTask.errorMessage || formattedTask.errorMessage,
        completedAt: globalTask.completedAt,
        failedAt: globalTask.failedAt
      };
      console.log(`从全局变量获取任务ID=${taskId}的最新状态: ${globalTask.status}`);
    }
    
    return res.json({
      success: true,
      task: formattedTask
    });
  } catch (error) {
    console.error('获取图像高清放大任务状态出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取图像上色任务列表
app.get('/api/image-colorization/tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`获取图像上色任务列表: userId=${userId}`);
    
    // 从统一功能使用记录中获取任务
    const { FeatureUsage } = require('./models/FeatureUsage');
    const tasks = await FeatureUsage.findAll({
      where: {
        userId: userId,
        featureName: 'image-colorization'
      },
      order: [['createdAt', 'DESC']],
      limit: 50 // 限制返回最近50个任务
    });
    
    // 格式化任务数据
    const formattedTasks = tasks.map(task => {
      const extraData = task.extraData || {};
      return {
        taskId: task.taskId,
        status: task.status || 'SUCCEEDED', // 默认已完成
        prompt: extraData.prompt || '',
        originalUrl: extraData.imageUrl || '',
        resultUrl: extraData.resultUrl || extraData.imageUrl || '',
        createdAt: task.createdAt,
        errorMessage: task.errorMessage
      };
    });
    
    console.log(`找到 ${formattedTasks.length} 个图像上色任务`);
    
    return res.json({
      success: true,
      tasks: formattedTasks
    });
  } catch (error) {
    console.error('获取图像上色任务列表出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取单个图像上色任务状态
app.get('/api/image-colorization/task/:taskId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.taskId;
    
    console.log(`获取图像上色任务状态: userId=${userId}, taskId=${taskId}`);
    
    // 从统一功能使用记录中获取任务
    const { FeatureUsage } = require('./models/FeatureUsage');
    const task = await FeatureUsage.findOne({
      where: {
        userId: userId,
        taskId: taskId,
        featureName: 'image-colorization'
      }
    });
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }
    
    // 格式化任务数据
    const extraData = task.extraData || {};
    const formattedTask = {
      taskId: task.taskId,
      status: task.status || 'SUCCEEDED',
      prompt: extraData.prompt || '',
      originalUrl: extraData.imageUrl || '',
      resultUrl: extraData.resultUrl || extraData.imageUrl || '',
      createdAt: task.createdAt,
      errorMessage: task.errorMessage
    };
    
    return res.json({
      success: true,
      task: formattedTask
    });
  } catch (error) {
    console.error('获取图像上色任务状态出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取局部重绘任务列表
app.get('/api/local-redraw/tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`获取局部重绘任务列表: userId=${userId}`);
    
    // 从统一功能使用记录中获取任务
    const { FeatureUsage } = require('./models/FeatureUsage');
    const tasks = await FeatureUsage.findAll({
      where: {
        userId: userId,
        featureName: 'LOCAL_REDRAW' // 修正：使用大写格式，与保存时一致
      },
      order: [['createdAt', 'DESC']],
      limit: 50 // 限制返回最近50个任务
    });
    
    // 格式化任务数据
    const formattedTasks = [];
    
    for (const task of tasks) {
      // 解析details字段中的任务列表
      const details = JSON.parse(task.details || '{}');
      const taskList = details.tasks || [];
      
      // 为每个任务创建格式化数据
      for (const taskItem of taskList) {
        formattedTasks.push({
          taskId: taskItem.taskId,
          status: taskItem.status || 'SUCCEEDED', // 默认已完成
          prompt: taskItem.prompt || '',
          originalUrl: taskItem.imageUrl || '',
          resultUrl: taskItem.resultUrl || taskItem.imageUrl || '',
          createdAt: taskItem.createdAt || taskItem.timestamp || task.createdAt,
          errorMessage: taskItem.errorMessage
        });
      }
    }
    
    // 按创建时间排序
    formattedTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    console.log(`找到 ${formattedTasks.length} 个局部重绘任务`);
    
    return res.json({
      success: true,
      tasks: formattedTasks
    });
  } catch (error) {
    console.error('获取局部重绘任务列表出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取单个局部重绘任务状态
app.get('/api/local-redraw/task/:taskId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.taskId;
    
    console.log(`获取局部重绘任务状态: userId=${userId}, taskId=${taskId}`);
    
    // 从统一功能使用记录中获取任务
    const { FeatureUsage } = require('./models/FeatureUsage');
    const task = await FeatureUsage.findOne({
      where: {
        userId: userId,
        featureName: 'LOCAL_REDRAW' // 修正：使用大写格式
      }
    });
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }
    
    // 解析details字段中的任务列表，查找指定taskId的任务
    const details = JSON.parse(task.details || '{}');
    const taskList = details.tasks || [];
    const taskItem = taskList.find(t => t.taskId === taskId);
    
    if (!taskItem) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }
    
    // 格式化任务数据
    const formattedTask = {
      taskId: taskItem.taskId,
      status: taskItem.status || 'SUCCEEDED',
      prompt: taskItem.prompt || '',
      originalUrl: taskItem.imageUrl || '',
      resultUrl: taskItem.resultUrl || taskItem.imageUrl || '',
      createdAt: taskItem.createdAt || taskItem.timestamp || task.createdAt,
      errorMessage: taskItem.errorMessage
    };
    
    return res.json({
      success: true,
      task: formattedTask
    });
  } catch (error) {
    console.error('获取局部重绘任务状态出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取全局风格化任务列表
app.get('/api/global-style/tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`获取全局风格化任务列表: userId=${userId}`);
    
    // 从统一功能使用记录中获取任务
    const { FeatureUsage } = require('./models/FeatureUsage');
    const tasks = await FeatureUsage.findAll({
      where: {
        userId: userId,
        featureName: 'GLOBAL_STYLE'
      },
      order: [['createdAt', 'DESC']],
      limit: 3 // 限制返回最近3个任务
    });
    
    // 格式化任务数据
    const formattedTasks = [];
    
    for (const task of tasks) {
      try {
        // 解析details字段中的任务数据
        const details = JSON.parse(task.details || '{}');
        const taskList = details.tasks || [];
        
        // 将每个任务添加到结果中
        for (const taskItem of taskList) {
          // 只有真正有结果的任务才标记为SUCCEEDED
          const hasResult = taskItem.resultUrl || (taskItem.status === 'SUCCEEDED' && taskItem.imageUrl);
          const taskStatus = hasResult ? 'SUCCEEDED' : (taskItem.status || 'PENDING');
          
          formattedTasks.push({
            taskId: taskItem.taskId,
            status: taskStatus,
            prompt: taskItem.prompt || '',
            strength: taskItem.strength || '0.5',
            originalUrl: taskItem.imageUrl || '',
            resultUrl: taskItem.resultUrl || '',
            createdAt: taskItem.timestamp || taskItem.createdAt || task.createdAt,
            errorMessage: taskItem.errorMessage
          });
        }
      } catch (error) {
        console.error('解析任务详情失败:', error);
        // 如果解析失败，使用基本信息
        formattedTasks.push({
          taskId: `task-${task.id}`,
          status: 'SUCCEEDED',
          prompt: '',
          strength: '0.5',
          originalUrl: '',
          resultUrl: '',
          createdAt: task.createdAt,
          errorMessage: null
        });
      }
    }
    
    console.log(`找到 ${formattedTasks.length} 个全局风格化任务`);
    
    return res.json({
      success: true,
      tasks: formattedTasks
    });
  } catch (error) {
    console.error('获取全局风格化任务列表出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取单个全局风格化任务状态
app.get('/api/global-style/task/:taskId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.taskId;
    
    console.log(`获取全局风格化任务状态: userId=${userId}, taskId=${taskId}`);
    
    // 从统一功能使用记录中获取任务
    const { FeatureUsage } = require('./models/FeatureUsage');
    const task = await FeatureUsage.findOne({
      where: {
        userId: userId,
        taskId: taskId,
        featureName: 'global-style'
      }
    });
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }
    
    // 格式化任务数据
    const extraData = task.extraData || {};
    const formattedTask = {
      taskId: task.taskId,
      status: task.status || 'SUCCEEDED',
      prompt: extraData.prompt || '',
      strength: extraData.strength || '0.5',
      originalUrl: extraData.imageUrl || '',
      resultUrl: extraData.resultUrl || extraData.imageUrl || '',
      createdAt: task.createdAt,
      errorMessage: task.errorMessage
    };
    
    return res.json({
      success: true,
      task: formattedTask
    });
  } catch (error) {
    console.error('获取全局风格化任务状态出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取垫图任务列表
app.get('/api/diantu/tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`获取垫图任务列表: userId=${userId}`);
    
    // 从统一功能使用记录中获取任务
    const { FeatureUsage } = require('./models/FeatureUsage');
    
    console.log(`查询垫图历史记录: userId=${userId}, featureName=DIANTU`);
    
    const tasks = await FeatureUsage.findAll({
      where: {
        userId: userId,
        featureName: 'DIANTU'
      },
      order: [['createdAt', 'DESC']],
      limit: 10 // 增加返回数量，确保能获取到足够的历史记录
    });
    
    console.log(`查询到垫图功能使用记录数量: ${tasks.length}`);
    
    // 记录每条记录的ID和创建时间，便于调试
    tasks.forEach((task, index) => {
      console.log(`记录${index+1}: ID=${task.id}, 创建时间=${task.createdAt}, 详情长度=${task.details ? task.details.length : 0}字节`);
    });
    
    // 格式化任务数据
    const formattedTasks = [];
    
    tasks.forEach(task => {
      try {
        // 解析details字段中的任务列表
        const details = JSON.parse(task.details || '{}');
        console.log(`解析任务ID=${task.id}的details字段:`, JSON.stringify(details).substring(0, 100) + '...');
        
        const taskList = details.tasks || [];
        console.log(`任务ID=${task.id}包含${taskList.length}个子任务`);
        
        // 遍历每个任务
        taskList.forEach((taskItem, idx) => {
          console.log(`处理子任务${idx+1}: taskId=${taskItem.taskId}, status=${taskItem.status || '未知'}`);
          
          // 构建格式化的任务对象
          const formattedTask = {
            taskId: taskItem.taskId,
            status: taskItem.status || 'PENDING',
            prompt: taskItem.prompt || '',
            originalUrl: taskItem.imageUrl || taskItem.originalUrl || (taskItem.extraData ? taskItem.extraData.imageUrl : '') || '',
            resultUrl: taskItem.resultUrl || (taskItem.extraData ? taskItem.extraData.resultUrl : '') || '',
            createdAt: taskItem.createdAt || taskItem.timestamp || task.createdAt,
            errorMessage: taskItem.errorMessage || taskItem.error || ''
          };
          
          // 如果extraData中有更多信息，尝试提取
          if (taskItem.extraData) {
            if (!formattedTask.prompt && taskItem.extraData.prompt) {
              formattedTask.prompt = taskItem.extraData.prompt;
            }
            if (!formattedTask.originalUrl && taskItem.extraData.imageUrl) {
              formattedTask.originalUrl = taskItem.extraData.imageUrl;
            }
            if (!formattedTask.resultUrl && taskItem.extraData.resultUrl) {
              formattedTask.resultUrl = taskItem.extraData.resultUrl;
            }
          }
          
          console.log(`格式化后的任务: taskId=${formattedTask.taskId}, status=${formattedTask.status}, 有原图=${!!formattedTask.originalUrl}, 有结果=${!!formattedTask.resultUrl}`);
          
          formattedTasks.push(formattedTask);
        });
      } catch (parseError) {
        console.error('解析垫图任务详情失败:', parseError);
        // 如果解析失败，使用默认格式
        const extraData = task.extraData || {};
        console.log(`处理任务ID=${task.id}, taskId=${task.taskId || '未知'}`);
        
        formattedTasks.push({
          taskId: task.taskId,
          status: task.status || 'SUCCEEDED',
          prompt: extraData.prompt || '',
          originalUrl: extraData.imageUrl || '',
          resultUrl: extraData.resultUrl || extraData.imageUrl || '',
          createdAt: task.createdAt,
          errorMessage: task.errorMessage
        });
      }
    });
    
    console.log(`找到 ${formattedTasks.length} 个垫图任务`);
    
    // 记录返回的任务列表详情
    if (formattedTasks.length > 0) {
      console.log('返回的任务列表:');
      formattedTasks.forEach((task, idx) => {
        console.log(`任务${idx+1}: ID=${task.taskId}, 状态=${task.status}, 有原图=${!!task.originalUrl}, 有结果=${!!task.resultUrl}`);
      });
    } else {
      console.log('没有找到任何垫图任务');
    }
    
    return res.json({
      success: true,
      tasks: formattedTasks
    });
  } catch (error) {
    console.error('获取垫图任务列表出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 清除垫图历史记录
app.delete('/api/diantu/history', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`清除垫图历史记录: userId=${userId}`);
    
    // 从统一功能使用记录中删除垫图任务
    const { FeatureUsage } = require('./models/FeatureUsage');
    const deletedCount = await FeatureUsage.destroy({
      where: {
        userId: userId,
        featureName: 'DIANTU'
      }
    });
    
    console.log(`已清除 ${deletedCount} 条垫图历史记录`);
    
    return res.json({
      success: true,
      message: '垫图历史记录已清除',
      deletedCount: deletedCount
    });
  } catch (error) {
    console.error('清除垫图历史记录出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取单个垫图任务状态
app.get('/api/diantu/task/:taskId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.taskId;
    
    console.log(`获取垫图任务状态: userId=${userId}, taskId=${taskId}`);
    
    // 从统一功能使用记录中获取任务
    const { FeatureUsage } = require('./models/FeatureUsage');
    const tasks = await FeatureUsage.findAll({
      where: {
        userId: userId,
        featureName: 'DIANTU'
      },
      order: [['createdAt', 'DESC']]
    });
    
    // 在所有任务中查找指定的任务ID
    let foundTask = null;
    let allFormattedTasks = [];
    
    tasks.forEach(task => {
      try {
        // 解析details字段中的任务列表
        const details = JSON.parse(task.details || '{}');
        const taskList = details.tasks || [];
        
        // 遍历每个任务
        taskList.forEach(taskItem => {
          const formattedTask = {
            taskId: taskItem.taskId,
            status: taskItem.status || 'PENDING',
            prompt: taskItem.prompt || '',
            originalUrl: taskItem.imageUrl || '',
            resultUrl: taskItem.resultUrl || '',
            createdAt: taskItem.createdAt || taskItem.timestamp || task.createdAt,
            errorMessage: taskItem.errorMessage || ''
          };
          
          allFormattedTasks.push(formattedTask);
          
          // 如果找到指定的任务ID
          if (taskItem.taskId === taskId) {
            foundTask = formattedTask;
          }
        });
      } catch (parseError) {
        console.error('解析垫图任务详情失败:', parseError);
      }
    });
    
    if (!foundTask) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }
    
    // 如果任务已完成，同时返回最新的历史记录
    if (foundTask.status === 'SUCCEEDED' || foundTask.status === 'FAILED') {
      return res.json({
        success: true,
        task: foundTask,
        // 返回最新的历史记录，让前端可以立即更新
        latestHistory: allFormattedTasks.slice(0, 3) // 返回最近3个任务
      });
    }
    
    return res.json({
      success: true,
      task: foundTask
    });
  } catch (error) {
    console.error('获取垫图任务状态出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 健康检查API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 添加OSS存储相关的API路由
// 从OSS加载历史记录
app.get('/api/storage/load-from-oss', async (req, res) => {
  try {
    const { type, userId } = req.query;
    
    if (!type) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: type'
      });
    }
    
    // 用户ID验证逻辑
    let currentUserId = null;
    if (req.user) {
      currentUserId = req.user.id.toString();
    }
    
    // 只有当提供了userId且当前用户已登录且ID不匹配时才拒绝
    if (userId && currentUserId && userId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: '无权访问其他用户的数据'
      });
    }
    
    console.log(`从OSS加载历史记录: type=${type}, userId=${userId || currentUserId || '匿名用户'}`);
    
    // 这里应该实现从OSS加载数据的逻辑
    // 由于没有实现，暂时返回空数组
    return res.json({
      success: true,
      history: []
    });
  } catch (error) {
    console.error('从OSS加载历史记录失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

// 保存历史记录到OSS
app.post('/api/storage/save-to-oss', async (req, res) => {
  try {
    const { type, userId, data, timestamp } = req.body;
    
    if (!type || !data) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: type, data'
      });
    }
    
    // 用户ID验证逻辑
    let currentUserId = null;
    if (req.user) {
      currentUserId = req.user.id.toString();
    }
    
    // 只有当提供了userId且当前用户已登录且ID不匹配时才拒绝
    if (userId && currentUserId && userId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: '无权修改其他用户的数据'
      });
    }
    
    console.log(`保存历史记录到OSS: type=${type}, userId=${userId || currentUserId || '匿名用户'}`);
    
    // 这里应该实现保存数据到OSS的逻辑
    // 同时保存到ImageHistory表中
    try {
      // 获取用户ID，如果存在
      let userIdForHistory = null;
      if (userId) {
        userIdForHistory = userId;
      } else if (currentUserId) {
        userIdForHistory = currentUserId;
      }
      
      // 保存到ImageHistory表
      await ImageHistory.create({
        userId: userIdForHistory,
        title: `${type}处理结果`,
        imageUrl: data.imageUrl || data.resultUrl || data.url,
        originalImageUrl: data.originalImageUrl || data.originalUrl,
        processedImageUrl: data.processedImageUrl || data.resultUrl || data.imageUrl,
        type: type,
        processType: type,
        description: data.description || `${type}处理`,
        metadata: data
      });
      
      console.log(`历史记录已保存到数据库: type=${type}, userId=${userId || currentUserId || '匿名用户'}`);
    } catch (dbError) {
      console.error('保存到历史记录失败:', dbError);
      // 继续处理，不影响主流程
    }
    
    // 返回成功
    return res.json({
      success: true,
      message: '历史记录已保存'
    });
  } catch (error) {
    console.error('保存历史记录到OSS失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

// 清除OSS中的历史记录
app.post('/api/storage/clear-from-oss', async (req, res) => {
  try {
    const { type, userId } = req.body;
    
    if (!type) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: type'
      });
    }
    
    // 用户ID验证逻辑
    let currentUserId = null;
    if (req.user) {
      currentUserId = req.user.id.toString();
    }
    
    // 只有当提供了userId且当前用户已登录且ID不匹配时才拒绝
    if (userId && currentUserId && userId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: '无权清除其他用户的数据'
      });
    }
    
    console.log(`清除OSS中的历史记录: type=${type}, userId=${userId || currentUserId || '匿名用户'}`);
    
    // 这里应该实现清除OSS数据的逻辑
    // 由于没有实现，暂时返回成功
    return res.json({
      success: true,
      message: '历史记录已清除'
    });
  } catch (error) {
    console.error('清除OSS中的历史记录失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

// 从历史记录加载数据
app.get('/api/storage/load-from-history', async (req, res) => {
  try {
    const { userId } = req.query;
    
    // 确保用户ID匹配
    if (userId && userId !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: '无权访问其他用户的数据'
      });
    }
    
    // 用户ID验证逻辑
    let currentUserId = null;
    if (req.user) {
      currentUserId = req.user.id.toString();
    }
    
    console.log(`从历史记录加载数据: userId=${userId || currentUserId || '匿名用户'}`);
    
    // 从ImageHistory表中查询数据
    const ImageHistory = require('./models/ImageHistory');
    
    // 构建查询条件
    const whereClause = {};
    if (currentUserId) {
      whereClause.userId = currentUserId;
    } else if (userId) {
      whereClause.userId = userId;
    }
    
    // 如果没有用户ID，返回公共历史记录
    const history = await ImageHistory.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: 10
    });
    
    return res.json({
      success: true,
      history: history || []
    });
  } catch (error) {
    console.error('从历史记录加载数据失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

// 添加重定向，处理缺少前导斜杠的API请求
app.get('/api/storage/load-from-oss', (req, res) => {
  res.redirect(`/api/storage/load-from-oss${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`);
});

app.get('/api/storage/load-from-history', (req, res) => {
  res.redirect(`/api/storage/load-from-history${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`);
});

// 主页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 确保功能相关的上传目录存在
const ensureUploadDirs = () => {
  // 鞋靴试穿功能已改为仅使用OSS存储，不再需要本地uploads目录存储这类图片
  const dirs = [
    'uploads',
    'uploads/image-to-video',
    'uploads/digital-human',
    'uploads/multi-image-videos', // 添加多图转视频目录
    'uploads/style-videos',      // 添加视频风格重绘目录
    'public/uploads',
    'temp'
  ];
  
  for (const dir of dirs) {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`创建目录: ${dirPath}`);
    }
  }
  console.log('所有必要目录已创建');
};

// 确保上传目录存在
ensureUploadDirs();

// 添加翻译页面路由
app.get('/translate', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'translate.html'));
});

// 添加抠图页面路由
app.get('/cutout', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cutout.html'));
});

// 添加场景图生成页面路由
app.get('/scene-generator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'scene-generator.html'));
});

// 添加模特换肤页面路由
app.get('/model-skin-changer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'model-skin-changer.html'));
});

// 添加带.html后缀的模特换肤页面路由
app.get('/model-skin-changer.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'model-skin-changer.html'));
});

// 添加图像智能消除页面路由
app.get('/image-removal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'image-removal.html'));
});

// 添加带.html后缀的图像智能消除页面路由
app.get('/image-removal.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'image-removal.html'));
});

// 添加模拟试衣页面路由
app.get('/clothing-simulation', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'clothing-simulation.html'));
});

// 添加带.html后缀的模拟试衣页面路由
app.get('/clothing-simulation.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'clothing-simulation.html'));
});

// 功能访问检查示例 - 图像放大功能（已移动到实际实现中）
// app.post('/api/image-upscaler', protect, createUnifiedFeatureMiddleware('image-upscaler'), async (req, res) => {
//   // 这个示例路由已被移动到实际的图像高清放大处理逻辑中（第4189行）
// });

// 添加测试端点来手动测试图片保存功能
app.get('/test-save-image', (req, res) => {
  const testImageUrl = 'https://editor.d.design/assets/demo/business-card.jpg';
  res.send(`
    <html>
      <head>
        <title>Test Save Image</title>
      </head>
      <body>
        <h1>测试保存图片到下载中心</h1>
        <img src="${testImageUrl}" style="max-width: 400px; border: 1px solid #ccc;">
        <div style="margin-top: 20px;">
          <button id="saveBtn" style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer;">
            保存到下载中心
          </button>
        </div>
        
        <script>
          document.getElementById('saveBtn').addEventListener('click', async function() {
            try {
              // 准备测试数据
              const resultData = {
                originalImageUrl: null,
                processedImageUrl: '${testImageUrl}',
                processTime: new Date().toISOString(),
                processType: '测试保存',
                description: '测试保存功能'
              };
              
              // 发送请求
              const response = await fetch('/api/save-result', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(resultData)
              });
              
              const result = await response.json();
              
              if (result.success) {
                alert('保存成功！ID: ' + result.id);
              } else {
                alert('保存失败: ' + (result.error || '未知错误'));
              }
            } catch (error) {
              alert('保存出错: ' + error.message);
            }
          });
        </script>
      </body>
    </html>
  `);
});

// 添加虚拟模特签名API
app.post('/api/get-virtual-model-signature', async (req, res) => {
  try {
    console.log('接收虚拟模特签名请求:', JSON.stringify(req.body));
    
    // 获取参数，注意兼容不同的大小写形式
    let timeStamp = req.body.timeStamp;
    const userId = req.body.userId;
    
    // 检查并尝试从timestamp中获取时间戳（小写形式）
    if (!timeStamp && req.body.timestamp) {
      timeStamp = req.body.timestamp;
      console.log('从timestamp(小写)参数获取时间戳:', timeStamp);
    }
    
    // 验证必要参数
    if (!timeStamp) {
      console.error('缺少必要参数timeStamp');
      return res.status(400).json({
        success: false,
        message: '缺少必要参数(timeStamp)'
      });
    }
    
    if (!userId) {
      console.error('缺少必要参数userId');
      return res.status(400).json({
        success: false,
        message: '缺少必要参数(userId)'
      });
    }
    
    // 虚拟模特的AppKey和Secret - 从环境变量中获取
    const APP_KEY = process.env.IMAGE_REMOVAL_APP_KEY;
    const APP_SECRET = process.env.IMAGE_REMOVAL_SECRET_KEY;
    
    console.log('使用参数:', {
      userId,
      timeStamp,
      appKey: APP_KEY
    });
    
    // 使用api-utils.js中的函数生成签名，确保与官方逻辑一致
    const { generateAidgeSign } = require('./api-utils');
    
    // 调用签名生成函数 - 确保timeStamp是数字类型
    const numericTimeStamp = parseInt(timeStamp, 10);
    const sign = generateAidgeSign(APP_SECRET, numericTimeStamp, userId);
    
    console.log('生成虚拟模特签名成功:', {
      timeStamp: numericTimeStamp,
      userId,
      sign
    });
    
    // 构建响应，包含必要参数
    const response = {
      success: true,
      sign: sign,
      ak: APP_KEY,
      userId: userId,
      timeStamp: numericTimeStamp
    };
    
    // 获取当前用户的ID
    let currentUserId = null;
    // 从认证token中获取用户ID
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.id) {
          currentUserId = decoded.id;
        }
      } catch (error) {
        console.error('解析token失败:', error.message);
      }
    } else {
      // 尝试从cookie中获取
      const token = req.cookies && req.cookies.authToken;
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded && decoded.id) {
            currentUserId = decoded.id;
          }
        } catch (error) {
          console.error('解析cookie token失败:', error.message);
        }
      }
    }
    
    console.log('返回响应:', response);
    res.json(response);
  } catch (error) {
    console.error('生成虚拟模特签名失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误: ' + error.message
    });
  }
});

// 处理鞋靴模特API的上传图片请求
app.post('/api/upload-image-for-shoe-model', protect, memoryUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '未提供文件'
      });
    }

    const type = req.body.type || 'unknown'; // 'model' 或 'shoe'

    try {
      // 直接上传到OSS，不保存本地文件
      const imageUrl = await uploadToOSS(req.file.buffer, req.file.originalname, 'general');
      
      // 不再记录上传历史，防止图片显示在下载中心

    res.status(200).json({
      success: true,
      message: '文件上传成功',
        imageUrl: imageUrl
      });
    } catch (ossError) {
      console.error('上传到OSS失败:', ossError);
      res.status(500).json({
        success: false,
        message: '上传图片到OSS服务器失败',
        error: ossError.message
      });
    }
  } catch (error) {
    console.error('上传文件时出错:', error);
    res.status(500).json({
      success: false,
      message: '上传文件失败',
      error: error.message
    });
  }
});

// 创建鞋靴模特试穿任务
const { saveTaskDetails } = require('./middleware/unifiedFeatureUsage');

app.post('/api/create-shoe-model-task', protect, createUnifiedFeatureMiddleware('VIRTUAL_SHOE_MODEL'), async (req, res) => {
  try {
    console.log('接收到创建鞋靴模特试穿任务请求:', req.body);
    const { modelImageUrl, shoeImageUrl } = req.body;

    if (!modelImageUrl || !shoeImageUrl) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：模特图片URL或鞋靴图片URL'
      });
    }

    // 记录请求信息，方便调试
    console.log('鞋靴模特试穿请求参数:', {
      modelImageUrl, 
      shoeImageUrl,
      apiKey: DASHSCOPE_API_KEY.substring(0, 5) + '...' // 只输出API Key的前几个字符，保护安全
    });

    // 调用阿里云鞋靴模特API创建任务
    try {
      const response = await axios({
        method: 'POST',
        url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/virtualmodel/generation/',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'X-DashScope-Async': 'enable', // 启用异步调用
          'Content-Type': 'application/json'
        },
        data: {
          model: 'shoemodel-v1',
          input: {
            template_image_url: modelImageUrl,
            shoe_image_url: Array.isArray(shoeImageUrl) ? shoeImageUrl : [shoeImageUrl]
          },
          parameters: {
            n: 1  // 确保是整数类型，不是字符串
          }
        }
      });

      console.log('阿里云API响应:', response.data);

      if (!response.data || !response.data.output || !response.data.output.task_id) {
        throw new Error('API响应格式不正确，缺少task_id');
      }

      // 获取功能的积分消费配置
      const { FEATURES } = require('./middleware/featureAccess');
      const featureConfig = FEATURES['VIRTUAL_SHOE_MODEL'];
      const creditCost = featureConfig ? featureConfig.creditCost : 25; // 默认消费25积分
      
      // 生成唯一任务ID
      const taskId = response.data.output.task_id;
      
      // 保存任务信息到全局变量
      if (!global.virtualShoeModelTasks) {
        global.virtualShoeModelTasks = {};
      }
      
      // 记录任务信息
      global.virtualShoeModelTasks[taskId] = {
        userId: req.user.id,
        modelImageUrl: modelImageUrl,
        shoeImageUrl: shoeImageUrl,
        creditCost: creditCost,
        timestamp: new Date(),
        status: 'PENDING',
        result: response.data
      };

      // --- 统一记录任务详情，避免重复扣费 ---
      if (req.featureUsage && req.featureUsage.usage && !req.featureUsage._detailsLogged) {
        try {
          await saveTaskDetails(req.featureUsage.usage, {
            taskId,
            creditCost: req.featureUsage.creditCost || 0,
            isFree: req.featureUsage.isFree || false,
            extraData: { modelImageUrl, shoeImageUrl }
          });
          req.featureUsage._detailsLogged = true;
          console.log(`(instant) 已记录鞋靴虚拟试穿任务详情 taskId=${taskId}`);
        } catch (err) {
          console.error('保存鞋靴虚拟试穿任务详情失败:', err.message);
        }
      }

      res.status(200).json({
        success: true,
        message: '任务创建成功',
        taskId: response.data.output.task_id,
        output: {
          task_id: response.data.output.task_id,
          task_status: response.data.output.task_status
        },
        request_id: response.data.request_id
      });
    } catch (apiError) {
      console.error('调用阿里云API失败:', apiError.response?.data || apiError.message);
      let errorMessage = '创建任务失败';
      let errorDetails = '';
      
      if (apiError.response?.data) {
        const originalMessage = apiError.response.data.message || '';
        const errorCode = apiError.response.data.code || '';
        
        // 针对特定错误代码提供用户友好的错误提示
        if (errorCode === 'InvalidFile.Content' || originalMessage.includes('no suitable human-body') || originalMessage.includes('InvalidFile.Content')) {
          errorMessage = '输入的人体图像没有合适的人体，请重新上传。';
        } else if (errorCode === 'InvalidFile.Type' || originalMessage.includes('文件类型错误')) {
          errorMessage = '图片的尺寸/格式不正确，请重新上传。';
        } else if (errorCode === 'InvalidFile.Resolution' || originalMessage.includes('image resolution is invalid') || originalMessage.includes('aspect ratio')) {
          errorMessage = '图片尺寸/格式有问题，请重新上传。';
        } else if (errorCode === 'InvalidFile.Size' || originalMessage.includes('文件大小')) {
          errorMessage = '图片文件过大，请上传小于5MB的图片。';
        } else if (errorCode === 'InvalidParameter' || originalMessage.includes('参数错误')) {
          errorMessage = '参数设置有误，请检查图片和设置后重试。';
        } else if (errorCode === 'Throttling' || originalMessage.includes('请求过于频繁')) {
          errorMessage = '请求过于频繁，请稍后再试。';
        } else if (errorCode === 'InsufficientBalance' || originalMessage.includes('余额不足')) {
          errorMessage = '账户余额不足，请充值后再试。';
        } else {
          errorMessage = originalMessage || errorMessage;
        }
        
        errorDetails = JSON.stringify(apiError.response.data);
      }
      
      // 创建任务失败时也需要退款（因为中间件已经扣费了）
      try {
        await refundVirtualShoeModelCredits(req.user.id, 'CREATE_FAILED_' + Date.now());
      } catch (refundError) {
        console.error('创建任务失败退款处理错误:', refundError);
      }
      
      return res.status(500).json({
        success: false,
        message: errorMessage,
        details: errorDetails
      });
    }
  } catch (error) {
    console.error('创建鞋靴模特试穿任务失败:', error.message);
    res.status(500).json({
      success: false,
      message: '创建任务失败',
      error: error.message
    });
  }
});

// 查询鞋靴模特试穿任务状态 - 支持query参数查询
app.get('/api/check-task-status', protect, async (req, res) => {
  try {
    const { taskId } = req.query;
    console.log('接收到查询任务状态请求 (query参数):', taskId);

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：taskId'
      });
    }

    // 调用阿里云API查询任务状态
    try {
      const response = await axios({
        method: 'GET',
        url: `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`
        }
      });

      console.log('查询任务状态响应:', {
        taskStatus: response.data.output.task_status,
        hasResultUrl: !!response.data.output.result_url
      });

      const taskStatus = response.data.output.task_status;
      let resultData = {
        taskStatus: taskStatus
      };

      // 如果任务已完成，返回结果URL
      if (taskStatus === 'SUCCEEDED') {
        // 打印更多诊断信息
        console.log('任务成功完成，完整响应数据:', JSON.stringify(response.data, null, 2));
        
        // 检查并尝试从多个可能的位置获取结果URL
        if (!response.data.output.result_url && response.data.output.result_urls) {
          console.log('从result_urls数组获取URL');
          response.data.output.result_url = response.data.output.result_urls[0] || '';
        }
        
        // 检查results字段（根据截图）
        if (!response.data.output.result_url && response.data.output.results) {
          console.log('检查results字段');
          if (Array.isArray(response.data.output.results) && response.data.output.results.length > 0) {
            // results是数组(标准格式)
            console.log('从results数组获取URL');
            if (response.data.output.results[0].url) {
              console.log('从results[0].url字段获取URL');
              response.data.output.result_url = response.data.output.results[0].url;
            }
          } else if (typeof response.data.output.results === 'object' && response.data.output.results.url) {
            // results是对象
            console.log('从results.url字段获取URL');
            response.data.output.result_url = response.data.output.results.url;
          }
        }
        
        resultData.resultUrl = response.data.output.result_url;

        // 更新全局变量中的任务状态
        if (global.virtualShoeModelTasks && global.virtualShoeModelTasks[taskId]) {
          global.virtualShoeModelTasks[taskId].status = 'SUCCEEDED';
          global.virtualShoeModelTasks[taskId].resultUrl = response.data.output.result_url;
          global.virtualShoeModelTasks[taskId].endTime = new Date();
        }

        // 更新使用历史
        try {
          await FeatureUsage.update(
            {
              status: 'SUCCEEDED',
              responseData: JSON.stringify(response.data),
              resultUrl: response.data.output.result_url
            },
            {
              where: {
                userId: req.user.id,
                featureName: 'VIRTUAL_SHOE_MODEL'
              },
              order: [['createdAt', 'DESC']],
              limit: 1
            }
          );
        } catch (historyError) {
          console.error('更新使用历史失败:', historyError);
        }
      } else if (taskStatus === 'FAILED') {
        const originalMessage = response.data.output.message || '任务执行失败';
        const errorCode = response.data.output.code || '未知错误';
        
        // 针对特定错误代码提供用户友好的错误提示
        let friendlyMessage = originalMessage;
        if (errorCode === 'InvalidFile.Content' || originalMessage.includes('no suitable human-body') || originalMessage.includes('InvalidFile.Content')) {
          friendlyMessage = '输入的人体图像没有合适的人体，请重新上传。';
        } else if (errorCode === 'InvalidFile.Type' || originalMessage.includes('文件类型错误')) {
          friendlyMessage = '图片的尺寸/格式不正确，请重新上传。';
        } else if (errorCode === 'InvalidFile.Resolution' || originalMessage.includes('image resolution is invalid') || originalMessage.includes('aspect ratio')) {
          friendlyMessage = '图片尺寸/格式有问题，请重新上传。';
        } else if (errorCode === 'InvalidFile.Size' || originalMessage.includes('文件大小')) {
          friendlyMessage = '图片文件过大，请上传小于5MB的图片。';
        } else if (errorCode === 'InvalidParameter' || originalMessage.includes('参数错误')) {
          friendlyMessage = '参数设置有误，请检查图片和设置后重试。';
        } else if (errorCode === 'Throttling' || originalMessage.includes('请求过于频繁')) {
          friendlyMessage = '请求过于频繁，请稍后再试。';
        } else if (errorCode === 'InsufficientBalance' || originalMessage.includes('余额不足')) {
          friendlyMessage = '账户余额不足，请充值后再试。';
        }
        
        resultData.message = friendlyMessage;
        resultData.code = errorCode;

        // 更新全局变量中的任务状态
        if (global.virtualShoeModelTasks && global.virtualShoeModelTasks[taskId]) {
          global.virtualShoeModelTasks[taskId].status = 'FAILED';
          global.virtualShoeModelTasks[taskId].errorMessage = response.data.output.message || '任务执行失败';
          global.virtualShoeModelTasks[taskId].endTime = new Date();
        }

        // 任务失败时执行退款逻辑
        try {
          await refundVirtualShoeModelCredits(req.user.id, taskId);
        } catch (refundError) {
          console.error('鞋靴虚拟试穿任务失败退款处理错误:', refundError);
        }

        // 更新使用历史
        try {
          await FeatureUsage.update(
            {
              status: 'FAILED',
              responseData: JSON.stringify(response.data)
            },
            {
              where: {
                userId: req.user.id,
                featureName: 'VIRTUAL_SHOE_MODEL'
              },
              order: [['createdAt', 'DESC']],
              limit: 1
            }
          );
        } catch (historyError) {
          console.error('更新使用历史失败:', historyError);
        }
      }

      res.status(200).json({
        success: true,
        ...resultData,
        output: {
          task_id: taskId,
          task_status: taskStatus,
          submit_time: response.data.output.submit_time || new Date().toISOString().replace('T', ' ').slice(0, 23),
          scheduled_time: response.data.output.scheduled_time || new Date().toISOString().replace('T', ' ').slice(0, 23),
          end_time: response.data.output.end_time,
          start_time: response.data.output.start_time,
          error_message: taskStatus === 'SUCCEEDED' ? 'Success' : (response.data.output.message || ''),
          error_code: response.data.output.error_code || 0,
          model_index: response.data.output.model_index || 0,
          ...(taskStatus === 'SUCCEEDED' ? { 
            result_url: response.data.output.result_url,
            ...(response.data.output.result_urls ? { result_urls: response.data.output.result_urls } : {})
          } : {}),
          ...(taskStatus === 'FAILED' ? { 
            code: resultData.code || 'UnknownError',
            message: resultData.message || '任务执行失败'
          } : {}),
          ...(taskStatus === 'RUNNING' ? {
            task_metrics: response.data.output.task_metrics || {
              TOTAL: 1,
              SUCCEEDED: 0,
              FAILED: 0
            }
          } : {})
        },
        usage: {
          image_count: response.data.usage?.image_count || (taskStatus === 'SUCCEEDED' ? 1 : 0)
        },
        request_id: response.data.request_id || Date.now().toString()
      });
    } catch (apiError) {
      console.error('查询任务状态失败:', apiError.response?.data || apiError.message);
      
      // 处理不同类型的API错误
      if (apiError.response) {
        const status = apiError.response.status;
        const errorData = apiError.response.data;
        
        // 根据HTTP状态码提供不同的错误处理
        if (status === 404) {
          return res.status(404).json({
            success: false,
            message: '任务不存在或已过期',
            code: 'TASK_NOT_FOUND',
            details: errorData
          });
        } else if (status === 401 || status === 403) {
          return res.status(status).json({
            success: false,
            message: 'API认证失败，请联系管理员',
            code: 'AUTH_ERROR',
            details: errorData
          });
        } else if (status >= 400 && status < 500) {
          return res.status(status).json({
            success: false,
            message: errorData?.message || '请求参数错误',
            code: errorData?.code || 'CLIENT_ERROR',
            details: errorData
          });
        } else {
          return res.status(status).json({
            success: false,
            message: errorData?.message || '阿里云服务暂时不可用',
            code: errorData?.code || 'SERVER_ERROR',
            details: errorData
          });
        }
      } else {
        // 网络错误或其他错误
        return res.status(500).json({
          success: false,
          message: apiError.code === 'ECONNREFUSED' ? '无法连接到阿里云服务' : '查询任务状态失败',
          code: 'NETWORK_ERROR',
          details: { originalError: apiError.message }
        });
      }
    }
  } catch (error) {
    console.error('查询任务状态处理失败:', error.message);
    res.status(500).json({
      success: false,
      message: '查询任务状态失败',
      error: error.message
    });
  }
});

// 查询鞋靴模特试穿任务状态 - 使用路径参数，符合阿里云API规范

app.get('/api/tasks/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;
    console.log('接收到查询任务状态请求 (路径参数):', taskId);

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：taskId'
      });
    }

    // 检查任务类型
    let isMultiImageVideoTask = false;
    let isVideoSubtitleTask = false;
    
    try {
      const { FeatureUsage } = require('./models/FeatureUsage');
      
      // 首先检查是否为视频去字幕任务 - 改进识别逻辑
      const videoSubtitleUsages = await FeatureUsage.findAll({
        where: {
          featureName: ['VIDEO_SUBTITLE_REMOVAL', 'VIDEO_SUBTITLE_REMOVER'] // 支持两种命名
        },
        order: [['createdAt', 'DESC']],
        limit: 50
      });
      
      console.log(`查询到 ${videoSubtitleUsages.length} 条视频去字幕记录`);
      
      for (const usage of videoSubtitleUsages) {
        if (usage.details) {
          try {
            const taskDetails = JSON.parse(usage.details);
            // 支持多种数据结构格式
            if (taskDetails.tasks && Array.isArray(taskDetails.tasks)) {
              const found = taskDetails.tasks.find(t => t.taskId === taskId);
              if (found) {
                isVideoSubtitleTask = true;
                console.log(`确认为视频去字幕任务: taskId=${taskId}`);
                break;
              }
            }
          } catch (parseError) {
            console.error('解析任务详情失败:', parseError);
          }
        }
      }
      
      // 只有在不是视频去字幕任务时，才检查多图转视频任务
      if (!isVideoSubtitleTask) {
        const multiImageUsages = await FeatureUsage.findAll({
          where: {
            featureName: 'MULTI_IMAGE_TO_VIDEO'
          },
          order: [['createdAt', 'DESC']],
          limit: 50
        });
        
        for (const usage of multiImageUsages) {
          if (usage.details) {
            try {
              const taskDetails = JSON.parse(usage.details);
              if (taskDetails.tasks && Array.isArray(taskDetails.tasks)) {
                const found = taskDetails.tasks.find(t => t.taskId === taskId);
                if (found) {
                  isMultiImageVideoTask = true;
                  console.log(`确认为多图转视频任务: taskId=${taskId}`);
                  break;
                }
              }
            } catch (parseError) {
              // 忽略解析错误，继续检查下一个
            }
          }
        }
        
        // 如果数据库中没找到，检查测试模式缓存
        if (!isMultiImageVideoTask && global.taskCache && global.taskCache[taskId]) {
          isMultiImageVideoTask = true;
          console.log(`确认为多图转视频测试任务: taskId=${taskId}`);
        }
      }
      
    } catch (dbError) {
      console.error('检查任务类型时数据库查询失败:', dbError);
      // 如果数据库查询失败，回退到原有的格式检测
      if (!isVideoSubtitleTask) {
        isMultiImageVideoTask = /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/i.test(taskId);
      }
    }
    
    // 处理视频去字幕任务状态查询
    if (isVideoSubtitleTask) {
      console.log('检测到视频去字幕任务，查询阿里云视频增强API状态');
      
      try {
        // 从数据库中查找对应的阿里云RequestId
        const { FeatureUsage } = require('./models/FeatureUsage');
        
        const featureUsages = await FeatureUsage.findAll({
          where: {
            featureName: ['VIDEO_SUBTITLE_REMOVAL', 'VIDEO_SUBTITLE_REMOVER']
          },
          order: [['createdAt', 'DESC']],
          limit: 100
        });
        
        let aliCloudRequestId = null;
        let foundTask = null;
        
        // 在任务详情中查找匹配的taskId
        for (const usage of featureUsages) {
          if (usage.details) {
            try {
              const taskDetails = JSON.parse(usage.details);
              if (taskDetails.tasks && Array.isArray(taskDetails.tasks)) {
                const task = taskDetails.tasks.find(t => t.taskId === taskId);
                if (task) {
                  aliCloudRequestId = task.aliCloudRequestId;
                  foundTask = task;
                  console.log(`找到视频去字幕任务: taskId=${taskId}, aliCloudRequestId=${aliCloudRequestId}`);
                  break;
                }
              }
            } catch (parseError) {
              console.error('解析任务详情失败:', parseError);
            }
          }
        }
        
        if (!aliCloudRequestId) {
          console.log(`未找到taskId=${taskId}对应的aliCloudRequestId`);
          // 返回处理中状态而不是错误，避免前端显示"未知状态"
          return res.status(200).json({
            success: true,
            data: {
              taskId: taskId,
              status: 'processing',
              message: '任务处理中，请稍后查询',
              progress: 30
            },
            // 兼容前端期望的格式
            output: {
              task_id: taskId,
              task_status: 'RUNNING'
            }
          });
        }
        
        // 调用阿里云视频增强API查询状态
        const result = await queryVideoEnhancementStatus(aliCloudRequestId);
        console.log('阿里云视频增强API查询结果:', JSON.stringify(result, null, 2));
        
        // 处理查询结果
        if (result.success) {
          const status = result.data.Status;
          let taskStatus = 'processing';
          let outputStatus = 'RUNNING';
          
          // 正确映射阿里云API状态
          if (status === 'PROCESS_SUCCESS' || status === 'Success') {
            taskStatus = 'completed';
            outputStatus = 'SUCCEEDED';
          } else if (status === 'PROCESS_FAILED' || status === 'Failed') {
            taskStatus = 'failed';
            outputStatus = 'FAILED';
          } else if (status === 'PROCESS_RUNNING' || status === 'Processing') {
            taskStatus = 'processing';
            outputStatus = 'RUNNING';
          }
          
          const response = {
            success: true,
            data: {
              taskId: taskId,
              status: taskStatus,
              aliCloudStatus: status,
              message: result.data.Message || (taskStatus === 'completed' ? '任务处理完成' : '任务处理中'),
              progress: result.data.Progress || (taskStatus === 'completed' ? 100 : (taskStatus === 'processing' ? 50 : 0))
            },
            // 兼容前端期望的格式
            output: {
              task_id: taskId,
              task_status: outputStatus
            }
          };
          
          // 如果任务完成，添加结果URL
          if ((status === 'PROCESS_SUCCESS' || status === 'Success') && result.data.VideoUrl) {
            response.data.resultUrl = result.data.VideoUrl;
            response.result = {
              videoUrl: result.data.VideoUrl
            };
          }
          
          return res.json(response);
        } else {
          console.error('查询视频去字幕任务状态失败:', result.message);
          // 返回处理中状态而不是错误
          return res.status(200).json({
            success: true,
            data: {
              taskId: taskId,
              status: 'processing',
              message: '任务状态查询中，请稍后重试',
              progress: 20
            },
            output: {
              task_id: taskId,
              task_status: 'RUNNING'
            }
          });
        }
        
      } catch (error) {
        console.error('查询视频去字幕任务状态异常:', error);
        // 返回处理中状态而不是错误
        return res.status(200).json({
          success: true,
          data: {
            taskId: taskId,
            status: 'processing',
            message: '任务状态查询中，请稍后重试',
            progress: 10
          },
          output: {
            task_id: taskId,
            task_status: 'RUNNING'
          }
        });
      }
    }
    // 处理多图转视频任务状态查询
    else if (isMultiImageVideoTask) {
      console.log('检测到多图转视频任务，使用阿里云视频增强API查询状态');
      
      try {
        // 首先从数据库中查找真正的阿里云RequestId (JobId)
        const { FeatureUsage } = require('./models/FeatureUsage');
        
        // 查找包含该taskId的功能使用记录
        const featureUsages = await FeatureUsage.findAll({
          where: {
            featureName: 'MULTI_IMAGE_TO_VIDEO'
          },
          order: [['createdAt', 'DESC']],
          limit: 100 // 限制查询数量，避免性能问题
        });
        
        let aliCloudRequestId = null;
        let foundTask = null;
        
        // 在任务详情中查找匹配的taskId
        for (const usage of featureUsages) {
          if (usage.details) {
            try {
              const taskDetails = JSON.parse(usage.details);
              if (taskDetails.tasks && Array.isArray(taskDetails.tasks)) {
                const task = taskDetails.tasks.find(t => t.taskId === taskId);
                if (task) {
                  aliCloudRequestId = task.aliCloudRequestId;
                  foundTask = task;
                  console.log(`找到匹配任务: taskId=${taskId}, aliCloudRequestId=${aliCloudRequestId}`);
                  break;
                }
              }
            } catch (parseError) {
              console.error('解析任务详情失败:', parseError);
            }
          }
        }
        
        // 如果没有找到阿里云RequestId，检查是否为测试模式任务
        if (!aliCloudRequestId) {
          console.log(`未找到taskId=${taskId}对应的aliCloudRequestId，检查测试模式任务`);
          
          // 检查测试模式任务缓存
          if (global.taskCache && global.taskCache[taskId]) {
            const testTask = global.taskCache[taskId];
            console.log(`找到测试模式任务: ${taskId}，状态: ${testTask.status}`);
            
            return res.status(200).json({
              success: true,
              task: {
                id: taskId,
                status: testTask.status,
                videoUrl: testTask.videoUrl,
                videoCoverUrl: testTask.videoCoverUrl,
                videoDuration: testTask.videoDuration,
                videoWidth: testTask.videoWidth,
                videoHeight: testTask.videoHeight,
                createdAt: new Date(testTask.createdAt).toISOString(),
                updatedAt: testTask.completedAt || new Date().toISOString()
              },
              output: {
                task_status: testTask.status === 'SUCCEEDED' ? 'SUCCEEDED' : 
                           testTask.status === 'FAILED' ? 'FAILED' : 'RUNNING',
                result_url: testTask.videoUrl,
                video_url: testTask.videoUrl
              },
              result: testTask.videoUrl ? {
                videoUrl: testTask.videoUrl,
                videoCoverUrl: testTask.videoCoverUrl
              } : null
            });
          }
          
          return res.status(404).json({
            success: false,
            message: '任务不存在或已过期',
            error: `未找到taskId=${taskId}对应的阿里云JobId`
          });
        }
        
        console.log(`使用阿里云RequestId查询任务状态: ${aliCloudRequestId}`);
        
        // 使用阿里云POP Core SDK查询多图转视频任务状态
        const Core = require('@alicloud/pop-core');
        
        // 创建POP Core客户端
        const client = new Core({
          accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
          accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
          endpoint: 'https://videoenhan.cn-shanghai.aliyuncs.com',
          apiVersion: '2020-03-20'
        });
        
        // 调用查询任务状态API，使用正确的aliCloudRequestId
        const response = await client.request('GetAsyncJobResult', {
          JobId: aliCloudRequestId
        }, {
          method: 'POST'
        });

        console.log('多图转视频任务状态查询响应:', response);
        console.log('响应结构分析:', {
          hasData: !!response.Data,
          dataType: typeof response.Data,
          dataValue: response.Data,
          responseKeys: Object.keys(response || {}),
          fullResponse: JSON.stringify(response, null, 2)
        });

        const jobResult = response.Data;
        let status = 'processing';
        let originalStatus = jobResult?.Status || 'UNKNOWN';

        // 映射阿里云视频增强API状态到标准状态
        if (originalStatus === 'PROCESS_SUCCESS') {
          status = 'completed';
        } else if (originalStatus === 'PROCESS_FAILED') {
          status = 'failed';
        } else if (originalStatus === 'SUCCEEDED') {
          status = 'completed';
        } else if (originalStatus === 'FAILED') {
          status = 'failed';
        } else if (originalStatus === 'RUNNING') {
          status = 'processing';
        } else if (originalStatus === 'PENDING') {
          status = 'processing';
        } else if (originalStatus === 'QUEUED') {
          status = 'processing';
        } else if (originalStatus === 'PROCESSING') {
          status = 'processing';
        } else if (originalStatus === 'WAITING') {
          status = 'processing';
        } else if (originalStatus === 'IN_PROGRESS') {
          status = 'processing';
        } else if (originalStatus === 'STARTING') {
          status = 'processing';
        } else if (originalStatus === 'INITIALIZING') {
          status = 'processing';
        } else if (!originalStatus || originalStatus === 'null' || originalStatus === 'undefined') {
          console.log('状态值为空，默认为处理中');
          status = 'processing';
          originalStatus = 'EMPTY';
        } else {
          console.log('未知状态值:', originalStatus, '类型:', typeof originalStatus);
          status = 'processing';
        }

        console.log('状态映射结果:', {
          originalStatus,
          mappedStatus: status,
          jobResult: jobResult
        });

        // 构建响应数据
        let responseData = {
          success: true,
          status: status,
          originalStatus: originalStatus,
          taskId: taskId,
          result: jobResult?.Result || {},
          message: jobResult?.Message || '',
          task: {
            id: taskId,
            status: status,  // 使用映射后的状态
            originalStatus: originalStatus,  // 保留原始状态用于调试
            result: jobResult?.Result || {},
            message: jobResult?.Message || ''
          },
          // 为兼容性添加output字段
          output: {
            task_status: status === 'completed' ? 'SUCCEEDED' : 
                        status === 'failed' ? 'FAILED' : 'RUNNING'
          }
        };

        // 如果任务失败，添加错误信息到result对象
        if (status === 'failed') {
          console.log('任务失败，分析错误信息:', {
            jobResult: jobResult,
            jobResultType: typeof jobResult,
            jobResultKeys: jobResult ? Object.keys(jobResult) : 'null',
            response: response,
            responseKeys: Object.keys(response || {})
          });
          
          // 尝试从多个字段获取错误信息
          let errorMessage = '任务处理失败';
          let errorCode = 'TASK_FAILED';
          
          if (jobResult) {
            errorMessage = jobResult.ErrorMessage || jobResult.Message || jobResult.error || jobResult.errorMessage || errorMessage;
            errorCode = jobResult.ErrorCode || jobResult.Code || jobResult.errorCode || errorCode;
          } else if (response) {
            // 如果jobResult为空，尝试从response的其他字段获取错误信息
            errorMessage = response.Message || response.message || response.ErrorMessage || response.errorMessage || errorMessage;
            errorCode = response.Code || response.code || response.ErrorCode || response.errorCode || errorCode;
          }
          
          console.log('提取的错误信息:', {
            errorMessage,
            errorCode,
            source: jobResult ? 'jobResult' : 'response'
          });
          
          // 重新构建响应数据，确保错误信息正确传递
          responseData = {
            success: false,
            status: status,
            originalStatus: originalStatus,
            taskId: taskId,
            result: {
              error: errorMessage,
              errorCode: errorCode,
              jobId: jobResult?.JobId || taskId
            },
            message: errorMessage,
            error: errorMessage,
            task: {
              id: taskId,
              status: status,  // 使用映射后的状态
              originalStatus: originalStatus,  // 保留原始状态用于调试
              result: {
                error: errorMessage,
                errorCode: errorCode,
                jobId: jobResult?.JobId || taskId
              },
              message: errorMessage,
              error: errorMessage,
              errorCode: errorCode
            },
            // 为兼容性添加output字段
            output: {
              task_status: 'FAILED',
              error: errorMessage,
              errorCode: errorCode
            }
          };
        }

        // 如果任务完成，解析结果并添加视频URL
        if (status === 'completed' && jobResult?.Result) {
          try {
            let result = {};
            if (typeof jobResult.Result === 'string') {
              result = JSON.parse(jobResult.Result);
            } else {
              result = jobResult.Result;
            }
            
            // 构建前端期望的result格式
            const videoResult = {
              videoUrl: result.VideoUrl || result.videoUrl || result.video_url || null,
              videoCoverUrl: result.VideoCoverUrl || result.videoCoverUrl || result.video_cover_url || null,
              duration: result.Duration || result.duration || null,
              width: result.Width || result.width || null,
              height: result.Height || result.height || null
            };
            
            responseData.result = videoResult;
            // 同时更新task对象中的结果信息
            responseData.task.result = videoResult;
            
            console.log('多图转视频任务完成，解析结果:', {
              originalResult: jobResult.Result,
              parsedResult: result,
              videoUrl: responseData.result.videoUrl
            });
            
            // 更新数据库中的任务状态和结果
            if (foundTask && videoResult.videoUrl) {
              try {
                foundTask.status = 'SUCCEEDED';
                foundTask.videoUrl = videoResult.videoUrl;
                foundTask.videoCoverUrl = videoResult.videoCoverUrl;
                foundTask.videoDuration = videoResult.duration;
                foundTask.videoWidth = videoResult.width;
                foundTask.videoHeight = videoResult.height;
                foundTask.completedAt = new Date().toISOString();
                
                // 查找并更新对应的FeatureUsage记录
                for (const usage of featureUsages) {
                  if (usage.details) {
                    try {
                      const taskDetails = JSON.parse(usage.details);
                      if (taskDetails.tasks && Array.isArray(taskDetails.tasks)) {
                        const taskIndex = taskDetails.tasks.findIndex(t => t.taskId === taskId);
                        if (taskIndex !== -1) {
                          taskDetails.tasks[taskIndex] = foundTask;
                          await FeatureUsage.update(
                            { details: JSON.stringify(taskDetails) },
                            { where: { id: usage.id } }
                          );
                          console.log(`已更新数据库中任务 ${taskId} 的完成状态`);
                          break;
                        }
                      }
                    } catch (updateError) {
                      console.error('更新数据库任务状态失败:', updateError);
                    }
                  }
                }
              } catch (dbUpdateError) {
                console.error('更新任务完成状态到数据库失败:', dbUpdateError);
              }
            }
            
          } catch (parseError) {
            console.error('解析多图转视频结果失败:', parseError);
            const errorResult = {
              videoUrl: null,
              videoCoverUrl: null,
              error: '结果解析失败'
            };
            responseData.result = errorResult;
            // 同时更新task对象中的错误信息
            responseData.task.result = errorResult;
            responseData.task.error = '结果解析失败';
          }
        }

        return res.status(200).json(responseData);

      } catch (apiError) {
        console.error('多图转视频任务状态查询失败:', apiError.response?.data || apiError.message);
        
        // 返回处理中状态，避免前端报错
        return res.status(200).json({
          status: 'processing',
          originalStatus: 'API_ERROR',
          taskId: taskId,
          result: {},
          message: '状态查询失败，请稍后重试'
        });
      }
    }

    // 调用DashScope API查询其他任务状态
    try {
      const response = await axios({
        method: 'GET',
        url: `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`
        }
      });

      console.log('查询任务状态响应:', {
        taskStatus: response.data.output.task_status,
        hasResultUrl: !!response.data.output.result_url
      });

      // 检查任务状态并处理退款
      const taskStatus = response.data.output.task_status;
      
      // 调试问题：检查响应数据完整性
      console.log('完整响应数据:', JSON.stringify(response.data, null, 2));
      
      // 处理任务成功的情况
      if (taskStatus === 'SUCCEEDED') {
        if (!response.data.output.result_url) {
          console.warn('警告: 任务状态为成功但缺少result_url字段');
          
          // 尝试从其他可能的位置获取result_url
          if (response.data.output.result_urls) {
            console.log('从result_urls数组获取URL');
            response.data.output.result_url = response.data.output.result_urls[0] || '';
          }
          
          // 检查results字段（根据截图）
          if (!response.data.output.result_url && response.data.output.results) {
            console.log('检查results字段');
            if (Array.isArray(response.data.output.results) && response.data.output.results.length > 0) {
              // results是数组(标准格式)
              console.log('从results数组获取URL');
              if (response.data.output.results[0].url) {
                console.log('从results[0].url字段获取URL');
                response.data.output.result_url = response.data.output.results[0].url;
              }
            } else if (typeof response.data.output.results === 'object' && response.data.output.results.url) {
              // results是对象
              console.log('从results.url字段获取URL');
              response.data.output.result_url = response.data.output.results.url;
            }
          }
        }
      } else if (taskStatus === 'FAILED') {
        // 处理任务失败的情况 - 执行退款逻辑
        try {
          await refundVirtualShoeModelCredits(req.user.id, taskId);
        } catch (refundError) {
          console.error('鞋靴虚拟试穿任务失败退款处理错误 (路径参数API):', refundError);
        }
      }
      
      // 对于其他任务类型，处理响应并避免UNKNOWN状态
      const responseData = response.data;
      
      // 如果任务状态是UNKNOWN，转换为更友好的状态
      if (responseData.output && responseData.output.task_status === 'UNKNOWN') {
        console.log('检测到UNKNOWN状态，转换为NOT_FOUND状态');
        
        return res.status(404).json({
          success: false,
          message: '任务不存在或已过期',
          code: 'TaskNotFound',
          data: {
            taskId: taskId,
            status: 'not_found',
            error: '任务记录未找到，可能已过期或创建失败'
          },
          output: {
            task_id: taskId,
            task_status: 'NOT_FOUND'
          }
        });
      }
      
      // 返回原始响应
      res.status(200).json(responseData);
    } catch (apiError) {
      console.error('查询任务状态失败:', apiError.response?.data || apiError.message);
      
      // 处理不同类型的API错误
      if (apiError.response) {
        const status = apiError.response.status;
        const errorData = apiError.response.data;
        
        // 根据HTTP状态码提供不同的错误处理
        if (status === 404) {
          return res.status(404).json({
            code: 'TaskNotFound',
            message: '任务不存在或已过期',
            request_id: Date.now().toString(),
            details: errorData
          });
        } else if (status === 401 || status === 403) {
          return res.status(status).json({
            code: 'AuthError',
            message: 'API认证失败，请联系管理员',
            request_id: Date.now().toString(),
            details: errorData
          });
        } else if (status >= 400 && status < 500) {
          return res.status(status).json({
            code: errorData?.code || 'ClientError',
            message: errorData?.message || '请求参数错误',
            request_id: errorData?.request_id || Date.now().toString(),
            details: errorData
          });
        } else {
          return res.status(status).json({
            code: errorData?.code || 'ServerError',
            message: errorData?.message || '阿里云服务暂时不可用',
            request_id: errorData?.request_id || Date.now().toString(),
            details: errorData
          });
        }
      } else {
        // 网络错误或其他错误
        return res.status(500).json({
          code: 'NetworkError',
          message: '网络连接错误，请稍后重试',
          request_id: Date.now().toString(),
          details: { error: apiError.message }
        });
      }
    }
  } catch (error) {
    console.error('查询任务状态出现异常:', error);
    res.status(500).json({
      code: 'InternalError',
      message: '服务器内部错误',
      request_id: Date.now().toString(),
      details: { error: error.message }
    });
  }
});

// 上传图片到OSS并返回可公开访问的URL - 专用于鞋靴试穿功能
app.post('/api/image-to-oss', protect, memoryUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '未提供图片文件'
      });
    }

    console.log('收到图片上传请求:', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      imageType: req.body.imageType
    });

    // 检查文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/bmp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: '不支持的图片格式，请上传JPG、PNG、BMP或WEBP格式的图片'
      });
    }

    // 检查文件大小，限制为5MB
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: '图片大小超过限制，请上传小于5MB的图片'
      });
    }

    try {
      // 直接使用buffer上传到OSS，不保存到本地
      const imageUrl = await uploadToOSS(req.file.buffer, req.file.originalname, 'general');
      
      console.log('图片上传到OSS成功:', imageUrl);

      // 不再记录上传历史到ImageHistory，这样图片就不会出现在下载中心
      // 删除这段代码
      /* 
      try {
        await ImageHistory.create({
          userId: req.user.id,
          imageUrl: imageUrl,  // 确保这个字段有值
          title: req.file.originalname,
          originalImageUrl: imageUrl,
          type: req.body.imageType === 'model' ? 'MODEL_TEMPLATE' : 'SHOE_IMAGE',
          processType: '鞋靴虚拟试穿',
          metadata: {
            fileType: req.file.mimetype,
            fileSize: req.file.size,
            category: req.body.imageType
          }
        });
      } catch (historyError) {
        console.error('记录上传历史失败:', historyError);
        // 继续处理，不影响主流程
      }
      */

      res.status(200).json({
        success: true,
        message: '图片上传成功',
        imageUrl: imageUrl
      });
    } catch (ossError) {
      console.error('上传到OSS失败:', ossError);
      res.status(500).json({
        success: false,
        message: '上传图片到OSS服务器失败',
        error: ossError.message
      });
    }
  } catch (error) {
    console.error('处理图片上传请求失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器处理上传请求失败',
      error: error.message
    });
  }
});

// 上传视频到OSS的函数
async function uploadVideoToOSS(file) {
  try {
    const fileContent = fs.readFileSync(file.path);
    const ossFileName = `video-subtitle-remover/${Date.now()}-${uuidv4()}.mp4`;
    
    // 上传到OSS
    await ossClient.put(ossFileName, fileContent);
    
    // 删除临时文件
    fs.unlinkSync(file.path);
    
    // 返回OSS URL
    return `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION.startsWith('oss-') ? process.env.OSS_REGION : 'oss-' + process.env.OSS_REGION}.aliyuncs.com/${ossFileName}`;
  } catch (error) {
    console.error('上传视频到OSS失败:', error);
    // 删除临时文件
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    throw error;
  }
}

// 创建阿里云SDK客户端
function createVideoEnhanceClient() {
  // 使用环境变量中的密钥
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  
  if (!accessKeyId || !accessKeySecret) {
    throw new Error('缺少阿里云API密钥配置');
  }
  
  let config = new OpenApi.Config({
    accessKeyId: accessKeyId,
    accessKeySecret: accessKeySecret,
    connectTimeout: 60000, // 连接超时时间设置为60秒
    readTimeout: 60000, // 读取超时时间设置为60秒
  });
  
  // 使用视频增强服务的上海区域端点
  config.endpoint = 'videoenhan.cn-shanghai.aliyuncs.com';
  return new videoenhan20200320.default(config);
}

// 上传视频API
app.post('/api/upload-video', protect, async (req, res) => {
  try {
    const { user } = req;
    
    // 检查用户是否有足够的积分(至少10积分)
    if (user.credits < 10) {
      return res.status(400).json({ error: '积分不足，至少需要10积分' });
    }
    
    // 直接使用videoUpload中间件处理文件上传，不需要嵌套调用upload
    videoUpload.single('video')(req, res, async (err) => {
      if (err) {
        console.error('文件上传错误:', err);
        return res.status(400).json({ error: err.message });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: '未找到上传的视频文件' });
      }
      
      try {
        // 上传视频到OSS
        const ossUrl = await uploadVideoToOSS(req.file);
        
        // 返回OSS URL
        return res.json({ 
          success: true, 
          message: '视频上传成功',
          videoUrl: ossUrl
        });
      } catch (error) {
        console.error('视频处理错误:', error);
        return res.status(500).json({ 
          error: '视频上传失败', 
          details: error.message 
        });
      }
    });
  } catch (error) {
    console.error('上传视频API错误:', error);
    res.status(500).json({ error: '服务器错误', details: error.message });
  }
});

/**
 * 添加视频去除字幕任务到OSS
 * @param {string} userId - 用户ID
 * @param {Object} task - 任务数据
 * @returns {Promise<void>}
 */
async function addVideoSubtitleTaskToOSS(userId, task) {
    try {
        // 从OSS加载现有任务
        const existingTasks = await loadVideoSubtitleTasksFromOSS(userId);
        
        // 查找是否已存在相同的任务（通过taskId或id匹配）
        const taskId = task.taskId || task.id;
        const existingIndex = existingTasks.findIndex(t => (t.taskId || t.id) === taskId);
        
        if (existingIndex !== -1) {
            // 更新现有任务
            existingTasks[existingIndex] = { ...existingTasks[existingIndex], ...task };
            console.log(`视频去除字幕任务已更新到OSS: ${taskId}`);
        } else {
            // 添加新任务到开头
            existingTasks.unshift(task);
            console.log(`视频去除字幕任务已添加到OSS: ${taskId}`);
        }
        
        // 只保留最近50个任务
        const tasksToSave = existingTasks.slice(0, 50);
        
        // 保存到OSS
        await saveVideoSubtitleTasksToOSS(userId, tasksToSave);
        
    } catch (error) {
        console.error('添加/更新视频去除字幕任务到OSS失败:', error);
        throw error;
    }
}

/**
 * 从OSS加载视频去除字幕任务列表
 * @param {string} userId - 用户ID
 * @returns {Promise<Array>} 任务列表
 */
async function loadVideoSubtitleTasksFromOSS(userId) {
    try {
        const ossPath = `video-subtitle-remover/tasks/${userId}/tasks.json`;
        const result = await ossClient.get(ossPath);
        const tasks = JSON.parse(result.content.toString());
        console.log(`从OSS加载视频去除字幕任务列表成功: ${tasks.length}个任务`);
        return tasks;
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            console.log(`用户${userId}的视频去除字幕任务列表不存在，返回空列表`);
            return [];
        }
        console.error('从OSS加载视频去除字幕任务列表失败:', error);
        throw error;
    }
}

/**
 * 保存视频去除字幕任务列表到OSS
 * @param {string} userId - 用户ID
 * @param {Array} tasks - 任务列表
 * @returns {Promise<void>}
 */
async function saveVideoSubtitleTasksToOSS(userId, tasks) {
    try {
        const ossPath = `video-subtitle-remover/tasks/${userId}/tasks.json`;
        const tasksJson = JSON.stringify(tasks, null, 2);
        
        // 将字符串转换为Buffer，这是OSS客户端期望的格式
        await ossClient.put(ossPath, Buffer.from(tasksJson, 'utf8'));
        console.log(`视频去除字幕任务列表已保存到OSS: ${tasks.length}个任务`);
    } catch (error) {
        console.error('保存视频去除字幕任务列表到OSS失败:', error);
        throw error;
    }
}

/**
 * 清空用户的视频去字幕任务记录
 * @param {string} userId - 用户ID
 * @returns {Promise<void>}
 */
async function clearVideoSubtitleTasksFromOSS(userId) {
    try {
        const ossPath = `video-subtitle-remover/tasks/${userId}/tasks.json`;
        
        // 检查文件是否存在
        try {
            await ossClient.head(ossPath);
            // 文件存在，删除它
            await ossClient.delete(ossPath);
            console.log(`用户 ${userId} 的视频去除字幕任务记录已从OSS清空`);
        } catch (headError) {
            if (headError.code === 'NoSuchKey') {
                console.log(`用户 ${userId} 的视频去除字幕任务记录不存在，无需清空`);
            } else {
                throw headError;
            }
        }
    } catch (error) {
        console.error('清空视频去除字幕任务记录失败:', error);
        throw error;
    }
}

// 视频去字幕API端点 - 新的标准化端点
app.post('/api/video-subtitle-removal/create', protect, async (req, res) => {
  // 使用videoUpload中间件处理文件上传
  videoUpload.single('video')(req, res, async (err) => {
    if (err) {
      console.error('文件上传错误:', err);
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: '未找到上传的视频文件' });
    }
    
    // 手动检查权限，不使用统一中间件（避免自动扣除积分）
    try {
      const userId = req.user.id;
      
      // 上传视频到OSS并获取URL
      const videoUrl = await uploadVideoToOSS(req.file);
      console.log('视频上传到OSS成功:', videoUrl);
      
      // 获取前端传递的实际视频时长（如果有）
      const actualDuration = req.body.videoDuration;
      console.log('前端传递的视频时长:', actualDuration);
      
      // 获取视频时长，优先使用前端传递的实际时长
      const videoDurationFromAPI = await getVideoDuration(videoUrl, actualDuration);
      console.log('获取到视频时长:', videoDurationFromAPI, '秒');
      
      // 获取视频时长（秒）
      if (videoDurationFromAPI === null) {
        return res.status(400).json({ 
          success: false, 
          message: '无法获取视频时长，请确保前端正确传递视频时长' 
        });
      }
      
      let duration = parseInt(videoDurationFromAPI);
      if (!duration || duration <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: '视频时长无效，请确保前端正确传递视频时长' 
        });
      }
    
    // 计算所需积分（每30秒30积分）
    const creditCost = Math.ceil(duration / 30) * 30;
    
    // 检查用户积分是否足够
    const User = require('./models/User');
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    if (user.credits < creditCost) {
      return res.status(402).json({
        success: false,
        message: '积分不足',
        data: {
          requiredCredits: creditCost,
          currentCredits: user.credits
        }
      });
    }
    
    console.log(`视频去除字幕功能权限检查 - 用户ID=${userId}, 积分=${user.credits}, 所需积分=${creditCost}, 视频时长=${duration}秒`);
    
    console.log('视频字幕擦除请求:', { videoUrl, videoDuration: duration });
    
    if (!videoUrl) {
      return res.status(400).json({ error: '缺少视频URL参数' });
    }
    
    console.log(`视频时长: ${duration}秒`);
    
    // 检查是否为免费使用
    const { FeatureUsage } = require('./models/FeatureUsage');
    const FEATURES = require('./middleware/featureAccess').FEATURES;
    
    // 获取功能配置
    const featureConfig = FEATURES['VIDEO_SUBTITLE_REMOVER'];
    
    // 查找用户的功能使用记录
    let usage = await FeatureUsage.findOne({
      where: {
        userId: userId,
        featureName: 'VIDEO_SUBTITLE_REMOVER'
      }
    });
    
    // 判断是否为免费使用
    let isFree = false;
    if (!usage) {
      // 🔧 修复：视频去除字幕功能无免费次数，首次使用也需要收费
      try {
        usage = await FeatureUsage.create({
          userId: userId,
          featureName: 'VIDEO_SUBTITLE_REMOVER',
          usageCount: 1, // 直接设置为1，表示已使用一次
          lastUsedAt: new Date(),
          resetDate: new Date().toISOString().split('T')[0]
        });
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY' || error.original?.code === 'ER_DUP_ENTRY') {
          // 重复键错误，查询现有记录
          console.log('记录已存在，查询现有记录');
          usage = await FeatureUsage.findOne({
            where: {
              userId: userId,
              featureName: 'VIDEO_SUBTITLE_REMOVER'
            }
          });
        } else {
          throw error;
        }
      }
      // 🔧 修复：首次使用不再免费
      isFree = false;
    } else if (usage.usageCount < featureConfig.freeUsage) {
      // 免费次数未用完，更新使用次数
      isFree = true;
      usage.usageCount += 1;
      await usage.save();
    }
    
    console.log(`视频去除字幕功能 - 用户ID=${userId}, 使用次数=${usage.usageCount}, 免费次数=${featureConfig.freeUsage}, 是否免费=${isFree}`);
    
    // 检查视频URL格式
    if (!videoUrl.startsWith('http')) {
      return res.status(400).json({ 
        error: '无效的视频URL格式',
        details: '视频URL必须是有效的HTTP/HTTPS URL'
      });
    }
    
    try {
      // 使用阿里云SDK调用视频字幕擦除API
      const client = createVideoEnhanceClient();
      
      // 根据字幕位置设置区域参数
      const subtitlePosition = req.body.subtitlePosition || 'Bottom'; // 默认为底部字幕
      let bx = 0, by = 0.7, bw = 1, bh = 0.3; // 默认：底部30%区域（推荐配置）
      
      if (subtitlePosition === 'Top') {
        // 顶部字幕区域 - 覆盖画面上方30%区域
        bx = 0; by = 0; bw = 1; bh = 0.3;
        console.log('设置字幕区域: 顶部30%');
      } else if (subtitlePosition === 'Bottom') {
        // 底部字幕区域 - 覆盖底部30%区域（官方推荐区域扩展）
        bx = 0; by = 0.7; bw = 1; bh = 0.3;
        console.log('设置字幕区域: 底部30%');
      } else if (subtitlePosition === 'Center') {
        // 中间字幕区域 - 覆盖画面中间60%区域
        bx = 0; by = 0.2; bw = 1; bh = 0.6;
        console.log('设置字幕区域: 中间60%');
      } else if (subtitlePosition === 'All') {
        // 全画面字幕处理 - 覆盖整个视频
        bx = 0; by = 0; bw = 1; bh = 1;
        console.log('设置字幕区域: 全画面');
      } else {
        // 默认使用官方推荐的底部字幕区域
        bx = 0; by = 0.75; bw = 1; bh = 0.25;
        console.log('设置字幕区域: 官方默认底部25%');
      }
      
      // 如果用户提供了自定义坐标参数，优先使用用户参数
      if (req.body.customArea) {
        const { x, y, width, height } = req.body.customArea;
        if (x !== undefined) bx = parseFloat(x);
        if (y !== undefined) by = parseFloat(y);
        if (width !== undefined) bw = parseFloat(width);
        if (height !== undefined) bh = parseFloat(height);
        console.log('使用用户自定义字幕区域:', req.body.customArea);
      }
      
      // 创建请求对象，直接在构造函数中设置所有参数
      const eraseVideoSubtitlesRequest = new videoenhan20200320.EraseVideoSubtitlesRequest({
        videoUrl: videoUrl,
        BX: bx,
        BY: by,
        BW: bw,
        BH: bh
      });
      
      // 详细记录API调用参数，便于调试
      console.log('调用阿里云视频字幕擦除API，请求参数:', {
        videoUrl: videoUrl,
        subtitlePosition: subtitlePosition,
        BX: eraseVideoSubtitlesRequest.BX,
        BY: eraseVideoSubtitlesRequest.BY,
        BW: eraseVideoSubtitlesRequest.BW,
        BH: eraseVideoSubtitlesRequest.BH,
        requestObject: eraseVideoSubtitlesRequest
      });
      
      const response = await client.eraseVideoSubtitles(eraseVideoSubtitlesRequest);
      
      console.log('阿里云视频字幕擦除API响应:', JSON.stringify(response.body, null, 2));
      
      // 阿里云API返回的是requestId，不是data.taskId
      const taskId = response.body.requestId;
      
      if (!taskId) {
        throw new Error('未获取到任务ID');
      }
      
      // 只有在API调用成功后才扣除积分
      if (!isFree) {
        // 扣除积分
        await user.update({
          credits: user.credits - creditCost
        });
        console.log(`已扣除积分: ${creditCost}, 剩余积分: ${user.credits - creditCost}`);
      } else {
        console.log(`免费使用，未扣除积分，剩余积分: ${user.credits}`);
      }
      
      // 🔧 重要修复：使用统一的saveTaskDetails函数保存任务记录，确保格式一致
      if (usage) {
        // 确保details字段使用正确的格式
        if (!usage.details) {
          usage.details = JSON.stringify({ tasks: [] });
          await usage.save();
        }
        
        // 使用统一的saveTaskDetails函数添加任务记录
        const { saveTaskDetails } = require('./middleware/unifiedFeatureUsage');
        await saveTaskDetails(usage, {
          taskId: taskId,
          featureName: 'VIDEO_SUBTITLE_REMOVER',
          status: 'processing',
          creditCost: isFree ? 0 : creditCost,
          isFree: isFree,
          operationText: `视频去除字幕处理 - 视频时长${Math.ceil(duration)}秒`,
          timestamp: new Date().toISOString(),
          extraData: {
            aliCloudRequestId: taskId,
            videoUrl: videoUrl,
            videoDuration: duration,
            originalVideoUrl: videoUrl
          }
        });
        
        console.log(`✅ 视频去字幕任务记录已保存到使用记录: ${taskId}`);
      }
      
      // 创建任务记录并保存到OSS
      try {
        const taskRecord = {
          id: taskId,
          taskId: taskId, // 添加taskId字段以支持去重逻辑
          aliCloudRequestId: taskId, // 添加阿里云RequestID
          status: 'processing',
          createdAt: new Date().toISOString(), // 统一字段名
          originalVideoUrl: videoUrl, // 统一字段名
          videoDuration: duration, // 统一字段名
          creditCost: isFree ? 0 : creditCost, // 统一字段名
          isFree: isFree, // 统一字段名
          userId: userId // 统一字段名
        };
        
        await addVideoSubtitleTaskToOSS(userId, taskRecord);
        console.log('✅ 视频去字幕任务记录已保存到OSS:', taskId);
      } catch (ossError) {
        console.error('❌ 保存任务记录到OSS失败:', ossError.message);
        // 不影响主流程，继续返回成功响应
      }
      
      res.json({
        success: true,
        taskId: taskId,
        message: '视频字幕擦除任务已提交，请稍等处理完成',
        creditsUsed: isFree ? 0 : creditCost,
        remainingCredits: user.credits - (isFree ? 0 : creditCost),
        isFree: isFree
      });
      
    } catch (apiError) {
      console.error('调用阿里云API失败:', apiError);
      
      // 记录失败的功能使用
      try {
        await FeatureUsage.create({
          userId: userId,
          featureName: 'VIDEO_SUBTITLE_REMOVER',
          credits: 0, // 失败时不扣积分
          details: JSON.stringify({
            videoUrl: videoUrl,
            videoDuration: duration,
            error: apiError.message,
            success: false,
            isFree: isFree,
            timestamp: new Date().toISOString()
          })
        });
      } catch (recordError) {
        console.error('记录失败的功能使用失败:', recordError);
      }
      
      res.status(500).json({
        success: false,
        error: '视频处理失败',
        details: apiError.message || '未知错误'
      });
    }
    
    } catch (error) {
      console.error('视频字幕擦除API错误:', error);
      res.status(500).json({
        success: false,
        error: '服务器内部错误',
        details: error.message
      });
    }
  });
});

// 视频字幕擦除API使用统一中间件和动态积分计算（保留旧端点兼容性）
app.post('/api/remove-subtitles', protect, async (req, res) => {
  // 手动检查权限，不使用统一中间件（避免自动扣除积分）
  try {
    const userId = req.user.id;
    const { videoUrl, videoDuration } = req.body;
    
    // 获取视频时长（秒）
    let duration = parseInt(videoDuration) || 30;
    if (!duration || duration <= 0) {
      duration = 30;
    }
    
    // 计算所需积分（每30秒30积分）
    const creditCost = Math.ceil(duration / 30) * 30;
    
    // 检查用户积分是否足够
    const User = require('./models/User');
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    if (user.credits < creditCost) {
      return res.status(402).json({
        success: false,
        message: '积分不足',
        data: {
          requiredCredits: creditCost,
          currentCredits: user.credits
        }
      });
    }
    
    console.log(`视频去除字幕功能权限检查 - 用户ID=${userId}, 积分=${user.credits}, 所需积分=${creditCost}, 视频时长=${duration}秒`);
    
    console.log('视频字幕擦除请求:', { videoUrl, videoDuration: duration });
    
    if (!videoUrl) {
      return res.status(400).json({ error: '缺少视频URL参数' });
    }
    
    // 这里不需要再次获取视频时长，上面已经计算过了
    
    console.log(`视频时长: ${duration}秒`);
    
    // 检查是否为免费使用
    const { FeatureUsage } = require('./models/FeatureUsage');
    const FEATURES = require('./middleware/featureAccess').FEATURES;
    
    // 获取功能配置
    const featureConfig = FEATURES['VIDEO_SUBTITLE_REMOVER'];
    
    // 查找用户的功能使用记录
    let usage = await FeatureUsage.findOne({
      where: {
        userId: userId,
        featureName: 'VIDEO_SUBTITLE_REMOVER'
      }
    });
    
    // 判断是否为免费使用
    let isFree = false;
    if (!usage) {
      // 🔧 修复：视频去除字幕功能无免费次数，首次使用也需要收费
      try {
      usage = await FeatureUsage.create({
        userId: userId,
        featureName: 'VIDEO_SUBTITLE_REMOVER',
        usageCount: 1, // 直接设置为1，表示已使用一次
        lastUsedAt: new Date(),
        resetDate: new Date().toISOString().split('T')[0]
      });
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY' || error.original?.code === 'ER_DUP_ENTRY') {
          // 重复键错误，查询现有记录
          console.log('记录已存在，查询现有记录');
          usage = await FeatureUsage.findOne({
            where: {
              userId: userId,
              featureName: 'VIDEO_SUBTITLE_REMOVER'
            }
          });
        } else {
          throw error;
        }
      }
      // 🔧 修复：首次使用不再免费
      isFree = false;
    } else if (usage.usageCount < featureConfig.freeUsage) {
      // 免费次数未用完，更新使用次数
      isFree = true;
      usage.usageCount += 1;
      await usage.save();
    }
    
    console.log(`视频去除字幕功能 - 用户ID=${userId}, 使用次数=${usage.usageCount}, 免费次数=${featureConfig.freeUsage}, 是否免费=${isFree}`);
    
    // 检查视频URL格式
    if (!videoUrl.startsWith('http')) {
      return res.status(400).json({ 
        error: '无效的视频URL格式',
        details: '视频URL必须是有效的HTTP/HTTPS URL'
      });
    }
    
    try {
      // 使用阿里云SDK调用视频字幕擦除API
      const client = createVideoEnhanceClient();
      
      // 根据字幕位置设置区域参数（旧版API兼容）
      const subtitlePosition = req.body.subtitlePosition || 'Bottom'; // 默认为底部字幕
      let bx = 0, by = 0.7, bw = 1, bh = 0.3; // 默认：底部30%区域（推荐配置）
      
      if (subtitlePosition === 'Top') {
        // 顶部字幕区域 - 覆盖画面上方30%区域
        bx = 0; by = 0; bw = 1; bh = 0.3;
        console.log('旧版API设置字幕区域: 顶部30%');
      } else if (subtitlePosition === 'Bottom') {
        // 底部字幕区域 - 覆盖底部30%区域
        bx = 0; by = 0.7; bw = 1; bh = 0.3;
        console.log('旧版API设置字幕区域: 底部30%');
      } else if (subtitlePosition === 'Center') {
        // 中间字幕区域 - 覆盖画面中间60%区域
        bx = 0; by = 0.2; bw = 1; bh = 0.6;
        console.log('旧版API设置字幕区域: 中间60%');
      } else if (subtitlePosition === 'All') {
        // 全画面字幕处理 - 覆盖整个视频
        bx = 0; by = 0; bw = 1; bh = 1;
        console.log('旧版API设置字幕区域: 全画面');
      } else {
        // 默认使用官方推荐的底部字幕区域
        bx = 0; by = 0.75; bw = 1; bh = 0.25;
        console.log('旧版API设置字幕区域: 官方默认底部25%');
      }
      
      // 创建请求对象，直接在构造函数中设置所有参数
      const eraseVideoSubtitlesRequest = new videoenhan20200320.EraseVideoSubtitlesRequest({
        videoUrl: videoUrl,
        BX: bx,
        BY: by,
        BW: bw,
        BH: bh
      });
      
      // 设置运行时选项
      const runtime = new Util.RuntimeOptions({
        connectTimeout: 60000, // 连接超时时间设置为60秒
        readTimeout: 60000, // 读取超时时间设置为60秒
        timeout: 60000 // 总超时时间设置为60秒
      });
      
      // 详细记录API调用参数，便于调试
      console.log('调用阿里云视频字幕擦除API，请求参数:', {
        videoUrl: videoUrl,
        subtitlePosition: subtitlePosition,
        BX: eraseVideoSubtitlesRequest.BX,
        BY: eraseVideoSubtitlesRequest.BY,
        BW: eraseVideoSubtitlesRequest.BW,
        BH: eraseVideoSubtitlesRequest.BH,
        requestObject: eraseVideoSubtitlesRequest
      });
      
      // 调用API
      const result = await client.eraseVideoSubtitlesWithOptions(eraseVideoSubtitlesRequest, runtime);
      
      console.log('视频字幕擦除API返回结果:', result);
      
      if (!result || !result.body || !result.body.requestId) {
        throw new Error('API返回结果格式不正确，缺少requestId');
      }
      
      // 保存任务详细信息
      try {
        // 获取任务ID
        const taskId = result.body.requestId;
        
        // 保存任务信息到全局变量，用于积分统计
        if (!global.videoSubtitleTasks) {
          global.videoSubtitleTasks = {};
        }
        
        global.videoSubtitleTasks[taskId] = {
          userId: user.id,
          creditCost: creditCost,
          hasChargedCredits: false,  // 明确设置为false，确保任务完成后才扣除积分
          timestamp: new Date(),
          videoDuration: duration,
          isFree: isFree,
          originalVideoUrl: videoUrl  // 保存原始视频URL用于OSS存储
        };
        
        console.log(`视频去除字幕任务创建 - 任务ID=${taskId}, 用户ID=${user.id}, 所需积分=${creditCost}, 视频时长=${duration}秒, 任务提交阶段不扣除积分`);
        
        console.log(`视频去除字幕任务信息已保存: 用户ID=${user.id}, 任务ID=${taskId}, 时长=${duration}秒, 积分=${creditCost}, 是否免费=${isFree}`);
        
        // 使用统一中间件的saveTaskDetails函数保存任务详情
                  try {
            const { FeatureUsage } = require('./models/FeatureUsage');
            const { saveTaskDetails } = require('./middleware/unifiedFeatureUsage');
            
            // 创建或查找FeatureUsage记录
            let [usage, created] = await FeatureUsage.findOrCreate({
              where: {
                userId: user.id,
                featureName: 'VIDEO_SUBTITLE_REMOVER'
              },
              defaults: {
                usageCount: 0,
                lastUsedAt: new Date(),
                resetDate: new Date().toISOString().split('T')[0]
              }
            });
            
            // 更新使用次数和保存任务详情
            if (isFree) {
              // 如果是免费使用，立即更新使用次数
              usage.usageCount += 1;
              await usage.save();
              console.log(`免费使用视频去除字幕功能，更新使用次数：${usage.usageCount}/${featureConfig.freeUsage}`);
            }
            
            // 保存任务详情
            await saveTaskDetails(usage, {
              taskId: taskId,
              creditCost: isFree ? 0 : creditCost, // 根据是否免费设置积分
              isFree: isFree,
              extraData: {
                videoDuration: duration
              }
            });
            
            console.log(`视频去除字幕任务ID=${taskId}已保存到数据库，是否免费：${isFree}，任务完成后${isFree ? '不' : '才'}会扣除积分`);
          } catch (saveError) {
            console.error('保存任务信息失败:', saveError);
            // 继续处理，不影响主要功能
          }
      } catch (dbError) {
        console.error('保存任务详细信息失败:', dbError);
        // 不阻止API返回结果
      }
      
      res.json({
        success: true,
        message: '视频字幕擦除任务已提交',
        jobId: result.body.requestId,
        requestId: result.body.requestId,
        duration: duration, // 返回视频时长供前端参考
        creditCost: creditCost, // 返回积分消耗
        isFree: isFree // 返回是否免费使用
      });
    } catch (error) {
      console.error('阿里云SDK调用失败:', error);
      
      // 提取错误信息
      let errorMessage = error.message || '未知错误';
      let errorCode = 'API_ERROR';
      
      if (error.data) {
        errorMessage = error.data.Message || errorMessage;
        errorCode = error.data.Code || errorCode;
      }
      
      res.status(500).json({ 
        error: '视频字幕擦除失败', 
        details: errorMessage,
        code: errorCode
      });
    }
  } catch (error) {
    console.error('视频字幕擦除请求处理错误:', error);
    
    res.status(500).json({ 
      error: '视频字幕擦除失败', 
      details: error.message 
    });
  }
});

// 查询任务状态API - 使用阿里云SDK
app.get('/api/check-job-status', protect, async (req, res) => {
  try {
    const { jobId } = req.query;
    
    if (!jobId) {
      return res.status(400).json({ error: '缺少任务ID参数' });
    }
    
    console.log('查询任务状态:', jobId);
    
    try {
      // 使用阿里云SDK创建客户端
      const client = createVideoEnhanceClient();
      
      // 创建查询请求
      const getAsyncJobResultRequest = new videoenhan20200320.GetAsyncJobResultRequest({
        jobId: jobId
      });
      
      // 运行时选项
      const runtime = new Util.RuntimeOptions({
        connectTimeout: 30000, // 连接超时时间设置为30秒
        readTimeout: 30000, // 读取超时时间设置为30秒
        timeout: 30000 // 总超时时间设置为30秒
      });
      
      // 调用API
      const result = await client.getAsyncJobResultWithOptions(getAsyncJobResultRequest, runtime);
      
      console.log('查询任务状态API结果:', JSON.stringify(result.body, null, 2));
      
      if (!result.body) {
        return res.status(500).json({ 
          error: '查询任务状态失败', 
          details: '返回结果为空' 
        });
      }
      
      // 提取关键信息
      const originalStatus = result.body.status;
      
      // 规范化状态 - 将所有成功状态统一为SUCCEEDED
      let status = originalStatus;
      if (originalStatus === 'PROCESS_SUCCESS' || originalStatus === 'SUCCESS') {
        status = 'SUCCEEDED';
        console.log(`规范化任务状态: 将 ${originalStatus} 转换为 SUCCEEDED`);
      }
      
      // 尝试从result.body.data.result中解析出videoUrl
      let videoUrl = result.body.data && result.body.data.videoUrl;
      
      // 如果直接的videoUrl为空，尝试从result字段中提取
      if (!videoUrl && result.body.data && result.body.data.result) {
        try {
          // 检查result是否是JSON字符串
          if (typeof result.body.data.result === 'string' && result.body.data.result.includes('VideoUrl')) {
            const match = result.body.data.result.match(/\"VideoUrl\":\"([^\"]+)\"/);
            if (match && match[1]) {
              videoUrl = match[1].replace(/\\u0026/g, '&');
              console.log('从result字段中提取出视频URL:', videoUrl);
              
              // 如果提取到了URL但状态不是成功，强制设置为成功
              if (status !== 'SUCCEEDED') {
                status = 'SUCCEEDED';
                console.log('检测到视频URL但状态不是成功，强制设置为SUCCEEDED');
              }
            }
          }
        } catch (e) {
          console.warn('尝试从result字段提取视频URL失败:', e);
        }
      }
      
      // 构建响应对象
      const response = {
        success: true,  // 添加success字段以兼容前端代码
        status: status,
        videoUrl: videoUrl,
        jobId: jobId,
        message: `任务状态: ${status}`,
        data: result.body.data || {}  // 保留原始data字段
      };
      
      // 如果任务成功完成或已有视频URL，更新数据库记录和扣除积分
      if ((status === 'SUCCEEDED' || status === 'PROCESS_SUCCESS' || videoUrl) && global.videoSubtitleTasks && global.videoSubtitleTasks[jobId]) {
        // 如果有视频URL但状态不是成功，强制更新状态
        if (videoUrl && status !== 'SUCCEEDED' && status !== 'PROCESS_SUCCESS') {
          status = 'SUCCEEDED';
          response.status = status;
          response.message = `任务状态: ${status} (已检测到视频URL)`;
          console.log(`检测到视频URL(${videoUrl})，强制更新任务状态为SUCCEEDED`);
        }
        const taskInfo = global.videoSubtitleTasks[jobId];
        
        // 只有在任务成功且尚未扣除积分的情况下才扣除积分
        if (!taskInfo.hasChargedCredits) {
          try {
            // 获取FeatureUsage记录
            const { FeatureUsage } = require('./models/FeatureUsage');
            const { saveTaskDetails } = require('./middleware/unifiedFeatureUsage');
            
            const usage = await FeatureUsage.findOne({
              where: {
                userId: taskInfo.userId,
                featureName: 'VIDEO_SUBTITLE_REMOVER'
              }
            });
            
            // 计算实际积分消耗
            let actualCreditCost = Math.ceil(taskInfo.videoDuration / 30) * 30;
            
            // 获取用户信息
            const User = require('./models/User');
            const user = await User.findByPk(taskInfo.userId);
            
            if (user) {
              // 检查是否为免费使用
              if (!taskInfo.isFree) {
                // 非免费使用，需要扣除积分
                user.credits = Math.max(0, user.credits - actualCreditCost);
                await user.save();
                console.log(`任务成功完成：用户ID ${taskInfo.userId} 使用视频去除字幕功能，扣除 ${actualCreditCost} 积分，剩余 ${user.credits} 积分`);
              } else {
                console.log(`任务成功完成：用户ID ${taskInfo.userId} 使用视频去除字幕功能，免费使用，无需扣除积分`);
              }
            }
            
            if (usage) {
              // 🔧 重要修复：任务完成时只更新任务状态，不重复添加任务记录
              try {
                const details = JSON.parse(usage.details || '{}');
                
                // 查找现有任务记录并更新状态
                if (details.tasks && Array.isArray(details.tasks)) {
                  const taskIndex = details.tasks.findIndex(t => t.taskId === jobId);
                  if (taskIndex !== -1) {
                    // 更新现有任务的状态和结果
                    details.tasks[taskIndex].status = 'completed';
                    details.tasks[taskIndex].completedAt = new Date().toISOString();
                    if (details.tasks[taskIndex].extraData) {
                      details.tasks[taskIndex].extraData.resultVideoUrl = videoUrl;
                    }
                    
                    // 保存更新后的详情
                    usage.details = JSON.stringify(details);
                    usage.lastUsedAt = new Date();
                    await usage.save();
                    
                    console.log(`✅ 已更新视频去字幕任务状态: ${jobId} -> completed`);
                  } else {
                    console.log(`⚠️ 未找到任务记录: ${jobId}`);
                  }
                } else {
                  console.log(`⚠️ 使用记录格式异常，无tasks数组: ${usage.id}`);
                }
              } catch (parseError) {
                console.error('解析使用记录详情失败:', parseError);
              }
              
              // 标记已扣费
              taskInfo.hasChargedCredits = true;
              console.log(`视频去除字幕任务完成，已更新使用情况: 任务ID=${jobId}, 用户ID=${taskInfo.userId}, 积分=${actualCreditCost}, 免费=${taskInfo.isFree}`);
              
              // 将任务保存到OSS（参照文生视频的实现）
              try {
                const taskForOSS = {
                  id: jobId,
                  taskId: jobId, // 添加taskId字段以支持去重逻辑
                  status: 'SUCCEEDED',
                  videoUrl: videoUrl,
                  originalVideoUrl: taskInfo.originalVideoUrl || null,
                  videoDuration: taskInfo.videoDuration,
                  creditCost: actualCreditCost,
                  createdAt: taskInfo.timestamp || new Date().toISOString(),
                  prompt: '视频去除字幕任务',
                  processType: '视频去除字幕',
                  hasChargedCredits: true,
                  isFree: taskInfo.isFree
                };
                
                await addVideoSubtitleTaskToOSS(taskInfo.userId, taskForOSS);
                console.log(`视频去除字幕任务已保存到OSS: ${jobId}`);
              } catch (ossError) {
                console.error('保存视频去除字幕任务到OSS失败:', ossError);
                // 不抛出错误，继续执行
              }
            } else {
              console.log(`未找到用户ID=${taskInfo.userId}的视频去除字幕功能使用记录，创建新记录`);
              
              // 创建新的FeatureUsage记录
              const newUsage = await FeatureUsage.create({
                userId: taskInfo.userId,
                featureName: 'VIDEO_SUBTITLE_REMOVER',
                usageCount: 1,
                lastUsedAt: new Date(),
                resetDate: new Date(),
                credits: taskInfo.isFree ? 0 : actualCreditCost,
                details: JSON.stringify({
                  tasks: [{
                    taskId: jobId,
                    timestamp: new Date().toISOString(),
                    creditCost: actualCreditCost,
                    isFree: taskInfo.isFree,
                    extraData: {
                      videoDuration: taskInfo.videoDuration,
                      videoUrl: videoUrl
                    }
                  }]
                })
              });
              
              console.log(`已创建新的视频去除字幕功能使用记录: ID=${newUsage.id}, 用户ID=${taskInfo.userId}, 使用次数=1`);
              
              // 标记已扣费
              taskInfo.hasChargedCredits = true;
              
              // 将任务保存到OSS（参照文生视频的实现）
              try {
                const taskForOSS = {
                  id: jobId,
                  taskId: jobId, // 添加taskId字段以支持去重逻辑
                  status: 'SUCCEEDED',
                  videoUrl: videoUrl,
                  originalVideoUrl: taskInfo.originalVideoUrl || null,
                  videoDuration: taskInfo.videoDuration,
                  creditCost: actualCreditCost,
                  createdAt: taskInfo.timestamp || new Date().toISOString(),
                  prompt: '视频去除字幕任务',
                  processType: '视频去除字幕',
                  hasChargedCredits: true,
                  isFree: taskInfo.isFree
                };
                
                await addVideoSubtitleTaskToOSS(taskInfo.userId, taskForOSS);
                console.log(`视频去除字幕任务已保存到OSS: ${jobId}`);
              } catch (ossError) {
                console.error('保存视频去除字幕任务到OSS失败:', ossError);
                // 不抛出错误，继续执行
              }
            }
          } catch (chargeError) {
            console.error('视频去除字幕任务完成后记录使用情况失败:', chargeError);
          }
        }
      }
      
      res.json(response);
    } catch (error) {
      console.error('阿里云SDK调用失败:', error);
      
      // 提取错误信息
      let errorMessage = error.message || '未知错误';
      let errorCode = 'API_ERROR';
      
      if (error.data) {
        errorMessage = error.data.Message || errorMessage;
        errorCode = error.data.Code || errorCode;
      }
      
      res.status(500).json({ 
        error: '查询任务状态失败', 
        details: errorMessage,
        code: errorCode
      });
    }
  } catch (error) {
    console.error('查询任务状态API错误:', error);
    res.status(500).json({ 
      error: '查询任务状态失败', 
      details: error.message 
    });
  }
});

// 获取视频去除字幕任务历史记录
app.get('/api/video-subtitle-remover/history', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const tasks = await loadVideoSubtitleTasksFromOSS(userId);
    
    // 按创建时间倒序排列
    const sortedTasks = tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 过滤24小时内的记录
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTasks = sortedTasks.filter(task => {
      const taskDate = new Date(task.createdAt);
      return taskDate >= twentyFourHoursAgo;
    });
    
    // 只返回最新的1条记录
    const limitedTasks = recentTasks.slice(0, 1);
    
    res.json({
      success: true,
      tasks: limitedTasks
    });
  } catch (error) {
    console.error('获取视频去除字幕历史记录失败:', error);
    res.status(500).json({
      success: false,
      error: '获取历史记录失败'
    });
  }
});

// 查询视频去字幕任务状态 - 专用端点
app.get('/api/video-subtitle-removal/status/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    
    console.log(`查询视频去字幕任务状态: taskId=${taskId}, userId=${userId}`);
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：taskId'
      });
    }

    // 从数据库中查找视频去字幕任务
    const { FeatureUsage } = require('./models/FeatureUsage');
    
    const videoSubtitleUsages = await FeatureUsage.findAll({
      attributes: ['id', 'userId', 'featureName', 'usageCount', 'lastUsedAt', 'resetDate', 'credits', 'details', 'createdAt', 'updatedAt'],
      where: {
        userId: userId,
        featureName: ['VIDEO_SUBTITLE_REMOVAL', 'VIDEO_SUBTITLE_REMOVER']
      },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    
    console.log(`查询到 ${videoSubtitleUsages.length} 条视频去字幕记录`);
    
    let aliCloudRequestId = null;
    let foundTask = null;
    
    // 在任务详情中查找匹配的taskId - 修复查询逻辑
    for (const usage of videoSubtitleUsages) {
      if (usage.details) {
        try {
          const taskDetails = JSON.parse(usage.details);
          
          // 新格式: 数组格式 - {tasks: [{taskId: xxx, aliCloudRequestId: xxx}]}
          if (taskDetails.tasks && Array.isArray(taskDetails.tasks)) {
            const task = taskDetails.tasks.find(t => t.taskId === taskId);
            if (task) {
              aliCloudRequestId = task.aliCloudRequestId;
              foundTask = task;
              console.log(`找到视频去字幕任务: taskId=${taskId}, aliCloudRequestId=${aliCloudRequestId}`);
              break;
            }
          }
        } catch (parseError) {
          console.error('解析任务详情失败:', parseError);
        }
      }
    }
    
    // 如果数据库中没有找到任务，尝试从OSS查找
    if (!foundTask || !aliCloudRequestId) {
      try {
        console.log(`数据库中未找到完整任务信息，尝试从OSS查找: ${taskId}`);
        const ossTasks = await loadVideoSubtitleTasksFromOSS(userId);
        const ossTask = ossTasks.find(t => t.id === taskId);
        if (ossTask) {
          foundTask = ossTask;
          // 如果OSS中有aliCloudRequestId，使用它；否则使用taskId
          aliCloudRequestId = ossTask.aliCloudRequestId || taskId;
          console.log(`从OSS找到任务: taskId=${taskId}, aliCloudRequestId=${aliCloudRequestId}`);
        }
      } catch (ossError) {
        console.error('从OSS查找任务失败:', ossError);
      }
    }
    
    // 最后的兜底方案：如果还是没找到aliCloudRequestId，直接使用taskId作为requestId
    if (foundTask && !aliCloudRequestId) {
      console.log(`使用taskId作为aliCloudRequestId进行查询: ${taskId}`);
      aliCloudRequestId = taskId;
    }
    
    if (!aliCloudRequestId) {
      return res.status(404).json({
        success: false,
        message: '任务不存在或不属于当前用户'
      });
    }

    // 查询阿里云视频增强API状态
    const { queryVideoEnhanceTaskStatus } = require('./services/videoEnhanceService');
    
    try {
      const result = await queryVideoEnhanceTaskStatus(aliCloudRequestId);
      console.log('阿里云视频增强API查询结果:', JSON.stringify(result, null, 2));
      
      // 处理查询结果
      if (result.success) {
        const status = result.data.Status;
        let taskStatus = 'processing';
        
        // 正确映射阿里云API状态
        if (status === 'PROCESS_SUCCESS' || status === 'SUCCEEDED' || status === 'Success') {
          taskStatus = 'completed';
        } else if (status === 'PROCESS_FAILED' || status === 'FAILED' || status === 'Failed') {
          taskStatus = 'failed';
        } else if (status === 'PROCESS_RUNNING' || status === 'RUNNING' || status === 'Processing') {
          taskStatus = 'processing';
        }
        
        const response = {
          success: true,
          data: {
            taskId: taskId,
            status: taskStatus,
            aliCloudStatus: status,
            message: result.data.Message || (taskStatus === 'completed' ? '任务处理完成' : '任务处理中'),
            progress: result.data.Progress || (taskStatus === 'completed' ? 100 : (taskStatus === 'processing' ? 50 : 0))
          }
        };
        
        // 如果任务完成，添加结果URL
        if ((status === 'PROCESS_SUCCESS' || status === 'SUCCEEDED' || status === 'Success') && result.data.VideoUrl) {
          response.data.resultUrl = result.data.VideoUrl;
          response.result = {
            videoUrl: result.data.VideoUrl
          };
          
          console.log(`✅ 视频去字幕任务完成: ${taskId}, 结果视频URL: ${result.data.VideoUrl}`);
          
          // 🔧 重要修复：更新数据库中的FeatureUsage记录
          try {
            const { FeatureUsage } = require('./models/FeatureUsage');
            const usage = await FeatureUsage.findOne({
              where: {
                userId: userId,
                featureName: 'VIDEO_SUBTITLE_REMOVER'
              }
            });
            
            if (usage && usage.details) {
              try {
                const details = JSON.parse(usage.details);
                
                // 查找现有任务记录并更新状态
                if (details.tasks && Array.isArray(details.tasks)) {
                  const taskIndex = details.tasks.findIndex(t => t.taskId === taskId);
                  if (taskIndex !== -1) {
                    // 更新现有任务的状态和结果
                    details.tasks[taskIndex].status = 'completed';
                    details.tasks[taskIndex].completedAt = new Date().toISOString();
                    if (details.tasks[taskIndex].extraData) {
                      details.tasks[taskIndex].extraData.resultVideoUrl = result.data.VideoUrl;
                    }
                    
                    // 保存更新后的详情
                    usage.details = JSON.stringify(details);
                    usage.lastUsedAt = new Date();
                    await usage.save();
                    
                    console.log(`✅ 已更新数据库中视频去字幕任务状态: ${taskId} -> completed`);
                  } else {
                    console.log(`⚠️ 数据库中未找到任务记录: ${taskId}`);
                  }
                } else {
                  console.log(`⚠️ 数据库使用记录格式异常，无tasks数组: ${usage.id}`);
                }
              } catch (parseError) {
                console.error('解析数据库使用记录详情失败:', parseError);
              }
            } else {
              console.log(`⚠️ 未找到用户${userId}的视频去字幕功能使用记录`);
            }
          } catch (dbError) {
            console.error('更新数据库FeatureUsage记录失败:', dbError);
            // 不影响主要响应，继续执行
          }
          
          // 重要修复：更新OSS中的任务记录为已完成状态
          try {
            const completedTask = {
              id: taskId,
              taskId: taskId,
              status: 'SUCCEEDED',
              videoUrl: result.data.VideoUrl,
              originalVideoUrl: foundTask?.originalVideoUrl || null,
              videoDuration: foundTask?.videoDuration || null,
              creditCost: foundTask?.creditCost || 0,
              createdAt: foundTask?.createdAt || new Date().toISOString(),
              completedAt: new Date().toISOString(),
              processType: '视频去除字幕',
              hasChargedCredits: true,
              isFree: foundTask?.isFree || false
            };
            
            await addVideoSubtitleTaskToOSS(userId, completedTask);
            console.log(`✅ 已更新OSS任务记录: ${taskId} -> SUCCEEDED`);
          } catch (ossError) {
            console.error('更新OSS任务记录失败:', ossError);
            // 不影响主要响应，继续执行
          }
          
        } else if (taskStatus === 'failed') {
          console.log(`❌ 视频去字幕任务失败: ${taskId}, 状态: ${status}`);
          response.data.error = result.data.Message || '任务处理失败';
          
          // 更新OSS中的任务记录为失败状态
          try {
            const failedTask = {
              id: taskId,
              taskId: taskId,
              status: 'FAILED',
              originalVideoUrl: foundTask?.originalVideoUrl || null,
              videoDuration: foundTask?.videoDuration || null,
              creditCost: foundTask?.creditCost || 0,
              createdAt: foundTask?.createdAt || new Date().toISOString(),
              failedAt: new Date().toISOString(),
              processType: '视频去除字幕',
              error: result.data.Message || '任务处理失败',
              isFree: foundTask?.isFree || false
            };
            
            await addVideoSubtitleTaskToOSS(userId, failedTask);
            console.log(`✅ 已更新OSS任务记录: ${taskId} -> FAILED`);
          } catch (ossError) {
            console.error('更新OSS失败任务记录失败:', ossError);
            // 不影响主要响应，继续执行
          }
        }
        
        return res.json(response);
      } else {
        console.error('查询视频去字幕任务状态失败:', result.message);
        return res.status(200).json({
          success: true,
          data: {
            taskId: taskId,
            status: 'processing',
            message: '任务状态查询中，请稍后重试',
            progress: 20
          }
        });
      }
      
    } catch (error) {
      console.error('查询视频去字幕任务状态异常:', error);
      return res.status(500).json({
        success: false,
        message: '查询任务状态失败: ' + error.message
      });
    }
    
  } catch (error) {
    console.error('查询视频去字幕任务状态失败:', error);
    res.status(500).json({
      success: false,
      message: '查询任务状态失败: ' + error.message
    });
  }
});

// 获取视频去字幕任务列表（从OSS存储）- 参照视频风格重绘实现
app.get('/api/video-subtitle-removal/tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`获取视频去字幕任务列表: userId=${userId}`);
    
    // 从OSS加载任务列表
    const tasks = await loadVideoSubtitleTasksFromOSS(userId);
    
    // 过滤24小时内的任务（参照视频风格重绘实现）
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentTasks = tasks.filter(task => {
      const taskTime = new Date(task.createdAt);
      return taskTime >= twentyFourHoursAgo;
    });
    
    // 按创建时间降序排序
    recentTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 去重：同一taskId只保留最新的记录（已完成状态的优先）
    const uniqueTasks = [];
    const seenTaskIds = new Set();
    
    for (const task of recentTasks) {
      // 修复：确保任务有正确的taskId字段（兼容id和taskId字段）
      const taskId = task.taskId || task.id;
      if (!task.taskId && task.id) {
        task.taskId = task.id; // 标准化taskId字段
      }
      
      if (!seenTaskIds.has(taskId)) {
        seenTaskIds.add(taskId);
        uniqueTasks.push(task);
      } else {
        // 如果已经有这个taskId，检查是否当前任务状态更好
        const existingIndex = uniqueTasks.findIndex(t => (t.taskId || t.id) === taskId);
        const existingTask = uniqueTasks[existingIndex];
        
        // 优先级：SUCCEEDED > FAILED > PROCESSING > PENDING
        const statusPriority = {
          'SUCCEEDED': 4,
          'PROCESS_SUCCESS': 4,
          'Success': 4,
          'FAILED': 3,
          'PROCESS_FAILED': 3,
          'Failed': 3,
          'PROCESSING': 2,
          'PROCESS_RUNNING': 2,
          'RUNNING': 2,
          'processing': 2,
          'PENDING': 1,
          'pending': 1
        };
        
        const currentPriority = statusPriority[task.status] || 0;
        const existingPriority = statusPriority[existingTask.status] || 0;
        
        // 如果当前任务的状态优先级更高，或者优先级相同但更新时间更晚，则替换
        if (currentPriority > existingPriority || 
            (currentPriority === existingPriority && new Date(task.createdAt) > new Date(existingTask.createdAt))) {
          uniqueTasks[existingIndex] = task;
          console.log(`去重替换: taskId=${taskId}, ${existingTask.status} -> ${task.status}`);
        }
      }
    }
    
    // 只返回最新的1条记录
    const limitedTasks = uniqueTasks.slice(0, 1);
    
    console.log(`从OSS找到 ${tasks.length} 个任务，24小时内 ${recentTasks.length} 个，去重后 ${uniqueTasks.length} 个，限制后 ${limitedTasks.length} 个`);
    
    // 添加详细的任务调试信息
    limitedTasks.forEach((task, index) => {
      const taskId = task.taskId || task.id;
      console.log(`任务 ${index + 1}: taskId=${taskId}, status=${task.status}, videoUrl=${task.videoUrl ? '✅存在' : '❌缺失'}`);
      if (task.videoUrl) {
        console.log(`  视频URL: ${task.videoUrl}`);
      }
    });
    
    res.json({
      success: true,
      data: limitedTasks
    });
    
  } catch (error) {
    console.error('获取视频去字幕任务列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取任务列表失败',
      error: error.message
    });
  }
});

// 获取视频去除字幕任务历史记录 - 保持兼容性（旧接口）
app.get('/api/video-subtitle-removal/history', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const tasks = await loadVideoSubtitleTasksFromOSS(userId);
    
    // 按创建时间倒序排列
    const sortedTasks = tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 过滤24小时内的记录（修复时间字段兼容性问题）
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTasks = sortedTasks.filter(task => {
      // 兼容不同的时间字段并添加有效性检查
      const createdAtValue = task.createdAt || task.timestamp || task.created_at;
      if (!createdAtValue) {
        console.log(`历史记录任务 ${task.taskId || task.id} 缺少时间字段，跳过时间过滤`);
        return true; // 如果没有时间字段，则包含在结果中
      }
      
      const taskDate = new Date(createdAtValue);
      const isValidDate = !isNaN(taskDate.getTime());
      
      if (!isValidDate) {
        console.log(`历史记录任务 ${task.taskId || task.id} 时间字段无效 (${createdAtValue})，跳过时间过滤`);
        return true; // 如果时间无效，则包含在结果中
      }
      
      return taskDate >= twentyFourHoursAgo;
    });
    
    // 只返回最新的1条记录
    const limitedTasks = recentTasks.slice(0, 1);
    
    res.json({
      success: true,
      tasks: limitedTasks
    });
  } catch (error) {
    console.error('获取视频去除字幕历史记录失败:', error);
    res.status(500).json({
      success: false,
      error: '获取历史记录失败'
    });
  }
});

// 清空所有视频去除字幕任务记录
app.post('/api/video-subtitle-removal/clear-all-tasks', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`[视频去字幕] 用户 ${userId} 请求清空所有任务记录`);
    
    // 清空用户的视频去字幕任务记录
    await clearVideoSubtitleTasksFromOSS(userId);
    
    console.log(`[视频去字幕] 用户 ${userId} 的所有任务记录已清空`);
    
    res.json({
      success: true,
      message: '所有任务记录已清空'
    });
    
  } catch (error) {
    console.error('清空视频去除字幕任务记录失败:', error);
    res.status(500).json({
      success: false,
      error: '清空任务记录失败'
    });
  }
});

// 视频风格重绘API - 创建任务
app.post('/api/video-style-repaint/create-task', protect, async (req, res) => {
  try {
    const { videoUrl, prompt, style, videoDuration } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({
        code: "InvalidParameter",
        message: "缺少必要参数: videoUrl",
        request_id: `req_${Date.now()}`
      });
    }
    
    // 使用featureAccess中间件进行积分检查和扣除
    const featureAccessMiddleware = createUnifiedFeatureMiddleware('VIDEO_STYLE_REPAINT');
    
    // 定义变量存储免费使用信息
    let isFree = false;
    
    try {
      // 使用自定义中间件执行功能访问检查
      await new Promise((resolve, reject) => {
        featureAccessMiddleware(req, res, (err) => {
          if (err) {
            console.error('功能访问检查失败:', err);
            reject(err);
            return;
          }
          // 保存免费使用信息
          isFree = req.featureUsage?.usageType === 'free';
          console.log(`视频风格重绘功能免费使用检查结果: ${isFree ? '免费使用' : '付费使用'}`);
          resolve();
        });
      });
    } catch (featureAccessError) {
      console.error('功能访问权限检查异常:', featureAccessError);
      return res.status(500).json({
        success: false,
        message: '功能访问检查失败：' + (featureAccessError.message || '未知错误')
      });
    }
    
    // 如果res.headersSent为true，说明featureAccess中间件已经发送了响应
    if (res.headersSent) {
      console.log('featureAccess中间件已经处理了响应，不再继续处理');
      return;
    }
    
    // 获取风格值
    const styleValue = parseInt(style) || 0;
    // 获取分辨率参数，默认540
    const minLen = parseInt(req.body.min_len) || 540;
    
    console.log(`创建视频风格重绘任务: 风格: ${styleValue}, 分辨率min_len: ${minLen}, 原始视频时长: ${videoDuration}秒`);
    
    // 根据视频时长动态调整参数
    let videoFps = 25; // 默认25fps，符合阿里云API的有效范围[15,25]
    let animateEmotion = true; // 默认开启表情驱动
    
    // 长视频优化策略
    if (videoDuration && videoDuration > 8) {
      // 长视频（>8秒）使用更保守的设置以保持时长
      videoFps = 24; // 降低帧率，减少处理复杂度
      animateEmotion = false; // 关闭表情驱动，减少处理时间
      console.log(`📹 长视频优化: 检测到${videoDuration}秒长视频，调整参数为24fps，关闭表情驱动`);
    } else if (videoDuration && videoDuration > 5) {
      // 中等长度视频（5-8秒）使用平衡设置
      videoFps = 25; // 中等帧率
      animateEmotion = true; // 保持表情驱动
      console.log(`📹 中等视频优化: 检测到${videoDuration}秒视频，调整参数为25fps，保持表情驱动`);
    } else {
      // 短视频（≤5秒）使用高质量设置
      videoFps = 25; // 高帧率，不超过阿里云API的最大值25
      animateEmotion = true; // 开启表情驱动
      console.log(`📹 短视频优化: 检测到${videoDuration}秒视频，使用25fps高质量设置`);
    }
    
    // 构建请求数据
    const requestData = {
      "model": "video-style-transform",
      "input": {
        "video_url": videoUrl
      },
      "parameters": {
        "style": styleValue,
        "video_fps": videoFps, // 动态调整的帧率
        "animate_emotion": animateEmotion, // 动态调整的表情驱动
        "min_len": minLen
      }
    };
    
    console.log('发送到阿里云的数据:', JSON.stringify(requestData, null, 2));
    
    // 创建任务
    try {
      // 准备请求头
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'X-DashScope-Async': 'enable' // 启用异步模式
      };
      
      // 发送创建任务请求
      const response = await axios.post(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis', 
        requestData, 
        { headers }
      );
      
        console.log('阿里云API响应:', response.status, JSON.stringify(response.data, null, 2));
        
        // 使用前端传递的准确视频时长，不再依赖文件大小估算
        let actualVideoDuration = 0;
        if (videoDuration && typeof videoDuration === 'number' && videoDuration > 0) {
          actualVideoDuration = videoDuration;
          console.log(`使用前端传递的准确视频时长: ${actualVideoDuration}秒`);
          console.log(`📹 时长保持优化: 已根据视频长度动态调整参数`);
          console.log(`   - 帧率: ${videoFps}fps`);
          console.log(`   - 表情驱动: ${animateEmotion ? '开启' : '关闭'}`);
          console.log(`⚠️ 注意: 阿里云API返回的usage.duration是计费时长，可能与实际视频时长不同`);
          console.log(`⚠️ 长视频处理: 阿里云AI会进行内容优化，可能去除无效帧，导致时长缩短`);
        } else {
          console.warn('前端未传递视频时长或时长无效，保持为0并依赖后端计算');
          actualVideoDuration = 0; // 不再设置默认3秒
        }
        
        // 记录功能使用情况
      try {
        const userId = req.user.id;
        const taskId = response.data.output?.task_id || '';
        
        // 先查找是否已存在相同用户和功能名称的记录
        const existingRecord = await FeatureUsage.findOne({
          where: {
            userId: userId,
            featureName: 'VIDEO_STYLE_REPAINT'
          }
        });
        
        if (existingRecord) {
          // 如果已存在记录，则更新它
          console.log(`找到现有记录ID=${existingRecord.id}，更新任务信息`);
          
          try {
            const details = JSON.parse(existingRecord.details || '{}');
            // 更新或添加新任务信息
            const tasks = details.tasks || [];
            tasks.push({
              taskId: taskId,
              style: styleValue,
              min_len: minLen,
               resolution: minLen,
               timestamp: new Date(),
               isFree: isFree,
               videoDuration: actualVideoDuration, // 保存视频时长
               operationText: `处理${Math.ceil(actualVideoDuration)}秒视频` // 保存操作描述
             });
            
            // 更新整个details字段
            existingRecord.details = JSON.stringify({
              ...details,
              taskId: taskId, // 更新最新的任务ID
              style: styleValue,
              min_len: minLen,
              resolution: minLen,
               creditUpdated: false,
               isFree: isFree,
               videoDuration: actualVideoDuration, // 保存视频时长
               operationText: `处理${Math.ceil(actualVideoDuration)}秒视频`, // 保存操作描述
               tasks: tasks
             });
            
            await existingRecord.save();
            console.log(`更新视频风格重绘任务记录成功: 用户ID=${userId}, 任务ID=${taskId}, 是否免费=${isFree}`);
          } catch (updateError) {
            console.error('更新视频风格重绘任务记录失败:', updateError);
          }
        } else {
          // 如果不存在，则创建新记录
          await FeatureUsage.create({
            userId,
            featureName: 'VIDEO_STYLE_REPAINT',
            usageCount: 1, // 设置初始使用次数
            lastUsedAt: new Date(),
            resetDate: new Date().toISOString().split('T')[0],
            credits: 0, // 暂不扣除积分，任务完成后再扣
            details: JSON.stringify({
              taskId: taskId,
              style: styleValue,
              min_len: minLen, // 保存分辨率参数，用于后续计算
              resolution: minLen, // 同时使用统一的字段名保存分辨率
               creditUpdated: false, // 标记尚未更新积分
               isFree: isFree, // 添加免费使用标记
               videoDuration: actualVideoDuration, // 保存视频时长
               operationText: `处理${Math.ceil(actualVideoDuration)}秒视频`, // 保存操作描述
               tasks: [{
                 taskId: taskId,
                 style: styleValue,
                 min_len: minLen,
                 resolution: minLen,
                 timestamp: new Date(),
                 isFree: isFree,
                 videoDuration: actualVideoDuration, // 保存视频时长
                 operationText: `处理${Math.ceil(actualVideoDuration)}秒视频` // 保存操作描述
               }]
            })
          });
          console.log(`新建视频风格重绘任务记录: 用户ID=${userId}, 任务ID=${taskId}, 是否免费=${isFree}`);
        }
      } catch (recordError) {
        console.error('记录功能使用失败:', recordError);
        // 不中断流程，继续返回任务创建结果
      }
      
      // 创建任务对象用于OSS存储
      const taskForOSS = {
        taskId: response.data.output?.task_id || '',
        status: 'PENDING',
        prompt: prompt || '',
        style: styleValue,
        videoUrl: '',
        originalVideoUrl: videoUrl,
        quality: `${minLen}P`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isFree: isFree,
        videoDuration: actualVideoDuration // 保存准确的视频时长
      };
      
      // 保存任务到OSS存储
      try {
        console.log(`开始保存视频风格重绘任务到OSS: 用户=${req.user.id}, 任务=${taskForOSS.taskId}`);
        await addVideoStyleRepaintTaskToOSS(req.user.id, taskForOSS);
        console.log(`✅ 视频风格重绘任务ID=${taskForOSS.taskId}已成功保存到OSS存储`);
      } catch (ossError) {
        console.error('❌ 保存任务到OSS失败:', ossError);
        console.error('OSS保存失败详情:', {
          userId: req.user.id,
          taskId: taskForOSS.taskId,
          error: ossError.message,
          stack: ossError.stack
        });
        
        // 标记任务创建时OSS保存失败，以便后续补救
        try {
          const existingRecord = await FeatureUsage.findOne({
            where: {
              userId: req.user.id,
              featureName: 'VIDEO_STYLE_REPAINT'
            }
          });
          
          if (existingRecord) {
            const details = JSON.parse(existingRecord.details || '{}');
            details.ossFailedOnCreate = true; // 标记OSS保存失败
            existingRecord.details = JSON.stringify(details);
            await existingRecord.save();
            console.log(`已标记任务 ${taskForOSS.taskId} OSS保存失败，将在状态查询时补救`);
          }
        } catch (markError) {
          console.error('标记OSS保存失败状态失败:', markError);
        }
        
        // 继续处理，不影响主要功能，但这可能导致后续历史记录不显示
      }
      
      // 确保返回有效的JSON格式
      res.status(response.status || 200).json(response.data);
    } catch (error) {
      console.error('API调用失败:', error);
      
      if (error.response) {
        console.error('API错误响应:', error.response.status);
        
        try {
          console.error('错误详情:', JSON.stringify(error.response.data, null, 2));
          
          // 返回阿里云原始错误响应
          return res.status(error.response.status).json({
            code: error.response.data.code || "ApiCallError",
            message: error.response.data.message || '调用阿里云API失败',
            request_id: error.response.data.request_id || `req_${Date.now()}`
          });
        } catch (jsonError) {
          console.error('解析错误响应失败:', jsonError);
          return res.status(500).json({
            code: "InternalServerError",
            message: '处理API响应失败，请稍后再试',
            request_id: `req_${Date.now()}`
          });
        }
      }
      
      return res.status(500).json({
        code: "InternalServerError",
        message: '创建视频风格重绘任务失败: ' + error.message,
        request_id: `req_${Date.now()}`
      });
    }
  } catch (error) {
    console.error('视频风格重绘API错误:', error);
    res.status(500).json({ 
      code: "InternalServerError",
      message: '服务器错误: ' + error.message,
      request_id: `req_${Date.now()}`
    });
  }
});

// 视频风格重绘API - 查询任务状态
app.get('/api/video-style-repaint/task-status', protect, async (req, res) => {
  try {
    const { taskId } = req.query;
    
    if (!taskId || !/^[0-9a-f-]+$/i.test(taskId)) {
      return res.status(400).json({
        code: "InvalidParameter",
        message: '无效的任务ID',
        request_id: `req_${Date.now()}`
      });
    }
    
    console.log(`查询视频风格重绘任务状态: ${taskId}`);
    
    // 准备请求头
    const headers = {
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`
    };
    
    // 构建请求URL
    const url = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
    
    try {
      // 发送查询任务状态请求
      const response = await axios.get(url, { headers, timeout: 30000 }); // 增加超时设置
      
      console.log(`任务状态查询响应: ${response.status}, 任务状态: ${response.data.output?.task_status || '未知'}`);
      
      // 直接返回阿里云API的原始响应，仅确保请求成功
      if (response.status === 200) {
        // 记录更详细的响应信息，帮助调试
        console.log('详细响应数据:', JSON.stringify(response.data, null, 2));
        
        // 如果任务完成，处理视频时长和积分扣除
        if (response.data.output?.task_status === 'SUCCEEDED') {
          try {
            console.log('======= 开始处理视频风格重绘积分扣除 =======');
            
            // 先打印完整的API响应，便于调试
            console.log('完整API响应结构:', JSON.stringify(response.data));
            
            // 获取视频时长和分辨率
            let duration = 0;
            let resolution = 540; // 默认值
            
            // 直接访问顶层的usage对象
            if (response.data && response.data.usage) {
              duration = response.data.usage.duration || 0;
              resolution = response.data.usage.SR || 540;
              console.log(`直接从response.data.usage获取 - 时长: ${duration}秒, 分辨率: ${resolution}P`);
            
              // 保存任务信息到全局变量，用于积分统计
              try {
                if (!global.videoStyleRepaintTasks) {
                  global.videoStyleRepaintTasks = {};
                }
                
                // 查找创建任务时的记录，获取isFree标记
                const taskRecords = await FeatureUsage.findAll({
                  where: {
                    userId: req.user.id,
                    featureName: 'VIDEO_STYLE_REPAINT'
                  }
                });
                
                // 查找包含当前taskId的记录以获取isFree信息和更新操作描述
                let taskRecordIsFree = false;
                let targetRecord = null;
                for (const record of taskRecords) {
                  try {
                    const details = JSON.parse(record.details || '{}');
                    // 检查新格式中的任务列表
                    if (details.tasks && Array.isArray(details.tasks)) {
                      const task = details.tasks.find(t => t.taskId === taskId);
                      if (task) {
                        taskRecordIsFree = task.isFree || false;
                        targetRecord = record;
                        console.log(`找到任务记录，isFree=${taskRecordIsFree}`);
                        break;
                      }
                    }
                  } catch (parseError) {
                    console.error('解析任务记录详情失败:', parseError);
                  }
                }
                
                // 使用找到的isFree值
                isFree = taskRecordIsFree;
                
                // 更新使用记录中的操作描述，使用原始上传视频的时长
                if (targetRecord) {
                  try {
                    const details = JSON.parse(targetRecord.details || '{}');
                    
                    // 🔧 重要修复：优先使用创建任务时保存的原始视频时长（来自前端video元素的metadata）
                    // 这个时长是用户上传视频的真实时长，应该在使用记录中显示
                    // API返回的duration是处理后的时长，可能因AI优化而与原始时长不同
                    let originalVideoDuration = null;
                    if (details.tasks && Array.isArray(details.tasks)) {
                      const targetTask = details.tasks.find(task => task.taskId === taskId);
                      if (targetTask && targetTask.videoDuration) {
                        originalVideoDuration = targetTask.videoDuration;
                        console.log(`找到任务 ${taskId} 的原始上传视频时长: ${originalVideoDuration}秒`);
                      }
                    }
                    
                    // 🔧 核心修复：优先使用原始视频时长，只有在没有原始时长时才使用API返回的时长
                    // 这样使用记录中显示的时长与用户上传的视频时长一致
                    const displayDuration = originalVideoDuration || duration || 3;
                    const updatedOperationText = `处理${Math.ceil(displayDuration)}秒视频`;
                    
                    console.log(`🔧 时长选择逻辑: 原始上传视频时长=${originalVideoDuration}秒, API处理后时长=${duration}秒, 最终显示=${displayDuration}秒`);
                    console.log(`✅ 使用记录将显示原始上传视频时长: ${displayDuration}秒`);
                    
                    // 更新details中的操作描述
                    details.operationText = updatedOperationText;
                    details.originalVideoDuration = originalVideoDuration; // 保存原始视频时长（前端传递）
                    details.apiProcessedDuration = duration; // 保存API处理后的时长（用于计费）
                    
                    // 重要：更新tasks数组中对应任务的operationText和时长信息
                    if (details.tasks && Array.isArray(details.tasks)) {
                      details.tasks.forEach(task => {
                        if (task.taskId === taskId) {
                          task.operationText = updatedOperationText;
                          task.originalVideoDuration = originalVideoDuration; // 保存原始时长
                          task.apiProcessedDuration = duration; // API处理后的时长
                          task.actualDuration = originalVideoDuration || duration; // 优先使用原始时长
                          task.completed = true; // 标记任务完成
                          console.log(`✅ 已更新任务 ${taskId} 的操作描述: ${updatedOperationText} (原始时长: ${originalVideoDuration}秒, API处理时长: ${duration}秒)`);
                        }
                      });
                    }
                    
                    // 保存更新后的记录
                    targetRecord.details = JSON.stringify(details);
                    await targetRecord.save();
                    
                    console.log(`✅ 已更新使用记录的操作描述为原始视频时长: ${updatedOperationText} (API处理时长: ${duration}秒仅用于计费)`);
                  } catch (updateError) {
                    console.error('更新使用记录操作描述失败:', updateError);
                  }
                }
                
                // 🔧 修复：计算积分成本时使用原始上传视频时长
                // 优先使用原始时长，如果没有则使用API返回的时长
                const billingDurationForGlobal = originalVideoDuration || duration;
                const calculatedCreditCost = billingDurationForGlobal * (resolution <= 540 ? 3 : 6);
                
                // 记录用户的任务信息
                global.videoStyleRepaintTasks[taskId] = {
                  userId: req.user.id,
                  creditCost: isFree ? 0 : calculatedCreditCost, // 免费使用积分为0
                  hasChargedCredits: !isFree, // 免费使用不需要扣除积分
                  timestamp: new Date(),
                  videoDuration: billingDurationForGlobal, // 🔧 使用原始时长
                  originalVideoDuration: originalVideoDuration, // 保存原始时长
                  apiProcessedDuration: duration, // 保存API处理后的时长
                  resolution: resolution,
                  isFree: isFree // 添加免费使用标记
                };
                
                console.log(`视频风格重绘任务信息已保存: 用户ID=${req.user.id}, 任务ID=${taskId}, 原始时长=${originalVideoDuration}秒, API时长=${duration}秒, 计费时长=${billingDurationForGlobal}秒, 分辨率=${resolution}P, 积分=${isFree ? 0 : calculatedCreditCost}, 是否免费=${isFree}`);
              } catch (error) {
                console.error('保存视频风格重绘任务信息到全局变量失败:', error);
              }
            } else {
              console.error('未在API响应中找到usage字段，使用默认值');
            }
            
            try {
              // 确保分辨率是数字
              resolution = parseInt(resolution);
              console.log(`最终确定的值 - 时长: ${duration}秒, 分辨率: ${resolution}P`);
              
              // 记录key用于任务标识
              let taskKey = `task:${taskId}`;
              
              // 获取任务ID的创建记录，检查是否已扣费
              const taskRecords = await FeatureUsage.findAll({
                where: {
                  userId: req.user.id,
                  featureName: 'VIDEO_STYLE_REPAINT'
                }
              });
              
              console.log(`查询到用户的风格重绘记录数量: ${taskRecords.length}`);
              
              // 查找包含当前taskId的记录
              let taskRecord = null;
              let isFree = false; // 默认非免费
              
              for (const record of taskRecords) {
                try {
                  const details = JSON.parse(record.details || '{}');
                  console.log(`检查记录ID=${record.id}, 详情:`, details);
                  
                  // 检查记录中的任务列表
                  if (details.tasks && Array.isArray(details.tasks)) {
                    for (const task of details.tasks) {
                      if (task.taskId === taskId) {
                        taskRecord = record;
                        // 🔧 修复：直接使用已保存的isFree状态，这是任务创建时正确计算的结果
                        isFree = task.isFree || false;
                        console.log(`在任务列表中找到匹配的任务: ID=${taskId}, 原保存状态=${task.isFree || false}, 使用该状态=${isFree}`);
                        break;
                      }
                    }
                  }
                  
                  
                  if (taskRecord) break;
                  
                } catch (e) {
                  console.error('解析任务详情出错:', e);
                  continue;
                }
              }
              
              // 🔧 重要修复：不再重新计算免费状态，直接使用创建任务时保存的isFree值
              // 这个值已经在创建任务时通过正确的逻辑计算过了，不应该在这里重新计算
              console.log(`使用创建任务时保存的免费状态: isFree=${isFree}`);
              
              // 如果从任务记录中没有找到isFree值，则从全局变量中获取
              if (typeof isFree === 'undefined' && global.videoStyleRepaintTasks && global.videoStyleRepaintTasks[taskId]) {
                isFree = global.videoStyleRepaintTasks[taskId].isFree || false;
                console.log(`从全局变量获取免费状态: isFree=${isFree}`);
              }
              
              // 检查是否已经扣过积分
              let alreadyCharged = false;
              if (global.chargedTasks && global.chargedTasks[taskKey]) {
                alreadyCharged = true;
                console.log(`该任务已经扣除过积分(全局标记): ${taskKey}`);
              }
              
              // 如果找到记录，验证是否已更新积分
              if (taskRecord) {
                // 获取任务详情
                const taskDetails = JSON.parse(taskRecord.details || '{}');
                console.log(`任务详情:`, taskDetails);
                
                if (taskDetails.creditUpdated) {
                  alreadyCharged = true;
                  console.log(`该任务已经扣除过积分(数据库记录): ${taskId}`);
                }
              }
              
              // 如果尚未扣费，进行扣费操作
              if (!alreadyCharged) {
                console.log(`该任务尚未扣除积分, 开始计算...`);
                
                // 🔧 重要修复：获取原始上传视频时长用于计费
                // 从任务记录中获取原始视频时长（用户上传的真实时长）
                let billingDuration = duration; // 默认使用API返回的时长
                let originalVideoDuration = null;
                
                if (taskRecord && taskRecord.details) {
                  try {
                    const details = JSON.parse(taskRecord.details || '{}');
                    if (details.tasks && Array.isArray(details.tasks)) {
                      const targetTask = details.tasks.find(task => task.taskId === taskId);
                      if (targetTask && targetTask.videoDuration) {
                        originalVideoDuration = targetTask.videoDuration;
                        billingDuration = originalVideoDuration; // 使用原始时长计费
                        console.log(`✅ 找到原始上传视频时长: ${originalVideoDuration}秒，将使用此时长计费`);
                      }
                    }
                  } catch (e) {
                    console.error('获取原始视频时长失败，将使用API返回的时长:', e);
                  }
                }
                
                // 计算积分消耗
                // 这里我们直接使用上面已经获取并解析过的resolution变量
                // 不需要再重复解析
                // 计算费率：540P及以下是3积分/秒，超过540P是6积分/秒
                const rate = resolution <= 540 ? 3 : 6;
                const creditCost = Math.ceil(billingDuration) * rate;
                
                console.log(`视频风格重绘计费: 原始上传时长=${originalVideoDuration}秒, API处理时长=${duration}秒, 用于计费=${billingDuration}秒, 分辨率=${resolution}P, 费率=${rate}积分/秒, 消耗=${creditCost}积分`);
                console.log(`🔧 计费依据改进: 使用原始上传视频时长(${billingDuration}秒)而非API处理后时长(${duration}秒)进行计费`);
                
                // 确保在任务详情中也保存正确的分辨率
                if (taskRecord && taskRecord.details) {
                  try {
                    const details = JSON.parse(taskRecord.details || '{}');
                    // 更新为API返回的实际分辨率
                    details.actual_resolution = resolution;
                    taskRecord.details = JSON.stringify(details);
                    // 不用await，让它在后台更新，不阻塞主流程
                    taskRecord.save().catch(e => console.error('更新任务记录分辨率失败:', e));
                  } catch (e) {
                    console.error('更新任务记录分辨率时解析JSON失败:', e);
                  }
                }
                
                try {
                  // 更新用户积分
                  const user = await User.findByPk(req.user.id);
                  if (user) {
                    console.log(`当前用户积分: ${user.credits}`);
                    
                    // 如果是免费使用，则不扣除积分
                    let finalCost = isFree ? 0 : creditCost;
                    
                    // 只有在非免费使用时才扣除积分
                    if (!isFree) {
                      user.credits = user.credits - finalCost;
                      await user.save();
                      console.log(`扣除积分成功: ${finalCost}积分`);
                      
                      // 同时更新FeatureUsage表中的credits字段，记录实际积分消耗
                      if (taskRecord && typeof taskRecord.credits !== 'undefined') {
                        // 获取当前积分消费记录
                        const currentCredits = taskRecord.credits || 0;
                        // 更新总积分消费
                        taskRecord.credits = currentCredits + finalCost;
                        // 不使用await，让它在后台更新，不阻塞主流程
                        taskRecord.save().catch(e => console.error('更新任务记录积分消费失败:', e));
                        console.log(`更新FeatureUsage积分消费记录: ${currentCredits} + ${finalCost} = ${currentCredits + finalCost}积分`);
                      }
                    } else {
                      console.log(`免费使用，不扣除积分`);
                    }
                    
                    // 初始化全局已扣费任务记录
                    if (typeof global.chargedTasks === 'undefined') {
                      global.chargedTasks = {};
                    }
                    
                    // 标记该任务已扣费
                    global.chargedTasks[taskKey] = {
                      timestamp: new Date().getTime(),
                      userId: req.user.id,
                      cost: finalCost
                    };
                    
                    // 如果找到对应的记录，更新它
                    if (taskRecord) {
                      // 更新任务记录
                      const taskDetails = JSON.parse(taskRecord.details || '{}');
                      taskDetails.creditUpdated = true;
                      taskDetails.actualDuration = duration;
                      taskDetails.creditCost = finalCost || creditCost;
                      taskDetails.isFree = isFree; // 添加免费使用标记
                      
                      // 更新任务列表中的对应任务
                      if (taskDetails.tasks && Array.isArray(taskDetails.tasks)) {
                        const taskIndex = taskDetails.tasks.findIndex(task => task.taskId === taskId);
                        if (taskIndex !== -1) {
                          // 更新任务信息
                          taskDetails.tasks[taskIndex].creditCost = finalCost || creditCost;
                          taskDetails.tasks[taskIndex].isFree = isFree;
                          taskDetails.tasks[taskIndex].actualDuration = duration;
                          taskDetails.tasks[taskIndex].creditUpdated = true;
                          console.log(`更新任务列表中的任务记录: 任务ID=${taskId}, 积分=${finalCost || creditCost}, 是否免费=${isFree}`);
                        } else {
                          // 如果未找到，则添加到任务列表
                          taskDetails.tasks.push({
                            taskId: taskId,
                            creditCost: finalCost || creditCost,
                            isFree: isFree,
                            actualDuration: duration,
                            creditUpdated: true,
                            timestamp: new Date()
                          });
                          console.log(`添加新任务到任务列表: 任务ID=${taskId}, 积分=${finalCost || creditCost}, 是否免费=${isFree}`);
                        }
                      } else {
                        // 如果没有任务列表，则创建
                        taskDetails.tasks = [{
                          taskId: taskId,
                          creditCost: finalCost || creditCost,
                          isFree: isFree,
                          actualDuration: duration,
                          creditUpdated: true,
                          timestamp: new Date()
                        }];
                        console.log(`创建任务列表并添加任务: 任务ID=${taskId}, 积分=${finalCost || creditCost}, 是否免费=${isFree}`);
                      }
                      
                      taskRecord.details = JSON.stringify(taskDetails);
                      await taskRecord.save();
                    } else {
                      // 如果没有找到对应任务记录，查找用户的功能使用记录并更新
                      // 避免违反唯一约束
                      try {
                        // 先查找该用户的功能使用记录
                        const existingRecord = await FeatureUsage.findOne({
                          where: {
                            userId: req.user.id,
                            featureName: 'VIDEO_STYLE_REPAINT'
                          }
                        });
                        
                        if (existingRecord) {
                          // 更新现有记录
                          console.log(`找到用户的功能使用记录，ID=${existingRecord.id}，更新它`);
                          const existingDetails = JSON.parse(existingRecord.details || '{}');
                          existingDetails.taskId = taskId;
                          // 同时更新两种字段名，确保兼容性
                          existingDetails.min_len = resolution;
                          existingDetails.resolution = resolution; // 使用统一的字段名
                          existingDetails.actual_resolution = resolution; // 保存API返回的实际分辨率
                          existingDetails.actualDuration = duration;
                          existingDetails.creditCost = finalCost || creditCost;
                          existingDetails.creditUpdated = true;
                          existingDetails.isFree = isFree; // 添加免费使用标记
                          
                          // 更新任务列表
                          if (existingDetails.tasks && Array.isArray(existingDetails.tasks)) {
                            const taskIndex = existingDetails.tasks.findIndex(task => task.taskId === taskId);
                            if (taskIndex !== -1) {
                              // 更新任务信息
                              existingDetails.tasks[taskIndex].creditCost = finalCost || creditCost;
                              existingDetails.tasks[taskIndex].isFree = isFree;
                              existingDetails.tasks[taskIndex].actualDuration = duration;
                              existingDetails.tasks[taskIndex].resolution = resolution;
                              existingDetails.tasks[taskIndex].creditUpdated = true;
                              console.log(`更新现有记录的任务列表: 任务ID=${taskId}, 积分=${finalCost || creditCost}, 是否免费=${isFree}`);
                            } else {
                              // 如果未找到，则添加到任务列表
                              existingDetails.tasks.push({
                                taskId: taskId,
                                creditCost: finalCost || creditCost,
                                isFree: isFree,
                                actualDuration: duration,
                                resolution: resolution,
                                creditUpdated: true,
                                timestamp: new Date()
                              });
                              console.log(`添加新任务到现有记录的任务列表: 任务ID=${taskId}, 积分=${finalCost || creditCost}, 是否免费=${isFree}`);
                            }
                          } else {
                            // 如果没有任务列表，则创建
                            existingDetails.tasks = [{
                              taskId: taskId,
                              creditCost: finalCost || creditCost,
                              isFree: isFree,
                              actualDuration: duration,
                              resolution: resolution,
                              creditUpdated: true,
                              timestamp: new Date()
                            }];
                            console.log(`创建任务列表并添加到现有记录: 任务ID=${taskId}, 积分=${finalCost || creditCost}, 是否免费=${isFree}`);
                          }
                          
                          existingRecord.details = JSON.stringify(existingDetails);
                          
                          // 如果是付费使用，更新credits字段，记录积分消耗
                          if (!isFree && (finalCost > 0 || creditCost > 0)) {
                            const currentCredits = existingRecord.credits || 0;
                            existingRecord.credits = currentCredits + (finalCost || creditCost);
                            console.log(`更新FeatureUsage记录积分消费: ${currentCredits} + ${finalCost || creditCost} = ${currentCredits + (finalCost || creditCost)}积分`);
                          }
                          
                          await existingRecord.save();
                          console.log(`更新用户记录成功，ID=${existingRecord.id}`);
                        } else {
                          // 这种情况应该很少发生，因为前面已经查询过一次了
                          console.log(`未找到用户的功能使用记录，创建新记录（这是不常见的情况）`);
                          await FeatureUsage.create({
                            userId: req.user.id,
                            featureName: 'VIDEO_STYLE_REPAINT',
                            usageCount: 1, // 确保设置使用次数
                            lastUsedAt: new Date(),
                            resetDate: new Date().toISOString().split('T')[0],
                            credits: creditCost,
                            details: JSON.stringify({
                              taskId: taskId,
                              min_len: resolution,
                              resolution: resolution, // 使用统一的字段名
                              actual_resolution: resolution, // 保存API返回的实际分辨率
                              actualDuration: duration,
                              creditCost: finalCost || creditCost,
                              creditUpdated: true,
                              isFree: isFree, // 添加免费使用标记
                              tasks: [{
                                taskId: taskId,
                                creditCost: finalCost || creditCost,
                                isFree: isFree,
                                actualDuration: duration,
                                resolution: resolution,
                                creditUpdated: true,
                                timestamp: new Date()
                              }]
                            })
                          });
                        }
                      } catch (saveError) {
                        console.error('保存用户功能使用记录失败:', saveError);
                      }
                    }
                  }
                } catch (updateError) {
                  console.error('更新用户积分失败:', updateError);
                }
              }
            } catch (processError) {
              console.error('处理视频风格重绘任务完成后的积分计算失败:', processError);
            }
            
            console.log('视频风格重绘任务积分处理完成');
            
            // 更新OSS中的任务状态
            try {
              // 提取视频URL - 使用与前端一致的更全面的提取逻辑
              let videoUrl = '';
              
              // 尝试多个可能的URL字段（与前端逻辑保持一致）
              const possibleUrls = [
                response.data.output?.output_video_url,  // 阿里云API返回的标准字段
                response.data.output?.result_url,
                response.data.output?.result_video_url,
                response.data.output?.video_url,
                response.data.output?.output_url,
                response.data.output?.url,
                response.data.output?.result?.url,
                response.data.output?.result?.video_url,
                response.data.output?.video?.url,
                response.data.output?.output?.url,
                response.data.output?.output?.video_url,
                response.data.output?.video_urls?.[0],
                response.data.output?.result_urls?.[0],
                response.data.output?.output_urls?.[0],
                response.data.output?.urls?.[0],
                response.data.output?.video?.urls?.[0],
                response.data.output?.result?.urls?.[0],
                response.data.output?.output?.urls?.[0],
                response.data.output?.data?.video_url,
                response.data.output?.data?.result_url,
                response.data.output?.data?.url,
                response.data.output?.data?.video_urls?.[0],
                response.data.output?.data?.result_urls?.[0],
                response.data.output?.data?.urls?.[0]
              ];
              
              videoUrl = possibleUrls.find(url => url && url.trim()) || '';
              
              console.log(`提取到的视频URL: ${videoUrl}`);
              console.log(`完整的API响应output:`, JSON.stringify(response.data.output, null, 2));
              
              // 从数据库获取原始任务信息，为OSS创建提供更完整的数据
              let originalTaskInfo = {};
              try {
                const featureUsage = await FeatureUsage.findOne({
                  where: {
                    userId: req.user.id,
                    featureName: 'VIDEO_STYLE_REPAINT'
                  }
                });
                
                if (featureUsage && featureUsage.details) {
                  const details = JSON.parse(featureUsage.details);
                  // 检查新格式中的任务列表
                  if (details.tasks && Array.isArray(details.tasks)) {
                    const task = details.tasks.find(t => t.taskId === taskId);
                    if (task) {
                      originalTaskInfo = {
                        prompt: task.extraData?.prompt || '',
                        style: task.extraData?.style || 0,
                        quality: `${task.extraData?.min_len || task.extraData?.resolution || 540}P`,
                        originalVideoUrl: task.extraData?.originalVideoUrl || '',
                        isFree: task.isFree || false
                      };
                    }
                  }
                    console.log(`从数据库获取原始任务信息:`, originalTaskInfo);
                    
                    // 检查是否有OSS创建失败的标记，如果有则先创建基础任务记录
                    if (details.ossFailedOnCreate) {
                      console.log(`检测到任务 ${taskId} 创建时OSS保存失败，开始补救...`);
                      try {
                        const baseTask = {
                          taskId: taskId,
                          status: 'RUNNING', // 设置为运行中，因为能查询到状态说明任务已开始
                          prompt: details.prompt || '',
                          style: details.style || 0,
                          videoUrl: '',
                          originalVideoUrl: details.originalVideoUrl || '',
                          quality: `${details.min_len || details.resolution || 540}P`,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                          isFree: details.isFree || false
                        };
                        
                        await addVideoStyleRepaintTaskToOSS(req.user.id, baseTask);
                        console.log(`✅ 补救创建任务 ${taskId} 到OSS成功`);
                        
                        // 清除失败标记
                        details.ossFailedOnCreate = false;
                        featureUsage.details = JSON.stringify(details);
                        await featureUsage.save();
                      } catch (rescueError) {
                        console.error(`❌ 补救创建任务 ${taskId} 到OSS失败:`, rescueError);
                      }
                    }
                  }
              } catch (dbError) {
                console.error('从数据库获取任务信息失败:', dbError);
              }
              
              const taskUpdates = {
                status: 'SUCCEEDED',
                videoUrl: videoUrl,
                updatedAt: new Date().toISOString(),
                ...originalTaskInfo // 包含原始任务信息
              };
              
              await updateVideoStyleRepaintTaskInOSS(req.user.id, taskId, taskUpdates);
              console.log(`视频风格重绘任务OSS状态已更新: ${taskId} - URL: ${videoUrl}`);
            } catch (ossError) {
              console.error('更新视频风格重绘任务OSS状态失败:', ossError);
              // 不影响主要功能
            }
            
            // 不中断流程，继续返回任务状态
          } catch (taskError) {
            console.error('处理视频风格重绘任务出错:', taskError);
            // 不中断流程，继续返回任务状态
          }
        } else if (response.data.output?.task_status === 'FAILED') {
          // 处理失败的任务，也需要更新OSS状态
          try {
            // 从数据库获取原始任务信息
            let originalTaskInfo = {};
            try {
              const featureUsage = await FeatureUsage.findOne({
                where: {
                  userId: req.user.id,
                  featureName: 'VIDEO_STYLE_REPAINT'
                }
              });
              
              if (featureUsage && featureUsage.details) {
                const details = JSON.parse(featureUsage.details);
                // 检查新格式中的任务列表
                if (details.tasks && Array.isArray(details.tasks)) {
                  const task = details.tasks.find(t => t.taskId === taskId);
                  if (task) {
                    originalTaskInfo = {
                      style: task.extraData?.style || 0,
                      quality: `${task.extraData?.min_len || task.extraData?.resolution || 540}P`,
                      isFree: task.isFree || false
                    };
                  }
                }
                console.log(`失败任务从数据库获取原始信息:`, originalTaskInfo);
              }
            } catch (dbError) {
              console.error('获取失败任务原始信息失败:', dbError);
            }
            
            const taskUpdates = {
              status: 'FAILED',
              updatedAt: new Date().toISOString(),
              errorMessage: response.data.output?.message || '任务执行失败',
              ...originalTaskInfo // 包含原始任务信息
            };
            
            await updateVideoStyleRepaintTaskInOSS(req.user.id, taskId, taskUpdates);
            console.log(`视频风格重绘任务状态已更新为失败: ${taskId}`);
          } catch (ossError) {
            console.error('更新失败任务OSS状态失败:', ossError);
          }
        } else {
          console.log(`任务状态不是成功或失败, 当前状态: ${response.data.output?.task_status}`);
        }
        
        return res.status(200).json(response.data);
      }
      
      return res.status(response.status).json({
        status: 'FAILED',
        message: '查询任务状态失败',
        code: 'UnknownError',
        request_id: `req_${Date.now()}`
      });
    } catch (error) {
      // 处理API请求错误
      console.log('查询任务状态失败:', error);
      
      if (error.response) {
        return res.status(error.response.status || 500).json({
          status: 'FAILED',
          code: error.response.data.code || "InternalServerError",
          message: error.response.data.message || '查询任务状态失败',
          request_id: error.response.data.request_id || `req_${Date.now()}`
        });
      }
      
      return res.status(500).json({
        status: 'FAILED',
        code: "InternalServerError",
        message: '查询任务状态失败: ' + error.message,
        request_id: `req_${Date.now()}`
      });
    }
  } catch (error) {
    console.error('视频风格重绘任务状态查询出错:', error);
    res.status(500).json({ 
      code: "InternalServerError",
      message: '服务器错误: ' + error.message,
      request_id: `req_${Date.now()}`
    });
  }
});

// 视频上传API - 专用于视频风格重绘功能
app.post('/api/video-style-repaint/upload', protect, async (req, res) => {
  try {
    console.log('收到视频风格重绘上传请求');
    
    // 检查OSS配置
    console.log('OSS配置状态:', {
      region: process.env.OSS_REGION ? '已配置' : '未配置',
      bucket: process.env.OSS_BUCKET ? '已配置' : '未配置',
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID ? process.env.ALIYUN_ACCESS_KEY_ID.substring(0, 5) + '...' : '未配置',
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET ? '已配置(已隐藏)' : '未配置'
    });
    
    // 确保上传目录存在
    const uploadDir = path.join(__dirname, 'uploads', 'style-videos');
    if (!fs.existsSync(uploadDir)) {
      console.log(`创建上传目录: ${uploadDir}`);
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // 配置视频上传 - 磁盘存储
    const styleVideoStorage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, uploadDir);
      },
      filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'style-video-' + uniqueSuffix + ext);
      }
    });
    
    const styleVideoUpload = multer({
      storage: styleVideoStorage,
      limits: {
        fileSize: 100 * 1024 * 1024 // 100MB限制
      },
      fileFilter: function (req, file, cb) {
        // 检查是否是视频文件
        if (file.mimetype.startsWith('video/')) {
          cb(null, true);
        } else {
          cb(new Error('只允许上传视频文件'), false);
        }
      }
    });
    
    // 使用multer中间件处理上传
    styleVideoUpload.single('video')(req, res, async (err) => {
      if (err) {
        console.error('文件上传错误:', err);
        return res.status(400).json({ 
          success: false,
          message: err.message 
        });
      }
      
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          message: '未找到上传的视频文件' 
        });
      }
      
      try {
        // 获取上传的文件路径
        const filePath = req.file.path;
        
        // 检查视频文件大小
        const stats = fs.statSync(filePath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        if (fileSizeInMB > 100) {
          // 删除超大文件
          fs.unlinkSync(filePath);
          return res.status(400).json({
            success: false,
            message: '视频文件不能超过100MB'
          });
        }
        
        console.log(`上传视频文件: ${req.file.originalname}, 大小: ${fileSizeInMB.toFixed(2)}MB`);
        
        // 上传到OSS
        const ossFileName = `video-style-repaint/${Date.now()}-${uuidv4()}${path.extname(req.file.originalname)}`;
        
        console.log('准备上传到OSS, 文件名:', ossFileName);
        
        try {
          // 上传到OSS
          const fileContent = fs.readFileSync(filePath);
          const ossResult = await ossClient.put(ossFileName, fileContent);
          
          console.log('OSS上传结果:', {
            name: ossResult.name,
            url: ossResult.url,
            status: ossResult.res.status
          });
          
          // 删除临时文件
          fs.unlinkSync(filePath);
          
          // 构建OSS URL
          const videoUrl = `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION.startsWith('oss-') ? process.env.OSS_REGION : 'oss-' + process.env.OSS_REGION}.aliyuncs.com/${ossFileName}`;
          
          // 返回视频URL
          res.status(200).json({
            success: true,
            videoUrl: videoUrl
          });
        } catch (ossError) {
          console.error('OSS上传失败:', ossError);
          
          // 如果临时文件存在，删除它
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          
          // 返回错误响应
          return res.status(500).json({
            success: false,
            message: `上传到OSS失败: ${ossError.message || '未知错误'}`,
            code: ossError.code || 'UNKNOWN_ERROR'
          });
        }
      } catch (error) {
        console.error('视频上传失败:', error);
        
        // 如果文件存在但上传失败，清理临时文件
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkError) {
            console.error('删除临时文件失败:', unlinkError);
          }
        }
        
        res.status(500).json({
          success: false,
          message: `视频上传失败: ${error.message}`
        });
      }
    });
  } catch (error) {
    console.error('视频上传API错误:', error);
    res.status(500).json({ 
      success: false,
      message: '服务器错误: ' + error.message 
    });
  }
});

// 虚拟模特试穿功能 - 提前注册路由，确保在 404 处理器之前被匹配
app.post([
  '/api/virtual-model/usage-original',
  '/api/virtual-model/usage',
  '/api/virtual-modeL/usage',
  '/api/virtual-modeL/usage-original'
], protect, createUnifiedFeatureMiddleware('VIRTUAL_MODEL_VTON'), async (req, res) => {
  try {
    console.log('接收虚拟模特使用记录请求:', req.body);

    const userId = req.user.id;
    const { usageType, creditCost, isFree, remainingFreeUsage } = req.featureUsage;

    // 生成任务ID并保存任务详情
    try {
      const taskId = Date.now().toString();
      const { saveTaskDetails } = require('./middleware/unifiedFeatureUsage');
      await saveTaskDetails(req.featureUsage.usage, {
        taskId: taskId,
        creditCost: creditCost,
        isFree: isFree,
        extraData: {}
      });
      console.log(`虚拟模特试穿功能使用记录已保存: 用户ID=${userId}, 积分=${creditCost}, 是否免费=${isFree}`);
    } catch (e) {
      console.error('处理虚拟模特试穿功能使用记录失败:', e);
    }

    return res.json({
      success: true,
      message: '使用记录已保存',
      data: {
        featureName: 'VIRTUAL_MODEL_VTON',
        usageType,
        creditCost,
        remainingFreeUsage
      }
    });
  } catch (error) {
    console.error('记录虚拟模特使用情况失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误: ' + error.message
    });
  }
});

// ==================== 指令编辑历史记录OSS存储API ====================

/**
 * 保存指令编辑历史记录到OSS
 * POST /api/prompt-editor/history/save
 */
app.post('/api/prompt-editor/history/save', async (req, res) => {
  try {
    const { originalImage, resultImage, prompt, userId } = req.body;
    
    if (!originalImage || !resultImage || !userId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    // 生成历史记录ID
    const historyId = `prompt-editor-${userId}-${Date.now()}`;
    
    // 准备历史记录数据
    const historyData = {
      id: historyId,
      userId: userId,
      originalImage: originalImage,
      resultImage: resultImage,
      prompt: prompt || '',
      createdAt: new Date().toISOString()
    };
    
    // 上传历史记录到OSS
    const ossPath = `prompt-editor/history/${userId}/${historyId}.json`;
    const result = await ossClient.put(ossPath, Buffer.from(JSON.stringify(historyData, null, 2)));
    
    console.log('历史记录已保存到OSS:', result.url);
    
    res.json({
      success: true,
      message: '历史记录保存成功',
      historyId: historyId,
      ossUrl: result.url
    });
    
  } catch (error) {
    console.error('保存历史记录到OSS失败:', error);
    res.status(500).json({
      success: false,
      message: '保存历史记录失败: ' + error.message
    });
  }
});

/**
 * 获取用户的指令编辑历史记录
 * GET /api/prompt-editor/history/:userId
 */
app.get('/api/prompt-editor/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '缺少用户ID参数'
      });
    }
    
    // 列出用户的历史记录文件
    const prefix = `prompt-editor/history/${userId}/`;
    const listResult = await ossClient.list({
      prefix: prefix,
      'max-keys': 100 // 最多获取100个文件
    });
    
    if (!listResult.objects || listResult.objects.length === 0) {
      return res.json({
        success: true,
        history: []
      });
    }
    
    // 按修改时间排序，获取最新的记录
    const sortedObjects = listResult.objects
      .filter(obj => obj.name.endsWith('.json'))
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
      .slice(0, 3); // 只取最新的3条记录
    
    // 过滤24小时内的记录
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const validObjects = sortedObjects.filter(obj => {
      const fileDate = new Date(obj.lastModified);
      return fileDate > twentyFourHoursAgo;
    });
    
    // 读取历史记录内容
    const historyPromises = validObjects.map(async (obj) => {
      try {
        const getResult = await ossClient.get(obj.name);
        const historyData = JSON.parse(getResult.content.toString());
        return historyData;
      } catch (error) {
        console.error(`读取历史记录文件失败 ${obj.name}:`, error);
        return null;
      }
    });
    
    const history = (await Promise.all(historyPromises)).filter(item => item !== null);
    
    res.json({
      success: true,
      history: history
    });
    
  } catch (error) {
    console.error('获取历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取历史记录失败: ' + error.message
    });
  }
});

/**
 * 删除用户的所有历史记录
 * DELETE /api/prompt-editor/history/:userId
 */
app.delete('/api/prompt-editor/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '缺少用户ID参数'
      });
    }
    
    // 列出用户的所有历史记录文件
    const prefix = `prompt-editor/history/${userId}/`;
    const listResult = await ossClient.list({
      prefix: prefix,
      'max-keys': 1000
    });
    
    if (!listResult.objects || listResult.objects.length === 0) {
      return res.json({
        success: true,
        message: '没有找到历史记录'
      });
    }
    
    // 删除所有历史记录文件
    const deletePromises = listResult.objects.map(obj => 
      ossClient.delete(obj.name).catch(error => {
        console.error(`删除文件失败 ${obj.name}:`, error);
        return null;
      })
    );
    
    await Promise.all(deletePromises);
    
    console.log(`已删除用户 ${userId} 的所有历史记录`);
    
    res.json({
      success: true,
      message: '历史记录已清空'
    });
    
  } catch (error) {
    console.error('删除历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: '删除历史记录失败: ' + error.message
    });
  }
});

/**
 * 清理过期的历史记录（超过24小时）
 * POST /api/prompt-editor/history/cleanup
 */
app.post('/api/prompt-editor/history/cleanup', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '缺少用户ID参数'
      });
    }
    
    // 列出用户的所有历史记录文件
    const prefix = `prompt-editor/history/${userId}/`;
    const listResult = await ossClient.list({
      prefix: prefix,
      'max-keys': 1000
    });
    
    if (!listResult.objects || listResult.objects.length === 0) {
      return res.json({
        success: true,
        message: '没有找到历史记录',
        deletedCount: 0
      });
    }
    
    // 过滤24小时内的记录
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const expiredObjects = listResult.objects.filter(obj => {
      const fileDate = new Date(obj.lastModified);
      return fileDate <= twentyFourHoursAgo;
    });
    
    if (expiredObjects.length === 0) {
      return res.json({
        success: true,
        message: '没有过期的历史记录',
        deletedCount: 0
      });
    }
    
    // 删除过期的历史记录文件
    const deletePromises = expiredObjects.map(obj => 
      ossClient.delete(obj.name).catch(error => {
        console.error(`删除过期文件失败 ${obj.name}:`, error);
        return null;
      })
    );
    
    await Promise.all(deletePromises);
    
    console.log(`已清理用户 ${userId} 的 ${expiredObjects.length} 条过期历史记录`);
    
    res.json({
      success: true,
      message: `已清理 ${expiredObjects.length} 条过期历史记录`,
      deletedCount: expiredObjects.length
    });
    
  } catch (error) {
    console.error('清理历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: '清理历史记录失败: ' + error.message
    });
  }
});

// 404处理
app.use((req, res) => {
  // 检查是否请求的是根目录下的HTML文件
  if (req.path.endsWith('.html')) {
    const htmlPath = path.join(__dirname, req.path);
    if (fs.existsSync(htmlPath)) {
      return res.sendFile(htmlPath);
    }
  }
  
  // 对API请求返回JSON格式的错误信息
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: '找不到请求的API端点',
      path: req.path
    });
  }
  
  // 对其他请求返回HTML错误页面
  res.status(404).send('找不到请求的页面');
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  
  // 对API请求返回JSON格式的错误信息
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  // 对其他请求返回HTML错误页面
  res.status(500).send('服务器内部错误');
});

// 在启动服务器前添加全局异常处理机制
// 捕获未处理的Promise异常
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise异常:', reason);
  // 不要结束进程，让服务器继续运行
});

// 捕获全局异常，防止进程崩溃
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  // 不要结束进程，让服务器继续运行
});

// 检查端口是否被占用（改进版：只检查真正监听端口的进程）
const checkPortAvailable = (port) => {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    // 使用 lsof 检查是否有进程在监听该端口
    // -iTCP:port 指定 TCP 协议的端口
    // -sTCP:LISTEN 只匹配处于 LISTEN 状态的连接
    // -t 只输出进程ID
    exec(`lsof -iTCP:${port} -sTCP:LISTEN -t`, (error, stdout, stderr) => {
      if (error) {
        // 没有找到监听端口的进程，端口可用
        resolve(true);
      } else {
        // 找到了监听端口的进程
        const pids = stdout.trim().split('\n').filter(pid => pid);
        if (pids.length > 0) {
          reject(new Error(`端口 ${port} 被以下进程占用: ${pids.join(', ')}`));
        } else {
          // 虽然命令执行成功但没有找到进程，端口可用
          resolve(true);
        }
      }
    });
  });
};

// 在文件末尾寻找服务器启动代码
const startServer = async () => {
  try {
    // 检查端口是否可用
    try {
      await checkPortAvailable(port);
      console.log(`✅ 端口 ${port} 可用，开始启动服务器...`);
    } catch (portError) {
      console.error(`❌ ${portError.message}`);
      console.error('💡 解决方案：');
      console.error(`   1. 终止占用进程: kill -9 <进程ID>`);
      console.error(`   2. 或者修改 .env 文件中的 PORT 配置使用其他端口`);
      process.exit(1);
    }
    // 同步数据库
    await syncDatabase();
    
    // 设置模型关联关系
    console.log('设置模型关联关系...');
    setupAssociations();
    console.log('模型关联关系设置完成');
    
    // 检查全局变量状态
    console.log('检查全局任务变量状态:');
    console.log('- 场景图生成任务变量:', global.sceneGeneratorTasks ? '已初始化' : '未初始化');
    console.log('- 图片高清放大任务变量:', global.imageUpscalerTasks ? '已初始化' : '未初始化');
    console.log('- 视频数字人任务变量:', global.digitalHumanTasks ? '已初始化' : '未初始化');
    
    // 从数据库加载任务信息到全局变量
    await loadTasksFromDatabase();
    
    // 启动定时清理任务
    startCleanupTasks();
    
    // 🎯 启动客服分配超时检查定时任务
    try {
      const assignmentScheduler = require('./utils/assignmentScheduler');
      assignmentScheduler.start();
      console.log('✅ 客服分配超时检查定时任务已启动');
    } catch (error) {
      console.error('❌ 启动客服分配超时检查失败:', error);
    }
    
    // 🚀 启动图生视频任务状态自动同步服务
    try {
      const taskStatusSyncService = require('./services/taskStatusSyncService');
      taskStatusSyncService.start();
      console.log('✅ 图生视频任务状态自动同步服务已启动');
    } catch (syncError) {
      console.error('❌ 启动任务状态同步服务失败:', syncError);
    }
    
    // 🎯 启动视频去标志功能优化
    try {
      const { initVideoLogoRemovalOptimizations } = require('./scripts/initVideoLogoRemovalOptimizations');
      await initVideoLogoRemovalOptimizations();
      console.log('✅ 视频去标志功能优化已启动');
    } catch (optimizationError) {
      console.error('❌ 启动视频去标志功能优化失败:', optimizationError);
    }
    
    // 启动服务器
    const server = app.listen(port, () => {
      console.log(`服务器运行在 http://localhost:${port}`);
      console.log(`虚拟模特编辑器可在 http://localhost:${port}/virtual-model 访问`);
      console.log('🔄 图生视频任务状态自动同步服务正在后台运行');
    });
    
    // 处理服务器启动错误
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ 端口 ${port} 已被占用，请检查是否有其他服务器实例正在运行`);
        console.error('💡 解决方案：');
        console.error(`   1. 使用命令查找占用端口的进程: lsof -ti:${port}`);
        console.error(`   2. 终止占用进程: kill -9 <进程ID>`);
        console.error(`   3. 或者修改 .env 文件中的 PORT 配置使用其他端口`);
        process.exit(1);
      } else {
        console.error('❌ 服务器启动失败:', err);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
  }
};

// 从数据库加载任务信息到全局变量
const loadTasksFromDatabase = async () => {
  try {
    console.log('开始从数据库加载任务信息到全局变量...');
    
    // 加载视频数字人任务
    const digitalHumanUsages = await FeatureUsage.findAll({
      where: { featureName: 'DIGITAL_HUMAN_VIDEO' }
    });
    
    let loadedTasks = 0;
    
    // 初始化全局变量（确保它存在）
    if (!global.digitalHumanTasks) {
      global.digitalHumanTasks = {};
    }
    
    // 处理每个用户的使用记录
    for (const usage of digitalHumanUsages) {
      if (usage.details) {
        try {
          const details = JSON.parse(usage.details);
          if (details.tasks && Array.isArray(details.tasks)) {
            // 遍历任务并添加到全局变量
            for (const task of details.tasks) {
              if (task.taskId) {
                // 无论全局变量中是否已存在，都更新任务信息，确保数据完整性
                global.digitalHumanTasks[task.taskId] = {
                  userId: usage.userId,
                  hasChargedCredits: true, // 已从数据库加载，表示已扣除积分
                  creditCost: task.creditCost || 0,
                  videoDuration: task.videoDuration || 0,
                  timestamp: new Date(task.timestamp) || new Date()
                };
                loadedTasks++;
              }
            }
          }
        } catch (error) {
          console.error(`解析用户ID ${usage.userId} 的视频数字人功能使用记录详情失败:`, error);
          
          // 尝试修复损坏的JSON
          try {
            if (typeof usage.details === 'string' && usage.details.trim()) {
              // 创建一个基本的有效JSON结构
              const fixedDetails = { tasks: [] };
              
              // 保存修复后的details到数据库
              usage.details = JSON.stringify(fixedDetails);
              await usage.save();
              console.log(`已修复用户ID ${usage.userId} 的损坏数据`);
            }
          } catch (repairError) {
            console.error('修复损坏数据失败:', repairError);
          }
        }
      } else if (usage.credits > 0 || usage.usageCount > 0) {
        // 如果没有details字段但有积分消费或使用次数记录，创建一个基本的details结构
        try {
          console.log(`用户ID ${usage.userId} 的视频数字人记录没有details字段，但有积分记录，尝试修复`);
          
          // 创建一个基本的任务记录
          const mockTaskId = `reconstructed-${usage.userId}-${Date.now()}`;
          const mockTask = {
            taskId: mockTaskId,
            videoDuration: Math.max(1, Math.floor(usage.credits / 9)), // 假设每秒9积分
            creditCost: usage.credits || 0,
            timestamp: usage.lastUsedAt || new Date()
          };
          
          // 创建details字段
          const details = { tasks: [mockTask] };
          
          // 保存到数据库
          usage.details = JSON.stringify(details);
          await usage.save();
          
          // 添加到全局变量
          global.digitalHumanTasks[mockTaskId] = {
            videoUrl,
            audioUrl,
            imageUrl,
            videoExtension,
            status: 'PENDING',
            timestamp: new Date(),
            userId: 'mock-user'
          };
          
          loadedTasks++;
          console.log(`已为用户ID ${usage.userId} 重建视频数字人任务记录`);
        } catch (reconstructError) {
          console.error('重建任务记录失败:', reconstructError);
        }
      }
    }
    
    console.log(`成功从数据库加载了 ${loadedTasks} 条视频数字人任务信息到全局变量`);
    
    // 加载场景图生成任务
    try {
      const sceneGeneratorUsages = await FeatureUsage.findAll({
        where: { featureName: 'scene-generator' }
      });
      
      let sceneTasksLoaded = 0;
      
      // 初始化全局变量（确保它存在）
      if (!global.sceneGeneratorTasks) {
        global.sceneGeneratorTasks = {};
      }
      
      // 处理每个用户的使用记录
      for (const usage of sceneGeneratorUsages) {
        if (usage.details) {
          try {
            const details = JSON.parse(usage.details);
            if (details.tasks && Array.isArray(details.tasks)) {
              // 遍历任务并添加到全局变量
              for (const task of details.tasks) {
                if (task.taskId) {
                  // 无论全局变量中是否已存在，都更新任务信息，确保数据完整性
                  global.sceneGeneratorTasks[task.taskId] = {
                    userId: usage.userId,
                    hasChargedCredits: !task.isFree,
                    isFree: task.isFree || false,
                    creditCost: task.creditCost || 0,
                    refunded: false,
                    timestamp: new Date(task.timestamp) || new Date()
                  };
                  sceneTasksLoaded++;
                }
              }
            }
          } catch (error) {
            console.error(`解析用户ID ${usage.userId} 的场景图生成功能使用记录详情失败:`, error);
          }
        }
      }
      
      console.log(`成功从数据库加载了 ${sceneTasksLoaded} 条场景图生成任务信息到全局变量`);
    } catch (error) {
      console.error('加载场景图生成任务信息失败:', error);
    }
    
    // 可以在这里添加其他功能的任务加载逻辑
    
  } catch (error) {
    console.error('从数据库加载任务信息失败:', error);
  }
};

// 启动服务器后立即加载任务数据
startServer().then(() => {
  // 确保在服务器启动后执行加载任务
  loadTasksFromDatabase().catch(err => {
    console.error('加载任务数据失败:', err);
  });
  
  // 同步全局变量和数据库中的视频数字人使用记录
  syncDigitalHumanTasksWithDatabase().catch(err => {
    console.error('同步视频数字人任务数据失败:', err);
  });
});

/**
 * 同步全局变量和数据库中的视频数字人使用记录
 * 确保两者保持一致，以便准确统计
 */
async function syncDigitalHumanTasksWithDatabase() {
  try {
    console.log('开始同步全局变量和数据库中的视频数字人使用记录...');
    
    // 获取所有视频数字人功能使用记录
    const usages = await FeatureUsage.findAll({
      where: { featureName: 'DIGITAL_HUMAN_VIDEO' }
    });
    
    // 记录同步情况
    let syncCount = 0;
    let updateCount = 0;
    
    // 处理每个用户的记录
    for (const usage of usages) {
      const userId = usage.userId;
      let tasksFromDB = [];
      
      // 解析数据库中的任务记录
      if (usage.details) {
        try {
          const details = JSON.parse(usage.details);
          if (details && details.tasks && Array.isArray(details.tasks)) {
            tasksFromDB = details.tasks;
          }
        } catch (error) {
          console.error(`解析用户ID ${userId} 的任务记录失败:`, error);
          continue;
        }
      }
      
      // 获取全局变量中该用户的任务
      const userTasksInGlobal = {};
      let taskCount = 0;
      let totalCredits = 0;
      
      // 从全局变量中筛选出该用户的任务
      for (const taskId in global.digitalHumanTasks) {
        const task = global.digitalHumanTasks[taskId];
        if (task && task.userId === userId) {
          userTasksInGlobal[taskId] = task;
          taskCount++;
          totalCredits += task.creditCost || 0;
        }
      }
      
      console.log(`用户ID ${userId}: 数据库中有 ${tasksFromDB.length} 条任务记录，全局变量中有 ${taskCount} 条任务记录`);
      
      // 检查是否需要更新数据库记录
      const needUpdate = tasksFromDB.length !== taskCount || usage.usageCount !== taskCount || usage.credits !== totalCredits;
      
      if (needUpdate) {
        // 创建新的任务列表，以全局变量为准
        const newTasks = [];
        for (const taskId in userTasksInGlobal) {
          const task = userTasksInGlobal[taskId];
          newTasks.push({
            taskId: taskId,
            videoDuration: task.videoDuration || 0,
            creditCost: task.creditCost || 0,
            timestamp: task.timestamp || new Date()
          });
        }
        
        // 更新数据库记录
        usage.details = JSON.stringify({ tasks: newTasks });
        usage.usageCount = taskCount;
        usage.credits = totalCredits;
        await usage.save();
        
        console.log(`已更新用户ID ${userId} 的使用记录: ${taskCount} 次使用，${totalCredits} 积分`);
        updateCount++;
      }
      
      syncCount++;
    }
    
    console.log(`同步完成: 共处理 ${syncCount} 个用户记录，更新了 ${updateCount} 个记录`);
    
  } catch (error) {
    console.error('同步视频数字人使用记录失败:', error);
    throw error;
  }
}

// 在现有的路由配置之后添加视频数字人路由

// 引入视频数字人路由配置
app.use(express.static(path.join(__dirname)));

// 设置视频数字人文件上传
const digitalHumanVideoStorage = multer.memoryStorage(); // 使用内存存储

const digitalHumanUpload = multer({
  storage: digitalHumanVideoStorage,
  limits: {
    fileSize: 300 * 1024 * 1024 // 300MB 视频限制
  }
});

/**
 * 上传文件到OSS服务
 * @param {Object|Buffer} file - multer文件对象或文件buffer
 * @param {String} folderPath - OSS存储的文件夹路径
 * @returns {Promise<String>} OSS URL
 */
async function uploadFileToOSS(file, folderPath) {
  try {
    let fileContent, fileName;
    
    // 检查是否传入的是Buffer还是文件对象
    if (Buffer.isBuffer(file)) {
      // 如果是Buffer数据，直接使用
      fileContent = file;
      // 使用时间戳作为文件名
      fileName = `file-${Date.now()}.bin`;
      console.log('准备上传Buffer数据到OSS');
    } else if (file.buffer) {
      // 如果是multer内存存储的文件对象
      fileContent = file.buffer;
      fileName = file.originalname || `file-${Date.now()}${path.extname(file.originalname || '.bin')}`;
      console.log('准备上传multer内存文件到OSS:', fileName);
    } else if (file.path) {
      // 如果是multer磁盘存储的文件对象
  console.log('准备上传文件到OSS:', file.path);
  
    // 确认文件存在
    if (!fs.existsSync(file.path)) {
      throw new Error(`文件路径不存在: ${file.path}`);
    }
    
    // 读取文件内容
      fileContent = fs.readFileSync(file.path);
      fileName = path.basename(file.path);
    } else {
      throw new Error('无效的文件参数，需要提供Buffer或multer文件对象');
    }
    
    // 生成OSS对象名
    const objectName = `${folderPath}/${Date.now()}-${fileName}`;
    
    // 检查OSS客户端配置
    if (!ossClient) {
      console.error('OSS客户端未初始化，检查您的阿里云凭证配置');
      throw new Error('OSS客户端配置错误');
    }
    
    // 上传到OSS
    try {
      const result = await ossClient.put(objectName, fileContent);
      console.log('文件上传到OSS成功:', result.url);
      
      // 如果是磁盘存储的文件，删除本地临时文件
      if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
        console.log('已删除本地临时文件:', file.path);
      }
      
      return result.url;
    } catch (ossError) {
      console.error('上传到OSS失败:', ossError);
      
      // 如果OSS上传失败但在生产环境，抛出错误
      if (process.env.NODE_ENV === 'production') {
        throw ossError;
      }
      
      // 在开发环境保留本地文件作为备用
      if (file.path && fs.existsSync(file.path)) {
      console.log('开发环境：返回本地文件URL作为备用');
      return `http://localhost:${port}/uploads/${path.relative(path.join(__dirname, 'uploads'), file.path)}`;
      } else {
        // 没有本地文件可用
        throw ossError;
      }
    }
  } catch (error) {
    console.error('读取或处理文件失败:', error);
    throw error;
  }
}

/**
 * 创建VideoRetalk任务 - 声动人像合成（视频数字人）
 * 注意：虽然API路径包含image2video，但这是阿里云的视频数字人口型合成API，不是图生视频功能
 * @param {String} videoUrl - 视频URL
 * @param {String} audioUrl - 音频URL
 * @param {String} imageUrl - 图片URL (可选)
 * @param {Boolean} videoExtension - 是否扩展视频
 * @param {Number} videoDuration - 视频时长（秒），用于音频截断
 * @returns {Promise<String>} 任务ID
 */
async function createVideoRetalkTask(videoUrl, audioUrl, imageUrl, videoExtension, videoDuration) {
  try {
    console.log('创建VideoRetalk任务:', {
      videoUrl: videoUrl ? videoUrl.substring(0, 50) + '...' : 'undefined',
      audioUrl: audioUrl ? audioUrl.substring(0, 50) + '...' : 'undefined',
      hasImageUrl: !!imageUrl,
      videoExtension
    });
    
    // 检查是否为本地测试模式
    if (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_API === 'true') {
      console.log('使用本地测试模式 - 返回模拟任务ID');
      
      // 创建模拟任务ID
      const mockTaskId = `mock-task-${Date.now()}`;
      
      // 将任务信息存储在内存中
      if (!global.digitalHumanTasks) {
        global.digitalHumanTasks = {};
      }
      
      global.digitalHumanTasks[mockTaskId] = {
        videoUrl,
        audioUrl,
        imageUrl,
        videoExtension,
        status: 'PENDING',
        timestamp: new Date(),
        userId: 'mock-user'
      };
      
      // 返回模拟的任务ID
      return mockTaskId;
    }

    // 禁用本地测试模式，始终使用真实API
    if (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_API === 'true') {
      console.log('模拟模式已禁用，强制使用真实API');
      // 继续执行真实API调用，不返回模拟任务ID
    }
    
    // 真实API调用模式
    const apiUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis/';
    
    // 检查URL格式
    if (!videoUrl.startsWith('http') || !audioUrl.startsWith('http')) {
      throw new Error('视频和音频URL必须是有效的HTTP/HTTPS URL');
    }
    
    if (imageUrl && !imageUrl.startsWith('http')) {
      throw new Error('参考图片URL必须是有效的HTTP/HTTPS URL');
    }
    
    // 构建请求体
    const requestBody = {
      model: 'videoretalk',  // 指定模型为videoretalk，用于口型合成
      input: {
        video_url: videoUrl,  // 用户上传的视频URL
        audio_url: audioUrl   // 用户上传的音频URL
      },
      parameters: {
        video_extension: videoExtension || false  // 是否延长视频以匹配音频时长
      }
    };
    
    // 如果提供了参考图片，添加到请求中
    if (imageUrl) {
      requestBody.input.ref_image_url = imageUrl;
    }
    
    console.log('发送VideoRetalk API请求:', {
      url: apiUrl,
      model: requestBody.model,
      hasVideoUrl: !!videoUrl,
      hasAudioUrl: !!audioUrl,
      hasImageUrl: !!imageUrl
    });
    
    // 发送请求
    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'X-DashScope-Async': 'enable'
      }
    });
    
    console.log('VideoRetalk任务创建成功, 状态码:', response.status);
    
    if (response.data && response.data.output && response.data.output.task_id) {
      return response.data.output.task_id;
    } else {
      console.error('API响应缺少task_id:', response.data);
      throw new Error('API响应格式不正确，缺少task_id');
    }
  } catch (error) {
    console.error('创建VideoRetalk任务失败:', error.response ? error.response.data : error.message);
    throw error;
  }
}

/**
 * 查询VideoRetalk任务状态
 * @param {String} taskId - 任务ID
 * @returns {Promise<Object>} 任务状态
 */
async function checkVideoRetalkTaskStatus(taskId) {
  try {
    console.log('准备查询任务状态:', taskId);
    
    // 检查是否为模拟任务ID（本地测试模式）
    if (taskId.startsWith('mock-task-')) {
      console.log('使用本地测试模式 - 模拟任务状态');
      
      // 解析任务ID中的时间戳
      const timestamp = parseInt(taskId.split('-').pop());
      const elapsedSeconds = (Date.now() - timestamp) / 1000;
      
      // 模拟任务状态变化
      if (elapsedSeconds < 10) {
        // 前10秒为PENDING状态
        return {
          status: 'PENDING',
          message: '任务排队中',
          requestId: `mock-request-${Date.now()}`
        };
      } else if (elapsedSeconds < 30) {
        // 10-30秒为RUNNING状态
        return {
          status: 'RUNNING',
          message: '任务处理中',
          requestId: `mock-request-${Date.now()}`
        };
      } else {
        // 30秒后为SUCCEEDED状态
        // 确保使用一个确定存在的视频文件路径
        const sampleVideoPath = '/uploads/sample-output.mp4';
        const mockDuration = Math.floor(Math.random() * 5) + 2; // 2-7秒的随机时长，模拟短视频
        
        // 检查文件是否存在
        try {
          if (fs.existsSync(path.join(__dirname, 'public', sampleVideoPath))) {
            console.log(`模拟模式：样本视频文件存在: ${sampleVideoPath}`);
          } else {
            console.warn(`模拟模式：警告 - 样本视频文件不存在: ${sampleVideoPath}`);
          }
        } catch (err) {
          console.error(`模拟模式：检查样本视频文件时出错:`, err);
        }
        
        return {
          status: 'SUCCEEDED',
          videoUrl: `http://localhost:8080${sampleVideoPath}`,
          videoDuration: mockDuration, // 添加模拟的视频时长
          requestId: `mock-request-${Date.now()}`
        };
      }
    }

    // 禁用模拟模式，始终使用真实API
    // 如果是以mock-task开头的任务ID，返回错误信息
    if (taskId.startsWith('mock-task-')) {
      console.log('模拟模式已禁用，请使用真实API');
      return {
        status: 'FAILED',
        message: '模拟模式已禁用，请使用真实API调用',
        requestId: `error-${Date.now()}`
      };
    }
    
    // 真实API调用模式
    const apiUrl = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
    
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`
      }
    });
    
    console.log('查询VideoRetalk任务状态, 状态码:', response.status);
    
    // 日志完整的响应数据，帮助调试
    console.log('完整响应数据:', JSON.stringify(response.data, null, 2));
    
    // 解析响应
    const { output, request_id } = response.data;
    
    // 获取任务状态
    const task_status = output.task_status;
    
    // 处理不同的任务状态
    if (task_status === 'SUCCEEDED') {
      // 任务成功，从不同可能的位置获取视频URL
      let videoUrl = null;
      let videoDuration = null;
      
      // 检查output.video_url (基于实际日志发现的字段位置)
      if (output.video_url) {
        videoUrl = output.video_url;
        console.log('从output.video_url获取到视频URL:', videoUrl);
      }
      // 尝试从多个可能的位置获取结果URL（根据API文档的不同返回格式）
      else if (output.result && output.result.video_url) {
        // 标准格式: output.result.video_url
        videoUrl = output.result.video_url;
        console.log('从output.result.video_url获取到视频URL:', videoUrl);
        // 尝试获取视频时长
        if (output.result.duration) {
          videoDuration = parseFloat(output.result.duration);
          console.log('从API响应的output.result.duration获取视频时长:', videoDuration);
        }
      } else if (output.results && Array.isArray(output.results) && output.results.length > 0) {
        // 检查 results 数组
        if (output.results[0].url) {
          videoUrl = output.results[0].url;
          console.log('从output.results[0].url获取到视频URL:', videoUrl);
          // 尝试获取视频时长
          if (output.results[0].duration) {
            videoDuration = parseFloat(output.results[0].duration);
            console.log('从API响应的output.results[0].duration获取视频时长:', videoDuration);
          }
        } else if (output.results[0].video_url) {
          videoUrl = output.results[0].video_url;
          console.log('从output.results[0].video_url获取到视频URL:', videoUrl);
          // 尝试获取视频时长
          if (output.results[0].duration) {
            videoDuration = parseFloat(output.results[0].duration);
            console.log('从API响应的output.results[0].duration获取视频时长:', videoDuration);
          }
        }
      } else if (output.results && output.results.url) {
        // results 是对象，直接有 url 字段
        videoUrl = output.results.url;
        console.log('从output.results.url获取到视频URL:', videoUrl);
        // 尝试获取视频时长
        if (output.results.duration) {
          videoDuration = parseFloat(output.results.duration);
          console.log('从output.results.duration获取视频时长:', videoDuration);
        }
      } else if (output.results && output.results.video_url) {
        // results 是对象，直接有 video_url 字段
        videoUrl = output.results.video_url;
        console.log('从output.results.video_url获取到视频URL:', videoUrl);
        // 尝试获取视频时长
        if (output.results.duration) {
          videoDuration = parseFloat(output.results.duration);
          console.log('从output.results.duration获取视频时长:', videoDuration);
        }
      } else if (output.result_url) {
        // 直接在 output 下的 result_url
        videoUrl = output.result_url;
        console.log('从output.result_url获取到视频URL:', videoUrl);
      } else if (output.result_urls && Array.isArray(output.result_urls) && output.result_urls.length > 0) {
        // 如果有 result_urls 数组
        videoUrl = output.result_urls[0];
        console.log('从output.result_urls[0]获取到视频URL:', videoUrl);
      }
      
      // 如果没有从具体字段找到视频时长，尝试从其他位置查找
      if (videoDuration === null) {
        // 从API响应的usage.video_duration获取（根据官方API文档，这是推荐的字段）
        if (response.data.usage && response.data.usage.video_duration !== undefined) {
          // 获取浮点数时长，向上取整，确保不满1秒按1秒计算
          videoDuration = Math.ceil(parseFloat(response.data.usage.video_duration));
          console.log(`从API响应的usage.video_duration获取视频时长: ${response.data.usage.video_duration}秒，取整后: ${videoDuration}秒`);
        }
        // 尝试从output.duration获取
        else if (output.duration) {
          videoDuration = Math.ceil(parseFloat(output.duration));
          console.log(`从output.duration获取视频时长: ${output.duration}秒，取整后: ${videoDuration}秒`);
        }
        // 尝试从顶级字段获取
        else if (response.data.duration) {
          videoDuration = Math.ceil(parseFloat(response.data.duration));
          console.log(`从response.data.duration获取视频时长: ${response.data.duration}秒，取整后: ${videoDuration}秒`);
        }
        // 尝试从URL查询参数获取
        else if (videoUrl) {
          try {
            const url = new URL(videoUrl);
            const durationParam = url.searchParams.get('duration');
            if (durationParam && !isNaN(parseFloat(durationParam))) {
              videoDuration = Math.ceil(parseFloat(durationParam));
              console.log(`从URL查询参数duration获取视频时长: ${durationParam}秒，取整后: ${videoDuration}秒`);
            }
          } catch (urlError) {
            console.log('URL解析失败，无法从视频URL获取时长参数');
          }
        }
      }
      
      // 检查获取到的视频URL是否有效
      if (!videoUrl) {
        console.warn('警告: 任务状态为SUCCEEDED但未找到有效的视频URL');
        // 最后尝试直接从response.data寻找video_url
        if (response.data.video_url) {
          videoUrl = response.data.video_url;
          console.log('最终尝试从response.data.video_url获取到视频URL:', videoUrl);
        }
      }
      
      // 如果仍未找到视频URL
      if (!videoUrl) {
        return {
          status: 'FAILED',
          message: '生成成功但视频URL缺失',
          requestId: request_id
        };
      }
      
      // 任务成功，返回视频URL和视频时长（如果可用）
      return {
        status: 'SUCCEEDED',
        videoUrl: videoUrl,
        videoDuration: videoDuration, // 添加视频时长字段到返回数据
        requestId: request_id
      };
    } else if (task_status === 'FAILED') {
      // 任务失败
      return {
        status: 'FAILED',
        message: output.message || '处理失败，请重试',
        requestId: request_id
      };
    } else {
      // 任务仍在处理中
      return {
        status: task_status,
        message: task_status === 'PENDING' ? '任务排队中' : '任务处理中',
        requestId: request_id
      };
    }
  } catch (error) {
    console.error('查询VideoRetalk任务状态失败:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// 全局风格化路由已在上面定义，这里删除重复定义

// 音频上传路由 - 用于多图转视频的背景音乐
app.post('/api/upload-audio', protect, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: '未提供音频文件'
      });
    }
    
    // 获取上传的文件
    const filePath = req.file.path;
    
    // 验证文件大小
    const fileStats = fs.statSync(filePath);
    const fileSizeInMB = fileStats.size / (1024 * 1024);
    
    if (fileSizeInMB > 10) {
      // 删除临时文件
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: '音频文件过大，不能超过10MB'
      });
    }
    
    // 验证文件类型
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const allowedExtensions = ['.mp3', '.wav', '.aac', '.m4a'];
    
    if (!allowedExtensions.includes(fileExt)) {
      // 删除临时文件
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: '只支持MP3、WAV、AAC和M4A音频格式'
      });
    }
    
    let audioUrl;
    
    try {
      // 上传音频文件到OSS
      console.log('开始将音频上传到阿里云OSS...');
      
      // 使用OSS客户端上传文件
      const fileContent = fs.readFileSync(filePath);
      const ossFileName = `multi-image-videos/audio-${Date.now()}-${uuidv4()}${fileExt}`;
      
      // 使用OSS客户端上传
      const result = await ossClient.put(ossFileName, fileContent);
      
      console.log('音频文件已成功上传到阿里云OSS:', result.url);
      audioUrl = result.url;
      
      if (!audioUrl || !audioUrl.startsWith('http')) {
        throw new Error('OSS未返回有效的URL');
      }
      
      // 删除临时文件
      fs.unlinkSync(filePath);
    } catch (ossError) {
      console.error('上传到阿里云OSS失败:', ossError);
      
      // 如果OSS上传失败但在开发环境，使用本地URL作为备用
      if (process.env.NODE_ENV !== 'production') {
        console.log('开发环境：返回本地文件URL作为备用');
        const localFileName = path.basename(filePath);
        audioUrl = `http://localhost:${port}/uploads/${localFileName}`;
        console.log('使用本地备用URL:', audioUrl);
      } else {
        // 生产环境直接报错
        // 尝试删除临时文件
        try { 
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath); 
          }
        } catch (e) { /* 忽略删除临时文件的错误 */ }
        
        return res.status(500).json({
          success: false,
          message: '上传音频到OSS失败: ' + ossError.message
        });
      }
    }
    
    // 记录上传信息到历史记录
    try {
      await ImageHistory.create({
        userId: req.user.id,
        fileUrl: audioUrl,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: fileStats.size,
        uploadDate: new Date(),
        category: 'audio_for_video',
        status: 'uploaded'
      });
    } catch (dbError) {
      console.error('记录音频上传历史记录失败:', dbError);
      // 继续处理，不影响主流程
    }
    
    // 返回音频URL
    return res.json({
      success: true,
      audioUrl: audioUrl,
      message: '音频上传成功'
    });
  } catch (error) {
    console.error('音频上传处理错误:', error);
    
    // 尝试删除临时文件
    try {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (e) { /* 忽略删除临时文件的错误 */ }
    
    return res.status(500).json({
      success: false,
      message: '音频上传处理失败: ' + error.message
    });
  }
});

// 检查功能访问权限的API端点
app.post('/api/check-feature-access', protect, async (req, res) => {
  try {
    const { featureName, duration } = req.body;
    const userId = req.user.id;
    
    console.log(`检查功能访问权限: 用户ID=${userId}, 功能=${featureName}, 时长=${duration}`);
    
    // 导入必要的模块
    const { FEATURES } = require('./middleware/featureAccess');
    const { FeatureUsage } = require('./models/FeatureUsage');
    const User = require('./models/User');
    
    // 检查功能是否存在
    const featureConfig = FEATURES[featureName];
    if (!featureConfig) {
      return res.status(400).json({
        success: false,
        message: '无效的功能名称'
      });
    }
    
    // 查找用户的功能使用记录
    let usage = await FeatureUsage.findOne({
      where: { userId, featureName }
    });
    
    // 如果没有使用记录，创建一个
    if (!usage) {
      const today = new Date().toISOString().split('T')[0];
      usage = await FeatureUsage.create({
        userId,
        featureName,
        usageCount: 0,
        lastUsedAt: new Date(),
        resetDate: today
      });
    }
    
    // 检查是否在免费使用次数内
    if (usage.usageCount < featureConfig.freeUsage) {
      return res.json({
        success: true,
        usageType: 'free',
        message: '免费使用次数内，可以使用该功能',
        data: {
          freeUsageUsed: usage.usageCount,
          freeUsageLimit: featureConfig.freeUsage,
          isFree: true
        }
      });
    }
    
    // 超过免费次数，需要检查积分
    const user = await User.findByPk(userId);
    
    // 计算所需积分
    let requiredCredits = 0;
    if (featureName === 'MULTI_IMAGE_TO_VIDEO') {
      // 多图转视频：每30秒30积分，不满30秒按30秒计算
      const videoDuration = duration || 5;
      requiredCredits = Math.ceil(videoDuration / 30) * 30;
    } else if (typeof featureConfig.creditCost === 'function') {
      // 其他动态计算积分的功能
      requiredCredits = featureConfig.creditCost(req.body);
    } else {
      // 固定积分消耗
      requiredCredits = featureConfig.creditCost;
    }
    
    // 检查用户积分是否足够
    if (user.credits < requiredCredits) {
      return res.status(402).json({
        success: false,
        message: '积分不足，无法使用该功能',
        data: {
          requiredCredits,
          currentCredits: user.credits,
          freeUsageLimit: featureConfig.freeUsage,
          freeUsageUsed: usage.usageCount,
          isFree: false
        }
      });
    }
    
    // 积分足够，允许使用
    return res.json({
      success: true,
      usageType: 'paid',
      message: '积分足够，可以使用该功能',
      data: {
        requiredCredits,
        currentCredits: user.credits,
        freeUsageLimit: featureConfig.freeUsage,
        freeUsageUsed: usage.usageCount,
        isFree: false
      }
    });
    
  } catch (error) {
    console.error('检查功能访问权限出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，无法检查功能访问权限',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 直接下载API，生成OSS签名URL
app.get('/api/direct-download', async (req, res) => {
  try {
    const { url, filename } = req.query;
    
    if (!url) {
      return res.status(400).json({ success: false, message: '缺少URL参数' });
    }
    
    console.log(`处理直接下载请求: ${url.substring(0, 100)}...`);
    
    // 获取OSS服务
    const ossService = require('./utils/ossService');
    
    // 获取签名URL，有效期15分钟
    const signedUrl = await ossService.generateSignedUrl(url, 15);
    
    // 返回签名URL
    return res.json({
      success: true,
      url: signedUrl,
      expiresIn: '15分钟',
      filename: filename || '下载文件.mp4'
    });
  } catch (error) {
    console.error('生成直接下载链接失败:', error);
    return res.status(500).json({ 
      success: false, 
      message: `生成直接下载链接失败: ${error.message}`,
      error: error.toString() 
    });
  }
});

// 导出OSS更新函数供中间件使用
module.exports = {
  updateMultiImageToVideoTaskInOSS
};

// 设置为全局函数供中间件使用（避免循环依赖）
global.updateMultiImageToVideoTaskInOSS = updateMultiImageToVideoTaskInOSS;


// 设置为全局函数供中间件使用（避免循环依赖）
global.updateMultiImageToVideoTaskInOSS = updateMultiImageToVideoTaskInOSS;

