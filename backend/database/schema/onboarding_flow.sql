SET NAMES utf8mb4;
USE `clanio`;

SET @has_father := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'father_name'
);

SET @sql := IF(
    @has_father = 0,
    'ALTER TABLE `employees`
        ADD COLUMN `father_name` VARCHAR(150) NULL AFTER `date_of_birth`',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_setup := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'profile_setup_seen_at'
);

SET @sql2 := IF(
    @has_setup = 0,
    'ALTER TABLE `employees`
        ADD COLUMN `profile_setup_seen_at` TIMESTAMP NULL AFTER `policy_gate_cleared_at`,
        ADD COLUMN `profile_nudged_at`     TIMESTAMP NULL AFTER `profile_setup_seen_at`',
    'SELECT 1'
);

PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @has_tour := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'clanio' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'tour_done_at'
);

SET @sql3 := IF(
    @has_tour = 0,
    'ALTER TABLE `users`
        ADD COLUMN `tour_done_at` TIMESTAMP NULL AFTER `last_login_ip`',
    'SELECT 1'
);

PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

UPDATE `users`
SET `tour_done_at` = NOW()
WHERE `tour_done_at` IS NULL
  AND (`last_login_at` IS NOT NULL OR `is_super_admin` = 1);

UPDATE `employees` e
JOIN `users` u ON u.`id` = e.`user_id`
SET e.`profile_setup_seen_at` = NOW()
WHERE e.`profile_setup_seen_at` IS NULL
  AND u.`last_login_at` IS NOT NULL;
