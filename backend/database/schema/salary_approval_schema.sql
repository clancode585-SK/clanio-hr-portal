SET NAMES utf8mb4;
USE `clanio`;

SET @has_item_approval := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'payroll_items' AND COLUMN_NAME = 'approval_status'
);

SET @sql := IF(
    @has_item_approval = 0,
    'ALTER TABLE `payroll_items`
        ADD COLUMN `approval_status` VARCHAR(20) NOT NULL DEFAULT ''pending'' AFTER `payment_status`,
        ADD COLUMN `approved_at`     TIMESTAMP NULL AFTER `approval_status`,
        ADD COLUMN `approved_by`     BIGINT UNSIGNED NULL AFTER `approved_at`,
        ADD COLUMN `fingerprint`     CHAR(64) NULL AFTER `approved_by`,
        ADD KEY `ix_payroll_items_approval` (`run_id`, `approval_status`)',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_run_schedule := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'payroll_runs' AND COLUMN_NAME = 'transfer_scheduled_at'
);

SET @sql2 := IF(
    @has_run_schedule = 0,
    'ALTER TABLE `payroll_runs`
        ADD COLUMN `approved_count`         SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `headcount`,
        ADD COLUMN `stopped_count`          SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `approved_count`,
        ADD COLUMN `transfer_scheduled_at`  TIMESTAMP NULL AFTER `approved_by`,
        ADD COLUMN `transfer_scheduled_by`  BIGINT UNSIGNED NULL AFTER `transfer_scheduled_at`,
        ADD COLUMN `schedule_note`          VARCHAR(255) NULL AFTER `transfer_scheduled_by`,
        ADD KEY `ix_payroll_runs_schedule` (`status`, `transfer_scheduled_at`)',
    'SELECT 1'
);

PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @has_fnf_print := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'fnf_settlements' AND COLUMN_NAME = 'fingerprint'
);

SET @sql3 := IF(
    @has_fnf_print = 0,
    'ALTER TABLE `fnf_settlements`
        ADD COLUMN `fingerprint` CHAR(64) NULL AFTER `approved_by`',
    'SELECT 1'
);

PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

SET @has_pay_time := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'salary_pay_time'
);

SET @sql4 := IF(
    @has_pay_time = 0,
    'ALTER TABLE `companies`
        ADD COLUMN `salary_pay_time`      TIME NOT NULL DEFAULT ''10:00:00'' AFTER `salary_pay_day`,
        ADD COLUMN `payroll_review_day`   TINYINT UNSIGNED NOT NULL DEFAULT 25 AFTER `salary_pay_time`,
        ADD COLUMN `transfer_otp_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `payroll_review_day`,
        ADD COLUMN `transfer_otp_to`      VARCHAR(10) NOT NULL DEFAULT ''admin'' AFTER `transfer_otp_enabled`,
        ADD COLUMN `transfer_early_block` TINYINT(1) NOT NULL DEFAULT 1 AFTER `transfer_otp_to`',
    'SELECT 1'
);

PREPARE stmt4 FROM @sql4;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;

SET @has_bank_contact := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'company_bank_accounts' AND COLUMN_NAME = 'contact_email'
);

SET @sql5 := IF(
    @has_bank_contact = 0,
    'ALTER TABLE `company_bank_accounts`
        ADD COLUMN `contact_email` VARCHAR(150) NULL AFTER `branch_name`',
    'SELECT 1'
);

PREPARE stmt5 FROM @sql5;
EXECUTE stmt5;
DEALLOCATE PREPARE stmt5;

CREATE TABLE IF NOT EXISTS `transfer_verifications` (
    `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`           CHAR(36) NOT NULL,
    `company_id`     BIGINT UNSIGNED NOT NULL,
    `purpose`        VARCHAR(20) NOT NULL,
    `action`         VARCHAR(20) NOT NULL DEFAULT 'transfer',
    `run_id`         BIGINT UNSIGNED NULL,
    `item_id`        BIGINT UNSIGNED NULL,
    `settlement_id`  BIGINT UNSIGNED NULL,
    `headcount`      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `amount`         DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `scheduled_for`  TIMESTAMP NULL,
    `code_hash`      CHAR(64) NOT NULL,
    `channel`        VARCHAR(20) NOT NULL DEFAULT 'email',
    `sent_to`        VARCHAR(150) NOT NULL,
    `sent_masked`    VARCHAR(80) NOT NULL,
    `attempts`       TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `status`         VARCHAR(20) NOT NULL DEFAULT 'pending',
    `expires_at`     DATETIME NOT NULL,
    `verified_at`    TIMESTAMP NULL,
    `consumed_at`    TIMESTAMP NULL,
    `requested_by`   BIGINT UNSIGNED NOT NULL,
    `is_active`      TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`     BIGINT UNSIGNED NULL,
    `updated_by`     BIGINT UNSIGNED NULL,
    `created_at`     TIMESTAMP NULL,
    `updated_at`     TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_transfer_verifications_uuid` (`uuid`),
    KEY `ix_transfer_verifications_company` (`company_id`, `status`),
    KEY `ix_transfer_verifications_run` (`run_id`),
    KEY `ix_transfer_verifications_settlement` (`settlement_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`)
SELECT * FROM (
    SELECT 'payroll' AS m, 'disburse_early' AS a, 'salary.disburse_early' AS s,
           'Send Salary Before the Pay Date' AS n, 'payroll' AS g, NOW() AS c
) AS rows_to_add
WHERE NOT EXISTS (SELECT 1 FROM `permissions` p WHERE p.`slug` = rows_to_add.s);

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`)
SELECT r.`id`, p.`id`, NOW()
FROM `roles` r
JOIN `permissions` p ON p.`slug` = 'salary.disburse_early'
WHERE r.`slug` = 'company_admin'
  AND NOT EXISTS (
      SELECT 1 FROM `role_permissions` rp
      WHERE rp.`role_id` = r.`id` AND rp.`permission_id` = p.`id`
  );

UPDATE `payroll_items` SET `approval_status` = 'approved'
WHERE `payment_status` IN ('processing', 'paid') AND `approval_status` = 'pending';

DELETE FROM `cache`;
