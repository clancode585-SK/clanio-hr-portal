SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `exit_clearances`;
DROP TABLE IF EXISTS `clearance_items`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `clearance_items` (
    `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`           CHAR(36) NOT NULL,
    `company_id`     BIGINT UNSIGNED NOT NULL,
    `department`     VARCHAR(20) NOT NULL,
    `title`          VARCHAR(150) NOT NULL,
    `description`    VARCHAR(500) NULL,
    `is_recoverable` TINYINT(1) NOT NULL DEFAULT 0,
    `is_mandatory`   TINYINT(1) NOT NULL DEFAULT 1,
    `sort_order`     TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `created_by`     BIGINT UNSIGNED NULL,
    `updated_by`     BIGINT UNSIGNED NULL,
    `created_at`     TIMESTAMP NULL,
    `updated_at`     TIMESTAMP NULL,
    `is_active`      TINYINT(1) NOT NULL DEFAULT 1,
    `item_key`       VARCHAR(180) AS (IF(`is_active` = 1, CONCAT(`company_id`, ':', `department`, ':', `title`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_clearance_items_uuid` (`uuid`),
    UNIQUE KEY `uq_clearance_items_title` (`item_key`),
    KEY `ix_clearance_items_company` (`company_id`, `department`, `sort_order`),
    KEY `ix_clearance_items_active` (`company_id`, `is_active`),
    CONSTRAINT `fk_clearance_items_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `exit_clearances` (
    `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`               CHAR(36) NOT NULL,
    `company_id`         BIGINT UNSIGNED NOT NULL,
    `employee_exit_id`   BIGINT UNSIGNED NOT NULL,
    `clearance_item_id`  BIGINT UNSIGNED NULL,
    `department`         VARCHAR(20) NOT NULL,
    `title`              VARCHAR(150) NOT NULL,
    `is_recoverable`     TINYINT(1) NOT NULL DEFAULT 0,
    `is_mandatory`       TINYINT(1) NOT NULL DEFAULT 1,
    `status`             VARCHAR(20) NOT NULL DEFAULT 'pending',
    `remarks`            VARCHAR(500) NULL,
    `recoverable_amount` DECIMAL(10,2) NOT NULL DEFAULT 0,
    `cleared_by`         BIGINT UNSIGNED NULL,
    `cleared_at`         TIMESTAMP NULL,
    `created_by`         BIGINT UNSIGNED NULL,
    `updated_by`         BIGINT UNSIGNED NULL,
    `created_at`         TIMESTAMP NULL,
    `updated_at`         TIMESTAMP NULL,
    `is_active`          TINYINT(1) NOT NULL DEFAULT 1,
    `is_open`            TINYINT(1) AS (IF(`is_active` = 1 AND `is_mandatory` = 1 AND `status` IN ('pending', 'blocked'), 1, 0)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_exit_clearances_uuid` (`uuid`),
    KEY `ix_exit_clearances_exit` (`employee_exit_id`, `department`),
    KEY `ix_exit_clearances_open` (`employee_exit_id`, `is_open`),
    KEY `ix_exit_clearances_active` (`company_id`, `is_active`),
    CONSTRAINT `fk_exit_clearances_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_exit_clearances_exit` FOREIGN KEY (`employee_exit_id`) REFERENCES `employee_exits` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_exit_clearances_item` FOREIGN KEY (`clearance_item_id`) REFERENCES `clearance_items` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_exit_clearances_user` FOREIGN KEY (`cleared_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `employee_exits`
    ADD COLUMN `clearance_forced_by` BIGINT UNSIGNED NULL AFTER `exited_at`,
    ADD COLUMN `clearance_force_reason` VARCHAR(500) NULL AFTER `clearance_forced_by`,
    ADD CONSTRAINT `fk_employee_exits_force` FOREIGN KEY (`clearance_forced_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

DELETE rp FROM `role_permissions` rp
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`module` = 'clearance';

DELETE FROM `permissions` WHERE `module` = 'clearance';

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
('clearance', 'manage', 'clearance.manage', 'Manage Clearance Checklist', 'exit', NOW()),
('clearance', 'sign',   'clearance.sign',   'Sign Off Exit Clearance',    'exit', NOW());

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`module` = 'clearance'
  AND (
        r.`slug` = 'super_admin'
        OR r.`slug` = 'company_admin'
        OR EXISTS (
            SELECT 1 FROM `role_permissions` rp
            JOIN `permissions` ep ON ep.`id` = rp.`permission_id`
            WHERE rp.`role_id` = r.`id` AND ep.`slug` = 'employee.create'
        )
      );

INSERT INTO `clearance_items`
    (`uuid`, `company_id`, `department`, `title`, `description`, `is_recoverable`, `is_mandatory`, `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), c.`id`, d.`department`, d.`title`, d.`description`, d.`is_recoverable`, 1, d.`sort_order`, NOW(), NOW()
FROM `companies` c
CROSS JOIN (
    SELECT 'it'      AS `department`, 'Laptop wapas'              AS `title`, 'Charger aur bag ke saath'        AS `description`, 1 AS `is_recoverable`, 1 AS `sort_order`
    UNION ALL SELECT 'it',      'ID card wapas',            'Access card bhi',                 1, 2
    UNION ALL SELECT 'it',      'Email aur VPN access band','Sab system se logout',            0, 3
    UNION ALL SELECT 'it',      'Software license wapas',   'Paid tools ke seat free karo',    0, 4
    UNION ALL SELECT 'finance', 'Salary advance clear',     'Koi advance pending to nahi',     1, 1
    UNION ALL SELECT 'finance', 'Loan clear',               'Company loan ka balance',         1, 2
    UNION ALL SELECT 'finance', 'Expense claim settle',     'Pending reimbursement nipta do',  0, 3
    UNION ALL SELECT 'manager', 'Handover document',        'Kaam ka pura handover likha ho',  0, 1
    UNION ALL SELECT 'manager', 'KT session',               'Team ko knowledge transfer',      0, 2
    UNION ALL SELECT 'manager', 'Project access transfer',  'Repo, drive, tools ka owner badlo', 0, 3
    UNION ALL SELECT 'hr',      'Exit interview',           'HR ke saath baithak',             0, 1
    UNION ALL SELECT 'hr',      'Company documents wapas',  'Policy copy, agreement waghera',  0, 2
) d;

DELETE FROM `cache`;
