import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function TeamsScreen() {
  return (
    <ResourceList<Item>
      title="Teams"
      endpoint="/teams"
      searchPlaceholder="Search teams"
      emptyTitle="No teams"
      emptyMessage="Teams sit inside departments."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: item.department?.name,
        badge: item.code,
        meta: (item.users_count ?? 0) + ' members',
        search: (item.name ?? '') + ' ' + (item.code ?? ''),
      })}
    />
  )
}
