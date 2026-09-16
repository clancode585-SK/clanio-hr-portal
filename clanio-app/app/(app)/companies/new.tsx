import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Select, type Option } from '@/components/ui/Select'
import { Stepper } from '@/components/ui/Stepper'
import { api, ApiError } from '@/lib/api'
import { loadPlans, money, priceOrder, type Plan } from '@/lib/plans'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/theme/useTheme'
import { font, spacing } from '@/theme/tokens'

type Values = Record<string, string>

const steps = ['Company', 'Statutory', 'Admin', 'Plan', 'Payment']

const currencies: Option[] = [
  { value: 'INR', label: 'Indian Rupee (INR)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'AED', label: 'UAE Dirham (AED)' },
  { value: 'GBP', label: 'Pound Sterling (GBP)' },
]

const fiscalMonths: Option[] = [
  { value: '1', label: 'January' },
  { value: '4', label: 'April' },
  { value: '7', label: 'July' },
  { value: '10', label: 'October' },
]

const emailPattern = /^\S+@\S+\.\S+$/
const slugPattern = /^[A-Za-z0-9_-]+$/
const gstinPattern = /^[0-9A-Z]{15}$/
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const tanPattern = /^[A-Z]{4}[0-9]{5}[A-Z]$/

const stepOf: Record<string, number> = {
  name: 0,
  legal_name: 0,
  slug: 0,
  email: 0,
  phone: 0,
  website: 0,
  address: 0,
  city: 0,
  state: 0,
  country: 0,
  pincode: 0,
  gstin: 1,
  pan_number: 1,
  tan_number: 1,
  cin_number: 1,
  industry: 1,
  currency: 1,
  fiscal_year_start: 1,
  timezone: 1,
  admin: 2,
  'admin.name': 2,
  'admin.email': 2,
  'admin.phone': 2,
  'admin.password': 2,
  plan: 3,
  seats: 3,
  max_employees: 3,
}

export default function CompanyCreateScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { isSuperAdmin } = useAuth()

  const [step, setStep] = useState(0)
  const [paid, setPaid] = useState(false)
  const [reference, setReference] = useState('')
  const [plans, setPlans] = useState<Plan[]>([])

  useEffect(() => {
    let live = true

    void loadPlans().then((rows) => {
      if (live) {
        setPlans(rows)
      }
    })

    return () => {
      live = false
    }
  }, [])
  const [values, setValues] = useState<Values>({
    country: 'India',
    currency: 'INR',
    fiscal_year_start: '4',
    timezone: 'Asia/Kolkata',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) {
        return current
      }

      const next = { ...current }
      delete next[key]

      return next
    })
  }

  const get = (key: string) => values[key] ?? ''

  const validateStep = (index: number): Record<string, string> => {
    const next: Record<string, string> = {}

    if (index === 0) {
      if (get('name').trim().length < 2) next.name = 'Company name is required'
      if (get('name').length > 200) next.name = 'At most 200 characters'
      if (get('legal_name').length > 200) next.legal_name = 'At most 200 characters'

      const slug = get('slug').trim()
      if (slug.length < 3) next.slug = 'At least 3 characters'
      else if (slug.length > 100) next.slug = 'At most 100 characters'
      else if (!slugPattern.test(slug)) next.slug = 'Letters, numbers, dash and underscore only'

      const email = get('email').trim()
      if (!emailPattern.test(email)) next.email = 'Enter a valid email'
      else if (email.length > 255) next.email = 'At most 255 characters'

      if (get('phone') && get('phone').length > 20) next.phone = 'At most 20 characters'
      if (get('website') && !/^https?:\/\/\S+$/.test(get('website').trim())) {
        next.website = 'Start with http:// or https://'
      }
      if (get('address').length > 500) next.address = 'At most 500 characters'
      if (get('pincode').length > 10) next.pincode = 'At most 10 characters'
    }

    if (index === 1) {
      const gstin = get('gstin').trim().toUpperCase()
      if (gstin && !gstinPattern.test(gstin)) next.gstin = 'GSTIN is exactly 15 characters'

      const pan = get('pan_number').trim().toUpperCase()
      if (pan && !panPattern.test(pan)) next.pan_number = 'Looks like ABCDE1234F'

      const tan = get('tan_number').trim().toUpperCase()
      if (tan && !tanPattern.test(tan)) next.tan_number = 'Looks like ABCD12345E'

      if (get('cin_number').length > 21) next.cin_number = 'At most 21 characters'
      if (get('industry').length > 100) next.industry = 'At most 100 characters'

    }

    if (index === 2) {
      if (get('admin.name').trim().length < 2) next['admin.name'] = 'Admin name is required'
      if (get('admin.name').length > 150) next['admin.name'] = 'At most 150 characters'

      const email = get('admin.email').trim()
      if (!emailPattern.test(email)) next['admin.email'] = 'Enter a valid email'

      if (get('admin.phone') && get('admin.phone').length > 20) next['admin.phone'] = 'At most 20 characters'

      const password = get('admin.password')
      if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
        next['admin.password'] = 'At least 8 characters with a letter and a number'
      }
    }

    if (index === 3) {
      const plan = plans.find((row) => row.code === get('plan')) ?? null

      if (!plan) {
        next.plan = 'Pick a plan'

        return next
      }

      const seats = Number(get('seats'))

      if (!Number.isInteger(seats) || seats < plan.min_seats || seats > plan.max_seats) {
        next.seats = `Between ${plan.min_seats} and ${plan.max_seats} seats on ${plan.name}`
      }
    }

    return next
  }

  const advance = () => {
    const found = validateStep(step)

    setErrors(found)

    if (Object.keys(found).length > 0) {
      return
    }

    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  const submit = async () => {
    if (busy) {
      return
    }

    const found = { ...validateStep(0), ...validateStep(1), ...validateStep(2), ...validateStep(3) }

    setErrors(found)

    if (Object.keys(found).length > 0) {
      setStep(stepOf[Object.keys(found)[0]] ?? 0)
      setProblem('Some details still need fixing.')

      return
    }

    setBusy(true)
    setProblem(null)

    const optional = (key: string, transform?: (value: string) => string) => {
      const text = get(key).trim()

      return text.length === 0 ? {} : { [key]: transform ? transform(text) : text }
    }

    try {
      const result = await api<{ company?: Record<string, any> }>('/companies', {
        method: 'POST',
        body: {
          name: get('name').trim(),
          slug: get('slug').trim().toLowerCase(),
          email: get('email').trim().toLowerCase(),
          ...optional('legal_name'),
          ...optional('phone'),
          ...optional('website'),
          ...optional('address'),
          ...optional('city'),
          ...optional('state'),
          ...optional('country'),
          ...optional('pincode'),
          ...optional('gstin', (value) => value.toUpperCase()),
          ...optional('pan_number', (value) => value.toUpperCase()),
          ...optional('tan_number', (value) => value.toUpperCase()),
          ...optional('cin_number', (value) => value.toUpperCase()),
          ...optional('industry'),
          ...(get('seats').trim() ? { max_employees: Number(get('seats')) } : {}),
          ...optional('timezone'),
          ...optional('currency'),
          ...(get('fiscal_year_start') ? { fiscal_year_start: Number(get('fiscal_year_start')) } : {}),
          admin: {
            name: get('admin.name').trim(),
            email: get('admin.email').trim().toLowerCase(),
            password: get('admin.password'),
            ...(get('admin.phone').trim() ? { phone: get('admin.phone').trim() } : {}),
          },
        },
      })

      const created = result?.company

      if (created && chosenPlan) {
        await api(`/companies/${created.uuid ?? created.id}/plan`, {
          method: 'PUT',
          body: {
            plan_id: chosenPlan.id,
            seats: Number(get('seats')),
            payment_reference: reference,
            payment_method: 'test',
          },
        }).catch(() => undefined)
      }

      router.replace((created ? `/companies/${created.uuid ?? created.id}` : '/companies') as never)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 422 && Object.keys(caught.fields).length > 0) {
        const mapped: Record<string, string> = {}
        let first: string | null = null

        for (const [field, messages] of Object.entries(caught.fields)) {
          mapped[field] = messages[0]
          first = first ?? field
        }

        setErrors(mapped)
        setStep(first ? (stepOf[first] ?? 0) : 0)
        setProblem('The server rejected some details.')
      } else {
        setProblem(caught instanceof ApiError ? caught.message : 'Could not create the company.')
      }
    } finally {
      setBusy(false)
    }
  }

  const chosenPlan = plans.find((row) => row.code === get('plan')) ?? null
  const seatCount = Number(get('seats')) || 0
  const order = chosenPlan && seatCount > 0 ? priceOrder(chosenPlan, seatCount) : null

  const summary = useMemo(
    () => [
      { label: 'Company', value: get('name') || '—' },
      { label: 'Workspace', value: get('slug') ? get('slug').toLowerCase() : '—' },
      { label: 'Admin', value: get('admin.name') || '—' },
      { label: 'Admin email', value: get('admin.email') || '—' },
    ],
    [values]
  )

  if (!isSuperAdmin) {
    return (
      <Screen title="New company" leading="back">
        <View style={styles.padded}>
          <Notice
            tone="warning"
            title="Platform owners only"
            message="Only a Clanio super admin can onboard a new company."
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen title="New company" subtitle={steps[step]} leading="back">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Stepper steps={steps} current={step} />

          {problem ? <Notice tone="danger" title="Check the form" message={problem} /> : null}

          {step === 0 ? (
            <View style={styles.form}>
              <Field label="Company name" value={get('name')} onChangeText={(v) => set('name', v)} placeholder="Acme Technologies" autoCapitalize="words" maxLength={200} error={errors.name} editable={!busy} />
              <Field label="Legal name" value={get('legal_name')} onChangeText={(v) => set('legal_name', v)} placeholder="Acme Technologies Private Limited" autoCapitalize="words" maxLength={200} error={errors.legal_name} editable={!busy} />
              <Field label="Workspace slug" value={get('slug')} onChangeText={(v) => set('slug', v)} placeholder="acme" maxLength={100} error={errors.slug} editable={!busy} />
              <Field label="Company email" value={get('email')} onChangeText={(v) => set('email', v)} placeholder="hello@acme.com" keyboardType="email-address" maxLength={255} error={errors.email} editable={!busy} />
              <Field label="Phone" value={get('phone')} onChangeText={(v) => set('phone', v)} placeholder="Optional" keyboardType="phone-pad" maxLength={20} error={errors.phone} editable={!busy} />
              <Field label="Website" value={get('website')} onChangeText={(v) => set('website', v)} placeholder="https://acme.com" maxLength={255} error={errors.website} editable={!busy} />
              <Field label="Address" value={get('address')} onChangeText={(v) => set('address', v)} placeholder="Street, area" autoCapitalize="sentences" maxLength={500} error={errors.address} editable={!busy} multiline />
              <Field label="City" value={get('city')} onChangeText={(v) => set('city', v)} placeholder="Mumbai" autoCapitalize="words" maxLength={100} error={errors.city} editable={!busy} />
              <Field label="State" value={get('state')} onChangeText={(v) => set('state', v)} placeholder="Maharashtra" autoCapitalize="words" maxLength={100} error={errors.state} editable={!busy} />
              <Field label="Country" value={get('country')} onChangeText={(v) => set('country', v)} placeholder="India" autoCapitalize="words" maxLength={100} error={errors.country} editable={!busy} />
              <Field label="Pincode" value={get('pincode')} onChangeText={(v) => set('pincode', v)} placeholder="400001" keyboardType="number-pad" maxLength={10} error={errors.pincode} editable={!busy} />
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.form}>
              <Notice tone="info" title="All optional" message="Statutory numbers can be filled in later from company settings." />
              <Field label="GSTIN" value={get('gstin')} onChangeText={(v) => set('gstin', v)} placeholder="15 characters" autoCapitalize="characters" maxLength={15} error={errors.gstin} editable={!busy} />
              <Field label="PAN" value={get('pan_number')} onChangeText={(v) => set('pan_number', v)} placeholder="ABCDE1234F" autoCapitalize="characters" maxLength={10} error={errors.pan_number} editable={!busy} />
              <Field label="TAN" value={get('tan_number')} onChangeText={(v) => set('tan_number', v)} placeholder="ABCD12345E" autoCapitalize="characters" maxLength={10} error={errors.tan_number} editable={!busy} />
              <Field label="CIN" value={get('cin_number')} onChangeText={(v) => set('cin_number', v)} placeholder="Optional" autoCapitalize="characters" maxLength={21} error={errors.cin_number} editable={!busy} />
              <Field label="Industry" value={get('industry')} onChangeText={(v) => set('industry', v)} placeholder="Software" autoCapitalize="words" maxLength={100} error={errors.industry} editable={!busy} />
              <Select label="Currency" value={get('currency') || null} options={currencies} onChange={(v) => set('currency', v ?? '')} error={errors.currency} disabled={busy} />
              <Select label="Financial year starts" value={get('fiscal_year_start') || null} options={fiscalMonths} onChange={(v) => set('fiscal_year_start', v ?? '')} error={errors.fiscal_year_start} disabled={busy} />
              <Field label="Timezone" value={get('timezone')} onChangeText={(v) => set('timezone', v)} placeholder="Asia/Kolkata" maxLength={64} error={errors.timezone} editable={!busy} />
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.form}>
              <Notice
                tone="info"
                title="The first login"
                message="This person becomes Company Admin and can invite everyone else."
              />
              <Field label="Admin name" value={get('admin.name')} onChangeText={(v) => set('admin.name', v)} placeholder="Rohit Sharma" autoCapitalize="words" maxLength={150} error={errors['admin.name']} editable={!busy} />
              <Field label="Admin email" value={get('admin.email')} onChangeText={(v) => set('admin.email', v)} placeholder="rohit@acme.com" keyboardType="email-address" maxLength={255} error={errors['admin.email']} editable={!busy} />
              <Field label="Admin phone" value={get('admin.phone')} onChangeText={(v) => set('admin.phone', v)} placeholder="Optional" keyboardType="phone-pad" maxLength={20} error={errors['admin.phone']} editable={!busy} />
              <Field label="Temporary password" value={get('admin.password')} onChangeText={(v) => set('admin.password', v)} placeholder="At least 8 characters" secure error={errors['admin.password']} editable={!busy} />
            </View>
          ) : null}


          {step === 3 ? (
            <View style={styles.form}>
              <Text style={[styles.sectionTitle, { color: theme.ink }]}>Pick a plan</Text>

              {plans.length === 0 ? (
                <Notice
                  tone="warning"
                  title="No plans set up"
                  message="Add at least one plan from the Plans screen before onboarding a company."
                />
              ) : null}

              {plans.map((plan) => {
                const active = get('plan') === plan.code

                return (
                  <Pressable
                    key={plan.code}
                    onPress={() => {
                      set('plan', plan.code)

                      if (!get('seats') || Number(get('seats')) < plan.min_seats || Number(get('seats')) > plan.max_seats) {
                        set('seats', String(plan.min_seats))
                      }
                    }}
                    style={[
                      styles.plan,
                      {
                        backgroundColor: active ? theme.brandSoft : theme.surface,
                        borderColor: active ? theme.brand : theme.line,
                      },
                    ]}
                  >
                    <View style={styles.planHead}>
                      <View style={styles.planText}>
                        <Text style={[styles.planName, { color: theme.ink }]}>{plan.name}</Text>
                        <Text style={[styles.planTagline, { color: theme.inkSubtle }]}>{plan.tagline}</Text>
                      </View>

                      <View style={styles.planPrice}>
                        <Text style={[styles.planAmount, { color: theme.brand }]}>{money(plan.price_per_seat)}</Text>
                        <Text style={[styles.planUnit, { color: theme.inkSubtle }]}>per seat</Text>
                      </View>
                    </View>

                    {plan.is_popular ? (
                      <Text style={[styles.planBadge, { color: theme.success }]}>Most companies pick this</Text>
                    ) : null}

                    <Text style={[styles.planMeta, { color: theme.inkMuted }]}>
                      {plan.min_seats} to {plan.max_seats} seats · {plan.highlights.join(' · ')}
                    </Text>
                  </Pressable>
                )
              })}

              {errors.plan ? <Text style={[styles.error, { color: theme.danger }]}>{errors.plan}</Text> : null}

              {chosenPlan ? (
                <Field
                  label="How many seats"
                  value={get('seats')}
                  onChangeText={(v) => set('seats', v)}
                  placeholder={String(chosenPlan.min_seats)}
                  keyboardType="number-pad"
                  error={errors.seats}
                  editable={!busy}
                />
              ) : null}
            </View>
          ) : null}

          {step === 4 ? (
            <View style={styles.form}>
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                {summary.map((row) => (
                  <View key={row.label} style={styles.row}>
                    <Text style={[styles.rowLabel, { color: theme.inkMuted }]}>{row.label}</Text>
                    <Text style={[styles.rowValue, { color: theme.ink }]}>{row.value}</Text>
                  </View>
                ))}
              </View>

              {order && chosenPlan ? (
                <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                  <View style={styles.row}>
                    <Text style={[styles.rowLabel, { color: theme.inkMuted }]}>{chosenPlan.name} plan</Text>
                    <Text style={[styles.rowValue, { color: theme.ink }]}>
                      {order.seats} × {money(order.pricePerSeat)}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={[styles.rowLabel, { color: theme.inkMuted }]}>Subtotal</Text>
                    <Text style={[styles.rowValue, { color: theme.ink }]}>{money(order.subtotal)}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={[styles.rowLabel, { color: theme.inkMuted }]}>GST {order.gstPercent}%</Text>
                    <Text style={[styles.rowValue, { color: theme.ink }]}>{money(order.gst)}</Text>
                  </View>

                  <View style={[styles.totalRow, { borderTopColor: theme.line }]}>
                    <Text style={[styles.totalLabel, { color: theme.ink }]}>Payable now</Text>
                    <Text style={[styles.totalValue, { color: theme.brand }]}>{money(order.total)}</Text>
                  </View>
                </View>
              ) : null}

              {paid ? (
                <Notice
                  tone="success"
                  title="Payment recorded"
                  message={`Reference ${reference}. Create the workspace and the invoice is raised as paid.`}
                />
              ) : (
                <Notice
                  tone="warning"
                  title="Test payment"
                  message="No gateway is connected yet, so this just marks the order paid. Plug in the real gateway later."
                />
              )}
            </View>
          ) : null}


          <View style={styles.actions}>
            {step < steps.length - 1 ? (
              <Button label="Continue" onPress={advance} disabled={busy} fullWidth />
            ) : paid ? (
              <Button label="Create the workspace" onPress={submit} loading={busy} fullWidth />
            ) : (
              <Button
                label={order ? `Pay ${money(order.total)}` : 'Pay'}
                onPress={() => {
                  setReference('TEST-' + Date.now().toString(36).toUpperCase())
                  setPaid(true)
                }}
                disabled={busy || !order}
                fullWidth
              />
            )}

            {step > 0 ? (
              <Button label="Back" variant="ghost" onPress={() => setStep(step - 1)} disabled={busy} fullWidth />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  padded: {
    padding: spacing.lg,
  },
  form: {
    gap: spacing.lg,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: 9,
  },
  rowLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  rowValue: {
    flexShrink: 1,
    fontSize: font.sm,
    fontWeight: '600',
    textAlign: 'right',
  },
  actions: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: font.lg,
    fontWeight: '700',
  },
  plan: {
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.lg,
    gap: 6,
  },
  planHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  planText: {
    flex: 1,
    gap: 2,
  },
  planName: {
    fontSize: font.md,
    fontWeight: '800',
  },
  planTagline: {
    fontSize: font.xs,
  },
  planPrice: {
    alignItems: 'flex-end',
  },
  planAmount: {
    fontSize: font.lg,
    fontWeight: '800',
  },
  planUnit: {
    fontSize: font.xs,
  },
  planBadge: {
    fontSize: font.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  planMeta: {
    fontSize: font.xs,
    lineHeight: 17,
  },
  error: {
    fontSize: font.sm,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: spacing.md,
    marginTop: 6,
    marginBottom: spacing.sm,
  },
  totalLabel: {
    fontSize: font.md,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
})
