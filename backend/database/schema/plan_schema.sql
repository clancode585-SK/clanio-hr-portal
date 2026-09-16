SET NAMES utf8mb4;
USE `clanio`;

CREATE TABLE IF NOT EXISTS `plans` (
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`            CHAR(36) NOT NULL,
    `name`            VARCHAR(60) NOT NULL,
    `code`            VARCHAR(30) NOT NULL,
    `tagline`         VARCHAR(150) NULL,
    `price_per_seat`  DECIMAL(10,2) NOT NULL DEFAULT 0,
    `currency`        CHAR(3) NOT NULL DEFAULT 'INR',
    `billing_cycle`   VARCHAR(20) NOT NULL DEFAULT 'monthly',
    `min_seats`       SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `max_seats`       SMALLINT UNSIGNED NOT NULL DEFAULT 1000,
    `trial_days`      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `gst_percent`     DECIMAL(5,2) NOT NULL DEFAULT 18,
    `highlights`      VARCHAR(500) NULL,
    `is_popular`      TINYINT(1) NOT NULL DEFAULT 0,
    `sort_order`      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `created_by`      BIGINT UNSIGNED NULL,
    `updated_by`      BIGINT UNSIGNED NULL,
    `created_at`      TIMESTAMP NULL,
    `updated_at`      TIMESTAMP NULL,
    `is_active`       TINYINT(1) NOT NULL DEFAULT 1,
    `code_key`        VARCHAR(40) AS (IF(`is_active` = 1, `code`, NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_plans_uuid` (`uuid`),
    UNIQUE KEY `uq_plans_code` (`code_key`),
    KEY `ix_plans_active` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_plan := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'plan_id'
);

SET @sql := IF(
    @has_plan = 0,
    'ALTER TABLE `companies` ADD COLUMN `plan_id` BIGINT UNSIGNED NULL AFTER `max_employees`, ADD KEY `ix_companies_plan` (`plan_id`)',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO `plans`
    (`uuid`, `name`, `code`, `tagline`, `price_per_seat`, `min_seats`, `max_seats`, `gst_percent`, `highlights`, `is_popular`, `sort_order`, `created_at`, `updated_at`)
VALUES
    (UUID(), 'Basic', 'basic', 'Small teams getting off spreadsheets', 99.00, 5, 25, 18,
     'Attendance and leave|Employee records|Helpdesk', 0, 1, NOW(), NOW()),
    (UUID(), 'Priority', 'priority', 'Running HR properly, with approvals', 179.00, 10, 100, 18,
     'Everything in Basic|Expenses and assets|Goals and appraisals', 1, 2, NOW(), NOW()),
    (UUID(), 'Enterprise', 'enterprise', 'Multi branch, multi department', 299.00, 25, 500, 18,
     'Everything in Priority|Branches and shifts|Exit and clearance', 0, 3, NOW(), NOW())
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`)
VALUES ('plan', 'manage', 'plan.manage', 'Manage Plans', 'platform', NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
