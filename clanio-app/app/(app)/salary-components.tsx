import { CrudList, type FieldSpec, type RowAction, type ScreenAction } from '@/components/CrudList'
import { Money } from '@/lib/money'

type Item = Record<string, any>

const kinds = [
  { value: 'earning', label: 'Earning', hint: 'Gross me judta hai' },
  { value: 'deduction', label: 'Deduction', hint: 'Net se katta hai' },
  { value: 'employer_cost', label: 'Employer cost', hint: 'Net se nahi katta, company deti hai' },
]

const calculations = [
  { value: 'fixed', label: 'Fixed amount', hint: 'Jo value do wahi amount' },
  { value: 'percent_of_basic', label: 'Percent of Basic', hint: 'Basic ka itna percent' },
  { value: 'percent_of_gross', label: 'Percent of gross', hint: 'Monthly gross ka itna percent' },
  { value: 'balance', label: 'Balance', hint: 'Gross me jo bacha, wo isme — ek hi component aisa ho sakta hai' },
]

const fields: FieldSpec[] = [
  {
    key: 'code',
    label: 'Code',
    type: 'text',
    placeholder: 'HRA',
    required: true,
    max: 30,
    autoCapitalize: 'characters',
    lockOnEdit: true,
    hint: 'Short code — payslip aur report me yahi use hota hai',
    pattern: /^[A-Za-z0-9_-]+$/,
    patternMessage: 'Sirf letter, number, dash aur underscore',
  },
  { key: 'name', label: 'Name', type: 'text', placeholder: 'House Rent Allowance', required: true, max: 100, autoCapitalize: 'words' },
  { key: 'kind', label: 'What is it', type: 'select', options: kinds, required: true },
  { key: 'calculation', label: 'How to work it out', type: 'select', options: calculations, required: true },
  {
    key: 'default_value',
    label: 'Default value',
    type: 'number',
    placeholder: '40',
    min: 0,
    hint: 'Percent wale me percent, fixed wale me rupaye. Structure banate waqt badal sakte ho',
  },
  { key: 'sequence', label: 'Order on the payslip', type: 'number', placeholder: '20', min: 1, integer: true },
  { key: 'is_taxable', label: 'Taxable', type: 'toggle' },
  { key: 'note', label: 'Note for HR', type: 'text', placeholder: 'Optional', max: 255, multiline: true },
]

const screenActions: ScreenAction[] = [
  {
    label: 'Standard setup',
    title: 'Create the 11 usual Indian components? Already made ones stay as they are.',
    confirmLabel: 'Create them',
    path: '/salary-components/standard',
    method: 'POST',
    prompt: [],
    permission: 'salary_component.manage',
  },
]

const rowActions: RowAction<Item>[] = [
  {
    key: 'archive',
    label: 'Remove this component',
    method: 'DELETE',
    tone: 'danger',
    path: (item) => `/salary-components/${item.uuid}`,
    permission: 'salary_component.manage',
    confirmLabel: 'Remove',
  },
]

export default function SalaryComponentsScreen() {
  return (
    <CrudList<Item>
      title="Salary Components"
      singular="component"
      endpoint="/salary-components"
      fields={fields}
      permissions={{
        create: 'salary_component.manage',
        edit: 'salary_component.manage',
        delete: 'salary_component.manage',
      }}
      searchPlaceholder="Search by name or code"
      emptyTitle="No components yet"
      emptyMessage="Tap Standard setup to get the usual Indian set in one go, then change what you need."
      notice={{
        title: 'These build every salary',
        message:
          'Basic hona zaroori hai — PF usi par nikalta hai. Ek component "balance" rakho taaki gross me jo bacha wo kahin chala jaaye.',
      }}
      sort={(a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || String(a.code).localeCompare(String(b.code))}
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: describe(item),
        badge: item.code,
        meta: item.kind_label,
        search: `${item.name ?? ''} ${item.code ?? ''}`,
      })}
      toForm={(item) => ({
        code: item.code ?? '',
        name: item.name ?? '',
        kind: item.kind ?? 'earning',
        calculation: item.calculation ?? 'fixed',
        default_value: String(item.default_value ?? 0),
        sequence: String(item.sequence ?? 100),
        is_taxable: item.is_taxable ?? true,
        note: item.note ?? '',
      })}
      defaults={{ kind: 'earning', calculation: 'fixed', is_taxable: true, sequence: '100' }}
      screenActions={screenActions}
      rowActions={rowActions}
    />
  )
}

function describe(item: Item): string {
  const value = Number(item.default_value ?? 0)

  const how =
    item.calculation === 'percent_of_basic'
      ? `${value}% of Basic`
      : item.calculation === 'percent_of_gross'
        ? `${value}% of gross`
        : item.calculation === 'balance'
          ? 'Whatever is left in the gross'
          : value > 0
            ? `₹${Money.indian(value)} a month`
            : 'Worked out at payroll time'

  return item.is_statutory ? `${how} · statutory` : how
}
