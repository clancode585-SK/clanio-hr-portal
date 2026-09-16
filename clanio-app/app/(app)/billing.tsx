import { useCallback, useEffect, useState } from 'react'
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Select } from '@/components/ui/Select'
import { ErrorState, Loader } from '@/components/ui/States'
import { formatFullDate } from '@/lib/clock'
import { ApiError, api, apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { downloadText } from '@/lib/download'
import { money } from '@/lib/plans'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Invoice = {
  id: number
  uuid: string
  invoice_number: string
  company_id: number
  company?: { id: number; name: string; slug: string } | null
  plan_name: string
  plan_code: string
  seats: number
  price_per_seat: number
  currency: string
  billing_cycle: string
  subtotal: number
  gst_percent: number
  gst_amount: number
  total: number
  status: string
  period_start: string | null
  period_end: string | null
  issued_at: string | null
  paid_at: string | null
  payment_method: string | null
  payment_reference: string | null
  billed_to_name: string
  billed_to_email: string | null
  billed_to_gstin: string | null
  billed_to_address: string | null
  notes: string | null
}

type Summary = {
  total: number
  paid: number
  pending: number
  cancelled: number
  collected: number
  awaited: number
}

const PER_PAGE = 25

const statuses = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Awaiting payment' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function BillingScreen() {
  const theme = useTheme()
  const { isSuperAdmin, can } = useAuth()

  const [summary, setSummary] = useState<Summary | null>(null)
  const [rows, setRows] = useState<Invoice[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [status, setStatus] = useState<string | null>(null)
  const [open, setOpen] = useState<Invoice | null>(null)
  const [reference, setReference] = useState('')
  const [method, setMethod] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const canManage = isSuperAdmin && can('invoice.manage')

  const query = useCallback(
    (target: number): string => {
      const parts = [`per_page=${PER_PAGE}`, `page=${target}`]

      if (status) {
        parts.push(`status=${status}`)
      }

      return parts.join('&')
    },
    [status]
  )

  const fetchPage = useCallback(
    async (target: number, mode: 'load' | 'refresh' | 'more') => {
      if (mode === 'load') {
        setLoading(true)
      } else if (mode === 'refresh') {
        setRefreshing(true)
      } else {
        setMore(true)
      }

      setError(null)

      try {
        const result = await apiList<Invoice>(`/invoices?${query(target)}`)

        setRows((current) => (mode === 'more' ? [...current, ...result.data] : result.data))
        setPage(result.meta?.current_page ?? target)
        setLastPage(result.meta?.last_page ?? 1)
        setTotal(result.meta?.total ?? result.data.length)
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Could not load invoices.')
      } finally {
        setLoading(false)
        setRefreshing(false)
        setMore(false)
      }
    },
    [query]
  )

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await api<Summary>('/invoices/summary'))
    } catch {
      setSummary(null)
    }
  }, [])

  useEffect(() => {
    void fetchPage(1, 'load')
  }, [fetchPage])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  const refreshAll = async () => {
    await Promise.all([fetchPage(1, 'refresh'), loadSummary()])
  }

  const openSheet = (invoice: Invoice) => {
    setOpen(invoice)
    setReference('')
    setMethod('')
    setProblem(null)
    setDone(null)
  }

  const act = async (path: string, body: Record<string, unknown>, message: string) => {
    if (!open || busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      const updated = await api<Invoice>(`/invoices/${open.uuid}/${path}`, { method: 'PUT', body })

      setRows((current) => current.map((row) => (row.uuid === updated.uuid ? updated : row)))
      setOpen(updated)
      setDone(message)
      void loadSummary()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (reference.trim().length === 0) {
      setProblem('Enter the payment reference so the record is traceable.')

      return
    }

    void act(
      'mark-paid',
      { payment_reference: reference.trim(), ...(method.trim() ? { payment_method: method.trim() } : {}) },
      'Marked paid.'
    )
  }

  const grab = async () => {
    if (!open || busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await downloadText(`/invoices/${open.uuid}/download`, `${open.invoice_number}.csv`)
      setDone('Invoice downloaded.')
    } catch {
      setProblem('Could not download the invoice.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Screen title="Billing">
        <Loader />
      </Screen>
    )
  }

  if (error && rows.length === 0) {
    return (
      <Screen title="Billing">
        <ErrorState message={error} onRetry={() => fetchPage(1, 'load')} />
      </Screen>
    )
  }

  return (
    <Screen title="Billing" subtitle={`${total} ${total === 1 ? 'invoice' : 'invoices'}`}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={theme.brand} />}
      >
        {summary ? (
          <View style={styles.stats}>
            <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Text style={[styles.statValue, { color: theme.success }]}>{money(summary.collected)}</Text>
              <Text style={[styles.statLabel, { color: theme.inkMuted }]}>Collected</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Text style={[styles.statValue, { color: summary.awaited > 0 ? theme.warning : theme.inkSubtle }]}>
                {money(summary.awaited)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.inkMuted }]}>
                {summary.pending} awaiting
              </Text>
            </View>
          </View>
        ) : null}

        <Select
          label="Show"
          value={status}
          options={statuses}
          onChange={setStatus}
          placeholder="Every invoice"
          allowClear
        />

        {error ? <Notice tone="danger" title="Could not load more" message={error} /> : null}

        {rows.length === 0 ? (
          <Notice
            tone="info"
            title="No invoices yet"
            message={
              status
                ? 'No invoice has this status.'
                : isSuperAdmin
                  ? 'An invoice is raised the moment a company picks a plan or changes its seat count.'
                  : 'Your invoices appear here as soon as your plan is set up.'
            }
          />
        ) : null}

        {rows.map((row) => (
          <Pressable
            key={row.uuid}
            onPress={() => openSheet(row)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: pressed ? theme.canvas : theme.surface, borderColor: theme.line },
            ]}
          >
            <View style={styles.head}>
              <Text style={[styles.number, { color: theme.ink }]}>{row.invoice_number}</Text>
              <View style={[styles.tag, { backgroundColor: statusSoft(theme, row.status) }]}>
                <Text style={[styles.tagText, { color: statusInk(theme, row.status) }]}>{label(row.status)}</Text>
              </View>
            </View>

            <Text numberOfLines={1} style={[styles.who, { color: theme.inkMuted }]}>
              {isSuperAdmin ? (row.company?.name ?? row.billed_to_name) : row.billed_to_name}
            </Text>

            <View style={styles.foot}>
              <Text style={[styles.detail, { color: theme.inkSubtle }]}>
                {row.plan_name} · {row.seats} seats · {when(row.issued_at)}
              </Text>
              <Text style={[styles.amount, { color: theme.ink }]}>{money(row.total)}</Text>
            </View>
          </Pressable>
        ))}

        {page < lastPage ? (
          <Button
            label={more ? 'Loading' : 'Load more'}
            variant="secondary"
            loading={more}
            onPress={() => fetchPage(page + 1, 'more')}
            fullWidth
          />
        ) : null}

        <Notice
          tone="info"
          title="How invoices are raised"
          message="Picking a plan, moving to another plan or changing the seat count raises an invoice straight away. Paying through the signup flow marks it paid; anything else stays awaiting payment."
        />
      </ScrollView>

      <Sheet invoice={open} onClose={() => setOpen(null)}>
        {open ? (
          <>
            {done ? <Notice tone="success" title="Done" message={done} /> : null}
            {problem ? <Notice tone="danger" title="Could not do that" message={problem} /> : null}

            <Line label="Status" value={label(open.status)} strong />
            <Line label="Billed to" value={open.billed_to_name} />
            {open.billed_to_gstin ? <Line label="GSTIN" value={open.billed_to_gstin} /> : null}
            {open.billed_to_email ? <Line label="Email" value={open.billed_to_email} /> : null}
            {open.billed_to_address ? <Line label="Address" value={open.billed_to_address} /> : null}

            <Divider />

            <Line label={`${open.plan_name} plan`} value={`${open.seats} × ${money(open.price_per_seat)}`} />
            <Line
              label="Period"
              value={`${open.period_start ?? '—'} to ${open.period_end ?? '—'}`}
            />
            <Line label="Subtotal" value={money(open.subtotal)} />
            <Line label={`GST ${open.gst_percent}%`} value={money(open.gst_amount)} />
            <Line label={`Total ${open.currency}`} value={money(open.total)} strong />

            {open.paid_at ? (
              <>
                <Divider />
                <Line label="Paid on" value={when(open.paid_at)} />
                {open.payment_reference ? <Line label="Reference" value={open.payment_reference} /> : null}
                {open.payment_method ? <Line label="Method" value={open.payment_method} /> : null}
              </>
            ) : null}

            {open.notes ? (
              <>
                <Divider />
                <Line label="Note" value={open.notes} />
              </>
            ) : null}

            <View style={styles.sheetActions}>
              <Button label="Download" variant="secondary" onPress={grab} loading={busy} fullWidth />

              {canManage && open.status === 'pending' ? (
                <>
                  <Field
                    label="Payment reference"
                    value={reference}
                    onChangeText={setReference}
                    placeholder="NEFT-99881"
                    editable={!busy}
                    maxLength={60}
                  />
                  <Field
                    label="How they paid"
                    value={method}
                    onChangeText={setMethod}
                    placeholder="Bank transfer"
                    autoCapitalize="sentences"
                    editable={!busy}
                    maxLength={30}
                  />
                  <Button label="Mark paid" onPress={save} loading={busy} fullWidth />
                  <Button
                    label="Cancel this invoice"
                    variant="danger"
                    onPress={() => act('cancel', { reason: 'Cancelled by the platform' }, 'Invoice cancelled.')}
                    loading={busy}
                    fullWidth
                  />
                </>
              ) : null}
            </View>
          </>
        ) : null}
      </Sheet>
    </Screen>
  )
}

