import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function PoliciesScreen() {
  return (
    <ResourceList<Item>
      title="Policies"
      endpoint="/policies"
      searchPlaceholder="Search policies"
      emptyTitle="No policies"
      emptyMessage="Publish policies for people to accept."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.title,
        subtitle: (item.category_label ?? '') + ' · v' + (item.version ?? ''),
        badge: item.status,
        meta: (item.acknowledgement_count ?? 0) + ' accepted',
        search: (item.title ?? '') + ' ' + (item.category ?? ''),
      })}
    />
  )
}
