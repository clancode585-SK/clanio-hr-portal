import { CrudList, type FieldSpec, type RowAction } from '@/components/CrudList'

type Item = Record<string, any>

const fields: FieldSpec[] = [
  { key: 'title', label: 'Title', type: 'text', placeholder: 'Leave Policy', autoCapitalize: 'words', required: true, max: 200 },
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'hr', label: 'HR policy' },
      { value: 'code_of_conduct', label: 'Code of conduct' },
      { value: 'leave', label: 'Leave policy' },
      { value: 'attendance', label: 'Attendance policy' },
      { value: 'it_security', label: 'IT and security' },
      { value: 'expense', label: 'Expense policy' },
      { value: 'posh', label: 'POSH' },
      { value: 'safety', label: 'Safety' },
      { value: 'other', label: 'Other' },
    ],
    placeholder: 'Pick a category',
    required: true,
  },
  { key: 'version', label: 'Version', type: 'text', placeholder: 'v1.0', autoCapitalize: 'none', max: 20 },
  { key: 'effective_from', label: 'Effective from', type: 'date', placeholder: 'YYYY-MM-DD', required: true },
  { key: 'review_on', label: 'Review on', type: 'date', placeholder: 'Optional', afterKey: 'effective_from', afterMessage: 'Review date must be after the effective date' },
  { key: 'summary', label: 'Summary', type: 'text', placeholder: 'One line people will read first', autoCapitalize: 'sentences', multiline: true, max: 500 },
  { key: 'body', label: 'Full text', type: 'text', placeholder: 'Paste the policy text', autoCapitalize: 'sentences', multiline: true, required: true, max: 200000 },
  { key: 'needs_ack', label: 'Needs acceptance', type: 'toggle', hint: 'Employees must confirm they read it' },
  { key: 'ack_due_days', label: 'Accept within (days)', type: 'number', placeholder: '7', integer: true, min: 1, maxValue: 180 },
]

const rowActions: RowAction<Item>[] = [
  {
    key: 'publish',
    label: 'Publish to everyone',
    method: 'POST',
    path: (item) => `/policies/${item.uuid ?? item.id}/publish`,
    tone: 'primary',
    permission: 'policy.manage',
    visible: (item) => item.status !== 'published',
  },
  {
    key: 'archive',
    label: 'Archive',
    method: 'PUT',
    path: (item) => `/policies/${item.uuid ?? item.id}/archive`,
    permission: 'policy.manage',
    visible: (item) => item.status === 'published',
  },
]

export default function PoliciesScreen() {
  return (
    <CrudList<Item>
      title="Policies"
      endpoint="/policies"
      singular="policy"
      fields={fields}
      updateMethod="POST"
      rowActions={rowActions}
      permissions={{ create: 'policy.manage', edit: 'policy.manage', delete: 'policy.manage' }}
      searchPlaceholder="Search policies"
      emptyTitle="No policies"
      emptyMessage="Publish the rules people are expected to follow."
      notice={{ title: 'Paste the text here', message: 'PDF and Word uploads are done on the web portal. A policy needs either text or a file.' }}
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.title,
        subtitle: item.summary ?? item.category ?? undefined,
        badge: item.version ?? undefined,
        meta: item.needs_ack ? 'Acceptance' : undefined,
        search: `${item.title ?? ''} ${item.category ?? ''}`,
      })}
    />
  )
}
