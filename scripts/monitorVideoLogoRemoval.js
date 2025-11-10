/**
 * 视频去标志功能监控脚本
 * 通过API获取状态信息，提供实时监控
 */

const axios = require('axios');

class VideoLogoRemovalMonitor {
    constructor(options = {}) {
        this.isRunning = false;
        this.intervalId = null;
        this.checkInterval = options.checkInterval || 30000; // 30秒检查一次
        this.apiBaseUrl = options.apiBaseUrl || 'http://localhost:3000/api/video-logo-removal-status';
        this.timeout = options.timeout || 10000; // 10秒超时
    }

    /**
     * 启动监控
     */
    start() {
        if (this.isRunning) {
            console.log('📊 监控已在运行中');
            return;
        }

        console.log('🚀 启动视频去标志功能监控...');
        console.log(`🔗 API地址: ${this.apiBaseUrl}`);
        this.isRunning = true;
        
        // 立即执行一次检查
        this.performCheck();
        
        // 设置定时检查
        this.intervalId = setInterval(() => {
            this.performCheck();
        }, this.checkInterval);
        
        console.log(`✅ 监控已启动，检查间隔: ${this.checkInterval / 1000}秒`);
    }

    /**
     * 停止监控
     */
    stop() {
        if (!this.isRunning) {
            console.log('📊 监控未运行');
            return;
        }

        console.log('🛑 停止视频去标志功能监控...');
        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        console.log('✅ 监控已停止');
    }

    /**
     * 执行检查
     */
    async performCheck() {
        try {
            console.log('\n' + '='.repeat(60));
            console.log(`📊 视频去标志功能状态检查 - ${new Date().toLocaleString()}`);
            console.log('='.repeat(60));

            // 获取完整状态
            const status = await this.getStatus();
            
            if (!status) {
                console.error('❌ 无法获取状态信息');
                return;
            }
            
            // 显示各项状态
            this.displayDatabaseStatus(status.database);
            this.displayJobsStatus(status.jobs);
            this.displayTasksStatus(status.tasks);
            this.displayErrorsStatus(status.errors);
            
            // 健康检查
            this.performHealthCheck(status);
            
            console.log('='.repeat(60));
            console.log('✅ 状态检查完成\n');
            
        } catch (error) {
            console.error('❌ 监控检查失败:', error.message);
        }
    }

