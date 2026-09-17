export type PageMeta = {
  current_page: number
  per_page: number
  total: number
  last_page: number
}

export type PolicyGate = {
  blocked: boolean
  pending: number
}

export type OnboardingSection = {
  key: string
  label: string
  done: number
  total: number
  percent: number
}

export type OnboardingState = {
  step: 'policies' | 'profile' | 'tour' | null
  policies: { blocked: boolean; pending: number }
  profile: {
    needed: boolean
    seen: boolean
    percent: number
    sections: OnboardingSection[]
    pending: string[]
  } | null
  tour: { needed: boolean }
}

export type LoginResult = {
  token: string
  role: string | null
  policy_gate: PolicyGate
  onboarding: OnboardingState
}

export type DataScope = 'all_company' | 'branch' | 'department' | 'team' | 'self'

export type Role = {
  id: number
  uuid: string
  name: string
  slug: string
  description: string | null
  hierarchy_level: number
  data_scope: DataScope
  is_system: boolean
  is_active: boolean
  users_count?: number
  permissions?: PermissionSummary[]
}

export type PermissionSummary = {
  id: number
  slug: string
  name: string
  module: string
  action: string
  group: string
}

export type PermissionNode = {
  id: number
  slug: string
  name: string
  action: string
  can_assign: boolean
}

export type PermissionModule = {
  module: string
  is_enabled: boolean
  permissions: PermissionNode[]
}

export type PermissionTree = {
  modules: PermissionModule[]
}

export type UserPermissions = {
  user_id: number
  name: string
  email: string
  roles: { id: number; name: string; slug: string }[]
  from_roles: string[]
  from_department: string[]
  granted: string[]
  revoked: string[]
  effective: string[]
  counts: Record<string, number>
}

export type Profile = {
  id: number
  uuid: string
  name: string
  email: string
  phone: string | null
  avatar_url: string | null
  status: string
  is_super_admin: boolean
  roles: Role[]
  permissions: string[]
  organisation?: { company_id: number | null; timezone: string | null } | null
  department?: { id: number; name: string } | null
  branch?: { id: number; name: string } | null
  employee?: {
    id: number
    uuid: string
    employee_code: string
    date_of_joining: string
    date_of_birth?: string | null
    father_name?: string | null
    gender?: string | null
    marital_status?: string | null
    blood_group?: string | null
    personal_email?: string | null
    personal_phone?: string | null
    current_address?: string | null
    permanent_address?: string | null
    emergency_contact_name?: string | null
    emergency_contact_relation?: string | null
    emergency_contact_phone?: string | null
    pan_number?: string | null
    designation?: { id: number; name: string } | null
  } | null
}

export type Department = {
  id: number
  uuid: string
  name: string
  code: string
  description: string | null
  branch_id: number | null
  status: string
  teams_count: number
  users_count: number
}

export type Designation = {
  id: number
  uuid: string
  name: string
  code: string
  level: number
  description: string | null
  department_id: number | null
  department: { id: number; name: string } | null
  status: string
  employees_count: number
}

export type EmployeeUser = {
  id: number
  uuid: string
  name: string
  email: string
  phone: string | null
  status: string
  branch_id: number | null
  department_id: number | null
  team_id: number | null
}

export type ReportingManager = {
  id: number
  name: string
  email: string
  employee_code: string | null
  designation: string | null
  department: string | null
  reports_count: number
}

export type Employee = {
  id: number
  uuid: string
  user_id: number
  employee_code: string
  date_of_joining: string
  employment_type: string
  employment_status: string
  designation_id: number | null
  reporting_manager_id: number | null
  work_shift_id: number | null
  date_of_birth: string | null
  father_name: string | null
  gender: string | null
  marital_status: string | null
  blood_group: string | null
  personal_email: string | null
  personal_phone: string | null
  current_address: string | null
  permanent_address: string | null
  emergency_contact_name: string | null
  emergency_contact_relation: string | null
  emergency_contact_phone: string | null
  pan_number: string | null
  aadhaar_number: string | null
  has_pf_account?: boolean
  uan_number?: string | null
  insurer_name: string | null
  insurance_number: string | null
  insurance_valid_till: string | null
  tax_regime?: string | null
  user: EmployeeUser | null
  designation: Designation | null
  onboarding: {
    status: string
    steps: Record<string, boolean>
  }
}

export type Branch = {
  id: number
  uuid: string
  name: string
  code: string
  address: string | null
  phone: string | null
  email: string | null
  is_head_office: boolean
  status: string
  users_count: number
}

export type Team = {
  id: number
  uuid: string
  name: string
  code: string
  description: string | null
  department_id: number | null
  department: { id: number; name: string } | null
  status: string
  users_count: number
}

export type WorkShift = {
  id: number
  uuid: string
  name: string
  code: string
  start_time: string
  end_time: string
  grace_minutes: number
  weekly_offs: number[]
  is_default: boolean
  status: string
}
