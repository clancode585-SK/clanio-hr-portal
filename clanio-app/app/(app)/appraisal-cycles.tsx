import { CrudList, type FieldSpec, type RowAction } from '@/components/CrudList'

type Item = Record<string, any>

const fields: FieldSpec[] = [
  { key: 'name', label: 'Name', type: 'text', placeholder: 'FY26 Annual Review', autoCapitalize: 'words', required: true, max: 100 },
  { key: 'period_start', label: 'Period from', type: 'date', placeholder: 'YYYY-MM-DD', required: true },
  { key: 'period_end', label: 'Period to', type: 'date', placeholder: 'YYYY-MM-DD', required: true, afterKey: 'period_start', afterMessage: 'Period end must be on or after the start' },
  { key: 'self_review_due', label: 'Self review due', type: 'date', placeholder: 'Optional' },
  { key: 'manager_review_due', label: 'Manager review due', type: 'date', placeholder: 'Optional', afterKey: 'self_review_due', afterMessage: 'Manager review must be after the self review' },
  { key: 'rating_scale', label: 'Rating scale', type: 'number', placeholder: '5', integer: true, min: 3, maxValue: 10 },
]

const rowActions: RowAction<Item>[] = [
  {
    key: 'launch',
    label: 'Launch this cycle',
    method: 'POST',
    tone: 'primary',
    permission: 'performance.manage',
    path: (item) => `/appraisal-cycles/${item.uuid ?? item.id}/launch`,
    visible: (item) => item.status === 'draft',
  },
  {
    key: 'advance',
    label: 'Move to the next stage',
    promptTitle: 'Where does it go next',
    confirmLabel: 'Move stage',
    method: 'PUT',
    permission: 'performance.manage',
    path: (item) => `/appraisal-cycles/${item.uuid ?? item.id}/advance`,
    visible: (item) => !['draft', 'closed'].includes(item.status),
    prompt: [
      {
        key: 'status',
        label: 'Next stage',
        type: 'select',
        options: [
          { value: 'manager_review', label: 'Manager review', hint: 'Managers rate their team' },
          { value: 'hr_review', label: 'HR review', hint: 'HR normalises the ratings' },
          { value: 'closed', label: 'Closed', hint: 'Ratings are locked' },
        ],
        placeholder: 'Pick the stage',
        required: true,
      },
    ],
  },
]

export default function AppraisalCyclesScreen() {
  return (
    <CrudList<Item>
      title="Appraisal Cycles"
      endpoint="/appraisal-cycles"
      singular="cycle"
      fields={fields}
      rowActions={rowActions}
      defaults={{ rating_scale: '5' }}
      permissions={{ create: 'performance.manage', edit: 'performance.manage' }}
      searchPlaceholder="Search cycles"
      emptyTitle="No appraisal cycles"
      emptyMessage="A cycle holds the review window and everyone's ratings."
      notice={{ title: 'Launch adds everyone', message: 'Once launched, every active employee gets an appraisal in this cycle.' }}
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: `${item.period_start} to ${item.period_end}`,
        badge: item.status,
        meta: item.appraisal_count != null ? `${item.appraisal_count} people` : undefined,
        search: `${item.name ?? ''} ${item.status ?? ''}`,
      })}
    />
  )
}