    /**
     * 获取状态信息
     */
    async getStatus() {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/status`, {
                timeout: this.timeout
            });
            
            if (response.data.success) {
                return response.data.data;
            } else {
                throw new Error(response.data.error || '获取状态失败');
            }
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                console.error('❌ 无法连接到API服务器，请确保服务器正在运行');
            } else if (error.code === 'ETIMEDOUT') {
                console.error('❌ API请求超时');
            } else {
                console.error('❌ API请求失败:', error.message);
            }
            return null;
        }
    }

    /**
     * 显示数据库状态
     */
    displayDatabaseStatus(database) {
        console.log('💾 数据库状态:');
        if (database.connected) {
            console.log('   ✅ 数据库连接正常');
        } else {
            console.log('   ❌ 数据库连接失败:', database.message);
        }
    }

    /**
     * 显示定时任务状态
     */
    displayJobsStatus(jobs) {
        console.log('📋 定时任务状态:');
        if (jobs.error) {
            console.log('   ❌ 获取任务状态失败:', jobs.error);
            return;
        }
        
        console.log(`   - 运行状态: ${jobs.isRunning ? '✅ 运行中' : '❌ 已停止'}`);
        console.log(`   - 重试任务: ${jobs.retryJob ? '✅ 活跃' : '⏸️ 未运行'}`);
        console.log(`   - 清理任务: ${jobs.cleanupJob ? '✅ 活跃' : '⏸️ 未运行'}`);
        console.log(`   - 同步任务: ${jobs.syncJob ? '✅ 活跃' : '⏸️ 未运行'}`);
        console.log(`   - 统计任务: ${jobs.statsJob ? '✅ 活跃' : '⏸️ 未运行'}`);
        console.log(`   - 任务数量: ${jobs.jobCount || 0}`);
        
        if (jobs.jobs && jobs.jobs.length > 0) {
            console.log('   - 活跃任务:');
            jobs.jobs.forEach(job => {
                console.log(`     * ${job.name}: ${job.status}`);
            });
        }
    }

    /**
     * 显示任务统计
     */
    displayTasksStatus(tasks) {
        console.log('📈 任务统计:');
        if (tasks.error) {
            console.log('   ❌ 获取任务统计失败:', tasks.error);
            return;
        }
        
        // 按状态显示统计
        if (tasks.byStatus) {
            Object.entries(tasks.byStatus).forEach(([status, count]) => {
                const statusIcon = this.getStatusIcon(status);
                console.log(`   - ${statusIcon} ${status}: ${count}个`);
            });
        }
        
        console.log(`   - 📊 总计: ${tasks.total || 0}个任务`);
        
        // 最近任务
        if (tasks.recent && tasks.recent.length > 0) {
            console.log('📋 最近任务:');
            tasks.recent.forEach(task => {
                const time = new Date(task.createdAt).toLocaleString();
                const statusIcon = this.getStatusIcon(task.status);
                console.log(`   - ${statusIcon} ${task.taskId}: ${task.status} (${time}) 重试:${task.retryCount}`);
                if (task.message) {
                    console.log(`     💬 ${task.message}`);
                }
            });
        }
    }

    /**
     * 显示错误统计
     */
    displayErrorsStatus(errors) {
        console.log('⚠️ 错误统计:');
        if (errors.error) {
            console.log('   ❌ 获取错误统计失败:', errors.error);
            return;
        }
        
        console.log(`   - 失败任务总数: ${errors.failed || 0}`);
        console.log(`   - 重试任务总数: ${errors.retry || 0}`);
        console.log(`   - 24小时内错误: ${errors.recent24h || 0}`);
    }

    /**
     * 健康检查
     */
    performHealthCheck(status) {
        const warnings = [];
        
        // 数据库检查
        if (!status.database.connected) {
            warnings.push('数据库连接异常');
        }
        
        // 定时任务检查
        if (!status.jobs.isRunning) {
            warnings.push('定时任务未运行');
        }
        
        // 错误率检查
        if (status.errors.failed > 10) {
            warnings.push('失败任务数量过多');
        }
        
        if (status.errors.recent24h > 5) {
            warnings.push('24小时内错误频繁');
        }
        
        // 显示警告
        if (warnings.length > 0) {
            console.log('🚨 健康检查警告:');
            warnings.forEach(warning => {
                console.log(`   ⚠️ ${warning}`);
            });
        } else {
            console.log('✅ 系统健康状态良好');
        }
    }

    /**
     * 获取状态图标
     */
    getStatusIcon(status) {
        const icons = {
            'pending': '⏳',
            'processing': '🔄',
            'completed': '✅',
            'failed': '❌',
            'cancelled': '⏹️'
        };
        return icons[status] || '❓';
    }

    /**
     * 手动触发重试
     */
    async triggerRetry() {
        try {
            console.log('🔄 触发任务重试...');
            const response = await axios.post(`${this.apiBaseUrl}/retry`, {}, {
                timeout: this.timeout
            });
            
            if (response.data.success) {
                console.log('✅ 重试任务已触发');
            } else {
                console.error('❌ 触发重试失败:', response.data.error);
            }
        } catch (error) {
            console.error('❌ 触发重试请求失败:', error.message);
        }
    }

    /**
     * 手动触发清理
     */
    async triggerCleanup() {
        try {
            console.log('🧹 触发清理任务...');
            const response = await axios.post(`${this.apiBaseUrl}/cleanup`, {}, {
                timeout: this.timeout
            });
            
            if (response.data.success) {
                console.log('✅ 清理任务已触发');
            } else {
                console.error('❌ 触发清理失败:', response.data.error);
            }
        } catch (error) {
            console.error('❌ 触发清理请求失败:', error.message);
        }
    }

    /**
     * 获取任务详情
     */
    async getTaskDetails(taskId) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/tasks/${taskId}`, {
                timeout: this.timeout
            });
            
            if (response.data.success) {
                return response.data.data;
            } else {
                throw new Error(response.data.error);
            }
        } catch (error) {
            console.error('❌ 获取任务详情失败:', error.message);
            return null;
        }
    }
}

// 兼容旧版本的函数接口
async function getSystemStatus() {
    const monitor = new VideoLogoRemovalMonitor();
    await monitor.performCheck();
}

