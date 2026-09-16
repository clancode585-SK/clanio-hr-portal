SET NAMES utf8mb4;
USE `clanio`;

CREATE TABLE IF NOT EXISTS `payroll_runs` (
    `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`               CHAR(36) NOT NULL,
    `company_id`         BIGINT UNSIGNED NOT NULL,
    `month`              CHAR(7) NOT NULL,
    `pay_date`           DATE NOT NULL,
    `status`             VARCHAR(20) NOT NULL DEFAULT 'draft',
    `headcount`          SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `working_days`       DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `total_earnings`     DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `total_deductions`   DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `total_net`          DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `total_employer`     DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `paid_count`         SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `paid_amount`        DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `note`               VARCHAR(500) NULL,
    `calculated_at`      TIMESTAMP NULL,
    `calculated_by`      BIGINT UNSIGNED NULL,
    `approved_at`        TIMESTAMP NULL,
    `approved_by`        BIGINT UNSIGNED NULL,
    `closed_at`          TIMESTAMP NULL,
    `is_active`          TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`         BIGINT UNSIGNED NULL,
    `updated_by`         BIGINT UNSIGNED NULL,
    `created_at`         TIMESTAMP NULL,
    `updated_at`         TIMESTAMP NULL,
    `month_key`          VARCHAR(40) AS (IF(`is_active` = 1, CONCAT(`company_id`, ':', `month`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_payroll_runs_uuid` (`uuid`),
    UNIQUE KEY `uq_payroll_runs_month` (`month_key`),
    KEY `ix_payroll_runs_company` (`company_id`, `status`, `month`),
    CONSTRAINT `fk_payroll_runs_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payroll_items` (
    `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`               CHAR(36) NOT NULL,
    `company_id`         BIGINT UNSIGNED NOT NULL,
    `run_id`             BIGINT UNSIGNED NOT NULL,
    `employee_id`        BIGINT UNSIGNED NOT NULL,
    `structure_id`       BIGINT UNSIGNED NULL,
    `employee_code`      VARCHAR(30) NOT NULL,
    `employee_name`      VARCHAR(150) NOT NULL,
    `designation`        VARCHAR(150) NULL,
    `pan_number`         VARCHAR(10) NULL,
    `uan_number`         VARCHAR(12) NULL,
    `annual_ctc`         DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `working_days`       DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `lop_days`           DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `paid_days`          DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `lop_suggested`      DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `lop_locked_by_hr`   TINYINT(1) NOT NULL DEFAULT 0,
    `gross_earnings`     DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_deductions`   DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `employer_cost`      DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `net_payable`        DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `payment_status`     VARCHAR(20) NOT NULL DEFAULT 'pending',
    `hold_reason`        VARCHAR(255) NULL,
    `note`               VARCHAR(500) NULL,
    `is_active`          TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`         BIGINT UNSIGNED NULL,
    `updated_by`         BIGINT UNSIGNED NULL,
    `created_at`         TIMESTAMP NULL,
    `updated_at`         TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_payroll_items_uuid` (`uuid`),
    UNIQUE KEY `uq_payroll_items_run_employee` (`run_id`, `employee_id`),
    KEY `ix_payroll_items_company` (`company_id`, `payment_status`),
    KEY `ix_payroll_items_employee` (`employee_id`),
    CONSTRAINT `fk_payroll_items_run` FOREIGN KEY (`run_id`) REFERENCES `payroll_runs` (`id`),
    CONSTRAINT `fk_payroll_items_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payroll_item_lines` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id`       BIGINT UNSIGNED NOT NULL,
    `item_id`          BIGINT UNSIGNED NOT NULL,
    `code`             VARCHAR(30) NOT NULL,
    `name`             VARCHAR(100) NOT NULL,
    `kind`             VARCHAR(20) NOT NULL,
    `full_amount`      DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `amount`           DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `is_statutory`     TINYINT(1) NOT NULL DEFAULT 0,
    `sequence`         SMALLINT UNSIGNED NOT NULL DEFAULT 100,
    `created_at`       TIMESTAMP NULL,
    `updated_at`       TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_payroll_item_lines` (`item_id`, `code`),
    KEY `ix_payroll_item_lines_company` (`company_id`),
    CONSTRAINT `fk_payroll_item_lines_item` FOREIGN KEY (`item_id`) REFERENCES `payroll_items` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`)
SELECT * FROM (
    SELECT 'payroll' AS m, 'view' AS a, 'payroll.view' AS s, 'View Payroll Runs' AS n, 'payroll' AS g, NOW() AS c
    UNION ALL SELECT 'payroll', 'run', 'payroll.run', 'Run and Recalculate Payroll', 'payroll', NOW()
    UNION ALL SELECT 'payroll', 'approve', 'payroll.approve', 'Approve Payroll', 'payroll', NOW()
) AS rows_to_add
WHERE NOT EXISTS (SELECT 1 FROM `permissions` p WHERE p.`slug` = rows_to_add.s);

DELETE FROM `cache`;
