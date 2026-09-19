SET NAMES utf8mb4;
USE `clanio`;

ALTER TABLE `api_tokens`
    ADD COLUMN `user_agent` VARCHAR(255) NULL AFTER `ip_address`;
