require('dotenv').config(); // 确保环境变量被加载
const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);

console.log('OSS配置：', {
    region: process.env.OSS_REGION,
    bucket: process.env.OSS_BUCKET,
    secure: process.env.OSS_SECURE === 'true',
    endpoint: process.env.OSS_REGION ? `${process.env.OSS_REGION.startsWith('oss-') ? process.env.OSS_REGION : 'oss-' + process.env.OSS_REGION}.aliyuncs.com` : 'oss-cn-shanghai.aliyuncs.com',
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID ? process.env.ALIYUN_ACCESS_KEY_ID.substring(0, 5) + '...' : undefined
});

// 检查OSS配置是否有效
if (!process.env.OSS_REGION || !process.env.ALIYUN_ACCESS_KEY_ID || 
    !process.env.ALIYUN_ACCESS_KEY_SECRET || !process.env.OSS_BUCKET) {
    console.error('警告: OSS配置不完整，图片上传功能可能无法正常工作');
}

// 创建OSS客户端
const client = new OSS({
    region: process.env.OSS_REGION || 'oss-cn-shanghai',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET || 'yinghuo-ai',
    secure: process.env.OSS_SECURE === 'true' || true,
    timeout: parseInt(process.env.OSS_TIMEOUT || '60000'),
    // 修复OSS配置，不使用cname模式
    cname: false,
    endpoint: process.env.OSS_ENDPOINT || 'oss-cn-shanghai.aliyuncs.com'
});

/**
 * 上传本地文件到OSS并返回公网可访问的URL
 * @param {string} localFilePath - 本地文件路径
 * @param {string} ossPath - OSS上的存储路径 (如: 'uploads/images/')
 * @returns {Promise<string>} - 返回公网可访问的URL
 */
const uploadFile = async (localFilePath, ossPath = 'uploads/') => {
    try {
        // 确保环境变量已加载
        require('dotenv').config();
        
        // 检查OSS配置是否完整
        if (!process.env.OSS_REGION || !process.env.ALIYUN_ACCESS_KEY_ID || 
            !process.env.ALIYUN_ACCESS_KEY_SECRET || !process.env.OSS_BUCKET) {
            console.error('OSS配置不完整，请检查环境变量');
            throw new Error('OSS配置不完整，请检查环境变量');
        }
        
        // 检查文件是否存在
        if (!fs.existsSync(localFilePath)) {
            throw new Error(`文件不存在: ${localFilePath}`);
        }

        // 处理文件名，避免中文或特殊字符问题
        const fileName = path.basename(localFilePath);
        const ossFileName = `${Date.now()}-${fileName}`;
        const ossFilePath = path.join(ossPath, ossFileName).replace(/\\/g, '/');
        
        console.log(`开始上传文件到OSS: ${localFilePath} -> ${ossFilePath}`);
        
        // 上传文件到OSS，设置正确的Content-Type和访问权限
        console.log('使用OSS客户端配置:', {
            region: client.options.region,
            bucket: client.options.bucket,
            endpoint: client.options.endpoint,
            secure: client.options.secure
        });
        
        // 设置上传选项，确保图片可以直接访问而不是强制下载
        const uploadOptions = {
            headers: {
                'Content-Type': 'image/jpeg', // 设置正确的Content-Type
                'Cache-Control': 'public, max-age=31536000', // 设置缓存
            },
            // 不设置Content-Disposition，避免强制下载
        };
        
        const result = await client.put(ossFilePath, localFilePath, uploadOptions);
        
        if (!result.url) {
            // 如果没有直接返回URL，构建标准OSS URL
            const url = `https://${client.options.bucket}.${client.options.endpoint}/${ossFilePath}`;
            console.log('手动构建OSS URL:', url);
            
            // 清理本地临时文件
            try {
                await unlinkAsync(localFilePath);
                console.log(`已删除本地临时文件: ${localFilePath}`);
            } catch (unlinkError) {
                console.error(`删除本地临时文件失败: ${localFilePath}`, unlinkError);
            }
            
            return url;
        }
        
        // 清理本地临时文件
        try {
            await unlinkAsync(localFilePath);
            console.log(`已删除本地临时文件: ${localFilePath}`);
        } catch (unlinkError) {
            console.error(`删除本地临时文件失败: ${localFilePath}`, unlinkError);
            // 继续处理，不影响主流程
        }
        
        console.log('文件上传成功，URL:', result.url);
        return result.url;
    } catch (error) {
        console.error('OSS上传文件失败:', error);
        throw new Error(`OSS上传文件失败: ${error.message}`);
    }
};

/**
 * 从OSS URL生成带签名的临时访问URL
 * @param {string} ossUrl - 阿里云OSS对象的URL
 * @param {number} expirationInMinutes - 链接有效期(分钟)，默认15分钟
 * @returns {Promise<string>} - 返回带签名的临时URL
 */
const generateSignedUrl = async (ossUrl, expirationInMinutes = 15) => {
    try {
        // 检查参数
        if (!ossUrl) {
            throw new Error('OSS URL不能为空');
        }
        
        // 检查是否是DashScope结果URL
        if (ossUrl.includes('dashscope-result-sh.oss-cn-shanghai.aliyuncs.com') ||
            ossUrl.includes('OSSAccessKeyId=') && ossUrl.includes('Signature=')) {
            console.log('检测到DashScope结果URL，直接返回原始URL:', ossUrl.substring(0, 100) + '...');
            return ossUrl; // 直接返回原始URL，不做处理
        }

        // 从OSS URL中提取对象名
        let objectName = '';
        
        // 处理标准OSS URL
        if (ossUrl.includes('yinghuo-ai.oss-cn-shanghai.aliyuncs.com')) {
            // 例如: https://yinghuo-ai.oss-cn-shanghai.aliyuncs.com/path/to/object.mp4
            const domainPattern = 'yinghuo-ai.oss-cn-shanghai.aliyuncs.com/';
            const urlParts = ossUrl.split(domainPattern);
            if (urlParts.length > 1) {
                objectName = urlParts[1].split('?')[0]; // 移除URL参数
            }
        }
        // 处理标准OSS URL (新格式)
        else if (ossUrl.includes('.aliyuncs.com')) {
            // 从URL中提取bucket和路径
            const match = ossUrl.match(/https:\/\/([^.]+)\.([^/]+)\/(.+)/);
            if (match && match.length >= 4) {
                objectName = match[3].split('?')[0]; // 移除URL参数
            }
        } 
        // 处理自定义域名
        else {
            // 尝试从URL路径中提取对象名
            const urlObj = new URL(ossUrl);
            objectName = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
        }
        
        if (!objectName) {
            console.error('无法从URL中提取对象名:', ossUrl);
            throw new Error('无法从URL中提取对象名');
        }
        
        console.log(`从URL提取的对象名: ${objectName}`);

        // 计算URL过期时间(毫秒)
        const expirationMs = expirationInMinutes * 60 * 1000;
        
        // 使用阿里云OSS SDK生成签名URL
        const signedUrl = client.signatureUrl(objectName, {
            expires: expirationMs / 1000, // SDK要求以秒为单位
            method: 'GET', // 指定HTTP方法
            // 移除response-content-disposition，让图片可以直接显示而不是强制下载
        });
        
        console.log(`已生成签名URL，有效期${expirationInMinutes}分钟:`, signedUrl.substring(0, 100) + '...');
        return signedUrl;
    } catch (error) {
        console.error('生成签名URL失败:', error);
        throw new Error(`生成签名URL失败: ${error.message}`);
    }
};

module.exports = {
    client,
    uploadFile,
    generateSignedUrl
}; 