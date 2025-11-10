/**
 * 历史任务结果视频迁移到自有OSS脚本
 *
 * 功能：
 * - 扫描已完成(status=completed)的“视频去标志/去水印”任务
 * - 对那些 resultVideoUrl 非自有OSS桶的记录，尝试从原URL拉取并上传到自有OSS
 * - 上传成功后回写任务的 resultVideoUrl 为自有OSS的永久地址
 *
 * 运行方式：
 *   node scripts/migrateVideoLogoRemovalResultsToOSS.js [--dry-run] [--limit=100] [--userId=123] [--taskId=xxxx] [--batchSize=50]
 *
 * 建议先使用 --dry-run 观察将被处理的任务数量和样本，然后再正式迁移。
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Op } = require('sequelize');
const { VideoLogoRemovalTask } = require('../models/VideoLogoRemovalTask');
const VideoLogoRemovalService = require('../services/videoLogoRemovalService');
const { uploadVideoFromUrlToOSS } = require('../utils/ossUtils');
const { generateSafeOSSPath } = require('../utils/fileNameUtils');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    limit: 200,
    batchSize: 50,
    userId: null,
    taskId: null
  };
  for (const arg of args) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--limit=')) options.limit = parseInt(arg.split('=')[1], 10) || options.limit;
    else if (arg.startsWith('--batchSize=')) options.batchSize = parseInt(arg.split('=')[1], 10) || options.batchSize;
    else if (arg.startsWith('--userId=')) options.userId = arg.split('=')[1];
    else if (arg.startsWith('--taskId=')) options.taskId = arg.split('=')[1];
  }
  return options;
}

function getOwnOssMatchers() {
  const bucket = process.env.OSS_BUCKET || '';
  const region = process.env.OSS_REGION || '';
  const endpoints = [];
  if (bucket && region) {
    const normalizedRegion = region.startsWith('oss-') ? region : `oss-${region}`;
    endpoints.push(`${bucket}.${normalizedRegion}.aliyuncs.com`);
  }
  if (process.env.OSS_CNAME) {
    endpoints.push(process.env.OSS_CNAME.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  }
  return endpoints.filter(Boolean);
}

function isInOwnBucket(url, matchers) {
  if (!url) return false;
  try {
    const host = new URL(url).host;
    return matchers.some(m => host.includes(m));
  } catch {
    // 非法URL，按不在自有桶处理
    return false;
  }
}

async function findCandidateTasks(limit, userId, taskId, ownMatchers) {
  const where = {
    status: 'completed',
    resultVideoUrl: { [Op.ne]: null }
  };
  if (userId) where.userId = userId;
  if (taskId) where.taskId = taskId;

  // 先拉取一批，再在内存中过滤非自有桶
  const tasks = await VideoLogoRemovalTask.findAll({
    where,
    order: [['updatedAt', 'DESC']],
    limit
  });
  return tasks.filter(t => !isInOwnBucket(t.resultVideoUrl, ownMatchers));
}

async function migrateOneTask(task, ownMatchers, dryRun) {
  const safeOriginal = task.originalFileName || 'video.mp4';
  const outputKey = generateSafeOSSPath(task.userId, task.taskId, safeOriginal, '_output');

  console.log(`开始迁移: taskId=${task.taskId}, userId=${task.userId}`);
  console.log(`源URL: ${task.resultVideoUrl}`);
  console.log(`目标OSS Key: ${outputKey}`);

  if (dryRun) {
    console.log('DRY-RUN: 跳过实际上传与数据库更新');
    return { migrated: false, dryRun: true };
  }

  try {
    const res = await uploadVideoFromUrlToOSS(task.resultVideoUrl, outputKey);
    console.log('上传成功:', res);

    // 回写任务的结果URL为自有OSS永久地址
    await VideoLogoRemovalService.updateTaskStatus(task.taskId, 'completed', {
      resultVideoUrl: res.url,
      videoDuration: task.videoDuration
    });

    console.log(`已更新任务 ${task.taskId} 的 resultVideoUrl 为自有OSS地址`);
    return { migrated: true, url: res.url };
  } catch (err) {
    console.error(`迁移失败: taskId=${task.taskId}`, err.message);
    return { migrated: false, error: err };
  }
}

async function main() {
  const { dryRun, limit, batchSize, userId, taskId } = parseArgs();
  const ownMatchers = getOwnOssMatchers();
  if (ownMatchers.length === 0) {
    console.error('未检测到有效的自有OSS域名，请配置 OSS_BUCKET 与 OSS_REGION，或设置 OSS_CNAME');
    process.exit(1);
  }
  console.log('自有OSS域名匹配列表:', ownMatchers);
  console.log(`参数: dryRun=${dryRun}, limit=${limit}, batchSize=${batchSize}, userId=${userId || '-'}, taskId=${taskId || '-'}`);

  const candidates = await findCandidateTasks(limit, userId, taskId, ownMatchers);
  console.log(`共发现需迁移的候选任务: ${candidates.length} 条`);
  if (candidates.length === 0) {
    console.log('没有需要迁移的任务，退出。');
    process.exit(0);
  }

  let success = 0;
  let failed = 0;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    console.log(`处理批次 ${i / batchSize + 1}: ${batch.length} 条`);

    // 并发度：控制在 5-10 以内，避免占满出口带宽
    const concurrency = 6;
    for (let j = 0; j < batch.length; j += concurrency) {
      const group = batch.slice(j, j + concurrency);
      const results = await Promise.all(group.map(t => migrateOneTask(t, ownMatchers, dryRun)));
      results.forEach(r => {
        if (r.migrated) success += 1;
        else if (!r.dryRun) failed += 1;
      });
    }
  }

  console.log('迁移完成：', { success, failed, dryRun });
  process.exit(0);
}

main().catch(err => {
  console.error('脚本异常退出:', err);
  process.exit(1);
});


