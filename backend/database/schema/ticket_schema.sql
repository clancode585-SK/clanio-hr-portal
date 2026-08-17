SET NAMES utf8mb4;
USE `clanio`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `ticket_attachments`;
DROP TABLE IF EXISTS `ticket_comments`;
DROP TABLE IF EXISTS `tickets`;
DROP TABLE IF EXISTS `ticket_category_routes`;
DROP TABLE IF EXISTS `ticket_categories`;
DROP TABLE IF EXISTS `ticket_slas`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `ticket_slas` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id`       BIGINT UNSIGNED NOT NULL,
    `priority`         VARCHAR(10) NOT NULL,
    `response_hours`   SMALLINT UNSIGNED NOT NULL,
    `resolution_hours` SMALLINT UNSIGNED NOT NULL,
    `created_at`       TIMESTAMP NULL,
    `updated_at`       TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_ticket_slas` (`company_id`, `priority`),
    CONSTRAINT `fk_ticket_slas_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ticket_categories` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`             CHAR(36) NOT NULL,
    `company_id`       BIGINT UNSIGNED NOT NULL,
    `name`             VARCHAR(120) NOT NULL,
    `code`             VARCHAR(40) NOT NULL,
    `scope`            VARCHAR(10) NOT NULL DEFAULT 'internal',
    `default_priority` VARCHAR(10) NOT NULL DEFAULT 'medium',
    `support_email`    VARCHAR(255) NULL,
    `response_hours`   SMALLINT UNSIGNED NULL,
    `resolution_hours` SMALLINT UNSIGNED NULL,
    `sort_order`       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `is_system`        TINYINT(1) NOT NULL DEFAULT 0,
    `is_active`        TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`       BIGINT UNSIGNED NULL,
    `updated_by`       BIGINT UNSIGNED NULL,
    `created_at`       TIMESTAMP NULL,
    `updated_at`       TIMESTAMP NULL,
    `code_key`         VARCHAR(90) AS (IF(`is_active` = 1, CONCAT(`company_id`, ':', `code`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_ticket_categories_uuid` (`uuid`),
    UNIQUE KEY `uq_ticket_categories_code` (`code_key`),
    KEY `ix_ticket_categories_scope` (`company_id`, `scope`, `is_active`),
    CONSTRAINT `fk_ticket_categories_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ticket_categories_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_ticket_categories_updater` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ticket_category_routes` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`          CHAR(36) NOT NULL,
    `company_id`    BIGINT UNSIGNED NOT NULL,
    `category_id`   BIGINT UNSIGNED NOT NULL,
    `route_to`      VARCHAR(20) NOT NULL,
    `department_id` BIGINT UNSIGNED NULL,
    `user_id`       BIGINT UNSIGNED NULL,
    `label`         VARCHAR(80) NOT NULL,
    `hint`          VARCHAR(200) NULL,
    `is_default`    TINYINT(1) NOT NULL DEFAULT 0,
    `sort_order`    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `is_active`     TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`    BIGINT UNSIGNED NULL,
    `updated_by`    BIGINT UNSIGNED NULL,
    `created_at`    TIMESTAMP NULL,
    `updated_at`    TIMESTAMP NULL,
    `default_key`   VARCHAR(30) AS (IF(`is_active` = 1 AND `is_default` = 1, `category_id`, NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_ticket_category_routes_uuid` (`uuid`),
    UNIQUE KEY `uq_ticket_category_routes_default` (`default_key`),
    KEY `ix_ticket_category_routes_category` (`category_id`, `is_active`, `sort_order`),
    CONSTRAINT `fk_ticket_category_routes_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ticket_category_routes_category` FOREIGN KEY (`category_id`) REFERENCES `ticket_categories` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ticket_category_routes_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_ticket_category_routes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tickets` (
    `id`                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                    CHAR(36) NOT NULL,
    `company_id`              BIGINT UNSIGNED NOT NULL,
    `ticket_no`               VARCHAR(30) NOT NULL,
    `scope`                   VARCHAR(10) NOT NULL DEFAULT 'internal',
    `category_id`             BIGINT UNSIGNED NOT NULL,
    `route_id`                BIGINT UNSIGNED NULL,
    `route_to`                VARCHAR(20) NOT NULL,
    `subject`                 VARCHAR(200) NOT NULL,
    `message`                 TEXT NOT NULL,
    `priority`                VARCHAR(10) NOT NULL DEFAULT 'medium',
    `status`                  VARCHAR(20) NOT NULL DEFAULT 'open',
    `raised_by`               BIGINT UNSIGNED NOT NULL,
    `assigned_to`             BIGINT UNSIGNED NULL,
    `assigned_department_id`  BIGINT UNSIGNED NULL,
    `first_response_due_at`   TIMESTAMP NULL,
    `resolution_due_at`       TIMESTAMP NULL,
    `first_responded_at`      TIMESTAMP NULL,
    `waiting_since`           TIMESTAMP NULL,
    `paused_minutes`          INT UNSIGNED NOT NULL DEFAULT 0,
    `response_breached`       TINYINT(1) NOT NULL DEFAULT 0,
    `resolution_breached`     TINYINT(1) NOT NULL DEFAULT 0,
    `escalated_at`            TIMESTAMP NULL,
    `resolved_at`             TIMESTAMP NULL,
    `resolved_by`             BIGINT UNSIGNED NULL,
    `resolution_note`         VARCHAR(1000) NULL,
    `closed_at`               TIMESTAMP NULL,
    `closed_by`               BIGINT UNSIGNED NULL,
    `reopened_at`             TIMESTAMP NULL,
    `reopen_count`            TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `cancelled_at`            TIMESTAMP NULL,
    `is_active`               TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`              BIGINT UNSIGNED NULL,
    `updated_by`              BIGINT UNSIGNED NULL,
    `created_at`              TIMESTAMP NULL,
    `updated_at`              TIMESTAMP NULL,
    `number_key`              VARCHAR(60) AS (IF(`is_active` = 1, CONCAT(`company_id`, ':', `ticket_no`), NULL)) STORED,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_tickets_uuid` (`uuid`),
    UNIQUE KEY `uq_tickets_number` (`number_key`),
    KEY `ix_tickets_raiser` (`raised_by`, `status`),
    KEY `ix_tickets_assignee` (`assigned_to`, `status`),
    KEY `ix_tickets_department` (`assigned_department_id`, `status`),
    KEY `ix_tickets_company_scope` (`company_id`, `scope`, `status`),
    KEY `ix_tickets_due` (`status`, `resolution_due_at`),
    KEY `ix_tickets_active` (`company_id`, `is_active`),
    CONSTRAINT `fk_tickets_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_tickets_category` FOREIGN KEY (`category_id`) REFERENCES `ticket_categories` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_tickets_route` FOREIGN KEY (`route_id`) REFERENCES `ticket_category_routes` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_tickets_raiser` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_tickets_assignee` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_tickets_department` FOREIGN KEY (`assigned_department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_tickets_resolver` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_tickets_closer` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ticket_comments` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`        CHAR(36) NOT NULL,
    `company_id`  BIGINT UNSIGNED NOT NULL,
    `ticket_id`   BIGINT UNSIGNED NOT NULL,
    `user_id`     BIGINT UNSIGNED NOT NULL,
    `body`        TEXT NOT NULL,
    `is_internal` TINYINT(1) NOT NULL DEFAULT 0,
    `is_active`   TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`  BIGINT UNSIGNED NULL,
    `updated_by`  BIGINT UNSIGNED NULL,
    `created_at`  TIMESTAMP NULL,
    `updated_at`  TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_ticket_comments_uuid` (`uuid`),
    KEY `ix_ticket_comments_ticket` (`ticket_id`, `is_active`, `id`),
    CONSTRAINT `fk_ticket_comments_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ticket_comments_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ticket_comments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ticket_attachments` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`          CHAR(36) NOT NULL,
    `company_id`    BIGINT UNSIGNED NOT NULL,
    `ticket_id`     BIGINT UNSIGNED NOT NULL,
    `comment_id`    BIGINT UNSIGNED NULL,
    `file_path`     VARCHAR(255) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `mime_type`     VARCHAR(100) NULL,
    `size_bytes`    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `uploaded_by`   BIGINT UNSIGNED NULL,
    `is_active`     TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`    TIMESTAMP NULL,
    `updated_at`    TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_ticket_attachments_uuid` (`uuid`),
    KEY `ix_ticket_attachments_ticket` (`ticket_id`, `is_active`),
    CONSTRAINT `fk_ticket_attachments_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ticket_attachments_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ticket_attachments_comment` FOREIGN KEY (`comment_id`) REFERENCES `ticket_comments` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ticket_attachments_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELETE rp FROM `role_permissions` rp
JOIN `permissions` p ON p.`id` = rp.`permission_id`
WHERE p.`module` = 'ticket';

DELETE dp FROM `department_permissions` dp
JOIN `permissions` p ON p.`id` = dp.`permission_id`
WHERE p.`module` = 'ticket';

DELETE up FROM `user_permissions` up
JOIN `permissions` p ON p.`id` = up.`permission_id`
WHERE p.`module` = 'ticket';

DELETE FROM `permissions` WHERE `module` = 'ticket';

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
('ticket', 'view_all',       'ticket.view_all',       'View All Tickets',        'ticket', NOW()),
('ticket', 'assign',         'ticket.assign',         'Assign Tickets',          'ticket', NOW()),
('ticket', 'resolve',        'ticket.resolve',        'Resolve Tickets',         'ticket', NOW()),
('ticket', 'category_manage','ticket.category_manage','Manage Ticket Categories','ticket', NOW()),
('ticket', 'platform',       'ticket.platform',       'Raise Platform Tickets',  'ticket', NOW());

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`module` = 'ticket'
  AND r.`slug` IN ('super_admin', 'company_admin');

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`slug` IN ('ticket.view_all', 'ticket.assign', 'ticket.resolve', 'ticket.category_manage')
  AND r.`slug` = 'hr_manager';

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW()
FROM `roles` r
CROSS JOIN `permissions` p
WHERE p.`slug` IN ('ticket.assign', 'ticket.resolve')
  AND r.`slug` IN ('manager', 'team_lead');

INSERT INTO `company_modules` (`company_id`, `module`, `is_enabled`, `created_at`, `updated_at`)
SELECT c.`id`, 'ticket', 1, NOW(), NOW()
FROM `companies` c
WHERE NOT EXISTS (
    SELECT 1 FROM `company_modules` cm WHERE cm.`company_id` = c.`id` AND cm.`module` = 'ticket'
);

INSERT INTO `ticket_slas` (`company_id`, `priority`, `response_hours`, `resolution_hours`, `created_at`, `updated_at`)
SELECT c.`id`, s.`priority`, s.`response_hours`, s.`resolution_hours`, NOW(), NOW()
FROM `companies` c
CROSS JOIN (
    SELECT 'urgent' AS `priority`,  1 AS `response_hours`,   4 AS `resolution_hours`
    UNION ALL SELECT 'high',        4,                      24
    UNION ALL SELECT 'medium',      8,                      48
    UNION ALL SELECT 'low',        24,                     120
) s;

INSERT INTO `ticket_categories` (`uuid`, `company_id`, `name`, `code`, `scope`, `default_priority`, `sort_order`, `is_system`, `created_at`, `updated_at`)
SELECT UUID(), c.`id`, t.`name`, t.`code`, t.`scope`, t.`default_priority`, t.`sort_order`, 1, NOW(), NOW()
FROM `companies` c
CROSS JOIN (
    SELECT 'Salary / Payslip'      AS `name`, 'salary'    AS `code`, 'internal' AS `scope`, 'medium' AS `default_priority`, 1 AS `sort_order`
    UNION ALL SELECT 'Leave / Attendance',      'leave',     'internal', 'medium', 2
    UNION ALL SELECT 'Work / Task / Project',   'work',      'internal', 'medium', 3
    UNION ALL SELECT 'IT / Laptop / System',    'it',        'internal', 'high',   4
    UNION ALL SELECT 'Policy / Document',       'policy',    'internal', 'low',    5
    UNION ALL SELECT 'Office / Facility',       'facility',  'internal', 'medium', 6
    UNION ALL SELECT 'Kuch aur',                'other',     'internal', 'low',    7
    UNION ALL SELECT 'Billing / Plan',          'billing',   'platform', 'high',   1
    UNION ALL SELECT 'Technical Issue',         'technical', 'platform', 'high',   2
    UNION ALL SELECT 'Feature Request',         'feature',   'platform', 'low',    3
    UNION ALL SELECT 'Account / Data',          'account',   'platform', 'medium', 4
) t;

INSERT INTO `ticket_category_routes` (`uuid`, `company_id`, `category_id`, `route_to`, `department_id`, `label`, `hint`, `is_default`, `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), tc.`company_id`, tc.`id`, 'department',
       (SELECT d.`id` FROM `departments` d
        WHERE d.`company_id` = tc.`company_id` AND d.`is_active` = 1
          AND (d.`code` = 'HR' OR d.`name` LIKE '%Human Resource%' OR d.`name` LIKE 'HR%')
        ORDER BY d.`id` LIMIT 1),
       'HR', NULL, 1, 1, NOW(), NOW()
FROM `ticket_categories` tc
WHERE tc.`code` IN ('salary', 'policy');

INSERT INTO `ticket_category_routes` (`uuid`, `company_id`, `category_id`, `route_to`, `department_id`, `label`, `hint`, `is_default`, `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), tc.`company_id`, tc.`id`, 'manager', NULL,
       'Mera Manager', 'Approval, adjustment ya planning ka sawal', 1, 1, NOW(), NOW()
FROM `ticket_categories` tc
WHERE tc.`code` IN ('leave', 'work');

INSERT INTO `ticket_category_routes` (`uuid`, `company_id`, `category_id`, `route_to`, `department_id`, `label`, `hint`, `is_default`, `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), tc.`company_id`, tc.`id`, 'department',
       (SELECT d.`id` FROM `departments` d
        WHERE d.`company_id` = tc.`company_id` AND d.`is_active` = 1
          AND (d.`code` = 'HR' OR d.`name` LIKE '%Human Resource%' OR d.`name` LIKE 'HR%')
        ORDER BY d.`id` LIMIT 1),
       'HR', 'Balance galat hai ya policy ka sawal hai', 0, 2, NOW(), NOW()
FROM `ticket_categories` tc
WHERE tc.`code` = 'leave';

INSERT INTO `ticket_category_routes` (`uuid`, `company_id`, `category_id`, `route_to`, `department_id`, `label`, `hint`, `is_default`, `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), tc.`company_id`, tc.`id`, 'department',
       (SELECT d.`id` FROM `departments` d
        WHERE d.`company_id` = tc.`company_id` AND d.`is_active` = 1
          AND (d.`code` IN ('IT', 'TECH') OR d.`name` LIKE '%Technolog%' OR d.`name` LIKE '%IT%')
        ORDER BY d.`id` LIMIT 1),
       'IT', NULL, 1, 1, NOW(), NOW()
FROM `ticket_categories` tc
WHERE tc.`code` = 'it';

INSERT INTO `ticket_category_routes` (`uuid`, `company_id`, `category_id`, `route_to`, `department_id`, `label`, `hint`, `is_default`, `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), tc.`company_id`, tc.`id`, 'department',
       (SELECT d.`id` FROM `departments` d
        WHERE d.`company_id` = tc.`company_id` AND d.`is_active` = 1
          AND (d.`code` IN ('ADMIN', 'OPS') OR d.`name` LIKE '%Admin%' OR d.`name` LIKE '%Operation%')
        ORDER BY d.`id` LIMIT 1),
       'Admin', NULL, 1, 1, NOW(), NOW()
FROM `ticket_categories` tc
WHERE tc.`code` = 'facility';

INSERT INTO `ticket_category_routes` (`uuid`, `company_id`, `category_id`, `route_to`, `department_id`, `label`, `hint`, `is_default`, `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), tc.`company_id`, tc.`id`, 'manager', NULL,
       'Mera Manager', NULL, 0, 1, NOW(), NOW()
FROM `ticket_categories` tc
WHERE tc.`code` = 'other';

INSERT INTO `ticket_category_routes` (`uuid`, `company_id`, `category_id`, `route_to`, `department_id`, `label`, `hint`, `is_default`, `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), tc.`company_id`, tc.`id`, 'department',
       (SELECT d.`id` FROM `departments` d
        WHERE d.`company_id` = tc.`company_id` AND d.`is_active` = 1
          AND (d.`code` = 'HR' OR d.`name` LIKE '%Human Resource%' OR d.`name` LIKE 'HR%')
        ORDER BY d.`id` LIMIT 1),
       'HR', NULL, 0, 2, NOW(), NOW()
FROM `ticket_categories` tc
WHERE tc.`code` = 'other';

INSERT INTO `ticket_category_routes` (`uuid`, `company_id`, `category_id`, `route_to`, `department_id`, `label`, `hint`, `is_default`, `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), tc.`company_id`, tc.`id`, 'department',
       (SELECT d.`id` FROM `departments` d
        WHERE d.`company_id` = tc.`company_id` AND d.`is_active` = 1
          AND (d.`code` IN ('IT', 'TECH') OR d.`name` LIKE '%Technolog%' OR d.`name` LIKE '%IT%')
        ORDER BY d.`id` LIMIT 1),
       'IT', NULL, 0, 3, NOW(), NOW()
FROM `ticket_categories` tc
WHERE tc.`code` = 'other';

INSERT INTO `ticket_category_routes` (`uuid`, `company_id`, `category_id`, `route_to`, `department_id`, `label`, `hint`, `is_default`, `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), tc.`company_id`, tc.`id`, 'super_admin', NULL,
       'Clanio Support', NULL, 1, 1, NOW(), NOW()
FROM `ticket_categories` tc
WHERE tc.`scope` = 'platform';

DELETE FROM `cache`;

ALTER TABLE `companies`
    ADD COLUMN `ticket_sla_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `policy_gate_enabled`;
