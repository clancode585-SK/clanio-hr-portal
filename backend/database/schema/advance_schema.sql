SET NAMES utf8mb4;
USE `clanio`;

CREATE TABLE IF NOT EXISTS `salary_advances` (
    `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                  CHAR(36) NOT NULL,
    `company_id`            BIGINT UNSIGNED NOT NULL,
    `employee_id`           BIGINT UNSIGNED NOT NULL,
    `employee_code`         VARCHAR(30) NOT NULL,
    `employee_name`         VARCHAR(150) NOT NULL,
    `reference`             VARCHAR(30) NOT NULL,
    `amount`                DECIMAL(12, 2) NOT NULL,
    `emi_amount`            DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `tenure_months`         SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `recovered`             DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `outstanding`           DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `reason`                VARCHAR(500) NOT NULL,
    `status`                VARCHAR(20) NOT NULL DEFAULT 'pending',
    `payment_status`        VARCHAR(20) NOT NULL DEFAULT 'pending',
    `start_period`          CHAR(7) NULL,
    `decision_note`         VARCHAR(500) NULL,
    `hold_reason`           VARCHAR(255) NULL,
    `requested_at`          TIMESTAMP NULL,
    `decided_at`            TIMESTAMP NULL,
    `decided_by`            BIGINT UNSIGNED NULL,
    `disbursed_at`          TIMESTAMP NULL,
    `closed_at`             TIMESTAMP NULL,
    `is_active`             TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`            BIGINT UNSIGNED NULL,
    `updated_by`            BIGINT UNSIGNED NULL,
    `created_at`            TIMESTAMP NULL,
    `updated_at`            TIMESTAMP NULL,
    `open_key`              VARCHAR(60) AS (IF(`is_active` = 1 AND `status` IN ('pending', 'approved', 'disbursed'), CONCAT(`company_id`, ':', `employee_id`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `salary_advances_uuid_unique` (`uuid`),
    UNIQUE KEY `salary_advances_open_unique` (`open_key`),
    UNIQUE KEY `salary_advances_reference_unique` (`company_id`, `reference`),
    KEY `salary_advances_company_status_index` (`company_id`, `status`),
    KEY `salary_advances_employee_index` (`employee_id`),
    CONSTRAINT `salary_advances_company_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `salary_advances_employee_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `salary_advance_recoveries` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id`    BIGINT UNSIGNED NOT NULL,
    `advance_id`    BIGINT UNSIGNED NOT NULL,
    `employee_id`   BIGINT UNSIGNED NOT NULL,
    `run_id`        BIGINT UNSIGNED NULL,
    `item_id`       BIGINT UNSIGNED NULL,
    `settlement_id` BIGINT UNSIGNED NULL,
    `period`        CHAR(7) NOT NULL,
    `amount`        DECIMAL(12, 2) NOT NULL,
    `source`        VARCHAR(20) NOT NULL DEFAULT 'payroll',
    `note`          VARCHAR(255) NULL,
    `created_by`    BIGINT UNSIGNED NULL,
    `created_at`    TIMESTAMP NULL,
    `updated_at`    TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `advance_recovery_period_unique` (`advance_id`, `period`, `source`),
    KEY `advance_recovery_advance_index` (`advance_id`),
    KEY `advance_recovery_item_index` (`item_id`),
    CONSTRAINT `advance_recovery_advance_foreign` FOREIGN KEY (`advance_id`) REFERENCES `salary_advances` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

ALTER TABLE `salary_disbursements`
    ADD COLUMN `advance_id` BIGINT UNSIGNED NULL AFTER `settlement_id`,
    ADD KEY `salary_disbursements_advance_index` (`advance_id`);

ALTER TABLE `employees`
    ADD COLUMN `insurer_name` VARCHAR(150) NULL AFTER `esic_number`,
    ADD COLUMN `insurance_number` VARCHAR(60) NULL AFTER `insurer_name`,
    ADD COLUMN `insurance_valid_till` DATE NULL AFTER `insurance_number`,
    ADD COLUMN `tax_regime` VARCHAR(10) NOT NULL DEFAULT 'new' AFTER `insurance_valid_till`;

ALTER TABLE `employee_family_members`
    ADD COLUMN `is_insured` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_nominee`;

ALTER TABLE `companies`
    ADD COLUMN `tds_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `pt_monthly_amount`,
    ADD COLUMN `advance_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `tds_enabled`,
    ADD COLUMN `advance_max_multiplier` DECIMAL(5, 2) NOT NULL DEFAULT 2.00 AFTER `advance_enabled`,
    ADD COLUMN `advance_max_tenure` SMALLINT UNSIGNED NOT NULL DEFAULT 12 AFTER `advance_max_multiplier`;

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
    ('advance', 'view',    'advance.view',    'View Salary Advances',           'payroll', NOW()),
    ('advance', 'approve', 'advance.approve', 'Approve Salary Advances',        'payroll', NOW()),
    ('advance', 'manage',  'advance.manage',  'Manage and Transfer Advances',   'payroll', NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`slug` IN ('advance.view', 'advance.approve', 'advance.manage')
  AND r.`slug` IN ('company_admin', 'hr_manager')
ON DUPLICATE KEY UPDATE `role_permissions`.`updated_at` = NOW();

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`slug` = 'advance.view'
  AND r.`slug` = 'finance_manager'
ON DUPLICATE KEY UPDATE `role_permissions`.`updated_at` = NOW();

INSERT INTO `company_modules` (`company_id`, `module`, `is_enabled`, `created_at`, `updated_at`)
SELECT c.`id`, 'advance', 1, NOW(), NOW()
FROM `companies` c
ON DUPLICATE KEY UPDATE `company_modules`.`updated_at` = NOW();
