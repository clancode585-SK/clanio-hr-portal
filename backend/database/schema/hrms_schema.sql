SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `clanio` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `clanio`;

DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `login_attempts`;
DROP TABLE IF EXISTS `api_tokens`;
DROP TABLE IF EXISTS `user_roles`;
DROP TABLE IF EXISTS `role_permissions`;
DROP TABLE IF EXISTS `permissions`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `employee_bank_accounts`;
DROP TABLE IF EXISTS `employee_family_members`;
DROP TABLE IF EXISTS `employees`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `designations`;
DROP TABLE IF EXISTS `teams`;
DROP TABLE IF EXISTS `departments`;
DROP TABLE IF EXISTS `branches`;
DROP TABLE IF EXISTS `companies`;
DROP TABLE IF EXISTS `password_reset_tokens`;
DROP TABLE IF EXISTS `sessions`;
DROP TABLE IF EXISTS `cache_locks`;
DROP TABLE IF EXISTS `cache`;
DROP TABLE IF EXISTS `failed_jobs`;
DROP TABLE IF EXISTS `job_batches`;
DROP TABLE IF EXISTS `jobs`;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `companies` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`              CHAR(36) NOT NULL,
    `name`              VARCHAR(200) NOT NULL,
    `legal_name`        VARCHAR(200) NULL,
    `slug`              VARCHAR(100) NOT NULL,
    `email`             VARCHAR(255) NOT NULL,
    `phone`             VARCHAR(20) NULL,
    `website`           VARCHAR(255) NULL,
    `address`           VARCHAR(500) NULL,
    `city`              VARCHAR(100) NULL,
    `state`             VARCHAR(100) NULL,
    `country`           VARCHAR(100) NOT NULL DEFAULT 'India',
    `pincode`           VARCHAR(10) NULL,
    `gstin`             VARCHAR(15) NULL,
    `pan_number`        VARCHAR(10) NULL,
    `tan_number`        VARCHAR(10) NULL,
    `cin_number`        VARCHAR(21) NULL,
    `logo_url`          VARCHAR(500) NULL,
    `industry`          VARCHAR(100) NULL,
    `employee_count`    INT UNSIGNED NOT NULL DEFAULT 0,
    `max_employees`     INT UNSIGNED NULL,
    `timezone`          VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    `currency`          CHAR(3) NOT NULL DEFAULT 'INR',
    `fiscal_year_start` TINYINT UNSIGNED NOT NULL DEFAULT 4,
    `status`            VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_by`        BIGINT UNSIGNED NULL,
    `updated_by`        BIGINT UNSIGNED NULL,
    `created_at`        TIMESTAMP NULL,
    `updated_at`        TIMESTAMP NULL,
    `deleted_at`        TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_companies_uuid` (`uuid`),
    UNIQUE KEY `uq_companies_slug` (`slug`),
    UNIQUE KEY `uq_companies_email` (`email`),
    KEY `ix_companies_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `branches` (
    `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`           CHAR(36) NOT NULL,
    `company_id`     BIGINT UNSIGNED NOT NULL,
    `name`           VARCHAR(150) NOT NULL,
    `code`           VARCHAR(30) NOT NULL,
    `address`        VARCHAR(500) NULL,
    `phone`          VARCHAR(20) NULL,
    `email`          VARCHAR(255) NULL,
    `is_head_office` TINYINT(1) NOT NULL DEFAULT 0,
    `status`         VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_by`     BIGINT UNSIGNED NULL,
    `updated_by`     BIGINT UNSIGNED NULL,
    `created_at`     TIMESTAMP NULL,
    `updated_at`     TIMESTAMP NULL,
    `deleted_at`     TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_branches_uuid` (`uuid`),
    UNIQUE KEY `uq_branches_company_code` (`company_id`, `code`),
    KEY `ix_branches_company_status` (`company_id`, `status`),
    CONSTRAINT `fk_branches_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `departments` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`        CHAR(36) NOT NULL,
    `company_id`  BIGINT UNSIGNED NOT NULL,
    `branch_id`   BIGINT UNSIGNED NULL,
    `name`        VARCHAR(150) NOT NULL,
    `code`        VARCHAR(30) NOT NULL,
    `description` VARCHAR(500) NULL,
    `status`      VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_by`  BIGINT UNSIGNED NULL,
    `updated_by`  BIGINT UNSIGNED NULL,
    `created_at`  TIMESTAMP NULL,
    `updated_at`  TIMESTAMP NULL,
    `deleted_at`  TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_departments_uuid` (`uuid`),
    UNIQUE KEY `uq_departments_company_code` (`company_id`, `code`),
    KEY `ix_departments_company_status` (`company_id`, `status`),
    KEY `ix_departments_branch` (`branch_id`),
    CONSTRAINT `fk_departments_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_departments_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `teams` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`          CHAR(36) NOT NULL,
    `company_id`    BIGINT UNSIGNED NOT NULL,
    `department_id` BIGINT UNSIGNED NOT NULL,
    `name`          VARCHAR(150) NOT NULL,
    `code`          VARCHAR(30) NOT NULL,
    `description`   VARCHAR(500) NULL,
    `status`        VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_by`    BIGINT UNSIGNED NULL,
    `updated_by`    BIGINT UNSIGNED NULL,
    `created_at`    TIMESTAMP NULL,
    `updated_at`    TIMESTAMP NULL,
    `deleted_at`    TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_teams_uuid` (`uuid`),
    UNIQUE KEY `uq_teams_department_code` (`department_id`, `code`),
    KEY `ix_teams_company_status` (`company_id`, `status`),
    CONSTRAINT `fk_teams_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_teams_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `designations` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`          CHAR(36) NOT NULL,
    `company_id`    BIGINT UNSIGNED NOT NULL,
    `department_id` BIGINT UNSIGNED NULL,
    `name`          VARCHAR(150) NOT NULL,
    `code`          VARCHAR(30) NOT NULL,
    `level`         TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `description`   VARCHAR(500) NULL,
    `status`        VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_by`    BIGINT UNSIGNED NULL,
    `updated_by`    BIGINT UNSIGNED NULL,
    `created_at`    TIMESTAMP NULL,
    `updated_at`    TIMESTAMP NULL,
    `deleted_at`    TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_designations_uuid` (`uuid`),
    UNIQUE KEY `uq_designations_company_code` (`company_id`, `code`),
    KEY `ix_designations_company_status` (`company_id`, `status`),
    KEY `ix_designations_department` (`department_id`),
    CONSTRAINT `fk_designations_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_designations_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `roles` (
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`            CHAR(36) NOT NULL,
    `company_id`      BIGINT UNSIGNED NULL,
    `company_key`     BIGINT UNSIGNED AS (IFNULL(`company_id`, 0)) STORED,
    `name`            VARCHAR(100) NOT NULL,
    `slug`            VARCHAR(100) NOT NULL,
    `description`     VARCHAR(500) NULL,
    `hierarchy_level` TINYINT UNSIGNED NOT NULL DEFAULT 99,
    `data_scope`      VARCHAR(20) NOT NULL DEFAULT 'self',
    `is_system`       TINYINT(1) NOT NULL DEFAULT 0,
    `is_active`       TINYINT(1) NOT NULL DEFAULT 1,
    `created_by`      BIGINT UNSIGNED NULL,
    `updated_by`      BIGINT UNSIGNED NULL,
    `created_at`      TIMESTAMP NULL,
    `updated_at`      TIMESTAMP NULL,
    `deleted_at`      TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_roles_uuid` (`uuid`),
    UNIQUE KEY `uq_roles_company_slug` (`company_key`, `slug`),
    KEY `ix_roles_company_active` (`company_id`, `is_active`),
    CONSTRAINT `fk_roles_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `permissions` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `module`      VARCHAR(60) NOT NULL,
    `action`      VARCHAR(40) NOT NULL,
    `slug`        VARCHAR(100) NOT NULL,
    `name`        VARCHAR(150) NOT NULL,
    `group_name`  VARCHAR(60) NOT NULL DEFAULT 'general',
    `created_at`  TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_permissions_slug` (`slug`),
    KEY `ix_permissions_module` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `role_permissions` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `role_id`       BIGINT UNSIGNED NOT NULL,
    `permission_id` BIGINT UNSIGNED NOT NULL,
    `created_at`    TIMESTAMP NULL,
    `updated_at`    TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_role_permission` (`role_id`, `permission_id`),
    KEY `ix_role_permissions_permission` (`permission_id`),
    CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
    `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                  CHAR(36) NOT NULL,
    `company_id`            BIGINT UNSIGNED NULL,
    `company_key`           BIGINT UNSIGNED AS (IFNULL(`company_id`, 0)) STORED,
    `branch_id`             BIGINT UNSIGNED NULL,
    `department_id`         BIGINT UNSIGNED NULL,
    `team_id`               BIGINT UNSIGNED NULL,
    `name`                  VARCHAR(150) NOT NULL,
    `email`                 VARCHAR(255) NOT NULL,
    `phone`                 VARCHAR(20) NULL,
    `password`              VARCHAR(255) NOT NULL,
    `is_super_admin`        TINYINT(1) NOT NULL DEFAULT 0,
    `status`                VARCHAR(20) NOT NULL DEFAULT 'active',
    `last_login_at`         TIMESTAMP NULL,
    `last_login_ip`         VARCHAR(45) NULL,
    `failed_login_attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `locked_until`          TIMESTAMP NULL,
    `created_by`            BIGINT UNSIGNED NULL,
    `updated_by`            BIGINT UNSIGNED NULL,
    `created_at`            TIMESTAMP NULL,
    `updated_at`            TIMESTAMP NULL,
    `deleted_at`            TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_uuid` (`uuid`),
    UNIQUE KEY `uq_users_company_email` (`company_key`, `email`),
    KEY `ix_users_email` (`email`),
    KEY `ix_users_company_status` (`company_id`, `status`),
    KEY `ix_users_branch` (`branch_id`),
    KEY `ix_users_department` (`department_id`),
    KEY `ix_users_team` (`team_id`),
    CONSTRAINT `fk_users_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_users_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_users_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_users_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `employees` (
    `id`                         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                       CHAR(36) NOT NULL,
    `company_id`                 BIGINT UNSIGNED NOT NULL,
    `user_id`                    BIGINT UNSIGNED NOT NULL,
    `employee_code`              VARCHAR(30) NOT NULL,
    `designation_id`             BIGINT UNSIGNED NULL,
    `reporting_manager_id`       BIGINT UNSIGNED NULL,
    `date_of_joining`            DATE NOT NULL,
    `employment_type`            VARCHAR(20) NOT NULL DEFAULT 'full_time',
    `probation_end_date`         DATE NULL,
    `confirmation_date`          DATE NULL,
    `date_of_birth`              DATE NULL,
    `gender`                     VARCHAR(20) NULL,
    `marital_status`             VARCHAR(20) NULL,
    `blood_group`                VARCHAR(5) NULL,
    `personal_email`             VARCHAR(255) NULL,
    `personal_phone`             VARCHAR(20) NULL,
    `current_address`            VARCHAR(500) NULL,
    `permanent_address`          VARCHAR(500) NULL,
    `emergency_contact_name`     VARCHAR(150) NULL,
    `emergency_contact_relation` VARCHAR(50) NULL,
    `emergency_contact_phone`    VARCHAR(20) NULL,
    `pan_number`                 VARCHAR(10) NULL,
    `onboarding_status`          VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    `created_by`                 BIGINT UNSIGNED NULL,
    `updated_by`                 BIGINT UNSIGNED NULL,
    `created_at`                 TIMESTAMP NULL,
    `updated_at`                 TIMESTAMP NULL,
    `deleted_at`                 TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_employees_uuid` (`uuid`),
    UNIQUE KEY `uq_employees_user` (`user_id`),
    UNIQUE KEY `uq_employees_company_code` (`company_id`, `employee_code`),
    KEY `ix_employees_company_status` (`company_id`, `onboarding_status`),
    KEY `ix_employees_designation` (`designation_id`),
    KEY `ix_employees_manager` (`reporting_manager_id`),
    CONSTRAINT `fk_employees_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_employees_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_employees_designation` FOREIGN KEY (`designation_id`) REFERENCES `designations` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_employees_manager` FOREIGN KEY (`reporting_manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `employee_family_members` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`          CHAR(36) NOT NULL,
    `company_id`    BIGINT UNSIGNED NOT NULL,
    `employee_id`   BIGINT UNSIGNED NOT NULL,
    `name`          VARCHAR(150) NOT NULL,
    `relation`      VARCHAR(20) NOT NULL,
    `date_of_birth` DATE NULL,
    `occupation`    VARCHAR(100) NULL,
    `phone`         VARCHAR(20) NULL,
    `is_dependent`  TINYINT(1) NOT NULL DEFAULT 0,
    `is_nominee`    TINYINT(1) NOT NULL DEFAULT 0,
    `nominee_share` DECIMAL(5,2) NULL,
    `created_by`    BIGINT UNSIGNED NULL,
    `updated_by`    BIGINT UNSIGNED NULL,
    `created_at`    TIMESTAMP NULL,
    `updated_at`    TIMESTAMP NULL,
    `deleted_at`    TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_family_uuid` (`uuid`),
    KEY `ix_family_employee` (`employee_id`),
    KEY `ix_family_company` (`company_id`),
    CONSTRAINT `fk_family_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_family_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `employee_bank_accounts` (
    `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`                CHAR(36) NOT NULL,
    `company_id`          BIGINT UNSIGNED NOT NULL,
    `employee_id`         BIGINT UNSIGNED NOT NULL,
    `account_holder_name` VARCHAR(150) NOT NULL,
    `bank_name`           VARCHAR(150) NOT NULL,
    `account_number`      VARCHAR(30) NOT NULL,
    `ifsc_code`           VARCHAR(11) NOT NULL,
    `branch_name`         VARCHAR(150) NULL,
    `account_type`        VARCHAR(20) NOT NULL DEFAULT 'savings',
    `is_primary`          TINYINT(1) NOT NULL DEFAULT 0,
    `created_by`          BIGINT UNSIGNED NULL,
    `updated_by`          BIGINT UNSIGNED NULL,
    `created_at`          TIMESTAMP NULL,
    `updated_at`          TIMESTAMP NULL,
    `deleted_at`          TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_bank_uuid` (`uuid`),
    KEY `ix_bank_employee` (`employee_id`),
    KEY `ix_bank_company` (`company_id`),
    CONSTRAINT `fk_bank_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_bank_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_roles` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`     BIGINT UNSIGNED NOT NULL,
    `role_id`     BIGINT UNSIGNED NOT NULL,
    `company_id`  BIGINT UNSIGNED NULL,
    `assigned_by` BIGINT UNSIGNED NULL,
    `created_at`  TIMESTAMP NULL,
    `updated_at`  TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_user_role` (`user_id`, `role_id`),
    KEY `ix_user_roles_role` (`role_id`),
    CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `api_tokens` (
    `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`      BIGINT UNSIGNED NOT NULL,
    `company_id`   BIGINT UNSIGNED NULL,
    `token_hash`   CHAR(64) NOT NULL,
    `ip_address`   VARCHAR(45) NULL,
    `last_used_at` TIMESTAMP NULL,
    `expires_at`   TIMESTAMP NULL,
    `revoked_at`   TIMESTAMP NULL,
    `created_at`   TIMESTAMP NULL,
    `updated_at`   TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_api_tokens_hash` (`token_hash`),
    KEY `ix_api_tokens_user` (`user_id`),
    CONSTRAINT `fk_api_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `login_attempts` (
    `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `email`      VARCHAR(255) NOT NULL,
    `user_id`    BIGINT UNSIGNED NULL,
    `company_id` BIGINT UNSIGNED NULL,
    `ip_address` VARCHAR(45) NULL,
    `successful` TINYINT(1) NOT NULL DEFAULT 0,
    `reason`     VARCHAR(100) NULL,
    `created_at` TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    KEY `ix_login_attempts_email` (`email`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `audit_logs` (
    `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id`     BIGINT UNSIGNED NULL,
    `user_id`        BIGINT UNSIGNED NULL,
    `event`          VARCHAR(60) NOT NULL,
    `auditable_type` VARCHAR(100) NOT NULL,
    `auditable_id`   BIGINT UNSIGNED NULL,
    `old_values`     JSON NULL,
    `new_values`     JSON NULL,
    `ip_address`     VARCHAR(45) NULL,
    `created_at`     TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    KEY `ix_audit_company_date` (`company_id`, `created_at`),
    KEY `ix_audit_model` (`auditable_type`, `auditable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `password_reset_tokens` (
    `email`      VARCHAR(255) NOT NULL,
    `token`      VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP NULL,
    PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sessions` (
    `id`            VARCHAR(255) NOT NULL,
    `user_id`       BIGINT UNSIGNED NULL,
    `ip_address`    VARCHAR(45) NULL,
    `user_agent`    TEXT NULL,
    `payload`       LONGTEXT NOT NULL,
    `last_activity` INT NOT NULL,
    PRIMARY KEY (`id`),
    KEY `ix_sessions_activity` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cache` (
    `key`        VARCHAR(255) NOT NULL,
    `value`      MEDIUMTEXT NOT NULL,
    `expiration` INT NOT NULL,
    PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cache_locks` (
    `key`        VARCHAR(255) NOT NULL,
    `owner`      VARCHAR(255) NOT NULL,
    `expiration` INT NOT NULL,
    PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `jobs` (
    `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `queue`        VARCHAR(255) NOT NULL,
    `payload`      LONGTEXT NOT NULL,
    `attempts`     TINYINT UNSIGNED NOT NULL,
    `reserved_at`  INT UNSIGNED NULL,
    `available_at` INT UNSIGNED NOT NULL,
    `created_at`   INT UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    KEY `ix_jobs_queue` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `job_batches` (
    `id`             VARCHAR(255) NOT NULL,
    `name`           VARCHAR(255) NOT NULL,
    `total_jobs`     INT NOT NULL,
    `pending_jobs`   INT NOT NULL,
    `failed_jobs`    INT NOT NULL,
    `failed_job_ids` LONGTEXT NOT NULL,
    `options`        MEDIUMTEXT NULL,
    `cancelled_at`   INT NULL,
    `created_at`     INT NOT NULL,
    `finished_at`    INT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `failed_jobs` (
    `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`       VARCHAR(255) NOT NULL,
    `connection` TEXT NOT NULL,
    `queue`      TEXT NOT NULL,
    `payload`    LONGTEXT NOT NULL,
    `exception`  LONGTEXT NOT NULL,
    `failed_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_failed_jobs_uuid` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `permissions` (`module`, `action`, `slug`, `name`, `group_name`, `created_at`) VALUES
('company',    'view',   'company.view',    'View Company',     'platform',     NOW()),
('company',    'create', 'company.create',  'Create Company',   'platform',     NOW()),
('company',    'edit',   'company.edit',    'Edit Company',     'platform',     NOW()),
('company',    'delete', 'company.delete',  'Delete Company',   'platform',     NOW()),
('branch',     'view',   'branch.view',     'View Branch',      'organization', NOW()),
('branch',     'create', 'branch.create',   'Create Branch',    'organization', NOW()),
('branch',     'edit',   'branch.edit',     'Edit Branch',      'organization', NOW()),
('branch',     'delete', 'branch.delete',   'Delete Branch',    'organization', NOW()),
('department', 'view',   'department.view',   'View Department',   'organization', NOW()),
('department', 'create', 'department.create', 'Create Department', 'organization', NOW()),
('department', 'edit',   'department.edit',   'Edit Department',   'organization', NOW()),
('department', 'delete', 'department.delete', 'Delete Department', 'organization', NOW()),
('team',       'view',   'team.view',       'View Team',        'organization', NOW()),
('team',       'create', 'team.create',     'Create Team',      'organization', NOW()),
('team',       'edit',   'team.edit',       'Edit Team',        'organization', NOW()),
('team',       'delete', 'team.delete',     'Delete Team',      'organization', NOW()),
('designation', 'view',   'designation.view',   'View Designation',   'organization', NOW()),
('designation', 'create', 'designation.create', 'Create Designation', 'organization', NOW()),
('designation', 'edit',   'designation.edit',   'Edit Designation',   'organization', NOW()),
('designation', 'delete', 'designation.delete', 'Delete Designation', 'organization', NOW()),
('employee',    'view',   'employee.view',   'View Employee',    'employee',     NOW()),
('employee',    'create', 'employee.create', 'Create Employee',  'employee',     NOW()),
('employee',    'edit',   'employee.edit',   'Edit Employee',    'employee',     NOW()),
('employee',    'delete', 'employee.delete', 'Delete Employee',  'employee',     NOW()),
('employee_family', 'view',   'employee_family.view',   'View Family Details',   'employee', NOW()),
('employee_family', 'manage', 'employee_family.manage', 'Manage Family Details', 'employee', NOW()),
('employee_bank',   'view',   'employee_bank.view',     'View Bank Details',     'employee', NOW()),
('employee_bank',   'manage', 'employee_bank.manage',   'Manage Bank Details',   'employee', NOW()),
('role',       'view',   'role.view',       'View Role',        'access',       NOW()),
('role',       'create', 'role.create',     'Create Role',      'access',       NOW()),
('role',       'edit',   'role.edit',       'Edit Role',        'access',       NOW()),
('role',       'delete', 'role.delete',     'Delete Role',      'access',       NOW()),
('user',       'view',   'user.view',       'View User',        'access',       NOW()),
('user',       'create', 'user.create',     'Create User',      'access',       NOW()),
('user',       'edit',   'user.edit',       'Edit User',        'access',       NOW()),
('user',       'delete', 'user.delete',     'Delete User',      'access',       NOW()),
('user',       'view_all', 'user.view_all', 'View All Users',   'access',       NOW()),
('permission', 'view',   'permission.view', 'View Permissions', 'access',       NOW());

INSERT INTO `roles` (`uuid`, `company_id`, `name`, `slug`, `description`, `hierarchy_level`, `data_scope`, `is_system`, `is_active`, `created_at`, `updated_at`) VALUES
(UUID(), NULL, 'Super Admin', 'super_admin', 'Platform owner with unrestricted access', 1, 'platform', 1, 1, NOW(), NOW());

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, NOW(), NOW() FROM `roles` r CROSS JOIN `permissions` p WHERE r.`slug` = 'super_admin';

INSERT INTO `users` (`uuid`, `company_id`, `name`, `email`, `password`, `is_super_admin`, `status`, `created_at`, `updated_at`) VALUES
(UUID(), NULL, 'Platform Super Admin', 'superadmin@clanio.com', '$2y$12$WwmUTZYyC9mCP3Be7fr0p.EvmwdskUeX4l/wTq7tTJcnc2Ezpfr0O', 1, 'active', NOW(), NOW());

INSERT INTO `user_roles` (`user_id`, `role_id`, `company_id`, `created_at`, `updated_at`)
SELECT u.`id`, r.`id`, NULL, NOW(), NOW()
FROM `users` u CROSS JOIN `roles` r
WHERE u.`email` = 'superadmin@clanio.com' AND r.`slug` = 'super_admin';
