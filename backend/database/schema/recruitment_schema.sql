SET NAMES utf8mb4;
USE `clanio`;

CREATE TABLE IF NOT EXISTS `career_pages` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`             CHAR(36) NOT NULL,
    `company_id`       BIGINT UNSIGNED NOT NULL,
    `embed_key`        VARCHAR(40) NOT NULL,
    `headline`         VARCHAR(150) NULL,
    `intro`            VARCHAR(1000) NULL,
    `layout`           VARCHAR(10) NOT NULL DEFAULT 'cards',
    `accent_color`     VARCHAR(7) NOT NULL DEFAULT '#1B2A6B',
    `show_powered_by`  TINYINT(1) NOT NULL DEFAULT 1,
    `allowed_domains`  VARCHAR(500) NULL,
    `connected_at`     TIMESTAMP NULL,
    `last_seen_at`     TIMESTAMP NULL,
    `last_seen_domain` VARCHAR(200) NULL,
    `view_count`       INT UNSIGNED NOT NULL DEFAULT 0,
    `created_by`       BIGINT UNSIGNED NULL,
    `updated_by`       BIGINT UNSIGNED NULL,
    `created_at`       TIMESTAMP NULL,
    `updated_at`       TIMESTAMP NULL,
    `is_active`        TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_career_pages_uuid` (`uuid`),
    UNIQUE KEY `uq_career_pages_company` (`company_id`),
    UNIQUE KEY `uq_career_pages_key` (`embed_key`),
    CONSTRAINT `fk_career_pages_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `job_openings` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`             CHAR(36) NOT NULL,
    `company_id`       BIGINT UNSIGNED NOT NULL,
    `slug`             VARCHAR(150) NOT NULL,
    `title`            VARCHAR(200) NOT NULL,
    `department_id`    BIGINT UNSIGNED NULL,
    `designation_id`   BIGINT UNSIGNED NULL,
    `branch_id`        BIGINT UNSIGNED NULL,
    `location`         VARCHAR(150) NOT NULL,
    `work_mode`        VARCHAR(20) NOT NULL DEFAULT 'onsite',
    `employment_type`  VARCHAR(20) NOT NULL DEFAULT 'full_time',
    `experience_min`   DECIMAL(4,1) NOT NULL DEFAULT 0,
    `experience_max`   DECIMAL(4,1) NULL,
    `positions`        SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `salary_min`       DECIMAL(12,2) NULL,
    `salary_max`       DECIMAL(12,2) NULL,
    `show_salary`      TINYINT(1) NOT NULL DEFAULT 0,
    `summary`          VARCHAR(500) NULL,
    `responsibilities` TEXT NULL,
    `requirements`     TEXT NULL,
    `nice_to_have`     TEXT NULL,
    `status`           VARCHAR(20) NOT NULL DEFAULT 'draft',
    `published_at`     TIMESTAMP NULL,
    `closes_on`        DATE NULL,
    `closed_at`        TIMESTAMP NULL,
    `created_by`       BIGINT UNSIGNED NULL,
    `updated_by`       BIGINT UNSIGNED NULL,
    `created_at`       TIMESTAMP NULL,
    `updated_at`       TIMESTAMP NULL,
    `is_active`        TINYINT(1) NOT NULL DEFAULT 1,
    `slug_key`         VARCHAR(200) AS (IF(`is_active` = 1, CONCAT(`company_id`, ':', `slug`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_job_openings_uuid` (`uuid`),
    UNIQUE KEY `uq_job_openings_slug` (`slug_key`),
    KEY `ix_job_openings_company` (`company_id`, `status`),
    KEY `ix_job_openings_department` (`department_id`),
    CONSTRAINT `fk_job_openings_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_job_openings_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_job_openings_designation` FOREIGN KEY (`designation_id`) REFERENCES `designations` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_job_openings_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `candidates` (
    `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`               CHAR(36) NOT NULL,
    `company_id`         BIGINT UNSIGNED NOT NULL,
    `name`               VARCHAR(150) NOT NULL,
    `email`              VARCHAR(200) NOT NULL,
    `phone`              VARCHAR(20) NOT NULL,
    `total_experience`   DECIMAL(4,1) NULL,
    `current_company`    VARCHAR(150) NULL,
    `current_location`   VARCHAR(150) NULL,
    `current_ctc`        DECIMAL(12,2) NULL,
    `expected_ctc`       DECIMAL(12,2) NULL,
    `notice_period_days` SMALLINT UNSIGNED NULL,
    `linkedin_url`       VARCHAR(255) NULL,
    `source`             VARCHAR(20) NOT NULL DEFAULT 'website',
    `source_detail`      VARCHAR(100) NULL,
    `referred_by`        BIGINT UNSIGNED NULL,
    `resume_path`        VARCHAR(255) NULL,
    `resume_name`        VARCHAR(200) NULL,
    `resume_size`        INT UNSIGNED NULL,
    `created_by`         BIGINT UNSIGNED NULL,
    `updated_by`         BIGINT UNSIGNED NULL,
    `created_at`         TIMESTAMP NULL,
    `updated_at`         TIMESTAMP NULL,
    `is_active`          TINYINT(1) NOT NULL DEFAULT 1,
    `email_key`          VARCHAR(220) AS (IF(`is_active` = 1, CONCAT(`company_id`, ':', `email`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_candidates_uuid` (`uuid`),
    UNIQUE KEY `uq_candidates_email` (`email_key`),
    KEY `ix_candidates_company` (`company_id`, `created_at`),
    CONSTRAINT `fk_candidates_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_candidates_referrer` FOREIGN KEY (`referred_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `applications` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`              CHAR(36) NOT NULL,
    `company_id`        BIGINT UNSIGNED NOT NULL,
    `job_opening_id`    BIGINT UNSIGNED NOT NULL,
    `candidate_id`      BIGINT UNSIGNED NOT NULL,
    `stage`             VARCHAR(20) NOT NULL DEFAULT 'applied',
    `rating`            TINYINT UNSIGNED NULL,
    `cover_note`        TEXT NULL,
    `offered_ctc`       DECIMAL(12,2) NULL,
    `offer_date`        DATE NULL,
    `joining_date`      DATE NULL,
    `rejection_reason`  VARCHAR(255) NULL,
    `stage_changed_at`  TIMESTAMP NULL,
    `stage_changed_by`  BIGINT UNSIGNED NULL,
    `employee_id`       BIGINT UNSIGNED NULL,
    `source`            VARCHAR(20) NOT NULL DEFAULT 'website',
    `source_detail`     VARCHAR(100) NULL,
    `applied_ip`        VARCHAR(45) NULL,
    `created_by`        BIGINT UNSIGNED NULL,
    `updated_by`        BIGINT UNSIGNED NULL,
    `created_at`        TIMESTAMP NULL,
    `updated_at`        TIMESTAMP NULL,
    `is_active`         TINYINT(1) NOT NULL DEFAULT 1,
    `pair_key`          VARCHAR(50) AS (IF(`is_active` = 1, CONCAT(`job_opening_id`, ':', `candidate_id`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_applications_uuid` (`uuid`),
    UNIQUE KEY `uq_applications_pair` (`pair_key`),
    KEY `ix_applications_company` (`company_id`, `stage`),
    KEY `ix_applications_opening` (`job_opening_id`, `stage`),
    KEY `ix_applications_candidate` (`candidate_id`),
    CONSTRAINT `fk_applications_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_applications_opening` FOREIGN KEY (`job_opening_id`) REFERENCES `job_openings` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_applications_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `candidates` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_applications_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`)
VALUES
    ('recruitment', 'view', 'recruitment.view', 'View Recruitment', 'recruitment', NOW()),
    ('recruitment', 'manage', 'recruitment.manage', 'Manage Openings and Candidates', 'recruitment', NOW()),
    ('recruitment', 'career_page', 'recruitment.career_page', 'Manage Career Page', 'recruitment', NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`)
SELECT r.`id`, p.`id`, NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`slug` IN ('recruitment.view', 'recruitment.manage', 'recruitment.career_page')
  AND r.`slug` IN ('company_admin', 'hr_manager')
ON DUPLICATE KEY UPDATE `role_permissions`.`created_at` = `role_permissions`.`created_at`;

INSERT INTO `company_modules` (`company_id`, `module`, `is_enabled`, `created_at`, `updated_at`)
SELECT c.`id`, 'recruitment', 1, NOW(), NOW()
FROM `companies` c
ON DUPLICATE KEY UPDATE `is_enabled` = `company_modules`.`is_enabled`;

INSERT INTO `career_pages` (`uuid`, `company_id`, `embed_key`, `created_at`, `updated_at`)
SELECT UUID(), c.`id`, CONCAT(c.`slug`, '-', LOWER(SUBSTRING(MD5(CONCAT(c.`id`, c.`uuid`)), 1, 8))), NOW(), NOW()
FROM `companies` c
ON DUPLICATE KEY UPDATE `career_pages`.`updated_at` = NOW();
