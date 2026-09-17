import { useCallback, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { api } from '@/lib/api'
import { Money } from '@/lib/money'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Loaded = Record<string, any>

export default function EmployeePayrollScreen() {
  const theme = useTheme()
  const { uuid } = useLocalSearchParams<{ uuid: string }>()
  const [month, setMonth] = useState<string | null>(null)

  const load = useCallback(
    () => api<Loaded>(`/employees/${uuid}/payroll${month === null ? '' : `?month=${month}`}`),
    [uuid, month]
  )

  const record = useResource<Loaded>(load, [uuid, month])

  if (record.loading) {
    return (
      <Screen title="Payroll" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (record.error !== null) {
    return (
      <Screen title="Payroll" leading="back">
        <ErrorState message={record.error} onRetry={record.refresh} />
      </Screen>
    )
  }

  const employee = record.data?.employee ?? {}
  const months: Record<string, any>[] = record.data?.months ?? []
  const picked = record.data?.selected ?? null

  if (months.length === 0) {
    return (
      <Screen title="Payroll" leading="back" subtitle={employee.name}>
        <EmptyState
          title="Abhi koi payroll nahi"
          message="Jab is employee ka koi mahina calculate hoga, wo yahan dikhega."
        />
      </Screen>
    )
  }

  const earnings = (picked?.lines ?? []).filter((line: any) => line.kind === 'earning')
  const deductions = (picked?.lines ?? []).filter((line: any) => line.kind === 'deduction')
  const employer = (picked?.lines ?? []).filter((line: any) => line.kind === 'employer_cost')

  return (
    <Screen title="Payroll" leading="back" subtitle={`${employee.name} · ${employee.employee_code}`}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {months.map((row) => {
            const on = row.month === picked?.month

            return (
              <Pressable
                key={row.month}
                onPress={() => setMonth(row.month)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: on ? theme.brand : theme.surface,
                    borderColor: on ? theme.brand : theme.line,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: on ? '#fff' : theme.ink }]}>{row.label}</Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {picked === null ? (
          <EmptyState title="Ye mahina nahi mila" message="Upar se doosra mahina chuno." />
        ) : (
          <>
            {picked.status === 'calculated' ? (
              <Notice
                tone="warning"
                title="Abhi approve nahi hua"
                message="Ye numbers badal sakte hain. Employee ko ye payslip abhi nahi dikhti."
              />
            ) : null}

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Text style={[styles.net, { color: theme.ink }]}>{Money.rupee(picked.net_payable)}</Text>
              <Text style={[styles.netLabel, { color: theme.inkSubtle }]}>Net payable</Text>

              <View style={styles.stats}>
                <Stat label="Gross" value={Money.rupee(picked.gross_earnings)} />
                <Stat label="Deductions" value={Money.rupee(picked.total_deductions)} />
                <Stat label="Paid days" value={`${picked.paid_days} / ${picked.working_days}`} />
                <Stat label="LOP" value={`${picked.lop_days} din`} />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Text style={[styles.section, { color: theme.inkMuted }]}>PF aur statutory</Text>

              <Row label="PF — employee" value={picked.pf_employee} highlight />
              <Row label="PF — employer" value={picked.pf_employer} />
              <Row label="ESI — employee" value={picked.esi_employee} />
              <Row label="ESI — employer" value={picked.esi_employer} />
              <Row label="Professional Tax" value={picked.professional_tax} />
              <Row label="TDS" value={picked.tds} />

              {employee.has_pf_account ? (
                <Text style={[styles.hint, { color: theme.inkSubtle }]}>
                  UAN {employee.uan_number ?? '—'} · PF basic par lagta hai, LOP se kam nahi hota
                </Text>
              ) : (
                <Text style={[styles.hint, { color: theme.inkSubtle }]}>
                  Iska PF account nahi hai, isliye PF nahi katta.
                </Text>
              )}
            </View>

            {Number(picked.advance_emi) > 0 ? (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                <Text style={[styles.section, { color: theme.inkMuted }]}>Advance</Text>
                <Row label="Is mahine ki EMI" value={picked.advance_emi} highlight />
              </View>
            ) : null}

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Text style={[styles.section, { color: theme.inkMuted }]}>Earnings</Text>
              {earnings.map((line: any) => (
                <Row
                  key={line.code}
                  label={line.name}
                  value={line.amount}
                  full={Number(line.full_amount) !== Number(line.amount) ? line.full_amount : undefined}
                />
              ))}
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Text style={[styles.section, { color: theme.inkMuted }]}>Deductions</Text>
              {deductions.map((line: any) => (
                <Row key={line.code} label={line.name} value={line.amount} />
              ))}
            </View>

            {employer.length > 0 ? (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                <Text style={[styles.section, { color: theme.inkMuted }]}>Employer cost</Text>
                {employer.map((line: any) => (
                  <Row key={line.code} label={line.name} value={line.amount} />
                ))}
                <Text style={[styles.hint, { color: theme.inkSubtle }]}>
                  Ye net me se nahi katta — CTC me jodta hai.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

function Row({
  label,
  value,
  full,
  highlight = false,
}: {
  label: string
  value: number | string
  full?: number | string
  highlight?: boolean
}) {
  const theme = useTheme()

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.inkMuted }]}>{label}</Text>
      <View style={styles.rowRight}>
        {full !== undefined ? (
          <Text style={[styles.rowFull, { color: theme.inkSubtle }]}>{Money.rupee(full)}</Text>
        ) : null}
        <Text
          style={[
            styles.rowValue,
            { color: highlight ? theme.brand : theme.ink, fontWeight: highlight ? '800' : '600' },
          ]}
        >
          {Money.rupee(value)}
        </Text>
      </View>
    </View>
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
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontSize: font.sm, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  net: { fontSize: font.xl, fontWeight: '800' },
  netLabel: { fontSize: font.xs, marginTop: -4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  stat: { minWidth: 90 },
  statLabel: { fontSize: font.xs },
  statValue: { fontSize: font.sm, fontWeight: '700' },
  section: { fontSize: font.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 },
  rowLabel: { flex: 1, fontSize: font.sm },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowFull: { fontSize: font.xs, textDecorationLine: 'line-through' },
  rowValue: { fontSize: font.sm },
  hint: { fontSize: font.xs, marginTop: spacing.xs, lineHeight: 17 },
})
