SET NAMES utf8mb4;
USE `clanio`;

CREATE TABLE IF NOT EXISTS `salary_components` (
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`            CHAR(36) NOT NULL,
    `company_id`      BIGINT UNSIGNED NOT NULL,
    `code`            VARCHAR(30) NOT NULL,
    `name`            VARCHAR(100) NOT NULL,
    `kind`            VARCHAR(20) NOT NULL,
    `calculation`     VARCHAR(20) NOT NULL DEFAULT 'fixed',
    `default_value`   DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `is_taxable`      TINYINT(1) NOT NULL DEFAULT 1,
    `is_statutory`    TINYINT(1) NOT NULL DEFAULT 0,
    `affects_net`     TINYINT(1) NOT NULL DEFAULT 1,
    `sequence`        SMALLINT UNSIGNED NOT NULL DEFAULT 100,
    `note`            VARCHAR(255) NULL,
    `is_active`       TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`      BIGINT UNSIGNED NULL,
    `updated_by`      BIGINT UNSIGNED NULL,
    `created_at`      TIMESTAMP NULL,
    `updated_at`      TIMESTAMP NULL,
    `code_key`        VARCHAR(70) AS (IF(`is_active` = 1, CONCAT(`company_id`, ':', `code`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_salary_components_uuid` (`uuid`),
    UNIQUE KEY `uq_salary_components_code` (`code_key`),
    KEY `ix_salary_components_company` (`company_id`, `kind`, `sequence`),
    CONSTRAINT `fk_salary_components_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `salary_structures` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`             CHAR(36) NOT NULL,
    `company_id`       BIGINT UNSIGNED NOT NULL,
    `employee_id`      BIGINT UNSIGNED NOT NULL,
    `effective_from`   DATE NOT NULL,
    `effective_to`     DATE NULL,
    `annual_ctc`       DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `monthly_gross`    DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `monthly_net`      DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `revision_reason`  VARCHAR(255) NULL,
    `status`           VARCHAR(20) NOT NULL DEFAULT 'active',
    `is_active`        TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`       BIGINT UNSIGNED NULL,
    `updated_by`       BIGINT UNSIGNED NULL,
    `created_at`       TIMESTAMP NULL,
    `updated_at`       TIMESTAMP NULL,
    `period_key`       VARCHAR(80) AS (IF(`is_active` = 1, CONCAT(`employee_id`, ':', `effective_from`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_salary_structures_uuid` (`uuid`),
    UNIQUE KEY `uq_salary_structures_period` (`period_key`),
    KEY `ix_salary_structures_employee` (`employee_id`, `effective_from`),
    KEY `ix_salary_structures_company` (`company_id`, `status`),
    CONSTRAINT `fk_salary_structures_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
    CONSTRAINT `fk_salary_structures_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `salary_structure_lines` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id`       BIGINT UNSIGNED NOT NULL,
    `structure_id`     BIGINT UNSIGNED NOT NULL,
    `component_id`     BIGINT UNSIGNED NOT NULL,
    `code`             VARCHAR(30) NOT NULL,
    `name`             VARCHAR(100) NOT NULL,
    `kind`             VARCHAR(20) NOT NULL,
    `calculation`      VARCHAR(20) NOT NULL DEFAULT 'fixed',
    `value`            DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `monthly_amount`   DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `annual_amount`    DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `is_taxable`       TINYINT(1) NOT NULL DEFAULT 1,
    `is_statutory`     TINYINT(1) NOT NULL DEFAULT 0,
    `sequence`         SMALLINT UNSIGNED NOT NULL DEFAULT 100,
    `created_at`       TIMESTAMP NULL,
    `updated_at`       TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_structure_lines` (`structure_id`, `component_id`),
    KEY `ix_structure_lines_company` (`company_id`),
    CONSTRAINT `fk_structure_lines_structure` FOREIGN KEY (`structure_id`) REFERENCES `salary_structures` (`id`),
    CONSTRAINT `fk_structure_lines_component` FOREIGN KEY (`component_id`) REFERENCES `salary_components` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

SET @has_payroll_settings := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'salary_pay_day'
);

SET @sql := IF(
    @has_payroll_settings = 0,
    'ALTER TABLE `companies`
        ADD COLUMN `salary_pay_day`         TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER `fiscal_year_start`,
        ADD COLUMN `pf_enabled`             TINYINT(1) NOT NULL DEFAULT 1 AFTER `salary_pay_day`,
        ADD COLUMN `pf_employee_percent`    DECIMAL(5, 2) NOT NULL DEFAULT 12.00 AFTER `pf_enabled`,
        ADD COLUMN `pf_employer_percent`    DECIMAL(5, 2) NOT NULL DEFAULT 12.00 AFTER `pf_employee_percent`,
        ADD COLUMN `pf_wage_ceiling`        DECIMAL(10, 2) NOT NULL DEFAULT 15000.00 AFTER `pf_employer_percent`,
        ADD COLUMN `esi_enabled`            TINYINT(1) NOT NULL DEFAULT 1 AFTER `pf_wage_ceiling`,
        ADD COLUMN `esi_employee_percent`   DECIMAL(5, 2) NOT NULL DEFAULT 0.75 AFTER `esi_enabled`,
        ADD COLUMN `esi_employer_percent`   DECIMAL(5, 2) NOT NULL DEFAULT 3.25 AFTER `esi_employee_percent`,
        ADD COLUMN `esi_wage_limit`         DECIMAL(10, 2) NOT NULL DEFAULT 21000.00 AFTER `esi_employer_percent`,
        ADD COLUMN `pt_enabled`             TINYINT(1) NOT NULL DEFAULT 0 AFTER `esi_wage_limit`,
        ADD COLUMN `pt_monthly_amount`      DECIMAL(8, 2) NOT NULL DEFAULT 200.00 AFTER `pt_enabled`',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`)
SELECT * FROM (
    SELECT 'payroll' AS m, 'structure_view' AS a, 'salary_structure.view' AS s, 'View Salary Structures' AS n, 'payroll' AS g, NOW() AS c
    UNION ALL SELECT 'payroll', 'structure_manage', 'salary_structure.manage', 'Build and Revise Salary Structures', 'payroll', NOW()
    UNION ALL SELECT 'payroll', 'component_manage', 'salary_component.manage', 'Manage Salary Components', 'payroll', NOW()
) AS rows_to_add
WHERE NOT EXISTS (SELECT 1 FROM `permissions` p WHERE p.`slug` = rows_to_add.s);

DELETE FROM `cache`;
