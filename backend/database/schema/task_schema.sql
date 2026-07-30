SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `daily_report_items`;
DROP TABLE IF EXISTS `daily_reports`;
DROP TABLE IF EXISTS `task_comments`;
DROP TABLE IF EXISTS `tasks`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `tasks` (
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`            CHAR(36) NOT NULL,
    `company_id`      BIGINT UNSIGNED NOT NULL,
    `title`           VARCHAR(200) NOT NULL,
    `description`     TEXT NULL,
    `assignee_id`     BIGINT UNSIGNED NOT NULL,
    `assigned_by`     BIGINT UNSIGNED NULL,
    `priority`        VARCHAR(10) NOT NULL DEFAULT 'normal',
    `status`          VARCHAR(15) NOT NULL DEFAULT 'todo',
    `due_date`        DATE NULL,
    `estimated_hours` DECIMAL(5,1) NULL,
    `spent_hours`     DECIMAL(7,1) NOT NULL DEFAULT 0,
    `blocked_reason`  VARCHAR(500) NULL,
    `started_at`      TIMESTAMP NULL,
    `completed_at`    TIMESTAMP NULL,
    `created_by`      BIGINT UNSIGNED NULL,
    `updated_by`      BIGINT UNSIGNED NULL,
    `created_at`      TIMESTAMP NULL,
    `updated_at`      TIMESTAMP NULL,
    `deleted_at`      TIMESTAMP NULL,
    `is_open`         TINYINT(1) AS (IF(`status` IN ('done', 'cancelled'), 0, 1)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_tasks_uuid` (`uuid`),
    KEY `ix_tasks_assignee` (`assignee_id`, `is_open`, `due_date`),
    KEY `ix_tasks_company_status` (`company_id`, `status`, `priority`),
    KEY `ix_tasks_creator` (`assigned_by`, `is_open`),
    KEY `ix_tasks_due` (`company_id`, `is_open`, `due_date`),
    CONSTRAINT `fk_tasks_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_tasks_assignee` FOREIGN KEY (`assignee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_tasks_assigner` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `task_comments` (
    `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`       CHAR(36) NOT NULL,
    `company_id` BIGINT UNSIGNED NOT NULL,
    `task_id`    BIGINT UNSIGNED NOT NULL,
    `user_id`    BIGINT UNSIGNED NOT NULL,
    `body`       VARCHAR(2000) NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `created_at` TIMESTAMP NULL,
    `updated_at` TIMESTAMP NULL,
    `deleted_at` TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_task_comments_uuid` (`uuid`),
    KEY `ix_task_comments_task` (`task_id`, `id`),
    KEY `ix_task_comments_company` (`company_id`),
    CONSTRAINT `fk_task_comments_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_task_comments_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_task_comments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `daily_reports` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`              CHAR(36) NOT NULL,
    `company_id`        BIGINT UNSIGNED NOT NULL,
    `employee_id`       BIGINT UNSIGNED NOT NULL,
    `report_date`       DATE NOT NULL,
    `sod_plan`          TEXT NULL,
    `sod_submitted_at`  TIMESTAMP NULL,
    `is_sod_late`       TINYINT(1) NOT NULL DEFAULT 0,
    `eod_summary`       TEXT NULL,
    `eod_blockers`      TEXT NULL,
    `eod_tomorrow_plan` TEXT NULL,
    `worked_hours`      DECIMAL(4,1) NULL,
    `eod_submitted_at`  TIMESTAMP NULL,
    `is_eod_late`       TINYINT(1) NOT NULL DEFAULT 0,
    `created_by`        BIGINT UNSIGNED NULL,
    `updated_by`        BIGINT UNSIGNED NULL,
    `created_at`        TIMESTAMP NULL,
    `updated_at`        TIMESTAMP NULL,
    `status`            VARCHAR(10) AS (
                            CASE
                                WHEN `eod_submitted_at` IS NOT NULL AND `sod_submitted_at` IS NOT NULL THEN 'completed'
                                WHEN `eod_submitted_at` IS NOT NULL THEN 'eod_only'
                                WHEN `sod_submitted_at` IS NOT NULL THEN 'sod_done'
                                ELSE 'pending'
                            END
                        ) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_daily_reports_uuid` (`uuid`),
    UNIQUE KEY `uq_daily_reports_slot` (`employee_id`, `report_date`),
    KEY `ix_daily_reports_company_date` (`company_id`, `report_date`, `status`),
    CONSTRAINT `fk_daily_reports_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_daily_reports_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `daily_report_items` (
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`            CHAR(36) NOT NULL,
    `company_id`      BIGINT UNSIGNED NOT NULL,
    `daily_report_id` BIGINT UNSIGNED NOT NULL,
    `section`         VARCHAR(3) NOT NULL,
    `task_id`         BIGINT UNSIGNED NULL,
    `title`           VARCHAR(200) NOT NULL,
    `hours`           DECIMAL(4,1) NULL,
    `is_completed`    TINYINT(1) NOT NULL DEFAULT 0,
    `sort_order`      TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `created_at`      TIMESTAMP NULL,
    `updated_at`      TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_daily_report_items_uuid` (`uuid`),
    KEY `ix_daily_report_items_report` (`daily_report_id`, `section`, `sort_order`),
    KEY `ix_daily_report_items_task` (`task_id`),
    CONSTRAINT `fk_daily_report_items_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_daily_report_items_report` FOREIGN KEY (`daily_report_id`) REFERENCES `daily_reports` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_daily_report_items_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `companies`
    ADD COLUMN `sod_cutoff` TIME NULL DEFAULT '10:30:00' AFTER `fiscal_year_start`,
    ADD COLUMN `eod_cutoff` TIME NULL DEFAULT '19:30:00' AFTER `sod_cutoff`;

DELETE rp FROM `role_permissions` rp
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`module` IN ('task', 'daily_report');

DELETE FROM `permissions` WHERE `module` IN ('task', 'daily_report');

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
('task',         'edit',      'task.edit',              'Edit Any Task',       'task', NOW()),
('task',         'delete',    'task.delete',            'Delete Any Task',     'task', NOW()),
('daily_report', 'view_team', 'daily_report.view_team', 'View Team SOD / EOD', 'task', NOW());

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`module` IN ('task', 'daily_report')
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
