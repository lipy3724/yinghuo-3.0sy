-- MariaDB dump 10.19  Distrib 10.4.28-MariaDB, for osx10.10 (x86_64)
--
-- Host: 127.0.0.1    Database: yinghuo
-- ------------------------------------------------------
-- Server version	10.4.28-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `SequelizeMeta`
--

DROP TABLE IF EXISTS `SequelizeMeta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `SequelizeMeta` (
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`name`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `credit_histories`
--

DROP TABLE IF EXISTS `credit_histories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `credit_histories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `type` varchar(100) NOT NULL,
  `amount` int(11) NOT NULL,
  `description` text DEFAULT NULL,
  `taskId` varchar(255) DEFAULT NULL,
  `featureName` varchar(100) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_userId` (`userId`),
  KEY `idx_type` (`type`),
  KEY `idx_featureName` (`featureName`)
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customer_assignments`
--

DROP TABLE IF EXISTS `customer_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customer_assignments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `adminId` int(11) NOT NULL,
  `status` enum('active','inactive','transferred') NOT NULL DEFAULT 'active' COMMENT '分配状态：active-活跃，inactive-非活跃，transferred-已转移',
  `assignedAt` datetime NOT NULL DEFAULT current_timestamp() COMMENT '分配时间',
  `lastActiveAt` datetime DEFAULT NULL COMMENT '最后活跃时间',
  `assignmentMethod` enum('auto','manual','transfer') NOT NULL DEFAULT 'auto' COMMENT '分配方式：auto-自动分配，manual-手动分配，transfer-转移分配',
  `notes` text DEFAULT NULL COMMENT '分配备注信息',
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_assignment` (`userId`),
  KEY `idx_customer_assignments_user_id` (`userId`),
  KEY `idx_customer_assignments_admin_id` (`adminId`),
  KEY `idx_customer_assignments_status` (`status`),
  KEY `idx_customer_assignments_assigned_at` (`assignedAt`),
  CONSTRAINT `customer_assignments_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `customer_assignments_ibfk_2` FOREIGN KEY (`adminId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客服分配表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customer_messages`
--

DROP TABLE IF EXISTS `customer_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customer_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `message` text NOT NULL,
  `type` enum('user','admin') NOT NULL DEFAULT 'user',
  `status` enum('unread','read') NOT NULL DEFAULT 'unread',
  `sessionId` varchar(100) DEFAULT NULL COMMENT '会话标识，用于分组对话',
  `adminId` int(11) DEFAULT NULL,
  `channel` varchar(50) NOT NULL DEFAULT 'web' COMMENT '消息来源：web, mobile, api等',
  `ipAddress` varchar(50) DEFAULT NULL,
  `userAgent` text DEFAULT NULL,
  `attachments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT '附件信息，如图片、文件等' CHECK (json_valid(`attachments`)),
  `priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  `isDeleted` tinyint(1) NOT NULL DEFAULT 0,
  `deletedAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `adminId` (`adminId`),
  KEY `customer_messages_user_id` (`userId`),
  KEY `customer_messages_status` (`status`),
  KEY `customer_messages_type` (`type`),
  KEY `customer_messages_session_id` (`sessionId`),
  KEY `customer_messages_created_at` (`createdAt`),
  KEY `customer_messages_is_deleted` (`isDeleted`),
  KEY `customer_messages_user_status_type` (`userId`,`status`,`type`),
  CONSTRAINT `customer_messages_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `customer_messages_ibfk_2` FOREIGN KEY (`adminId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `feature_usages`
--

DROP TABLE IF EXISTS `feature_usages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `feature_usages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `featureName` varchar(100) NOT NULL,
  `usageCount` int(11) NOT NULL DEFAULT 0,
  `lastUsedAt` datetime NOT NULL,
  `resetDate` date NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT '详细信息，包括任务ID、视频时长、积分消耗等' CHECK (json_valid(`details`)),
  `credits` int(11) DEFAULT 0 COMMENT '功能消耗的积分',
  PRIMARY KEY (`id`),
  UNIQUE KEY `feature_usages_user_id_feature_name` (`userId`,`featureName`),
  UNIQUE KEY `feature_usages_user_feature` (`userId`,`featureName`),
  CONSTRAINT `feature_usages_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=470 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `image_colorization_histories`
--

DROP TABLE IF EXISTS `image_colorization_histories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `image_colorization_histories` (
  `id` varchar(36) NOT NULL COMMENT 'UUID作为主键',
  `userId` int(11) NOT NULL COMMENT '用户ID',
  `originalImage` text DEFAULT NULL COMMENT '原始图片URL',
  `resultImage` text NOT NULL COMMENT '上色后图片URL',
  `prompt` text DEFAULT NULL COMMENT '使用的提示词',
  `storageType` enum('local','oss') NOT NULL DEFAULT 'local' COMMENT '存储类型：local-本地存储，oss-阿里云OSS',
  `ossOriginalPath` text DEFAULT NULL COMMENT 'OSS中原始图片的路径',
  `ossResultPath` text DEFAULT NULL COMMENT 'OSS中结果图片的路径',
  `createdAt` datetime NOT NULL DEFAULT current_timestamp() COMMENT '创建时间',
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_image_colorization_histories_user_id` (`userId`),
  KEY `idx_image_colorization_histories_created_at` (`createdAt`),
  KEY `idx_image_colorization_histories_storage_type` (`storageType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `image_histories`
--

DROP TABLE IF EXISTS `image_histories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `image_histories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) DEFAULT NULL COMMENT '用户ID，可为空表示未登录用户',
  `originalImageUrl` longtext DEFAULT NULL COMMENT '原始图片URL',
  `processedImageUrl` longtext DEFAULT NULL COMMENT '处理后的图片URL',
  `processType` varchar(50) DEFAULT '图片处理' COMMENT '处理类型：图片翻译、营销图生成等',
  `processTime` datetime DEFAULT NULL COMMENT '处理时间',
  `description` longtext DEFAULT NULL COMMENT '处理描述',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT '额外元数据，如语言设置、处理参数等' CHECK (json_valid(`metadata`)),
  `createdAt` datetime NOT NULL COMMENT '创建时间',
  `updatedAt` datetime NOT NULL COMMENT '更新时间',
  `title` varchar(255) NOT NULL DEFAULT '未命名图片' COMMENT '图片标题',
  `imageUrl` longtext NOT NULL COMMENT '图片URL（可能是原始图片或处理后的图片）',
  `type` varchar(50) NOT NULL DEFAULT 'IMAGE_EDIT' COMMENT '图片类型：IMAGE_EDIT、TEXT_TO_VIDEO、IMAGE_TO_VIDEO等',
  PRIMARY KEY (`id`),
  KEY `idx_image_histories_user_id` (`userId`),
  KEY `idx_image_histories_process_type` (`processType`),
  KEY `idx_image_histories_process_time` (`processTime`),
  KEY `idx_image_histories_type` (`type`),
  KEY `idx_image_histories_created_at` (`createdAt`)
) ENGINE=InnoDB AUTO_INCREMENT=329 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `migration_history`
--

