import { CrudList, type FieldSpec } from '@/components/CrudList'

type Item = Record<string, any>

const fields: FieldSpec[] = [
  { key: 'name', label: 'Name', type: 'text', placeholder: 'General Shift', autoCapitalize: 'words', required: true, max: 150 },
  { key: 'code', label: 'Code', type: 'text', placeholder: 'GEN', autoCapitalize: 'characters', required: true, max: 30, pattern: /^[A-Za-z0-9_-]+$/, patternMessage: 'Letters, numbers, dash and underscore only' },
  { key: 'start_time', label: 'Starts at', type: 'time', placeholder: '09:30', required: true },
  { key: 'end_time', label: 'Ends at', type: 'time', placeholder: '18:30', required: true },
  { key: 'weekly_offs', label: 'Weekly offs', type: 'days', required: true },
  { key: 'grace_minutes', label: 'Grace minutes', type: 'number', placeholder: '15', integer: true, min: 0, maxValue: 240 },
  { key: 'half_day_minutes', label: 'Half day after (minutes)', type: 'number', placeholder: '240', integer: true, min: 1, maxValue: 1440 },
  { key: 'full_day_minutes', label: 'Full day after (minutes)', type: 'number', placeholder: '480', integer: true, min: 1, maxValue: 1440 },
  { key: 'is_default', label: 'Default shift', type: 'toggle', hint: 'New employees get this one' },
]

export default function WorkShiftsScreen() {
  return (
    <CrudList<Item>
      title="Work Shifts"
      endpoint="/work-shifts"
      singular="shift"
      fields={fields}
      permissions={{ create: 'work_shift.create', edit: 'work_shift.edit', delete: 'work_shift.delete' }}
      searchPlaceholder="Search shifts"
      emptyTitle="No shifts"
      emptyMessage="A shift decides office hours, grace time and weekly offs."
      notice={{ title: 'Attendance depends on this', message: 'Late marks, half days and holidays are all calculated from the shift.' }}
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: `${String(item.start_time ?? '').slice(0, 5)} to ${String(item.end_time ?? '').slice(0, 5)}`,
        badge: item.code,
        meta: item.is_default ? 'Default' : undefined,
        search: `${item.name ?? ''} ${item.code ?? ''}`,
      })}
    />
  )
}
