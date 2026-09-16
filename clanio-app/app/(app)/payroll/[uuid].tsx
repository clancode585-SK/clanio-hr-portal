import { useCallback, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { ErrorState, Loader } from '@/components/ui/States'
import { ApiError, api, apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { downloadFile } from '@/lib/download'
import { Money } from '@/lib/money'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Run = Record<string, any>
type Slip = Record<string, any>
type Quote = Record<string, any>

type Loaded = {
  run: Run
  slips: Slip[]
}

const filters = [
  { key: 'all', label: 'Everyone' },
  { key: 'pending', label: 'Not sent' },
  { key: 'paid', label: 'Paid' },
  { key: 'failed', label: 'Failed' },
  { key: 'on_hold', label: 'On hold' },
]

export default function PayrollRunScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { uuid } = useLocalSearchParams<{ uuid: string }>()
  const { can } = useAuth()

  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState<Slip | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [lop, setLop] = useState('')
  const [holdReason, setHoldReason] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<Loaded> => {
    const run = await api<Run>(`/payroll-runs/${uuid}`)
    const slips = await apiList<Slip>(`/payroll-runs/${uuid}/payslips?per_page=200`)

    return { run, slips: slips.data }
  }, [uuid])

  const record = useResource<Loaded>(load, [uuid])

  const canRun = can('payroll.run')
  const canApprove = can('payroll.approve')
  const canPay = can('salary.disburse')

  const act = async (path: string, body: Record<string, unknown> | undefined, message: string) => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(path, { method: 'POST', body })
      setDone(message)
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not do that.')
    } finally {
      setBusy(false)
    }
  }

  const sheet = async (slip: Slip) => {
    setOpen(slip)
    setQuote(null)
    setLop(Money.days(slip.lop_days))
    setHoldReason('')
    setProblem(null)
    setDone(null)

    if (!canPay) {
      return
    }

    try {
      setQuote(await api<Quote>(`/payslips/${slip.uuid}/transfer-quote`))
    } catch {
      setQuote(null)
    }
  }

  const closeSheet = () => {
    setOpen(null)
    setQuote(null)
    setProblem(null)
  }

  const saveLop = async () => {
    if (!open || busy) {
      return
    }

    const days = Number(lop)

    if (!Number.isFinite(days) || days < 0 || days > Number(open.working_days)) {
      setProblem(`LOP 0 se ${Money.days(open.working_days)} din ke beech hona chahiye.`)

      return
    }

    setBusy(true)
    setProblem(null)

    try {
      const fresh = await api<Slip>(`/payslips/${open.uuid}/lop`, { method: 'PUT', body: { lop_days: days } })

      setOpen(fresh)
      setDone(`${fresh.employee_name} ka LOP ${Money.days(days)} din kar diya.`)
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not update the LOP.')
    } finally {
      setBusy(false)
    }
  }

  const transferOne = async () => {
    if (!open || busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      const result = await api<{ disbursement: Record<string, any>; payslip: Slip }>(
        `/payslips/${open.uuid}/transfer`,
        { method: 'POST' }
      )

      if (result.disbursement.status === 'success') {
        closeSheet()
        setDone(`${result.payslip.employee_name} ko ${Money.rupee(result.payslip.net_payable)} bhej diya.`)
      } else {
        setOpen(result.payslip)
        setProblem(result.disbursement.failure_reason ?? 'Bank ne mana kiya.')
      }

      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not send the salary.')
    } finally {
      setBusy(false)
    }
  }

  const payEveryone = async () => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      const result = await api<Record<string, any>>(`/payroll-runs/${uuid}/transfer`, { method: 'POST' })

      setDone(
        `${result.sent} salary bhej di (${Money.rupee(result.amount_sent)})`
        + (result.failed > 0 ? ` · ${result.failed} fail` : '')
        + (result.skipped_on_hold > 0 ? ` · ${result.skipped_on_hold} hold par chhodi` : '')
      )

      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not send the salaries.')
    } finally {
      setBusy(false)
    }
  }

  const grab = async (slip: Slip) => {
    setBusy(true)

    try {
      await downloadFile(`/payslips/${slip.uuid}/download`, `Payslip-${slip.employee_code}.html`)
    } catch {
      setProblem('Could not download the payslip.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Payroll" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Payroll" leading="back">
        <ErrorState message={record.error ?? 'Could not load this payroll.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const { run, slips } = record.data

  const shown = filter === 'all' ? slips : slips.filter((slip) => slip.payment_status === filter)
  const sendable = slips.filter((slip) => slip.is_transferable).length

  return (
    <Screen title={run.month_label} subtitle={run.status_label} leading="back">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {done ? <Notice tone="success" title="Done" message={done} /> : null}
        {problem ? <Notice tone="danger" title="Could not do that" message={problem} /> : null}

        <View style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <View style={styles.summaryRow}>
            <Stat label="Employees" value={String(run.headcount)} />
            <Stat label="Gross" value={Money.short(run.total_earnings)} />
            <Stat label="Deducted" value={Money.short(run.total_deductions)} />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.line }]} />
          <View style={styles.summaryRow}>
            <Stat label="Net payable" value={Money.rupee(run.total_net)} strong />
            <Stat label="Paid" value={`${run.paid_count} of ${run.headcount}`} />
            <Stat label="Employer cost" value={Money.short(run.total_employer)} />
          </View>

          <Text style={[styles.payDate, { color: theme.inkSubtle }]}>
            Pay date {run.pay_date ?? '—'} · is date par salary khud chali jaayegi
          </Text>
        </View>

        {run.is_editable && canRun ? (
          <Button
            label={run.headcount === 0 ? 'Calculate this month' : 'Calculate again'}
            onPress={() => void act(`/payroll-runs/${uuid}/calculate`, undefined, 'Payroll calculate ho gaya.')}
            loading={busy}
            fullWidth
          />
        ) : null}

        {run.status === 'calculated' && canApprove ? (
          <Button
            label="Approve this payroll"
            onPress={() => void act(`/payroll-runs/${uuid}/approve`, undefined, 'Approve ho gaya. Ab salary bhej sakte ho.')}
            loading={busy}
            fullWidth
          />
        ) : null}

        {run.is_payable && canPay && sendable > 0 ? (
          <Button
            label={`Send salary to ${sendable} employee${sendable === 1 ? '' : 's'}`}
            onPress={() => void payEveryone()}
            loading={busy}
            fullWidth
          />
        ) : null}

        {run.status === 'calculated' && canApprove ? (
          <Notice
            tone="info"
            title="Approve karne ke baad amount lock ho jaayega"
            message="LOP aur recalculate dono band ho jaate hain. Pehle sab check kar lo."
          />
        ) : null}

        {run.is_editable && canApprove && run.headcount > 0 ? (
          <Button
            label="Cancel this payroll"
            variant="secondary"
            onPress={() => void act(`/payroll-runs/${uuid}/cancel`, undefined, 'Payroll cancel kar diya.')}
            disabled={busy}
            fullWidth
          />
        ) : null}

        {slips.length > 0 ? (
          <View style={styles.chips}>
            {filters.map((row) => (
              <Chip
                key={row.key}
                label={row.label}
                count={row.key === 'all' ? slips.length : slips.filter((s) => s.payment_status === row.key).length}
                active={filter === row.key}
                onPress={() => setFilter(row.key)}
              />
            ))}
          </View>
        ) : null}

        {slips.length === 0 ? (
          <Notice
            tone="info"
            title="Kuch calculate nahi hua"
            message="Calculate dabao — jiska structure set hai uski payslip ban jaayegi."
          />
        ) : null}

        {shown.map((slip) => (
          <Pressable
            key={slip.uuid}
            onPress={() => void sheet(slip)}
            style={({ pressed }) => [
              styles.slip,
              { backgroundColor: pressed ? theme.canvas : theme.surface, borderColor: theme.line },
            ]}
          >
            <View style={styles.head}>
              <Text numberOfLines={1} style={[styles.name, { color: theme.ink }]}>
                {slip.employee_name}
              </Text>
              <View style={[styles.tag, { backgroundColor: paySoft(theme, slip.payment_status) }]}>
                <Text style={[styles.tagText, { color: payInk(theme, slip.payment_status) }]}>
                  {slip.payment_label}
                </Text>
              </View>
            </View>

            <Text style={[styles.meta, { color: theme.inkMuted }]}>
              {slip.employee_code}
              {slip.designation ? ` · ${slip.designation}` : ''}
            </Text>

            <View style={styles.slipNumbers}>
              <Text style={[styles.net, { color: theme.ink }]}>{Money.rupee(slip.net_payable)}</Text>
              <Text style={[styles.days, { color: theme.inkSubtle }]}>
                {Money.days(slip.paid_days)} of {Money.days(slip.working_days)} days
                {slip.lop_days > 0 ? ` · ${Money.days(slip.lop_days)} LOP` : ''}
              </Text>
            </View>

            {slip.lop_differs_from_attendance && slip.lop_locked_by_hr ? (
              <Text style={[styles.flag, { color: theme.warning }]}>
                HR ne LOP set kiya — attendance {Money.days(slip.lop_suggested)} din keh rahi thi
              </Text>
            ) : null}

            {slip.hold_reason ? (
              <Text style={[styles.flag, { color: theme.danger }]}>On hold — {slip.hold_reason}</Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={open !== null} transparent animationType="slide" onRequestClose={closeSheet}>
        <Pressable style={styles.backdrop} onPress={closeSheet} />

        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={[styles.sheetHead, { borderBottomColor: theme.line }]}>
            <Text numberOfLines={1} style={[styles.sheetTitle, { color: theme.ink }]}>
              {open?.employee_name ?? ''}
            </Text>
            <Pressable onPress={closeSheet} hitSlop={10}>
              <Text style={[styles.closeMark, { color: theme.inkMuted }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {problem ? <Notice tone="danger" title="Could not do that" message={problem} /> : null}

            {open ? (
              <>
                <View style={styles.sheetTop}>
                  <Text style={[styles.sheetNet, { color: theme.ink }]}>{Money.rupee(open.net_payable, 2)}</Text>
                  <Text style={[styles.sheetSub, { color: theme.inkMuted }]}>
                    {open.employee_code} · {Money.days(open.paid_days)} of {Money.days(open.working_days)} days paid
                  </Text>
                </View>

                <View style={[styles.lines, { borderColor: theme.line }]}>
                  {(open.lines ?? []).map((line: Record<string, any>) => (
                    <View key={line.code} style={styles.line}>
                      <Text style={[styles.lineName, { color: line.kind === 'employer_cost' ? theme.inkSubtle : theme.ink }]}>
                        {line.name}
                        {line.kind === 'employer_cost' ? ' (company)' : ''}
                      </Text>

                      <View style={styles.lineRight}>
                        {line.was_cut ? (
                          <Text style={[styles.lineFull, { color: theme.inkSubtle }]}>
                            {Money.rupee(line.full_amount)}
                          </Text>
                        ) : null}
                        <Text
                          style={[
                            styles.lineAmount,
                            { color: line.kind === 'deduction' ? theme.danger : theme.ink },
                          ]}
                        >
                          {line.kind === 'deduction' ? '−' : ''}
                          {Money.rupee(line.amount, 2)}
                        </Text>
                      </View>
                    </View>
                  ))}

                  <View style={[styles.line, styles.lineTotal, { borderTopColor: theme.ink }]}>
                    <Text style={[styles.lineName, { color: theme.ink, fontWeight: '800' }]}>Net pay</Text>
                    <Text style={[styles.lineAmount, { color: theme.ink, fontWeight: '800' }]}>
                      {Money.rupee(open.net_payable, 2)}
                    </Text>
                  </View>
                </View>

                {open.run_status === 'draft' || open.run_status === 'calculated' ? (
                  canRun ? (
                    <View style={styles.block}>
                      <Field
                        label="Loss of pay (days)"
                        value={lop}
                        onChangeText={setLop}
                        placeholder="0"
                        keyboardType="decimal-pad"
                        editable={!busy}
                      />
                      <Text style={[styles.hint, { color: theme.inkSubtle }]}>
                        Attendance {Money.days(open.lop_suggested)} din keh rahi hai. Aapka faisla chalega.
                      </Text>
                      <Button label="Save and recalculate" onPress={saveLop} loading={busy} fullWidth />
                    </View>
                  ) : null
                ) : (
                  <Notice
                    tone="info"
                    title="Amount lock hai"
                    message="Payroll approve ho gaya hai, ab LOP nahi badal sakta."
                  />
                )}

                {canPay && quote ? (
                  <View style={styles.block}>
                    <Text style={[styles.blockTitle, { color: theme.inkMuted }]}>Where the money goes</Text>

                    <View style={[styles.route, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
                      <Text style={[styles.routeLine, { color: theme.ink }]}>
                        {quote.from?.bank_name ?? '—'} {quote.from?.account_masked ?? ''}
                      </Text>
                      <Text style={[styles.routeArrow, { color: theme.inkSubtle }]}>↓ {Money.rupee(quote.amount, 2)}</Text>
                      <Text style={[styles.routeLine, { color: theme.ink }]}>
                        {quote.to?.bank_name ?? 'No employee account'} {quote.to?.masked ?? ''}
                      </Text>
                      {quote.to?.account_holder_name ? (
                        <Text style={[styles.routeName, { color: theme.inkSubtle }]}>
                          {quote.to.account_holder_name} · {quote.to.ifsc_code}
                        </Text>
                      ) : null}
                    </View>

                    {quote.is_mock ? (
                      <Notice
                        tone="warning"
                        title="Test bank laga hai"
                        message="Asli paisa kahin nahi jaayega. Bank ki detail .env me daalne ke baad asli transfer hoga."
                      />
                    ) : null}

                    {quote.can_transfer ? (
                      <Button label="Transfer this salary" onPress={transferOne} loading={busy} fullWidth />
                    ) : (
                      <Notice
                        tone="danger"
                        title="Abhi nahi bhej sakte"
                        message={(quote.blockers ?? []).join(' ')}
                      />
                    )}
                  </View>
                ) : null}

                {canRun && !open.is_paid ? (
                  <View style={styles.block}>
                    {open.payment_status === 'on_hold' ? (
                      <Button
                        label="Take it off hold"
                        variant="secondary"
                        onPress={() => void act(`/payslips/${open.uuid}/release`, undefined, 'Hold hata diya.').then(() => closeSheet())}
                        disabled={busy}
                        fullWidth
                      />
                    ) : (
                      <>
                        <Field
                          label="Hold this salary because"
                          value={holdReason}
                          onChangeText={setHoldReason}
                          placeholder="Bank detail check karni hai"
                          editable={!busy}
                        />
                        <Button
                          label="Put on hold"
                          variant="secondary"
                          onPress={() =>
                            void act(
                              `/payslips/${open.uuid}/hold`,
                              { reason: holdReason.trim() || null },
                              'Hold par daal diya.'
                            ).then(() => closeSheet())
                          }
                          disabled={busy}
                          fullWidth
                        />
                      </>
                    )}
                  </View>
                ) : null}

                {open.run_status === 'approved' || open.run_status === 'paid' ? (
                  <Button
                    label="Download the payslip"
                    variant="secondary"
                    onPress={() => void grab(open)}
                    disabled={busy}
                    fullWidth
                  />
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  )
}

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const theme = useTheme()

  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: theme.inkSubtle }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.ink, fontSize: strong ? font.lg : font.md }]}>{value}</Text>
    </View>
  )
}

function Chip({
  label,
  count,
  active,
  onPress,
}: {
  label: string
  count: number
  active: boolean
  onPress: () => void
}) {
  const theme = useTheme()

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? theme.brand : theme.surface, borderColor: active ? theme.brand : theme.line },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? '#fff' : theme.inkMuted }]}>
        {label} {count}
      </Text>
    </Pressable>
  )
}

function paySoft(theme: ReturnType<typeof useTheme>, status: string): string {
  return status === 'paid'
    ? theme.successSoft
    : status === 'failed'
      ? theme.dangerSoft
      : status === 'on_hold'
        ? theme.warningSoft
        : theme.infoSoft
}

function payInk(theme: ReturnType<typeof useTheme>, status: string): string {
  return status === 'paid'
    ? theme.success
    : status === 'failed'
      ? theme.danger
      : status === 'on_hold'
        ? theme.warning
        : theme.info
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  summary: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  divider: {
    height: 1,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statValue: {
    fontWeight: '700',
  },
  payDate: {
    fontSize: font.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  slip: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flexShrink: 1,
    fontSize: font.md,
    fontWeight: '700',
  },
  tag: {
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  meta: {
    fontSize: font.xs,
  },
  slipNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: 4,
  },
  net: {
    fontSize: font.lg,
    fontWeight: '800',
  },
  days: {
    fontSize: font.xs,
    fontWeight: '600',
  },
  flag: {
    fontSize: font.xs,
    fontWeight: '600',
    paddingTop: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  sheetTitle: {
    flexShrink: 1,
    fontSize: font.lg,
    fontWeight: '800',
  },
  closeMark: {
    fontSize: font.lg,
    fontWeight: '700',
  },
  sheetBody: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  sheetTop: {
    paddingBottom: spacing.md,
    gap: 2,
  },
  sheetNet: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  sheetSub: {
    fontSize: font.sm,
  },
  lines: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 7,
  },
  lineTotal: {
    borderTopWidth: 1.5,
    marginTop: 4,
    paddingTop: 10,
  },
  lineName: {
    flexShrink: 1,
    fontSize: font.sm,
    fontWeight: '600',
  },
  lineRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  lineFull: {
    fontSize: font.xs,
    textDecorationLine: 'line-through',
  },
  lineAmount: {
    fontSize: font.sm,
    fontWeight: '700',
  },
  block: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  blockTitle: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  route: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 4,
  },
  routeLine: {
    fontSize: font.sm,
    fontWeight: '700',
  },
  routeArrow: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  routeName: {
    fontSize: font.xs,
  },
  hint: {
    fontSize: font.xs,
    lineHeight: 16,
  },
})
