import { CrudList, type FieldSpec } from '@/components/CrudList'
import { apiList } from '@/lib/api'
import type { Option } from '@/components/ui/Select'

type Item = Record<string, any>

const fields: FieldSpec[] = [
  { key: 'employee_id', label: 'Who deserves it', type: 'select', optionsKey: 'employees', placeholder: 'Pick a colleague', required: true },
  { key: 'title', label: 'Headline', type: 'text', placeholder: 'Saved the release weekend', autoCapitalize: 'sentences', required: true, max: 200 },
  {
    key: 'type',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'kudos', label: 'Kudos', hint: 'A simple thank you' },
      { value: 'badge', label: 'Badge', hint: 'Earned recognition' },
      { value: 'spot_award', label: 'Spot award', hint: 'Carries points' },
    ],
    placeholder: 'Kudos',
  },
  { key: 'message', label: 'Message', type: 'text', placeholder: 'What exactly did they do', autoCapitalize: 'sentences', multiline: true, max: 1000 },
  { key: 'points', label: 'Points', type: 'number', placeholder: '50', integer: true, min: 0, maxValue: 10000 },
  {
    key: 'visibility',
    label: 'Visibility',
    type: 'select',
    options: [
      { value: 'public', label: 'Everyone can see' },
      { value: 'private', label: 'Only they can see' },
    ],
    placeholder: 'Everyone can see',
  },
  { key: 'awarded_on', label: 'Awarded on', type: 'date', placeholder: 'YYYY-MM-DD' },
]

async function loadOptions(): Promise<Record<string, Option[]>> {
  try {
    const employees = await apiList<Item>('/employees?per_page=200')

    return {
      employees: employees.data.map((row) => ({
        value: String(row.id),
        label: row.user?.name ?? row.name ?? `Employee ${row.id}`,
        hint: row.designation?.name ?? undefined,
      })),
    }
  } catch {
    return { employees: [] }
  }
}

export default function RecognitionsScreen() {
  return (
    <CrudList<Item>
      title="Recognition"
      endpoint="/recognitions"
      singular="recognition"
      fields={fields}
      loadOptions={loadOptions}
      allowUpdate={false}
      defaults={{ type: 'kudos', visibility: 'public' }}
      permissions={{ create: 'recognition.give', edit: 'recognition.give', delete: 'recognition.give' }}
      searchPlaceholder="Search recognition"
      emptyTitle="Nobody recognised yet"
      emptyMessage="Call out good work while people still remember it."
      notice={{ title: 'Send only, no edits', message: 'Once given, a recognition can be removed but not rewritten.' }}
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.title,
        subtitle: [item.employee?.user?.name ?? item.employee?.name, item.giver?.name].filter(Boolean).join(' from '),
        badge: item.type,
        meta: item.points ? `${item.points} pts` : undefined,
        search: `${item.title ?? ''} ${item.employee?.user?.name ?? ''}`,
      })}
    />
  )
}
