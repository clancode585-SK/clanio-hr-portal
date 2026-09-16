import { CrudList, type FieldSpec, type SheetExtra } from '@/components/CrudList'

type Item = Record<string, any>

const fields: FieldSpec[] = [
  { key: 'name', label: 'Name', type: 'text', placeholder: 'Priority', autoCapitalize: 'words', required: true, max: 60 },
  {
    key: 'code',
    label: 'Code',
    type: 'text',
    placeholder: 'priority',
    required: true,
    max: 30,
    pattern: /^[A-Za-z0-9_-]+$/,
    patternMessage: 'Letters, numbers, dash and underscore only',
  },
  { key: 'tagline', label: 'One line pitch', type: 'text', placeholder: 'Running HR properly, with approvals', autoCapitalize: 'sentences', max: 150 },
  { key: 'price_per_seat', label: 'Per seat, per month', type: 'number', placeholder: '179', required: true, min: 0, maxValue: 99999 },
  { key: 'gst_percent', label: 'GST percent', type: 'number', placeholder: '18', min: 0, maxValue: 50 },
  { key: 'min_seats', label: 'Seats from', type: 'number', placeholder: '10', integer: true, min: 1, maxValue: 10000 },
  { key: 'max_seats', label: 'Seats up to', type: 'number', placeholder: '100', integer: true, min: 1, maxValue: 10000 },
  { key: 'trial_days', label: 'Free trial days', type: 'number', placeholder: '0', integer: true, min: 0, maxValue: 90 },
  {
    key: 'billing_cycle',
    label: 'Billed',
    type: 'select',
    options: [
      { value: 'monthly', label: 'Every month' },
      { value: 'yearly', label: 'Every year' },
    ],
    placeholder: 'Every month',
  },
  {
    key: 'highlights',
    label: 'What they get',
    type: 'text',
    placeholder: 'Attendance and leave|Employee records|Helpdesk',
    hint: 'Separate each line with a pipe',
    autoCapitalize: 'sentences',
    multiline: true,
    max: 500,
  },
  { key: 'is_popular', label: 'Show as most picked', type: 'toggle' },
  { key: 'sort_order', label: 'Order', type: 'number', placeholder: '1', integer: true, min: 0, maxValue: 999 },
]

const onThisPlan: SheetExtra<Item> = {
  title: 'What a company pays',
  path: (item) => `/plans/${item.uuid ?? item.id}?seats=${item.min_seats ?? 10}`,
  empty: 'Set a rate to see the maths.',
  toRows: (data: Item) => {
    const p = data?.pricing

    if (!p) {
      return []
    }

    return [
      { key: 'seats', title: `${p.seats} seats`, subtitle: `at ₹${p.price_per_seat} each`, meta: `₹${p.subtotal}` },
      { key: 'gst', title: `GST ${p.gst_percent}%`, meta: `₹${p.gst}` },
      { key: 'total', title: 'Total per month', subtitle: `${data.company_count ?? 0} companies on this plan`, meta: `₹${p.total}` },
    ]
  },
}

export default function PlansScreen() {
  return (
    <CrudList<Item>
      title="Plans"
      endpoint="/plans"
      singular="plan"
      fields={fields}
      sheetExtra={onThisPlan}
      defaults={{ billing_cycle: 'monthly', gst_percent: '18', min_seats: '10', max_seats: '100' }}
      toForm={(item) => ({
        ...item,
        highlights: Array.isArray(item.highlights) ? item.highlights.join('|') : (item.highlights ?? ''),
      })}
      searchPlaceholder="Search plans"
      emptyTitle="No plans yet"
      emptyMessage="Add the tiers you want to sell."
      notice={{
        title: 'Change a price any time',
        message: 'Rates live in the database now, so a new price takes effect straight away — no app update needed.',
      }}
      sort={(a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)}
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: `${item.min_seats}–${item.max_seats} seats · ${item.company_count ?? 0} companies`,
        badge: `₹${item.price_per_seat}`,
        meta: item.is_popular ? 'Most picked' : undefined,
        search: `${item.name ?? ''} ${item.code ?? ''}`,
      })}
    />
  )
}
