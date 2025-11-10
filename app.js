// 在app.js中添加新的路由
const express = require('express');
const app = express();

// 添加垫图历史记录路由
const diantuHistoryRouter = require('./routes/diantu-history');
app.use('/api/diantu/history', diantuHistoryRouter);

// 添加垫图功能API路由
const diantuRouter = require('./routes/diantu');
app.use('/api/diantu', diantuRouter);

// 注释掉这里的文生图片历史记录路由，避免与server.js中的路由冲突
// const textToImageHistoryRouter = require('./routes/text-to-image-history');
// app.use('/api/text-to-image/history', textToImageHistoryRouter);

// 添加上传到OSS的路由
const uploadToOssRouter = require('./routes/upload-to-oss');
app.use('/api/upload-to-oss', uploadToOssRouter);

module.exports = app;