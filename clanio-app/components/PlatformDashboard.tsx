import { useCallback } from 'react'
import { useRouter } from 'expo-router'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Icon } from '@/components/ui/Icon'
import { ListRow } from '@/components/ui/ListRow'
import { Notice } from '@/components/ui/Notice'
import { ErrorState, Loader } from '@/components/ui/States'
import { api, apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, palette, radius, spacing } from '@/theme/tokens'

type Company = Record<string, any>

type Loaded = {
  companies: Company[]
  unread: number
}

export function PlatformDashboard() {
  const theme = useTheme()
  const router = useRouter()
  const { profile } = useAuth()

  const load = useCallback(async (): Promise<Loaded> => {
    const [companies, summary] = await Promise.all([
      apiList<Company>('/companies?per_page=200'),
      api<{ unread_count?: number }>('/notifications/unread-count').catch(() => ({}) as { unread_count?: number }),
    ])

    return { companies: companies.data, unread: Number(summary.unread_count ?? 0) }
  }, [])

  const record = useResource<Loaded>(load, [])

  if (record.loading) {
    return (
      <Screen title="Platform">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Platform">
        <ErrorState message={record.error ?? 'Could not load the platform view.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const { companies, unread } = record.data
  const active = companies.filter((row) => (row.status ?? 'active') === 'active')
  const suspended = companies.filter((row) => row.status === 'suspended')
  const archived = companies.filter((row) => row.status === 'archived')
  const seatsUsed = companies.reduce((sum, row) => sum + Number(row.employee_count ?? 0), 0)
  const seatsSold = companies.reduce((sum, row) => sum + Number(row.max_employees ?? 0), 0)
  const nearingCap = companies.filter((row) => {
    const cap = Number(row.max_employees ?? 0)

    return cap > 0 && Number(row.employee_count ?? 0) / cap >= 0.8
  })

  const newest = [...companies]
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    .slice(0, 4)

  const tiles = [
    { key: 'active', label: 'Active', hint: 'Companies signed in', value: active.length, tone: theme.brand, icon: 'business-outline' as const, href: '/companies' },
    { key: 'seats', label: 'People', hint: `of ${seatsSold || '—'} seats sold`, value: seatsUsed, tone: theme.ink, icon: 'people-outline' as const, href: '/companies' },
    { key: 'suspended', label: 'Suspended', hint: 'Logins blocked', value: suspended.length, tone: suspended.length > 0 ? theme.warning : theme.inkSubtle, icon: 'pause-circle-outline' as const, href: '/companies' },
    { key: 'archived', label: 'Archived', hint: 'Kept for records', value: archived.length, tone: theme.inkSubtle, icon: 'archive-outline' as const, href: '/companies' },
    { key: 'capacity', label: 'Near seat cap', hint: '80% or more used', value: nearingCap.length, tone: nearingCap.length > 0 ? theme.danger : theme.inkSubtle, icon: 'alert-circle-outline' as const, href: '/companies' },
    { key: 'unread', label: 'Unread', hint: 'Notifications', value: unread, tone: unread > 0 ? theme.brand : theme.inkSubtle, icon: 'notifications-outline' as const, href: '/notifications' },
  ]

  return (
    <Screen
      title="Platform"
      subtitle={`${companies.length} companies on Clanio`}
      action={{ label: 'Add', onPress: () => router.push('/companies/new' as never) }}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        <View style={[styles.hero, { backgroundColor: palette.navy }]}>
          <Text style={[styles.heroEyebrow, { color: theme.brand }]}>Platform owner</Text>
          <Text style={[styles.heroName, { color: '#FFFFFF' }]}>{profile?.name ?? '—'}</Text>
          <Text style={[styles.heroMeta, { color: 'rgba(255,255,255,0.72)' }]}>
            Every company on Clanio, in one place.
          </Text>
        </View>

        <View style={styles.grid}>
          {tiles.map((tile) => (
            <Pressable
              key={tile.key}
              onPress={() => router.push(tile.href as never)}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: pressed ? theme.canvas : theme.surface, borderColor: theme.line },
              ]}
            >
              <View style={styles.tileHead}>
                <View style={[styles.tileIcon, { backgroundColor: theme.brandSoft }]}>
                  <Icon name={tile.icon} size={18} color={theme.brand} />
                </View>
                <Text style={[styles.tileValue, { color: tile.tone }]}>{tile.value}</Text>
              </View>
              <Text style={[styles.tileLabel, { color: theme.ink }]}>{tile.label}</Text>
              <Text style={[styles.tileHint, { color: theme.inkSubtle }]}>{tile.hint}</Text>
            </Pressable>
          ))}
        </View>

        {nearingCap.length > 0 ? (
          <Notice
            tone="warning"
            title={`${nearingCap.length} ${nearingCap.length === 1 ? 'company is' : 'companies are'} near the seat cap`}
            message={nearingCap.map((row) => row.name).join(', ')}
          />
        ) : null}

        <Text style={[styles.group, { color: theme.inkSubtle }]}>Recently added</Text>

        {newest.map((row) => (
          <ListRow
            key={String(row.uuid ?? row.id)}
            title={row.name}
            subtitle={[row.city, row.email].filter(Boolean).join(' · ')}
            badge={row.slug}
            meta={`${row.employee_count ?? 0} / ${row.max_employees ?? '—'}`}
            onPress={() => router.push(`/companies/${row.uuid ?? row.id}` as never)}
          />
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
  hero: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: 3,
  },
  heroEyebrow: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroMeta: {
    fontSize: font.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 3,
  },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  tileLabel: {
    fontSize: font.sm,
    fontWeight: '700',
  },
  tileHint: {
    fontSize: font.xs,
  },
  group: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
})
