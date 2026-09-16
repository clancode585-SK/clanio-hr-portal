import { ApprovalList, type Action, type Detail, type FileRef, type Row } from '@/components/ApprovalList'
import { useAuth } from '@/lib/auth'

type Item = Record<string, any>

export default function ExitsScreen() {
  const { can } = useAuth()
  const canApprove = can('exit.approve')

  return (
    <ApprovalList<Item>
      title="Resignations"
      endpoint="/exits"
      searchPlaceholder="Search by employee"
      emptyTitle="No resignations"
      emptyMessage="Exit requests will appear here."
      filters={[
        { key: 'open', label: 'Open', test: (item) => !item.is_closed },
        { key: 'hr', label: 'With HR', test: (item) => item.status === 'manager_approved' },
        { key: 'notice', label: 'On notice', test: (item) => item.status === 'serving_notice' },
        { key: 'closed', label: 'Closed', test: (item) => Boolean(item.is_closed) },
      ]}
      toRow={(item): Row => ({
        key: String(item.uuid ?? item.id),
        title: item.employee_name ?? 'Employee',
        subtitle: item.last_working_date
          ? `Last day ${item.last_working_date}`
          : (item.exit_type_label ?? item.exit_type ?? '—'),
        badge: item.employee_code,
        meta: item.status,
        search: `${item.employee_name ?? ''} ${item.status ?? ''}`,
      })}
      detailPath={(item) => `/exits/${item.uuid ?? item.id}`}
      toFiles={(item): FileRef[] =>
        (item.documents ?? []).map((doc: Record<string, any>) => ({
          id: String(doc.uuid ?? doc.id),
          label: doc.type_label ?? doc.original_name ?? 'Document',
          path: `/exit-documents/${doc.uuid ?? doc.id}/download`,
          fileName: doc.original_name ?? 'document.pdf',
        }))
      }
      toDetails={(item): Detail[] => [
        { label: 'Type', value: item.exit_type_label ?? item.exit_type ?? '—' },
        { label: 'Reason', value: item.reason ?? '—' },
        { label: 'Resigned on', value: item.resignation_date ?? '—' },
        { label: 'Asked last day', value: item.requested_last_working_date ?? '—' },
        { label: 'Notice period', value: item.notice_period_days ? `${item.notice_period_days} days` : '—' },
        { label: 'Last working day', value: item.last_working_date ?? '—' },
        { label: 'Days left', value: item.days_left != null ? String(item.days_left) : '—' },
        { label: 'Stage', value: item.stage ?? '—' },
        { label: 'Manager', value: item.manager?.manager_name ?? '—' },
        { label: 'HR', value: item.hr?.hr_name ?? '—' },
      ]}
      toActions={(item): Action[] => {
        const id = item.uuid ?? item.id

        if (item.is_closed) {
          return []
        }

        const actions: Action[] = []

        if (item.stage === 'manager') {
          actions.push({
            key: 'manager',
            label: 'Approve as manager',
            tone: 'primary',
            path: `/exits/${id}/manager-approve`,
            remarks: 'optional',
          })
        }

        if (item.stage === 'hr' && canApprove) {
          actions.push({
            key: 'hr',
            label: 'Final approve',
            tone: 'primary',
            path: `/exits/${id}/hr-approve`,
            remarks: 'optional',
          })
        }

        if (canApprove && ['manager_approved', 'serving_notice'].includes(item.status)) {
          actions.push({
            key: 'lwd',
            label: 'Change the last working day',
            tone: 'secondary',
            path: `/exits/${id}/last-working-date`,
            remarks: 'optional',
            extra: [
              { key: 'last_working_date', label: 'New last working day', placeholder: 'YYYY-MM-DD', required: true },
            ],
          })

          actions.push({
            key: 'complete',
            label: 'Mark the exit complete',
            tone: 'primary',
            path: `/exits/${id}/complete`,
            remarks: 'optional',
          })
        }

        actions.push({
          key: 'reject',
          label: 'Reject',
          tone: 'danger',
          path: `/exits/${id}/reject`,
          remarks: 'required',
          remarksKey: 'reason',
          remarksLabel: 'Reason',
        })

        return actions
      }}
    />
  )
}
