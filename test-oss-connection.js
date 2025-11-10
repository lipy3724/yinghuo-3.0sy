require('dotenv').config();
const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');

async function testOSSConnection() {
  console.log('=== 阿里云OSS配置检查 ===');
  
  // 检查环境变量是否已配置
  const requiredEnvVars = [
    'OSS_REGION', 
    'OSS_BUCKET', 
    'ALIYUN_ACCESS_KEY_ID', 
    'ALIYUN_ACCESS_KEY_SECRET'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`错误: 以下必要的环境变量未配置: ${missingVars.join(', ')}`);
    console.error('请在.env文件中设置这些变量');
    return;
  }
  
  console.log('OSS_REGION:', process.env.OSS_REGION);
  console.log('OSS_BUCKET:', process.env.OSS_BUCKET);
  console.log('ALIYUN_ACCESS_KEY_ID:', process.env.ALIYUN_ACCESS_KEY_ID ? '已配置' : '未配置');
  console.log('ALIYUN_ACCESS_KEY_SECRET:', process.env.ALIYUN_ACCESS_KEY_SECRET ? '已配置' : '未配置');
  console.log();
  
  // 创建OSS客户端
  const client = new OSS({
    region: process.env.OSS_REGION,
    bucket: process.env.OSS_BUCKET,
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
    secure: process.env.OSS_SECURE === 'true',
    timeout: process.env.OSS_TIMEOUT ? parseInt(process.env.OSS_TIMEOUT) : 60000
  });
  
  try {
    console.log('=== OSS连接测试 ===');
    console.log('正在连接OSS...');
    
    // 测试1: 列出Bucket
    console.log('测试1: 列出Bucket中的文件');
    const listResult = await client.list({
      'max-keys': 10,
    });
    console.log(`成功! 找到${listResult.objects ? listResult.objects.length : 0}个文件`);
    
    // 测试2: 上传测试文件
    console.log('\n测试2: 上传测试文件');
    const testFileName = 'oss-test-' + Date.now() + '.txt';
    const testContent = '这是一个OSS连接测试文件，创建于 ' + new Date().toISOString();
    
    // 创建临时文件
    const tempFilePath = path.join(__dirname, testFileName);
    fs.writeFileSync(tempFilePath, testContent);
    
    // 上传到OSS
    const uploadResult = await client.put(testFileName, tempFilePath);
    console.log('上传成功!');
    console.log('文件URL:', uploadResult.url);
    
    // 删除临时文件
    fs.unlinkSync(tempFilePath);
    
    // 测试3: 下载测试文件
    console.log('\n测试3: 下载测试文件');
    const downloadResult = await client.get(testFileName);
    const downloadContent = downloadResult.content.toString();
    console.log('下载成功!');
    console.log('文件内容:', downloadContent);
    
    // 测试4: 删除测试文件
    console.log('\n测试4: 删除测试文件');
    await client.delete(testFileName);
    console.log('删除成功!');
    
    console.log('\n=== 测试结果 ===');
    console.log('所有测试通过! OSS配置正确，连接正常。');
    
  } catch (error) {
    console.error('\n=== 测试失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误代码:', error.code);
    console.error('请求ID:', error.requestId);
    console.error('OSS主机:', error.host);
    
    // 提供常见错误的解决方案
    if (error.code === 'AccessDeniedError') {
      console.error('\n可能的解决方案:');
      console.error('1. 检查AccessKey是否正确');
      console.error('2. 确认RAM用户是否有足够的权限');
      console.error('3. 确认Bucket权限设置');
    } else if (error.code === 'NoSuchBucket') {
      console.error('\n可能的解决方案:');
      console.error('1. 确认Bucket名称是否正确');
      console.error('2. 确认Bucket是否在指定的区域中');
    } else if (error.code === 'ConnectionTimeoutError') {
      console.error('\n可能的解决方案:');
      console.error('1. 检查网络连接');
      console.error('2. 确认区域设置是否正确');
    }
  }
}

testOSSConnection();
