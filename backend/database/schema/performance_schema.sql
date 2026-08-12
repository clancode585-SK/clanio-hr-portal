SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `appraisals`;
DROP TABLE IF EXISTS `appraisal_cycles`;
DROP TABLE IF EXISTS `performance_goal_tasks`;
DROP TABLE IF EXISTS `performance_goals`;
DROP TABLE IF EXISTS `performance_scores`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `performance_scores` (
    `id`                        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                      CHAR(36) NOT NULL,
    `company_id`                BIGINT UNSIGNED NOT NULL,
    `employee_id`               BIGINT UNSIGNED NOT NULL,
    `period_month`              DATE NOT NULL,

    `score`                     TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `delivery_score`            TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `discipline_score`          TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `penalty`                   TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `goal_score`                TINYINT UNSIGNED NULL,

    `tasks_assigned`            SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `tasks_done`                SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `tasks_overdue`             SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `on_time_percent`           TINYINT UNSIGNED NULL,

    `report_expected`           SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `report_completed`          SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `report_compliance_percent` TINYINT UNSIGNED NULL,

    `present_days`              SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `absent_days`               SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `late_days`                 SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `leave_days`                DECIMAL(5,1) NOT NULL DEFAULT 0,
    `hours_logged`              DECIMAL(7,1) NOT NULL DEFAULT 0,

    `is_frozen`                 TINYINT(1) NOT NULL DEFAULT 0,
    `frozen_at`                 TIMESTAMP NULL,
    `computed_at`               TIMESTAMP NULL,

    `created_by`                BIGINT UNSIGNED NULL,
    `updated_by`                BIGINT UNSIGNED NULL,
    `created_at`                TIMESTAMP NULL,
    `updated_at`                TIMESTAMP NULL,
    `is_active`                 TINYINT(1) NOT NULL DEFAULT 1,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_performance_scores_uuid` (`uuid`),
    UNIQUE KEY `uq_performance_scores_month` (`employee_id`, `period_month`),
    KEY `ix_performance_scores_company` (`company_id`, `period_month`),
    KEY `ix_performance_scores_active` (`company_id`, `is_active`),
    CONSTRAINT `fk_performance_scores_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_performance_scores_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `appraisal_cycles` (
    `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                CHAR(36) NOT NULL,
    `company_id`          BIGINT UNSIGNED NOT NULL,
    `name`                VARCHAR(100) NOT NULL,
    `period_start`        DATE NOT NULL,
    `period_end`          DATE NOT NULL,
    `self_review_due`     DATE NULL,
    `manager_review_due`  DATE NULL,
    `rating_scale`        TINYINT UNSIGNED NOT NULL DEFAULT 5,
    `status`              VARCHAR(20) NOT NULL DEFAULT 'draft',
    `launched_at`         TIMESTAMP NULL,
    `closed_at`           TIMESTAMP NULL,
    `created_by`          BIGINT UNSIGNED NULL,
    `updated_by`          BIGINT UNSIGNED NULL,
    `created_at`          TIMESTAMP NULL,
    `updated_at`          TIMESTAMP NULL,
    `is_active`           TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_appraisal_cycles_uuid` (`uuid`),
    KEY `ix_appraisal_cycles_company` (`company_id`, `status`, `period_start`),
    KEY `ix_appraisal_cycles_active` (`company_id`, `is_active`),
    CONSTRAINT `fk_appraisal_cycles_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `performance_goals` (
    `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                CHAR(36) NOT NULL,
    `company_id`          BIGINT UNSIGNED NOT NULL,
    `employee_id`         BIGINT UNSIGNED NOT NULL,
    `appraisal_cycle_id`  BIGINT UNSIGNED NULL,
    `parent_id`           BIGINT UNSIGNED NULL,
    `goal_type`           VARCHAR(15) NOT NULL DEFAULT 'kra',

    `title`               VARCHAR(200) NOT NULL,
    `description`         VARCHAR(1000) NULL,
    `metric`              VARCHAR(100) NULL,
    `target_value`        DECIMAL(12,2) NULL,
    `achieved_value`      DECIMAL(12,2) NULL,
    `weight`              TINYINT UNSIGNED NOT NULL DEFAULT 0,

    `start_date`          DATE NOT NULL,
    `due_date`            DATE NOT NULL,

    `progress_source`     VARCHAR(10) NOT NULL DEFAULT 'manual',
    `progress_percent`    TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `status`              VARCHAR(20) NOT NULL DEFAULT 'draft',

    `approved_by`         BIGINT UNSIGNED NULL,
    `approved_at`         TIMESTAMP NULL,
    `closed_at`           TIMESTAMP NULL,
    `closing_remarks`     VARCHAR(500) NULL,

    `created_by`          BIGINT UNSIGNED NULL,
    `updated_by`          BIGINT UNSIGNED NULL,
    `created_at`          TIMESTAMP NULL,
    `updated_at`          TIMESTAMP NULL,
    `is_active`           TINYINT(1) NOT NULL DEFAULT 1,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_performance_goals_uuid` (`uuid`),
    KEY `ix_performance_goals_employee` (`employee_id`, `status`, `due_date`),
    KEY `ix_performance_goals_cycle` (`appraisal_cycle_id`),
    KEY `ix_performance_goals_parent` (`parent_id`),
    KEY `ix_performance_goals_type` (`company_id`, `goal_type`),
    KEY `ix_performance_goals_active` (`company_id`, `is_active`),
    CONSTRAINT `fk_performance_goals_parent` FOREIGN KEY (`parent_id`) REFERENCES `performance_goals` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_performance_goals_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_performance_goals_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_performance_goals_cycle` FOREIGN KEY (`appraisal_cycle_id`) REFERENCES `appraisal_cycles` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_performance_goals_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `performance_goal_tasks` (
    `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id`            BIGINT UNSIGNED NOT NULL,
    `performance_goal_id`   BIGINT UNSIGNED NOT NULL,
    `task_id`               BIGINT UNSIGNED NOT NULL,
    `created_at`            TIMESTAMP NULL,
    `updated_at`            TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_goal_task` (`performance_goal_id`, `task_id`),
    KEY `ix_goal_tasks_task` (`task_id`),
    CONSTRAINT `fk_goal_tasks_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_goal_tasks_goal` FOREIGN KEY (`performance_goal_id`) REFERENCES `performance_goals` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_goal_tasks_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `appraisals` (
    `id`                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                     CHAR(36) NOT NULL,
    `company_id`               BIGINT UNSIGNED NOT NULL,
    `appraisal_cycle_id`       BIGINT UNSIGNED NOT NULL,
    `employee_id`              BIGINT UNSIGNED NOT NULL,
    `manager_id`               BIGINT UNSIGNED NULL,

    `status`                   VARCHAR(20) NOT NULL DEFAULT 'pending',

    `auto_score`               TINYINT UNSIGNED NULL,
    `goal_achievement_percent` TINYINT UNSIGNED NULL,

    `self_rating`              DECIMAL(3,1) NULL,
    `self_comments`            VARCHAR(2000) NULL,
    `self_submitted_at`        TIMESTAMP NULL,

    `manager_rating`           DECIMAL(3,1) NULL,
    `manager_comments`         VARCHAR(2000) NULL,
    `manager_submitted_at`     TIMESTAMP NULL,

    `final_rating`             DECIMAL(3,1) NULL,
    `final_comments`           VARCHAR(2000) NULL,
    `hr_id`                    BIGINT UNSIGNED NULL,
    `finalised_at`             TIMESTAMP NULL,

    `created_by`               BIGINT UNSIGNED NULL,
    `updated_by`               BIGINT UNSIGNED NULL,
    `created_at`               TIMESTAMP NULL,
    `updated_at`               TIMESTAMP NULL,
    `is_active`                TINYINT(1) NOT NULL DEFAULT 1,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_appraisals_uuid` (`uuid`),
    UNIQUE KEY `uq_appraisals_cycle_employee` (`appraisal_cycle_id`, `employee_id`),
    KEY `ix_appraisals_employee` (`employee_id`, `status`),
    KEY `ix_appraisals_manager` (`manager_id`, `status`),
    KEY `ix_appraisals_active` (`company_id`, `is_active`),
    CONSTRAINT `fk_appraisals_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_appraisals_cycle` FOREIGN KEY (`appraisal_cycle_id`) REFERENCES `appraisal_cycles` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_appraisals_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_appraisals_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_appraisals_hr` FOREIGN KEY (`hr_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- weights sirf ek baar add karne hain
ALTER TABLE `companies`
    ADD COLUMN `perf_delivery_weight`       TINYINT UNSIGNED NOT NULL DEFAULT 50 AFTER `notice_period_days`,
    ADD COLUMN `perf_discipline_weight`     TINYINT UNSIGNED NOT NULL DEFAULT 50 AFTER `perf_delivery_weight`,
    ADD COLUMN `perf_overdue_penalty`       TINYINT UNSIGNED NOT NULL DEFAULT 3  AFTER `perf_discipline_weight`,
    ADD COLUMN `perf_absent_penalty`        TINYINT UNSIGNED NOT NULL DEFAULT 4  AFTER `perf_overdue_penalty`,
    ADD COLUMN `perf_missed_report_penalty` TINYINT UNSIGNED NOT NULL DEFAULT 2  AFTER `perf_absent_penalty`;

DELETE rp FROM `role_permissions` rp
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`module` = 'performance';

DELETE FROM `permissions` WHERE `module` = 'performance';

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
('performance', 'manage',   'performance.manage',   'Manage Appraisal Cycles',   'performance', NOW()),
('performance', 'finalise', 'performance.finalise', 'Finalise Appraisal Rating', 'performance', NOW());

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`module` = 'performance'
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
