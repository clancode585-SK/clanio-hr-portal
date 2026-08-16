SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `incentive_records`;
DROP TABLE IF EXISTS `incentive_slabs`;
DROP TABLE IF EXISTS `incentive_rules`;
SET FOREIGN_KEY_CHECKS = 1;

ALTER TABLE `performance_goals`
    ADD COLUMN `verification_status`  VARCHAR(20) NOT NULL DEFAULT 'not_submitted' AFTER `status`,
    ADD COLUMN `submitted_value`      DECIMAL(12,2) NULL AFTER `verification_status`,
    ADD COLUMN `submitted_at`         TIMESTAMP NULL AFTER `submitted_value`,
    ADD COLUMN `manager_value`        DECIMAL(12,2) NULL AFTER `submitted_at`,
    ADD COLUMN `manager_verified_by`  BIGINT UNSIGNED NULL AFTER `manager_value`,
    ADD COLUMN `manager_verified_at`  TIMESTAMP NULL AFTER `manager_verified_by`,
    ADD COLUMN `manager_remarks`      VARCHAR(500) NULL AFTER `manager_verified_at`,
    ADD COLUMN `final_value`          DECIMAL(12,2) NULL AFTER `manager_remarks`,
    ADD COLUMN `achievement_percent`  TINYINT UNSIGNED NULL AFTER `final_value`,
    ADD COLUMN `hr_verified_by`       BIGINT UNSIGNED NULL AFTER `achievement_percent`,
    ADD COLUMN `hr_verified_at`       TIMESTAMP NULL AFTER `hr_verified_by`,
    ADD COLUMN `hr_remarks`           VARCHAR(500) NULL AFTER `hr_verified_at`,
    ADD KEY `ix_performance_goals_verification` (`company_id`, `verification_status`),
    ADD CONSTRAINT `fk_performance_goals_manager` FOREIGN KEY (`manager_verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    ADD CONSTRAINT `fk_performance_goals_hr` FOREIGN KEY (`hr_verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

CREATE TABLE `incentive_rules` (
    `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`         CHAR(36) NOT NULL,
    `company_id`   BIGINT UNSIGNED NOT NULL,
    `name`         VARCHAR(100) NOT NULL,
    `role_id`      BIGINT UNSIGNED NULL,
    `base_percent` DECIMAL(5,2) NOT NULL DEFAULT 0,
    `period_type`  VARCHAR(10) NOT NULL DEFAULT 'month',
    `description`  VARCHAR(500) NULL,
    `created_by`   BIGINT UNSIGNED NULL,
    `updated_by`   BIGINT UNSIGNED NULL,
    `created_at`   TIMESTAMP NULL,
    `updated_at`   TIMESTAMP NULL,
    `is_active`    TINYINT(1) NOT NULL DEFAULT 1,
    `rule_key`     VARCHAR(80) AS (IF(`is_active` = 1, CONCAT(`company_id`, ':', IFNULL(`role_id`, 0), ':', `period_type`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_incentive_rules_uuid` (`uuid`),
    UNIQUE KEY `uq_incentive_rules_role` (`rule_key`),
    KEY `ix_incentive_rules_company` (`company_id`, `is_active`),
    CONSTRAINT `fk_incentive_rules_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_incentive_rules_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `incentive_slabs` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id`        BIGINT UNSIGNED NOT NULL,
    `incentive_rule_id` BIGINT UNSIGNED NOT NULL,
    `from_percent`      SMALLINT UNSIGNED NOT NULL,
    `to_percent`        SMALLINT UNSIGNED NOT NULL,
    `payout_factor`     SMALLINT UNSIGNED NOT NULL DEFAULT 100,
    `label`             VARCHAR(60) NULL,
    `created_at`        TIMESTAMP NULL,
    `updated_at`        TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_incentive_slabs_range` (`incentive_rule_id`, `from_percent`),
    KEY `ix_incentive_slabs_rule` (`incentive_rule_id`, `from_percent`, `to_percent`),
    CONSTRAINT `fk_incentive_slabs_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_incentive_slabs_rule` FOREIGN KEY (`incentive_rule_id`) REFERENCES `incentive_rules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `incentive_records` (
    `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                CHAR(36) NOT NULL,
    `company_id`          BIGINT UNSIGNED NOT NULL,
    `employee_id`         BIGINT UNSIGNED NOT NULL,
    `incentive_rule_id`   BIGINT UNSIGNED NULL,

    `period_type`         VARCHAR(10) NOT NULL DEFAULT 'month',
    `period_label`        VARCHAR(30) NOT NULL,
    `period_start`        DATE NOT NULL,
    `period_end`          DATE NOT NULL,

    `goal_count`          SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `achievement_percent` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `base_percent`        DECIMAL(5,2) NOT NULL DEFAULT 0,
    `payout_factor`       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `incentive_percent`   DECIMAL(6,2) NOT NULL DEFAULT 0,
    `slab_label`          VARCHAR(60) NULL,

    `status`              VARCHAR(20) NOT NULL DEFAULT 'calculated',
    `calculated_at`       TIMESTAMP NULL,
    `approved_by`         BIGINT UNSIGNED NULL,
    `approved_at`         TIMESTAMP NULL,
    `remarks`             VARCHAR(500) NULL,

    `created_by`          BIGINT UNSIGNED NULL,
    `updated_by`          BIGINT UNSIGNED NULL,
    `created_at`          TIMESTAMP NULL,
    `updated_at`          TIMESTAMP NULL,
    `is_active`           TINYINT(1) NOT NULL DEFAULT 1,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_incentive_records_uuid` (`uuid`),
    UNIQUE KEY `uq_incentive_records_period` (`employee_id`, `period_type`, `period_label`),
    KEY `ix_incentive_records_company` (`company_id`, `period_label`, `status`),
    KEY `ix_incentive_records_active` (`company_id`, `is_active`),
    CONSTRAINT `fk_incentive_records_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_incentive_records_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_incentive_records_rule` FOREIGN KEY (`incentive_rule_id`) REFERENCES `incentive_rules` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_incentive_records_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELETE rp FROM `role_permissions` rp
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`slug` IN ('incentive.manage', 'incentive.approve', 'okr.verify');

DELETE FROM `permissions` WHERE `slug` IN ('incentive.manage', 'incentive.approve', 'okr.verify');

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
('performance', 'verify_okr',       'okr.verify',        'Verify OKR Achievement',   'performance', NOW()),
('performance', 'manage_incentive', 'incentive.manage',  'Manage Incentive Rules',   'performance', NOW()),
('performance', 'approve_incentive','incentive.approve', 'Approve Incentive Payout', 'performance', NOW());

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`slug` IN ('okr.verify', 'incentive.manage', 'incentive.approve')
  AND (
        r.`slug` = 'super_admin'
        OR r.`slug` = 'company_admin'
        OR EXISTS (
            SELECT 1 FROM `role_permissions` rp
            JOIN `permissions` ep ON ep.`id` = rp.`permission_id`
            WHERE rp.`role_id` = r.`id` AND ep.`slug` = 'employee.create'
        )
      );

INSERT INTO `incentive_rules` (`uuid`, `company_id`, `name`, `role_id`, `base_percent`, `period_type`, `description`, `created_at`, `updated_at`)
SELECT UUID(), c.`id`, 'Default monthly incentive', NULL, 10.00, 'month',
       'Sabke liye default — company chahe to role-wise alag rule bana sakti hai', NOW(), NOW()
FROM `companies` c;

INSERT INTO `incentive_slabs` (`company_id`, `incentive_rule_id`, `from_percent`, `to_percent`, `payout_factor`, `label`, `created_at`, `updated_at`)
SELECT r.`company_id`, r.`id`, s.`from_percent`, s.`to_percent`, s.`payout_factor`, s.`label`, NOW(), NOW()
FROM `incentive_rules` r
CROSS JOIN (
    SELECT 0   AS `from_percent`, 69  AS `to_percent`, 0   AS `payout_factor`, 'Target se bahut peeche' AS `label`
    UNION ALL SELECT 70,  89,  50,  'Aadha incentive'
    UNION ALL SELECT 90,  100, 100, 'Pura incentive'
    UNION ALL SELECT 101, 999, 120, 'Target se upar, bonus'
) s;

DELETE FROM `cache`;
