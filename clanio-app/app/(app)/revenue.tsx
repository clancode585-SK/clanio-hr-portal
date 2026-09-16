import { useCallback, useMemo } from 'react'
import { useRouter } from 'expo-router'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Notice } from '@/components/ui/Notice'
import { ErrorState, Loader } from '@/components/ui/States'
import { apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { money } from '@/lib/plans'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Company = Record<string, any>

export default function RevenueScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { isSuperAdmin } = useAuth()

  const load = useCallback(async () => {
    const result = await apiList<Company>('/companies?per_page=200')

    return result.data
  }, [])

  const record = useResource<Company[]>(load, [])

  const rows = useMemo(
    () =>
      (record.data ?? [])
        .filter((row) => (row.status ?? 'active') === 'active')
        .map((row) => {
          const seats = Number(row.employee_count ?? 0)
          const cap = Number(row.max_employees ?? 0)
          const rate = Number(row.plan?.price_per_seat ?? 0)
          const gstPercent = Number(row.plan?.gst_percent ?? 0)
          const subtotal = rate * seats
          const gst = (subtotal * gstPercent) / 100

          return {
            id: String(row.uuid ?? row.id),
            name: row.name,
            plan: row.plan?.name ?? null,
            seats,
            cap,
            subtotal,
            gst,
            total: subtotal + gst,
          }
        })
        .sort((a, b) => b.total - a.total || b.seats - a.seats),
    [record.data]
  )

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

  const billed = rows.filter((row) => row.plan !== null)
  const unbilled = rows.filter((row) => row.plan === null)
  const monthly = billed.reduce((sum, row) => sum + row.total, 0)
  const seats = billed.reduce((sum, row) => sum + row.seats, 0)
  const widest = Math.max(1, ...rows.map((row) => row.total))

  return (
    <Screen title="Revenue" subtitle={`${billed.length} on a plan`}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        <View style={styles.summary}>
          <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.statValue, { color: theme.success }]}>{money(monthly)}</Text>
            <Text style={[styles.statLabel, { color: theme.inkMuted }]}>Every month</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.statValue, { color: theme.brand }]}>{seats}</Text>
            <Text style={[styles.statLabel, { color: theme.inkMuted }]}>Seats billed</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.statValue, { color: theme.ink }]}>{money(monthly * 12)}</Text>
            <Text style={[styles.statLabel, { color: theme.inkMuted }]}>Run rate</Text>
          </View>
        </View>

        {unbilled.length > 0 ? (
          <Notice
            tone="warning"
            title={`${unbilled.length} ${unbilled.length === 1 ? 'company has' : 'companies have'} no plan`}
            message={`${unbilled.map((row) => row.name).join(', ')} — open the company and pick a plan to start billing.`}
          />
        ) : null}

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
              <Text numberOfLines={1} style={[styles.rowName, { color: theme.ink }]}>
                {row.name}
              </Text>
              <Text style={[styles.rowValue, { color: row.plan ? theme.ink : theme.inkSubtle }]}>
                {row.plan ? money(row.total) : 'No plan'}
              </Text>
            </View>

            <View style={[styles.track, { backgroundColor: theme.canvas }]}>
              <View
                style={[
                  styles.fill,
                  { backgroundColor: row.plan ? theme.brand : theme.line, width: `${(row.total / widest) * 100}%` },
                ]}
              />
            </View>

            <Text style={[styles.rowMeta, { color: theme.inkSubtle }]}>
              {row.plan ? `${row.plan} · ` : ''}
              {row.seats} of {row.cap || '—'} seats
              {row.plan ? ` · ${money(row.subtotal)} + ${money(row.gst)} GST` : ''}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
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
    fontSize: 18,
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
