SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE `companies` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`;
UPDATE `companies` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `companies` DROP COLUMN `deleted_at`, ADD KEY `ix_companies_active` (`is_active`);

ALTER TABLE `branches` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`;
UPDATE `branches` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `branches` DROP COLUMN `deleted_at`, ADD KEY `ix_branches_company_active` (`company_id`, `is_active`);

ALTER TABLE `departments` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`;
UPDATE `departments` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `departments` DROP COLUMN `deleted_at`, ADD KEY `ix_departments_company_active` (`company_id`, `is_active`);

ALTER TABLE `teams` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`;
UPDATE `teams` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `teams` DROP COLUMN `deleted_at`, ADD KEY `ix_teams_company_active` (`company_id`, `is_active`);

ALTER TABLE `designations` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`;
UPDATE `designations` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `designations` DROP COLUMN `deleted_at`, ADD KEY `ix_designations_company_active` (`company_id`, `is_active`);

UPDATE `roles` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `roles` DROP COLUMN `deleted_at`;

ALTER TABLE `users` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`;
UPDATE `users` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `users` DROP COLUMN `deleted_at`, ADD KEY `ix_users_company_active` (`company_id`, `is_active`);

ALTER TABLE `employees` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `onboarding_status`;
UPDATE `employees` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `employees` DROP COLUMN `deleted_at`, ADD KEY `ix_employees_company_active` (`company_id`, `is_active`);

ALTER TABLE `employee_family_members` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `is_nominee`;
UPDATE `employee_family_members` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `employee_family_members` DROP COLUMN `deleted_at`, ADD KEY `ix_family_active` (`employee_id`, `is_active`);

ALTER TABLE `employee_bank_accounts` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `is_primary`;
UPDATE `employee_bank_accounts` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `employee_bank_accounts` DROP COLUMN `deleted_at`, ADD KEY `ix_bank_accounts_active` (`employee_id`, `is_active`);

ALTER TABLE `employee_documents` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`;
UPDATE `employee_documents` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `employee_documents` DROP COLUMN `deleted_at`, ADD KEY `ix_documents_active` (`employee_id`, `is_active`);

ALTER TABLE `work_shifts` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`;
UPDATE `work_shifts` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `work_shifts`
    DROP INDEX `uq_work_shifts_active_code`,
    DROP COLUMN `shift_key`,
    DROP COLUMN `deleted_at`,
    ADD COLUMN `shift_key` VARCHAR(80) AS (IF(`is_active` = 1, CONCAT(`company_id`, ':', `code`), NULL)) STORED,
    ADD UNIQUE KEY `uq_work_shifts_active_code` (`shift_key`),
    ADD KEY `ix_work_shifts_company_active` (`company_id`, `is_active`);

ALTER TABLE `holidays` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `is_paid`;
UPDATE `holidays` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `holidays`
    DROP INDEX `uq_holidays_active_date`,
    DROP COLUMN `holiday_key`,
    DROP COLUMN `deleted_at`,
    ADD COLUMN `holiday_key` VARCHAR(80) AS (IF(`is_active` = 1, CONCAT(`company_id`, ':', IFNULL(`branch_id`, 0), ':', `holiday_date`), NULL)) STORED,
    ADD UNIQUE KEY `uq_holidays_active_date` (`holiday_key`),
    ADD KEY `ix_holidays_company_active` (`company_id`, `is_active`);

ALTER TABLE `leave_types` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`;
UPDATE `leave_types` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `leave_types`
    DROP INDEX `uq_leave_types_active_code`,
    DROP COLUMN `type_key`,
    DROP COLUMN `deleted_at`,
    ADD COLUMN `type_key` VARCHAR(60) AS (IF(`is_active` = 1, CONCAT(`company_id`, ':', `code`), NULL)) STORED,
    ADD UNIQUE KEY `uq_leave_types_active_code` (`type_key`),
    ADD KEY `ix_leave_types_company_active` (`company_id`, `is_active`);

ALTER TABLE `leave_requests` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`;
UPDATE `leave_requests` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `leave_requests` DROP COLUMN `deleted_at`, ADD KEY `ix_leave_requests_active` (`company_id`, `is_active`);

ALTER TABLE `attendances` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `source`;
UPDATE `attendances` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `attendances` DROP COLUMN `deleted_at`, ADD KEY `ix_attendances_active` (`company_id`, `is_active`);

ALTER TABLE `attendance_regularizations` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`;
UPDATE `attendance_regularizations` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `attendance_regularizations`
    DROP INDEX `uq_regularizations_open_day`,
    DROP COLUMN `day_key`,
    DROP COLUMN `deleted_at`,
    ADD COLUMN `day_key` VARCHAR(60) AS (IF(`is_active` = 1 AND `status` IN ('pending', 'approved'), CONCAT(`employee_id`, ':', `attendance_date`), NULL)) STORED,
    ADD UNIQUE KEY `uq_regularizations_open_day` (`day_key`),
    ADD KEY `ix_regularizations_active` (`company_id`, `is_active`);

ALTER TABLE `tasks` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`;
UPDATE `tasks` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `tasks` DROP COLUMN `deleted_at`, ADD KEY `ix_tasks_company_active` (`company_id`, `is_active`);

ALTER TABLE `task_comments` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `body`;
UPDATE `task_comments` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `task_comments` DROP COLUMN `deleted_at`, ADD KEY `ix_task_comments_active` (`task_id`, `is_active`);

ALTER TABLE `task_attachments` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `size_bytes`;
UPDATE `task_attachments` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `task_attachments` DROP COLUMN `deleted_at`, ADD KEY `ix_task_attachments_active` (`task_id`, `is_active`);

ALTER TABLE `expense_claims` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`;
UPDATE `expense_claims` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `expense_claims` DROP COLUMN `deleted_at`, ADD KEY `ix_expense_claims_active` (`company_id`, `is_active`);

ALTER TABLE `expense_bills` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `size_bytes`;
UPDATE `expense_bills` SET `is_active` = 0 WHERE `deleted_at` IS NOT NULL;
ALTER TABLE `expense_bills` DROP COLUMN `deleted_at`, ADD KEY `ix_expense_bills_active` (`expense_claim_id`, `is_active`);

SET FOREIGN_KEY_CHECKS = 1;
