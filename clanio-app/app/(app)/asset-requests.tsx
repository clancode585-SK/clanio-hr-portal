import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function AssetRequestsScreen() {
  return (
    <ResourceList<Item>
      title="Asset Requests"
      endpoint="/asset-requests"
      searchPlaceholder="Search requests"
      emptyTitle="No asset requests"
      emptyMessage="Repair and new asset requests appear here."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.title,
        subtitle: (item.employee_name ?? '') + ' · ' + (item.request_type_label ?? ''),
        badge: item.priority,
        meta: item.status,
        search: (item.title ?? '') + ' ' + (item.employee_name ?? ''),
      })}
    />
  )
}
