import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function TicketsScreen() {
  return (
    <ResourceList<Item>
      title="Helpdesk"
      endpoint="/tickets"
      searchPlaceholder="Search tickets"
      emptyTitle="No tickets"
      emptyMessage="Support requests will appear here."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.subject,
        subtitle: (item.raiser?.name ?? '') + ' · ' + (item.category?.name ?? ''),
        badge: item.ticket_no,
        meta: item.status,
        search: (item.subject ?? '') + ' ' + (item.ticket_no ?? ''),
      })}
    />
  )
}
