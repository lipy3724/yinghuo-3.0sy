/**
 * 阿里云短信服务工具
 * 用于发送短信验证码
 */
const Dysmsapi20170525 = require('@alicloud/dysmsapi20170525');
const OpenApi = require('@alicloud/openapi-client');
const Util = require('@alicloud/tea-util');
const Credential = require('@alicloud/credentials');

// 阿里云短信服务配置
const SMS_CONFIG = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID, // 从环境变量获取AccessKey ID
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET, // 从环境变量获取AccessKey Secret
  endpoint: 'dysmsapi.aliyuncs.com', // 短信服务的API端点
  signName: process.env.ALIYUN_SMS_SIGN_NAME, // 短信签名名称
  templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE // 短信模板CODE
};

/**
 * 创建阿里云短信客户端
 * @returns {Promise<Dysmsapi20170525>} 短信客户端实例
 */
async function createClient() {
  const accessKeyId = SMS_CONFIG.accessKeyId;
  const accessKeySecret = SMS_CONFIG.accessKeySecret;
  
  const config = new OpenApi.Config({
    // 您的AccessKey ID
    accessKeyId: accessKeyId,
    // 您的AccessKey Secret
    accessKeySecret: accessKeySecret,
  });
  
  // 访问的域名
  config.endpoint = SMS_CONFIG.endpoint;
  
  return new Dysmsapi20170525.default(config);
}

/**
 * 发送短信验证码
 * @param {string} phoneNumber 手机号码
 * @param {string} code 验证码
 * @returns {Promise<Object>} 发送结果
 */
async function sendSmsCode(phoneNumber, code) {
  try {
    console.log('准备发送短信验证码:', {
      phoneNumber,
      code,
      signName: SMS_CONFIG.signName,
      templateCode: SMS_CONFIG.templateCode
    });

    // 检查配置是否完整
    if (!SMS_CONFIG.accessKeyId || !SMS_CONFIG.accessKeySecret || !SMS_CONFIG.signName || !SMS_CONFIG.templateCode) {
      console.error('SMS配置不完整:', {
        accessKeyId: SMS_CONFIG.accessKeyId ? '已设置' : '未设置',
        accessKeySecret: SMS_CONFIG.accessKeySecret ? '已设置' : '未设置',
        signName: SMS_CONFIG.signName,
        templateCode: SMS_CONFIG.templateCode
      });
      return {
        success: false,
        message: 'SMS配置不完整，请检查环境变量'
      };
    }

    // 创建客户端
    const client = await createClient();
    
    // 创建请求
    const sendSmsRequest = new Dysmsapi20170525.SendSmsRequest({
      phoneNumbers: phoneNumber,
      signName: SMS_CONFIG.signName,
      templateCode: SMS_CONFIG.templateCode,
      templateParam: JSON.stringify({ code })
    });
    
    // 运行时选项
    const runtime = new Util.RuntimeOptions({});
    
    console.log('发送短信请求参数:', {
      phoneNumbers: phoneNumber,
      signName: SMS_CONFIG.signName,
      templateCode: SMS_CONFIG.templateCode,
      templateParam: JSON.stringify({ code })
    });
    
    // 发送短信
    const response = await client.sendSmsWithOptions(sendSmsRequest, runtime);
    
    console.log('阿里云短信发送结果:', response.body);
    
    // 处理阿里云返回的错误信息
    let message = response.body.message;
    
    // 如果不是成功状态，检查是否需要转换错误信息
    if (response.body.code !== 'OK') {
      // 检查是否是频繁操作错误
      if (message && (
        message.includes('触发分钟级流控') || 
        message.includes('触发小时级流控') ||
        message.includes('触发天级流控') ||
        message.includes('Permits:') ||
        message.includes('流控') ||
        message.includes('频繁') ||
        message.includes('限流')
      )) {
        message = '禁止频繁操作，请稍后重试';
      }
      // 检查其他常见错误
      else if (message && message.includes('签名不合法')) {
        message = '短信服务配置错误，请联系客服';
      }
      else if (message && message.includes('模板不存在')) {
        message = '短信模板配置错误，请联系客服';
      }
      else if (message && message.includes('余额不足')) {
        message = '短信服务余额不足，请联系客服';
      }
    }
    
    // 返回发送结果
    return {
      success: response.body.code === 'OK',
      message: message,
      requestId: response.body.requestId,
      bizId: response.body.bizId
    };
  } catch (error) {
    console.error('发送短信验证码失败:', error);
    
    // 更详细的错误信息
    if (error.data) {
      console.error('错误详情:', error.data);
    }
    
    // 处理特定的阿里云错误
    let userFriendlyMessage = error.message || '发送短信验证码失败';
    
    // 检查是否是频繁操作错误
    if (error.message && (
      error.message.includes('触发分钟级流控') || 
      error.message.includes('触发小时级流控') ||
      error.message.includes('触发天级流控') ||
      error.message.includes('Permits:') ||
      error.message.includes('流控') ||
      error.message.includes('频繁') ||
      error.message.includes('限流')
    )) {
      userFriendlyMessage = '禁止频繁操作，请稍后重试';
    }
    // 检查是否是其他常见错误
    else if (error.message && error.message.includes('签名不合法')) {
      userFriendlyMessage = '短信服务配置错误，请联系客服';
    }
    else if (error.message && error.message.includes('模板不存在')) {
      userFriendlyMessage = '短信模板配置错误，请联系客服';
    }
    else if (error.message && error.message.includes('余额不足')) {
      userFriendlyMessage = '短信服务余额不足，请联系客服';
    }
    
    return {
      success: false,
      message: userFriendlyMessage,
      error: error
    };
  }
}

module.exports = {
  sendSmsCode
}; 