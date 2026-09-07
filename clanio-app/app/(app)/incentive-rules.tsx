import { CrudList, type FieldSpec } from '@/components/CrudList'
import { apiList } from '@/lib/api'
import type { Option } from '@/components/ui/Select'

type Item = Record<string, any>

const fields: FieldSpec[] = [
  { key: 'name', label: 'Name', type: 'text', placeholder: 'Sales incentive', autoCapitalize: 'words', required: true, max: 100 },
  { key: 'base_percent', label: 'Base percent', type: 'number', placeholder: '10', required: true, min: 0, maxValue: 100 },
  { key: 'role_id', label: 'Applies to role', type: 'select', optionsKey: 'roles', placeholder: 'Everyone', allowClear: true },
  {
    key: 'period_type',
    label: 'Measured over',
    type: 'select',
    options: [
      { value: 'week', label: 'Week' },
      { value: 'fortnight', label: 'Fortnight' },
      { value: 'month', label: 'Month' },
      { value: 'quarter', label: 'Quarter' },
      { value: 'annual', label: 'Year' },
    ],
    placeholder: 'Month',
  },
  { key: 'description', label: 'Description', type: 'text', placeholder: 'How this payout works', autoCapitalize: 'sentences', multiline: true, max: 500 },
]

async function loadOptions(): Promise<Record<string, Option[]>> {
  try {
    const roles = await apiList<Item>('/roles?per_page=100')

    return {
      roles: roles.data.map((row) => ({ value: String(row.id), label: row.name })),
    }
  } catch {
    return { roles: [] }
  }
}

export default function IncentiveRulesScreen() {
  return (
    <CrudList<Item>
      title="Incentive Rules"
      endpoint="/incentive-rules"
      singular="rule"
      fields={fields}
      loadOptions={loadOptions}
      defaults={{ period_type: 'month' }}
      permissions={{ create: 'incentive.manage', edit: 'incentive.manage', delete: 'incentive.manage' }}
      searchPlaceholder="Search rules"
      emptyTitle="No incentive rules"
      emptyMessage="A rule decides the base percent and the payout slabs."
      notice={{ title: 'One rule per role and period', message: 'A role can have only one rule for the same period. Slab tables are edited on the web portal.' }}
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: [item.role?.name ?? 'Everyone', item.period_type].filter(Boolean).join(' · '),
        badge: item.base_percent != null ? `${item.base_percent}%` : undefined,
        meta: item.slabs?.length ? `${item.slabs.length} slabs` : undefined,
        search: `${item.name ?? ''} ${item.role?.name ?? ''}`,
      })}
    />
  )
}
