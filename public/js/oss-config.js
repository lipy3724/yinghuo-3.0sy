/**
 * 阿里云OSS配置文件
 * 用于文生图片功能，将生成的图片保存到阿里云OSS
 */

// OSS配置信息
const ossConfig = {
    region: 'oss-cn-shanghai', // OSS区域，根据实际情况修改
    bucket: 'yinghuo-ai', // 存储桶名称，根据实际情况修改
    directory: 'text-to-image/', // 存储目录，以斜杠结尾
    accessKeyId: '', // 请在服务端设置，不要在前端暴露
    accessKeySecret: '', // 请在服务端设置，不要在前端暴露
    stsTokenEndpoint: '/api/oss/sts-token', // 获取临时凭证的API端点
    callbackUrl: '/api/oss/callback', // 上传回调URL
    proxyImageEndpoint: '/api/proxy-image', // 图片代理API端点
};

/**
 * 获取OSS上传参数
 * @returns {Promise<Object>} 包含上传所需参数的对象
 */
async function getOSSUploadParams() {
    try {
        // 获取认证token
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            throw new Error('未登录，无法获取OSS上传参数');
        }
        
        // 从服务器获取STS临时凭证
        const response = await fetch(ossConfig.stsTokenEndpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`获取STS Token失败: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success || !data.credentials) {
            throw new Error(data.message || '获取STS Token失败');
        }
        
        return {
            accessKeyId: data.credentials.AccessKeyId,
            accessKeySecret: data.credentials.AccessKeySecret,
            securityToken: data.credentials.SecurityToken,
            expiration: data.credentials.Expiration,
            policy: data.policy,
            signature: data.signature,
            region: ossConfig.region,
            bucket: ossConfig.bucket,
            directory: ossConfig.directory
        };
    } catch (error) {
        console.error('获取OSS上传参数失败:', error);
        throw error;
    }
}

/**
 * 生成OSS对象名称
 * @param {string} prefix 前缀
 * @returns {string} OSS对象名称
 */
function generateOSSObjectName(prefix = 'img') {
    const timestamp = new Date().getTime();
    const randomStr = Math.random().toString(36).substring(2, 10);
    return `${ossConfig.directory}${prefix}-${timestamp}-${randomStr}.png`;
}

/**
 * 将Base64图片上传到OSS
 * @param {string} base64Image Base64编码的图片数据
 * @param {string} description 图片描述
 * @returns {Promise<Object>} 上传结果
 */
async function uploadBase64ImageToOSS(base64Image, description = '') {
    try {
        console.log('开始上传图片到OSS...');
        
        // 移除Base64前缀
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        // 转换Base64为Blob
        const blob = base64ToBlob(base64Data);
        
        // 获取OSS上传参数
        const ossParams = await getOSSUploadParams();
        
        // 生成OSS对象名称
        const objectName = generateOSSObjectName('text-to-image');
        
        // 创建FormData
        const formData = new FormData();
        formData.append('key', objectName);
        formData.append('OSSAccessKeyId', ossParams.accessKeyId);
        
        // 检查policy和signature是否存在
        if (!ossParams.policy || !ossParams.signature) {
            console.error('OSS上传参数缺失policy或signature，尝试生成');
            
            // 如果后端没有返回policy和signature，则在前端生成
            if (ossParams.accessKeySecret) {
                const policyText = {
                    expiration: ossParams.expiration,
                    conditions: [
                        ['content-length-range', 0, 10485760], // 10MB
                        ['starts-with', '$key', ossConfig.directory]
                    ]
                };
                
                ossParams.policy = btoa(JSON.stringify(policyText));
                
                // 使用CryptoJS计算签名
                if (window.CryptoJS) {
                    const hmac = CryptoJS.HmacSHA1(ossParams.policy, ossParams.accessKeySecret);
                    ossParams.signature = hmac.toString(CryptoJS.enc.Base64);
                } else {
                    console.error('缺少CryptoJS库，无法生成签名');
                }
            }
        }
        
        formData.append('policy', ossParams.policy);
        formData.append('signature', ossParams.signature);
        formData.append('success_action_status', '200');
        if (ossParams.securityToken) {
            formData.append('x-oss-security-token', ossParams.securityToken);
        }
        
        // 添加自定义元数据
        formData.append('x-oss-meta-description', description);
        formData.append('x-oss-meta-source', 'text-to-image');
        formData.append('x-oss-meta-timestamp', new Date().toISOString());
        
        // 添加文件
        formData.append('file', blob);
        
        // 上传到OSS
        const uploadUrl = `https://${ossParams.bucket}.${ossParams.region}.aliyuncs.com`;
        const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            body: formData
        });
        
        if (!uploadResponse.ok) {
            throw new Error(`上传失败: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }
        
        // 构建完整的图片URL
        const imageUrl = `https://${ossParams.bucket}.${ossParams.region}.aliyuncs.com/${objectName}`;
        
        console.log('图片上传成功:', imageUrl);
        
        return {
            success: true,
            imageUrl: imageUrl,
            objectName: objectName
        };
    } catch (error) {
        console.error('上传图片到OSS失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 将URL图片上传到OSS
 * @param {string} imageUrl 图片URL
 * @param {string} description 图片描述
 * @returns {Promise<Object>} 上传结果
 */
async function uploadImageUrlToOSS(imageUrl, description = '') {
    try {
        console.log('开始从URL上传图片到OSS...');
        
        // 判断是否需要使用代理
        let fetchUrl = imageUrl;
        const needsProxy = !imageUrl.startsWith('blob:') && 
                          !imageUrl.startsWith('data:') && 
                          !imageUrl.startsWith(window.location.origin) &&
                          !imageUrl.includes(ossConfig.bucket);
        
        if (needsProxy) {
            console.log('使用代理获取图片...');
            // 确保URL参数正确编码，并且不包含多余的斜杠
            // 检查URL是否有效
            if (!imageUrl || typeof imageUrl !== 'string') {
                throw new Error('无效的图片URL');
            }
            
            // 确保URL是完整的，包含http或https前缀
            let urlToEncode = imageUrl;
            if (!urlToEncode.startsWith('http://') && !urlToEncode.startsWith('https://')) {
                urlToEncode = 'https://' + urlToEncode;
            }
            
            try {
                // 尝试解析URL，确保它是有效的
                const parsedUrl = new URL(urlToEncode);
                console.log('URL解析成功:', {
                    protocol: parsedUrl.protocol,
                    hostname: parsedUrl.hostname,
                    pathname: parsedUrl.pathname.substring(0, 30) + (parsedUrl.pathname.length > 30 ? '...' : '')
                });
                
                // 检查域名是否可解析（仅作为日志记录，不影响流程）
                try {
                    const dnsPromise = new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Error('DNS解析超时'));
                        }, 3000);
                        
                        window.fetch(`/api/proxy-image/dns-check?hostname=${encodeURIComponent(parsedUrl.hostname)}`)
                            .then(response => {
                                clearTimeout(timeout);
                                if (response.ok) {
                                    return response.json();
                                } else {
                                    throw new Error('DNS检查API返回错误');
                                }
                            })
                            .then(data => {
                                console.log('域名解析结果:', data);
                                resolve(data);
                            })
                            .catch(err => {
                                console.warn('域名解析检查失败:', err);
                                resolve(null); // 即使失败也继续流程
                            });
                    });
                    
                    // 设置超时，不阻塞主流程
                    setTimeout(() => {
                        dnsPromise.catch(err => console.warn('DNS检查超时:', err));
                    }, 100);
                } catch (dnsError) {
                    console.warn('DNS检查错误:', dnsError);
                    // 继续流程，不中断
                }
            } catch (urlError) {
                console.error('URL解析失败:', urlError);
                throw new Error('无效的图片URL格式: ' + urlError.message);
            }
            
            // 使用encodeURIComponent确保URL中的特殊字符被正确编码
            const encodedUrl = encodeURIComponent(urlToEncode);
            fetchUrl = `${ossConfig.proxyImageEndpoint}?url=${encodedUrl}`;
            console.log('代理URL:', fetchUrl);
        } else {
            console.log('直接获取图片数据...');
        }
        
        console.log('开始获取图片数据，URL:', fetchUrl);
        const response = await fetch(fetchUrl, {
            mode: 'cors',
            credentials: 'omit', // 不发送凭证
            headers: {
                'Accept': 'image/*'
            }
        });
        
        if (!response.ok) {
            console.error('获取图片失败:', response.status, response.statusText);
            // 尝试读取错误响应内容
            try {
                const errorText = await response.text();
                console.error('错误详情:', errorText.substring(0, 200));
            } catch (e) {
                console.error('无法读取错误详情');
            }
            throw new Error(`获取图片失败: ${response.status} ${response.statusText}`);
        }
        
        console.log('图片获取成功，准备上传到OSS');
        
        const blob = await response.blob();
        
        // 获取OSS上传参数
        const ossParams = await getOSSUploadParams();
        
        // 生成OSS对象名称
        const objectName = generateOSSObjectName('text-to-image');
        
        // 创建FormData
        const formData = new FormData();
        formData.append('key', objectName);
        formData.append('OSSAccessKeyId', ossParams.accessKeyId);
        
        // 检查policy和signature是否存在
        if (!ossParams.policy || !ossParams.signature) {
            console.error('OSS上传参数缺失policy或signature，尝试生成');
            
            // 如果后端没有返回policy和signature，则在前端生成
            if (ossParams.accessKeySecret) {
                const policyText = {
                    expiration: ossParams.expiration,
                    conditions: [
                        ['content-length-range', 0, 10485760], // 10MB
                        ['starts-with', '$key', ossConfig.directory]
                    ]
                };
                
                ossParams.policy = btoa(JSON.stringify(policyText));
                
                // 使用CryptoJS计算签名
                if (window.CryptoJS) {
                    const hmac = CryptoJS.HmacSHA1(ossParams.policy, ossParams.accessKeySecret);
                    ossParams.signature = hmac.toString(CryptoJS.enc.Base64);
                } else {
                    console.error('缺少CryptoJS库，无法生成签名');
                }
            }
        }
        
        formData.append('policy', ossParams.policy);
        formData.append('signature', ossParams.signature);
        formData.append('success_action_status', '200');
        if (ossParams.securityToken) {
            formData.append('x-oss-security-token', ossParams.securityToken);
        }
        
        // 添加自定义元数据
        formData.append('x-oss-meta-description', description);
        formData.append('x-oss-meta-source', 'text-to-image');
        formData.append('x-oss-meta-original-url', imageUrl);
        formData.append('x-oss-meta-timestamp', new Date().toISOString());
        
        // 添加文件
        formData.append('file', blob);
        
        // 上传到OSS
        const uploadUrl = `https://${ossParams.bucket}.${ossParams.region}.aliyuncs.com`;
        console.log('OSS上传URL:', uploadUrl);
        console.log('OSS上传参数:', {
            bucket: ossParams.bucket,
            region: ossParams.region,
            objectName: objectName,
            hasSecurityToken: !!ossParams.securityToken
        });
        
        try {
            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                body: formData,
                mode: 'cors',
                credentials: 'omit', // 不发送凭证
                headers: {
                    'Origin': window.location.origin
                }
            });
            
            if (!uploadResponse.ok) {
                console.error('OSS上传响应错误:', uploadResponse.status, uploadResponse.statusText);
                // 尝试读取错误响应
                try {
                    const errorText = await uploadResponse.text();
                    console.error('OSS上传错误详情:', errorText.substring(0, 200));
                } catch (e) {
                    console.error('无法读取OSS上传错误详情');
                }
                throw new Error(`上传失败: ${uploadResponse.status} ${uploadResponse.statusText}`);
            }
            
            console.log('OSS上传成功');
            
            // 构建完整的图片URL
            const ossImageUrl = `https://${ossParams.bucket}.${ossParams.region}.aliyuncs.com/${objectName}`;
            
            console.log('图片URL上传成功:', ossImageUrl);
            
            return {
                success: true,
                imageUrl: ossImageUrl,
                objectName: objectName,
                originalUrl: imageUrl
            };
        } catch (error) {
            console.error('OSS上传过程中出错:', error);
            throw error;
        }
    } catch (error) {
        console.error('从URL上传图片到OSS失败:', error);
        return {
            success: false,
            error: error.message,
            originalUrl: imageUrl
        };
    } finally {
        console.log('图片上传流程完成');
    }
}

/**
 * Base64转Blob
 * @param {string} base64 Base64字符串
 * @returns {Blob} Blob对象
 */
function base64ToBlob(base64) {
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([ab], { type: 'image/png' });
}

// 导出函数
window.ossUtils = {
    uploadBase64ImageToOSS,
    uploadImageUrlToOSS,
    getOSSUploadParams,
    generateOSSObjectName
};
