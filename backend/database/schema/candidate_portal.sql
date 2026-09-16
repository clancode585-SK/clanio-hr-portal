SET NAMES utf8mb4;
USE `clanio`;

SET @has_portal := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'candidates' AND COLUMN_NAME = 'portal_token'
);

SET @sql := IF(
    @has_portal = 0,
    'ALTER TABLE `candidates`
        ADD COLUMN `portal_token`         CHAR(48) NULL AFTER `resume_size`,
        ADD COLUMN `portal_opened_at`     TIMESTAMP NULL AFTER `portal_token`,
        ADD COLUMN `portal_last_seen_at`  TIMESTAMP NULL AFTER `portal_opened_at`,
        ADD COLUMN `portal_visits`        INT UNSIGNED NOT NULL DEFAULT 0 AFTER `portal_last_seen_at`,
        ADD UNIQUE KEY `uq_candidates_portal` (`portal_token`)',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `candidates`
SET `portal_token` = LOWER(CONCAT(REPLACE(UUID(), '-', ''), SUBSTRING(MD5(RAND()), 1, 16)))
WHERE `portal_token` IS NULL;

SET @has_accept := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'offer_letters' AND COLUMN_NAME = 'answered_by_candidate'
);

SET @sql2 := IF(
    @has_accept = 0,
    'ALTER TABLE `offer_letters`
        ADD COLUMN `answered_by_candidate` TINYINT(1) NOT NULL DEFAULT 0 AFTER `decline_reason`',
    'SELECT 1'
);

PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @has_joined := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'converted_at'
);

SET @sql3 := IF(
    @has_joined = 0,
    'ALTER TABLE `applications`
        ADD COLUMN `converted_at` TIMESTAMP NULL AFTER `employee_id`,
        ADD COLUMN `converted_by` BIGINT UNSIGNED NULL AFTER `converted_at`',
    'SELECT 1'
);

PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;
