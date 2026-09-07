import { ApprovalList, type Action, type Detail, type Row } from '@/components/ApprovalList'
import { useAuth } from '@/lib/auth'

type Item = Record<string, any>

export default function AssetRequestsScreen() {
  const { can } = useAuth()
  const canHandle = can('asset.support') || can('asset.manage')

  return (
    <ApprovalList<Item>
      title="Asset Requests"
      endpoint="/asset-requests"
      searchPlaceholder="Search requests"
      emptyTitle="No asset requests"
      emptyMessage="Repair and new asset requests appear here."
      filters={[
        { key: 'open', label: 'Open', test: (item) => !item.is_closed },
        { key: 'closed', label: 'Closed', test: (item) => Boolean(item.is_closed) },
      ]}
      toRow={(item): Row => ({
        key: String(item.uuid ?? item.id),
        title: item.title,
        subtitle: `${item.employee_name ?? ''} · ${item.request_type_label ?? item.request_type ?? ''}`,
        badge: item.priority,
        meta: item.status,
        search: `${item.title ?? ''} ${item.employee_name ?? ''} ${item.status ?? ''}`,
      })}
      toDetails={(item): Detail[] => [
        { label: 'Raised by', value: item.employee_name ?? '—' },
        { label: 'Type', value: item.request_type_label ?? item.request_type ?? '—' },
        { label: 'Asset', value: item.asset_name ?? item.asset_code ?? '—' },
        { label: 'Category', value: item.category ?? '—' },
        { label: 'Priority', value: item.priority ?? '—' },
        { label: 'Detail', value: item.description ?? '—' },
        { label: 'Stage', value: item.stage ?? item.status ?? '—' },
        { label: 'Handler', value: item.handler_name ?? '—' },
        { label: 'Resolution', value: item.resolution ?? '—' },
      ]}
      toActions={(item): Action[] => {
        const id = item.uuid ?? item.id

        if (!canHandle || item.is_closed) {
          return []
        }

        if (item.can?.approve || item.status === 'pending') {
          return [
            { key: 'approve', label: 'Approve', tone: 'primary', path: `/asset-requests/${id}/approve`, remarks: 'optional' },
            {
              key: 'reject',
              label: 'Reject',
              tone: 'danger',
              path: `/asset-requests/${id}/reject`,
              remarks: 'required',
              remarksKey: 'reason',
              remarksLabel: 'Reason',
            },
          ]
        }

        if (item.can?.start || item.status === 'approved') {
          return [
            { key: 'start', label: 'Start work', tone: 'primary', path: `/asset-requests/${id}/start`, remarks: 'optional' },
          ]
        }

        if (item.can?.resolve || item.status === 'in_progress') {
          return [
            {
              key: 'resolve',
              label: 'Mark resolved',
              tone: 'primary',
              path: `/asset-requests/${id}/resolve`,
              remarks: 'required',
              remarksKey: 'resolution',
              remarksLabel: 'What was done',
            },
          ]
        }

        return []
      }}
    />
  )
}
