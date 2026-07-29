SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `employee_documents`;
DROP TABLE IF EXISTS `password_reset_tokens`;
SET FOREIGN_KEY_CHECKS = 1;

ALTER TABLE `users`
    ADD COLUMN `avatar_path` VARCHAR(255) NULL AFTER `phone`;

CREATE TABLE `employee_documents` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`          CHAR(36) NOT NULL,
    `company_id`    BIGINT UNSIGNED NOT NULL,
    `employee_id`   BIGINT UNSIGNED NOT NULL,
    `type`          VARCHAR(40) NOT NULL,
    `title`         VARCHAR(150) NOT NULL,
    `file_path`     VARCHAR(255) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `mime_type`     VARCHAR(100) NOT NULL,
    `size_bytes`    INT UNSIGNED NOT NULL DEFAULT 0,
    `document_number` VARCHAR(60) NULL,
    `issued_on`     DATE NULL,
    `expires_on`    DATE NULL,
    `status`        VARCHAR(20) NOT NULL DEFAULT 'pending',
    `remarks`       VARCHAR(500) NULL,
    `verified_by`   BIGINT UNSIGNED NULL,
    `verified_at`   TIMESTAMP NULL,
    `uploaded_by`   BIGINT UNSIGNED NULL,
    `created_by`    BIGINT UNSIGNED NULL,
    `updated_by`    BIGINT UNSIGNED NULL,
    `created_at`    TIMESTAMP NULL,
    `updated_at`    TIMESTAMP NULL,
    `deleted_at`    TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_employee_documents_uuid` (`uuid`),
    KEY `ix_employee_documents_employee` (`employee_id`, `type`),
    KEY `ix_employee_documents_company_status` (`company_id`, `status`),
    CONSTRAINT `fk_employee_documents_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_employee_documents_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_employee_documents_verifier` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `password_reset_tokens` (
    `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`    BIGINT UNSIGNED NOT NULL,
    `company_id` BIGINT UNSIGNED NULL,
    `email`      VARCHAR(255) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `expires_at` TIMESTAMP NOT NULL,
    `used_at`    TIMESTAMP NULL,
    `created_at` TIMESTAMP NULL,
    `updated_at` TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_password_reset_token` (`token_hash`),
    KEY `ix_password_reset_user` (`user_id`, `used_at`),
    KEY `ix_password_reset_email` (`email`),
    CONSTRAINT `fk_password_reset_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELETE rp FROM `role_permissions` rp
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`module` = 'employee_document';

DELETE FROM `permissions` WHERE `module` = 'employee_document';

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
('employee_document', 'view',   'employee_document.view',   'View Employee Documents',   'employee', NOW()),
('employee_document', 'manage', 'employee_document.manage', 'Manage Employee Documents', 'employee', NOW()),
('employee_document', 'verify', 'employee_document.verify', 'Verify Employee Documents',  'employee', NOW());

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`module` = 'employee_document'
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
