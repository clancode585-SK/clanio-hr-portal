import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function AttendanceScreen() {
  return (
    <ResourceList<Item>
      title="Attendance Log"
      endpoint="/attendance"
      searchPlaceholder="Search by employee"
      emptyTitle="No attendance yet"
      emptyMessage="Punches will appear here as people check in."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.employee_name ?? item.employee?.user?.name ?? 'Employee',
        subtitle: item.attendance_date,
        badge: item.status,
        meta: item.worked_human ?? undefined,
        search: item.employee_name ?? '',
      })}
    />
  )
}
