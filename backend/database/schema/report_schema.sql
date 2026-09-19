SET NAMES utf8mb4;
USE `clanio`;

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
    ('report', 'view',   'report.view',   'View Reports',       'settings', NOW()),
    ('report', 'export', 'report.export', 'Download Report Files', 'settings', NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`slug` IN ('report.view', 'report.export')
  AND r.`slug` = 'company_admin'
ON DUPLICATE KEY UPDATE `role_permissions`.`updated_at` = NOW();

INSERT INTO `company_modules` (`company_id`, `module`, `is_enabled`, `note`, `created_at`, `updated_at`)
SELECT c.`id`, 'report', 0, 'Off by default — admin decides who gets it', NOW(), NOW()
FROM `companies` c
ON DUPLICATE KEY UPDATE `company_modules`.`updated_at` = NOW();
