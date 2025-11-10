
// 导入文生图片历史记录路由
const textToImageHistoryRoutes = require('./routes/text-to-image-history');
// 注册文生图片历史记录API路由
app.use('/api/text-to-image/history', textToImageHistoryRoutes);




