SET NAMES utf8mb4;
USE `clanio`;

ALTER TABLE `employees`
    ADD COLUMN `has_pf_account`  TINYINT(1) NOT NULL DEFAULT 0 AFTER `pan_number`,
    ADD COLUMN `uan_number`      VARCHAR(12) NULL AFTER `has_pf_account`,
    ADD COLUMN `aadhaar_number`  VARCHAR(12) NULL AFTER `uan_number`,
    ADD COLUMN `esic_number`     VARCHAR(17) NULL AFTER `aadhaar_number`,
    ADD COLUMN `pt_state`        VARCHAR(50) NULL AFTER `esic_number`,
    ADD COLUMN `uan_key`         VARCHAR(30) AS (IF(`is_active` = 1 AND `uan_number` IS NOT NULL, CONCAT(`company_id`, ':', `uan_number`), NULL)) STORED,
    ADD COLUMN `aadhaar_key`     VARCHAR(30) AS (IF(`is_active` = 1 AND `aadhaar_number` IS NOT NULL, CONCAT(`company_id`, ':', `aadhaar_number`), NULL)) STORED,
    ADD UNIQUE KEY `uq_employees_uan` (`uan_key`),
    ADD UNIQUE KEY `uq_employees_aadhaar` (`aadhaar_key`);

DELETE FROM `cache`;
