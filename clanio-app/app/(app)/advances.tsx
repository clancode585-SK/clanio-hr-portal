import { useCallback, useState } from 'react'
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CodeSheet, type Verification } from '@/components/CodeSheet'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Pager } from '@/components/ui/Pager'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { ApiError, api, apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatDate } from '@/lib/clock'
import { Money } from '@/lib/money'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Advance = Record<string, any>

type PageMeta = {
  current_page: number
  per_page: number
  total: number
  last_page: number
}

type Loaded = {
  rows: Advance[]
  page: PageMeta | null
  summary: Record<string, any>
}

const PER_PAGE = 25

export default function AdvancesScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { can } = useAuth()

  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const [planFor, setPlanFor] = useState<Advance | null>(null)
  const [emi, setEmi] = useState('')
  const [startPeriod, setStartPeriod] = useState('')

  const [transferFor, setTransferFor] = useState<Advance | null>(null)
  const [verification, setVerification] = useState<Verification | null>(null)
  const [codeProblem, setCodeProblem] = useState<string | null>(null)

  const load = useCallback(async (): Promise<Loaded> => {
    const list = await apiList<Advance>(`/advances?per_page=${PER_PAGE}&page=${page}`)
    const summary = await api<Record<string, any>>('/advances/summary')

    return { rows: list.data, page: (list.meta as PageMeta) ?? null, summary }
  }, [page])

  const record = useResource<Loaded>(load, [page])

  const canApprove = can('advance.approve')
  const canManage = can('advance.manage')

  const act = async (key: string, run: () => Promise<string>) => {
    if (busy) {
      return
    }

    setBusy(key)
    setProblem(null)
    setDone(null)

    try {
      setDone(await run())
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Ye nahi ho paaya.')
    } finally {
      setBusy(null)
    }
  }

  const decide = (row: Advance, approve: boolean) =>
    act(`${row.uuid}:decide`, async () => {
      await api(`/advances/${row.uuid}/decide`, { method: 'POST', body: { approve } })

      return approve
        ? `${row.employee_name} ka advance approve ho gaya — ab transfer karo.`
        : `${row.employee_name} ka advance reject kar diya.`
    })

  const savePlan = () =>
    act('plan', async () => {
      const row = planFor as Advance

      await api(`/advances/${row.uuid}/plan`, {
        method: 'PUT',
        body: {
          emi_amount: Number(emi),
          ...(startPeriod.trim() === '' ? {} : { start_period: startPeriod.trim() }),
        },
      })

      setPlanFor(null)

      return `EMI ${Money.rupee(Number(emi))} set ho gayi.`
    })

  const hold = (row: Advance) =>
    act(`${row.uuid}:hold`, async () => {
      await api(`/advances/${row.uuid}/hold`, { method: 'POST', body: { reason: 'HR ne roka' } })

      return `${row.employee_name} ka transfer rok diya.`
    })

  const release = (row: Advance) =>
    act(`${row.uuid}:release`, async () => {
      await api(`/advances/${row.uuid}/release`, { method: 'POST', body: {} })

      return `${row.employee_name} ka transfer khol diya.`
    })

  const cancel = (row: Advance) =>
    act(`${row.uuid}:cancel`, async () => {
      await api(`/advances/${row.uuid}/cancel`, { method: 'POST', body: {} })

      return `${row.employee_name} ka advance cancel ho gaya.`
    })

  const transfer = async (row: Advance, code?: string) => {
    if (busy) {
      return
    }

    setBusy(`${row.uuid}:transfer`)
    setProblem(null)
    setCodeProblem(null)

    try {
      const answer = await api<Record<string, any>>(`/advances/${row.uuid}/transfer`, {
        method: 'POST',
        body: code === undefined ? {} : { verification_uuid: verification?.uuid, code },
      })

      if (answer?.verification !== undefined) {
        setTransferFor(row)
        setVerification(answer.verification as Verification)
        setBusy(null)

        return
      }

      setVerification(null)
      setTransferFor(null)

      if (answer.transfer?.status === 'success') {
        setDone(
          `${row.employee_name} ko ${Money.rupee(row.amount)} bhej diya. `
          + `EMI ${answer.advance?.start_period ?? 'agle mahine'} se katni shuru hogi.`
        )
      } else {
        setProblem(answer.transfer?.failure_reason ?? 'Bank ne mana kiya.')
      }

      await record.refresh()
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'Paisa nahi bhej paaye.'

      if (code !== undefined) {
        setCodeProblem(message)
      } else {
        setProblem(message)
      }
    } finally {
      setBusy(null)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Salary Advance">
        <Loader />
      </Screen>
    )
  }

  if (record.error !== null) {
    return (
      <Screen title="Salary Advance">
        <ErrorState message={record.error} onRetry={record.refresh} />
      </Screen>
    )
  }

  const rows = record.data?.rows ?? []
  const pageMeta = record.data?.page ?? null
  const summary = record.data?.summary ?? {}

  return (
    <Screen
      title="Salary Advance"
      subtitle={`${summary.running ?? 0} chal rahe · ${Money.rupee(summary.outstanding ?? 0)} baaki`}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {done ? <Notice tone="success" title="Ho gaya" message={done} /> : null}
        {problem ? <Notice tone="danger" title="Nahi ho paaya" message={problem} /> : null}

        <View style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Cell label="Approval baaki" value={String(summary.pending ?? 0)} />
          <Cell label="Transfer baaki" value={String(summary.awaiting_transfer ?? 0)} />
          <Cell label="Chal rahe" value={String(summary.running ?? 0)} />
          <Cell label="Is saal diya" value={Money.rupee(summary.given_this_year ?? 0)} />
        </View>

        {rows.map((row) => (
          <View
            key={row.uuid}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}
          >
            <View style={styles.head}>
              <Text numberOfLines={1} style={[styles.name, { color: theme.ink }]}>
                {row.employee_name}
              </Text>
              <View style={[styles.tag, { backgroundColor: soft(theme, row.status) }]}>
                <Text style={[styles.tagText, { color: ink(theme, row.status) }]}>{row.status_label}</Text>
              </View>
            </View>

            <Text style={[styles.meta, { color: theme.inkMuted }]}>
              {row.employee_code} · {row.reference}
              {row.requested_at ? ` · ${formatDate(row.requested_at)}` : ''}
            </Text>

            <Text style={[styles.reason, { color: theme.inkMuted }]}>{row.reason}</Text>

            <View style={styles.numbers}>
              <Stat label="Amount" value={Money.rupee(row.amount)} strong />
              <Stat label="EMI" value={Money.rupee(row.emi_amount)} />
              {row.status === 'disbursed' ? (
                <>
                  <Stat label="Baaki" value={Money.rupee(row.outstanding)} />
                  <Stat label="Kist bachi" value={String(row.instalments_left)} />
                </>
              ) : null}
              {row.status === 'closed' ? <Stat label="Pura hua" value={Money.rupee(row.recovered)} /> : null}
            </View>

            {row.status === 'disbursed' ? (
              <View style={[styles.bar, { backgroundColor: theme.canvas }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      backgroundColor: theme.brand,
                      width: `${pct(row)}%`,
                    },
                  ]}
                />
              </View>
            ) : null}

            {row.payment_status === 'on_hold' ? (
              <Text style={[styles.flag, { color: theme.danger }]}>
                Transfer roka hua{row.hold_reason ? ` — ${row.hold_reason}` : ''}
              </Text>
            ) : null}

            {row.decision_note ? (
              <Text style={[styles.flag, { color: theme.inkSubtle }]}>Note: {row.decision_note}</Text>
            ) : null}

            <View style={styles.actions}>
              {row.can?.decide ? (
                <>
                  <Button
                    label="Approve"
                    onPress={() => void decide(row, true)}
                    loading={busy === `${row.uuid}:decide`}
                  />
                  <Button
                    label="Reject"
                    variant="ghost"
                    onPress={() => void decide(row, false)}
                    loading={busy === `${row.uuid}:decide`}
                  />
                </>
              ) : null}

              {row.can?.transfer ? (
                <Button
                  label={`Transfer ${Money.rupee(row.amount)}`}
                  onPress={() => void transfer(row)}
                  loading={busy === `${row.uuid}:transfer`}
                />
              ) : null}

              {row.can?.edit_plan ? (
                <Button
                  label="EMI badlo"
                  variant="ghost"
                  onPress={() => {
                    setPlanFor(row)
                    setEmi(String(row.emi_amount))
                    setStartPeriod(row.start_period ?? '')
                  }}
                />
              ) : null}

              {canManage && row.status === 'approved' ? (
                row.payment_status === 'on_hold' ? (
                  <Button
                    label="Khol do"
                    variant="ghost"
                    onPress={() => void release(row)}
                    loading={busy === `${row.uuid}:release`}
                  />
                ) : (
                  <Button
                    label="Rok do"
                    variant="ghost"
                    onPress={() => void hold(row)}
                    loading={busy === `${row.uuid}:hold`}
                  />
                )
              ) : null}

              {row.can?.cancel ? (
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={() => void cancel(row)}
                  loading={busy === `${row.uuid}:cancel`}
                />
              ) : null}
            </View>
          </View>
        ))}

        {pageMeta ? (
          <Pager
            page={pageMeta.current_page}
            lastPage={pageMeta.last_page}
            total={pageMeta.total}
            perPage={pageMeta.per_page}
            busy={record.refreshing || busy !== null}
            onChange={setPage}
          />
        ) : null}

        {rows.length === 0 ? (
          <EmptyState
            title="Koi advance nahi"
            message={
              canApprove
                ? 'Jab koi advance maangega, request yahan aayegi.'
                : 'Abhi kisi ka advance nahi chal raha.'
            }
          />
        ) : null}
      </ScrollView>

      <Modal visible={planFor !== null} transparent animationType="slide" onRequestClose={() => setPlanFor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPlanFor(null)} />

        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <Text style={[styles.sheetTitle, { color: theme.ink }]}>EMI kitni katni hai</Text>
          <Text style={[styles.sheetHint, { color: theme.inkMuted }]}>
            {planFor ? `${planFor.employee_name} · baaki ${Money.rupee(planFor.outstanding || planFor.amount)}` : ''}
          </Text>

          <Field
            label="EMI amount"
            value={emi}
            onChangeText={setEmi}
            keyboardType="numeric"
            placeholder="10000"
            editable={busy === null}
          />

          <Field
            label="Kis mahine se (optional)"
            value={startPeriod}
            onChangeText={setStartPeriod}
            placeholder="2026-10"
            editable={busy === null}
          />

          <Button
            label="Save"
            onPress={() => void savePlan()}
            loading={busy === 'plan'}
            disabled={!/^\d+(\.\d+)?$/.test(emi.trim()) || Number(emi) <= 0}
            fullWidth
          />
        </View>
      </Modal>

      <CodeSheet
        verification={verification}
        busy={busy !== null}
        problem={codeProblem}
        onSubmit={(code) => transferFor && void transfer(transferFor, code)}
        onResend={() => transferFor && void transfer(transferFor)}
        onClose={() => {
          setVerification(null)
          setTransferFor(null)
          setCodeProblem(null)
        }}
      />
    </Screen>
  )
}

