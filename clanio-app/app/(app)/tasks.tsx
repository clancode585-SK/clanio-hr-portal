import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function TasksScreen() {
  return (
    <ResourceList<Item>
      title="Tasks"
      endpoint="/tasks"
      searchPlaceholder="Search tasks"
      emptyTitle="No tasks yet"
      emptyMessage="Assigned work will appear here."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.title,
        subtitle: item.due_date ? 'Due ' + item.due_date : undefined,
        badge: item.priority,
        meta: item.status,
        search: (item.title ?? '') + ' ' + (item.status ?? ''),
      })}
    />
  )
}
