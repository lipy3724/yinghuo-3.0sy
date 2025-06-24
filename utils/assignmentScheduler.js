const CustomerAssignment = require('../models/CustomerAssignment');

class AssignmentScheduler {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.checkIntervalMinutes = 30; // 每30分钟检查一次
  }

  // 启动定时检查
  start() {
    if (this.isRunning) {
      console.log('⚠️ 客服分配检查器已在运行中');
      return;
    }

    console.log(`🕐 启动客服分配超时检查器，每 ${this.checkIntervalMinutes} 分钟检查一次`);
    
    // 立即执行一次检查
    this.checkTimeouts();
    
    // 设置定时检查
    this.intervalId = setInterval(() => {
      this.checkTimeouts();
    }, this.checkIntervalMinutes * 60 * 1000);
    
    this.isRunning = true;
  }

  // 停止定时检查
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    console.log('⏹️ 客服分配超时检查器已停止');
  }

  // 执行超时检查
  async checkTimeouts() {
    try {
      console.log('🔍 开始检查客服分配超时...');
      
      const timeoutCount = await CustomerAssignment.checkAndHandleTimeouts();
      
      if (timeoutCount > 0) {
        console.log(`⏰ 处理了 ${timeoutCount} 个超时分配`);
      } else {
        console.log('✅ 没有发现超时分配');
      }
      
      // 输出当前活跃分配统计
      await this.logActiveAssignments();
      
    } catch (error) {
      console.error('❌ 检查客服分配超时失败:', error);
    }
  }

  // 输出当前活跃分配统计
  async logActiveAssignments() {
    try {
      const User = require('../models/User');
      const { Op } = require('sequelize');
      
      // 获取活跃分配统计
      const activeAssignments = await CustomerAssignment.findAll({
        where: { status: 'active' },
        include: [
          {
            model: User,
            as: 'admin',
            attributes: ['id', 'username'],
            where: {
              [Op.or]: [
                { isAdmin: true },
                { isInternal: true }
              ]
            }
          }
        ]
      });
      
      // 按客服分组统计
      const adminStats = {};
      activeAssignments.forEach(assignment => {
        const adminId = assignment.adminId;
        const adminName = assignment.admin.username;
        
        if (!adminStats[adminId]) {
          adminStats[adminId] = {
            name: adminName,
            count: 0
          };
        }
        adminStats[adminId].count++;
      });
      
      console.log('📊 当前活跃分配统计:');
      if (Object.keys(adminStats).length === 0) {
        console.log('   暂无活跃分配');
      } else {
        Object.values(adminStats).forEach(stat => {
          console.log(`   ${stat.name}: ${stat.count} 个用户`);
        });
      }
      
    } catch (error) {
      console.error('获取分配统计失败:', error);
    }
  }

  // 手动触发检查
  async manualCheck() {
    console.log('🔍 手动触发客服分配超时检查...');
    await this.checkTimeouts();
  }

  // 获取运行状态
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkIntervalMinutes: this.checkIntervalMinutes,
      nextCheckTime: this.isRunning ? 
        new Date(Date.now() + this.checkIntervalMinutes * 60 * 1000) : null
    };
  }

  // 设置检查间隔
  setCheckInterval(minutes) {
    if (minutes < 5) {
      throw new Error('检查间隔不能少于5分钟');
    }
    
    this.checkIntervalMinutes = minutes;
    
    // 如果正在运行，重启以应用新间隔
    if (this.isRunning) {
      this.stop();
      this.start();
    }
    
    console.log(`⚙️ 检查间隔已设置为 ${minutes} 分钟`);
  }
}

// 创建全局实例
const assignmentScheduler = new AssignmentScheduler();

module.exports = assignmentScheduler; 