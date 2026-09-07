import { NeedsBackend } from '@/components/NeedsBackend'

export default function BillingScreen() {
  return (
    <NeedsBackend
      title="Billing Settings"
      subtitle="Not built yet"
      summary="Invoices, taxes and payment settings have no tables or API yet. This is the shape they need."
      table={{
        name: 'billing_settings + invoices',
        columns: [
          'company_id',
          'plan_id',
          'seats_billed',
          'billing_cycle',
          'next_invoice_on',
          'gst_percent',
          'gstin',
          'billing_email',
          'billing_address',
          'payment_method',
          'invoice_no',
          'period_start',
          'period_end',
          'subtotal',
          'tax',
          'total',
          'status',
          'paid_at',
        ],
      }}
      endpoints={[
        'GET  billing-settings',
        'PUT  billing-settings',
        'GET  companies/{company}/billing',
        'PUT  companies/{company}/billing',
        'GET  invoices',
        'POST invoices/generate',
        'PUT  invoices/{invoice}/mark-paid',
      ]}
      screenPlan={[
        'Set the tax percent, invoice prefix and billing email once for the platform.',
        'Per company: which plan, how many seats billed, when the next invoice goes out.',
        'Generate invoices for a period and mark them paid.',
        'Flag companies whose invoice is overdue.',
        'Feed the real numbers into the Revenue screen instead of a typed rate.',
      ]}
    />
  )
}
