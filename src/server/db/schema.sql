-- ===========================================
-- PixelDrive - MySQL Schema
-- Exact specification from requirements
-- ===========================================

-- USERS
CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) PRIMARY KEY,
  `username` VARCHAR(50) UNIQUE NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `master_salt` BINARY(16) NOT NULL,
  `master_key_version` INT DEFAULT 1,
  `theme` ENUM('dark','light','system') DEFAULT 'dark',
  `storage_used` BIGINT DEFAULT 0,
  `role` ENUM('user','admin') DEFAULT 'user',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NODES (Files & Folders)
CREATE TABLE IF NOT EXISTS `nodes` (
  `id` CHAR(36) PRIMARY KEY,
  `owner_id` CHAR(36) NOT NULL,
  `parent_id` CHAR(36) DEFAULT NULL,
  `name` VARCHAR(255) NOT NULL,
  `type` ENUM('file','folder') NOT NULL DEFAULT 'file',
  `mime_type` VARCHAR(100) DEFAULT NULL,
  `size` BIGINT DEFAULT 0,
  `chunks` JSON NOT NULL,
  `enc_iv` BINARY(12) DEFAULT NULL,
  `enc_key_wrapped` TEXT DEFAULT NULL,
  `enc_algo` VARCHAR(20) DEFAULT 'AES-GCM',
  `sha256` CHAR(64) DEFAULT NULL,
  `sha1` CHAR(40) DEFAULT NULL,
  `chunk_count` INT DEFAULT 0,
  `thumb_url` TEXT DEFAULT NULL,
  `tags` JSON DEFAULT NULL,
  `is_fav` BOOLEAN DEFAULT FALSE,
  `is_trashed` BOOLEAN DEFAULT FALSE,
  `trashed_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`parent_id`) REFERENCES `nodes`(`id`) ON DELETE SET NULL,
  INDEX `idx_owner_parent` (`owner_id`, `parent_id`),
  FULLTEXT INDEX `ft_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SHARES (ACL & Public Links)
CREATE TABLE IF NOT EXISTS `shares` (
  `id` CHAR(36) PRIMARY KEY,
  `node_id` CHAR(36) NOT NULL,
  `owner_id` CHAR(36) NOT NULL,
  `target_type` ENUM('user','public') NOT NULL,
  `target_id` CHAR(36) DEFAULT NULL,
  `permission` ENUM('read','write') DEFAULT 'read',
  `password_hash` VARCHAR(255) DEFAULT NULL,
  `expires_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_node_target` (`node_id`, `target_type`, `target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API KEYS (For future CLI)
CREATE TABLE IF NOT EXISTS `api_keys` (
  `id` CHAR(36) PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) DEFAULT NULL,
  `prefix` VARCHAR(20) NOT NULL,
  `key_hash` CHAR(64) NOT NULL,
  `scopes` JSON NOT NULL,
  `last_used` DATETIME DEFAULT NULL,
  `expires_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- REFRESH TOKEN BLACKLIST (optional, using master_key_version rotation instead)
-- CREATE TABLE IF NOT EXISTS `refresh_tokens` (
--   `id` CHAR(36) PRIMARY KEY,
--   `user_id` CHAR(36) NOT NULL,
--   `token_hash` CHAR(64) NOT NULL,
--   `expires_at` DATETIME NOT NULL,
--   `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;