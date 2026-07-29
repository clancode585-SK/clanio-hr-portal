SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `attendance_details`;
DROP TABLE IF EXISTS `attendances`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `attendances` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`              CHAR(36) NOT NULL,
    `company_id`        BIGINT UNSIGNED NOT NULL,
    `employee_id`       BIGINT UNSIGNED NOT NULL,
    `attendance_date`   DATE NOT NULL,
    `first_check_in_at` DATETIME NULL,
    `last_check_out_at` DATETIME NULL,
    `worked_minutes`    INT UNSIGNED NOT NULL DEFAULT 0,
    `break_minutes`     INT UNSIGNED NOT NULL DEFAULT 0,
    `punch_count`       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `status`            VARCHAR(20) NOT NULL DEFAULT 'present',
    `source`            VARCHAR(20) NOT NULL DEFAULT 'self',
    `created_by`        BIGINT UNSIGNED NULL,
    `updated_by`        BIGINT UNSIGNED NULL,
    `created_at`        TIMESTAMP NULL,
    `updated_at`        TIMESTAMP NULL,
    `deleted_at`        TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_attendances_uuid` (`uuid`),
    UNIQUE KEY `uq_attendances_employee_date` (`employee_id`, `attendance_date`),
    KEY `ix_attendances_company_date` (`company_id`, `attendance_date`),
    KEY `ix_attendances_status` (`company_id`, `status`, `attendance_date`),
    CONSTRAINT `fk_attendances_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_attendances_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `attendance_details` (
    `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                CHAR(36) NOT NULL,
    `company_id`          BIGINT UNSIGNED NOT NULL,
    `attendance_id`       BIGINT UNSIGNED NOT NULL,
    `employee_id`         BIGINT UNSIGNED NOT NULL,
    `check_in_at`         DATETIME NOT NULL,
    `check_in_latitude`   DECIMAL(10,7) NULL,
    `check_in_longitude`  DECIMAL(10,7) NULL,
    `check_in_ip`         VARCHAR(45) NULL,
    `check_out_at`        DATETIME NULL,
    `check_out_latitude`  DECIMAL(10,7) NULL,
    `check_out_longitude` DECIMAL(10,7) NULL,
    `check_out_ip`        VARCHAR(45) NULL,
    `worked_minutes`      INT UNSIGNED NULL,
    `open_key`            BIGINT UNSIGNED AS (IF(`check_out_at` IS NULL, `employee_id`, NULL)) STORED,
    `source`              VARCHAR(20) NOT NULL DEFAULT 'self',
    `created_by`          BIGINT UNSIGNED NULL,
    `updated_by`          BIGINT UNSIGNED NULL,
    `created_at`          TIMESTAMP NULL,
    `updated_at`          TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_attendance_details_uuid` (`uuid`),
    UNIQUE KEY `uq_attendance_details_open` (`open_key`),
    KEY `ix_attendance_details_attendance` (`attendance_id`),
    KEY `ix_attendance_details_employee` (`employee_id`, `check_in_at`),
    CONSTRAINT `fk_attendance_details_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_attendance_details_attendance` FOREIGN KEY (`attendance_id`) REFERENCES `attendances` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_attendance_details_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELETE rp FROM `role_permissions` rp
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`module` = 'attendance';

DELETE FROM `permissions` WHERE `module` = 'attendance';
