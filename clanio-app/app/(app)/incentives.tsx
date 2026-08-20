import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function IncentivesScreen() {
  return (
    <ResourceList<Item>
      title="Incentives"
      endpoint="/incentives"
      searchPlaceholder="Search by employee"
      emptyTitle="No incentives"
      emptyMessage="Calculated payouts will appear here."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.employee_name ?? 'Employee',
        subtitle: (item.period_label ?? '') + ' · ' + (item.slab_label ?? ''),
        badge: item.incentive_percent != null ? item.incentive_percent + '%' : undefined,
        meta: item.status,
        search: (item.employee_name ?? '') + ' ' + (item.period_label ?? ''),
      })}
    />
  )
}
