SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `exit_documents`;
DROP TABLE IF EXISTS `employee_exits`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `employee_exits` (
    `id`                          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                        CHAR(36) NOT NULL,
    `company_id`                  BIGINT UNSIGNED NOT NULL,
    `employee_id`                 BIGINT UNSIGNED NOT NULL,

    `exit_type`                   VARCHAR(20) NOT NULL DEFAULT 'resignation',
    `resignation_date`            DATE NOT NULL,
    `requested_last_working_date` DATE NULL,
    `notice_period_days`          SMALLINT UNSIGNED NOT NULL,
    `last_working_date`           DATE NULL,
    `reason`                      VARCHAR(500) NOT NULL,
    `status`                      VARCHAR(20) NOT NULL DEFAULT 'pending',

    `manager_id`                  BIGINT UNSIGNED NULL,
    `manager_decided_at`          TIMESTAMP NULL,
    `manager_remarks`             VARCHAR(500) NULL,

    `hr_id`                       BIGINT UNSIGNED NULL,
    `hr_decided_at`               TIMESTAMP NULL,
    `hr_remarks`                  VARCHAR(500) NULL,

    `rejected_by`                 BIGINT UNSIGNED NULL,
    `rejected_at`                 TIMESTAMP NULL,
    `reject_reason`               VARCHAR(500) NULL,
    `rejected_stage`              VARCHAR(15) NULL,

    `withdrawn_at`                TIMESTAMP NULL,
    `exited_at`                   TIMESTAMP NULL,

    `applied_by`                  BIGINT UNSIGNED NULL,
    `created_by`                  BIGINT UNSIGNED NULL,
    `updated_by`                  BIGINT UNSIGNED NULL,
    `created_at`                  TIMESTAMP NULL,
    `updated_at`                  TIMESTAMP NULL,
    `is_active`                   TINYINT(1) NOT NULL DEFAULT 1,

    `open_key`                    VARCHAR(30) AS (IF(`is_active` = 1 AND `status` IN ('pending', 'manager_approved', 'serving_notice'), `employee_id`, NULL)) STORED,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_employee_exits_uuid` (`uuid`),
    UNIQUE KEY `uq_employee_exits_open` (`open_key`),
    KEY `ix_employee_exits_employee` (`employee_id`, `status`),
    KEY `ix_employee_exits_company_status` (`company_id`, `status`, `last_working_date`),
    KEY `ix_employee_exits_lwd` (`status`, `last_working_date`),
    KEY `ix_employee_exits_active` (`company_id`, `is_active`),
    CONSTRAINT `fk_employee_exits_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_employee_exits_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_employee_exits_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_employee_exits_hr` FOREIGN KEY (`hr_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `exit_documents` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`             CHAR(36) NOT NULL,
    `company_id`       BIGINT UNSIGNED NOT NULL,
    `employee_exit_id` BIGINT UNSIGNED NOT NULL,
    `type`             VARCHAR(30) NOT NULL,
    `file_path`        VARCHAR(255) NOT NULL,
    `original_name`    VARCHAR(200) NOT NULL,
    `mime_type`        VARCHAR(120) NULL,
    `size_bytes`       BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `issued_on`        DATE NULL,
    `remarks`          VARCHAR(300) NULL,
    `uploaded_by`      BIGINT UNSIGNED NULL,
    `created_by`       BIGINT UNSIGNED NULL,
    `updated_by`       BIGINT UNSIGNED NULL,
    `created_at`       TIMESTAMP NULL,
    `updated_at`       TIMESTAMP NULL,
    `is_active`        TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_exit_documents_uuid` (`uuid`),
    KEY `ix_exit_documents_exit` (`employee_exit_id`, `type`),
    KEY `ix_exit_documents_active` (`company_id`, `is_active`),
    CONSTRAINT `fk_exit_documents_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_exit_documents_exit` FOREIGN KEY (`employee_exit_id`) REFERENCES `employee_exits` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_exit_documents_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `companies`
    ADD COLUMN `notice_period_days` SMALLINT UNSIGNED NOT NULL DEFAULT 30 AFTER `expense_claim_days`;

ALTER TABLE `employees`
    ADD COLUMN `employment_status` VARCHAR(20) NOT NULL DEFAULT 'active' AFTER `onboarding_status`,
    ADD COLUMN `exit_date` DATE NULL AFTER `employment_status`,
    ADD KEY `ix_employees_employment_status` (`company_id`, `employment_status`);

DELETE rp FROM `role_permissions` rp
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`module` = 'exit';

DELETE FROM `permissions` WHERE `module` = 'exit';

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
('exit', 'approve',  'exit.approve',  'Final Approve Employee Exit', 'exit', NOW()),
('exit', 'document', 'exit.document', 'Issue Exit Documents',        'exit', NOW());

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`module` = 'exit'
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
