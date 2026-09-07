import { CrudList, type FieldSpec, type RowAction, type ScreenAction } from '@/components/CrudList'
import { apiList } from '@/lib/api'
import type { Option } from '@/components/ui/Select'

type Item = Record<string, any>

const fields: FieldSpec[] = []

const periodTypes: Option[] = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'annual', label: 'Year' },
]

const screenActions: ScreenAction[] = [{
  label: 'Calculate',
  title: 'Calculate incentives',
  confirmLabel: 'Run calculation',
  path: '/incentives/calculate',
  method: 'POST',
  permission: 'incentive.approve',
  prompt: [
    { key: 'period_type', label: 'Period type', type: 'select', options: periodTypes, placeholder: 'Month' },
    { key: 'period_label', label: 'Period', type: 'text', placeholder: '2026-08', required: true },
    { key: 'employee_id', label: 'One employee only', type: 'select', optionsKey: 'employees', placeholder: 'Leave blank for everyone', allowClear: true },
  ],
}]

const rowActions: RowAction<Item>[] = [
  {
    key: 'approve',
    label: 'Approve payout',
    promptTitle: 'Approve this incentive',
    confirmLabel: 'Approve',
    method: 'PUT',
    tone: 'primary',
    permission: 'incentive.approve',
    path: (item) => `/incentives/${item.uuid ?? item.id}/approve`,
    visible: (item) => item.status === 'pending' || item.status === 'calculated',
    prompt: [
      { key: 'remarks', label: 'Remarks', type: 'text', placeholder: 'Optional', autoCapitalize: 'sentences', multiline: true },
    ],
  },
  {
    key: 'reject',
    label: 'Reject payout',
    promptTitle: 'Reject this incentive',
    confirmLabel: 'Reject',
    method: 'PUT',
    tone: 'danger',
    permission: 'incentive.approve',
    path: (item) => `/incentives/${item.uuid ?? item.id}/reject`,
    visible: (item) => item.status === 'pending' || item.status === 'calculated',
    prompt: [
      { key: 'reason', label: 'Reason', type: 'text', placeholder: 'Why it is not payable', autoCapitalize: 'sentences', multiline: true, required: true },
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
      })),
    }
  } catch {
    return { employees: [] }
  }
}

export default function IncentivesScreen() {
  return (
    <CrudList<Item>
      title="Incentives"
      endpoint="/incentives"
      singular="incentive"
      fields={fields}
      rowActions={rowActions}
      screenActions={screenActions}
      loadOptions={loadOptions}
      allowCreate={false}
      allowUpdate={false}
      searchPlaceholder="Search by employee"
      emptyTitle="No incentives"
      emptyMessage="Run a calculation for a period to generate payouts."
      notice={{ title: 'Numbers come from goals', message: 'Incentive slabs read the verified goal achievement for that period.' }}
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.employee_name ?? item.employee?.user?.name ?? 'Employee',
        subtitle: [item.period_label, item.slab_label].filter(Boolean).join(' · '),
        badge: item.incentive_percent != null ? `${item.incentive_percent}%` : undefined,
        meta: item.status,
        search: `${item.employee_name ?? ''} ${item.period_label ?? ''}`,
      })}
    />
  )
}
