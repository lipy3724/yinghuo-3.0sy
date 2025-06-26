/**
 * 客服分配系统修复脚本
 * 
 * 问题：
 * 1. 客服管理页面无法正常分配客服
 * 2. 权限验证问题导致403错误
 * 3. API路径不一致
 */

const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
require('dotenv').config();

// 连接数据库
console.log('连接数据库...');
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  logging: false
});

// 测试数据库连接
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    return false;
  }
}

// 修复客服分配记录
async function fixCustomerAssignments() {
  try {
    // 检查是否有未分配的用户消息
    const [unassignedUsers] = await sequelize.query(`
      SELECT DISTINCT cm.userId 
      FROM customer_messages cm
      LEFT JOIN customer_assignments ca ON cm.userId = ca.userId AND ca.status = 'active'
      WHERE ca.id IS NULL
    `);
    
    console.log(`发现 ${unassignedUsers.length} 个未分配客服的用户`);
    
    if (unassignedUsers.length === 0) {
      console.log('✅ 没有需要修复的客服分配');
      return;
    }
    
    // 获取所有客服人员
    const [customerServices] = await sequelize.query(`
      SELECT id, username FROM users WHERE isCustomerService = true OR isAdmin = true
    `);
    
    if (customerServices.length === 0) {
      console.error('❌ 没有可用的客服人员');
      return;
    }
    
    console.log(`找到 ${customerServices.length} 个可用的客服人员`);
    
    // 为每个未分配的用户分配客服
    let assignmentCount = 0;
    for (const user of unassignedUsers) {
      // 简单的轮询分配算法
      const customerService = customerServices[assignmentCount % customerServices.length];
      
      // 创建分配记录
      await sequelize.query(`
        INSERT INTO customer_assignments 
        (userId, adminId, status, assignmentMethod, assignedAt, lastActiveAt, notes, createdAt, updatedAt)
        VALUES (?, ?, 'active', 'auto', NOW(), NOW(), '通过修复脚本自动分配', NOW(), NOW())
      `, {
        replacements: [user.userId, customerService.id]
      });
      
      console.log(`✅ 用户 ${user.userId} 已分配给客服 ${customerService.username} (ID: ${customerService.id})`);
      assignmentCount++;
    }
    
    console.log(`✅ 成功为 ${assignmentCount} 个用户分配了客服`);
  } catch (error) {
    console.error('❌ 修复客服分配失败:', error);
  }
}

// 修复adminkefu.html文件中的问题
function fixAdminKefuHtml() {
  const adminKefuPath = path.join(__dirname, 'public', 'adminkefu.html');
  
  console.log('读取文件:', adminKefuPath);
  if (!fs.existsSync(adminKefuPath)) {
    console.error('❌ 文件不存在:', adminKefuPath);
    return;
  }
  
  let content = fs.readFileSync(adminKefuPath, 'utf8');
  let modified = false;
  
  // 1. 添加缺失的truncateText函数
  console.log('检查truncateText函数...');
  if (!content.includes('function truncateText')) {
    console.log('添加缺失的truncateText函数');
    const truncateTextFunction = `
    // 文本截断函数
    function truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
`;
    
    // 在escapeHtml函数后插入
    const insertPosition = content.indexOf('function escapeHtml');
    if (insertPosition !== -1) {
      const endOfEscapeHtml = content.indexOf('}', insertPosition);
      if (endOfEscapeHtml !== -1) {
        content = content.slice(0, endOfEscapeHtml + 1) + truncateTextFunction + content.slice(endOfEscapeHtml + 1);
        modified = true;
        console.log('✅ 添加了truncateText函数');
      }
    }
  } else {
    console.log('✅ truncateText函数已存在');
  }
  
  // 2. 修复getRetention API调用
  console.log('检查getRetention API调用...');
  const getRetentionPosition = content.indexOf('/api/admin/customer-message-getRetention');
  if (getRetentionPosition !== -1) {
    // 找到包含API调用的fetch语句
    const fetchStart = content.lastIndexOf('fetch(', getRetentionPosition);
    const fetchEnd = content.indexOf(')', getRetentionPosition);
    
    if (fetchStart !== -1 && fetchEnd !== -1) {
      const fetchCall = content.substring(fetchStart, fetchEnd + 1);
      
      // 检查是否已经添加了Authorization头
      if (!fetchCall.includes('Authorization')) {
        // 创建一个带有Authorization头的fetch调用
        const newFetchCall = `fetch('/api/admin/customer-message-getRetention?action=getRetention', {
            headers: {
                'Authorization': \`Bearer \${token}\`
            }
        })`;
        
        content = content.replace(fetchCall, newFetchCall);
        modified = true;
        console.log('✅ 修复了getRetention API调用，添加了Authorization头');
      }
    }
  }
  
  // 3. 确保所有API调用都有正确的Authorization头
  console.log('检查所有API调用的Authorization头...');
  const apiCalls = [
    { pattern: /fetch\(['"]\/api\/kefu\/messages[^{]*{(?![^}]*Authorization)/g, replacement: `fetch('/api/kefu/messages', {\n            headers: {\n                'Authorization': \`Bearer \${token}\`\n            },` },
    { pattern: /fetch\(['"]\/api\/admin\/[^{]*{(?![^}]*Authorization)/g, replacement: `fetch('/api/admin/', {\n            headers: {\n                'Authorization': \`Bearer \${token}\`\n            },` }
  ];
  
  apiCalls.forEach(({ pattern, replacement }) => {
    if (content.match(pattern)) {
      content = content.replace(pattern, replacement);
      modified = true;
      console.log('✅ 修复了API调用，添加了Authorization头');
    }
  });
  
  // 保存修改后的文件
  if (modified) {
    fs.writeFileSync(adminKefuPath, content, 'utf8');
    console.log('✅ 保存了修改后的adminkefu.html文件');
  } else {
    console.log('ℹ️ adminkefu.html文件无需修改');
  }
}

// 主函数
async function main() {
  console.log('🔧 开始修复客服分配系统...');
  
  // 1. 测试数据库连接
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('❌ 无法连接到数据库，修复终止');
    return;
  }
  
  // 2. 修复adminkefu.html文件
  fixAdminKefuHtml();
  
  // 3. 修复客服分配记录
  await fixCustomerAssignments();
  
  console.log('✅ 客服分配系统修复完成');
  console.log('请重启服务器并刷新客服管理页面以应用更改');
}

// 执行主函数
main().catch(error => {
  console.error('❌ 修复过程中出错:', error);
}).finally(() => {
  // 关闭数据库连接
  sequelize.close();
}); 