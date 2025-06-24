const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 添加isCustomerService字段
    await queryInterface.addColumn('users', 'isCustomerService', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: '是否为客服人员'
    });

    console.log('✅ 成功添加 isCustomerService 字段到 users 表');
  },

  down: async (queryInterface, Sequelize) => {
    // 回滚时删除字段
    await queryInterface.removeColumn('users', 'isCustomerService');
    console.log('✅ 成功从 users 表删除 isCustomerService 字段');
  }
}; 