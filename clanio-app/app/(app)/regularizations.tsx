import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function RegularizationsScreen() {
  return (
    <ResourceList<Item>
      title="Regularizations"
      endpoint="/regularizations"
      searchPlaceholder="Search by employee"
      emptyTitle="No requests"
      emptyMessage="Attendance corrections will appear here."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.employee_name ?? 'Employee',
        subtitle: (item.type_label ?? '') + ' · ' + (item.attendance_date ?? ''),
        badge: item.employee_code,
        meta: item.status,
        search: (item.employee_name ?? '') + ' ' + (item.status ?? ''),
      })}
    />
  )
}
