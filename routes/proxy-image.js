/**
 * 图片代理路由
 * 用于解决跨域问题，代理获取其他域的图片
 * 支持通过 /api/proxy-image?url=图片URL 和 /api/proxy-image/url?imageUrl=图片URL 两种方式访问
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');
const dns = require('dns');
const constants = require('constants');
const logger = require('../utils/logger');

// 配置DNS解析器，使用Google、Cloudflare和114DNS的DNS服务器
const dnsServers = ['8.8.8.8', '8.8.4.4', '1.1.1.1', '114.114.114.114'];
const customDnsResolver = new dns.Resolver();
customDnsResolver.setServers(dnsServers);

// 配置axios默认选项
axios.defaults.timeout = 60000; // 增加到60秒，支持复杂AI分析任务
axios.defaults.maxRedirects = 5;

logger.info('配置了自定义DNS解析器', { dnsServers });
logger.info('配置了axios默认选项', { timeout: axios.defaults.timeout, maxRedirects: axios.defaults.maxRedirects });

/**
 * 解析域名并获取IP地址
 * @param {string} hostname 域名
 * @returns {Promise<string[]>} IP地址数组
 */
async function resolveDomain(hostname) {
    try {
        logger.info(`使用自定义DNS解析器解析域名: ${hostname}`);
        const addresses = await new Promise((resolve, reject) => {
            customDnsResolver.resolve4(hostname, (err, addresses) => {
                if (err) {
                    logger.error(`DNS解析失败: ${hostname}`, { error: err.message });
                    reject(err);
                } else {
                    logger.info(`DNS解析成功: ${hostname}`, { addresses });
                    resolve(addresses);
                }
            });
        });
        
        // 如果解析成功，记录IP地址
        logger.info(`域名 ${hostname} 解析结果:`, { addresses });
        return addresses;
    } catch (dnsError) {
        // DNS解析失败，记录错误
        logger.warn(`自定义DNS解析失败，将使用系统DNS: ${hostname}`, { error: dnsError.message });
        throw dnsError;
    }
}

/**
 * DNS检查接口，用于检查域名是否可以解析
 * @route GET /api/proxy-image/dns-check
 * @param {string} hostname - 要检查的域名
 */
router.get('/dns-check', async (req, res) => {
    // 设置CORS头，允许跨域访问
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // 如果是预检请求，直接返回成功
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const hostname = req.query.hostname;
        
        if (!hostname) {
            return res.status(400).json({
                success: false,
                message: '缺少hostname参数'
            });
        }
        
        logger.info('接收到DNS检查请求', { hostname });
        
        try {
            // 使用自定义DNS解析器解析域名
            const addresses = await new Promise((resolve, reject) => {
                customDnsResolver.resolve4(hostname, (err, addresses) => {
                    if (err) {
                        logger.error(`DNS解析失败: ${hostname}`, { error: err.message });
                        reject(err);
                    } else {
                        logger.info(`DNS解析成功: ${hostname}`, { addresses });
                        resolve(addresses);
                    }
                });
            });
            
            // 返回解析结果
            res.json({
                success: true,
                hostname: hostname,
                addresses: addresses,
                message: '域名解析成功'
            });
        } catch (dnsError) {
            logger.warn(`DNS解析失败: ${hostname}`, { error: dnsError.message });
            
            // 尝试使用系统DNS解析
            try {
                const addresses = await new Promise((resolve, reject) => {
                    dns.resolve4(hostname, (err, addresses) => {
                        if (err) {
                            logger.error(`系统DNS解析失败: ${hostname}`, { error: err.message });
                            reject(err);
                        } else {
                            logger.info(`系统DNS解析成功: ${hostname}`, { addresses });
                            resolve(addresses);
                        }
                    });
                });
                
                // 返回系统DNS解析结果
                res.json({
                    success: true,
                    hostname: hostname,
                    addresses: addresses,
                    usingSystemDns: true,
                    message: '使用系统DNS解析成功'
                });
            } catch (systemDnsError) {
                // 两种DNS解析都失败
                logger.error(`所有DNS解析都失败: ${hostname}`, { 
                    customDnsError: dnsError.message,
                    systemDnsError: systemDnsError.message
                });
                
                res.status(500).json({
                    success: false,
                    hostname: hostname,
                    message: '域名解析失败',
                    error: {
                        customDns: dnsError.message,
                        systemDns: systemDnsError.message
                    }
                });
            }
        }
    } catch (error) {
        logger.error('DNS检查失败', {
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).json({
            success: false,
            message: 'DNS检查失败: ' + error.message
        });
    }
});

