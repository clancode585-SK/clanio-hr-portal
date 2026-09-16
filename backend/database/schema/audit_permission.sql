SET NAMES utf8mb4;
USE `clanio`;

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`)
VALUES ('audit', 'view', 'audit.view', 'View Audit Log', 'settings', NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`)
SELECT r.`id`, p.`id`, NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`slug` = 'audit.view'
  AND r.`slug` IN ('super_admin', 'company_admin')
ON DUPLICATE KEY UPDATE `role_permissions`.`created_at` = `role_permissions`.`created_at`;

INSERT INTO `company_modules` (`company_id`, `module`, `is_enabled`, `created_at`, `updated_at`)
SELECT c.`id`, 'audit', 1, NOW(), NOW()
FROM `companies` c
ON DUPLICATE KEY UPDATE `is_enabled` = `company_modules`.`is_enabled`;

DELETE rp FROM `role_permissions` rp
JOIN `roles` r ON r.`id` = rp.`role_id`
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`slug` = 'plan.manage'
  AND r.`slug` <> 'super_admin';
