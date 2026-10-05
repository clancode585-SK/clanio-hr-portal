SET NAMES utf8mb4;
USE `clanio`;

CREATE TABLE `plan_modules` (
    `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `plan_id`    BIGINT UNSIGNED NOT NULL,
    `module`     VARCHAR(30) NOT NULL,
    `created_at` TIMESTAMP NULL,
    `updated_at` TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_plan_modules` (`plan_id`, `module`),
    CONSTRAINT `fk_plan_modules_plan` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Jo plan pehle se hain unko sab module de do — admin baad me ghata sakta hai
INSERT INTO `plan_modules` (`plan_id`, `module`, `created_at`, `updated_at`)
SELECT p.`id`, m.`module`, NOW(), NOW()
FROM `plans` p
CROSS JOIN (SELECT DISTINCT `module` FROM `permissions`) m;
