import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function DailyReportsScreen() {
  return (
    <ResourceList<Item>
      title="Daily Reports"
      endpoint="/daily-reports"
      searchPlaceholder="Search by employee"
      emptyTitle="No reports yet"
      emptyMessage="SOD and EOD submissions will show up here."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.employee_name ?? 'Employee',
        subtitle: item.report_date,
        badge: item.employee_code,
        meta: item.status,
        search: item.employee_name ?? '',
      })}
    />
  )
}
