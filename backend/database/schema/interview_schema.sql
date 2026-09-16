SET NAMES utf8mb4;
USE `clanio`;

CREATE TABLE IF NOT EXISTS `interviews` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`             CHAR(36) NOT NULL,
    `company_id`       BIGINT UNSIGNED NOT NULL,
    `application_id`   BIGINT UNSIGNED NOT NULL,
    `round_no`         SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `title`            VARCHAR(150) NULL,
    `kind`             VARCHAR(20) NOT NULL DEFAULT 'technical',
    `mode`             VARCHAR(20) NOT NULL DEFAULT 'video',
    `interviewer_id`   BIGINT UNSIGNED NULL,
    `scheduled_at`     DATETIME NOT NULL,
    `duration_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 45,
    `location`         VARCHAR(200) NULL,
    `meeting_room`     VARCHAR(120) NULL,
    `meeting_url`      VARCHAR(255) NULL,
    `status`           VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    `verdict`          VARCHAR(20) NULL,
    `rating`           TINYINT UNSIGNED NULL,
    `feedback`         TEXT NULL,
    `submitted_at`     TIMESTAMP NULL,
    `cancel_reason`    VARCHAR(255) NULL,
    `created_by`       BIGINT UNSIGNED NULL,
    `updated_by`       BIGINT UNSIGNED NULL,
    `created_at`       TIMESTAMP NULL,
    `updated_at`       TIMESTAMP NULL,
    `is_active`        TINYINT(1) NOT NULL DEFAULT 1,
    `round_key`        VARCHAR(40) AS (IF(`is_active` = 1, CONCAT(`application_id`, ':', `round_no`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_interviews_uuid` (`uuid`),
    UNIQUE KEY `uq_interviews_round` (`round_key`),
    KEY `ix_interviews_company` (`company_id`, `scheduled_at`),
    KEY `ix_interviews_application` (`application_id`, `round_no`),
    KEY `ix_interviews_interviewer` (`interviewer_id`, `scheduled_at`),
    CONSTRAINT `fk_interviews_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_interviews_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_interviews_user` FOREIGN KEY (`interviewer_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`)
VALUES ('recruitment', 'interview', 'interview.conduct', 'Conduct Interviews', 'recruitment', NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`)
SELECT r.`id`, p.`id`, NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`slug` = 'interview.conduct'
  AND r.`slug` IN ('company_admin', 'hr_manager', 'senior_manager', 'manager', 'team_lead')
ON DUPLICATE KEY UPDATE `role_permissions`.`created_at` = `role_permissions`.`created_at`;
