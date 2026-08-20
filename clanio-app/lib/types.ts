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

export type LoginResult = {
  token: string
  role: string | null
  policy_gate: PolicyGate
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
  department?: { id: number; name: string } | null
  branch?: { id: number; name: string } | null
  employee?: {
    id: number
    uuid: string
    employee_code: string
    date_of_joining: string
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
  user: EmployeeUser | null
  designation: Designation | null
  onboarding: {
    status: string
    steps: Record<string, boolean>
  }
}
