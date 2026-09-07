import { apiList } from './api'
import type { Branch, Department, Designation, EmployeeUser, Role, Team, WorkShift } from './types'

export type FormOptions = {
  departments: Department[]
  designations: Designation[]
  roles: Role[]
  shifts: WorkShift[]
  branches: Branch[]
  teams: Team[]
  managers: EmployeeUser[]
}

type Ability = (slug: string) => boolean

async function pull<T>(path: string, allowed: boolean): Promise<T[]> {
  if (!allowed) {
    return []
  }

  const result = await apiList<T>(path)

  return result.data
}

export async function loadFormOptions(can: Ability): Promise<FormOptions> {
  const [departments, designations, roles, shifts, branches, teams, managers] = await Promise.all([
    pull<Department>('/departments?per_page=100', can('department.view')),
    pull<Designation>('/designations?per_page=100', can('designation.view')),
    pull<Role>('/roles?per_page=100', can('role.view')),
    pull<WorkShift>('/work-shifts?per_page=100', can('work_shift.view')),
    pull<Branch>('/branches?per_page=100', can('branch.view')),
    pull<Team>('/teams?per_page=100', can('team.view')),
    pull<EmployeeUser>('/users?per_page=100', can('user.view')),
  ])

  return { departments, designations, roles, shifts, branches, teams, managers }
}

export const employmentTypes = [
  { value: 'full_time', label: 'Full time' },
  { value: 'part_time', label: 'Part time' },
  { value: 'intern', label: 'Intern' },
  { value: 'contract', label: 'Contract' },
  { value: 'consultant', label: 'Consultant' },
]

export const genders = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

export const maritalStatuses = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
]

export const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((value) => ({
  value,
  label: value,
}))
