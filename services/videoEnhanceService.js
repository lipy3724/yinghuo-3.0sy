const OpenApi = require('@alicloud/openapi-client');
const videoenhan20200320 = require('@alicloud/videoenhan20200320');
const Util = require('@alicloud/tea-util');

/**
 * 创建阿里云视频增强客户端
 */
function createVideoEnhanceClient() {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  
  if (!accessKeyId || !accessKeySecret) {
    throw new Error('缺少阿里云API密钥配置');
  }
  
  let config = new OpenApi.Config({
    accessKeyId: accessKeyId,
    accessKeySecret: accessKeySecret,
    connectTimeout: 60000,
    readTimeout: 60000,
  });
  
  // 使用视频增强服务的上海区域端点
  config.endpoint = 'videoenhan.cn-shanghai.aliyuncs.com';
  return new videoenhan20200320.default(config);
}

/**
 * 查询视频增强任务状态
 * @param {string} requestId - 阿里云API返回的requestId
 * @returns {Promise<Object>} 任务状态信息
 */
async function queryVideoEnhanceTaskStatus(requestId) {
  try {
    console.log(`查询阿里云视频增强任务状态: requestId=${requestId}`);
    
    const client = createVideoEnhanceClient();
    
    // 创建查询请求
    const getAsyncJobResultRequest = new videoenhan20200320.GetAsyncJobResultRequest({
      jobId: requestId
    });
    
    // 设置运行时选项
    const runtime = new Util.RuntimeOptions({
      connectTimeout: 30000,
      readTimeout: 30000,
      timeout: 30000
    });
    
    // 调用查询API
    const response = await client.getAsyncJobResultWithOptions(getAsyncJobResultRequest, runtime);
    
    console.log(`阿里云任务状态查询响应: ${JSON.stringify(response.body, null, 2)}`);
    
    if (response && response.body) {
      // 修复：阿里云API返回的数据结构是 response.body.data，而不是 response.body.data
      const responseData = response.body.data || response.body.Data;
      const status = responseData?.Status || responseData?.status || 'Processing';
      
      // 解析result字段中的JSON数据
      let videoUrl = null;
      let progress = 0;
      
      if ((responseData?.result || responseData?.Result) && (status === 'PROCESS_SUCCESS' || status === 'SUCCEEDED')) {
        try {
          const resultString = responseData.result || responseData.Result;
          let resultData;
          
          if (typeof resultString === 'string') {
            resultData = JSON.parse(resultString);
          } else {
            resultData = resultString;
          }
          
          // 尝试多种可能的字段名获取视频URL
          videoUrl = resultData.VideoUrl || resultData.videoUrl || resultData.video_url || resultData.url || null;
          progress = 100; // 成功完成时进度为100%
          
          console.log('成功解析视频URL:', videoUrl);
        } catch (parseError) {
          console.error('解析阿里云API result字段失败:', parseError);
          console.log('原始result数据:', responseData.result || responseData.Result);
        }
      } else if (status === 'PROCESS_FAILED' || status === 'FAILED') {
        progress = 0;
      } else if (status === 'PROCESS_RUNNING' || status === 'RUNNING') {
        progress = 50;
      }
      
      return {
        success: true,
        data: {
          Status: status,
          Message: response.body.message || response.body.Message || (status === 'PROCESS_SUCCESS' || status === 'SUCCEEDED' ? '任务处理完成' : '任务处理中'),
          VideoUrl: videoUrl,
          Progress: progress,
          // 添加原始数据以便调试
          _rawData: responseData
        }
      };
    } else {
      return {
        success: false,
        message: '查询响应格式不正确'
      };
    }
    
  } catch (error) {
    console.error('查询视频增强任务状态失败:', error);
    
    // 如果是任务不存在或其他API错误，返回处理中状态
    if (error.code === 'InvalidParameter.JobNotExist' || error.message?.includes('not exist')) {
      return {
        success: true,
        data: {
          Status: 'Processing',
          Message: '任务处理中，请稍后查询',
          VideoUrl: null,
          Progress: 20
        }
      };
    }
    
    return {
      success: false,
      message: error.message || '查询任务状态失败',
      error: error
    };
  }
}

module.exports = {
  createVideoEnhanceClient,
  queryVideoEnhanceTaskStatus
};
