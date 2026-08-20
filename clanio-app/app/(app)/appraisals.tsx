import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function AppraisalsScreen() {
  return (
    <ResourceList<Item>
      title="Appraisals"
      endpoint="/appraisals"
      searchPlaceholder="Search by employee"
      emptyTitle="No appraisals"
      emptyMessage="Reviews appear once a cycle is launched."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.employee_name ?? 'Employee',
        subtitle: (item.cycle_name ?? '') + ' · ' + (item.stage ?? ''),
        badge: item.employee_code,
        meta: item.status,
        search: (item.employee_name ?? '') + ' ' + (item.cycle_name ?? ''),
      })}
    />
  )
}
