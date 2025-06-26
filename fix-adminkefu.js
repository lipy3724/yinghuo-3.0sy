/**
 * 管理员客服页面修复脚本
 * 
 * 问题：
 * 1. 缺少truncateText函数导致页面报错
 * 2. 客服分配系统存在问题
 * 3. 403错误：无法访问customer-message-getRetention API
 */

const fs = require('fs');
const path = require('path');

// 文件路径
const adminKefuPath = path.join(__dirname, 'public', 'adminkefu.html');

// 读取文件
console.log('读取文件:', adminKefuPath);
let content = fs.readFileSync(adminKefuPath, 'utf8');

// 1. 添加缺失的truncateText函数
console.log('添加缺失的truncateText函数...');
const truncateTextFunction = `
    // 文本截断函数
    function truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
`;

// 在文件中查找适当的位置插入函数
// 寻找一个合适的位置，例如在其他工具函数之后
const insertPosition = content.indexOf('function escapeHtml(text)');
if (insertPosition !== -1) {
    // 找到escapeHtml函数的结束位置
    const endOfEscapeHtml = content.indexOf('}', insertPosition);
    if (endOfEscapeHtml !== -1) {
        // 在escapeHtml函数后插入truncateText函数
        content = content.slice(0, endOfEscapeHtml + 1) + truncateTextFunction + content.slice(endOfEscapeHtml + 1);
        console.log('✅ 成功添加truncateText函数');
    } else {
        console.log('❌ 无法找到escapeHtml函数的结束位置');
    }
} else {
    console.log('❌ 无法找到escapeHtml函数');
    
    // 如果找不到escapeHtml函数，尝试在</script>标签前插入
    const scriptEndPosition = content.lastIndexOf('</script>');
    if (scriptEndPosition !== -1) {
        content = content.slice(0, scriptEndPosition) + truncateTextFunction + content.slice(scriptEndPosition);
        console.log('✅ 在</script>标签前添加了truncateText函数');
    } else {
        console.log('❌ 无法找到</script>标签');
    }
}

// 2. 修复客服分配系统问题
console.log('修复客服分配系统问题...');

// 检查renderUserListWithoutAssignments函数是否正确实现
const renderUserListWithoutAssignmentsPosition = content.indexOf('function renderUserListWithoutAssignments()');
if (renderUserListWithoutAssignmentsPosition !== -1) {
    console.log('✅ renderUserListWithoutAssignments函数已存在');
} else {
    console.log('❌ 缺少renderUserListWithoutAssignments函数，添加实现...');
    
    const renderUserListWithoutAssignmentsFunction = `
    // 在无法获取分配信息时渲染用户列表
    function renderUserListWithoutAssignments() {
        const userList = document.getElementById('user-list-container');
        if (!userList) return;
        
        userList.innerHTML = '';
        
        // 应用搜索过滤
        let filteredUsers = Object.values(userStats);
        
        // 应用搜索过滤
        if (searchQuery) {
            filteredUsers = filteredUsers.filter(user => 
                user.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (user.lastMessage && user.lastMessage.message.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }
        
        // 应用状态过滤器
        if (currentFilter === 'unread') {
            filteredUsers = filteredUsers.filter(user => user.unreadCount > 0);
        } else if (currentFilter === 'read') {
            filteredUsers = filteredUsers.filter(user => user.unreadCount === 0);
        }
        
        // 按最后活跃时间排序
        const sortedUsers = filteredUsers.sort((a, b) => {
            return new Date(b.lastActiveTime) - new Date(a.lastActiveTime);
        });
        
        sortedUsers.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = \`user-item \${user.userId === currentUserId ? 'active' : ''}\`;
            userItem.dataset.userId = user.userId;
            userItem.addEventListener('click', () => showUserChat(user.userId));
            
            // 获取用户名的第一个字符作为头像
            const firstChar = user.userName ? user.userName.charAt(0).toUpperCase() : '?';
            
            // 格式化时间
            const timeStr = formatTime(user.lastActiveTime);
            
            userItem.innerHTML = \`
                <div class="flex items-start">
                    <div class="user-avatar \${user.unreadCount > 0 ? 'has-unread' : ''}">
                        \${firstChar}
                    </div>
                    <div class="user-info">
                        <div class="flex items-center justify-between">
                            <div class="user-name">
                                \${escapeHtml(user.userName)}
                                \${user.unreadCount > 0 ? \`<span class="unread-badge">\${user.unreadCount}</span>\` : ''}
                            </div>
                            <div class="user-time">\${timeStr}</div>
                        </div>
                        <div class="flex items-center justify-between">
                            <div class="user-message">\${user.lastMessage ? escapeHtml(truncateText(user.lastMessage.message, 30)) : ''}</div>
                        </div>
                    </div>
                </div>
            \`;
            
            userList.appendChild(userItem);
        });
        
        // 如果没有用户，显示提示
        if (sortedUsers.length === 0) {
            userList.innerHTML = '<div class="p-4 text-center text-gray-500">暂无消息</div>';
        }
    }
    `;
    
    // 在适当的位置添加函数
    const renderUserListPosition = content.indexOf('function renderUserList()');
    if (renderUserListPosition !== -1) {
        // 找到renderUserList函数的结束位置
        let braceCount = 0;
        let endOfRenderUserList = renderUserListPosition;
        
        for (let i = renderUserListPosition; i < content.length; i++) {
            if (content[i] === '{') braceCount++;
            if (content[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                    endOfRenderUserList = i + 1;
                    break;
                }
            }
        }
        
        content = content.slice(0, endOfRenderUserList) + renderUserListWithoutAssignmentsFunction + content.slice(endOfRenderUserList);
        console.log('✅ 成功添加renderUserListWithoutAssignments函数');
    } else {
        console.log('❌ 无法找到renderUserList函数');
    }
}

// 3. 修复403错误：处理customer-message-getRetention API
console.log('修复customer-message-getRetention API访问错误...');

// 查找getRetention API调用
const getRetentionPosition = content.indexOf('/api/admin/customer-message-getRetention');
if (getRetentionPosition !== -1) {
    // 找到包含API调用的fetch语句
    const fetchStart = content.lastIndexOf('fetch(', getRetentionPosition);
    const fetchEnd = content.indexOf(')', getRetentionPosition);
    
    if (fetchStart !== -1 && fetchEnd !== -1) {
        // 提取完整的fetch调用
        const fetchCall = content.substring(fetchStart, fetchEnd + 1);
        
        // 创建一个错误处理版本的fetch调用
        const newFetchCall = fetchCall.replace(/fetch\([^)]+\)/, 
            `fetch('/api/admin/customer-message-getRetention?action=getRetention', {
                headers: {
                    'Authorization': \`Bearer \${token}\`
                }
            })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 403) {
                        console.log('没有权限获取消息保留设置，可能需要管理员权限');
                        return { success: false, retention: 30 }; // 默认30天
                    }
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .catch(error => {
                console.error('获取消息保留设置失败:', error);
                return { success: false, retention: 30 }; // 默认30天
            })`
        );
        
        // 替换原来的fetch调用
        content = content.replace(fetchCall, newFetchCall);
        console.log('✅ 成功修改getRetention API调用，添加了错误处理');
    } else {
        console.log('❌ 无法找到完整的fetch调用');
    }
} else {
    console.log('❌ 无法找到getRetention API调用');
}

// 保存修改后的文件
fs.writeFileSync(adminKefuPath, content, 'utf8');
console.log('✅ 修复完成，已保存修改到文件');
console.log('请刷新客服管理页面以应用更改'); 