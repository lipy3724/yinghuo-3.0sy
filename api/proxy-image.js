const https = require('https');
const http = require('http');
const url = require('url');

module.exports = (req, res) => {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // 处理OPTIONS预检请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    // 只允许GET请求
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    
    // 获取要代理的图片URL
    const imageUrl = req.query.url;
    if (!imageUrl) {
        res.status(400).json({ error: 'Missing url parameter' });
        return;
    }
    
    // 记录请求信息
    console.log(`处理图片代理请求: ${imageUrl.substring(0, 100)}...`);
    
    // 确保URL是有效的
    try {
        new URL(imageUrl);
    } catch (error) {
        console.error('无效的URL:', imageUrl, error.message);
        res.status(400).json({ error: '无效的URL格式', message: error.message });
        return;
    }
    
    try {
        const parsedUrl = url.parse(imageUrl);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        
        // 创建请求选项
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.path,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/*',
                'Referer': parsedUrl.hostname // 添加Referer头，有些服务器需要验证
            }
        };
        
        // 如果是https请求，添加额外选项
        if (parsedUrl.protocol === 'https:') {
            options.rejectUnauthorized = false; // 允许无效证书
        }
        
        console.log(`发起图片代理请求: ${parsedUrl.hostname}${parsedUrl.path}`);
        
        // 发起请求
        const proxyReq = protocol.request(options, (proxyRes) => {
            // 记录响应状态
            console.log(`图片代理响应: ${proxyRes.statusCode} ${proxyRes.statusMessage}`);
            
            // 检查响应状态码
            if (proxyRes.statusCode >= 400) {
                console.error(`图片代理请求失败: ${proxyRes.statusCode} ${proxyRes.statusMessage}`);
                let errorData = '';
                proxyRes.on('data', chunk => {
                    errorData += chunk;
                });
                proxyRes.on('end', () => {
                    res.status(proxyRes.statusCode).json({
                        error: `源服务器返回错误: ${proxyRes.statusCode}`,
                        message: proxyRes.statusMessage,
                        data: errorData.substring(0, 200) // 限制错误数据大小
                    });
                });
                return;
            }
            
            // 设置响应头
            res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            
            // 将状态码传递给客户端
            res.status(proxyRes.statusCode);
            
            // 将响应数据流式传输给客户端
            proxyRes.pipe(res);
        });
        
        // 处理请求错误
        proxyReq.on('error', (error) => {
            console.error('代理请求错误:', error.message);
            if (!res.headersSent) {
                res.status(500).json({ 
                    error: '图片加载失败',
                    message: error.message,
                    url: imageUrl
                });
            }
        });
        
        // 设置超时
        proxyReq.setTimeout(30000, () => {
            proxyReq.destroy();
            console.error('代理请求超时:', imageUrl);
            if (!res.headersSent) {
                res.status(408).json({ 
                    error: '请求超时',
                    url: imageUrl
                });
            }
        });
        
        // 结束请求
        proxyReq.end();
        
    } catch (error) {
        console.error('代理图片请求失败:', error.message);
        res.status(500).json({ 
            error: '服务器错误',
            message: error.message,
            url: imageUrl
        });
    }
};
