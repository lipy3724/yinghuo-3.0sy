const Core = require('@alicloud/pop-core');

async function checkAliyunTask() {
    try {
        const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
        const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
        
        if (!accessKeyId || !accessKeySecret) {
            console.log('❌ 阿里云访问密钥未配置');
            return;
        }
        
        console.log('✅ 阿里云访问密钥已配置');
        console.log('访问密钥ID:', accessKeyId.substring(0, 10) + '...');
        
        // 创建POP Core客户端
        const client = new Core({
            accessKeyId: accessKeyId,
            accessKeySecret: accessKeySecret,
            endpoint: 'https://videoenhan.cn-shanghai.aliyuncs.com',
            apiVersion: '2020-03-20'
        });
        
        // 查询任务状态
        const jobId = 'F5A696A4-C8ED-51DD-8F14-4A956D4589AC';
        console.log('🔍 查询任务状态，JobId:', jobId);
        
        const response = await client.request('GetAsyncJobResult', {
            JobId: jobId
        }, {
            method: 'POST'
        });
        
        console.log('📋 阿里云API响应:', JSON.stringify(response, null, 2));
        
        if (response && response.Data) {
            const jobData = response.Data;
            console.log('📊 任务数据详情:', JSON.stringify(jobData, null, 2));
            
            if (jobData.Result) {
                console.log('🎬 结果数据:', JSON.stringify(jobData.Result, null, 2));
            }
        }
        
    } catch (error) {
        console.error('❌ 查询失败:', error.message);
        if (error.response) {
            console.error('📋 错误响应:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

checkAliyunTask();
