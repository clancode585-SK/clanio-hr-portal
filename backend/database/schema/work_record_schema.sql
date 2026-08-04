SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `task_attachments`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `task_attachments` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`          CHAR(36) NOT NULL,
    `company_id`    BIGINT UNSIGNED NOT NULL,
    `task_id`       BIGINT UNSIGNED NOT NULL,
    `file_path`     VARCHAR(255) NOT NULL,
    `original_name` VARCHAR(200) NOT NULL,
    `mime_type`     VARCHAR(120) NULL,
    `size_bytes`    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `uploaded_by`   BIGINT UNSIGNED NULL,
    `created_by`    BIGINT UNSIGNED NULL,
    `updated_by`    BIGINT UNSIGNED NULL,
    `created_at`    TIMESTAMP NULL,
    `updated_at`    TIMESTAMP NULL,
    `deleted_at`    TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_task_attachments_uuid` (`uuid`),
    KEY `ix_task_attachments_task` (`task_id`, `id`),
    KEY `ix_task_attachments_company` (`company_id`),
    CONSTRAINT `fk_task_attachments_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_task_attachments_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_task_attachments_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `tasks`
    ADD COLUMN `parent_id` BIGINT UNSIGNED NULL AFTER `company_id`,
    ADD KEY `ix_tasks_parent` (`parent_id`, `is_open`),
    ADD CONSTRAINT `fk_tasks_parent` FOREIGN KEY (`parent_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE;

DELETE FROM `cache`;
