import { useCallback, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ListRow } from '@/components/ui/ListRow'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Row = Record<string, any>

type Weights = {
  delivery?: number
  discipline?: number
  overdue_penalty?: number
  absent_penalty?: number
  missed_report_penalty?: number
}

type Loaded = {
  score: Row | null
  trend: Row[]
  leaderboard: Row[]
  weights: Weights | null
}

const tabs = [
  { key: 'me', label: 'My score' },
  { key: 'board', label: 'Leaderboard' },
]

export default function WorkRecordScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { can } = useAuth()

  const [tab, setTab] = useState('me')
  const [month, setMonth] = useState(currentMonth())
  const [open, setOpen] = useState(false)
  const [delivery, setDelivery] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [overdue, setOverdue] = useState('')
  const [absent, setAbsent] = useState('')
  const [missed, setMissed] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canManage = can('performance.manage')

  const load = useCallback(async (): Promise<Loaded> => {
    const quiet = async <T,>(path: string, fallback: T): Promise<T> => {
      try {
        return await api<T>(path)
      } catch {
        return fallback
      }
    }

    const [score, trend, leaderboard, weights] = await Promise.all([
      quiet<Row | null>(`/performance/score?month=${month}`, null),
      quiet<Row[]>('/performance/trend?months=6', []),
      quiet<Row[]>(`/performance/leaderboard?month=${month}`, []),
      quiet<Weights | null>('/performance/weights', null),
    ])

    return { score, trend, leaderboard, weights }
  }, [month])

  const record = useResource<Loaded>(load, [month])

  const startWeights = () => {
    const weights = record.data?.weights

    setDelivery(weights?.delivery != null ? String(weights.delivery) : '')
    setDiscipline(weights?.discipline != null ? String(weights.discipline) : '')
    setOverdue(weights?.overdue_penalty != null ? String(weights.overdue_penalty) : '')
    setAbsent(weights?.absent_penalty != null ? String(weights.absent_penalty) : '')
    setMissed(weights?.missed_report_penalty != null ? String(weights.missed_report_penalty) : '')
    setErrors({})
    setProblem(null)
    setOpen(true)
  }

  const saveWeights = async () => {
    if (busy) {
      return
    }

    const found: Record<string, string> = {}

    if (!Number.isInteger(Number(delivery)) || Number(delivery) < 0 || Number(delivery) > 100) {
      found.delivery = '0 to 100'
    }

    if (!Number.isInteger(Number(discipline)) || Number(discipline) < 0 || Number(discipline) > 100) {
      found.discipline = '0 to 100'
    }

    setErrors(found)

    if (Object.keys(found).length > 0) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api('/performance/weights', {
        method: 'PUT',
        body: {
          delivery: Number(delivery),
          discipline: Number(discipline),
          overdue_penalty: overdue.trim() ? Number(overdue) : null,
          absent_penalty: absent.trim() ? Number(absent) : null,
          missed_report_penalty: missed.trim() ? Number(missed) : null,
        },
      })

      setOpen(false)
      await record.reload()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 422 && Object.keys(caught.fields).length > 0) {
        const mapped: Record<string, string> = {}

        for (const [field, messages] of Object.entries(caught.fields)) {
          mapped[field] = messages[0]
        }

        setErrors(mapped)
        setProblem('Check the highlighted fields.')
      } else {
        setProblem(caught instanceof ApiError ? caught.message : 'Could not save the weights.')
      }
    } finally {
      setBusy(false)
    }
  }

  const freeze = async () => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api('/performance/freeze', { method: 'POST', body: { month } })
      await record.reload()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not freeze the month.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Work Record">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Work Record">
        <ErrorState message={record.error ?? 'Could not load performance.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const { score, trend, leaderboard } = record.data
  const value = score?.score ?? score?.total ?? null

  return (
    <Screen
      title="Work Record"
      subtitle={month}
      action={canManage ? { label: 'Weights', onPress: startWeights } : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {problem ? <Notice tone="danger" title="Failed" message={problem} /> : null}

        <View style={[styles.tabs, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
          {tabs.map((entry) => {
            const active = entry.key === tab

            return (
              <Pressable
                key={entry.key}
                onPress={() => setTab(entry.key)}
                style={[styles.tab, { backgroundColor: active ? theme.surface : 'transparent' }]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: active ? theme.brand : theme.inkMuted, fontWeight: active ? '700' : '500' },
                  ]}
                >
                  {entry.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.monthRow}>
          <Pressable
            onPress={() => setMonth(shiftMonth(month, -1))}
            style={[styles.monthButton, { borderColor: theme.line, backgroundColor: theme.surface }]}
          >
            <Text style={[styles.monthButtonText, { color: theme.brand }]}>Previous</Text>
          </Pressable>
          <Pressable
            onPress={() => setMonth(currentMonth())}
            style={[styles.monthButton, { borderColor: theme.line, backgroundColor: theme.surface }]}
          >
            <Text style={[styles.monthButtonText, { color: theme.brand }]}>This month</Text>
          </Pressable>
        </View>

        {tab === 'me' ? (
          <>
            <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Text style={[styles.heroLabel, { color: theme.inkMuted }]}>Score this month</Text>
              <Text style={[styles.heroValue, { color: theme.brand }]}>{value != null ? `${value}` : '—'}</Text>
              {score?.is_frozen ? (
                <Text style={[styles.heroMeta, { color: theme.inkSubtle }]}>Locked for the month</Text>
              ) : null}
            </View>

            {score ? (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                <Row label="Delivery" value={score.delivery_score ?? score.score_breakdown?.delivery} />
                <Row label="Discipline" value={score.discipline_score ?? score.score_breakdown?.discipline} />
                <Row label="Penalty" value={score.penalty ?? score.score_breakdown?.penalty} />
                <Row label="Goal score" value={score.goal_score} />
                <Row label="Tasks assigned" value={score.tasks_assigned ?? score.tasks?.assigned} />
                <Row label="Tasks done" value={score.tasks_done ?? score.tasks?.done} />
              </View>
            ) : (
              <Notice tone="info" title="No score yet" message="Scores build up from tasks, reports and attendance." />
            )}

            {trend.length > 0 ? (
              <>
                <Text style={[styles.group, { color: theme.inkSubtle }]}>Last months</Text>

                {trend.map((row, index) => (
                  <View
                    key={String(row.period_month ?? row.month ?? index)}
                    style={[styles.trendRow, { backgroundColor: theme.surface, borderColor: theme.line }]}
                  >
                    <Text style={[styles.trendMonth, { color: theme.inkMuted }]}>
                      {String(row.period_month ?? row.month ?? '').slice(0, 7)}
                    </Text>

                    <View style={[styles.trendTrack, { backgroundColor: theme.canvas }]}>
                      <View
                        style={[
                          styles.trendFill,
                          {
                            backgroundColor: theme.brand,
                            width: `${Math.min(100, Math.max(0, Number(row.score ?? 0)))}%`,
                          },
                        ]}
                      />
                    </View>

                    <Text style={[styles.trendValue, { color: theme.ink }]}>{row.score ?? '—'}</Text>
                  </View>
                ))}
              </>
            ) : null}

            {canManage && !score?.is_frozen ? (
              <Button label="Freeze this month" variant="secondary" onPress={freeze} loading={busy} fullWidth />
            ) : null}
          </>
        ) : leaderboard.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState title="Nothing to rank yet" message="Scores show up here once the month has activity." />
          </View>
        ) : (
          leaderboard.map((row, index) => (
            <ListRow
              key={String(row.employee_id ?? row.id ?? index)}
              title={row.employee?.name ?? row.employee_name ?? 'Employee'}
              subtitle={row.department ?? row.employee?.department?.name ?? undefined}
              badge={`#${index + 1}`}
              meta={row.score != null ? String(row.score) : undefined}
            />
          ))
        )}
      </ScrollView>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={[styles.grab, { backgroundColor: theme.line }]} />

            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>How the score is built</Text>

              {problem ? <Notice tone="danger" title="Could not save" message={problem} /> : null}

              <View style={styles.form}>
                <Notice
                  tone="info"
                  title="Delivery plus discipline"
                  message="Those two should add up to 100. Penalties are cut from the total."
                />

                <Field label="Delivery weight" value={delivery} onChangeText={setDelivery} placeholder="60" keyboardType="number-pad" error={errors.delivery} editable={!busy} />
                <Field label="Discipline weight" value={discipline} onChangeText={setDiscipline} placeholder="40" keyboardType="number-pad" error={errors.discipline} editable={!busy} />
                <Field label="Overdue task penalty" value={overdue} onChangeText={setOverdue} placeholder="10" keyboardType="number-pad" error={errors.overdue_penalty} editable={!busy} />
                <Field label="Absent penalty" value={absent} onChangeText={setAbsent} placeholder="10" keyboardType="number-pad" error={errors.absent_penalty} editable={!busy} />
                <Field label="Missed report penalty" value={missed} onChangeText={setMissed} placeholder="5" keyboardType="number-pad" error={errors.missed_report_penalty} editable={!busy} />

                <Button label="Save weights" onPress={saveWeights} loading={busy} fullWidth />
                <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} disabled={busy} fullWidth />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  )
}

function Row({ label, value }: { label: string; value: unknown }) {
  const theme = useTheme()

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.inkMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.ink }]}>{value != null ? String(value) : '—'}</Text>
    </View>
  )
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function shiftMonth(value: string, delta: number): string {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
  tabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  tabLabel: {
    fontSize: font.sm,
  },
  monthRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  monthButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 9,
  },
  monthButtonText: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  hero: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    gap: 2,
  },
  heroLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroValue: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  heroMeta: {
    fontSize: font.xs,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
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
    fontSize: font.sm,
    fontWeight: '600',
  },
  group: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  trendMonth: {
    fontSize: font.xs,
    fontWeight: '700',
    width: 58,
  },
  trendTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  trendFill: {
    height: 8,
    borderRadius: 4,
  },
  trendValue: {
    fontSize: font.sm,
    fontWeight: '700',
    width: 34,
    textAlign: 'right',
  },
  empty: {
    flex: 1,
    minHeight: 300,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '90%',
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
