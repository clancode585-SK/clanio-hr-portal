import { ApprovalList, type Action, type Detail, type Row } from '@/components/ApprovalList'
import { useAuth } from '@/lib/auth'

type Item = Record<string, any>

export default function RegularizationsScreen() {
  const { can } = useAuth()
  const canDecide = can('attendance.regularize')

  return (
    <ApprovalList<Item>
      title="Regularizations"
      endpoint="/regularizations"
      searchPlaceholder="Search by employee"
      emptyTitle="No requests"
      emptyMessage="Attendance corrections will appear here."
      filters={[
        { key: 'pending', label: 'Pending', test: (item) => item.status === 'pending' },
        { key: 'approved', label: 'Approved', test: (item) => item.status === 'approved' },
        { key: 'rejected', label: 'Rejected', test: (item) => item.status === 'rejected' },
      ]}
      toRow={(item): Row => ({
        key: String(item.uuid ?? item.id),
        title: item.employee_name ?? 'Employee',
        subtitle: `${item.type_label ?? item.type} · ${item.attendance_date}`,
        badge: item.employee_code,
        meta: item.status,
        search: `${item.employee_name ?? ''} ${item.status ?? ''}`,
      })}
      toDetails={(item): Detail[] => [
        { label: 'Date', value: item.attendance_date ?? '—' },
        { label: 'Type', value: item.type_label ?? item.type ?? '—' },
        { label: 'Reason', value: item.reason ?? '—' },
        { label: 'Asked in', value: formatPunch(item.requested) },
        { label: 'Asked out', value: formatPunch(item.requested, 'check_out') },
        { label: 'Current in', value: formatPunch(item.previous) },
        { label: 'Current out', value: formatPunch(item.previous, 'check_out') },
        { label: 'Status', value: item.status ?? '—' },
        { label: 'Approver', value: item.decision?.approver_name ?? '—' },
        { label: 'Remarks', value: item.decision?.remarks ?? '—' },
      ]}
      toActions={(item): Action[] => {
        if (!canDecide || item.status !== 'pending') {
          return []
        }

        return [
          {
            key: 'approve',
            label: 'Approve',
            tone: 'primary',
            path: `/regularizations/${item.uuid ?? item.id}/approve`,
            remarks: 'optional',
          },
          {
            key: 'reject',
            label: 'Reject',
            tone: 'danger',
            path: `/regularizations/${item.uuid ?? item.id}/reject`,
            remarks: 'required',
            remarksLabel: 'Reason',
          },
        ]
      }}
    />
  )
}

function formatPunch(block: Record<string, any> | null | undefined, key = 'check_in'): string {
  const value = block?.[key]

  if (!value) {
    return '—'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
