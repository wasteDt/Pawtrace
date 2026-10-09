CREATE TABLE `media_assets` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `uploader_id` INTEGER UNSIGNED NOT NULL,
  `kind` ENUM('IMAGE', 'DOCUMENT') NOT NULL,
  `storage_key` VARCHAR(500) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `size_bytes` BIGINT UNSIGNED NOT NULL,
  `status` ENUM('READY', 'DELETED') NOT NULL DEFAULT 'READY',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  INDEX `media_assets_uploader_id_status_created_at_idx` (`uploader_id`, `status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `professional_profiles` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER UNSIGNED NOT NULL,
  `type` ENUM('VETERINARIAN', 'ASSISTANT') NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'REVOKED') NOT NULL DEFAULT 'PENDING',
  `real_name` VARCHAR(80) NOT NULL,
  `display_name` VARCHAR(80) NOT NULL,
  `organization` VARCHAR(150) NOT NULL,
  `years_of_practice` TINYINT UNSIGNED NOT NULL,
  `specialties` JSON NOT NULL,
  `introduction` VARCHAR(1000) NULL,
  `approved_at` DATETIME(3) NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `professional_profiles_user_id_key` (`user_id`),
  INDEX `professional_profiles_type_status_created_at_idx` (`type`, `status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `professional_applications` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER UNSIGNED NOT NULL,
  `requested_type` ENUM('VETERINARIAN', 'ASSISTANT') NOT NULL,
  `real_name` VARCHAR(80) NOT NULL,
  `display_name` VARCHAR(80) NOT NULL,
  `organization` VARCHAR(150) NOT NULL,
  `years_of_practice` TINYINT UNSIGNED NOT NULL,
  `specialties` JSON NOT NULL,
  `introduction` VARCHAR(1000) NULL,
  `credential_media_id` INTEGER UNSIGNED NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `review_note` VARCHAR(500) NULL,
  `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `professional_applications_user_id_status_created_at_idx` (`user_id`, `status`, `created_at`),
  INDEX `professional_applications_status_submitted_at_idx` (`status`, `submitted_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `media_assets` ADD CONSTRAINT `media_assets_uploader_id_fkey` FOREIGN KEY (`uploader_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `professional_profiles` ADD CONSTRAINT `professional_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `professional_applications` ADD CONSTRAINT `professional_applications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `professional_applications` ADD CONSTRAINT `professional_applications_credential_media_id_fkey` FOREIGN KEY (`credential_media_id`) REFERENCES `media_assets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
