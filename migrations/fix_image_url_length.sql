-- 修复 image_histories 表中 URL 字段长度限制问题
-- 将 originalImageUrl 和 processedImageUrl 字段改为 LONGTEXT 类型

USE yinghuo;

-- 修改 originalImageUrl 字段为 LONGTEXT
ALTER TABLE image_histories 
MODIFY COLUMN originalImageUrl LONGTEXT COMMENT '原始图片URL';

-- 修改 processedImageUrl 字段为 LONGTEXT  
ALTER TABLE image_histories 
MODIFY COLUMN processedImageUrl LONGTEXT COMMENT '处理后的图片URL';

-- 修改 imageUrl 字段为 LONGTEXT
ALTER TABLE image_histories 
MODIFY COLUMN imageUrl LONGTEXT NOT NULL COMMENT '图片URL（可能是原始图片或处理后的图片）';

-- 修改 description 字段为 LONGTEXT（以防描述过长）
ALTER TABLE image_histories 
MODIFY COLUMN description LONGTEXT COMMENT '处理描述';

-- 显示修改后的表结构
DESCRIBE image_histories;
