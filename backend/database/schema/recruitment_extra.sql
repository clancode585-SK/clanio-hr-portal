SET NAMES utf8mb4;
USE `clanio`;

SET @has_request := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'job_openings' AND COLUMN_NAME = 'requested_by'
);

SET @sql := IF(
    @has_request = 0,
    'ALTER TABLE `job_openings`
        ADD COLUMN `requested_by`     BIGINT UNSIGNED NULL AFTER `status`,
        ADD COLUMN `requested_at`     TIMESTAMP NULL AFTER `requested_by`,
        ADD COLUMN `request_note`     VARCHAR(1000) NULL AFTER `requested_at`,
        ADD COLUMN `approved_by`      BIGINT UNSIGNED NULL AFTER `request_note`,
        ADD COLUMN `approved_at`      TIMESTAMP NULL AFTER `approved_by`,
        ADD COLUMN `decline_reason`   VARCHAR(255) NULL AFTER `approved_at`,
        ADD KEY `ix_job_openings_requester` (`requested_by`)',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `offer_letters` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`             CHAR(36) NOT NULL,
    `company_id`       BIGINT UNSIGNED NOT NULL,
    `application_id`   BIGINT UNSIGNED NOT NULL,
    `letter_number`    VARCHAR(30) NOT NULL,
    `candidate_name`   VARCHAR(150) NOT NULL,
    `role_title`       VARCHAR(200) NOT NULL,
    `designation`      VARCHAR(150) NULL,
    `department`       VARCHAR(150) NULL,
    `location`         VARCHAR(150) NOT NULL,
    `employment_type`  VARCHAR(20) NOT NULL DEFAULT 'full_time',
    `annual_ctc`       DECIMAL(12,2) NOT NULL,
    `joining_date`     DATE NOT NULL,
    `reporting_to`     VARCHAR(150) NULL,
    `probation_months` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `notice_days`      SMALLINT UNSIGNED NOT NULL DEFAULT 30,
    `valid_till`       DATE NULL,
    `extra_terms`      TEXT NULL,
    `status`           VARCHAR(20) NOT NULL DEFAULT 'issued',
    `issued_at`        TIMESTAMP NULL,
    `responded_at`     TIMESTAMP NULL,
    `decline_reason`   VARCHAR(255) NULL,
    `signed_by`        BIGINT UNSIGNED NULL,
    `created_by`       BIGINT UNSIGNED NULL,
    `updated_by`       BIGINT UNSIGNED NULL,
    `created_at`       TIMESTAMP NULL,
    `updated_at`       TIMESTAMP NULL,
    `is_active`        TINYINT(1) NOT NULL DEFAULT 1,
    `app_key`          VARCHAR(40) AS (IF(`is_active` = 1, CONCAT('a', `application_id`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_offer_letters_uuid` (`uuid`),
    UNIQUE KEY `uq_offer_letters_number` (`letter_number`),
    UNIQUE KEY `uq_offer_letters_app` (`app_key`),
    KEY `ix_offer_letters_company` (`company_id`, `status`),
    CONSTRAINT `fk_offer_letters_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_offer_letters_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_offer_letters_user` FOREIGN KEY (`signed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_intake := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'career_pages' AND COLUMN_NAME = 'intake_key'
);

SET @sql2 := IF(
    @has_intake = 0,
    'ALTER TABLE `career_pages`
        ADD COLUMN `intake_key`      VARCHAR(64) NULL AFTER `embed_key`,
        ADD COLUMN `intake_last_at`  TIMESTAMP NULL AFTER `intake_key`,
        ADD COLUMN `intake_count`    INT UNSIGNED NOT NULL DEFAULT 0 AFTER `intake_last_at`,
        ADD UNIQUE KEY `uq_career_pages_intake` (`intake_key`)',
    'SELECT 1'
);

PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

UPDATE `career_pages`
SET `intake_key` = CONCAT('itk_', LOWER(REPLACE(UUID(), '-', '')))
WHERE `intake_key` IS NULL;

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`)
VALUES
    ('recruitment', 'request', 'recruitment.request', 'Request a Vacancy', 'recruitment', NOW()),
    ('recruitment', 'offer', 'recruitment.offer', 'Issue Offer Letters', 'recruitment', NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`)
SELECT r.`id`, p.`id`, NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`slug` = 'recruitment.request'
  AND r.`slug` IN ('company_admin', 'hr_manager', 'senior_manager', 'manager', 'team_lead')
ON DUPLICATE KEY UPDATE `role_permissions`.`created_at` = `role_permissions`.`created_at`;

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`)
SELECT r.`id`, p.`id`, NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`slug` = 'recruitment.offer'
  AND r.`slug` IN ('company_admin', 'hr_manager')
ON DUPLICATE KEY UPDATE `role_permissions`.`created_at` = `role_permissions`.`created_at`;
