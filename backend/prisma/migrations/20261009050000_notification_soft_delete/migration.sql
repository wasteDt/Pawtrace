ALTER TABLE `user_notifications` ADD COLUMN `deleted_at` DATETIME(3) NULL;
ALTER TABLE `admin_notifications` ADD COLUMN `deleted_at` DATETIME(3) NULL;

CREATE INDEX `user_notifications_user_id_deleted_at_created_at_idx` ON `user_notifications`(`user_id`, `deleted_at`, `created_at`);
CREATE INDEX `admin_notifications_admin_user_id_deleted_at_created_at_idx` ON `admin_notifications`(`admin_user_id`, `deleted_at`, `created_at`);
