import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function UsersScreen() {
  return (
    <ResourceList<Item>
      title="Users"
      endpoint="/users"
      searchPlaceholder="Search users"
      emptyTitle="No users"
      emptyMessage="Accounts will appear here."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: item.email,
        badge: item.roles?.[0]?.name,
        meta: item.status,
        search: (item.name ?? '') + ' ' + (item.email ?? ''),
      })}
    />
  )
}
