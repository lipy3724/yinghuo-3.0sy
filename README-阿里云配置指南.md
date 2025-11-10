# 萤火AI平台阿里云配置指南

## 阿里云OSS配置

为了正确配置阿里云OSS存储，请按照以下步骤操作：

### 1. 创建阿里云RAM用户并获取AccessKey

1. 登录阿里云控制台：https://home.console.aliyun.com/
2. 进入"访问控制"→"用户"→"创建用户"
3. 勾选"编程访问"，创建后保存AccessKeyId和AccessKeySecret
4. 为该用户添加权限："AliyunOSSFullAccess"

### 2. 创建OSS Bucket

1. 进入"对象存储OSS"→"Bucket列表"→"创建Bucket"
2. 输入Bucket名称(如"yinghuo-ai")
3. 选择区域(如"华东2(上海)")
4. 存储类型选"标准存储"
5. 读写权限选"公共读"
6. 其他选项保持默认，点击"确定"创建

### 3. 更新.env文件

将创建的AccessKey和Bucket信息填入.env文件：

```
OSS_REGION=oss-cn-shanghai  # 替换为你的Bucket所在区域
OSS_BUCKET=yinghuo-ai       # 替换为你的Bucket名称
ALIYUN_ACCESS_KEY_ID=your_access_key_id           # 替换为你的AccessKeyId
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret   # 替换为你的AccessKeySecret
OSS_SECURE=true
OSS_TIMEOUT=60000
```

### 4. 验证OSS连接

运行以下命令测试OSS连接是否正常：

```
node test-oss-connection.js
```

### 常见问题

#### OSS连接失败

如果遇到OSS连接失败，请检查：

1. AccessKey是否正确
2. Bucket名称是否正确
3. 区域配置是否与Bucket实际所在区域一致
4. RAM用户是否有足够的权限
5. 网络连接是否正常

#### 错误信息解析

1. "The OSS Access Key Id you provided does not exist in our records"
   - 原因：AccessKey不存在或已失效
   - 解决方案：重新创建RAM用户和AccessKey

2. "The bucket you are attempting to access must be addressed using the specified endpoint"
   - 原因：Bucket所在区域与配置的区域不匹配
   - 解决方案：确认Bucket实际所在区域，修改OSS_REGION配置

3. "AccessDenied"
   - 原因：RAM用户没有足够权限
   - 解决方案：为RAM用户添加AliyunOSSFullAccess权限

## 阿里云DashScope API配置

如果您需要使用阿里云DashScope API（如通义千问等模型），请按照以下步骤配置：

### 1. 获取DashScope API密钥

1. 登录阿里云控制台：https://dashscope.console.aliyun.com/
2. 点击"API密钥管理"
3. 创建新的API密钥或使用现有密钥
4. 复制API密钥值

### 2. 更新.env文件

将DashScope API密钥添加到.env文件：

```
DASHSCOPE_API_KEY=your_dashscope_api_key  # 替换为你的DashScope API密钥
```

### 3. 验证DashScope API连接

您可以创建一个简单的测试脚本来验证API连接：

```javascript
require('dotenv').config();
const axios = require('axios');

async function testDashScopeAPI() {
  try {
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        model: 'qwen-turbo',
        input: {
          prompt: '你好，请介绍一下自己'
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`
        }
      }
    );
    
    console.log('API连接成功：', response.data);
  } catch (error) {
    console.error('API连接失败：', error.message);
    if (error.response) {
      console.error('错误详情：', error.response.data);
    }
  }
}

testDashScopeAPI();
```

保存为`test-dashscope-api.js`并运行：

```
node test-dashscope-api.js
```
