SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `attendance_regularizations`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `attendance_regularizations` (
    `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                  CHAR(36) NOT NULL,
    `company_id`            BIGINT UNSIGNED NOT NULL,
    `employee_id`           BIGINT UNSIGNED NOT NULL,
    `attendance_date`       DATE NOT NULL,
    `type`                  VARCHAR(20) NOT NULL,
    `requested_check_in`    DATETIME NULL,
    `requested_check_out`   DATETIME NULL,
    `previous_check_in`     DATETIME NULL,
    `previous_check_out`    DATETIME NULL,
    `previous_status`       VARCHAR(20) NULL,
    `reason`                VARCHAR(500) NOT NULL,
    `status`                VARCHAR(15) NOT NULL DEFAULT 'pending',
    `applied_by`            BIGINT UNSIGNED NULL,
    `approver_id`           BIGINT UNSIGNED NULL,
    `decided_at`            TIMESTAMP NULL,
    `decision_remarks`      VARCHAR(500) NULL,
    `attendance_id`         BIGINT UNSIGNED NULL,
    `created_by`            BIGINT UNSIGNED NULL,
    `updated_by`            BIGINT UNSIGNED NULL,
    `created_at`            TIMESTAMP NULL,
    `updated_at`            TIMESTAMP NULL,
    `deleted_at`            TIMESTAMP NULL,
    `day_key`               VARCHAR(60) AS (IF(`deleted_at` IS NULL AND `status` IN ('pending', 'approved'), CONCAT(`employee_id`, ':', `attendance_date`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_regularizations_uuid` (`uuid`),
    UNIQUE KEY `uq_regularizations_open_day` (`day_key`),
    KEY `ix_regularizations_employee` (`employee_id`, `attendance_date`),
    KEY `ix_regularizations_company_status` (`company_id`, `status`, `attendance_date`),
    KEY `ix_regularizations_approver` (`approver_id`, `status`),
    KEY `ix_regularizations_type` (`company_id`, `type`, `attendance_date`),
    CONSTRAINT `fk_regularizations_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_regularizations_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_regularizations_attendance` FOREIGN KEY (`attendance_id`) REFERENCES `attendances` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_regularizations_approver` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `companies`
    ADD COLUMN `regularization_days` TINYINT UNSIGNED NOT NULL DEFAULT 7 AFTER `eod_cutoff`;

DELETE rp FROM `role_permissions` rp
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`slug` = 'attendance.regularize';

DELETE FROM `permissions` WHERE `slug` = 'attendance.regularize';

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
('attendance', 'regularize', 'attendance.regularize', 'Approve Any Regularization', 'attendance', NOW());

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`slug` = 'attendance.regularize'
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
