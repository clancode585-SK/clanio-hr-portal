import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function HolidaysScreen() {
  return (
    <ResourceList<Item>
      title="Holidays"
      endpoint="/holidays"
      searchPlaceholder="Search holidays"
      emptyTitle="No holidays"
      emptyMessage="Add the company holiday calendar."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: (item.holiday_date ?? '') + ' · ' + (item.day ?? ''),
        badge: item.type,
        meta: item.branch?.name ?? 'All branches',
        search: (item.name ?? '') + ' ' + (item.holiday_date ?? ''),
      })}
    />
  )
}
