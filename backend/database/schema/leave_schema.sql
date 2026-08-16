SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `leave_request_days`;
DROP TABLE IF EXISTS `leave_requests`;
DROP TABLE IF EXISTS `leave_balances`;
DROP TABLE IF EXISTS `leave_types`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `leave_types` (
    `id`                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                 CHAR(36) NOT NULL,
    `company_id`           BIGINT UNSIGNED NOT NULL,
    `name`                 VARCHAR(100) NOT NULL,
    `code`                 VARCHAR(20) NOT NULL,
    `description`          VARCHAR(500) NULL,
    `is_paid`              TINYINT(1) NOT NULL DEFAULT 1,
    `annual_quota`         DECIMAL(5,1) NOT NULL DEFAULT 0,
    `accrual_type`         VARCHAR(10) NOT NULL DEFAULT 'yearly',
    `allow_half_day`       TINYINT(1) NOT NULL DEFAULT 1,
    `min_notice_days`      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `max_consecutive_days` SMALLINT UNSIGNED NULL,
    `carry_forward`        TINYINT(1) NOT NULL DEFAULT 0,
    `carry_forward_max`    DECIMAL(5,1) NULL,
    `is_encashable`        TINYINT(1) NOT NULL DEFAULT 0,
    `encashment_max`       DECIMAL(5,1) NULL,
    `applicable_to`        VARCHAR(10) NOT NULL DEFAULT 'all',
    `min_service_months`   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `count_weekly_off`     TINYINT(1) NOT NULL DEFAULT 0,
    `count_holiday`        TINYINT(1) NOT NULL DEFAULT 0,
    `requires_document`    TINYINT(1) NOT NULL DEFAULT 0,
    `sort_order`           TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `status`               VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_by`           BIGINT UNSIGNED NULL,
    `updated_by`           BIGINT UNSIGNED NULL,
    `created_at`           TIMESTAMP NULL,
    `updated_at`           TIMESTAMP NULL,
    `deleted_at`           TIMESTAMP NULL,
    `type_key`             VARCHAR(60) AS (IF(`deleted_at` IS NULL, CONCAT(`company_id`, ':', `code`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_leave_types_uuid` (`uuid`),
    UNIQUE KEY `uq_leave_types_active_code` (`type_key`),
    KEY `ix_leave_types_company_status` (`company_id`, `status`, `sort_order`),
    CONSTRAINT `fk_leave_types_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `leave_balances` (
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`            CHAR(36) NOT NULL,
    `company_id`      BIGINT UNSIGNED NOT NULL,
    `employee_id`     BIGINT UNSIGNED NOT NULL,
    `leave_type_id`   BIGINT UNSIGNED NOT NULL,
    `year`            SMALLINT UNSIGNED NOT NULL,
    `opening`         DECIMAL(6,2) NOT NULL DEFAULT 0,
    `accrued`         DECIMAL(6,2) NOT NULL DEFAULT 0,
    `used`            DECIMAL(6,2) NOT NULL DEFAULT 0,
    `encashed`        DECIMAL(6,2) NOT NULL DEFAULT 0,
    `adjusted`        DECIMAL(6,2) NOT NULL DEFAULT 0,
    `available`       DECIMAL(8,2) AS (`opening` + `accrued` + `adjusted` - `used` - `encashed`) STORED,
    `last_accrued_on` VARCHAR(7) NULL,
    `created_by`      BIGINT UNSIGNED NULL,
    `updated_by`      BIGINT UNSIGNED NULL,
    `created_at`      TIMESTAMP NULL,
    `updated_at`      TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_leave_balances_uuid` (`uuid`),
    UNIQUE KEY `uq_leave_balances_slot` (`employee_id`, `leave_type_id`, `year`),
    KEY `ix_leave_balances_company_year` (`company_id`, `year`),
    KEY `ix_leave_balances_type` (`leave_type_id`),
    CONSTRAINT `fk_leave_balances_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_leave_balances_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_leave_balances_type` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `leave_requests` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`             CHAR(36) NOT NULL,
    `company_id`       BIGINT UNSIGNED NOT NULL,
    `employee_id`      BIGINT UNSIGNED NOT NULL,
    `leave_type_id`    BIGINT UNSIGNED NOT NULL,
    `from_date`        DATE NOT NULL,
    `to_date`          DATE NOT NULL,
    `day_count`        DECIMAL(4,1) NOT NULL DEFAULT 0,
    `is_half_day`      TINYINT(1) NOT NULL DEFAULT 0,
    `half_day_session` VARCHAR(12) NULL,
    `reason`           VARCHAR(500) NOT NULL,
    `contact_number`   VARCHAR(20) NULL,
    `document_id`      BIGINT UNSIGNED NULL,
    `status`           VARCHAR(20) NOT NULL DEFAULT 'pending',
    `approver_id`      BIGINT UNSIGNED NULL,
    `decided_at`       TIMESTAMP NULL,
    `decision_remarks` VARCHAR(500) NULL,
    `cancelled_at`     TIMESTAMP NULL,
    `applied_by`       BIGINT UNSIGNED NULL,
    `created_by`       BIGINT UNSIGNED NULL,
    `updated_by`       BIGINT UNSIGNED NULL,
    `created_at`       TIMESTAMP NULL,
    `updated_at`       TIMESTAMP NULL,
    `deleted_at`       TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_leave_requests_uuid` (`uuid`),
    KEY `ix_leave_requests_employee_status` (`employee_id`, `status`),
    KEY `ix_leave_requests_company_dates` (`company_id`, `from_date`, `to_date`),
    KEY `ix_leave_requests_type` (`leave_type_id`),
    KEY `ix_leave_requests_approver` (`approver_id`),
    CONSTRAINT `fk_leave_requests_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_leave_requests_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_leave_requests_type` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_leave_requests_document` FOREIGN KEY (`document_id`) REFERENCES `employee_documents` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_leave_requests_approver` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `leave_request_days` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id`       BIGINT UNSIGNED NOT NULL,
    `leave_request_id` BIGINT UNSIGNED NOT NULL,
    `employee_id`      BIGINT UNSIGNED NOT NULL,
    `leave_date`       DATE NOT NULL,
    `day_portion`      DECIMAL(3,1) NOT NULL DEFAULT 1.0,
    `session`          VARCHAR(12) NULL,
    `status`           VARCHAR(20) NOT NULL DEFAULT 'pending',
    `created_at`       TIMESTAMP NULL,
    `updated_at`       TIMESTAMP NULL,
    `day_key`          VARCHAR(60) AS (IF(`status` IN ('pending', 'approved'), CONCAT(`employee_id`, ':', `leave_date`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_leave_request_days_open` (`day_key`),
    KEY `ix_leave_request_days_request` (`leave_request_id`),
    KEY `ix_leave_request_days_employee` (`employee_id`, `leave_date`),
    KEY `ix_leave_request_days_company` (`company_id`, `leave_date`, `status`),
    CONSTRAINT `fk_leave_request_days_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_leave_request_days_request` FOREIGN KEY (`leave_request_id`) REFERENCES `leave_requests` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_leave_request_days_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `attendances`
    ADD COLUMN `leave_portion` DECIMAL(3,1) NOT NULL DEFAULT 0 AFTER `late_minutes`;

DELETE rp FROM `role_permissions` rp
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`module` IN ('leave_type', 'leave', 'leave_balance');

DELETE FROM `permissions` WHERE `module` IN ('leave_type', 'leave', 'leave_balance');

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
('leave_type',    'view',    'leave_type.view',      'View Leave Types',      'leave', NOW()),
('leave_type',    'create',  'leave_type.create',    'Create Leave Type',     'leave', NOW()),
('leave_type',    'edit',    'leave_type.edit',      'Edit Leave Type',       'leave', NOW()),
('leave_type',    'delete',  'leave_type.delete',    'Delete Leave Type',     'leave', NOW()),
('leave_balance', 'view',    'leave_balance.view',   'View Leave Balances',   'leave', NOW()),
('leave_balance', 'manage',  'leave_balance.manage', 'Manage Leave Balances', 'leave', NOW()),
('leave',         'approve', 'leave.approve',        'Approve Any Leave',     'leave', NOW());

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`module` IN ('leave_type', 'leave', 'leave_balance')
  AND (
        r.`slug` = 'super_admin'
        OR r.`slug` = 'company_admin'
        OR EXISTS (
            SELECT 1 FROM `role_permissions` rp
            JOIN `permissions` ep ON ep.`id` = rp.`permission_id`
            WHERE rp.`role_id` = r.`id` AND ep.`slug` = 'employee.create'
        )
      );

INSERT INTO `leave_types`
    (`uuid`, `company_id`, `name`, `code`, `description`, `is_paid`, `annual_quota`, `accrual_type`,
     `allow_half_day`, `min_notice_days`, `max_consecutive_days`, `carry_forward`, `carry_forward_max`,
     `is_encashable`, `encashment_max`, `applicable_to`, `min_service_months`, `requires_document`,
     `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), c.`id`, t.`name`, t.`code`, t.`description`, t.`is_paid`, t.`annual_quota`, t.`accrual_type`,
       t.`allow_half_day`, t.`min_notice_days`, t.`max_consecutive_days`, t.`carry_forward`, t.`carry_forward_max`,
       t.`is_encashable`, t.`encashment_max`, t.`applicable_to`, t.`min_service_months`, t.`requires_document`,
       t.`sort_order`, NOW(), NOW()
FROM `companies` c
CROSS JOIN (
    SELECT 'Casual Leave'      AS `name`, 'CL'   AS `code`, 'Short personal leave'                 AS `description`, 1 AS `is_paid`, 12.0 AS `annual_quota`, 'monthly' AS `accrual_type`, 1 AS `allow_half_day`, 1 AS `min_notice_days`, 3    AS `max_consecutive_days`, 0 AS `carry_forward`, NULL AS `carry_forward_max`, 0 AS `is_encashable`, NULL AS `encashment_max`, 'all'    AS `applicable_to`, 0  AS `min_service_months`, 0 AS `requires_document`, 1 AS `sort_order`
    UNION ALL SELECT 'Sick Leave',        'SL',   'Illness ke liye',                        1, 12.0,  'monthly', 1, 0, NULL, 0, NULL, 0, NULL, 'all',    0,  1, 2
    UNION ALL SELECT 'Earned Leave',      'EL',   'Privilege leave, carry forward hoti hai', 1, 15.0,  'monthly', 1, 3, NULL, 1, 30.0, 1, 15.0, 'all',    0,  0, 3
    UNION ALL SELECT 'Maternity Leave',   'ML',   'Maternity benefit',                      1, 182.0, 'yearly',  0, 30, 182,  0, NULL, 0, NULL, 'female', 0,  1, 4
    UNION ALL SELECT 'Paternity Leave',   'PL',   'Paternity leave',                        1, 15.0,  'yearly',  0, 15, 15,   0, NULL, 0, NULL, 'male',   0,  0, 5
    UNION ALL SELECT 'Leave Without Pay', 'LWP',  'Balance khatam hone par unpaid leave',   0, 0.0,   'yearly',  1, 0, NULL, 0, NULL, 0, NULL, 'all',    0,  0, 6
) t;

DELETE FROM `cache`;
