SET NAMES utf8mb4;
USE `clanio`;

ALTER TABLE `branches`
    ADD COLUMN `latitude` DECIMAL(10, 7) NULL AFTER `address`,
    ADD COLUMN `longitude` DECIMAL(10, 7) NULL AFTER `latitude`,
    ADD COLUMN `geo_radius_metres` SMALLINT UNSIGNED NOT NULL DEFAULT 200 AFTER `longitude`;

ALTER TABLE `companies`
    ADD COLUMN `geo_fence_mode` VARCHAR(10) NOT NULL DEFAULT 'off' AFTER `advance_max_tenure`;

ALTER TABLE `employees`
    ADD COLUMN `geo_fence_exempt` TINYINT(1) NOT NULL DEFAULT 0 AFTER `tax_regime`;

ALTER TABLE `attendance_details`
    ADD COLUMN `check_in_distance_m` INT UNSIGNED NULL AFTER `check_in_ip`,
    ADD COLUMN `check_in_outside` TINYINT(1) NOT NULL DEFAULT 0 AFTER `check_in_distance_m`,
    ADD COLUMN `check_out_distance_m` INT UNSIGNED NULL AFTER `check_out_ip`,
    ADD COLUMN `check_out_outside` TINYINT(1) NOT NULL DEFAULT 0 AFTER `check_out_distance_m`;
