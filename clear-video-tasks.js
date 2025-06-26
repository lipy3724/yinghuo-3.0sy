/**
 * 清理视频任务记录脚本
 * 用于重置视频任务状态，以便下次测试时能正确扣除积分
 */

// 初始化全局变量
if (!global.textToVideoTasks) {
    global.textToVideoTasks = {};
}

if (!global.imageToVideoTasks) {
    global.imageToVideoTasks = {};
}

if (!global.multiImageToVideoTasks) {
    global.multiImageToVideoTasks = {};
}

// 清理现有记录
console.log(`清理前文生视频任务数量: ${Object.keys(global.textToVideoTasks).length}`);
console.log(`清理前图生视频任务数量: ${Object.keys(global.imageToVideoTasks).length}`);
console.log(`清理前多图转视频任务数量: ${Object.keys(global.multiImageToVideoTasks).length}`);

// 重置为空对象
global.textToVideoTasks = {};
global.imageToVideoTasks = {};
global.multiImageToVideoTasks = {};

console.log('所有视频任务记录已清理完毕');
console.log(`清理后文生视频任务数量: ${Object.keys(global.textToVideoTasks).length}`);
console.log(`清理后图生视频任务数量: ${Object.keys(global.imageToVideoTasks).length}`);
console.log(`清理后多图转视频任务数量: ${Object.keys(global.multiImageToVideoTasks).length}`);

console.log('请重启服务器以应用修改'); 