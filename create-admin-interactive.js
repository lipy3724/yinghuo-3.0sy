const bcrypt = require('bcrypt');
const User = require('./models/User');
const sequelize = require('./config/db');
const readline = require('readline');

// 创建readline接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 询问用户输入
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// 验证用户名
function validateUsername(username) {
  if (username.length < 3 || username.length > 50) {
    return '用户名长度必须在3-50个字符之间';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return '用户名只能包含字母、数字和下划线';
  }
  return null;
}

// 验证密码
function validatePassword(password) {
  if (password.length < 6) {
    return '密码长度至少6个字符';
  }
  return null;
}

// 验证手机号
function validatePhone(phone) {
  if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
    return '请输入有效的中国大陆手机号';
  }
  return null;
}

async function createAdminInteractive() {
  try {
    console.log('🚀 萤火AI - 管理员账号创建工具');
    console.log('=====================================\n');

    // 连接数据库
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功\n');

    // 获取用户输入
    let username, password, confirmPassword, phone, credits;

    // 用户名
    while (true) {
      username = await askQuestion('请输入管理员用户名 (3-50个字符，只能包含字母、数字和下划线): ');
      const usernameError = validateUsername(username);
      if (usernameError) {
        console.log(`❌ ${usernameError}\n`);
        continue;
      }
      break;
    }

    // 检查用户名是否已存在
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      console.log(`❌ 用户名 "${username}" 已存在，请选择其他用户名\n`);
      rl.close();
      return;
    }

    // 密码
    while (true) {
      password = await askQuestion('请输入管理员密码 (至少6个字符): ');
      const passwordError = validatePassword(password);
      if (passwordError) {
        console.log(`❌ ${passwordError}\n`);
        continue;
      }
      break;
    }

    // 确认密码
    while (true) {
      confirmPassword = await askQuestion('请再次输入密码确认: ');
      if (password !== confirmPassword) {
        console.log('❌ 两次输入的密码不一致，请重新输入\n');
        continue;
      }
      break;
    }

    // 手机号（可选）
    while (true) {
      phone = await askQuestion('请输入手机号 (可选，直接回车跳过): ');
      if (!phone) {
        phone = null;
        break;
      }
      const phoneError = validatePhone(phone);
      if (phoneError) {
        console.log(`❌ ${phoneError}\n`);
        continue;
      }
      
      // 检查手机号是否已存在
      const existingPhone = await User.findOne({ where: { phone } });
      if (existingPhone) {
        console.log(`❌ 手机号 "${phone}" 已被使用，请使用其他手机号\n`);
        continue;
      }
      break;
    }

    // 积分
    while (true) {
      const creditsInput = await askQuestion('请输入初始积分 (默认10000): ');
      if (!creditsInput) {
        credits = 10000;
        break;
      }
      credits = parseInt(creditsInput);
      if (isNaN(credits) || credits < 0) {
        console.log('❌ 请输入有效的数字\n');
        continue;
      }
      break;
    }

    // 确认信息
    console.log('\n📋 请确认管理员账号信息:');
    console.log(`   用户名: ${username}`);
    console.log(`   密码: ${'*'.repeat(password.length)}`);
    console.log(`   手机号: ${phone || '未设置'}`);
    console.log(`   初始积分: ${credits}`);
    
    const confirm = await askQuestion('\n确认创建管理员账号？(y/N): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ 已取消创建管理员账号');
      rl.close();
      return;
    }

    // 创建管理员账号
    const admin = await User.create({
      username,
      password, // 密码会自动加密
      phone,
      credits,
      isAdmin: true,
      isInternal: true,
      isCustomerService: true,
      remark: '系统管理员'
    });

    console.log('\n✅ 管理员账号创建成功！');
    console.log('📋 账号信息:');
    console.log(`   用户名: ${admin.username}`);
    console.log(`   密码: ${password}`);
    console.log(`   手机号: ${admin.phone || '未设置'}`);
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
    console.log('   4. 建议启用双因素认证');

  } catch (error) {
    console.error('\n❌ 创建管理员账号失败:', error.message);
    
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
    console.log('\n🔌 数据库连接已关闭');
    rl.close();
  }
}

// 运行脚本
createAdminInteractive(); 