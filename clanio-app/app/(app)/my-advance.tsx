import { useCallback, useState } from 'react'
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { ApiError, api } from '@/lib/api'
import { formatDate } from '@/lib/clock'
import { Money } from '@/lib/money'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Advance = Record<string, any>

export default function MyAdvanceScreen() {
  const theme = useTheme()

  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [amount, setAmount] = useState('')
  const [months, setMonths] = useState('')
  const [emi, setEmi] = useState('')
  const [reason, setReason] = useState('')

  const load = useCallback(() => api<Advance[]>('/my-advances'), [])
  const record = useResource<Advance[]>(load, [])

  const rows = record.data ?? []
  const open = rows.find((row) => ['pending', 'approved', 'disbursed'].includes(row.status))

  // Employee months daale to EMI apne aap, aur EMI daale to months apne aap
  const suggestedEmi = () => {
    const a = Number(amount)
    const m = Number(months)

    return a > 0 && m > 0 ? Math.round((a / m) * 100) / 100 : 0
  }

  const submit = async () => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)
    setDone(null)

    try {
      await api('/my-advances', {
        method: 'POST',
        body: {
          amount: Number(amount),
          tenure_months: Number(months),
          ...(emi.trim() === '' ? {} : { emi_amount: Number(emi) }),
          reason: reason.trim(),
        },
      })

      setAmount('')
      setMonths('')
      setEmi('')
      setReason('')
      setDone('Request bhej di gayi. HR approve karegi, phir paisa aapke account me aayega.')

      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Request nahi ja payi.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Advance Salary">
        <Loader />
      </Screen>
    )
  }

  if (record.error !== null) {
    return (
      <Screen title="Advance Salary">
        <ErrorState message={record.error} onRetry={record.refresh} />
      </Screen>
    )
  }

  const ready =
    Number(amount) > 0 && Number(months) > 0 && reason.trim().length > 2 && open === undefined

  return (
    <Screen title="Advance Salary" subtitle={open ? 'Ek advance chal raha hai' : 'Zarurat par advance maango'}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
          }
        >
          {done ? <Notice tone="success" title="Bhej diya" message={done} /> : null}
          {problem ? <Notice tone="danger" title="Nahi ho paaya" message={problem} /> : null}

          {open ? (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <View style={styles.head}>
                <Text style={[styles.ref, { color: theme.inkMuted }]}>{open.reference}</Text>
                <View style={[styles.tag, { backgroundColor: theme.infoSoft }]}>
                  <Text style={[styles.tagText, { color: theme.info }]}>{open.status_label}</Text>
                </View>
              </View>

              <Text style={[styles.big, { color: theme.ink }]}>{Money.rupee(open.amount)}</Text>

              <View style={styles.stats}>
                <Stat label="EMI har mahine" value={Money.rupee(open.emi_amount)} />
                <Stat label="Kat chuka" value={Money.rupee(open.recovered)} />
                <Stat label="Baaki" value={Money.rupee(open.outstanding)} />
                <Stat label="Kist bachi" value={String(open.instalments_left)} />
              </View>

              {open.status === 'disbursed' ? (
                <>
                  <View style={[styles.bar, { backgroundColor: theme.canvas }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          backgroundColor: theme.brand,
                          width: `${Math.min(100, (Number(open.recovered) / Math.max(1, Number(open.amount))) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.hint, { color: theme.inkSubtle }]}>
                    Har mahine salary se {Money.rupee(open.emi_amount)} katega. Poora hote hi apne aap band ho
                    jaayega aur salary wapas puri aayegi.
                  </Text>
                </>
              ) : null}

              {open.status === 'pending' ? (
                <Text style={[styles.hint, { color: theme.inkSubtle }]}>
                  HR ke approve karne ka intezaar hai.
                </Text>
              ) : null}

              {open.status === 'approved' ? (
                <Text style={[styles.hint, { color: theme.inkSubtle }]}>
                  Approve ho gaya. Paisa bhejne ke baad EMI shuru hogi.
                </Text>
              ) : null}

              {(open.recoveries ?? []).length > 0 ? (
                <>
                  <Text style={[styles.section, { color: theme.inkMuted }]}>Kaunse mahine kata</Text>
                  {(open.recoveries ?? []).map((row: Record<string, any>) => (
                    <View key={`${row.period}:${row.source}`} style={styles.line}>
                      <Text style={[styles.lineLabel, { color: theme.ink }]}>{row.period}</Text>
                      <Text style={[styles.lineValue, { color: theme.ink }]}>{Money.rupee(row.amount)}</Text>
                    </View>
                  ))}
                </>
              ) : null}
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Text style={[styles.formTitle, { color: theme.ink }]}>Naya advance maango</Text>

              <Field
                label="Kitna chahiye"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="50000"
                editable={!busy}
              />

              <Field
                label="Kitne mahine me wapas"
                value={months}
                onChangeText={setMonths}
                keyboardType="numeric"
                placeholder="5"
                editable={!busy}
              />

              <Field
                label={`EMI amount (khaali chhodo to ${Money.rupee(suggestedEmi())})`}
                value={emi}
                onChangeText={setEmi}
                keyboardType="numeric"
                placeholder={String(suggestedEmi() || 10000)}
                editable={!busy}
              />

              <Field
                label="Kis kaam ke liye"
                value={reason}
                onChangeText={setReason}
                placeholder="Ghar me medical kharcha"
                editable={!busy}
              />

              <Text style={[styles.hint, { color: theme.inkSubtle }]}>
                Koi byaaj nahi lagta. Jitna liya, utna hi har mahine salary se katega.
              </Text>

              <Button label="Request bhejo" onPress={() => void submit()} loading={busy} disabled={!ready} fullWidth />
            </View>
          )}

          {rows.filter((row) => row.uuid !== open?.uuid).length > 0 ? (
            <>
              <Text style={[styles.section, { color: theme.inkMuted }]}>Purane advance</Text>

              {rows
                .filter((row) => row.uuid !== open?.uuid)
                .map((row) => (
                  <View
                    key={row.uuid}
                    style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}
                  >
                    <View style={styles.head}>
                      <Text style={[styles.ref, { color: theme.inkMuted }]}>{row.reference}</Text>
                      <Text style={[styles.tagText, { color: theme.inkSubtle }]}>{row.status_label}</Text>
                    </View>

                    <Text style={[styles.big, { color: theme.ink }]}>{Money.rupee(row.amount)}</Text>

                    <Text style={[styles.hint, { color: theme.inkSubtle }]}>
                      {row.reason}
                      {row.closed_at ? ` · ${formatDate(row.closed_at)} ko band` : ''}
                    </Text>
                  </View>
                ))}
            </>
          ) : null}

          {rows.length === 0 ? (
            <EmptyState
              title="Abhi tak koi advance nahi"
              message="Zarurat pade to upar wale form se maang sakte ho."
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme()

  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: theme.inkSubtle }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.ink }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  formTitle: { fontSize: font.md, fontWeight: '700' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ref: { flex: 1, fontSize: font.xs, fontWeight: '600' },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  tagText: { fontSize: font.xs, fontWeight: '700' },
  big: { fontSize: font.xl, fontWeight: '800' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { minWidth: 90 },
  statLabel: { fontSize: font.xs },
  statValue: { fontSize: font.sm, fontWeight: '700' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  hint: { fontSize: font.xs, lineHeight: 18 },
  section: { fontSize: font.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  lineLabel: { fontSize: font.sm },
  lineValue: { fontSize: font.sm, fontWeight: '600' },
})
