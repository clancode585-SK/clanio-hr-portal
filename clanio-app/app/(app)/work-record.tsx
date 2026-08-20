import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function WorkRecordScreen() {
  return (
    <ResourceList<Item>
      title="Work Record"
      endpoint="/work-record/team"
      searchPlaceholder="Search by employee"
      emptyTitle="No records yet"
      emptyMessage="Monthly scores appear once there is activity."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.employee?.name ?? 'Employee',
        subtitle: item.month,
        badge: item.employee?.employee_code,
        meta: item.score != null ? item.score + '%' : undefined,
        search: item.employee?.name ?? '',
      })}
    />
  )
}
