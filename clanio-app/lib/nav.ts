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
        permissions: ['employee.view'],
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
        permissions: ['task.edit'],
        description: 'Who is working on what',
      },
      {
        href: '/work-record',
        label: 'Work Record',
        icon: 'stats-chart-outline',
        permissions: ['daily_report.view_team'],
        description: 'Monthly performance score',
      },
    ],
  },
  {
    title: 'Approvals',
    items: [
      { href: '/leaves', label: 'Leave Requests', icon: 'calendar-outline', permissions: ['leave.approve'] },
      { href: '/regularizations', label: 'Regularizations', icon: 'create-outline', permissions: ['attendance.regularize'] },
      {
        href: '/attendance-bulk',
        label: 'Bulk Attendance',
        icon: 'checkmark-done-circle-outline',
        permissions: ['attendance.regularize'],
        description: 'Ek din ki attendance kai logon ki ek saath',
      },
      { href: '/expense-claims', label: 'Expense Claims', icon: 'card-outline', permissions: ['expense.verify', 'expense.pay'] },
      {
        href: '/payroll',
        label: 'Payroll',
        icon: 'wallet-outline',
        permissions: ['payroll.view'],
        description: 'Mahine ki salary calculate karo aur bhejo',
      },
      {
        href: '/fnf',
        label: 'Full & Final',
        icon: 'cash-outline',
        permissions: ['fnf.view'],
        description: 'Jaane wale ka aakhri hisaab',
      },
      {
        href: '/advances',
        label: 'Salary Advance',
        icon: 'cash-outline',
        permissions: ['advance.view'],
        description: 'Advance request, EMI aur baaki amount',
      },
      { href: '/exits', label: 'Resignations', icon: 'exit-outline', permissions: ['exit.approve'] },
      { href: '/clearance', label: 'Clearance', icon: 'checkmark-done-outline', permissions: ['clearance.sign'] },
      { href: '/asset-requests', label: 'Asset Requests', icon: 'construct-outline', permissions: ['asset.support', 'asset.manage'] },
      { href: '/tickets', label: 'Helpdesk', icon: 'chatbubbles-outline', permissions: ['ticket.view_all', 'ticket.resolve'] },
    ],
  },
  {
    title: 'Platform',
    items: [{ href: '/companies', label: 'Companies', icon: 'business-outline', permissions: ['company.create'] }],
  },
  {
    title: 'People',
    items: [
      { href: '/employees', label: 'Employees', icon: 'people-outline', permissions: ['employee.view'] },
      { href: '/openings', label: 'Openings', icon: 'megaphone-outline', permissions: ['recruitment.view'] },
      { href: '/interviews', label: 'My Interviews', icon: 'videocam-outline', permissions: ['interview.conduct'] },
      { href: '/joinings', label: 'Joining Soon', icon: 'person-add-outline', permissions: ['recruitment.view'] },
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
      { href: '/incentive-rules', label: 'Incentive Rules', icon: 'options-outline', permissions: ['incentive.manage'] },
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
      {
        href: '/salary-components',
        label: 'Salary Components',
        icon: 'layers-outline',
        permissions: ['salary_structure.view'],
        description: 'Earning aur deduction jinse salary banti hai',
      },
      {
        href: '/payroll-settings',
        label: 'Payroll Settings',
        icon: 'options-outline',
        permissions: ['payroll.view'],
        description: 'Salary kis tarikh aur time par jaati hai',
      },
      {
        href: '/company-bank',
        label: 'Company Bank',
        icon: 'business-outline',
        permissions: ['company_bank.view'],
        description: 'Jis account se salary jaati hai',
      },
      { href: '/roles', label: 'Roles', icon: 'shield-checkmark-outline', permissions: ['role.view'] },
      { href: '/permissions', label: 'Permissions', icon: 'key-outline', permissions: ['user.permission'] },
      { href: '/assets', label: 'IT Assets', icon: 'laptop-outline', permissions: ['asset.manage'] },
      { href: '/policies', label: 'Policies', icon: 'reader-outline', permissions: ['policy.manage'] },
      { href: '/clearance-items', label: 'Exit Checklist', icon: 'list-outline', permissions: ['clearance.manage'] },
      { href: '/ticket-categories', label: 'Ticket Categories', icon: 'pricetags-outline', permissions: ['ticket.category_manage'] },
      { href: '/ticket-slas', label: 'Response Times', icon: 'stopwatch-outline', permissions: ['ticket.category_manage'] },
      { href: '/data-import', label: 'Data Import', icon: 'cloud-upload-outline', permissions: ['employee.create', 'department.create'] },
      {
        href: '/reports',
        label: 'Reports',
        icon: 'bar-chart-outline',
        permissions: ['report.view'],
        description: 'Register aur statement — CSV download',
      },
      { href: '/audit-log', label: 'Audit Log', icon: 'footsteps-outline', permissions: ['audit.view'] },
      { href: '/career-page', label: 'Career Page', icon: 'globe-outline', permissions: ['recruitment.career_page'] },
      { href: '/billing', label: 'Invoices', icon: 'receipt-outline', permissions: ['invoice.view'] },
      { href: '/company-settings', label: 'Company Settings', icon: 'settings-outline', permissions: ['company.view'] },
    ],
  },
  {
    title: 'My Space',
    items: [
      { href: '/notifications', label: 'Notifications', icon: 'notifications-outline', permissions: [] },
      { href: '/my-attendance', label: 'My Attendance', icon: 'person-outline', permissions: [] },
      { href: '/my-leave', label: 'My Leave', icon: 'airplane-outline', permissions: [] },
      { href: '/my-payslips', label: 'My Payslips', icon: 'receipt-outline', permissions: [] },
      { href: '/my-advance', label: 'Advance Salary', icon: 'cash-outline', permissions: [] },
      { href: '/my-requests', label: 'My Requests', icon: 'paper-plane-outline', permissions: [] },
      { href: '/my-policies', label: 'Policies', icon: 'reader-outline', permissions: [] },
      { href: '/profile', label: 'My Profile', icon: 'id-card-outline', permissions: [] },
    ],
  },
]

export const platformSections: NavSection[] = [
  {
    title: null,
    items: [{ href: '/dashboard', label: 'Dashboard', icon: 'grid-outline', permissions: [] }],
  },
  {
    title: 'Platform',
    items: [
      { href: '/companies', label: 'Companies', icon: 'business-outline', permissions: [] },
      { href: '/plans', label: 'Plans', icon: 'pricetags-outline', permissions: [] },
      { href: '/billing', label: 'Invoices', icon: 'receipt-outline', permissions: [] },
      { href: '/revenue', label: 'Revenue', icon: 'trending-up-outline', permissions: [] },
    ],
  },
  {
    title: 'Access',
    items: [{ href: '/platform-permissions', label: 'Permissions', icon: 'key-outline', permissions: [] }],
  },
  {
    title: 'Account',
    items: [
      { href: '/notifications', label: 'Notifications', icon: 'notifications-outline', permissions: [] },
      { href: '/profile', label: 'Profile Settings', icon: 'settings-outline', permissions: [] },
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
