SET NAMES utf8mb4;
USE `clanio`;

ALTER TABLE `exit_documents`
    ADD COLUMN `source` VARCHAR(20) NOT NULL DEFAULT 'uploaded' AFTER `type`,
    ADD COLUMN `letter_number` VARCHAR(30) NULL AFTER `source`,
    ADD COLUMN `body` TEXT NULL AFTER `remarks`,
    ADD COLUMN `signatory_name` VARCHAR(150) NULL AFTER `body`,
    ADD COLUMN `signatory_designation` VARCHAR(150) NULL AFTER `signatory_name`;

ALTER TABLE `exit_documents`
    MODIFY `file_path` VARCHAR(255) NULL,
    MODIFY `original_name` VARCHAR(255) NULL,
    MODIFY `mime_type` VARCHAR(100) NULL;

ALTER TABLE `exit_documents`
    ADD UNIQUE KEY `exit_documents_letter_unique` (`company_id`, `letter_number`);

ALTER TABLE `companies`
    ADD COLUMN `letter_signatory_name` VARCHAR(150) NULL AFTER `advance_max_tenure`,
    ADD COLUMN `letter_signatory_designation` VARCHAR(150) NULL AFTER `letter_signatory_name`;
