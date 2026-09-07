import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { ErrorState, Loader } from '@/components/ui/States'
import { apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { gstPercent, money, plans, priceOrder } from '@/lib/plans'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Company = Record<string, any>

export default function PlansScreen() {
  const theme = useTheme()
  const { isSuperAdmin } = useAuth()

  const [seats, setSeats] = useState('25')

  const load = useCallback(async () => {
    const result = await apiList<Company>('/companies?per_page=200')

    return result.data
  }, [])

  const record = useResource<Company[]>(load, [])

  if (!isSuperAdmin) {
    return (
      <Screen title="Plans">
        <View style={styles.padded}>
          <Notice tone="warning" title="Platform owners only" message="Only a Clanio super admin can see this." />
        </View>
      </Screen>
    )
  }

  if (record.loading) {
    return (
      <Screen title="Plans">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Plans">
        <ErrorState message={record.error ?? 'Could not load companies.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const companies = record.data
  const seatCount = Math.max(1, Number(seats) || 0)

  const fitFor = (min: number, max: number) =>
    companies.filter((row) => {
      const cap = Number(row.max_employees ?? 0)

      return cap >= min && cap <= max
    }).length

  return (
    <Screen title="Plans" subtitle={`${plans.length} tiers`}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        <Notice
          tone="warning"
          title="These prices live in the app, not the database"
          message="They drive the signup flow today. Move them to a plans table when you want to change prices without shipping a build."
        />

        <Field
          label="Price it for this many seats"
          value={seats}
          onChangeText={setSeats}
          placeholder="25"
          keyboardType="number-pad"
        />

        {plans.map((plan) => {
          const order = priceOrder(plan, seatCount)
          const fits = seatCount >= plan.minSeats && seatCount <= plan.maxSeats
          const onThisPlan = fitFor(plan.minSeats, plan.maxSeats)

          return (
            <View
              key={plan.code}
              style={[
                styles.card,
                {
                  backgroundColor: theme.surface,
                  borderColor: plan.popular ? theme.brand : theme.line,
                  opacity: fits ? 1 : 0.55,
                },
              ]}
            >
              <View style={styles.head}>
                <View style={styles.headText}>
                  <Text style={[styles.name, { color: theme.ink }]}>{plan.name}</Text>
                  <Text style={[styles.tagline, { color: theme.inkSubtle }]}>{plan.tagline}</Text>
                </View>

                <View style={styles.price}>
                  <Text style={[styles.amount, { color: theme.brand }]}>{money(plan.pricePerSeat)}</Text>
                  <Text style={[styles.unit, { color: theme.inkSubtle }]}>per seat</Text>
                </View>
              </View>

              {plan.popular ? (
                <Text style={[styles.badge, { color: theme.success }]}>Most companies pick this</Text>
              ) : null}

              <View style={[styles.divider, { backgroundColor: theme.line }]} />

              {fits ? (
                <View style={styles.lines}>
                  <Line label={`${seatCount} seats`} value={money(order.subtotal)} />
                  <Line label={`GST ${gstPercent}%`} value={money(order.gst)} />
                  <Line label="Per month" value={money(order.total)} strong />
                </View>
              ) : (
                <Text style={[styles.outOfRange, { color: theme.inkSubtle }]}>
                  Takes {plan.minSeats} to {plan.maxSeats} seats
                </Text>
              )}

              <View style={[styles.divider, { backgroundColor: theme.line }]} />

              <Text style={[styles.meta, { color: theme.inkMuted }]}>{plan.highlights.join(' · ')}</Text>
              <Text style={[styles.meta, { color: theme.inkSubtle }]}>
                {onThisPlan} {onThisPlan === 1 ? 'company sits' : 'companies sit'} in this seat range
              </Text>
            </View>
          )
        })}
      </ScrollView>
    </Screen>
  )
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const theme = useTheme()

  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, { color: strong ? theme.ink : theme.inkMuted }]}>{label}</Text>
      <Text
        style={[
          styles.lineValue,
          { color: strong ? theme.brand : theme.ink, fontSize: strong ? font.lg : font.sm },
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
  padded: {
    padding: spacing.lg,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: font.lg,
    fontWeight: '800',
  },
  tagline: {
    fontSize: font.xs,
  },
  price: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: font.xl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: font.xs,
  },
  badge: {
    fontSize: font.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  divider: {
    height: 1,
  },
  lines: {
    gap: 4,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lineLabel: {
    fontSize: font.sm,
  },
  lineValue: {
    fontWeight: '800',
  },
  outOfRange: {
    fontSize: font.sm,
    paddingVertical: 4,
  },
  meta: {
    fontSize: font.xs,
    lineHeight: 17,
  },
})
