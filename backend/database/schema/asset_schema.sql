SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `asset_requests`;
DROP TABLE IF EXISTS `asset_allocations`;
DROP TABLE IF EXISTS `assets`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `assets` (
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`            CHAR(36) NOT NULL,
    `company_id`      BIGINT UNSIGNED NOT NULL,
    `asset_code`      VARCHAR(30) NOT NULL,
    `category`        VARCHAR(20) NOT NULL,
    `name`            VARCHAR(150) NOT NULL,
    `brand`           VARCHAR(80) NULL,
    `model`           VARCHAR(80) NULL,
    `serial_number`   VARCHAR(100) NULL,
    `purchase_date`   DATE NULL,
    `purchase_cost`   DECIMAL(10,2) NULL,
    `warranty_expiry` DATE NULL,
    `condition_state` VARCHAR(20) NOT NULL DEFAULT 'good',
    `status`          VARCHAR(20) NOT NULL DEFAULT 'available',
    `notes`           VARCHAR(500) NULL,
    `created_by`      BIGINT UNSIGNED NULL,
    `updated_by`      BIGINT UNSIGNED NULL,
    `created_at`      TIMESTAMP NULL,
    `updated_at`      TIMESTAMP NULL,
    `is_active`       TINYINT(1) NOT NULL DEFAULT 1,
    `code_key`        VARCHAR(60) AS (IF(`is_active` = 1, CONCAT(`company_id`, ':', `asset_code`), NULL)) STORED,
    `serial_key`      VARCHAR(140) AS (IF(`is_active` = 1 AND `serial_number` IS NOT NULL, CONCAT(`company_id`, ':', `serial_number`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_assets_uuid` (`uuid`),
    UNIQUE KEY `uq_assets_code` (`code_key`),
    UNIQUE KEY `uq_assets_serial` (`serial_key`),
    KEY `ix_assets_company_status` (`company_id`, `status`, `category`),
    KEY `ix_assets_active` (`company_id`, `is_active`),
    CONSTRAINT `fk_assets_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `asset_allocations` (
    `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                  CHAR(36) NOT NULL,
    `company_id`            BIGINT UNSIGNED NOT NULL,
    `asset_id`              BIGINT UNSIGNED NOT NULL,
    `employee_id`           BIGINT UNSIGNED NOT NULL,
    `status`                VARCHAR(20) NOT NULL DEFAULT 'allocated',
    `allocated_by`          BIGINT UNSIGNED NULL,
    `allocated_on`          DATE NOT NULL,
    `expected_return_date`  DATE NULL,
    `allocation_condition`  VARCHAR(20) NOT NULL DEFAULT 'good',
    `allocation_remarks`    VARCHAR(500) NULL,
    `returned_on`           DATE NULL,
    `received_by`           BIGINT UNSIGNED NULL,
    `return_condition`      VARCHAR(20) NULL,
    `return_remarks`        VARCHAR(500) NULL,
    `recoverable_amount`    DECIMAL(10,2) NOT NULL DEFAULT 0,
    `created_by`            BIGINT UNSIGNED NULL,
    `updated_by`            BIGINT UNSIGNED NULL,
    `created_at`            TIMESTAMP NULL,
    `updated_at`            TIMESTAMP NULL,
    `is_active`             TINYINT(1) NOT NULL DEFAULT 1,
    `open_key`              VARCHAR(30) AS (IF(`is_active` = 1 AND `status` = 'allocated', `asset_id`, NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_asset_allocations_uuid` (`uuid`),
    UNIQUE KEY `uq_asset_allocations_open` (`open_key`),
    KEY `ix_asset_allocations_employee` (`employee_id`, `status`),
    KEY `ix_asset_allocations_asset` (`asset_id`, `id`),
    KEY `ix_asset_allocations_active` (`company_id`, `is_active`),
    CONSTRAINT `fk_asset_allocations_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_asset_allocations_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_asset_allocations_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_asset_allocations_allocator` FOREIGN KEY (`allocated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_asset_allocations_receiver` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `asset_requests` (
    `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`           CHAR(36) NOT NULL,
    `company_id`     BIGINT UNSIGNED NOT NULL,
    `employee_id`    BIGINT UNSIGNED NOT NULL,
    `asset_id`       BIGINT UNSIGNED NULL,
    `request_type`   VARCHAR(20) NOT NULL,
    `category`       VARCHAR(20) NULL,
    `title`          VARCHAR(200) NOT NULL,
    `description`    VARCHAR(1000) NOT NULL,
    `priority`       VARCHAR(10) NOT NULL DEFAULT 'normal',
    `status`         VARCHAR(20) NOT NULL DEFAULT 'pending',
    `handler_id`     BIGINT UNSIGNED NULL,
    `decided_at`     TIMESTAMP NULL,
    `decision_remarks` VARCHAR(500) NULL,
    `started_at`     TIMESTAMP NULL,
    `resolved_at`    TIMESTAMP NULL,
    `resolution`     VARCHAR(1000) NULL,
    `applied_by`     BIGINT UNSIGNED NULL,
    `created_by`     BIGINT UNSIGNED NULL,
    `updated_by`     BIGINT UNSIGNED NULL,
    `created_at`     TIMESTAMP NULL,
    `updated_at`     TIMESTAMP NULL,
    `is_active`      TINYINT(1) NOT NULL DEFAULT 1,
    `is_open`        TINYINT(1) AS (IF(`is_active` = 1 AND `status` IN ('pending', 'approved', 'in_progress'), 1, 0)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_asset_requests_uuid` (`uuid`),
    KEY `ix_asset_requests_employee` (`employee_id`, `status`),
    KEY `ix_asset_requests_company` (`company_id`, `status`, `priority`),
    KEY `ix_asset_requests_asset` (`asset_id`, `status`),
    KEY `ix_asset_requests_open` (`company_id`, `is_open`),
    CONSTRAINT `fk_asset_requests_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_asset_requests_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_asset_requests_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_asset_requests_handler` FOREIGN KEY (`handler_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `exit_clearances`
    ADD COLUMN `asset_allocation_id` BIGINT UNSIGNED NULL AFTER `clearance_item_id`,
    ADD KEY `ix_exit_clearances_allocation` (`asset_allocation_id`),
    ADD CONSTRAINT `fk_exit_clearances_allocation` FOREIGN KEY (`asset_allocation_id`) REFERENCES `asset_allocations` (`id`) ON DELETE SET NULL;

DELETE rp FROM `role_permissions` rp
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`module` = 'asset';

DELETE FROM `permissions` WHERE `module` = 'asset';

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
('asset', 'manage',  'asset.manage',  'Manage IT Assets',        'asset', NOW()),
('asset', 'support', 'asset.support', 'Handle Asset Requests',   'asset', NOW());

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`module` = 'asset'
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
