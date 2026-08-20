import type { IconName } from '@/components/ui/Icon'

export type NavItem = {
  href: string
  label: string
  icon: IconName
  permissions: string[]
  description?: string
}

export type NavSection = {
  title: string | null
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    title: null,
    items: [{ href: '/dashboard', label: 'Dashboard', icon: 'grid-outline', permissions: [] }],
  },
  {
    title: 'Monitor',
    items: [
      {
        href: '/attendance',
        label: 'Attendance Log',
        icon: 'time-outline',
        permissions: [],
        description: 'Who punched in and when',
      },
      {
        href: '/daily-reports',
        label: 'Daily Reports',
        icon: 'document-text-outline',
        permissions: ['daily_report.view_team'],
        description: 'SOD and EOD submissions',
      },
      {
        href: '/tasks',
        label: 'Tasks',
        icon: 'checkbox-outline',
        permissions: [],
        description: 'Who is working on what',
      },
      {
        href: '/work-record',
        label: 'Work Record',
        icon: 'stats-chart-outline',
        permissions: [],
        description: 'Monthly performance score',
      },
    ],
  },
  {
    title: 'Approvals',
    items: [
      { href: '/leaves', label: 'Leave Requests', icon: 'calendar-outline', permissions: [] },
      { href: '/regularizations', label: 'Regularizations', icon: 'create-outline', permissions: [] },
      { href: '/expense-claims', label: 'Expense Claims', icon: 'card-outline', permissions: [] },
      { href: '/exits', label: 'Resignations', icon: 'exit-outline', permissions: [] },
      { href: '/asset-requests', label: 'Asset Requests', icon: 'construct-outline', permissions: [] },
      { href: '/tickets', label: 'Helpdesk', icon: 'chatbubbles-outline', permissions: [] },
    ],
  },
  {
    title: 'People',
    items: [
      { href: '/employees', label: 'Employees', icon: 'people-outline', permissions: ['employee.view'] },
      { href: '/users', label: 'Users', icon: 'person-circle-outline', permissions: ['user.view'] },
      { href: '/org-chart', label: 'Org Chart', icon: 'git-network-outline', permissions: [] },
    ],
  },
  {
    title: 'Organisation',
    items: [
      { href: '/departments', label: 'Departments', icon: 'business-outline', permissions: ['department.view'] },
      { href: '/designations', label: 'Designations', icon: 'ribbon-outline', permissions: ['designation.view'] },
      { href: '/branches', label: 'Branches', icon: 'location-outline', permissions: ['branch.view'] },
      { href: '/teams', label: 'Teams', icon: 'people-circle-outline', permissions: ['team.view'] },
    ],
  },
  {
    title: 'Performance',
    items: [
      { href: '/goals', label: 'Goals & OKR', icon: 'trophy-outline', permissions: ['okr.verify'] },
      { href: '/appraisal-cycles', label: 'Appraisal Cycles', icon: 'refresh-circle-outline', permissions: ['performance.manage'] },
      { href: '/appraisals', label: 'Appraisals', icon: 'clipboard-outline', permissions: ['performance.finalise'] },
      { href: '/incentives', label: 'Incentives', icon: 'cash-outline', permissions: ['incentive.approve', 'incentive.manage'] },
      { href: '/recognitions', label: 'Recognition', icon: 'heart-outline', permissions: ['recognition.give'] },
    ],
  },
  {
    title: 'Setup',
    items: [
      { href: '/work-shifts', label: 'Work Shifts', icon: 'timer-outline', permissions: ['work_shift.view'] },
      { href: '/holidays', label: 'Holidays', icon: 'sunny-outline', permissions: ['holiday.view'] },
      { href: '/leave-types', label: 'Leave Types', icon: 'albums-outline', permissions: ['leave_type.view'] },
      { href: '/leave-balances', label: 'Leave Balances', icon: 'wallet-outline', permissions: ['leave_balance.view'] },
      { href: '/roles', label: 'Roles', icon: 'shield-checkmark-outline', permissions: ['role.view'] },
      { href: '/permissions', label: 'Permissions', icon: 'key-outline', permissions: ['user.permission'] },
      { href: '/assets', label: 'IT Assets', icon: 'laptop-outline', permissions: ['asset.manage'] },
      { href: '/policies', label: 'Policies', icon: 'reader-outline', permissions: ['policy.manage'] },
      { href: '/ticket-categories', label: 'Ticket Categories', icon: 'pricetags-outline', permissions: ['ticket.category_manage'] },
      { href: '/company-settings', label: 'Company Settings', icon: 'settings-outline', permissions: ['company.view'] },
    ],
  },
  {
    title: 'My Space',
    items: [
      { href: '/my-attendance', label: 'My Attendance', icon: 'person-outline', permissions: [] },
      { href: '/my-leave', label: 'My Leave', icon: 'airplane-outline', permissions: [] },
      { href: '/profile', label: 'My Profile', icon: 'id-card-outline', permissions: [] },
    ],
  },
]

export function visibleSections(can: (slug: string) => boolean): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => item.permissions.length === 0 || item.permissions.some((slug) => can(slug))
      ),
    }))
    .filter((section) => section.items.length > 0)
}
