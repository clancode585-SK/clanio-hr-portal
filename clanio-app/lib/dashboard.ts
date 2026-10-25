import type { IconName } from '@/components/ui/Icon'

export type Persona = 'super_admin' | 'admin' | 'hr' | 'finance' | 'manager' | 'employee'

export type Block = {
  key: string
  group: string
  label: string
  hint: string
  icon: IconName
  href: string
  endpoint: string
  count: 'meta' | 'length' | 'field' | 'sum'
  field?: string
  permissions: string[]
  personas: Persona[]
  tone?: 'brand' | 'warning' | 'danger' | 'success'
}

export const personaLabels: Record<Persona, string> = {
  super_admin: 'Platform owner',
  admin: 'Company admin',
  hr: 'People team',
  finance: 'Finance',
  manager: 'Manager',
  employee: 'My workspace',
}

export const personaGreetings: Record<Persona, string> = {
  super_admin: 'Every company on Clanio, in one place.',
  admin: 'Everything happening across the company.',
  hr: 'People, policies and the paperwork behind them.',
  finance: 'Money going out, and what still needs a signature.',
  manager: 'Your team, their work and what is waiting on you.',
  employee: 'Your attendance, leave and requests.',
}

export function personaOf(roles: { slug?: string; name?: string }[], isSuperAdmin: boolean): Persona {
  if (isSuperAdmin) {
    return 'super_admin'
  }

  const slugs = roles.map((role) => (role.slug ?? role.name ?? '').toLowerCase())

  const matches = (needles: string[]) => slugs.some((slug) => needles.some((needle) => slug.includes(needle)))

  if (matches(['company_admin', 'admin'])) {
    return 'admin'
  }

  if (matches(['hr'])) {
    return 'hr'
  }

  if (matches(['finance', 'account'])) {
    return 'finance'
  }

  if (matches(['manager', 'lead', 'supervisor'])) {
    return 'manager'
  }

  return 'employee'
}

