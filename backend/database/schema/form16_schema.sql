SET NAMES utf8mb4;
USE `clanio`;

ALTER TABLE `companies`
    ADD COLUMN `cit_tds_address` VARCHAR(400) NULL AFTER `tan_number`,
    ADD COLUMN `letter_signatory_parent` VARCHAR(150) NULL AFTER `letter_signatory_designation`,
    ADD COLUMN `letter_signatory_place` VARCHAR(150) NULL AFTER `letter_signatory_parent`;
