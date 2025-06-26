/**
 * 用户端客服系统API请求认证修复脚本
 * 
 * 问题：用户端客服组件在发送和获取消息时没有添加认证头，导致401错误
 * 解决方案：修改components.js文件，在所有客服API请求中添加Authorization头
 */

const fs = require('fs');
const path = require('path');

// 文件路径
const componentsJsPath = path.join(__dirname, 'components', 'components.js');

// 读取文件
console.log('读取文件:', componentsJsPath);
let content = fs.readFileSync(componentsJsPath, 'utf8');

// 修复sendToServer函数 - 添加Authorization头
console.log('修复sendToServer函数...');
content = content.replace(
  `fetch('/api/kefu/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },`,
  `fetch('/api/kefu/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${localStorage.getItem('authToken')}\`
        },`
);

// 修复loadMessages函数 - 添加Authorization头
console.log('修复loadMessages函数...');
content = content.replace(
  `fetch('/api/kefu/messages?userId=' + parseInt(userId))`,
  `fetch('/api/kefu/messages?userId=' + parseInt(userId), {
        headers: {
            'Authorization': \`Bearer \${localStorage.getItem('authToken')}\`
        }
    })`
);

// 修复checkForNewMessages函数 - 添加Authorization头
console.log('修复checkForNewMessages函数...');
content = content.replace(
  `fetch(url)`,
  `fetch(url, {
        headers: {
            'Authorization': \`Bearer \${localStorage.getItem('authToken')}\`
        }
    })`
);

// 保存修改后的文件
console.log('保存修改后的文件...');
fs.writeFileSync(componentsJsPath, content, 'utf8');

console.log('✅ 修复完成!');
console.log('请刷新页面以应用更改。'); 