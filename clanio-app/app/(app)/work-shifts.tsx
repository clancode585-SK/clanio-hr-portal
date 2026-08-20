import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function WorkShiftsScreen() {
  return (
    <ResourceList<Item>
      title="Work Shifts"
      endpoint="/work-shifts"
      searchPlaceholder="Search shifts"
      emptyTitle="No shifts"
      emptyMessage="A shift defines office hours and weekly offs."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: (item.start_time ?? '').slice(0, 5) + ' - ' + (item.end_time ?? '').slice(0, 5),
        badge: item.code,
        meta: item.is_default ? 'Default' : undefined,
        search: (item.name ?? '') + ' ' + (item.code ?? ''),
      })}
    />
  )
}
