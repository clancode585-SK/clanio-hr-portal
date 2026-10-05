SET NAMES utf8mb4;
USE `clanio`;

ALTER TABLE `users`
    ADD COLUMN `verification_code_hash` VARCHAR(64) NULL AFTER `status`,
    ADD COLUMN `verification_expires_at` TIMESTAMP NULL AFTER `verification_code_hash`;
