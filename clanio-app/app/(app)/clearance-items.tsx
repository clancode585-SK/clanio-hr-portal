import { CrudList, type FieldSpec } from '@/components/CrudList'

type Item = Record<string, any>

const fields: FieldSpec[] = [
  {
    key: 'department',
    label: 'Who signs it off',
    type: 'select',
    options: [
      { value: 'it', label: 'IT', hint: 'Laptop, ID card, access' },
      { value: 'finance', label: 'Finance', hint: 'Advance, loan, dues' },
      { value: 'hr', label: 'HR', hint: 'Documents, exit interview' },
      { value: 'manager', label: 'Manager', hint: 'Handover and KT' },
    ],
    placeholder: 'Pick a desk',
    required: true,
  },
  { key: 'title', label: 'Item', type: 'text', placeholder: 'Return the laptop', autoCapitalize: 'sentences', required: true, max: 150 },
  { key: 'description', label: 'Description', type: 'text', placeholder: 'What exactly has to happen', autoCapitalize: 'sentences', multiline: true, max: 500 },
  { key: 'is_mandatory', label: 'Mandatory', type: 'toggle', hint: 'Exit cannot close until this is signed' },
  { key: 'is_recoverable', label: 'Money can be recovered', type: 'toggle', hint: 'A pending amount can be deducted' },
  { key: 'sort_order', label: 'Order', type: 'number', placeholder: '1', integer: true, min: 0, maxValue: 255 },
]

export default function ClearanceItemsScreen() {
  return (
    <CrudList<Item>
      title="Exit Checklist"
      endpoint="/clearance-items"
      singular="checklist item"
      fields={fields}
      defaults={{ is_mandatory: true }}
      permissions={{ create: 'clearance.manage', edit: 'clearance.manage', delete: 'clearance.manage' }}
      searchPlaceholder="Search checklist"
      emptyTitle="No checklist items"
      emptyMessage="These are the things every leaver has to settle."
      notice={{ title: 'Used on every exit', message: 'When someone resigns, this list becomes their clearance sheet.' }}
      sort={(a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)}
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.title,
        subtitle: item.description ?? undefined,
        badge: item.department,
        meta: item.is_mandatory ? 'Mandatory' : 'Optional',
        search: `${item.title ?? ''} ${item.department ?? ''}`,
      })}
    />
  )
}
