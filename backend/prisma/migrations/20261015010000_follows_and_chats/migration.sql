ALTER TABLE `user_profiles`
  ADD COLUMN `message_privacy` ENUM('FOLLOWERS', 'MUTUAL') NOT NULL DEFAULT 'FOLLOWERS';

CREATE TABLE `follows` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `follower_id` INTEGER UNSIGNED NOT NULL,
  `following_id` INTEGER UNSIGNED NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `follows_follower_id_following_id_key` (`follower_id`, `following_id`),
  INDEX `follows_following_id_created_at_idx` (`following_id`, `created_at`),
  CONSTRAINT `follows_follower_id_fkey` FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `follows_following_id_fkey` FOREIGN KEY (`following_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE `conversations` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_a_id` INTEGER UNSIGNED NOT NULL,
  `user_b_id` INTEGER UNSIGNED NOT NULL,
  `last_message_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `conversations_user_a_id_user_b_id_key` (`user_a_id`, `user_b_id`),
  INDEX `conversations_last_message_at_idx` (`last_message_at`),
  CONSTRAINT `conversations_user_a_id_fkey` FOREIGN KEY (`user_a_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `conversations_user_b_id_fkey` FOREIGN KEY (`user_b_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE `conversation_participants` (
  `conversation_id` INTEGER UNSIGNED NOT NULL,
  `user_id` INTEGER UNSIGNED NOT NULL,
  `last_read_message_id` INTEGER UNSIGNED NOT NULL DEFAULT 0,
  `muted` BOOLEAN NOT NULL DEFAULT false,
  `hidden_at` DATETIME(3) NULL,
  PRIMARY KEY (`conversation_id`, `user_id`),
  INDEX `conversation_participants_user_id_hidden_at_idx` (`user_id`, `hidden_at`),
  CONSTRAINT `conversation_participants_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `conversation_participants_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE `chat_messages` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_id` INTEGER UNSIGNED NOT NULL,
  `sender_id` INTEGER UNSIGNED NOT NULL,
  `body` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `chat_messages_conversation_id_id_idx` (`conversation_id`, `id`),
  CONSTRAINT `chat_messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chat_messages_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);
