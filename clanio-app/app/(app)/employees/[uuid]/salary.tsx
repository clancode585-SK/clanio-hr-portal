import { useCallback, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { ApiError, api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { today } from '@/lib/clock'
import { Money } from '@/lib/money'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Structure = Record<string, any>
type Preview = Record<string, any>

export default function EmployeeSalaryScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { uuid } = useLocalSearchParams<{ uuid: string }>()
  const { can } = useAuth()

  const [open, setOpen] = useState(false)
  const [ctc, setCtc] = useState('')
  const [from, setFrom] = useState(today())
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => api<Structure[]>(`/employees/${uuid}/salary-structures`), [uuid])
  const record = useResource<Structure[]>(load, [uuid])

  const canManage = can('salary_structure.manage')

  const close = () => {
    setOpen(false)
    setPreview(null)
    setErrors({})
    setProblem(null)
  }

  const validate = (): boolean => {
    const found: Record<string, string> = {}
    const amount = Number(ctc)

    if (!Number.isFinite(amount) || amount < 1) {
      found.annual_ctc = 'Annual CTC daalo, jaise 600000'
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from.trim())) {
      found.effective_from = 'Date YYYY-MM-DD me do'
    }

    setErrors(found)

    return Object.keys(found).length === 0
  }

  const runPreview = async () => {
    if (busy || !validate()) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      setPreview(
        await api<Preview>('/salary-structures/preview', {
          method: 'POST',
          body: { annual_ctc: Number(ctc), effective_from: from.trim() },
        })
      )
    } catch (caught) {
      setPreview(null)
      setProblem(caught instanceof ApiError ? caught.message : 'Could not work out the breakup.')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (busy || !validate()) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      const saved = await api<Structure>(`/employees/${uuid}/salary-structures`, {
        method: 'POST',
        body: {
          annual_ctc: Number(ctc),
          effective_from: from.trim(),
          ...(reason.trim() ? { revision_reason: reason.trim() } : {}),
        },
      })

      close()
      setCtc('')
      setReason('')
      setDone(`${saved.effective_from} se ₹${saved.annual_ctc_words} ka structure lag gaya.`)
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not save the structure.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Salary" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Salary" leading="back">
        <ErrorState message={record.error ?? 'Could not load the salary.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const structures = record.data
  const current = structures.find((row) => row.is_current)

  return (
    <Screen
      title="Salary"
      subtitle={current ? `₹${current.annual_ctc_words} a year` : 'Not set yet'}
      leading="back"
      action={canManage ? { label: 'Revise', onPress: () => setOpen(true) } : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {done ? <Notice tone="success" title="Saved" message={done} /> : null}

        {structures.length === 0 ? (
          <EmptyState
            title="No salary structure yet"
            message="Iske bina payroll me ye employee nahi aayega. Annual CTC daalo, baaki breakup khud ban jaayega."
            action={canManage ? { label: 'Set the salary', onPress: () => setOpen(true) } : undefined}
          />
        ) : null}

        {structures.map((structure) => (
          <View
            key={structure.uuid}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: structure.is_current ? theme.brand : theme.line }]}
          >
            <View style={styles.head}>
              <Text style={[styles.ctc, { color: theme.ink }]}>₹{structure.annual_ctc_words}</Text>
              <View
                style={[
                  styles.tag,
                  { backgroundColor: structure.is_current ? theme.brandSoft : theme.canvas },
                ]}
              >
                <Text style={[styles.tagText, { color: structure.is_current ? theme.brand : theme.inkSubtle }]}>
                  {structure.is_current ? 'Current' : 'Past'}
                </Text>
              </View>
            </View>

            <Text style={[styles.meta, { color: theme.inkMuted }]}>
              {structure.effective_from} to {structure.effective_to ?? 'now'}
              {structure.revision_reason ? ` · ${structure.revision_reason}` : ''}
            </Text>

            <View style={styles.numbers}>
              <Cell label="Gross / month" value={Money.rupee(structure.monthly_gross)} />
              <Cell label="Take home" value={Money.rupee(structure.monthly_net)} strong />
            </View>

            <View style={[styles.lines, { borderTopColor: theme.line }]}>
              {(structure.lines ?? []).map((line: Record<string, any>) => (
                <View key={line.code} style={styles.line}>
                  <Text
                    style={[
                      styles.lineName,
                      { color: line.kind === 'employer_cost' ? theme.inkSubtle : theme.ink },
                    ]}
                  >
                    {line.name}
                    {line.kind === 'employer_cost' ? ' (company)' : ''}
                  </Text>
                  <Text
                    style={[
                      styles.lineAmount,
                      { color: line.kind === 'deduction' ? theme.danger : theme.ink },
                    ]}
                  >
                    {line.kind === 'deduction' ? '−' : ''}
                    {Money.rupee(line.monthly_amount, 2)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />

        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={[styles.grab, { backgroundColor: theme.line }]} />

          <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.sheetTitle, { color: theme.ink }]}>
              {current ? 'Revise the salary' : 'Set the salary'}
            </Text>

            {problem ? <Notice tone="danger" title="Could not do that" message={problem} /> : null}

            <View style={styles.form}>
              <Field
                label="Annual CTC"
                value={ctc}
                onChangeText={(value) => {
                  setCtc(value)
                  setPreview(null)
                }}
                placeholder="600000"
                keyboardType="number-pad"
                error={errors.annual_ctc}
                editable={!busy}
              />
              <Field
                label="Effective from"
                value={from}
                onChangeText={(value) => {
                  setFrom(value)
                  setPreview(null)
                }}
                placeholder="2026-04-01"
                error={errors.effective_from}
                editable={!busy}
              />
              <Field
                label="Why"
                value={reason}
                onChangeText={setReason}
                placeholder="Annual hike, promotion — optional"
                editable={!busy}
              />

              {current ? (
                <Notice
                  tone="info"
                  title="Purana structure apne aap band ho jaayega"
                  message={`${current.effective_from} wala structure is date se ek din pehle khatam ho jaayega. Purani payslip nahi badlegi.`}
                />
              ) : null}

              {preview === null ? (
                <Button label="Show me the breakup" variant="secondary" onPress={runPreview} loading={busy} fullWidth />
              ) : (
                <>
                  <View style={[styles.lines, styles.previewLines, { borderColor: theme.line }]}>
                    {(preview.lines ?? []).map((line: Record<string, any>) => (
                      <View key={line.code} style={styles.line}>
                        <Text
                          style={[
                            styles.lineName,
                            { color: line.kind === 'employer_cost' ? theme.inkSubtle : theme.ink },
                          ]}
                        >
                          {line.name}
                          {line.kind === 'employer_cost' ? ' (company)' : ''}
                        </Text>
                        <Text
                          style={[
                            styles.lineAmount,
                            { color: line.kind === 'deduction' ? theme.danger : theme.ink },
                          ]}
                        >
                          {line.kind === 'deduction' ? '−' : ''}
                          {Money.rupee(line.monthly_amount, 2)}
                        </Text>
                      </View>
                    ))}

                    <View style={[styles.line, styles.lineTotal, { borderTopColor: theme.ink }]}>
                      <Text style={[styles.lineName, { color: theme.ink, fontWeight: '800' }]}>Take home</Text>
                      <Text style={[styles.lineAmount, { color: theme.ink, fontWeight: '800' }]}>
                        {Money.rupee(preview.totals?.monthly_net, 2)}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.meta, { color: theme.inkSubtle }]}>
                    Cost to company {Money.rupee(preview.totals?.annual_cost_to_company)} a year
                  </Text>

                  <Button label="Save this structure" onPress={save} loading={busy} fullWidth />
                </>
              )}

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
      <Text
        style={[
          styles.cellValue,
          { color: theme.ink, fontWeight: strong ? '800' : '600', fontSize: strong ? font.lg : font.md },
        ]}
      >
        {value}
      </Text>
    </View>
  )
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
    gap: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ctc: {
    flexShrink: 1,
    fontSize: font.xl,
    fontWeight: '800',
    letterSpacing: -0.4,
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
  numbers: {
    flexDirection: 'row',
    gap: spacing.xl,
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
  cellValue: {},
  lines: {
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  previewLines: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: 0,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 6,
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
  lineAmount: {
    fontSize: font.sm,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '92%',
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
