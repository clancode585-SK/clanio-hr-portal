import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function ExitsScreen() {
  return (
    <ResourceList<Item>
      title="Resignations"
      endpoint="/exits"
      searchPlaceholder="Search by employee"
      emptyTitle="No resignations"
      emptyMessage="Exit requests will appear here."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.employee_name ?? 'Employee',
        subtitle: item.last_working_date ? 'Last day ' + item.last_working_date : item.exit_type_label,
        badge: item.employee_code,
        meta: item.status,
        search: (item.employee_name ?? '') + ' ' + (item.status ?? ''),
      })}
    />
  )
}
