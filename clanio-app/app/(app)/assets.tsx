import { CrudList, type FieldSpec, type RowAction, type SheetExtra } from '@/components/CrudList'
import { apiList } from '@/lib/api'
import type { Option } from '@/components/ui/Select'

type Item = Record<string, any>

const conditions: Option[] = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'damaged', label: 'Damaged' },
]

const fields: FieldSpec[] = [
  { key: 'name', label: 'Name', type: 'text', placeholder: 'MacBook Air M2', autoCapitalize: 'words', required: true, max: 150 },
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'laptop', label: 'Laptop' },
      { value: 'desktop', label: 'Desktop' },
      { value: 'monitor', label: 'Monitor' },
      { value: 'mobile', label: 'Mobile' },
      { value: 'sim', label: 'SIM card' },
      { value: 'headset', label: 'Headset' },
      { value: 'keyboard', label: 'Keyboard / Mouse' },
      { value: 'id_card', label: 'ID card' },
      { value: 'access_card', label: 'Access card' },
      { value: 'other', label: 'Other' },
    ],
    placeholder: 'What kind of asset',
    required: true,
  },
  { key: 'asset_code', label: 'Asset code', type: 'text', placeholder: 'Auto generated if blank', autoCapitalize: 'characters', max: 30, pattern: /^[A-Za-z0-9_-]+$/, patternMessage: 'Letters, numbers, dash and underscore only' },
  { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Apple', autoCapitalize: 'words', max: 80 },
  { key: 'model', label: 'Model', type: 'text', placeholder: 'A2681', autoCapitalize: 'characters', max: 80 },
  { key: 'serial_number', label: 'Serial number', type: 'text', placeholder: 'Unique per company', autoCapitalize: 'characters', max: 100 },
  { key: 'purchase_date', label: 'Bought on', type: 'date', placeholder: 'YYYY-MM-DD' },
  { key: 'purchase_cost', label: 'Cost', type: 'number', placeholder: '95000', min: 0 },
  { key: 'warranty_expiry', label: 'Warranty till', type: 'date', placeholder: 'YYYY-MM-DD', afterKey: 'purchase_date', afterMessage: 'Warranty cannot end before the purchase date' },
  { key: 'condition_state', label: 'Condition', type: 'select', options: conditions, placeholder: 'Good' },
  { key: 'notes', label: 'Notes', type: 'text', placeholder: 'Optional', autoCapitalize: 'sentences', multiline: true, max: 500 },
]

const rowActions: RowAction<Item>[] = [
  {
    key: 'allocate',
    label: 'Give to an employee',
    promptTitle: 'Allocate this asset',
    confirmLabel: 'Allocate',
    method: 'POST',
    tone: 'primary',
    permission: 'asset.manage',
    path: (item) => `/assets/${item.uuid ?? item.id}/allocate`,
    visible: (item) => item.status === 'available',
    prompt: [
      { key: 'employee_id', label: 'Employee', type: 'select', optionsKey: 'employees', placeholder: 'Who gets it', required: true },
      { key: 'allocated_on', label: 'Given on', type: 'date', placeholder: 'YYYY-MM-DD' },
      { key: 'expected_return_date', label: 'Expected back on', type: 'date', placeholder: 'Optional' },
      { key: 'condition', label: 'Condition handed over', type: 'select', options: conditions, placeholder: 'Good' },
      { key: 'remarks', label: 'Remarks', type: 'text', placeholder: 'Optional', autoCapitalize: 'sentences', multiline: true },
    ],
  },
  {
    key: 'return',
    label: 'Take it back',
    promptTitle: 'Return this asset',
    confirmLabel: 'Mark returned',
    method: 'PUT',
    permission: 'asset.manage',
    path: (item) => `/assets/${item.uuid ?? item.id}/return`,
    visible: (item) => item.status === 'allocated',
    prompt: [
      { key: 'returned_on', label: 'Returned on', type: 'date', placeholder: 'YYYY-MM-DD' },
      { key: 'condition', label: 'Condition it came back in', type: 'select', options: conditions, placeholder: 'Good' },
      { key: 'recoverable_amount', label: 'Amount to recover', type: 'number', placeholder: 'If damaged' },
      { key: 'remarks', label: 'Remarks', type: 'text', placeholder: 'Optional', autoCapitalize: 'sentences', multiline: true },
    ],
  },
  {
    key: 'retire',
    label: 'Retire or write off',
    promptTitle: 'Retire this asset',
    confirmLabel: 'Retire',
    method: 'PUT',
    tone: 'danger',
    permission: 'asset.manage',
    path: (item) => `/assets/${item.uuid ?? item.id}/retire`,
    visible: (item) => !['retired', 'lost'].includes(item.status),
    prompt: [
      {
        key: 'status',
        label: 'What happened',
        type: 'select',
        options: [
          { value: 'retired', label: 'Retired', hint: 'End of life' },
          { value: 'lost', label: 'Lost', hint: 'Cannot be traced' },
        ],
        placeholder: 'Retired',
      },
      { key: 'notes', label: 'Notes', type: 'text', placeholder: 'Why', autoCapitalize: 'sentences', multiline: true, max: 500 },
    ],
  },
]

async function loadOptions(): Promise<Record<string, Option[]>> {
  try {
    const employees = await apiList<Item>('/employees?per_page=200')

    return {
      employees: employees.data.map((row) => ({
        value: String(row.id),
        label: row.user?.name ?? row.name ?? `Employee ${row.id}`,
        hint: row.employee_code ?? undefined,
      })),
    }
  } catch {
    return { employees: [] }
  }
}

const history: SheetExtra<Item> = {
  title: 'Who has held this',
  path: (item) => `/assets/${item.uuid ?? item.id}/history`,
  empty: 'It has never been given out.',
  toRows: (rows: Item[]) =>
    (rows ?? []).map((row) => ({
      key: String(row.uuid ?? row.id),
      title: row.employee_name ?? 'Someone',
      subtitle: [row.allocated_on, row.returned_on ? `returned ${row.returned_on}` : 'still with them']
        .filter(Boolean)
        .join(' · '),
      meta: row.allocation_condition ?? row.status ?? undefined,
    })),
}

export default function AssetsScreen() {
  return (
    <CrudList<Item>
      title="IT Assets"
      endpoint="/assets"
      singular="asset"
      fields={fields}
      rowActions={rowActions}
      loadOptions={loadOptions}
      sheetExtra={history}
      defaults={{ condition_state: 'good' }}
      permissions={{ create: 'asset.manage', edit: 'asset.manage', delete: 'asset.manage' }}
      searchPlaceholder="Search assets"
      emptyTitle="No assets"
      emptyMessage="Laptops, SIM cards and access cards live here."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: [item.brand, item.model, item.holder?.name].filter(Boolean).join(' · ') || item.category,
        badge: item.asset_code,
        meta: item.status,
        search: `${item.name ?? ''} ${item.asset_code ?? ''} ${item.serial_number ?? ''}`,
      })}
    />
  )
}