DROP TABLE IF EXISTS `migration_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `migration_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `executed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `filename` (`filename`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_orders`
--

DROP TABLE IF EXISTS `payment_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payment_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `order_number` varchar(50) NOT NULL,
  `amount` int(11) NOT NULL COMMENT '充值积分金额',
  `price` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT '人民币金额',
  `status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  `payment_method` enum('alipay','wechat','bank','paypal') NOT NULL,
  `transaction_id` varchar(100) DEFAULT NULL COMMENT '第三方支付交易ID',
  `payment_time` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `qrcode_expire_time` datetime DEFAULT NULL COMMENT '二维码过期时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_number` (`order_number`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `payment_orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=71 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_sessions`
--

DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `token` varchar(500) NOT NULL,
  `deviceInfo` varchar(255) DEFAULT NULL,
  `ipAddress` varchar(50) DEFAULT NULL,
  `userAgent` text DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `lastActiveAt` datetime NOT NULL DEFAULT current_timestamp(),
  `expiresAt` datetime NOT NULL,
  `sessionType` varchar(10) NOT NULL DEFAULT 'user',
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_sessions_user_id` (`userId`),
  KEY `user_sessions_token` (`token`),
  KEY `user_sessions_is_active` (`isActive`),
  CONSTRAINT `user_sessions_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=150 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(100) NOT NULL,
  `createdAt` datetime DEFAULT NULL,
  `updatedAt` datetime DEFAULT NULL,
  `lastActiveAt` datetime DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `credits` int(11) NOT NULL DEFAULT 0,
  `lastRechargeTime` datetime DEFAULT NULL,
  `smsCode` varchar(10) DEFAULT NULL,
  `smsCodeExpires` datetime DEFAULT NULL,
  `isAdmin` tinyint(1) DEFAULT 0,
  `isInternal` tinyint(1) NOT NULL DEFAULT 0,
  `remark` varchar(200) DEFAULT NULL,
  `isBanned` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否被封禁',
  `banReason` varchar(200) DEFAULT NULL COMMENT '封禁原因',
  `banExpireAt` datetime DEFAULT NULL COMMENT '封禁到期时间',
  `isCustomerService` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否为客服人员',
  `email` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username_UNIQUE` (`username`),
  UNIQUE KEY `phone_UNIQUE` (`phone`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_backup_20251023`
--

DROP TABLE IF EXISTS `users_backup_20251023`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users_backup_20251023` (
  `id` int(11) NOT NULL DEFAULT 0,
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `createdAt` datetime DEFAULT NULL,
  `updatedAt` datetime DEFAULT NULL,
  `lastActiveAt` datetime DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `credits` int(11) NOT NULL DEFAULT 0,
  `lastRechargeTime` datetime DEFAULT NULL,
  `smsCode` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `smsCodeExpires` datetime DEFAULT NULL,
  `isAdmin` tinyint(1) DEFAULT 0,
  `isInternal` tinyint(1) NOT NULL DEFAULT 0,
  `remark` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `isBanned` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否被封禁',
  `banReason` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '封禁原因',
  `banExpireAt` datetime DEFAULT NULL COMMENT '封禁到期时间',
  `isCustomerService` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否为客服人员',
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `video_results`
--

DROP TABLE IF EXISTS `video_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `video_results` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `taskId` varchar(100) NOT NULL,
  `featureType` varchar(50) NOT NULL,
  `inputData` text DEFAULT NULL,
  `outputVideoUrl` varchar(500) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `creditsUsed` int(11) NOT NULL DEFAULT 0,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `video_results_user_id` (`userId`),
  KEY `video_results_task_id` (`taskId`),
  KEY `video_results_status` (`status`),
  CONSTRAINT `video_results_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-23 11:44:33
