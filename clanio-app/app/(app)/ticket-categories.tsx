import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function TicketCategoriesScreen() {
  return (
    <ResourceList<Item>
      title="Ticket Categories"
      endpoint="/ticket-categories"
      searchPlaceholder="Search categories"
      emptyTitle="No categories"
      emptyMessage="Categories decide where a helpdesk ticket goes."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: (item.routes ?? []).map((route: Item) => route.label).join(' · ') || undefined,
        badge: item.scope,
        meta: item.default_priority,
        search: (item.name ?? '') + ' ' + (item.code ?? ''),
      })}
    />
  )
}
