import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function LeaveBalancesScreen() {
  return (
    <ResourceList<Item>
      title="Leave Balances"
      endpoint="/leave-balances"
      searchPlaceholder="Search by employee"
      emptyTitle="No balances"
      emptyMessage="Balances appear once leave types are set up."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.employee?.user?.name ?? 'Employee',
        subtitle: (item.leave_type?.name ?? '') + ' · ' + (item.year ?? ''),
        badge: item.leave_type?.code,
        meta: (item.available ?? 0) + ' left',
        search: (item.employee?.user?.name ?? '') + ' ' + (item.leave_type?.name ?? ''),
      })}
    />
  )
}
