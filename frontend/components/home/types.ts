import { z } from "zod";

// 1. EMPLOYEES
export interface Employee {
  id: string;
  rawId?: number;
  userId?: number;
  name: string;
  email: string;
  department: string;
  role: string;
  branch?: string;
  branch_id?: number | string;
}

export const employeeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  department: z.string().optional().or(z.literal("")),
  role: z.string().optional().or(z.literal("")),
  system_role: z.string().optional().or(z.literal("")),
  branch: z.string().optional().or(z.literal("")),
  reporting_manager: z.string().optional().or(z.literal("")),
  date_of_joining: z.string().optional().or(z.literal("")),
  employment_type: z.string().optional().or(z.literal("")),
});

export type EmployeeFormData = z.infer<typeof employeeSchema>;

// 2. DEPARTMENTS
export interface Department {
  id: string;
  name: string;
  code: string;
  head: string;
  employeesCount: number;
}

export const departmentSchema = z.object({
  name: z.string().min(2, "Department name required").max(150, "Max 150 characters"),
  code: z.string().min(2, "Code required (e.g. OPS)").max(30, "Max 30 characters"),
  branch: z.string().optional().or(z.literal("")),
  description: z.string().max(500, "Max 500 characters").optional(),
});

export type DepartmentFormData = z.infer<typeof departmentSchema>;

// 3. DESIGNATIONS
export interface DesignationItem {
  id: string;
  code: string;
  name: string;
  departmentName: string;
  employeesCount: number;
  status: string;
}

export const designationSchema = z.object({
  name: z.string().min(2, "Designation name required").max(150, "Max 150 characters"),
  code: z.string().min(2, "Code required (e.g. SR_ENG)").max(30, "Max 30 characters"),
  description: z.string().max(500, "Max 500 characters").optional(),
});

export type DesignationFormData = z.infer<typeof designationSchema>;

// 4. COMPANIES
export interface CompanyItem {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  status: string;
}

export const companySchema = z.object({
  name: z.string().min(2, "Company name required"),
  email: z.string().email("Invalid email address"),
  slug: z.string().min(2, "Slug required"),
  phone: z.string().optional(),
  admin_name: z.string().min(2, "Admin name required"),
  admin_email: z.string().email("Invalid admin email"),
  admin_password: z.string().min(8, "Password must be at least 8 characters"),
});

export const companyEditSchema = z.object({
  name: z.string().min(2, "Company name required"),
  email: z.string().email("Invalid email address"),
  slug: z.string().min(2, "Slug required"),
  phone: z.string().optional(),
});

export type CompanyFormData = z.infer<typeof companySchema>;

// 5. BRANCHES
export interface BranchItem {
  id: string;
  rawId?: number;
  name: string;
  code: string;
  companyName?: string;
  address?: string;
  phone?: string;
  email?: string;
  usersCount?: number;
  status?: string;
}

export const branchSchema = z.object({
  name: z.string().min(2, "Branch name required").max(150, "Max 150 characters"),
  code: z
    .string()
    .min(2, "Branch code required")
    .max(30, "Max 30 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Code must contain only letters, numbers, hyphens or underscores"),
  address: z.string().max(500, "Max 500 characters").optional().or(z.literal("")),
  phone: z.string().max(20, "Max 20 characters").optional().or(z.literal("")),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
});

export type BranchFormData = z.infer<typeof branchSchema>;

// 6. TEAMS
export interface TeamItem {
  id: string;
  rawId?: number;
  name: string;
  code: string;
  departmentName?: string;
  department_id?: number;
  description?: string;
  usersCount?: number;
  status?: string;
}

export const teamSchema = z.object({
  name: z.string().min(2, "Team name required").max(150, "Max 150 characters"),
  code: z
    .string()
    .min(2, "Team code required")
    .max(30, "Max 30 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Code must contain only letters, numbers, hyphens or underscores"),
  department: z.string().min(1, "Please select a department"),
  description: z.string().max(500, "Max 500 characters").optional().or(z.literal("")),
});

export type TeamFormData = z.infer<typeof teamSchema>;

// 7. ROLES
export interface RoleItem {
  id: string;
  rawId?: number;
  name: string;
  slug: string;
  description?: string;
  hierarchy_level?: number;
  data_scope?: string;
  is_system?: boolean;
  is_active?: boolean;
  usersCount?: number;
  permissions?: string[];
}

export const roleSchema = z.object({
  name: z.string().min(2, "Role name required").max(150, "Max 150 characters"),
  slug: z
    .string()
    .min(2, "Slug required")
    .max(50, "Max 50 characters")
    .regex(/^[a-z0-9_]+$/, "Slug must be lowercase alphanumeric with underscores"),
  hierarchy_level: z.coerce.number().min(1).max(99),
  data_scope: z.enum(["all_company", "branch", "department", "team", "self"]),
  description: z.string().max(500, "Max 500 characters").optional().or(z.literal("")),
});

export type RoleFormData = z.infer<typeof roleSchema>;