function pct(row: Advance): number {
  const amount = Number(row.amount) || 1

  return Math.min(100, Math.max(0, (Number(row.recovered) / amount) * 100))
}

function Cell({ label, value }: { label: string; value: string }) {
  const theme = useTheme()

  return (
    <View style={styles.cell}>
      <Text style={[styles.cellValue, { color: theme.ink }]}>{value}</Text>
      <Text style={[styles.cellLabel, { color: theme.inkSubtle }]}>{label}</Text>
    </View>
  )
}

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const theme = useTheme()

  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: theme.inkSubtle }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.ink, fontSize: strong ? font.md : font.sm }]}>
        {value}
      </Text>
    </View>
  )
}

function soft(theme: any, status: string): string {
  switch (status) {
    case 'pending':
      return theme.warningSoft
    case 'approved':
      return theme.infoSoft
    case 'disbursed':
      return theme.brandSoft ?? theme.infoSoft
    case 'closed':
      return theme.successSoft
    default:
      return theme.canvas
  }
}

function ink(theme: any, status: string): string {
  switch (status) {
    case 'pending':
      return theme.warning
    case 'approved':
      return theme.info
    case 'disbursed':
      return theme.brand
    case 'closed':
      return theme.success
    default:
      return theme.inkMuted
  }
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  cell: { minWidth: '40%', flexGrow: 1 },
  cellValue: { fontSize: font.lg, fontWeight: '700' },
  cellLabel: { fontSize: font.xs, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1, fontSize: font.md, fontWeight: '700' },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  tagText: { fontSize: font.xs, fontWeight: '700' },
  meta: { fontSize: font.xs },
  reason: { fontSize: font.sm },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  stat: { minWidth: 80 },
  statLabel: { fontSize: font.xs },
  statValue: { fontWeight: '700' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: spacing.xs },
  barFill: { height: 6, borderRadius: 3 },
  flag: { fontSize: font.xs, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetTitle: { fontSize: font.lg, fontWeight: '700' },
  sheetHint: { fontSize: font.sm, marginTop: -spacing.sm },
})