async function testRetryMechanism() {
    const monitor = new VideoLogoRemovalMonitor();
    await monitor.triggerRetry();
}

async function testCleanupMechanism() {
    const monitor = new VideoLogoRemovalMonitor();
    await monitor.triggerCleanup();
}

async function continuousMonitor(intervalMinutes = 5) {
    const monitor = new VideoLogoRemovalMonitor({
        checkInterval: intervalMinutes * 60 * 1000
    });
    
    console.log(`🔄 开始持续监控模式，每${intervalMinutes}分钟更新一次状态...`);
    console.log('按 Ctrl+C 停止监控\n');
    
    monitor.start();
}

// 创建监控实例
const monitor = new VideoLogoRemovalMonitor();

// 如果直接运行此脚本
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
📊 视频去标志功能监控工具

使用方法:
  node monitorVideoLogoRemoval.js [命令] [选项]

命令:
  status              显示当前状态（一次性）
  monitor [分钟]      持续监控模式（默认5分钟间隔）
  test-retry          测试重试机制
  test-cleanup        测试清理机制

新版API监控选项:
  --help, -h          显示帮助信息
  --retry             触发重试任务
  --cleanup           触发清理任务
  --once              只执行一次检查
  --interval <秒>     设置检查间隔（默认30秒）
  --api <URL>         设置API基础URL
  --task <taskId>     查看特定任务详情

示例:
  node monitorVideoLogoRemoval.js status                 # 查看当前状态
  node monitorVideoLogoRemoval.js monitor 3              # 每3分钟监控一次
  node monitorVideoLogoRemoval.js --once                 # 执行一次检查
  node monitorVideoLogoRemoval.js --retry                # 触发重试任务
  node monitorVideoLogoRemoval.js --task abc123          # 查看任务详情
        `);
        process.exit(0);
    }
    
    // 处理新版API监控命令
    if (args.includes('--retry')) {
        monitor.triggerRetry().then(() => process.exit(0));
        return;
    }
    
    if (args.includes('--cleanup')) {
        monitor.triggerCleanup().then(() => process.exit(0));
        return;
    }
    
    const taskIdIndex = args.indexOf('--task');
    if (taskIdIndex !== -1 && args[taskIdIndex + 1]) {
        const taskId = args[taskIdIndex + 1];
        monitor.getTaskDetails(taskId).then(task => {
            if (task) {
                console.log('📋 任务详情:');
                console.log(JSON.stringify(task, null, 2));
            }
            process.exit(0);
        });
        return;
    }
    
    if (args.includes('--once')) {
        monitor.performCheck().then(() => process.exit(0));
        return;
    }
    
    // 设置检查间隔
    const intervalIndex = args.indexOf('--interval');
    if (intervalIndex !== -1 && args[intervalIndex + 1]) {
        const interval = parseInt(args[intervalIndex + 1]) * 1000;
        monitor.checkInterval = interval;
    }
    
    // 设置API URL
    const apiIndex = args.indexOf('--api');
    if (apiIndex !== -1 && args[apiIndex + 1]) {
        monitor.apiBaseUrl = args[apiIndex + 1];
    }
    
    // 处理传统命令
    switch (command) {
        case 'status':
            getSystemStatus().then(() => process.exit(0));
            break;
        case 'test-retry':
            testRetryMechanism().then(() => process.exit(0));
            break;
        case 'test-cleanup':
            testCleanupMechanism().then(() => process.exit(0));
            break;
        case 'monitor':
            const interval = parseInt(args[1]) || 5;
            continuousMonitor(interval);
            break;
        default:
            // 如果没有传统命令，启动新版监控
            if (args.length === 0) {
                console.log('🚀 启动视频去标志功能监控...');
                monitor.start();
                
                // 优雅退出处理
                process.on('SIGINT', () => {
                    console.log('\n📝 收到退出信号，正在停止监控...');
                    monitor.stop();
                    process.exit(0);
                });
                
                process.on('SIGTERM', () => {
                    console.log('\n📝 收到终止信号，正在停止监控...');
                    monitor.stop();
                    process.exit(0);
                });
            } else {
                console.log('❓ 未知命令，使用 --help 查看帮助');
                process.exit(1);
            }
    }
}

module.exports = {
    VideoLogoRemovalMonitor,
    monitor,
    getSystemStatus,
    testRetryMechanism,
    testCleanupMechanism,
    continuousMonitor
};