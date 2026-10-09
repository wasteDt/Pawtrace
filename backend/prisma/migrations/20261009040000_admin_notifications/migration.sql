CREATE TABLE `admin_notifications` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_user_id` INTEGER UNSIGNED NOT NULL,
  `type` ENUM('PROFESSIONAL_APPLICATION_SUBMITTED', 'PROFESSIONAL_APPLICATION_CANCELLED', 'SYSTEM') NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `content` VARCHAR(1000) NOT NULL,
  `link` VARCHAR(500) NULL,
  `read_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `admin_notifications_admin_user_id_read_at_created_at_idx` (`admin_user_id`, `read_at`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `admin_notifications` ADD CONSTRAINT `admin_notifications_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
