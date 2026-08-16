SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `holidays`;
DROP TABLE IF EXISTS `work_shifts`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `work_shifts` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`             CHAR(36) NOT NULL,
    `company_id`       BIGINT UNSIGNED NOT NULL,
    `name`             VARCHAR(150) NOT NULL,
    `code`             VARCHAR(30) NOT NULL,
    `start_time`       TIME NOT NULL DEFAULT '09:30:00',
    `end_time`         TIME NOT NULL DEFAULT '18:30:00',
    `grace_minutes`    SMALLINT UNSIGNED NOT NULL DEFAULT 15,
    `half_day_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 240,
    `full_day_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 480,
    `weekly_offs`      JSON NOT NULL,
    `is_default`       TINYINT(1) NOT NULL DEFAULT 0,
    `status`           VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_by`       BIGINT UNSIGNED NULL,
    `updated_by`       BIGINT UNSIGNED NULL,
    `created_at`       TIMESTAMP NULL,
    `updated_at`       TIMESTAMP NULL,
    `deleted_at`       TIMESTAMP NULL,
    `shift_key`        VARCHAR(80) AS (IF(`deleted_at` IS NULL, CONCAT(`company_id`, ':', `code`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_work_shifts_uuid` (`uuid`),
    UNIQUE KEY `uq_work_shifts_active_code` (`shift_key`),
    KEY `ix_work_shifts_company_status` (`company_id`, `status`),
    KEY `ix_work_shifts_default` (`company_id`, `is_default`),
    CONSTRAINT `fk_work_shifts_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `holidays` (
    `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`         CHAR(36) NOT NULL,
    `company_id`   BIGINT UNSIGNED NOT NULL,
    `branch_id`    BIGINT UNSIGNED NULL,
    `name`         VARCHAR(150) NOT NULL,
    `holiday_date` DATE NOT NULL,
    `type`         VARCHAR(20) NOT NULL DEFAULT 'public',
    `is_paid`      TINYINT(1) NOT NULL DEFAULT 1,
    `description`  VARCHAR(500) NULL,
    `created_by`   BIGINT UNSIGNED NULL,
    `updated_by`   BIGINT UNSIGNED NULL,
    `created_at`   TIMESTAMP NULL,
    `updated_at`   TIMESTAMP NULL,
    `deleted_at`   TIMESTAMP NULL,
    `holiday_key`  VARCHAR(80) AS (IF(`deleted_at` IS NULL, CONCAT(`company_id`, ':', IFNULL(`branch_id`, 0), ':', `holiday_date`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_holidays_uuid` (`uuid`),
    UNIQUE KEY `uq_holidays_active_date` (`holiday_key`),
    KEY `ix_holidays_company_date` (`company_id`, `holiday_date`),
    CONSTRAINT `fk_holidays_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_holidays_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `employees`
    ADD COLUMN `work_shift_id` BIGINT UNSIGNED NULL AFTER `designation_id`,
    ADD KEY `ix_employees_work_shift` (`work_shift_id`),
    ADD CONSTRAINT `fk_employees_work_shift` FOREIGN KEY (`work_shift_id`) REFERENCES `work_shifts` (`id`) ON DELETE SET NULL;

ALTER TABLE `attendances`
    ADD COLUMN `work_shift_id` BIGINT UNSIGNED NULL AFTER `employee_id`,
    ADD COLUMN `is_late` TINYINT(1) NOT NULL DEFAULT 0 AFTER `punch_count`,
    ADD COLUMN `late_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `is_late`,
    ADD KEY `ix_attendances_work_shift` (`work_shift_id`),
    ADD CONSTRAINT `fk_attendances_work_shift` FOREIGN KEY (`work_shift_id`) REFERENCES `work_shifts` (`id`) ON DELETE SET NULL;

DELETE rp FROM `role_permissions` rp
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`module` IN ('work_shift', 'holiday');

DELETE FROM `permissions` WHERE `module` IN ('work_shift', 'holiday');

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
('work_shift', 'view',   'work_shift.view',   'View Work Shift',   'schedule', NOW()),
('work_shift', 'create', 'work_shift.create', 'Create Work Shift', 'schedule', NOW()),
('work_shift', 'edit',   'work_shift.edit',   'Edit Work Shift',   'schedule', NOW()),
('work_shift', 'delete', 'work_shift.delete', 'Delete Work Shift', 'schedule', NOW()),
('holiday',    'view',   'holiday.view',      'View Holiday',      'schedule', NOW()),
('holiday',    'create', 'holiday.create',    'Create Holiday',    'schedule', NOW()),
('holiday',    'edit',   'holiday.edit',      'Edit Holiday',      'schedule', NOW()),
('holiday',    'delete', 'holiday.delete',    'Delete Holiday',    'schedule', NOW());

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`module` IN ('work_shift', 'holiday')
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
