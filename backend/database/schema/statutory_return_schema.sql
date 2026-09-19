SET NAMES utf8mb4;
USE `clanio`;

ALTER TABLE `companies`
    ADD COLUMN `eps_percent` DECIMAL(5, 2) NOT NULL DEFAULT 8.33 AFTER `pf_wage_ceiling`,
    ADD COLUMN `eps_wage_ceiling` DECIMAL(12, 2) NOT NULL DEFAULT 15000.00 AFTER `eps_percent`,
    ADD COLUMN `pf_establishment_code` VARCHAR(30) NULL AFTER `eps_wage_ceiling`,
    ADD COLUMN `esi_establishment_code` VARCHAR(30) NULL AFTER `esi_wage_limit`;
