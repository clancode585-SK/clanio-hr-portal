SET NAMES utf8mb4;
USE `clanio`;

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`)
SELECT r.`id`, p.`id`, NOW()
FROM `roles` r
JOIN `permissions` p ON p.`slug` IN ('fnf.view', 'fnf.manage', 'fnf.approve')
WHERE r.`slug` IN ('company_admin', 'hr_manager')
  AND NOT EXISTS (
      SELECT 1 FROM `role_permissions` rp
      WHERE rp.`role_id` = r.`id` AND rp.`permission_id` = p.`id`
  );

DELETE FROM `cache`;
