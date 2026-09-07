import { CrudList, type FieldSpec, type RowAction } from '@/components/CrudList'
import { apiList } from '@/lib/api'
import type { Option } from '@/components/ui/Select'

type Item = Record<string, any>

const fields: FieldSpec[] = [
  { key: 'title', label: 'Goal', type: 'text', placeholder: 'Ship the billing module', autoCapitalize: 'sentences', required: true, max: 200 },
  { key: 'employee_id', label: 'Owner', type: 'select', optionsKey: 'employees', placeholder: 'Whose goal is this', allowClear: true },
  {
    key: 'goal_type',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'kra', label: 'KRA', hint: 'Standalone target with its own weight' },
      { value: 'objective', label: 'Objective', hint: 'Progress comes from its key results' },
      { value: 'key_result', label: 'Key result', hint: 'Measurable piece of an objective' },
    ],
    placeholder: 'KRA',
  },
  {
    key: 'period_type',
    label: 'Period',
    type: 'select',
    options: [
      { value: 'week', label: 'Week' },
      { value: 'fortnight', label: 'Fortnight' },
      { value: 'month', label: 'Month' },
      { value: 'quarter', label: 'Quarter' },
      { value: 'annual', label: 'Year' },
    ],
    placeholder: 'Quarter',
  },
  { key: 'start_date', label: 'Starts on', type: 'date', placeholder: 'YYYY-MM-DD', required: true },
  { key: 'due_date', label: 'Due on', type: 'date', placeholder: 'YYYY-MM-DD', required: true, afterKey: 'start_date', afterMessage: 'Due date must be on or after the start date' },
  { key: 'metric', label: 'Measured in', type: 'text', placeholder: 'Deals closed', autoCapitalize: 'sentences', max: 100 },
  { key: 'target_value', label: 'Target', type: 'number', placeholder: '25', min: 0 },
  { key: 'weight', label: 'Weight out of 100', type: 'number', placeholder: '20', integer: true, min: 0, maxValue: 100 },
  {
    key: 'progress_source',
    label: 'Progress comes from',
    type: 'select',
    options: [
      { value: 'manual', label: 'Updated by hand' },
      { value: 'tasks', label: 'Linked tasks' },
    ],
    placeholder: 'Updated by hand',
  },
  { key: 'description', label: 'Detail', type: 'text', placeholder: 'What good looks like', autoCapitalize: 'sentences', multiline: true, max: 1000 },
]

const rowActions: RowAction<Item>[] = [
  {
    key: 'activate',
    label: 'Approve and activate',
    method: 'PUT',
    tone: 'primary',
    path: (item) => `/goals/${item.uuid ?? item.id}/approve`,
    visible: (item) => item.status === 'draft',
  },
  {
    key: 'progress',
    label: 'Update progress',
    promptTitle: 'Where has it reached',
    confirmLabel: 'Save progress',
    method: 'PUT',
    tone: 'primary',
    path: (item) => `/goals/${item.uuid ?? item.id}/progress`,
    visible: (item) => item.status === 'active',
    prompt: [
      { key: 'progress_percent', label: 'Percent done', type: 'number', placeholder: '60' },
      { key: 'achieved_value', label: 'Achieved so far', type: 'number', placeholder: '15' },
    ],
  },
  {
    key: 'submit',
    label: 'Send for verification',
    promptTitle: 'Submit your achievement',
    confirmLabel: 'Submit',
    method: 'PUT',
    path: (item) => `/goals/${item.uuid ?? item.id}/submit`,
    visible: (item) =>
      item.status === 'active' && (item.verification_status ?? 'not_submitted') === 'not_submitted',
    prompt: [
      { key: 'achieved_value', label: 'Final achieved value', type: 'number', placeholder: '25', required: true },
      { key: 'remarks', label: 'Remarks', type: 'text', placeholder: 'Optional', autoCapitalize: 'sentences', multiline: true },
    ],
  },
  {
    key: 'verify',
    label: 'Verify as manager',
    promptTitle: 'Verify this achievement',
    confirmLabel: 'Verify',
    method: 'PUT',
    path: (item) => `/goals/${item.uuid ?? item.id}/verify`,
    visible: (item) => item.verification_status === 'submitted',
    prompt: [
      { key: 'achieved_value', label: 'Agreed value', type: 'number', placeholder: 'Leave blank to accept' },
      { key: 'remarks', label: 'Remarks', type: 'text', placeholder: 'Optional', autoCapitalize: 'sentences', multiline: true },
    ],
  },
  {
    key: 'finalise',
    label: 'Finalise as HR',
    promptTitle: 'Lock this number',
    confirmLabel: 'Finalise',
    method: 'PUT',
    permission: 'okr.verify',
    path: (item) => `/goals/${item.uuid ?? item.id}/finalise`,
    visible: (item) => item.verification_status === 'manager_verified',
    prompt: [
      { key: 'achieved_value', label: 'Final value', type: 'number', placeholder: 'Leave blank to accept' },
      { key: 'remarks', label: 'Remarks', type: 'text', placeholder: 'Optional', autoCapitalize: 'sentences', multiline: true },
    ],
  },
  {
    key: 'close',
    label: 'Close this goal',
    promptTitle: 'How did it end',
    confirmLabel: 'Close goal',
    method: 'PUT',
    tone: 'danger',
    path: (item) => `/goals/${item.uuid ?? item.id}/close`,
    visible: (item) => !['achieved', 'missed', 'cancelled'].includes(item.status),
    prompt: [
      {
        key: 'status',
        label: 'Outcome',
        type: 'select',
        options: [
          { value: 'achieved', label: 'Achieved' },
          { value: 'missed', label: 'Missed' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
        placeholder: 'Achieved',
      },
      { key: 'remarks', label: 'Remarks', type: 'text', placeholder: 'Optional', autoCapitalize: 'sentences', multiline: true },
    ],
  },
]

async function loadOptions(): Promise<Record<string, Option[]>> {
  try {
    const employees = await apiList<Item>('/employees?per_page=200')

    return {
      employees: employees.data.map((row) => ({
        value: String(row.id),
        label: row.user?.name ?? row.name ?? `Employee ${row.id}`,
        hint: row.designation?.name ?? undefined,
      })),
    }
  } catch {
    return { employees: [] }
  }
}

export default function GoalsScreen() {
  return (
    <CrudList<Item>
      title="Goals & OKR"
      endpoint="/goals"
      singular="goal"
      fields={fields}
      rowActions={rowActions}
      loadOptions={loadOptions}
      defaults={{ goal_type: 'kra', period_type: 'quarter', progress_source: 'manual' }}
      searchPlaceholder="Search goals"
      emptyTitle="No goals"
      emptyMessage="Set what people are measured on this quarter."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.title,
        subtitle: [item.employee?.user?.name ?? item.employee?.name, item.period_label ?? item.period_type]
          .filter(Boolean)
          .join(' · '),
        badge: item.progress_percent != null ? `${item.progress_percent}%` : undefined,
        meta: item.verification_status === 'finalised' ? 'Finalised' : item.status,
        search: `${item.title ?? ''} ${item.employee?.user?.name ?? ''}`,
      })}
    />
  )
}
