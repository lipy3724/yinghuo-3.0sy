const axios = require('axios');
const path = require('path');
const oss = require('./ossClient');
require('dotenv').config();

/**
 * 将远程 URL 文件上传到自己的 OSS Bucket
 * @param {string} remoteUrl - http/https 远程文件链接
 * @param {string} [folder] - OSS 目标文件夹
 * @returns {Promise<string>} https 自定义域名访问地址
 */
async function uploadFromUrl(remoteUrl, folder = 'cloth-segmentation') {
  if (!remoteUrl) throw new Error('remoteUrl is empty');
  // 去掉查询串中的签名、保留文件名
  const cleanName = path.basename(remoteUrl.split('?')[0]);
  const objectKey = `${folder}/${Date.now()}-${cleanName}`;

  const resp = await axios.get(remoteUrl, { responseType: 'stream' });
  await oss.putStream(objectKey, resp.data, {
    headers: {
      'Content-Type': resp.headers['content-type'] || 'application/octet-stream'
    }
  });

  // 自定义域名，需在 .env 中配置 OSS_CUSTOM_DOMAIN=https://static.yinghuo.ai
  const domain = process.env.OSS_CUSTOM_DOMAIN || '';
  return domain ? `${domain}/${objectKey}` : `https://${oss.options.bucket}.${oss.options.region}.aliyuncs.com/${objectKey}`;
}

module.exports = uploadFromUrl; 