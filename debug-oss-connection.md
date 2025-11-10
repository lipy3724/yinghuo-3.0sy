# OSS连接问题调试指南

## 问题描述

在图像高清放大功能中，上传图片到OSS时出现以下错误：
```
错误：图像处理请求失败: getaddrinfo ENOTFOUND yinghuo-ai.oss-cn-cn-shanghai.aliyuncs.com
```

## 问题原因分析

1. **域名错误**：OSS域名格式不正确，`oss-cn-cn-shanghai.aliyuncs.com`中包含了重复的`cn-`前缀
2. **连接配置问题**：OSS客户端配置可能存在问题
3. **网络连接问题**：可能存在网络连接或DNS解析问题

## 解决方案

### 1. 修正OSS域名和配置

已对OSS客户端配置进行了以下修改：

```javascript
const ossClient = new OSS({
  region: 'oss-cn-shanghai', // 正确的区域名称
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  bucket: 'yinghuo-ai',
  secure: true,
  timeout: parseInt(process.env.OSS_TIMEOUT || '60000'),
  cname: false, // 不使用自定义域名
  internal: false, // 使用公网地址
  endpoint: 'oss-cn-shanghai.aliyuncs.com' // 使用标准阿里云OSS endpoint
});
```

主要修改点：
- 添加`internal: false`配置，确保使用公网地址
- 确保endpoint使用标准格式`oss-cn-shanghai.aliyuncs.com`

### 2. 增强错误处理和诊断

为了更好地诊断OSS连接问题，增加了以下功能：

1. **OSS连接测试**：在上传前先测试OSS连接
   ```javascript
   try {
     await ossClient.list({ 'max-keys': 1 });
     console.log('OSS连接测试成功');
   } catch (testError) {
     console.error('OSS连接测试失败:', testError);
     // 继续尝试上传，不阻止主流程
   }
   ```

2. **详细的错误日志**：记录更多OSS错误信息
   ```javascript
   console.error('OSS错误详情:', error.code, error.message, error.requestId);
   console.error('OSS错误堆栈:', error.stack);
   ```

3. **特定错误类型处理**：根据不同的错误类型提供更具体的错误信息
   ```javascript
   if (error.name === 'ConnectionTimeoutError') {
     throw new Error(`OSS连接超时: ${error.message}`);
   } else if (error.code === 'InvalidAccessKeyId') {
     throw new Error('OSS访问密钥无效，请检查配置');
   }
   // ...其他错误类型处理
   ```

4. **URL构造备选方案**：当OSS返回的URL为空时，手动构造URL
   ```javascript
   if (!result.url) {
     const protocol = ossClient.options.secure ? 'https://' : 'http://';
     const endpoint = ossClient.options.endpoint;
     const bucket = ossClient.options.bucket;
     const constructedUrl = `${protocol}${bucket}.${endpoint}/${ossPath}`;
     return constructedUrl;
   }
   ```

## 验证步骤

1. 检查服务器日志，确认OSS连接测试结果
2. 验证上传图片是否成功，检查返回的URL格式是否正确
3. 如果仍然出现连接问题，检查以下方面：
   - 环境变量中的OSS配置是否正确
   - 服务器网络连接是否正常
   - 阿里云OSS服务是否可用

## 其他建议

1. **配置监控**：添加OSS连接状态监控
2. **备选存储方案**：考虑添加本地临时存储作为备选
3. **重试机制**：对于临时性连接问题，可以添加重试逻辑
4. **配置验证**：在应用启动时验证OSS配置的正确性
