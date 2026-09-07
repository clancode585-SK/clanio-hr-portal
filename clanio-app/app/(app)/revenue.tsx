import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { ErrorState, Loader } from '@/components/ui/States'
import { apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Company = Record<string, any>

export default function RevenueScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { isSuperAdmin } = useAuth()

  const [rate, setRate] = useState('')

  const load = useCallback(async () => {
    const result = await apiList<Company>('/companies?per_page=200')

    return result.data
  }, [])

  const record = useResource<Company[]>(load, [])

  const rows = useMemo(() => {
    const perSeat = Number(rate) > 0 ? Number(rate) : null

    return (record.data ?? [])
      .filter((row) => (row.status ?? 'active') === 'active')
      .map((row) => {
        const used = Number(row.employee_count ?? 0)
        const cap = Number(row.max_employees ?? 0)

        return {
          id: String(row.uuid ?? row.id),
          name: row.name,
          slug: row.slug,
          used,
          cap,
          billable: perSeat === null ? null : used * perSeat,
        }
      })
      .sort((a, b) => b.used - a.used)
  }, [record.data, rate])

  if (!isSuperAdmin) {
    return (
      <Screen title="Revenue">
        <View style={styles.padded}>
          <Notice tone="warning" title="Platform owners only" message="Only a Clanio super admin can see this." />
        </View>
      </Screen>
    )
  }

  if (record.loading) {
    return (
      <Screen title="Revenue">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Revenue">
        <ErrorState message={record.error ?? 'Could not load companies.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const totalUsed = rows.reduce((sum, row) => sum + row.used, 0)
  const totalCap = rows.reduce((sum, row) => sum + row.cap, 0)
  const perSeat = Number(rate) > 0 ? Number(rate) : null
  const monthly = perSeat === null ? null : totalUsed * perSeat
  const widest = Math.max(1, ...rows.map((row) => row.used))

  return (
    <Screen title="Revenue" subtitle={`${rows.length} paying companies`}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        <Notice
          tone="warning"
          title="Rates are not stored yet"
          message="Type a per-seat rate to model the numbers. Saving real plans and invoices needs the billing tables built first."
        />

        <Field
          label="Per seat, per month"
          value={rate}
          onChangeText={setRate}
          placeholder="199"
          keyboardType="decimal-pad"
        />

        <View style={styles.summary}>
          <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.statValue, { color: theme.brand }]}>{totalUsed}</Text>
            <Text style={[styles.statLabel, { color: theme.inkMuted }]}>Seats in use</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.statValue, { color: theme.ink }]}>{totalCap || '—'}</Text>
            <Text style={[styles.statLabel, { color: theme.inkMuted }]}>Seats sold</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.statValue, { color: monthly === null ? theme.inkSubtle : theme.success }]}>
              {monthly === null ? '—' : formatMoney(monthly)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.inkMuted }]}>Monthly</Text>
          </View>
        </View>

        <Text style={[styles.group, { color: theme.inkSubtle }]}>By company</Text>

        {rows.map((row) => (
          <Pressable
            key={row.id}
            onPress={() => router.push(`/companies/${row.id}` as never)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: pressed ? theme.canvas : theme.surface, borderColor: theme.line },
            ]}
          >
            <View style={styles.rowHead}>
              <Text style={[styles.rowName, { color: theme.ink }]} numberOfLines={1}>
                {row.name}
              </Text>
              <Text style={[styles.rowValue, { color: row.billable === null ? theme.inkSubtle : theme.ink }]}>
                {row.billable === null ? `${row.used} seats` : formatMoney(row.billable)}
              </Text>
            </View>

            <View style={[styles.track, { backgroundColor: theme.canvas }]}>
              <View
                style={[styles.fill, { backgroundColor: theme.brand, width: `${(row.used / widest) * 100}%` }]}
              />
            </View>

            <Text style={[styles.rowMeta, { color: theme.inkSubtle }]}>
              {row.used} of {row.cap || '—'} seats · {row.slug}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  )
}

function formatMoney(value: number): string {
  return '₹' + Math.round(value).toLocaleString('en-IN')
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  padded: {
    padding: spacing.lg,
  },
  summary: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: font.xs,
    textAlign: 'center',
  },
  group: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  row: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowName: {
    flex: 1,
    fontSize: font.md,
    fontWeight: '700',
  },
  rowValue: {
    fontSize: font.md,
    fontWeight: '800',
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
  rowMeta: {
    fontSize: font.xs,
  },
})
