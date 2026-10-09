CREATE TABLE `admin_users` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(80) NOT NULL,
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `last_login_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `admin_users_username_key` (`username`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `admin_sessions` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_user_id` INTEGER UNSIGNED NOT NULL,
  `session_token_hash` CHAR(64) NOT NULL,
  `csrf_token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `ip_address` VARCHAR(64) NULL,
  `user_agent` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `admin_sessions_session_token_hash_key` (`session_token_hash`),
  INDEX `admin_sessions_admin_user_id_revoked_at_expires_at_idx` (`admin_user_id`, `revoked_at`, `expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `admin_audit_logs` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_user_id` INTEGER UNSIGNED NOT NULL,
  `action` VARCHAR(80) NOT NULL,
  `target_type` VARCHAR(80) NOT NULL,
  `target_id` INTEGER UNSIGNED NOT NULL,
  `reason` VARCHAR(1000) NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `admin_audit_logs_admin_user_id_created_at_idx` (`admin_user_id`, `created_at`),
  INDEX `admin_audit_logs_target_type_target_id_idx` (`target_type`, `target_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `professional_applications` ADD COLUMN `reviewed_by_admin_id` INTEGER UNSIGNED NULL;
ALTER TABLE `admin_sessions` ADD CONSTRAINT `admin_sessions_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `admin_audit_logs` ADD CONSTRAINT `admin_audit_logs_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `professional_applications` ADD CONSTRAINT `professional_applications_reviewed_by_admin_id_fkey` FOREIGN KEY (`reviewed_by_admin_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
