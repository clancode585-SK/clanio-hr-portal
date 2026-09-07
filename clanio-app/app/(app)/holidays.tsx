import { CrudList, type FieldSpec } from '@/components/CrudList'
import { apiList } from '@/lib/api'
import type { Option } from '@/components/ui/Select'

type Item = Record<string, any>

const fields: FieldSpec[] = [
  { key: 'name', label: 'Name', type: 'text', placeholder: 'Diwali', autoCapitalize: 'words', required: true, max: 150 },
  { key: 'holiday_date', label: 'Date', type: 'date', placeholder: 'YYYY-MM-DD', required: true },
  {
    key: 'type',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'public', label: 'Public', hint: 'Office is closed' },
      { value: 'optional', label: 'Optional', hint: 'Employee may take it' },
      { value: 'restricted', label: 'Restricted', hint: 'Limited number per year' },
    ],
    placeholder: 'Public',
  },
  { key: 'branch_id', label: 'Branch', type: 'select', optionsKey: 'branches', placeholder: 'All branches', allowClear: true },
  { key: 'is_paid', label: 'Paid holiday', type: 'toggle', hint: 'Salary is not deducted' },
  { key: 'description', label: 'Description', type: 'text', placeholder: 'Optional', autoCapitalize: 'sentences', multiline: true, max: 500 },
]

async function loadOptions(): Promise<Record<string, Option[]>> {
  try {
    const branches = await apiList<Item>('/branches?per_page=100')

    return {
      branches: branches.data.map((row) => ({ value: String(row.id), label: row.name })),
    }
  } catch {
    return { branches: [] }
  }
}

export default function HolidaysScreen() {
  return (
    <CrudList<Item>
      title="Holidays"
      endpoint="/holidays"
      singular="holiday"
      fields={fields}
      loadOptions={loadOptions}
      defaults={{ type: 'public', is_paid: true }}
      permissions={{ create: 'holiday.create', edit: 'holiday.edit', delete: 'holiday.delete' }}
      searchPlaceholder="Search holidays"
      emptyTitle="No holidays"
      emptyMessage="Add the calendar so attendance does not mark these days absent."
      sort={(a, b) => String(a.holiday_date).localeCompare(String(b.holiday_date))}
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: item.branch?.name ?? 'All branches',
        badge: item.type,
        meta: item.holiday_date,
        search: `${item.name ?? ''} ${item.holiday_date ?? ''}`,
      })}
    />
  )
}
