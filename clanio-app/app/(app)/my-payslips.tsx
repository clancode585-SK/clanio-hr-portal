import { useCallback, useState } from 'react'
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { api } from '@/lib/api'
import { downloadFile } from '@/lib/download'
import { Money } from '@/lib/money'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Slip = Record<string, any>

export default function MyPayslipsScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  const [open, setOpen] = useState<Slip | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => api<Slip[]>('/my-payslips'), [])
  const record = useResource<Slip[]>(load, [])

  const grab = async (slip: Slip) => {
    setBusy(true)
    setProblem(null)

    try {
      await downloadFile(`/payslips/${slip.uuid}/download`, `Payslip-${slip.month}.html`)
    } catch {
      setProblem('Could not download the payslip.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="My Payslips">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="My Payslips">
        <ErrorState message={record.error ?? 'Could not load your payslips.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const slips = record.data

  return (
    <Screen
      title="My Payslips"
      subtitle={slips.length === 0 ? 'Nothing yet' : `${slips.length} month${slips.length === 1 ? '' : 's'}`}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {problem ? <Notice tone="danger" title="Could not download" message={problem} /> : null}

        {slips.length === 0 ? (
          <EmptyState
            title="No payslip yet"
            message="Jab HR mahine ka payroll approve karega, uski payslip yahan aa jaayegi."
          />
        ) : null}

        {slips.map((slip) => (
          <Pressable
            key={slip.uuid}
            onPress={() => {
              setOpen(slip)
              setProblem(null)
            }}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: pressed ? theme.canvas : theme.surface, borderColor: theme.line },
            ]}
          >
            <View style={styles.head}>
              <Text style={[styles.month, { color: theme.ink }]}>{slip.month_label}</Text>
              <View style={[styles.tag, { backgroundColor: slip.payment_status === 'paid' ? theme.successSoft : theme.infoSoft }]}>
                <Text style={[styles.tagText, { color: slip.payment_status === 'paid' ? theme.success : theme.info }]}>
                  {slip.payment_label}
                </Text>
              </View>
            </View>

            <Text style={[styles.net, { color: theme.ink }]}>{Money.rupee(slip.net_payable, 2)}</Text>
            <Text style={[styles.meta, { color: theme.inkMuted }]}>
              {Money.days(slip.paid_days)} of {Money.days(slip.working_days)} days
              {slip.lop_days > 0 ? ` · ${Money.days(slip.lop_days)} day LOP` : ''}
              {slip.pay_date ? ` · paid on ${slip.pay_date}` : ''}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={open !== null} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)} />

        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={[styles.sheetHead, { borderBottomColor: theme.line }]}>
            <Text style={[styles.sheetTitle, { color: theme.ink }]}>{open?.month_label ?? ''}</Text>
            <Pressable onPress={() => setOpen(null)} hitSlop={10}>
              <Text style={[styles.closeMark, { color: theme.inkMuted }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.sheetBody}>
            {open ? (
              <>
                <Text style={[styles.sheetNet, { color: theme.ink }]}>{Money.rupee(open.net_payable, 2)}</Text>
                <Text style={[styles.meta, { color: theme.inkMuted }]}>
                  {Money.days(open.paid_days)} of {Money.days(open.working_days)} days paid
                </Text>

                <View style={[styles.lines, { borderColor: theme.line }]}>
                  {(open.lines ?? [])
                    .filter((line: Record<string, any>) => line.kind !== 'employer_cost')
                    .map((line: Record<string, any>) => (
                      <View key={line.code} style={styles.line}>
                        <Text style={[styles.lineName, { color: theme.ink }]}>{line.name}</Text>

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

                {open.employer_cost > 0 ? (
                  <Notice
                    tone="info"
                    title="Company ne alag se daala"
                    message={`${Money.rupee(open.employer_cost, 2)} PF aur ESI me company ki taraf se gaya — aapki salary se nahi kata.`}
                  />
                ) : null}

                <Button
                  label="Download the payslip"
                  onPress={() => void grab(open)}
                  loading={busy}
                  fullWidth
                />
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </Screen>
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
    gap: 3,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  month: {
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
  net: {
    fontSize: font.xl,
    fontWeight: '800',
    letterSpacing: -0.4,
    paddingTop: 4,
  },
  meta: {
    fontSize: font.xs,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '90%',
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
  sheetNet: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  lines: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginVertical: spacing.lg,
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
})
