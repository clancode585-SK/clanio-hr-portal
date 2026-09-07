import { ApprovalList, type Action, type Detail, type Row } from '@/components/ApprovalList'
import { useAuth } from '@/lib/auth'

type Item = Record<string, any>

export default function LeavesScreen() {
  const { can } = useAuth()
  const canApprove = can('leave.approve')

  return (
    <ApprovalList<Item>
      title="Leave Requests"
      endpoint="/leaves"
      searchPlaceholder="Search by employee"
      emptyTitle="No leave requests"
      emptyMessage="Requests will appear here as people apply."
      filters={[
        { key: 'pending', label: 'Pending', test: (item) => item.status === 'pending' },
        { key: 'approved', label: 'Approved', test: (item) => item.status === 'approved' },
        { key: 'rejected', label: 'Rejected', test: (item) => item.status === 'rejected' },
      ]}
      toRow={(item): Row => ({
        key: String(item.uuid ?? item.id),
        title: item.employee?.user?.name ?? 'Employee',
        subtitle: `${item.from_date} to ${item.to_date}`,
        badge: item.leave_type?.code ?? item.leave_type?.name,
        meta: item.status,
        search: `${item.employee?.user?.name ?? ''} ${item.status ?? ''} ${item.leave_type?.name ?? ''}`,
      })}
      toDetails={(item): Detail[] => [
        { label: 'Type', value: item.leave_type?.name ?? '—' },
        { label: 'From', value: item.from_date ?? '—' },
        { label: 'To', value: item.to_date ?? '—' },
        { label: 'Days', value: String(item.day_count ?? '—') },
        { label: 'Half day', value: item.is_half_day ? item.half_day_session ?? 'Yes' : 'No' },
        { label: 'Reason', value: item.reason ?? '—' },
        { label: 'Contact', value: item.contact_number ?? '—' },
        { label: 'Status', value: item.status ?? '—' },
        { label: 'Approver', value: item.approver?.name ?? '—' },
        { label: 'Remarks', value: item.decision_remarks ?? '—' },
      ]}
      toActions={(item): Action[] => {
        if (!canApprove || item.status !== 'pending') {
          return []
        }

        return [
          {
            key: 'approve',
            label: 'Approve',
            tone: 'primary',
            path: `/leaves/${item.uuid ?? item.id}/approve`,
            remarks: 'optional',
          },
          {
            key: 'reject',
            label: 'Reject',
            tone: 'danger',
            path: `/leaves/${item.uuid ?? item.id}/reject`,
            remarks: 'required',
            remarksLabel: 'Reason',
          },
        ]
      }}
    />
  )
}
