import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function RecognitionsScreen() {
  return (
    <ResourceList<Item>
      title="Recognition"
      endpoint="/recognitions"
      searchPlaceholder="Search recognition"
      emptyTitle="No recognition yet"
      emptyMessage="Appreciation given to people shows up here."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.title,
        subtitle: (item.employee_name ?? '') + ' · by ' + (item.given_by_name ?? 'System'),
        badge: item.type_label ?? item.type,
        meta: item.points != null ? item.points + ' pts' : undefined,
        search: (item.title ?? '') + ' ' + (item.employee_name ?? ''),
      })}
    />
  )
}
