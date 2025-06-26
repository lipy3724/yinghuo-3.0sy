/**
 * 客服系统前端API请求认证修复脚本
 * 
 * 问题：adminkefu.html中的API请求没有添加Authorization头，导致401错误
 * 解决方案：修改public/adminkefu.html文件，在所有fetch请求中添加Authorization头
 */

const fs = require('fs');
const path = require('path');

// 文件路径
const adminKefuPath = path.join(__dirname, 'public', 'adminkefu.html');

// 读取文件
console.log('读取文件:', adminKefuPath);
let content = fs.readFileSync(adminKefuPath, 'utf8');

// 修复loadMessages函数 - 添加Authorization头
console.log('修复loadMessages函数...');
content = content.replace(
  `const response = await fetch(url);`,
  `const token = localStorage.getItem('admin_token');
                if (!token) {
                    showError('未登录或会话已过期，请重新登录');
                    return;
                }
                
                const response = await fetch(url, {
                    headers: {
                        'Authorization': \`Bearer \${token}\`
                    }
                });`
);

// 修复checkForNewMessages函数 - 添加Authorization头
console.log('修复checkForNewMessages函数...');
content = content.replace(
  `const response = await fetch(url);`,
  `const token = localStorage.getItem('admin_token');
                if (!token) {
                    console.log('未登录或会话已过期，无法检查新消息');
                    return;
                }
                
                const response = await fetch(url, {
                    headers: {
                        'Authorization': \`Bearer \${token}\`
                    }
                });`
);

// 保存修改后的文件
console.log('保存修改后的文件...');
fs.writeFileSync(adminKefuPath, content, 'utf8');

console.log('✅ 修复完成!');
console.log('请刷新客服管理后台页面并重新登录以应用更改。'); 