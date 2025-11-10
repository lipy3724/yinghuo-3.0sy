# OSS配置说明

## 配置方式

阿里云OSS配置可以通过以下两种方式设置：

### 1. 环境变量

在服务器上设置以下环境变量：

```bash
# OSS标准配置
OSS_REGION=oss-cn-beijing
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket_name
OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com

# 兼容旧版配置
ALIYUN_ACCESS_KEY_ID=your_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret
```

### 2. .env文件

在项目根目录创建`.env`文件，内容如下：

```
# OSS配置
OSS_REGION=oss-cn-beijing
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket_name
OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com

# 兼容旧版配置
ALIYUN_ACCESS_KEY_ID=your_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret
```

## 配置优先级

1. 系统优先使用`OSS_ACCESS_KEY_ID`和`OSS_ACCESS_KEY_SECRET`
2. 如果上述配置不存在，则使用`ALIYUN_ACCESS_KEY_ID`和`ALIYUN_ACCESS_KEY_SECRET`
3. 如果两者都不存在，在开发环境下会使用默认测试配置

## 故障排除

如果遇到以下错误：

```
保存历史记录失败: require accessKeyId, accessKeySecret
```

请检查：

1. 是否正确设置了环境变量或.env文件
2. 环境变量名称是否正确（注意大小写）
3. 环境变量值是否正确（不包含多余空格等）

## 开发环境配置

在开发环境中，如果没有设置OSS配置，系统会使用默认测试配置：

```javascript
const defaultRegion = 'oss-cn-beijing';
const defaultBucket = 'test-bucket';
const defaultAccessKeyId = 'test-access-key-id';
const defaultAccessKeySecret = 'test-access-key-secret';
```

这些配置仅用于开发测试，不能用于生产环境。

## 验证配置

可以使用以下命令验证OSS配置是否正确：

```bash
node test-oss-config.js
```

如果配置正确，会显示"OSS客户端初始化成功"。
