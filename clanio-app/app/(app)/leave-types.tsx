import { CrudList, type FieldSpec } from '@/components/CrudList'

type Item = Record<string, any>

const fields: FieldSpec[] = [
  { key: 'name', label: 'Name', type: 'text', placeholder: 'Casual Leave', autoCapitalize: 'words', required: true, max: 100 },
  { key: 'code', label: 'Code', type: 'text', placeholder: 'CL', autoCapitalize: 'characters', required: true, max: 20, pattern: /^[A-Za-z0-9_-]+$/, patternMessage: 'Letters, numbers, dash and underscore only' },
  { key: 'annual_quota', label: 'Days per year', type: 'number', placeholder: '12', min: 0, maxValue: 365 },
  {
    key: 'accrual_type',
    label: 'Credited',
    type: 'select',
    options: [
      { value: 'yearly', label: 'All at once', hint: 'Full quota on day one' },
      { value: 'monthly', label: 'Month by month', hint: 'Builds up through the year' },
    ],
    placeholder: 'Yearly',
  },
  {
    key: 'applicable_to',
    label: 'Who can take it',
    type: 'select',
    options: [
      { value: 'all', label: 'Everyone' },
      { value: 'male', label: 'Male employees' },
      { value: 'female', label: 'Female employees' },
    ],
    placeholder: 'Everyone',
  },
  { key: 'min_notice_days', label: 'Notice days', type: 'number', placeholder: '1', integer: true, min: 0, maxValue: 365 },
  { key: 'max_consecutive_days', label: 'Max days in a row', type: 'number', placeholder: '3', integer: true, min: 1, maxValue: 365 },
  { key: 'min_service_months', label: 'Months of service needed', type: 'number', placeholder: '0', integer: true, min: 0, maxValue: 120 },
  { key: 'is_paid', label: 'Paid leave', type: 'toggle', hint: 'Salary is not deducted' },
  { key: 'allow_half_day', label: 'Allow half day', type: 'toggle' },
  { key: 'requires_document', label: 'Needs a document', type: 'toggle', hint: 'Like a medical certificate' },
  { key: 'count_weekly_off', label: 'Count weekly offs', type: 'toggle', hint: 'Offs inside the leave are also deducted' },
  { key: 'count_holiday', label: 'Count holidays', type: 'toggle' },
  { key: 'carry_forward', label: 'Carry forward', type: 'toggle', hint: 'Unused days move to next year' },
  { key: 'carry_forward_max', label: 'Carry forward limit', type: 'number', placeholder: '5', min: 0, maxValue: 365 },
  { key: 'is_encashable', label: 'Encashable', type: 'toggle', hint: 'Unused days can be paid out' },
  { key: 'encashment_max', label: 'Encashment limit', type: 'number', placeholder: '10', min: 0, maxValue: 365 },
  { key: 'description', label: 'Description', type: 'text', placeholder: 'Optional', autoCapitalize: 'sentences', multiline: true, max: 500 },
]

export default function LeaveTypesScreen() {
  return (
    <CrudList<Item>
      title="Leave Types"
      endpoint="/leave-types"
      singular="leave type"
      fields={fields}
      defaults={{ is_paid: true, allow_half_day: true, accrual_type: 'yearly', applicable_to: 'all' }}
      permissions={{ create: 'leave_type.create', edit: 'leave_type.edit', delete: 'leave_type.delete' }}
      searchPlaceholder="Search leave types"
      emptyTitle="No leave types"
      emptyMessage="Casual, sick and earned leave usually go here."
      sort={(a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)}
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: item.annual_quota != null ? `${item.annual_quota} days a year` : item.description ?? undefined,
        badge: item.code,
        meta: item.is_paid ? 'Paid' : 'Unpaid',
        search: `${item.name ?? ''} ${item.code ?? ''}`,
      })}
    />
  )
}
