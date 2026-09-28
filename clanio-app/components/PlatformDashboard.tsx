import { useCallback, useState } from 'react'
import { useRouter } from 'expo-router'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Icon } from '@/components/ui/Icon'
import { ListRow } from '@/components/ui/ListRow'
import { Notice } from '@/components/ui/Notice'
import { ErrorState, Loader } from '@/components/ui/States'
import { api, apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { money } from '@/lib/plans'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, palette, radius, spacing } from '@/theme/tokens'

type Company = Record<string, any>

type Billing = {
  collected: number
  awaited: number
  pending: number
}

type Loaded = {
  companies: Company[]
  billing: Billing | null
  plans: number
}

type Range = 'today' | 'month' | 'year' | 'all'

const RANGES: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
]

function rangeQuery(range: Range): string {
  if (range === 'all') {
    return ''
  }

  const now = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  const from =
    range === 'today'
      ? iso(now)
      : range === 'month'
        ? iso(new Date(now.getFullYear(), now.getMonth(), 1))
        : iso(new Date(now.getFullYear(), 0, 1))

  return `?from=${from}&to=${iso(now)}`
}

export function PlatformDashboard() {
  const theme = useTheme()
  const router = useRouter()
  const { profile } = useAuth()
  const [range, setRange] = useState<Range>('all')

  const load = useCallback(async (): Promise<Loaded> => {
    const [companies, billing, plans] = await Promise.all([
      apiList<Company>('/companies?per_page=200'),
      api<Billing>(`/invoices/summary${rangeQuery(range)}`).catch(() => null),
      apiList<Record<string, unknown>>('/plans').catch(() => ({ data: [], meta: null })),
    ])

    return { companies: companies.data, billing, plans: plans.data.length }
  }, [range])

  const record = useResource<Loaded>(load, [range])

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

  const { companies, billing, plans } = record.data
  const active = companies.filter((row) => (row.status ?? 'active') === 'active')
  const seatsUsed = companies.reduce((sum, row) => sum + Number(row.employee_count ?? 0), 0)

  const newest = [...companies]
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    .slice(0, 4)

  // Seat cap ka tile hata diya, par warning kaam ki hai — wo yahin rehti hai
  const nearingCap = companies.filter((row) => {
    const cap = Number(row.max_employees ?? 0)

    return cap > 0 && Number(row.employee_count ?? 0) / cap >= 0.8
  })

  const hue = (bad: boolean, danger = false) =>
    bad
      ? danger
        ? { ink: theme.danger, soft: theme.dangerSoft }
        : { ink: theme.warning, soft: theme.warningSoft }
      : { ink: theme.brand, soft: theme.brandSoft }

  const outstanding = billing?.awaited ?? 0

  const tiles = [
    { key: 'active', label: 'Active companies', hint: 'Signed in and running', text: String(active.length), live: active.length > 0, hue: hue(false), icon: 'business-outline' as const, href: '/companies' },
    { key: 'companies', label: 'Total companies', hint: 'Every workspace on Clanio', text: String(companies.length), live: companies.length > 0, hue: hue(false), icon: 'layers-outline' as const, href: '/companies' },
    { key: 'users', label: 'Total users', hint: 'People across all companies', text: String(seatsUsed), live: seatsUsed > 0, hue: hue(false), icon: 'people-outline' as const, href: '/companies' },
    { key: 'revenue', label: 'Total revenue', hint: 'Collected from paid invoices', text: money(billing?.collected ?? 0), live: (billing?.collected ?? 0) > 0, hue: hue(false), icon: 'trending-up-outline' as const, href: '/revenue' },
    { key: 'plans', label: 'Total plans', hint: 'Plans you sell', text: String(plans), live: plans > 0, hue: hue(false), icon: 'pricetags-outline' as const, href: '/plans' },
    { key: 'outstanding', label: 'Outstanding payment', hint: `${billing?.pending ?? 0} invoice${(billing?.pending ?? 0) === 1 ? '' : 's'} unpaid`, text: money(outstanding), live: outstanding > 0, hue: hue(outstanding > 0), icon: 'receipt-outline' as const, href: '/billing' },
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {RANGES.map((option) => {
            const on = option.key === range

            return (
              <Pressable
                key={option.key}
                onPress={() => setRange(option.key)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: on ? theme.brand : pressed ? theme.canvas : theme.surface,
                    borderColor: on ? theme.brand : theme.line,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: on ? theme.onBrand : theme.inkMuted }]}>
                  {option.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <View style={styles.grid}>
          {tiles.map((tile) => {
            const live = tile.live

            return (
              <Pressable
                key={tile.key}
                onPress={() => router.push(tile.href as never)}
                style={({ pressed }) => [
                  styles.tile,
                  {
                    backgroundColor: pressed ? theme.canvas : theme.surface,
                    borderColor: live ? tile.hue.soft : theme.line,
                  },
                ]}
              >
                <View style={styles.tileHead}>
                  <Icon name={tile.icon} size={22} color={tile.hue.ink} />

                  {live ? (
                    <View style={[styles.pill, { backgroundColor: tile.hue.soft }]}>
                      <Text style={[styles.pillText, { color: tile.hue.ink }]}>{tile.text}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.zero, { color: theme.inkSubtle }]}>{tile.text}</Text>
                  )}
                </View>

                <Text style={[styles.tileLabel, { color: theme.ink }]}>{tile.label}</Text>
                <Text numberOfLines={2} style={[styles.tileHint, { color: theme.inkSubtle }]}>
                  {tile.hint}
                </Text>
              </Pressable>
            )
          })}
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
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
  },
  chipText: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 132,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  pill: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: font.sm,
    fontWeight: '800',
  },
  zero: {
    fontSize: font.sm,
    fontWeight: '700',
    paddingTop: 3,
  },
  tileLabel: {
    fontSize: font.md,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  tileHint: {
    fontSize: font.xs,
    lineHeight: 16,
  },
  group: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
})
