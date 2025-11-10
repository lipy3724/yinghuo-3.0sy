const bcrypt = require('bcrypt');
const User = require('./models/User');
const sequelize = require('./config/db');

// 管理员账号配置
const ADMIN_CONFIG = {
  username: 'admin',
  password: 'admin123456',
  phone: '13800138000',
  credits: 10000,
  remark: '系统管理员'
};

async function createAdmin() {
  try {
    // 连接数据库
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');

    // 检查是否已存在管理员账号
    const existingAdmin = await User.findOne({
      where: { username: ADMIN_CONFIG.username }
    });

    if (existingAdmin) {
      console.log('⚠️  管理员账号已存在');
      console.log(`用户名: ${existingAdmin.username}`);
      console.log(`是否为管理员: ${existingAdmin.isAdmin}`);
      console.log(`创建时间: ${existingAdmin.createdAt}`);
      return;
    }

    // 创建管理员账号
    const admin = await User.create({
      username: ADMIN_CONFIG.username,
      password: ADMIN_CONFIG.password, // 密码会自动加密
      phone: ADMIN_CONFIG.phone,
      credits: ADMIN_CONFIG.credits,
      isAdmin: true,
      isInternal: true,
      isCustomerService: true,
      remark: ADMIN_CONFIG.remark
    });

    console.log('✅ 管理员账号创建成功！');
    console.log('📋 账号信息:');
    console.log(`   用户名: ${admin.username}`);
    console.log(`   密码: ${ADMIN_CONFIG.password}`);
    console.log(`   手机号: ${admin.phone}`);
    console.log(`   积分: ${admin.credits}`);
    console.log(`   管理员权限: ${admin.isAdmin}`);
    console.log(`   内部用户: ${admin.isInternal}`);
    console.log(`   客服权限: ${admin.isCustomerService}`);
    console.log(`   创建时间: ${admin.createdAt}`);
    
    console.log('\n🔗 登录地址:');
    console.log('   http://localhost:3000/admin-login.html');
    console.log('   或');
    console.log('   http://localhost:3000/admin');
    
    console.log('\n⚠️  安全提醒:');
    console.log('   1. 请及时修改默认密码');
    console.log('   2. 建议定期更换密码');
    console.log('   3. 请妥善保管管理员账号信息');

  } catch (error) {
    console.error('❌ 创建管理员账号失败:', error.message);
    
    if (error.name === 'SequelizeValidationError') {
      console.error('验证错误详情:');
      error.errors.forEach(err => {
        console.error(`   - ${err.message}`);
      });
    }
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      console.error('唯一约束错误: 用户名或手机号已存在');
    }
  } finally {
    // 关闭数据库连接
    await sequelize.close();
    console.log('🔌 数据库连接已关闭');
  }
}

// 运行脚本
createAdmin(); 