import { CrudList, type FieldSpec } from '@/components/CrudList'

type Item = Record<string, any>

const fields: FieldSpec[] = [
  { key: 'name', label: 'Name', type: 'text', placeholder: 'Mumbai Office', autoCapitalize: 'words', required: true, max: 150 },
  { key: 'code', label: 'Code', type: 'text', placeholder: 'MUM', autoCapitalize: 'characters', required: true, max: 30, pattern: /^[A-Za-z0-9_-]+$/, patternMessage: 'Letters, numbers, dash and underscore only' },
  { key: 'address', label: 'Address', type: 'text', placeholder: 'Street, city, pin', autoCapitalize: 'sentences', multiline: true, max: 500 },
  { key: 'phone', label: 'Phone', type: 'text', placeholder: 'Optional', max: 20, pattern: /^[0-9+\-() ]{6,20}$/, patternMessage: 'Enter a valid phone number' },
  { key: 'email', label: 'Email', type: 'text', placeholder: 'Optional', max: 255, pattern: /^\S+@\S+\.\S+$/, patternMessage: 'Enter a valid email' },
  { key: 'is_head_office', label: 'Head office', type: 'toggle', hint: 'Only one branch should carry this' },
]

export default function BranchesScreen() {
  return (
    <CrudList<Item>
      title="Branches"
      endpoint="/branches"
      singular="branch"
      fields={fields}
      permissions={{ create: 'branch.create', edit: 'branch.edit', delete: 'branch.delete' }}
      searchPlaceholder="Search branches"
      emptyTitle="No branches"
      emptyMessage="Add an office location to get started."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: item.address ?? item.email ?? undefined,
        badge: item.code,
        meta: item.is_head_office ? 'Head office' : undefined,
        search: `${item.name ?? ''} ${item.code ?? ''}`,
      })}
    />
  )
}
