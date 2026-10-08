CREATE TABLE `users` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `phone_country_code` VARCHAR(8) NOT NULL DEFAULT '+86',
  `phone_number` VARCHAR(32) NOT NULL,
  `phone_verified_at` DATETIME(3) NULL,
  `status` ENUM('ACTIVE', 'DISABLED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `last_login_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  INDEX `users_status_created_at_idx` (`status`, `created_at`),
  UNIQUE INDEX `users_phone_country_code_phone_number_key` (`phone_country_code`, `phone_number`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_profiles` (
  `user_id` INTEGER UNSIGNED NOT NULL,
  `nickname` VARCHAR(50) NULL,
  `avatar_url` VARCHAR(500) NULL,
  `bio` VARCHAR(500) NULL,
  `location_text` VARCHAR(100) NULL,
  `profile_completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `verification_codes` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `phone_country_code` VARCHAR(8) NOT NULL,
  `phone_number` VARCHAR(32) NOT NULL,
  `purpose` ENUM('LOGIN') NOT NULL DEFAULT 'LOGIN',
  `code_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `consumed_at` DATETIME(3) NULL,
  `attempt_count` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `request_ip` VARCHAR(64) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `verification_codes_phone_country_code_phone_number_purpose_c_idx` (`phone_country_code`, `phone_number`, `purpose`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_sessions` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER UNSIGNED NOT NULL,
  `session_token_hash` CHAR(64) NOT NULL,
  `csrf_token_hash` CHAR(64) NOT NULL,
  `user_agent` VARCHAR(500) NULL,
  `ip_address` VARCHAR(64) NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `user_sessions_session_token_hash_key` (`session_token_hash`),
  INDEX `user_sessions_user_id_revoked_at_expires_at_idx` (`user_id`, `revoked_at`, `expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pets` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `owner_id` INTEGER UNSIGNED NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `species` ENUM('CAT', 'DOG', 'OTHER') NOT NULL,
  `custom_species` VARCHAR(50) NULL,
  `breed` VARCHAR(80) NULL,
  `gender` ENUM('MALE', 'FEMALE', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  `birth_date` DATE NULL,
  `age_text` VARCHAR(30) NULL,
  `weight_kg` DECIMAL(6, 2) NULL,
  `neutered` BOOLEAN NULL,
  `allergies` TEXT NULL,
  `past_diseases` TEXT NULL,
  `vaccination_info` TEXT NULL,
  `deworming_info` TEXT NULL,
  `note` VARCHAR(1000) NULL,
  `avatar_url` VARCHAR(500) NULL,
  `status` ENUM('ACTIVE', 'INACTIVE', 'DECEASED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  INDEX `pets_owner_id_status_created_at_idx` (`owner_id`, `status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pet_medical_histories` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `pet_id` INTEGER UNSIGNED NOT NULL,
  `recorded_by_user_id` INTEGER UNSIGNED NOT NULL,
  `record_date` DATE NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `description` TEXT NOT NULL,
  `hospital_name` VARCHAR(150) NULL,
  `doctor_name` VARCHAR(80) NULL,
  `examination_result` TEXT NULL,
  `treatment` TEXT NULL,
  `note` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  INDEX `pet_medical_histories_pet_id_record_date_idx` (`pet_id`, `record_date`),
  INDEX `pet_medical_histories_recorded_by_user_id_created_at_idx` (`recorded_by_user_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `pets` ADD CONSTRAINT `pets_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pet_medical_histories` ADD CONSTRAINT `pet_medical_histories_pet_id_fkey` FOREIGN KEY (`pet_id`) REFERENCES `pets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pet_medical_histories` ADD CONSTRAINT `pet_medical_histories_recorded_by_user_id_fkey` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
