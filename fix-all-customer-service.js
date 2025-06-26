/**
 * 全面客服系统API请求认证修复脚本
 * 
 * 问题：客服系统相关组件在发送和获取消息时没有添加认证头，导致401错误
 * 解决方案：修改所有相关文件，在API请求中添加Authorization头
 */

const fs = require('fs');
const path = require('path');

// 需要修复的文件列表
const filesToFix = [
  path.join(__dirname, 'components', 'components.js'),
  path.join(__dirname, 'components', 'customer-service.html'),
  path.join(__dirname, 'components', 'customer-service-simple.html'),
  path.join(__dirname, 'components', 'customer-service-ultra-simple.html')
];

// 处理每个文件
filesToFix.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`❌ 文件不存在: ${filePath}`);
    return;
  }
  
  console.log(`🔍 处理文件: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content; // 保存原始内容以检测是否有变化
  
  // 修复发送消息请求 - POST
  content = content.replace(
    /fetch\('\/api\/kefu\/messages',\s*{[\s\n]*method:\s*'POST',[\s\n]*headers:\s*{[\s\n]*'Content-Type':\s*'application\/json'[\s\n]*},/g,
    `fetch('/api/kefu/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${localStorage.getItem('authToken')}\`
        },`
  );
  
  // 修复获取消息请求 - GET (简单版本)
  content = content.replace(
    /fetch\('\/api\/kefu\/messages\?userId='\s*\+\s*parseInt\(userId\)\)/g,
    `fetch('/api/kefu/messages?userId=' + parseInt(userId), {
        headers: {
            'Authorization': \`Bearer \${localStorage.getItem('authToken')}\`
        }
    })`
  );
  
  // 修复获取消息请求 - GET (URL变量版本)
  content = content.replace(
    /fetch\(url\)/g,
    `fetch(url, {
        headers: {
            'Authorization': \`Bearer \${localStorage.getItem('authToken')}\`
        }
    })`
  );
  
  // 在用户端添加获取token的函数
  if (content !== originalContent) {
    // 只在文件被修改时添加
    if (!content.includes('function getAuthToken()')) {
      const tokenFunction = `
// 获取认证token
function getAuthToken() {
    // 优先获取authToken，这是普通用户使用的key
    let token = localStorage.getItem('authToken');
    
    // 如果没有，尝试获取admin_token，这是管理员使用的key
    if (!token) {
        token = localStorage.getItem('admin_token');
    }
    
    return token;
}
`;
      
      // 在</script>标签前插入函数
      if (content.includes('</script>')) {
        content = content.replace('</script>', tokenFunction + '</script>');
      }
      
      // 然后更新所有token获取代码，使用新函数
      content = content.replace(/localStorage\.getItem\('authToken'\)/g, 'getAuthToken()');
    }
  }
  
  // 保存修改
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 已修复文件: ${filePath}`);
  } else {
    console.log(`ℹ️ 文件无需修改: ${filePath}`);
  }
});

console.log('✅ 全面修复完成!');
console.log('请刷新页面以应用更改。'); 