/**
 * 代理获取图片
 * @route GET /api/proxy-image
 * @param {string} url - 要代理的图片URL
 */
router.get('/', async (req, res) => {
    // 设置CORS头，允许跨域访问
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // 如果是预检请求，直接返回成功
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const imageUrl = req.query.url;
        
        if (!imageUrl) {
            return res.status(400).json({
                success: false,
                message: '缺少图片URL参数'
            });
        }
        
        logger.info('接收到图片代理请求', { imageUrl: imageUrl.substring(0, 100) });
        
        // 检查URL是否合法
        let parsedUrl;
        try {
            // 尝试解析URL，确保它是有效的
            parsedUrl = new URL(imageUrl);
            
            // 确保协议是http或https
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                return res.status(400).json({
                    success: false,
                    message: '无效的图片URL协议，仅支持HTTP和HTTPS'
                });
            }
            
            // 确保有主机名
            if (!parsedUrl.hostname) {
                return res.status(400).json({
                    success: false,
                    message: '无效的图片URL，缺少主机名'
                });
            }
            
            // 记录解析后的URL信息，便于调试
            logger.info('解析后的URL信息', {
                protocol: parsedUrl.protocol,
                hostname: parsedUrl.hostname,
                pathname: parsedUrl.pathname,
                search: parsedUrl.search
            });
            
        } catch (urlError) {
            logger.error('URL解析失败', { error: urlError.message, imageUrl });
            return res.status(400).json({
                success: false,
                message: '无效的图片URL格式: ' + urlError.message
            });
        }
        
        // 打印请求的URL
        logger.info('尝试获取图片', { imageUrl: imageUrl.substring(0, 100) });
        
        // 获取图片
        // 添加错误处理和重试机制
        let response;
        let retries = 0;
        const maxRetries = 3;
        
        while (retries < maxRetries) {
            try {
                // 先尝试解析域名，确保DNS解析正常
                try {
                    await resolveDomain(parsedUrl.hostname);
                } catch (dnsError) {
                    // DNS解析失败，但继续尝试请求，axios会使用系统默认DNS
                    logger.warn(`自定义DNS解析失败，将使用系统DNS: ${parsedUrl.hostname}`, { error: dnsError.message });
                }
                
                response = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'image/*'
                    },
                    // 允许自动重定向
                    maxRedirects: 5,
                    // 允许无效证书
                    httpsAgent: new https.Agent({ 
                        rejectUnauthorized: false,
                        // 启用所有TLS版本
                        secureOptions: constants.SSL_OP_NO_TLSv1_2,
                        // 增加连接超时
                        timeout: 10000
                    })
                });
                
                break; // 成功获取，退出重试循环
            } catch (fetchError) {
                retries++;
                logger.error(`获取图片失败，第${retries}次重试`, {
                    error: fetchError.message,
                    imageUrl: imageUrl.substring(0, 100)
                });
                
                if (retries >= maxRetries) {
                    throw fetchError; // 达到最大重试次数，抛出错误
                }
                
                // 等待一段时间再重试
                await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            }
        }
        
        // 获取内容类型
        const contentType = response.headers['content-type'];
        
        // 检查是否是图片
        if (!contentType || !contentType.startsWith('image/')) {
            return res.status(400).json({
                success: false,
                message: '返回的内容不是图片'
            });
        }
        
        // 设置响应头
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=86400'); // 缓存1天
        
        // 返回图片数据
        res.send(response.data);
        
        logger.info('图片代理成功', {
            imageUrl: imageUrl.substring(0, 100),
            contentType,
            size: response.data.length
        });
    } catch (error) {
        logger.error('图片代理失败', {
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).json({
            success: false,
            message: '获取图片失败: ' + error.message
        });
    }
});

