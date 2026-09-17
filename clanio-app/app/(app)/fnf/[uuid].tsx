import { useCallback, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CodeSheet, type Verification } from '@/components/CodeSheet'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { ErrorState, Loader } from '@/components/ui/States'
import { ApiError, api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatDate } from '@/lib/clock'
import { downloadFile } from '@/lib/download'
import { Money } from '@/lib/money'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Settlement = Record<string, any>
type Line = Record<string, any>
type Quote = Record<string, any>

export default function FnfDetailScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { uuid } = useLocalSearchParams<{ uuid: string }>()
  const { can } = useAuth()

  const [quote, setQuote] = useState<Quote | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Line | null>(null)
  const [amount, setAmount] = useState('')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [verification, setVerification] = useState<Verification | null>(null)
  const [codeProblem, setCodeProblem] = useState<string | null>(null)
  const [stopReason, setStopReason] = useState('')

  const load = useCallback(async (): Promise<Settlement> => {
    const settlement = await api<Settlement>(`/fnf-settlements/${uuid}`)

    if (settlement.is_transferable && can('salary.disburse')) {
      try {
        setQuote(await api<Quote>(`/fnf-settlements/${uuid}/transfer-quote`))
      } catch {
        setQuote(null)
      }
    } else {
      setQuote(null)
    }

    return settlement
  }, [uuid, can])

  const record = useResource<Settlement>(load, [uuid])

  const canManage = can('fnf.manage')
  const canApprove = can('fnf.approve')
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

  const openLine = (line: Line) => {
    setEditing(line)
    setAmount(String(line.is_applied ? line.amount : line.suggested_amount))
    setProblem(null)
    setDone(null)
  }

  const closeLine = () => {
    setEditing(null)
    setProblem(null)
  }

  const applyLine = async (line: Line, applied: boolean, figure?: string) => {
    if (busy) {
      return
    }

    const given = figure === undefined ? undefined : Number(figure)

    if (given !== undefined && (!Number.isFinite(given) || given < 0)) {
      setProblem('Amount theek se daalo.')

      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(`/fnf-lines/${line.uuid}/apply`, {
        method: 'PUT',
        body: { is_applied: applied, ...(given === undefined ? {} : { amount: given }) },
      })

      closeLine()
      setDone(applied ? `${line.name} lagaa di.` : `${line.name} hata di.`)
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not update the line.')
    } finally {
      setBusy(false)
    }
  }

  const removeLine = async (line: Line) => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(`/fnf-lines/${line.uuid}`, { method: 'DELETE' })
      closeLine()
      setDone(`${line.name} hata di.`)
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not remove the line.')
    } finally {
      setBusy(false)
    }
  }

  const openAdd = () => {
    setAdding(true)
    setName('')
    setAmount('')
    setNote('')
    setErrors({})
    setProblem(null)
    setDone(null)
  }

  const addLine = async () => {
    if (busy) {
      return
    }

    const found: Record<string, string> = {}
    const figure = Number(amount)

    if (name.trim().length < 2) {
      found.name = 'Kis cheez ki deduction hai, likho.'
    }

    if (!Number.isFinite(figure) || figure <= 0) {
      found.amount = 'Amount zero se zyada do.'
    }

    setErrors(found)

    if (Object.keys(found).length > 0) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(`/fnf-settlements/${uuid}/lines`, {
        method: 'POST',
        body: {
          code: codeFor(name),
          name: name.trim(),
          kind: 'deduction',
          amount: figure,
          note: note.trim() || null,
        },
      })

      setAdding(false)
      setDone(`${name.trim()} add ho gayi.`)
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not add the line.')
    } finally {
      setBusy(false)
    }
  }

  const transfer = async (code?: string) => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)
    setCodeProblem(null)

    try {
      const answer = await api<Record<string, any>>(`/fnf-settlements/${uuid}/transfer`, {
        method: 'POST',
        body: code === undefined
          ? {}
          : { verification_uuid: verification?.uuid, code },
      })

      if (answer?.verification !== undefined) {
        setVerification(answer.verification as Verification)
        setBusy(false)

        return
      }

      setVerification(null)

      if (answer.transfer?.status === 'success') {
        setDone(`${answer.settlement.employee_name} ko ${Money.rupee(answer.settlement.net_payable)} bhej diya.`)
      } else {
        setProblem(answer.transfer?.failure_reason ?? 'Bank ne mana kiya.')
      }

      await record.refresh()
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'Could not send the money.'

      if (code !== undefined) {
        setCodeProblem(message)
      } else {
        setProblem(message)
      }
    } finally {
      setBusy(false)
    }
  }

  const stop = async () => {
    await act(
      `/fnf-settlements/${uuid}/hold`,
      { reason: stopReason.trim() || null },
      'Settlement stop kar diya.'
    )

    setStopReason('')
  }

  const grab = async () => {
    setBusy(true)

    try {
      await downloadFile(`/fnf-settlements/${uuid}/download`, `FnF-${record.data?.employee_code ?? 'statement'}.html`)
    } catch {
      setProblem('Could not download the statement.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Full & Final" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Full & Final" leading="back">
        <ErrorState message={record.error ?? 'Could not load this settlement.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const settlement = record.data
  const lines: Line[] = settlement.lines ?? []

  const counted = lines.filter((line) => line.is_applied && Number(line.amount) !== 0)
  const earnings = counted.filter((line) => line.kind === 'earning')
  const deductions = counted.filter((line) => line.kind === 'deduction')
  const suggestions = lines.filter((line) => line.is_suggestion)

  return (
    <Screen title={settlement.employee_name} subtitle={settlement.status_label} leading="back">
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
            <Stat label="Last day" value={formatDate(settlement.last_working_date)} />
            <Stat label="Paid days" value={`${Money.days(settlement.paid_days)} of ${Money.days(settlement.working_days)}`} />
            <Stat label="Notice" value={`${settlement.notice_served_days} of ${settlement.notice_required_days}`} />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.line }]} />

          <View style={styles.summaryRow}>
            <Stat label="Earnings" value={Money.short(settlement.total_earnings)} />
            <Stat label="Deducted" value={Money.short(settlement.total_deductions)} />
            <Stat
              label={settlement.owes_company ? 'Recoverable' : 'Net payable'}
              value={Money.rupee(Math.abs(Number(settlement.net_payable)))}
              strong
            />
          </View>

          <Text style={[styles.words, { color: theme.inkSubtle }]}>{settlement.net_payable_words}</Text>

          <View style={[styles.divider, { backgroundColor: theme.line }]} />

          <View style={styles.summaryRow}>
            <Stat label="Payment" value={settlement.payment_label} />
            {settlement.settled_at ? (
              <Stat label="Settled on" value={formatDate(settlement.settled_at)} />
            ) : null}
          </View>
        </View>

        {settlement.owes_company ? (
          <Notice
            tone="warning"
            title="Employee par paisa baaki hai"
            message={`${Money.rupee(settlement.recoverable)} recover karna hai. Transfer nahi hoga.`}
          />
        ) : null}

        {settlement.is_stopped ? (
          <Notice
            tone="danger"
            title="Ye settlement stop par hai"
            message={settlement.hold_reason ?? 'HR ne roka hai. Stop hatane tak approve aur transfer dono band.'}
          />
        ) : null}

        <Text style={[styles.section, { color: theme.inkMuted }]}>Earnings</Text>

        <View style={[styles.lines, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          {earnings.length === 0 ? (
            <Text style={[styles.lineName, { color: theme.inkSubtle }]}>Kuch nahi</Text>
          ) : null}

          {earnings.map((line) => (
            <View key={line.uuid} style={styles.line}>
              <View style={styles.lineLeft}>
                <Text style={[styles.lineName, { color: theme.ink }]}>{line.name}</Text>
                {line.basis ? (
                  <Text style={[styles.lineBasis, { color: theme.inkSubtle }]}>{line.basis}</Text>
                ) : null}
              </View>
              <Text style={[styles.lineAmount, { color: theme.ink }]}>{Money.rupee(line.amount, 2)}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.section, { color: theme.inkMuted }]}>Deductions</Text>

        <View style={[styles.lines, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          {deductions.length === 0 ? (
            <Text style={[styles.lineName, { color: theme.inkSubtle }]}>Kuch nahi kata</Text>
          ) : null}

          {deductions.map((line) => (
            <Pressable
              key={line.uuid}
              disabled={!settlement.is_editable || !canManage || line.source === 'auto'}
              onPress={() => openLine(line)}
              style={styles.line}
            >
              <View style={styles.lineLeft}>
                <Text style={[styles.lineName, { color: theme.ink }]}>{line.name}</Text>
                {line.source !== 'auto' ? (
                  <Text style={[styles.lineBasis, { color: theme.inkSubtle }]}>
                    {line.source === 'manual' ? 'HR ne jodi' : 'HR ne lagayi'}
                    {settlement.is_editable && canManage ? ' · tap to change' : ''}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.lineAmount, { color: theme.danger }]}>−{Money.rupee(line.amount, 2)}</Text>
            </Pressable>
          ))}
        </View>

        {suggestions.length > 0 ? (
          <>
            <Text style={[styles.section, { color: theme.inkMuted }]}>Sujhaav</Text>

            <Notice
              tone="info"
              title="Ye apne aap nahi katega"
              message="Tool ne bas nikaal ke dikhaya hai. Jab tak aap Apply nahi karoge, amount zero rahega."
            />

            {suggestions.map((line) => (
              <View
                key={line.uuid}
                style={[styles.suggestion, { backgroundColor: theme.surface, borderColor: theme.line }]}
              >
                <View style={styles.head}>
                  <Text numberOfLines={2} style={[styles.lineName, { color: theme.ink, flexShrink: 1 }]}>
                    {line.name}
                  </Text>
                  <Text style={[styles.lineAmount, { color: line.is_applied ? theme.danger : theme.inkSubtle }]}>
                    {line.is_applied ? '−' : ''}
                    {Money.rupee(line.is_applied ? line.amount : line.suggested_amount, 2)}
                  </Text>
                </View>

                {line.basis ? (
                  <Text style={[styles.lineBasis, { color: theme.inkSubtle }]}>{line.basis}</Text>
                ) : null}

                {line.is_applied && Number(line.amount) !== Number(line.suggested_amount) ? (
                  <Text style={[styles.lineBasis, { color: theme.warning }]}>
                    Poora {Money.rupee(line.suggested_amount, 2)} tha — aapne {Money.rupee(line.amount, 2)} rakha
                  </Text>
                ) : null}

                {settlement.is_editable && canManage ? (
                  <View style={styles.actions}>
                    {line.is_applied ? (
                      <>
                        <Button
                          label="Change amount"
                          variant="secondary"
                          onPress={() => openLine(line)}
                          disabled={busy}
                        />
                        <Button
                          label="Remove"
                          variant="secondary"
                          onPress={() => void applyLine(line, false)}
                          disabled={busy}
                        />
                      </>
                    ) : (
                      <>
                        <Button label="Apply" onPress={() => void applyLine(line, true)} disabled={busy} />
                        <Button
                          label="Apply part of it"
                          variant="secondary"
                          onPress={() => openLine(line)}
                          disabled={busy}
                        />
                      </>
                    )}
                  </View>
                ) : null}
              </View>
            ))}
          </>
        ) : null}

        {settlement.is_editable && canManage ? (
          <>
            <Button label="Add a deduction" variant="secondary" onPress={openAdd} disabled={busy} fullWidth />
            <Button
              label="Calculate again"
              variant="secondary"
              onPress={() => void act(`/fnf-settlements/${uuid}/calculate`, undefined, 'Dobara calculate ho gaya.')}
              disabled={busy}
              fullWidth
            />
          </>
        ) : null}

        {settlement.is_editable && canManage ? (
          settlement.is_stopped ? (
            <Button
              label="Stop hatao"
              variant="secondary"
              onPress={() => void act(`/fnf-settlements/${uuid}/release`, undefined, 'Stop hata diya.')}
              disabled={busy}
              fullWidth
            />
          ) : (
            <View style={styles.lines}>
              <Field
                label="Settlement rokna hai kyunki"
                value={stopReason}
                onChangeText={setStopReason}
                placeholder="Laptop wapas aane tak"
                editable={!busy}
              />
              <Button
                label="Stop this settlement"
                variant="secondary"
                onPress={() => void stop()}
                disabled={busy}
                fullWidth
              />
            </View>
          )
        ) : null}

        {settlement.status === 'calculated' && canApprove && !settlement.is_stopped ? (
          <>
            <Notice
              tone="info"
              title="Approve ke baad amount lock ho jaayega"
              message="Sujhaav lagana ya hatana, dono band ho jaayenge. Pehle sab check kar lo."
            />
            <Button
              label="Approve this settlement"
              onPress={() => void act(`/fnf-settlements/${uuid}/approve`, undefined, 'Approve ho gaya.')}
              loading={busy}
              fullWidth
            />
          </>
        ) : null}

        {canPay && quote ? (
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
        ) : null}

        {canPay && quote?.is_mock ? (
          <Notice
            tone="warning"
            title="Test bank laga hai"
            message="Asli paisa kahin nahi jaayega. Bank ki detail .env me daalne ke baad asli transfer hoga."
          />
        ) : null}

        {canPay && quote?.can_transfer ? (
          <Button label="Send the settlement amount" onPress={() => void transfer()} loading={busy} fullWidth />
        ) : null}

        {canPay && quote?.can_transfer ? (
          <Text style={[styles.words, { color: theme.inkSubtle }]}>
            Bhejne se pehle email par aaya code poocha jaayega.
          </Text>
        ) : null}

        {canPay && quote && !quote.can_transfer ? (
          <Notice tone="danger" title="Abhi nahi bhej sakte" message={(quote.blockers ?? []).join(' ')} />
        ) : null}

        {settlement.owes_company && settlement.status === 'approved' && canApprove ? (
          <Button
            label="Paisa mil gaya — settle karo"
            onPress={() =>
              void act(`/fnf-settlements/${uuid}/mark-recovered`, undefined, 'Recovery poori maan li.')
            }
            loading={busy}
            fullWidth
          />
        ) : null}

        <Button label="Download the statement" variant="secondary" onPress={() => void grab()} disabled={busy} fullWidth />

        {settlement.is_editable && canApprove ? (
          <Button
            label="Cancel this settlement"
            variant="secondary"
            onPress={() => void act(`/fnf-settlements/${uuid}/cancel`, undefined, 'Cancel kar diya.')}
            disabled={busy}
            fullWidth
          />
        ) : null}
      </ScrollView>

      <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={closeLine}>
        <Pressable style={styles.backdrop} onPress={closeLine} />

        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={[styles.sheetHead, { borderBottomColor: theme.line }]}>
            <Text numberOfLines={1} style={[styles.sheetTitle, { color: theme.ink }]}>
              {editing?.name ?? ''}
            </Text>
            <Pressable onPress={closeLine} hitSlop={10}>
              <Text style={[styles.closeMark, { color: theme.inkMuted }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {problem ? <Notice tone="danger" title="Could not do that" message={problem} /> : null}

            {editing ? (
              <>
                {Number(editing.suggested_amount) > 0 ? (
                  <Text style={[styles.hint, { color: theme.inkSubtle }]}>
                    Tool ne {Money.rupee(editing.suggested_amount, 2)} nikala tha. Aap jo rakhoge wahi katega.
                  </Text>
                ) : null}

                <Field
                  label="Deduct this much"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  editable={!busy}
                />

                <Button
                  label="Save"
                  onPress={() => void applyLine(editing, true, amount)}
                  loading={busy}
                  fullWidth
                />

                {editing.source === 'manual' ? (
                  <Button
                    label="Delete this line"
                    variant="secondary"
                    onPress={() => void removeLine(editing)}
                    disabled={busy}
                    fullWidth
                  />
                ) : (
                  <Button
                    label="Deduct nothing"
                    variant="secondary"
                    onPress={() => void applyLine(editing, false)}
                    disabled={busy}
                    fullWidth
                  />
                )}
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAdding(false)} />

        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={[styles.sheetHead, { borderBottomColor: theme.line }]}>
            <Text style={[styles.sheetTitle, { color: theme.ink }]}>Add a deduction</Text>
            <Pressable onPress={() => setAdding(false)} hitSlop={10}>
              <Text style={[styles.closeMark, { color: theme.inkMuted }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {problem ? <Notice tone="danger" title="Could not do that" message={problem} /> : null}

            <Field
              label="What for"
              value={name}
              onChangeText={setName}
              placeholder="Canteen dues"
              error={errors.name}
              editable={!busy}
            />

            <Field
              label="Amount"
              value={amount}
              onChangeText={setAmount}
              placeholder="500"
              keyboardType="decimal-pad"
              error={errors.amount}
              editable={!busy}
            />

            <Field
              label="Note"
              value={note}
              onChangeText={setNote}
              placeholder="September ka"
              editable={!busy}
            />

            <Button label="Add it" onPress={() => void addLine()} loading={busy} fullWidth />
          </ScrollView>
        </View>
      </Modal>

      <CodeSheet
        verification={verification}
        busy={busy}
        problem={codeProblem}
        onSubmit={(code) => void transfer(code)}
        onResend={() => void transfer()}
        onClose={() => {
          setVerification(null)
          setCodeProblem(null)
        }}
      />
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

function codeFor(name: string): string {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 22)

  return (slug || 'MANUAL') + '_' + String(Date.now()).slice(-5)
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
  words: {
    fontSize: font.xs,
  },
  section: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  lines: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 8,
  },
  lineLeft: {
    flexShrink: 1,
    gap: 2,
  },
  lineName: {
    fontSize: font.sm,
    fontWeight: '600',
  },
  lineBasis: {
    fontSize: font.xs,
  },
  lineAmount: {
    fontSize: font.sm,
    fontWeight: '700',
  },
  suggestion: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 6,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: 4,
  },
  route: {
    borderWidth: 1,
    borderRadius: radius.lg,
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '86%',
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
    gap: spacing.sm,
  },
  sheetTitle: {
    flexShrink: 1,
    fontSize: font.md,
    fontWeight: '800',
  },
  closeMark: {
    fontSize: font.md,
    fontWeight: '700',
  },
  sheetBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  hint: {
    fontSize: font.xs,
    paddingBottom: spacing.sm,
  },
})
