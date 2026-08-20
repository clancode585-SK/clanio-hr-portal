import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function LeaveTypesScreen() {
  return (
    <ResourceList<Item>
      title="Leave Types"
      endpoint="/leave-types"
      searchPlaceholder="Search leave types"
      emptyTitle="No leave types"
      emptyMessage="Define the kinds of leave people can apply for."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: item.description ?? undefined,
        badge: item.code,
        meta: item.annual_quota != null ? item.annual_quota + ' days' : undefined,
        search: (item.name ?? '') + ' ' + (item.code ?? ''),
      })}
    />
  )
}
