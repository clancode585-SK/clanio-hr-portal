SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `recognitions`;
SET FOREIGN_KEY_CHECKS = 1;

ALTER TABLE `performance_goals`
    ADD COLUMN `period_type` VARCHAR(10) NOT NULL DEFAULT 'quarter' AFTER `goal_type`,
    ADD COLUMN `period_label` VARCHAR(30) NULL AFTER `period_type`,
    ADD KEY `ix_performance_goals_period` (`employee_id`, `period_type`, `start_date`);

ALTER TABLE `companies`
    ADD COLUMN `perf_goal_weight` TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER `perf_discipline_weight`;

CREATE TABLE `recognitions` (
    `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                CHAR(36) NOT NULL,
    `company_id`          BIGINT UNSIGNED NOT NULL,
    `employee_id`         BIGINT UNSIGNED NOT NULL,
    `given_by`            BIGINT UNSIGNED NULL,
    `performance_goal_id` BIGINT UNSIGNED NULL,
    `type`                VARCHAR(20) NOT NULL DEFAULT 'kudos',
    `title`               VARCHAR(200) NOT NULL,
    `message`             VARCHAR(1000) NULL,
    `points`              SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `is_auto`             TINYINT(1) NOT NULL DEFAULT 0,
    `visibility`          VARCHAR(10) NOT NULL DEFAULT 'public',
    `awarded_on`          DATE NOT NULL,
    `created_by`          BIGINT UNSIGNED NULL,
    `updated_by`          BIGINT UNSIGNED NULL,
    `created_at`          TIMESTAMP NULL,
    `updated_at`          TIMESTAMP NULL,
    `is_active`           TINYINT(1) NOT NULL DEFAULT 1,
    `goal_key`            VARCHAR(40) AS (IF(`is_active` = 1 AND `is_auto` = 1, `performance_goal_id`, NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_recognitions_uuid` (`uuid`),
    UNIQUE KEY `uq_recognitions_auto_goal` (`goal_key`),
    KEY `ix_recognitions_employee` (`employee_id`, `awarded_on`),
    KEY `ix_recognitions_company` (`company_id`, `awarded_on`),
    KEY `ix_recognitions_active` (`company_id`, `is_active`),
    CONSTRAINT `fk_recognitions_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_recognitions_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_recognitions_giver` FOREIGN KEY (`given_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_recognitions_goal` FOREIGN KEY (`performance_goal_id`) REFERENCES `performance_goals` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELETE rp FROM `role_permissions` rp
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`slug` = 'recognition.give';

DELETE FROM `permissions` WHERE `slug` = 'recognition.give';

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
('performance', 'recognise', 'recognition.give', 'Give Recognition', 'performance', NOW());

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`slug` = 'recognition.give'
  AND (
        r.`slug` = 'super_admin'
        OR r.`slug` = 'company_admin'
        OR r.`hierarchy_level` <= 4
      );

DELETE FROM `cache`;