/**
 * 代理获取图片 - 兼容旧的URL格式
 * @route GET /api/proxy-image/url
 * @param {string} imageUrl - 要代理的图片URL
 */
router.get('/url', async (req, res) => {
    // 设置CORS头，允许跨域访问
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // 如果是预检请求，直接返回成功
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const imageUrl = req.query.imageUrl;
        
        if (!imageUrl) {
            return res.status(400).json({
                success: false,
                message: '缺少图片URL参数'
            });
        }
        
        logger.info('接收到图片代理请求(url路径)', { imageUrl: imageUrl.substring(0, 100) });
        
        // 检查URL是否合法
        let parsedUrl;
        try {
            // 尝试解析URL，确保它是有效的
            parsedUrl = new URL(imageUrl);
            
            // 确保协议是http或https
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                return res.status(400).json({
                    success: false,
                    message: '无效的图片URL协议，仅支持HTTP和HTTPS'
                });
            }
            
            // 确保有主机名
            if (!parsedUrl.hostname) {
                return res.status(400).json({
                    success: false,
                    message: '无效的图片URL，缺少主机名'
                });
            }
            
            // 记录解析后的URL信息，便于调试
            logger.info('解析后的URL信息(url路径)', {
                protocol: parsedUrl.protocol,
                hostname: parsedUrl.hostname,
                pathname: parsedUrl.pathname,
                search: parsedUrl.search
            });
            
        } catch (urlError) {
            logger.error('URL解析失败(url路径)', { error: urlError.message, imageUrl });
            return res.status(400).json({
                success: false,
                message: '无效的图片URL格式: ' + urlError.message
            });
        }
        
        // 打印请求的URL
        logger.info('尝试获取图片', { imageUrl: imageUrl.substring(0, 100) });
        
        // 获取图片
        // 添加错误处理和重试机制
        let response;
        let retries = 0;
        const maxRetries = 3;
        
        while (retries < maxRetries) {
            try {
                // 先尝试解析域名，确保DNS解析正常
                try {
                    await resolveDomain(parsedUrl.hostname);
                } catch (dnsError) {
                    // DNS解析失败，但继续尝试请求，axios会使用系统默认DNS
                    logger.warn(`自定义DNS解析失败，将使用系统DNS: ${parsedUrl.hostname}`, { error: dnsError.message });
                }
                
                response = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'image/*'
                    },
                    // 允许自动重定向
                    maxRedirects: 5,
                    // 允许无效证书
                    httpsAgent: new https.Agent({ 
                        rejectUnauthorized: false,
                        // 启用所有TLS版本
                        secureOptions: constants.SSL_OP_NO_TLSv1_2,
                        // 增加连接超时
                        timeout: 10000
                    })
                });
                
                break; // 成功获取，退出重试循环
            } catch (fetchError) {
                retries++;
                logger.error(`获取图片失败(url路径)，第${retries}次重试`, {
                    error: fetchError.message,
                    imageUrl: imageUrl.substring(0, 100)
                });
                
                if (retries >= maxRetries) {
                    throw fetchError; // 达到最大重试次数，抛出错误
                }
                
                // 等待一段时间再重试
                await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            }
        }
        
        // 获取内容类型
        const contentType = response.headers['content-type'];
        
        // 检查是否是图片
        if (!contentType || !contentType.startsWith('image/')) {
            return res.status(400).json({
                success: false,
                message: '返回的内容不是图片'
            });
        }
        
        // 设置响应头
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=86400'); // 缓存1天
        
        // 返回图片数据
        res.send(response.data);
        
        logger.info('图片代理成功(url路径)', {
            imageUrl: imageUrl.substring(0, 100),
            contentType,
            size: response.data.length
        });
    } catch (error) {
        logger.error('图片代理失败(url路径)', {
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).json({
            success: false,
            message: '获取图片失败: ' + error.message
        });
    }
});

module.exports = router;