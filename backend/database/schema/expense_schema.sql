SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `expense_bills`;
DROP TABLE IF EXISTS `expense_claims`;
DROP TABLE IF EXISTS `expense_categories`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `expense_claims` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`              CHAR(36) NOT NULL,
    `company_id`        BIGINT UNSIGNED NOT NULL,
    `employee_id`       BIGINT UNSIGNED NOT NULL,

    `category`          VARCHAR(20) NOT NULL,
    `purpose`           VARCHAR(150) NULL,
    `expense_date`      DATE NOT NULL,
    `amount`            DECIMAL(10,2) NOT NULL,
    `approved_amount`   DECIMAL(10,2) NULL,
    `description`       VARCHAR(500) NOT NULL,
    `status`            VARCHAR(20) NOT NULL DEFAULT 'pending',

    `approver_id`       BIGINT UNSIGNED NULL,
    `approved_at`       TIMESTAMP NULL,
    `approver_remarks`  VARCHAR(500) NULL,

    `verified_by`       BIGINT UNSIGNED NULL,
    `verified_at`       TIMESTAMP NULL,
    `verify_remarks`    VARCHAR(500) NULL,

    `rejected_by`       BIGINT UNSIGNED NULL,
    `rejected_at`       TIMESTAMP NULL,
    `reject_reason`     VARCHAR(500) NULL,
    `rejected_stage`    VARCHAR(15) NULL,

    `paid_by`           BIGINT UNSIGNED NULL,
    `paid_on`           DATE NULL,
    `payment_mode`      VARCHAR(20) NULL,
    `payment_reference` VARCHAR(80) NULL,
    `payment_remarks`   VARCHAR(300) NULL,

    `applied_by`        BIGINT UNSIGNED NULL,
    `created_by`        BIGINT UNSIGNED NULL,
    `updated_by`        BIGINT UNSIGNED NULL,
    `created_at`        TIMESTAMP NULL,
    `updated_at`        TIMESTAMP NULL,
    `deleted_at`        TIMESTAMP NULL,

    `is_open`           TINYINT(1) AS (IF(`status` IN ('paid', 'rejected', 'cancelled'), 0, 1)) STORED,
    `payable_amount`    DECIMAL(10,2) AS (IFNULL(`approved_amount`, `amount`)) STORED,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_expense_claims_uuid` (`uuid`),
    KEY `ix_expense_claims_employee` (`employee_id`, `status`, `expense_date`),
    KEY `ix_expense_claims_company_status` (`company_id`, `status`, `expense_date`),
    KEY `ix_expense_claims_category` (`company_id`, `category`, `expense_date`),
    KEY `ix_expense_claims_open` (`company_id`, `is_open`),
    CONSTRAINT `fk_expense_claims_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_expense_claims_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_expense_claims_approver` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_expense_claims_verifier` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_expense_claims_payer` FOREIGN KEY (`paid_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `expense_bills` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`             CHAR(36) NOT NULL,
    `company_id`       BIGINT UNSIGNED NOT NULL,
    `expense_claim_id` BIGINT UNSIGNED NOT NULL,
    `file_path`        VARCHAR(255) NOT NULL,
    `original_name`    VARCHAR(200) NOT NULL,
    `mime_type`        VARCHAR(120) NULL,
    `size_bytes`       BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `uploaded_by`      BIGINT UNSIGNED NULL,
    `created_by`       BIGINT UNSIGNED NULL,
    `updated_by`       BIGINT UNSIGNED NULL,
    `created_at`       TIMESTAMP NULL,
    `updated_at`       TIMESTAMP NULL,
    `deleted_at`       TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_expense_bills_uuid` (`uuid`),
    KEY `ix_expense_bills_claim` (`expense_claim_id`, `id`),
    KEY `ix_expense_bills_company` (`company_id`),
    CONSTRAINT `fk_expense_bills_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_expense_bills_claim` FOREIGN KEY (`expense_claim_id`) REFERENCES `expense_claims` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_expense_bills_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `companies`
    ADD COLUMN `expense_claim_days` SMALLINT UNSIGNED NOT NULL DEFAULT 60 AFTER `regularization_days`;

DELETE rp FROM `role_permissions` rp
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`module` = 'expense';

DELETE FROM `permissions` WHERE `module` = 'expense';

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
('expense', 'verify', 'expense.verify', 'Verify Expense Claims',    'expense', NOW()),
('expense', 'pay',    'expense.pay',    'Mark Expense Claims Paid', 'expense', NOW());

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`module` = 'expense'
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