function Sheet({
  invoice,
  onClose,
  children,
}: {
  invoice: Invoice | null
  onClose: () => void
  children: React.ReactNode
}) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={invoice !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.surface, borderColor: theme.line, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <View style={[styles.sheetHead, { borderBottomColor: theme.line }]}>
          <Text style={[styles.sheetTitle, { color: theme.ink }]}>{invoice?.invoice_number ?? ''}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={[styles.close, { color: theme.inkSubtle }]}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </Modal>
  )
}

function Line({ label: name, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const theme = useTheme()

  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, { color: theme.inkMuted }]}>{name}</Text>
      <Text
        style={[
          styles.lineValue,
          { color: strong ? theme.ink : theme.inkMuted, fontWeight: strong ? '800' : '600' },
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

function Divider() {
  const theme = useTheme()

  return <View style={[styles.divider, { backgroundColor: theme.line }]} />
}

function label(status: string): string {
  if (status === 'paid') {
    return 'Paid'
  }

  if (status === 'cancelled') {
    return 'Cancelled'
  }

  return 'Awaiting payment'
}

function when(value: string | null): string {
  if (!value) {
    return '—'
  }

  return formatFullDate(value)
}

function statusSoft(theme: ReturnType<typeof useTheme>, status: string): string {
  if (status === 'paid') {
    return theme.successSoft
  }

  if (status === 'cancelled') {
    return theme.dangerSoft
  }

  return theme.warningSoft
}

function statusInk(theme: ReturnType<typeof useTheme>, status: string): string {
  if (status === 'paid') {
    return theme.success
  }

  if (status === 'cancelled') {
    return theme.danger
  }

  return theme.warning
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    gap: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: font.xs,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  number: {
    fontSize: font.md,
    fontWeight: '800',
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tagText: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  who: {
    fontSize: font.sm,
    fontWeight: '600',
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  detail: {
    flex: 1,
    fontSize: font.xs,
  },
  amount: {
    fontSize: font.md,
    fontWeight: '800',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 17, 33, 0.45)',
  },
  sheet: {
    maxHeight: '85%',
    borderTopWidth: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sheetTitle: {
    fontSize: font.lg,
    fontWeight: '800',
  },
  close: {
    fontSize: font.lg,
  },
  sheetBody: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  lineLabel: {
    fontSize: font.sm,
    flexShrink: 0,
  },
  lineValue: {
    fontSize: font.sm,
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs,
  },
  sheetActions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
})
