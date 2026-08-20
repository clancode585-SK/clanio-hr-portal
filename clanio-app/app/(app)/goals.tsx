import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function GoalsScreen() {
  return (
    <ResourceList<Item>
      title="Goals & OKR"
      endpoint="/goals"
      searchPlaceholder="Search goals"
      emptyTitle="No goals"
      emptyMessage="Goals and OKRs will appear here."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.title,
        subtitle: (item.employee_name ?? '') + ' · ' + (item.period_label ?? ''),
        badge: item.goal_type,
        meta: item.progress_percent != null ? item.progress_percent + '%' : item.status,
        search: (item.title ?? '') + ' ' + (item.employee_name ?? ''),
      })}
    />
  )
}