export const blocks: Block[] = [
  {
    key: 'companies',
    group: 'Platform',
    label: 'Companies',
    hint: 'Live workspaces on the platform',
    icon: 'business-outline',
    href: '/companies',
    endpoint: '/companies?per_page=1',
    count: 'meta',
    permissions: [],
    personas: ['super_admin'],
    tone: 'brand',
  },
  {
    key: 'leave-approvals',
    group: 'Waiting on you',
    label: 'Leave requests',
    hint: 'Time-off requests needing your decision',
    icon: 'calendar-outline',
    href: '/leaves',
    endpoint: '/leaves/pending-approvals?per_page=1',
    count: 'meta',
    permissions: ['leave.approve'],
    personas: ['admin', 'hr', 'manager'],
    tone: 'warning',
  },
  {
    key: 'regularizations',
    group: 'Waiting on you',
    label: 'Attendance fixes',
    hint: 'Punch corrections your team has raised',
    icon: 'create-outline',
    href: '/regularizations',
    endpoint: '/regularizations/pending-approvals?per_page=1',
    count: 'meta',
    permissions: ['attendance.regularize'],
    personas: ['admin', 'hr', 'manager'],
    tone: 'warning',
  },
  {
    key: 'expense-verify',
    group: 'Waiting on you',
    label: 'Claims to verify',
    hint: 'Claims to check before they are paid',
    icon: 'receipt-outline',
    href: '/expense-claims',
    endpoint: '/expense-claims/pending-verification?per_page=1',
    count: 'meta',
    permissions: ['expense.verify'],
    personas: ['admin', 'finance'],
    tone: 'warning',
  },
  {
    key: 'expense-payout',
    group: 'Waiting on you',
    label: 'Ready to pay',
    hint: 'Verified claims ready for transfer',
    icon: 'card-outline',
    href: '/expense-claims',
    endpoint: '/expense-claims/pending-payout?per_page=1',
    count: 'meta',
    permissions: ['expense.pay'],
    personas: ['admin', 'finance'],
    tone: 'danger',
  },
  {
    key: 'incentives',
    group: 'Waiting on you',
    label: 'Incentives',
    hint: 'Calculated payouts awaiting sign-off',
    icon: 'cash-outline',
    href: '/incentives',
    endpoint: '/incentives?per_page=1',
    count: 'meta',
    permissions: ['incentive.approve', 'incentive.manage'],
    personas: ['admin', 'finance'],
  },
  {
    key: 'exits',
    group: 'Waiting on you',
    label: 'Resignations',
    hint: 'Resignations waiting on your decision',
    icon: 'exit-outline',
    href: '/exits',
    endpoint: '/exits/pending-approvals?per_page=1',
    count: 'meta',
    permissions: ['exit.approve'],
    personas: ['admin', 'hr', 'manager'],
    tone: 'danger',
  },
  {
    key: 'clearance',
    group: 'Waiting on you',
    label: 'Clearance',
    hint: 'Exit checklists sitting on your desk',
    icon: 'checkmark-done-outline',
    href: '/clearance',
    endpoint: '/clearance/pending?per_page=1',
    count: 'meta',
    permissions: ['clearance.sign'],
    personas: ['admin', 'hr', 'finance', 'manager'],
  },
  {
    key: 'asset-requests',
    group: 'Workplace',
    label: 'Asset requests',
    hint: 'Laptops and devices people asked for',
    icon: 'construct-outline',
    href: '/asset-requests',
    endpoint: '/asset-requests/pending?per_page=1',
    count: 'meta',
    permissions: ['asset.support', 'asset.manage'],
    personas: ['admin', 'hr'],
  },
  {
    key: 'tickets',
    group: 'Workplace',
    label: 'Open tickets',
    hint: 'Helpdesk tickets still needing a reply',
    icon: 'chatbubbles-outline',
    href: '/tickets',
    endpoint: '/tickets/summary',
    count: 'field',
    field: 'open',
    permissions: ['ticket.view_all', 'ticket.resolve'],
    personas: ['admin', 'hr'],
  },
  {
    key: 'tickets-breached',
    group: 'Workplace',
    label: 'Past deadline',
    hint: 'Tickets that crossed their SLA',
    icon: 'warning-outline',
    href: '/tickets',
    endpoint: '/tickets/summary',
    count: 'field',
    field: 'breached',
    permissions: ['ticket.view_all', 'ticket.resolve'],
    personas: ['admin', 'hr'],
    tone: 'danger',
  },
  {
    key: 'goal-verify',
    group: 'Waiting on you',
    label: 'Goals to verify',
    hint: 'Goal achievements submitted for review',
    icon: 'trophy-outline',
    href: '/goals',
    endpoint: '/goals/pending-verification?per_page=1',
    count: 'meta',
    permissions: ['okr.verify'],
    personas: ['admin', 'hr', 'manager'],
  },
  {
    key: 'appraisals',
    group: 'Waiting on you',
    label: 'Reviews to write',
    hint: 'Appraisals waiting for your write-up',
    icon: 'clipboard-outline',
    href: '/appraisals',
    endpoint: '/appraisals/pending-reviews?per_page=1',
    count: 'meta',
    permissions: [],
    personas: ['admin', 'hr', 'manager', 'employee'],
  },
  {
    key: 'employees',
    group: 'People',
    label: 'Employees',
    hint: 'Active people on the roll today',
    icon: 'people-outline',
    href: '/employees',
    endpoint: '/employees?per_page=1',
    count: 'meta',
    permissions: ['employee.view'],
    personas: ['admin', 'hr'],
  },
  {
    key: 'daily-reports',
    group: 'People',
    label: 'Reports pending',
    hint: 'Not submitted for today yet',
    icon: 'document-text-outline',
    href: '/daily-reports',
    endpoint: '/daily-reports/team-status',
    count: 'field',
    field: 'summary.pending',
    permissions: ['daily_report.view_team'],
    personas: ['admin', 'hr', 'manager'],
    tone: 'warning',
  },
  {
    key: 'tasks-overdue',
    group: 'Workplace',
    label: 'Overdue tasks',
    hint: 'Tasks that crossed their due date',
    icon: 'alarm-outline',
    href: '/tasks',
    endpoint: '/tasks/summary',
    count: 'field',
    field: 'overdue',
    permissions: ['task.edit'],
    personas: ['admin', 'manager'],
    tone: 'danger',
  },
  {
    key: 'tasks-mine',
    group: 'Workplace',
    label: 'My tasks',
    hint: 'Open tasks assigned to you',
    icon: 'checkbox-outline',
    href: '/tasks',
    endpoint: '/tasks/summary',
    count: 'field',
    field: 'assigned_to_me',
    permissions: [],
    personas: ['admin', 'hr', 'finance', 'manager', 'employee'],
  },
  {
    key: 'my-policies',
    group: 'My space',
    label: 'Policies to accept',
    hint: 'Read and confirm to stay compliant',
    icon: 'reader-outline',
    href: '/my-policies',
    endpoint: '/my-policies',
    count: 'field',
    field: 'pending',
    permissions: [],
    personas: ['hr', 'finance', 'manager', 'employee'],
    tone: 'warning',
  },
  {
    key: 'my-leave',
    group: 'My space',
    label: 'Leave left',
    hint: 'Balance across all your leave types',
    icon: 'airplane-outline',
    href: '/my-leave',
    endpoint: '/leaves/my-balance',
    count: 'sum',
    field: 'usable',
    permissions: [],
    personas: ['hr', 'finance', 'manager', 'employee'],
    tone: 'success',
  },
  {
    key: 'my-assets',
    group: 'My space',
    label: 'Assets with me',
    hint: 'Devices currently issued to you',
    icon: 'laptop-outline',
    href: '/my-requests',
    endpoint: '/my-assets?per_page=50',
    count: 'length',
    permissions: [],
    personas: ['hr', 'finance', 'manager', 'employee'],
  },
  {
    key: 'joining-soon',
    group: 'Hiring',
    label: 'Joining soon',
    hint: 'Offers accepted, joining date near',
    icon: 'person-add-outline',
    href: '/joinings',
    endpoint: '/joinings',
    count: 'field',
    field: 'total',
    permissions: ['recruitment.view'],
    personas: ['admin', 'hr'],
    tone: 'brand',
  },
  {
    key: 'my-interviews',
    group: 'Hiring',
    label: 'Interviews to take',
    hint: 'Interviews scheduled on your calendar',
    icon: 'videocam-outline',
    href: '/interviews',
    endpoint: '/interviews/mine?per_page=1',
    count: 'meta',
    permissions: ['interview.conduct'],
    personas: ['admin', 'hr', 'manager'],
    tone: 'brand',
  },
  {
    key: 'new-applicants',
    group: 'Hiring',
    label: 'New applicants',
    hint: 'New applicants nobody has screened',
    icon: 'megaphone-outline',
    href: '/openings',
    endpoint: '/openings/summary',
    count: 'field',
    field: 'new_applications',
    permissions: ['recruitment.view'],
    personas: ['admin', 'hr'],
    tone: 'brand',
  },
  {
    key: 'open-positions',
    group: 'Hiring',
    label: 'Open positions',
    hint: 'Roles live on your career page',
    icon: 'briefcase-outline',
    href: '/openings',
    endpoint: '/openings/summary',
    count: 'field',
    field: 'positions',
    permissions: ['recruitment.view'],
    personas: ['admin', 'hr', 'manager'],
  },
  {
    key: 'invoices-due',
    group: 'Platform',
    label: 'Invoices due',
    hint: 'Invoices still awaiting payment',
    icon: 'receipt-outline',
    href: '/billing',
    endpoint: '/invoices/summary',
    count: 'field',
    field: 'pending',
    permissions: ['invoice.view'],
    personas: ['admin', 'finance'],
    tone: 'warning',
  },
  {
    key: 'audit-log',
    group: 'People',
    label: 'Changes logged',
    hint: 'Who changed what, and when',
    icon: 'footsteps-outline',
    href: '/audit-log',
    endpoint: '/audit-logs?per_page=1',
    count: 'meta',
    permissions: ['audit.view'],
    personas: ['admin'],
  },
  {
    key: 'notifications',
    group: 'My space',
    label: 'Unread',
    hint: 'Unread updates waiting for you',
    icon: 'notifications-outline',
    href: '/notifications',
    endpoint: '/notifications/unread-count',
    count: 'field',
    field: 'unread_count',
    permissions: [],
    personas: ['super_admin', 'admin', 'hr', 'finance', 'manager', 'employee'],
  },
]

export function blocksFor(persona: Persona, canAny: (slugs: string[]) => boolean): Block[] {
  return blocks.filter(
    (block) => block.personas.includes(persona) && (block.permissions.length === 0 || canAny(block.permissions))
  )
}
