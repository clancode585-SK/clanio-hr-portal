SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `policy_acknowledgements`;
DROP TABLE IF EXISTS `policies`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `policies` (
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`            CHAR(36) NOT NULL,
    `company_id`      BIGINT UNSIGNED NOT NULL,
    `category`        VARCHAR(30) NOT NULL,
    `title`           VARCHAR(200) NOT NULL,
    `version`         VARCHAR(20) NOT NULL DEFAULT '1.0',
    `summary`         VARCHAR(500) NULL,
    `body`            MEDIUMTEXT NULL,
    `file_path`       VARCHAR(255) NULL,
    `original_name`   VARCHAR(200) NULL,
    `mime_type`       VARCHAR(120) NULL,
    `size_bytes`      BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `effective_from`  DATE NOT NULL,
    `review_on`       DATE NULL,
    `needs_ack`       TINYINT(1) NOT NULL DEFAULT 1,
    `ack_due_days`    SMALLINT UNSIGNED NOT NULL DEFAULT 7,
    `status`          VARCHAR(20) NOT NULL DEFAULT 'draft',
    `published_by`    BIGINT UNSIGNED NULL,
    `published_at`    TIMESTAMP NULL,
    `archived_at`     TIMESTAMP NULL,
    `created_by`      BIGINT UNSIGNED NULL,
    `updated_by`      BIGINT UNSIGNED NULL,
    `created_at`      TIMESTAMP NULL,
    `updated_at`      TIMESTAMP NULL,
    `is_active`       TINYINT(1) NOT NULL DEFAULT 1,
    `version_key`     VARCHAR(240) AS (IF(`is_active` = 1, CONCAT(`company_id`, ':', `title`, ':', `version`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_policies_uuid` (`uuid`),
    UNIQUE KEY `uq_policies_version` (`version_key`),
    KEY `ix_policies_company_status` (`company_id`, `status`, `effective_from`),
    KEY `ix_policies_category` (`company_id`, `category`),
    KEY `ix_policies_active` (`company_id`, `is_active`),
    CONSTRAINT `fk_policies_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_policies_publisher` FOREIGN KEY (`published_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `policy_acknowledgements` (
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`            CHAR(36) NOT NULL,
    `company_id`      BIGINT UNSIGNED NOT NULL,
    `policy_id`       BIGINT UNSIGNED NOT NULL,
    `employee_id`     BIGINT UNSIGNED NOT NULL,
    `status`          VARCHAR(20) NOT NULL DEFAULT 'pending',
    `due_on`          DATE NULL,
    `acknowledged_at` TIMESTAMP NULL,
    `ip_address`      VARCHAR(45) NULL,
    `note`            VARCHAR(500) NULL,
    `created_by`      BIGINT UNSIGNED NULL,
    `updated_by`      BIGINT UNSIGNED NULL,
    `created_at`      TIMESTAMP NULL,
    `updated_at`      TIMESTAMP NULL,
    `is_active`       TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_policy_ack_uuid` (`uuid`),
    UNIQUE KEY `uq_policy_ack_employee` (`policy_id`, `employee_id`),
    KEY `ix_policy_ack_employee` (`employee_id`, `status`),
    KEY `ix_policy_ack_active` (`company_id`, `is_active`),
    CONSTRAINT `fk_policy_ack_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_policy_ack_policy` FOREIGN KEY (`policy_id`) REFERENCES `policies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_policy_ack_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELETE rp FROM `role_permissions` rp
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`module` = 'policy';

DELETE FROM `permissions` WHERE `module` = 'policy';

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
('policy', 'manage', 'policy.manage', 'Manage Company Policies', 'policy', NOW());

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`module` = 'policy'
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

ALTER TABLE `companies`
    ADD COLUMN `policy_gate_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `notice_period_days`;

ALTER TABLE `employees`
    ADD COLUMN `policy_gate_cleared_at` TIMESTAMP NULL AFTER `exit_date`;
