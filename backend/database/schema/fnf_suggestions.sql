SET NAMES utf8mb4;
USE `clanio`;

SET @has_applied := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'fnf_lines' AND COLUMN_NAME = 'is_applied'
);

SET @sql := IF(
    @has_applied = 0,
    'ALTER TABLE `fnf_lines`
        ADD COLUMN `is_applied` TINYINT(1) NOT NULL DEFAULT 1 AFTER `source`,
        ADD COLUMN `suggested_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER `amount`',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `companies` SET `gratuity_enabled` = 0;

SET @has_encash_toggle := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'encashment_enabled'
);

SET @sql2 := IF(
    @has_encash_toggle = 0,
    'ALTER TABLE `companies`
        ADD COLUMN `encashment_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `gratuity_month_days`',
    'SELECT 1'
);

PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

DELETE FROM `cache`;
