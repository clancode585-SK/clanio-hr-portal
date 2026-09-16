SET NAMES utf8mb4;
USE `clanio`;

CREATE TABLE IF NOT EXISTS `company_bank_accounts` (
    `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                  CHAR(36) NOT NULL,
    `company_id`            BIGINT UNSIGNED NOT NULL,
    `label`                 VARCHAR(100) NOT NULL,
    `account_holder_name`   VARCHAR(150) NOT NULL,
    `bank_name`             VARCHAR(150) NOT NULL,
    `account_number`        VARCHAR(30) NOT NULL,
    `ifsc_code`             VARCHAR(11) NOT NULL,
    `branch_name`           VARCHAR(150) NULL,
    `provider`              VARCHAR(30) NOT NULL DEFAULT 'mock',
    `is_primary`            TINYINT(1) NOT NULL DEFAULT 0,
    `balance`               DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `balance_synced_at`     TIMESTAMP NULL,
    `is_active`             TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`            BIGINT UNSIGNED NULL,
    `updated_by`            BIGINT UNSIGNED NULL,
    `created_at`            TIMESTAMP NULL,
    `updated_at`            TIMESTAMP NULL,
    `account_key`           VARCHAR(70) AS (IF(`is_active` = 1, CONCAT(`company_id`, ':', `account_number`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_company_bank_uuid` (`uuid`),
    UNIQUE KEY `uq_company_bank_account` (`account_key`),
    KEY `ix_company_bank_company` (`company_id`, `is_primary`),
    CONSTRAINT `fk_company_bank_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `salary_disbursements` (
    `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                  CHAR(36) NOT NULL,
    `company_id`            BIGINT UNSIGNED NOT NULL,
    `run_id`                BIGINT UNSIGNED NOT NULL,
    `item_id`               BIGINT UNSIGNED NOT NULL,
    `employee_id`           BIGINT UNSIGNED NOT NULL,
    `from_account_id`       BIGINT UNSIGNED NOT NULL,
    `employee_code`         VARCHAR(30) NOT NULL,
    `employee_name`         VARCHAR(150) NOT NULL,
    `to_account_holder`     VARCHAR(150) NOT NULL,
    `to_bank_name`          VARCHAR(150) NOT NULL,
    `to_account_number`     VARCHAR(30) NOT NULL,
    `to_ifsc_code`          VARCHAR(11) NOT NULL,
    `amount`                DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `provider`              VARCHAR(30) NOT NULL DEFAULT 'mock',
    `mode`                  VARCHAR(20) NOT NULL DEFAULT 'bulk',
    `reference`             VARCHAR(60) NULL,
    `utr`                   VARCHAR(40) NULL,
    `status`                VARCHAR(20) NOT NULL DEFAULT 'queued',
    `failure_reason`        VARCHAR(255) NULL,
    `initiated_at`          TIMESTAMP NULL,
    `initiated_by`          BIGINT UNSIGNED NULL,
    `completed_at`          TIMESTAMP NULL,
    `is_active`             TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`            BIGINT UNSIGNED NULL,
    `updated_by`            BIGINT UNSIGNED NULL,
    `created_at`            TIMESTAMP NULL,
    `updated_at`            TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_salary_disbursements_uuid` (`uuid`),
    UNIQUE KEY `uq_salary_disbursements_ref` (`reference`),
    KEY `ix_salary_disbursements_run` (`run_id`, `status`),
    KEY `ix_salary_disbursements_item` (`item_id`),
    KEY `ix_salary_disbursements_company` (`company_id`, `status`),
    CONSTRAINT `fk_disbursements_run` FOREIGN KEY (`run_id`) REFERENCES `payroll_runs` (`id`),
    CONSTRAINT `fk_disbursements_item` FOREIGN KEY (`item_id`) REFERENCES `payroll_items` (`id`),
    CONSTRAINT `fk_disbursements_account` FOREIGN KEY (`from_account_id`) REFERENCES `company_bank_accounts` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bank_transactions` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`              CHAR(36) NOT NULL,
    `company_id`        BIGINT UNSIGNED NOT NULL,
    `account_id`        BIGINT UNSIGNED NOT NULL,
    `disbursement_id`   BIGINT UNSIGNED NULL,
    `direction`         VARCHAR(10) NOT NULL,
    `amount`            DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `balance_after`     DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `narration`         VARCHAR(255) NOT NULL,
    `reference`         VARCHAR(60) NULL,
    `happened_at`       TIMESTAMP NULL,
    `is_active`         TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`        BIGINT UNSIGNED NULL,
    `created_at`        TIMESTAMP NULL,
    `updated_at`        TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_bank_transactions_uuid` (`uuid`),
    KEY `ix_bank_transactions_account` (`account_id`, `happened_at`),
    KEY `ix_bank_transactions_company` (`company_id`),
    CONSTRAINT `fk_bank_transactions_account` FOREIGN KEY (`account_id`) REFERENCES `company_bank_accounts` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`)
SELECT * FROM (
    SELECT 'payroll' AS m, 'bank_view' AS a, 'company_bank.view' AS s, 'View Company Bank Accounts' AS n, 'payroll' AS g, NOW() AS c
    UNION ALL SELECT 'payroll', 'bank_manage', 'company_bank.manage', 'Manage Company Bank Accounts', 'payroll', NOW()
    UNION ALL SELECT 'payroll', 'disburse', 'salary.disburse', 'Transfer Salary to Employees', 'payroll', NOW()
) AS rows_to_add
WHERE NOT EXISTS (SELECT 1 FROM `permissions` p WHERE p.`slug` = rows_to_add.s);

DELETE FROM `cache`;
