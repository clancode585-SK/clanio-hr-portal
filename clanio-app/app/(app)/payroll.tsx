import { useCallback, useState } from 'react'
import { useRouter } from 'expo-router'
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { ApiError, api, apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { today } from '@/lib/clock'
import { Money } from '@/lib/money'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Run = Record<string, any>

type Coverage = {
  month?: string
  headcount?: number
  ready?: number
  missing?: { employee_id: number; employee_code: string; name: string | null }[]
}

export default function PayrollScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { can } = useAuth()

  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(lastMonth())
  const [payDate, setPayDate] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<Run[]> => {
    const result = await apiList<Run>('/payroll-runs?per_page=50')

    return result.data
  }, [])

  const record = useResource<Run[]>(load, [])

  const coverageLoad = useCallback(async (): Promise<Coverage> => {
    try {
      return await api<Coverage>(`/salary-structures/coverage?month=${month}`)
    } catch {
      return {}
    }
  }, [month])

  const coverage = useResource<Coverage>(coverageLoad, [month])

  const close = () => {
    setOpen(false)
    setErrors({})
    setProblem(null)
  }

  const start = async () => {
    if (busy) {
      return
    }

    const found: Record<string, string> = {}

    if (!/^\d{4}-\d{2}$/.test(month.trim())) {
      found.month = 'Month YYYY-MM me do, jaise 2026-08'
    }

    if (payDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(payDate.trim())) {
      found.pay_date = 'Date YYYY-MM-DD me do'
    }

    setErrors(found)

    if (Object.keys(found).length > 0) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      const run = await api<Run>('/payroll-runs', {
        method: 'POST',
        body: { month: month.trim(), ...(payDate.trim() ? { pay_date: payDate.trim() } : {}) },
      })

      close()
      setDone(`${run.month_label} ka payroll khul gaya. Ab calculate karo.`)
      await record.refresh()
      router.push(`/payroll/${run.uuid}` as never)
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not open the payroll.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Payroll">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Payroll">
        <ErrorState message={record.error ?? 'Could not load payroll.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const runs = record.data
  const missing = coverage.data?.missing ?? []
  const canRun = can('payroll.run')

  return (
    <Screen
      title="Payroll"
      subtitle={runs.length === 0 ? 'Nothing run yet' : `${runs.length} month${runs.length === 1 ? '' : 's'}`}
      action={canRun ? { label: 'New', onPress: () => setOpen(true) } : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={record.refreshing}
            onRefresh={() => {
              void record.refresh()
              void coverage.refresh()
            }}
            tintColor={theme.brand}
          />
        }
      >
        {done ? <Notice tone="success" title="Opened" message={done} /> : null}

        {missing.length > 0 ? (
          <Notice
            tone="warning"
            title={`${missing.length} employee ka salary structure nahi hai`}
            message={
              missing.slice(0, 4).map((row) => row.employee_code).join(', ')
              + (missing.length > 4 ? ` aur ${missing.length - 4} more` : '')
              + '. Inki salary calculate nahi hogi — pehle structure set karo.'
            }
          />
        ) : null}

        {runs.length === 0 ? (
          <EmptyState
            title="No payroll yet"
            message="Ek mahina kholo, calculate karo, approve karo — phir salary bhej sakte ho."
            action={canRun ? { label: 'Open a month', onPress: () => setOpen(true) } : undefined}
          />
        ) : null}

        {runs.map((run) => (
          <Pressable
            key={run.uuid}
            onPress={() => router.push(`/payroll/${run.uuid}` as never)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: pressed ? theme.canvas : theme.surface, borderColor: theme.line },
            ]}
          >
            <View style={styles.head}>
              <Text style={[styles.month, { color: theme.ink }]}>{run.month_label}</Text>
              <View style={[styles.tag, { backgroundColor: soft(theme, run.status) }]}>
                <Text style={[styles.tagText, { color: ink(theme, run.status) }]}>{run.status_label}</Text>
              </View>
            </View>

            <Text style={[styles.meta, { color: theme.inkMuted }]}>
              {run.headcount} employee · pay date {run.pay_date ?? '—'}
            </Text>

            <View style={styles.numbers}>
              <Cell label="Net" value={Money.rupee(run.total_net)} strong />
              <Cell label="Deductions" value={Money.rupee(run.total_deductions)} />
              <Cell label="Employer" value={Money.rupee(run.total_employer)} />
            </View>

            {run.headcount > 0 ? (
              <View style={styles.progress}>
                <View style={[styles.track, { backgroundColor: theme.canvas }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        backgroundColor: theme.success,
                        width: `${Math.round((run.paid_count / Math.max(run.headcount, 1)) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: theme.inkSubtle }]}>
                  {run.paid_count} of {run.headcount} paid
                  {run.pending_amount > 0 ? ` · ${Money.short(run.pending_amount)} baaki` : ''}
                </Text>
              </View>
            ) : (
              <Text style={[styles.hint, { color: theme.inkSubtle }]}>Khola hai, calculate karna baaki hai</Text>
            )}
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />

        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={[styles.grab, { backgroundColor: theme.line }]} />

          <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.sheetTitle, { color: theme.ink }]}>Open a month</Text>

            {problem ? <Notice tone="danger" title="Could not open" message={problem} /> : null}

            <View style={styles.form}>
              <Field
                label="Month"
                value={month}
                onChangeText={setMonth}
                placeholder="2026-08"
                error={errors.month}
                editable={!busy}
              />
              <Field
                label="Pay date"
                value={payDate}
                onChangeText={setPayDate}
                placeholder="Company setting se khud le lega"
                error={errors.pay_date}
                editable={!busy}
              />

              <Notice
                tone="info"
                title="Is date par salary khud chali jaayegi"
                message="Payroll approve hone ke baad, pay date aate hi salary apne aap transfer ho jaati hai. Pehle bhejna ho to manually bhi bhej sakte ho."
              />

              <Button label="Open this month" onPress={start} loading={busy} fullWidth />
              <Button label="Cancel" variant="ghost" onPress={close} disabled={busy} fullWidth />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  )
}

function Cell({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const theme = useTheme()

  return (
    <View style={styles.cell}>
      <Text style={[styles.cellLabel, { color: theme.inkSubtle }]}>{label}</Text>
      <Text style={[styles.cellValue, { color: strong ? theme.ink : theme.inkMuted, fontWeight: strong ? '800' : '600' }]}>
        {value}
      </Text>
    </View>
  )
}

function lastMonth(): string {
  const [year, month] = today().split('-').map(Number)
  const moved = new Date(year, month - 2, 1)
  const pad = (n: number) => String(n).padStart(2, '0')

  return `${moved.getFullYear()}-${pad(moved.getMonth() + 1)}`
}

function soft(theme: ReturnType<typeof useTheme>, status: string): string {
  return status === 'paid'
    ? theme.successSoft
    : status === 'approved'
      ? theme.brandSoft
      : status === 'cancelled'
        ? theme.dangerSoft
        : theme.warningSoft
}

function ink(theme: ReturnType<typeof useTheme>, status: string): string {
  return status === 'paid'
    ? theme.success
    : status === 'approved'
      ? theme.brand
      : status === 'cancelled'
        ? theme.danger
        : theme.warning
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 6,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  month: {
    flexShrink: 1,
    fontSize: font.lg,
    fontWeight: '800',
    letterSpacing: -0.3,
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
    fontSize: font.sm,
  },
  numbers: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingTop: 6,
  },
  cell: {
    gap: 1,
  },
  cellLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cellValue: {
    fontSize: font.sm,
  },
  progress: {
    paddingTop: 8,
    gap: 4,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  progressText: {
    fontSize: font.xs,
    fontWeight: '600',
  },
  hint: {
    fontSize: font.xs,
    paddingTop: 6,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
  },
  grab: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  sheetBody: {
    paddingHorizontal: spacing.xl,
  },
  sheetTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
})
