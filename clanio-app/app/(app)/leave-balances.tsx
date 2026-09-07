import { CrudList, type FieldSpec, type RowAction, type ScreenAction } from '@/components/CrudList'

type Item = Record<string, any>

const fields: FieldSpec[] = []

const year = String(new Date().getFullYear())

const yearField: FieldSpec = { key: 'year', label: 'Leave year', type: 'number', placeholder: year, required: true }

const screenActions: ScreenAction[] = [
  {
    label: 'Allocate year',
    title: 'Allocate the yearly quota',
    confirmLabel: 'Allocate',
    path: '/leave-balances/allocate',
    method: 'POST',
    permission: 'leave_balance.manage',
    prompt: [yearField],
  },
  {
    label: 'Run accrual',
    title: 'Credit this month',
    confirmLabel: 'Accrue',
    path: '/leave-balances/accrue',
    method: 'POST',
    permission: 'leave_balance.manage',
    prompt: [yearField],
  },
  {
    label: 'Carry forward',
    title: 'Move last year to this year',
    confirmLabel: 'Carry forward',
    path: '/leave-balances/carry-forward',
    method: 'POST',
    permission: 'leave_balance.manage',
    prompt: [yearField],
  },
]

const rowActions: RowAction<Item>[] = [
  {
    key: 'adjust',
    label: 'Adjust balance',
    promptTitle: 'Add or remove days',
    confirmLabel: 'Adjust',
    method: 'PUT',
    tone: 'primary',
    permission: 'leave_balance.manage',
    path: (item) => `/leave-balances/${item.uuid ?? item.id}/adjust`,
    prompt: [
      { key: 'days', label: 'Days', type: 'number', placeholder: 'Use a minus sign to remove', required: true },
      { key: 'remarks', label: 'Reason', type: 'text', placeholder: 'Why the balance is changing', autoCapitalize: 'sentences', multiline: true, required: true },
    ],
  },
  {
    key: 'encash',
    label: 'Encash days',
    promptTitle: 'Pay out unused days',
    confirmLabel: 'Encash',
    method: 'PUT',
    permission: 'leave_balance.manage',
    path: (item) => `/leave-balances/${item.uuid ?? item.id}/encash`,
    visible: (item) => Boolean(item.leave_type?.is_encashable ?? item.is_encashable),
    prompt: [{ key: 'days', label: 'Days to encash', type: 'number', placeholder: '5', required: true }],
  },
]

export default function LeaveBalancesScreen() {
  return (
    <CrudList<Item>
      title="Leave Balances"
      endpoint="/leave-balances"
      singular="balance"
      fields={fields}
      rowActions={rowActions}
      screenActions={screenActions}
      allowCreate={false}
      allowUpdate={false}
      searchPlaceholder="Search by employee"
      emptyTitle="No balances yet"
      emptyMessage="Allocate the year to give everyone their opening quota."
      notice={{ title: 'Allocate once a year', message: 'Accrual credits month by month, carry forward moves last year over.' }}
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.employee?.user?.name ?? item.employee_name ?? 'Employee',
        subtitle: item.leave_type?.name ?? item.leave_type_name ?? undefined,
        badge: item.year != null ? String(item.year) : undefined,
        meta: item.available != null ? `${item.available} left` : undefined,
        search: `${item.employee?.user?.name ?? item.employee_name ?? ''} ${item.leave_type?.name ?? ''}`,
      })}
    />
  )
}
