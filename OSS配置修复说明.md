# 智能扩图OSS上传问题修复说明

## 问题描述

在智能扩图功能中，点击"立即扩图"按钮后出现以下错误：
- 错误信息：`处理失败: 图片上传失败: OSS上传文件失败: getaddrinfo ENOTFOUND yinghuo-ai.oss-cn-cn-shanghai.aliyuncs.com, PUT https://yinghuo-ai.oss-cn-cn-shanghai.aliyuncs.com/images/1757986475255-1757986475247-836032389.jpg -1`
- 控制台显示连接错误：`(connected: false, keepalive socket: false, agent status: {"createSocketCount":1,"createSocketErrorCount":0,"closeSocketCount":0,"errorSocketCount":0,"timeoutSocketCount":0,"requestCount":0,"freeSockets":0,"sockets":0,"requests":0})`

## 问题原因分析

1. **OSS Endpoint配置错误**：
   - OSS客户端配置中的Endpoint格式错误，导致DNS解析失败
   - 错误的Endpoint格式：`yinghuo-ai.oss-cn-cn-shanghai.aliyuncs.com`（注意多了一个`cn-`）
   - 正确的Endpoint格式应为：`yinghuo-ai.oss-cn-shanghai.aliyuncs.com`

2. **动态构建Endpoint导致错误**：
   - 原代码中通过环境变量`OSS_REGION`动态构建Endpoint
   - 当`OSS_REGION`值为`cn-shanghai`时，代码会错误地构建为`oss-cn-cn-shanghai`
   - 这是因为代码中先检查`OSS_REGION`是否以`oss-`开头，如果不是则添加，但环境变量中已经包含了`cn-`前缀

## 解决方案

1. **硬编码OSS配置**：
   - 直接在代码中使用正确的区域和存储桶名称，不再依赖环境变量
   - 使用完整的Endpoint地址，避免动态构建导致的错误

2. **修改OSS客户端配置**：
   ```javascript
   const client = new OSS({
       region: 'oss-cn-shanghai',  // 直接使用硬编码的区域
       accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
       accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
       bucket: 'yinghuo-ai',  // 直接使用硬编码的存储桶名称
       secure: true,
       timeout: parseInt(process.env.OSS_TIMEOUT || '60000'),
       cname: true,  // 启用自定义域名
       endpoint: 'yinghuo-ai.oss-cn-shanghai.aliyuncs.com'  // 直接使用完整的endpoint
   });
   ```

3. **修改URL构建逻辑**：
   - 修改手动构建OSS URL的代码，使用正确的域名格式
   - 修改从URL中提取对象名的代码，使用正确的域名匹配

## 修改详情

1. **修改OSS客户端配置**：
   - 将动态构建的Endpoint替换为硬编码的正确Endpoint
   - 启用`cname`选项，以支持自定义域名

2. **修改URL构建逻辑**：
   - 将动态构建的URL替换为使用硬编码的正确域名
   - 修改URL解析逻辑，确保能正确从URL中提取对象名

## 测试验证

1. 重启服务器
2. 访问智能扩图功能页面
3. 上传图片并点击"立即扩图"按钮
4. 验证图片是否成功上传到OSS并生成扩图结果

## 注意事项

1. 此修复方案采用硬编码配置，如果OSS存储桶或区域发生变化，需要相应更新代码
2. 如果需要支持多个OSS存储桶或区域，建议重构代码，使用更灵活的配置方式
3. 建议后续优化环境变量处理逻辑，避免类似问题再次发生
