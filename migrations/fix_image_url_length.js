'use strict';

/**
 * 修复 image_histories 表中 URL 字段长度限制问题
 * 将 originalImageUrl 和 processedImageUrl 字段改为 LONGTEXT 类型
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('开始修改 image_histories 表结构...');
      
      // 修改 originalImageUrl 字段为 LONGTEXT
      await queryInterface.changeColumn('image_histories', 'originalImageUrl', {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: '原始图片URL'
      });
      console.log('修改 originalImageUrl 字段完成');
      
      // 修改 processedImageUrl 字段为 LONGTEXT
      await queryInterface.changeColumn('image_histories', 'processedImageUrl', {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: '处理后的图片URL'
      });
      console.log('修改 processedImageUrl 字段完成');
      
      // 修改 imageUrl 字段为 LONGTEXT
      await queryInterface.changeColumn('image_histories', 'imageUrl', {
        type: Sequelize.TEXT('long'),
        allowNull: false,
        comment: '图片URL（可能是原始图片或处理后的图片）'
      });
      console.log('修改 imageUrl 字段完成');
      
      // 修改 description 字段为 LONGTEXT
      await queryInterface.changeColumn('image_histories', 'description', {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: '处理描述'
      });
      console.log('修改 description 字段完成');
      
      console.log('image_histories 表结构修改完成');
    } catch (error) {
      console.error('修改表结构失败:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('开始回滚 image_histories 表结构...');
      
      // 回滚 originalImageUrl 字段为 TEXT
      await queryInterface.changeColumn('image_histories', 'originalImageUrl', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '原始图片URL'
      });
      
      // 回滚 processedImageUrl 字段为 TEXT
      await queryInterface.changeColumn('image_histories', 'processedImageUrl', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '处理后的图片URL'
      });
      
      // 回滚 imageUrl 字段为 TEXT
      await queryInterface.changeColumn('image_histories', 'imageUrl', {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: '图片URL（可能是原始图片或处理后的图片）'
      });
      
      // 回滚 description 字段为 TEXT
      await queryInterface.changeColumn('image_histories', 'description', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '处理描述'
      });
      
      console.log('image_histories 表结构回滚完成');
    } catch (error) {
      console.error('回滚表结构失败:', error);
      throw error;
    }
  }
};
