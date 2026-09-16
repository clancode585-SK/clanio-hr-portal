import type { IconName } from '@/components/ui/Icon'

export type Persona = 'super_admin' | 'admin' | 'hr' | 'finance' | 'manager' | 'employee'

export type Block = {
  key: string
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
    label: 'Companies',
    hint: 'Live workspaces',
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
    label: 'Leave requests',
    hint: 'Waiting on you',
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
    label: 'Attendance fixes',
    hint: 'Waiting on you',
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
    label: 'Claims to verify',
    hint: 'Before payout',
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
    label: 'Ready to pay',
    hint: 'Verified claims',
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
    label: 'Incentives',
    hint: 'Payout runs',
    icon: 'cash-outline',
    href: '/incentives',
    endpoint: '/incentives?per_page=1',
    count: 'meta',
    permissions: ['incentive.approve', 'incentive.manage'],
    personas: ['admin', 'finance'],
  },
  {
    key: 'exits',
    label: 'Resignations',
    hint: 'Waiting on you',
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
    label: 'Clearance',
    hint: 'Your desk to sign',
    icon: 'checkmark-done-outline',
    href: '/clearance',
    endpoint: '/clearance/pending?per_page=1',
    count: 'meta',
    permissions: ['clearance.sign'],
    personas: ['admin', 'hr', 'finance', 'manager'],
  },
  {
    key: 'asset-requests',
    label: 'Asset requests',
    hint: 'Open with IT',
    icon: 'construct-outline',
    href: '/asset-requests',
    endpoint: '/asset-requests/pending?per_page=1',
    count: 'meta',
    permissions: ['asset.support', 'asset.manage'],
    personas: ['admin', 'hr'],
  },
  {
    key: 'tickets',
    label: 'Open tickets',
    hint: 'Needing a reply',
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
    label: 'Past deadline',
    hint: 'Tickets over SLA',
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
    label: 'Goals to verify',
    hint: 'Achievements submitted',
    icon: 'trophy-outline',
    href: '/goals',
    endpoint: '/goals/pending-verification?per_page=1',
    count: 'meta',
    permissions: ['okr.verify'],
    personas: ['admin', 'hr', 'manager'],
  },
  {
    key: 'appraisals',
    label: 'Reviews to write',
    hint: 'Appraisals waiting on you',
    icon: 'clipboard-outline',
    href: '/appraisals',
    endpoint: '/appraisals/pending-reviews?per_page=1',
    count: 'meta',
    permissions: [],
    personas: ['admin', 'hr', 'manager', 'employee'],
  },
  {
    key: 'employees',
    label: 'Employees',
    hint: 'On the roll',
    icon: 'people-outline',
    href: '/employees',
    endpoint: '/employees?per_page=1',
    count: 'meta',
    permissions: ['employee.view'],
    personas: ['admin', 'hr'],
  },
  {
    key: 'daily-reports',
    label: 'Reports pending',
    hint: 'Not submitted today',
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
    label: 'Overdue tasks',
    hint: 'Past the due date',
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
    label: 'My tasks',
    hint: 'Assigned to you',
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
    label: 'Policies to accept',
    hint: 'Read and confirm',
    icon: 'reader-outline',
    href: '/my-policies',
    endpoint: '/my-policies',
    count: 'field',
    field: 'pending',
    permissions: [],
    personas: ['admin', 'hr', 'finance', 'manager', 'employee'],
    tone: 'warning',
  },
  {
    key: 'my-leave',
    label: 'Leave left',
    hint: 'Across all your leave types',
    icon: 'airplane-outline',
    href: '/my-leave',
    endpoint: '/leaves/my-balance',
    count: 'sum',
    field: 'usable',
    permissions: [],
    personas: ['admin', 'hr', 'finance', 'manager', 'employee'],
    tone: 'success',
  },
  {
    key: 'my-assets',
    label: 'Assets with me',
    hint: 'Issued to you',
    icon: 'laptop-outline',
    href: '/my-requests',
    endpoint: '/my-assets?per_page=50',
    count: 'length',
    permissions: [],
    personas: ['admin', 'hr', 'finance', 'manager', 'employee'],
  },
  {
    key: 'joining-soon',
    label: 'Joining soon',
    hint: 'Accepted, waiting to join',
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
    label: 'Interviews to take',
    hint: 'Scheduled for you',
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
    label: 'New applicants',
    hint: 'Nobody has looked yet',
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
    label: 'Open positions',
    hint: 'Live on the career page',
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
    label: 'Invoices due',
    hint: 'Awaiting payment',
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
    label: 'Changes logged',
    hint: 'Who changed what',
    icon: 'footsteps-outline',
    href: '/audit-log',
    endpoint: '/audit-logs?per_page=1',
    count: 'meta',
    permissions: ['audit.view'],
    personas: ['admin'],
  },
  {
    key: 'notifications',
    label: 'Unread',
    hint: 'Notifications',
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
