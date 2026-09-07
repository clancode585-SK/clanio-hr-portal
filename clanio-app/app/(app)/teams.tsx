import { CrudList, type FieldSpec } from '@/components/CrudList'
import { apiList } from '@/lib/api'
import type { Option } from '@/components/ui/Select'

type Item = Record<string, any>

const fields: FieldSpec[] = [
  { key: 'name', label: 'Name', type: 'text', placeholder: 'Backend Squad', autoCapitalize: 'words', required: true, max: 150 },
  { key: 'code', label: 'Code', type: 'text', placeholder: 'BE', autoCapitalize: 'characters', required: true, max: 30, pattern: /^[A-Za-z0-9_-]+$/, patternMessage: 'Letters, numbers, dash and underscore only' },
  { key: 'department_id', label: 'Department', type: 'select', optionsKey: 'departments', placeholder: 'Which department', required: true },
  { key: 'description', label: 'Description', type: 'text', placeholder: 'What this team owns', autoCapitalize: 'sentences', multiline: true, max: 500 },
]

async function loadOptions(): Promise<Record<string, Option[]>> {
  const departments = await apiList<Item>('/departments?per_page=100')

  return {
    departments: departments.data.map((row) => ({ value: String(row.id), label: row.name })),
  }
}

export default function TeamsScreen() {
  return (
    <CrudList<Item>
      title="Teams"
      endpoint="/teams"
      singular="team"
      fields={fields}
      loadOptions={loadOptions}
      permissions={{ create: 'team.create', edit: 'team.edit', delete: 'team.delete' }}
      searchPlaceholder="Search teams"
      emptyTitle="No teams"
      emptyMessage="Teams sit inside a department and hold the members."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: item.department?.name ?? item.description ?? undefined,
        badge: item.code,
        meta: item.member_count != null ? `${item.member_count} members` : undefined,
        search: `${item.name ?? ''} ${item.code ?? ''} ${item.department?.name ?? ''}`,
      })}
    />
  )
}
