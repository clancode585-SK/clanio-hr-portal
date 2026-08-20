import { useCallback } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { ErrorState, Loader } from '@/components/ui/States'
import { api } from '@/lib/api'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Balance = {
  leave_type?: { id: number; name: string; code: string }
  year?: number
  opening?: number
  accrued?: number
  used?: number
  available?: number
}

export default function MyLeaveScreen() {
  const theme = useTheme()

  const load = useCallback(async () => {
    const result = await api<Balance[] | { balances?: Balance[] }>('/leaves/my-balance')

    return Array.isArray(result) ? result : (result.balances ?? [])
  }, [])

  const balances = useResource<Balance[]>(load, [])

  if (balances.loading) {
    return (
      <Screen title="My Leave">
        <Loader />
      </Screen>
    )
  }

  if (balances.error) {
    return (
      <Screen title="My Leave">
        <ErrorState message={balances.error} onRetry={balances.reload} />
      </Screen>
    )
  }

  const rows = balances.data ?? []

  return (
    <Screen title="My Leave" subtitle={`${rows.length} leave types`}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={balances.refreshing} onRefresh={balances.refresh} tintColor={theme.brand} />
        }
      >
        {rows.map((row, index) => (
          <View
            key={`${row.leave_type?.id ?? index}`}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}
          >
            <View style={styles.head}>
              <Text style={[styles.name, { color: theme.ink }]}>{row.leave_type?.name ?? 'Leave'}</Text>
              <Text style={[styles.available, { color: theme.brand }]}>{row.available ?? 0}</Text>
            </View>

            <Text style={[styles.meta, { color: theme.inkMuted }]}>
              Opening {row.opening ?? 0} · Accrued {row.accrued ?? 0} · Used {row.used ?? 0}
            </Text>
          </View>
        ))}

        {rows.length === 0 ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.meta, { color: theme.inkMuted }]}>No leave balance found for this year.</Text>
          </View>
        ) : null}
      </ScrollView>
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
    gap: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: font.md,
    fontWeight: '600',
  },
  available: {
    fontSize: font.xl,
    fontWeight: '800',
  },
  meta: {
    fontSize: font.sm,
  },
})
