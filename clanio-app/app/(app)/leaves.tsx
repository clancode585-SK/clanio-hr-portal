import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function LeavesScreen() {
  return (
    <ResourceList<Item>
      title="Leave Requests"
      endpoint="/leaves"
      searchPlaceholder="Search by employee"
      emptyTitle="No leave requests"
      emptyMessage="Requests will appear here for approval."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.employee?.user?.name ?? 'Employee',
        subtitle: (item.from_date ?? '') + ' to ' + (item.to_date ?? ''),
        badge: item.leave_type?.code,
        meta: item.status,
        search: (item.employee?.user?.name ?? '') + ' ' + (item.status ?? ''),
      })}
    />
  )
}
