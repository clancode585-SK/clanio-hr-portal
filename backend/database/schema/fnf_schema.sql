SET NAMES utf8mb4;
USE `clanio`;

CREATE TABLE IF NOT EXISTS `fnf_settlements` (
    `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                  CHAR(36) NOT NULL,
    `company_id`            BIGINT UNSIGNED NOT NULL,
    `employee_exit_id`      BIGINT UNSIGNED NOT NULL,
    `employee_id`           BIGINT UNSIGNED NOT NULL,
    `structure_id`          BIGINT UNSIGNED NULL,
    `employee_code`         VARCHAR(30) NOT NULL,
    `employee_name`         VARCHAR(150) NOT NULL,
    `designation`           VARCHAR(150) NULL,
    `pan_number`            VARCHAR(10) NULL,
    `uan_number`            VARCHAR(12) NULL,
    `date_of_joining`       DATE NOT NULL,
    `last_working_date`     DATE NOT NULL,
    `service_years`         DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `monthly_gross`         DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `monthly_basic`         DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `paid_days`             DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `working_days`          DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `notice_served_days`    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `notice_required_days`  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `notice_shortfall_days` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `total_earnings`        DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_deductions`      DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `net_payable`           DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `recoverable`           DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status`                VARCHAR(20) NOT NULL DEFAULT 'draft',
    `payment_status`        VARCHAR(20) NOT NULL DEFAULT 'pending',
    `note`                  VARCHAR(500) NULL,
    `hold_reason`           VARCHAR(255) NULL,
    `calculated_at`         TIMESTAMP NULL,
    `calculated_by`         BIGINT UNSIGNED NULL,
    `approved_at`           TIMESTAMP NULL,
    `approved_by`           BIGINT UNSIGNED NULL,
    `settled_at`            TIMESTAMP NULL,
    `is_active`             TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`            BIGINT UNSIGNED NULL,
    `updated_by`            BIGINT UNSIGNED NULL,
    `created_at`            TIMESTAMP NULL,
    `updated_at`            TIMESTAMP NULL,
    `exit_key`              VARCHAR(40) AS (IF(`is_active` = 1, CONCAT(`company_id`, ':', `employee_exit_id`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_fnf_settlements_uuid` (`uuid`),
    UNIQUE KEY `uq_fnf_settlements_exit` (`exit_key`),
    KEY `ix_fnf_settlements_company` (`company_id`, `status`),
    KEY `ix_fnf_settlements_employee` (`employee_id`),
    CONSTRAINT `fk_fnf_settlements_exit` FOREIGN KEY (`employee_exit_id`) REFERENCES `employee_exits` (`id`),
    CONSTRAINT `fk_fnf_settlements_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fnf_lines` (
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`            CHAR(36) NOT NULL,
    `company_id`      BIGINT UNSIGNED NOT NULL,
    `settlement_id`   BIGINT UNSIGNED NOT NULL,
    `code`            VARCHAR(30) NOT NULL,
    `name`            VARCHAR(150) NOT NULL,
    `kind`            VARCHAR(20) NOT NULL,
    `source`          VARCHAR(20) NOT NULL DEFAULT 'auto',
    `amount`          DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `basis`           VARCHAR(255) NULL,
    `note`            VARCHAR(255) NULL,
    `sequence`        SMALLINT UNSIGNED NOT NULL DEFAULT 100,
    `is_active`       TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`      BIGINT UNSIGNED NULL,
    `updated_by`      BIGINT UNSIGNED NULL,
    `created_at`      TIMESTAMP NULL,
    `updated_at`      TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_fnf_lines_uuid` (`uuid`),
    KEY `ix_fnf_lines_settlement` (`settlement_id`, `sequence`),
    KEY `ix_fnf_lines_company` (`company_id`),
    CONSTRAINT `fk_fnf_lines_settlement` FOREIGN KEY (`settlement_id`) REFERENCES `fnf_settlements` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

SET @has_fnf_settings := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'gratuity_min_years'
);

SET @sql := IF(
    @has_fnf_settings = 0,
    'ALTER TABLE `companies`
        ADD COLUMN `gratuity_enabled`        TINYINT(1) NOT NULL DEFAULT 1 AFTER `pt_monthly_amount`,
        ADD COLUMN `gratuity_min_years`      DECIMAL(4, 2) NOT NULL DEFAULT 5.00 AFTER `gratuity_enabled`,
        ADD COLUMN `gratuity_days_per_year`  DECIMAL(4, 1) NOT NULL DEFAULT 15.0 AFTER `gratuity_min_years`,
        ADD COLUMN `gratuity_month_days`     DECIMAL(4, 1) NOT NULL DEFAULT 26.0 AFTER `gratuity_days_per_year`,
        ADD COLUMN `encashment_basis`        VARCHAR(10) NOT NULL DEFAULT ''basic'' AFTER `gratuity_month_days`,
        ADD COLUMN `encashment_month_days`   DECIMAL(4, 1) NOT NULL DEFAULT 26.0 AFTER `encashment_basis`,
        ADD COLUMN `notice_recovery_basis`   VARCHAR(10) NOT NULL DEFAULT ''gross'' AFTER `encashment_month_days`',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_settlement_link := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'salary_disbursements' AND COLUMN_NAME = 'settlement_id'
);

SET @sql2 := IF(
    @has_settlement_link = 0,
    'ALTER TABLE `salary_disbursements`
        DROP FOREIGN KEY `fk_disbursements_run`,
        DROP FOREIGN KEY `fk_disbursements_item`',
    'SELECT 1'
);

PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @sql3 := IF(
    @has_settlement_link = 0,
    'ALTER TABLE `salary_disbursements`
        MODIFY COLUMN `run_id` BIGINT UNSIGNED NULL,
        MODIFY COLUMN `item_id` BIGINT UNSIGNED NULL,
        ADD COLUMN `settlement_id` BIGINT UNSIGNED NULL AFTER `item_id`,
        ADD COLUMN `purpose` VARCHAR(20) NOT NULL DEFAULT ''salary'' AFTER `settlement_id`,
        ADD KEY `ix_salary_disbursements_settlement` (`settlement_id`),
        ADD CONSTRAINT `fk_disbursements_run` FOREIGN KEY (`run_id`) REFERENCES `payroll_runs` (`id`),
        ADD CONSTRAINT `fk_disbursements_item` FOREIGN KEY (`item_id`) REFERENCES `payroll_items` (`id`),
        ADD CONSTRAINT `fk_disbursements_settlement` FOREIGN KEY (`settlement_id`) REFERENCES `fnf_settlements` (`id`)',
    'SELECT 1'
);

PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`)
SELECT * FROM (
    SELECT 'payroll' AS m, 'fnf_view' AS a, 'fnf.view' AS s, 'View Full and Final Settlements' AS n, 'payroll' AS g, NOW() AS c
    UNION ALL SELECT 'payroll', 'fnf_manage', 'fnf.manage', 'Build and Adjust Settlements', 'payroll', NOW()
    UNION ALL SELECT 'payroll', 'fnf_approve', 'fnf.approve', 'Approve and Settle', 'payroll', NOW()
) AS rows_to_add
WHERE NOT EXISTS (SELECT 1 FROM `permissions` p WHERE p.`slug` = rows_to_add.s);

DELETE FROM `cache`;
