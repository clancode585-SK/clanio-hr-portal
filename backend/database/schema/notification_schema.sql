SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `device_tokens`;
DROP TABLE IF EXISTS `notification_preferences`;
DROP TABLE IF EXISTS `notifications`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `notifications` (
    `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`         CHAR(36) NOT NULL,
    `company_id`   BIGINT UNSIGNED NOT NULL,
    `user_id`      BIGINT UNSIGNED NOT NULL,
    `actor_id`     BIGINT UNSIGNED NULL,
    `type`         VARCHAR(50) NOT NULL,
    `group_name`   VARCHAR(30) NOT NULL,
    `priority`     VARCHAR(10) NOT NULL DEFAULT 'normal',
    `title`        VARCHAR(150) NOT NULL,
    `body`         VARCHAR(500) NULL,
    `action_url`   VARCHAR(255) NULL,
    `entity_type`  VARCHAR(50) NULL,
    `entity_id`    BIGINT UNSIGNED NULL,
    `payload`      JSON NULL,
    `dedupe_key`   VARCHAR(120) NULL,
    `read_at`      TIMESTAMP NULL,
    `created_at`   TIMESTAMP NULL,
    `updated_at`   TIMESTAMP NULL,
    `dedupe_slot`  VARCHAR(160) AS (IF(`read_at` IS NULL AND `dedupe_key` IS NOT NULL, CONCAT(`user_id`, ':', `dedupe_key`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_notifications_uuid` (`uuid`),
    UNIQUE KEY `uq_notifications_dedupe` (`dedupe_slot`),
    KEY `ix_notifications_inbox` (`user_id`, `read_at`, `id`),
    KEY `ix_notifications_group` (`user_id`, `group_name`, `id`),
    KEY `ix_notifications_entity` (`entity_type`, `entity_id`),
    KEY `ix_notifications_company` (`company_id`, `created_at`),
    CONSTRAINT `fk_notifications_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_notifications_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notification_preferences` (
    `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`       CHAR(36) NOT NULL,
    `company_id` BIGINT UNSIGNED NOT NULL,
    `user_id`    BIGINT UNSIGNED NOT NULL,
    `scope`      VARCHAR(50) NOT NULL,
    `in_app`     TINYINT(1) NOT NULL DEFAULT 1,
    `push`       TINYINT(1) NOT NULL DEFAULT 1,
    `email`      TINYINT(1) NOT NULL DEFAULT 0,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `created_at` TIMESTAMP NULL,
    `updated_at` TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_notification_preferences_uuid` (`uuid`),
    UNIQUE KEY `uq_notification_preferences_slot` (`user_id`, `scope`),
    KEY `ix_notification_preferences_company` (`company_id`),
    CONSTRAINT `fk_notification_preferences_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_notification_preferences_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `device_tokens` (
    `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`         CHAR(36) NOT NULL,
    `company_id`   BIGINT UNSIGNED NOT NULL,
    `user_id`      BIGINT UNSIGNED NOT NULL,
    `platform`     VARCHAR(10) NOT NULL,
    `token`        VARCHAR(512) NOT NULL,
    `device_id`    VARCHAR(120) NULL,
    `device_name`  VARCHAR(120) NULL,
    `app_version`  VARCHAR(20) NULL,
    `last_used_at` TIMESTAMP NULL,
    `revoked_at`   TIMESTAMP NULL,
    `created_at`   TIMESTAMP NULL,
    `updated_at`   TIMESTAMP NULL,
    `token_hash`   CHAR(64) AS (SHA2(`token`, 256)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_device_tokens_uuid` (`uuid`),
    UNIQUE KEY `uq_device_tokens_token` (`token_hash`),
    KEY `ix_device_tokens_user` (`user_id`, `revoked_at`),
    KEY `ix_device_tokens_company` (`company_id`, `platform`),
    CONSTRAINT `fk_device_tokens_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_device_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELETE rp FROM `role_permissions` rp
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`module` = 'notification';

DELETE FROM `permissions` WHERE `module` = 'notification';

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
('notification', 'send', 'notification.send', 'Send Announcements', 'notification', NOW());

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`module` = 'notification'
  AND (
        r.`slug` = 'super_admin'
        OR r.`slug` = 'company_admin'
        OR EXISTS (
            SELECT 1 FROM `role_permissions` rp
            JOIN `permissions` ep ON ep.`id` = rp.`permission_id`
            WHERE rp.`role_id` = r.`id` AND ep.`slug` = 'employee.create'
        )
      );

DELETE FROM `cache`;
