import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function BranchesScreen() {
  return (
    <ResourceList<Item>
      title="Branches"
      endpoint="/branches"
      searchPlaceholder="Search branches"
      emptyTitle="No branches"
      emptyMessage="Add an office location to get started."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: item.address ?? item.email ?? undefined,
        badge: item.code,
        meta: item.is_head_office ? 'Head office' : undefined,
        search: (item.name ?? '') + ' ' + (item.code ?? ''),
      })}
    />
  )
}
