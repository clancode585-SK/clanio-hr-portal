SET NAMES utf8mb4;
USE `clanio`;

CREATE TABLE IF NOT EXISTS `invoices` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`              CHAR(36) NOT NULL,
    `company_id`        BIGINT UNSIGNED NOT NULL,
    `plan_id`           BIGINT UNSIGNED NULL,
    `invoice_number`    VARCHAR(30) NOT NULL,
    `plan_name`         VARCHAR(60) NOT NULL,
    `plan_code`         VARCHAR(30) NOT NULL,
    `seats`             SMALLINT UNSIGNED NOT NULL,
    `price_per_seat`    DECIMAL(10,2) NOT NULL,
    `currency`          CHAR(3) NOT NULL DEFAULT 'INR',
    `billing_cycle`     VARCHAR(20) NOT NULL DEFAULT 'monthly',
    `subtotal`          DECIMAL(12,2) NOT NULL,
    `gst_percent`       DECIMAL(5,2) NOT NULL DEFAULT 0,
    `gst_amount`        DECIMAL(12,2) NOT NULL DEFAULT 0,
    `total`             DECIMAL(12,2) NOT NULL,
    `status`            VARCHAR(20) NOT NULL DEFAULT 'pending',
    `period_start`      DATE NOT NULL,
    `period_end`        DATE NOT NULL,
    `issued_at`         TIMESTAMP NULL,
    `paid_at`           TIMESTAMP NULL,
    `payment_method`    VARCHAR(30) NULL,
    `payment_reference` VARCHAR(60) NULL,
    `billed_to_name`    VARCHAR(200) NOT NULL,
    `billed_to_email`   VARCHAR(200) NULL,
    `billed_to_gstin`   VARCHAR(20) NULL,
    `billed_to_address` VARCHAR(500) NULL,
    `notes`             VARCHAR(255) NULL,
    `created_by`        BIGINT UNSIGNED NULL,
    `updated_by`        BIGINT UNSIGNED NULL,
    `created_at`        TIMESTAMP NULL,
    `updated_at`        TIMESTAMP NULL,
    `is_active`         TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_invoices_uuid` (`uuid`),
    UNIQUE KEY `uq_invoices_number` (`invoice_number`),
    KEY `ix_invoices_company` (`company_id`, `issued_at`),
    KEY `ix_invoices_status` (`status`, `issued_at`),
    KEY `ix_invoices_plan` (`plan_id`),
    CONSTRAINT `fk_invoices_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_invoices_plan` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`)
VALUES
    ('invoice', 'view', 'invoice.view', 'View Invoices', 'settings', NOW()),
    ('invoice', 'manage', 'invoice.manage', 'Manage Invoices', 'platform', NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`)
SELECT r.`id`, p.`id`, NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`slug` = 'invoice.view'
  AND r.`slug` IN ('super_admin', 'company_admin')
ON DUPLICATE KEY UPDATE `role_permissions`.`created_at` = `role_permissions`.`created_at`;

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`)
SELECT r.`id`, p.`id`, NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`slug` = 'invoice.manage'
  AND r.`slug` = 'super_admin'
ON DUPLICATE KEY UPDATE `role_permissions`.`created_at` = `role_permissions`.`created_at`;

INSERT INTO `company_modules` (`company_id`, `module`, `is_enabled`, `created_at`, `updated_at`)
SELECT c.`id`, 'invoice', 1, NOW(), NOW()
FROM `companies` c
ON DUPLICATE KEY UPDATE `is_enabled` = `company_modules`.`is_enabled`;
