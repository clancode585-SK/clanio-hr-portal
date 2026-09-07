import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { PlatformDashboard } from '@/components/PlatformDashboard'
import { Screen } from '@/components/Screen'
import { SetupChecklist } from '@/components/SetupChecklist'
import { Icon } from '@/components/ui/Icon'
import { Notice } from '@/components/ui/Notice'
import { api, apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { blocksFor, personaGreetings, personaLabels, personaOf, type Block } from '@/lib/dashboard'
import { visibleSections } from '@/lib/nav'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Counts = Record<string, number | null>

function pluck(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') {
      return undefined
    }

    return (current as Record<string, unknown>)[key]
  }, source)
}

export default function DashboardScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { profile, can, canAny, isSuperAdmin, companyId, viewCompany } = useAuth()

  const persona = useMemo(
    () => personaOf(profile?.roles ?? [], isSuperAdmin),
    [profile?.roles, isSuperAdmin]
  )

  const tiles = useMemo(() => blocksFor(persona, canAny), [persona, canAny])
  const onPlatform = isSuperAdmin && companyId === null

  const [counts, setCounts] = useState<Counts>({})
  const [refreshing, setRefreshing] = useState(false)
  const run = useRef(0)

  const one = useCallback(async (block: Block): Promise<number | null> => {
    try {
      if (block.count === 'meta') {
        const result = await apiList<unknown>(block.endpoint)

        return result.meta?.total ?? result.data.length
      }

      if (block.count === 'length') {
        const result = await apiList<unknown>(block.endpoint)

        return result.data.length
      }

      if (block.count === 'sum') {
        const result = await apiList<Record<string, unknown>>(block.endpoint)

        return result.data.reduce((total, row) => total + Number(row[block.field ?? 'value'] ?? 0), 0)
      }

      const result = await api<Record<string, unknown>>(block.endpoint)

      return Number(pluck(result, block.field ?? 'count') ?? 0)
    } catch {
      return null
    }
  }, [])

  const load = useCallback(async () => {
    const ticket = ++run.current

    setCounts({})
    setRefreshing(true)

    await Promise.all(
      tiles.map(async (block) => {
        const value = await one(block)

        if (run.current === ticket) {
          setCounts((current) => ({ ...current, [block.key]: value }))
        }
      })
    )

    if (run.current === ticket) {
      setRefreshing(false)
    }
  }, [tiles, one])

  useEffect(() => {
    void load()
  }, [load, companyId, profile?.id])
  const sections = visibleSections(can)
  const shortcuts = sections.flatMap((section) => section.items).slice(0, 8)

  const toneOf = (block: Block, value: number | null) => {
    if (value === null || value === 0) {
      return theme.inkSubtle
    }

    if (block.tone === 'danger') return theme.danger
    if (block.tone === 'warning') return theme.warning
    if (block.tone === 'success') return theme.success

    return theme.brand
  }

  if (onPlatform) {
    return <PlatformDashboard />
  }

  return (
    <Screen title="Dashboard" subtitle={personaLabels[persona]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={theme.brand} />
        }
      >
        <View style={[styles.hero, { backgroundColor: theme.brand }]}>
          <Text style={[styles.heroEyebrow, { color: theme.onBrand }]}>{personaLabels[persona]}</Text>
          <Text style={[styles.heroName, { color: theme.onBrand }]}>{profile?.name ?? '—'}</Text>
          <Text style={[styles.heroMeta, { color: theme.onBrand }]}>{personaGreetings[persona]}</Text>
        </View>

        {isSuperAdmin && companyId ? (
          <Pressable onPress={() => viewCompany(null)}>
            <Notice
              tone="warning"
              title={`Viewing company ${companyId}`}
              message="You are seeing this workspace as its admin. Tap to go back to the platform."
            />
          </Pressable>
        ) : null}

        {persona === 'admin' || persona === 'hr' ? <SetupChecklist /> : null}

        {tiles.length > 0 ? (
          <View style={styles.grid}>
            {tiles.map((block) => {
              const value = counts[block.key] ?? null
              const pending = !(block.key in counts)
              const tone = toneOf(block, value)

              return (
                <Pressable
                  key={block.key}
                  onPress={() => router.push(block.href as never)}
                  style={({ pressed }) => [
                    styles.tile,
                    { backgroundColor: pressed ? theme.canvas : theme.surface, borderColor: theme.line },
                  ]}
                >
                  <View style={styles.tileHead}>
                    <View style={[styles.tileIcon, { backgroundColor: theme.brandSoft }]}>
                      <Icon name={block.icon} size={18} color={theme.brand} />
                    </View>
                    <Text style={[styles.tileValue, { color: pending ? theme.line : tone }]}>
                      {pending ? '·' : value === null ? '—' : value}
                    </Text>
                  </View>

                  <Text style={[styles.tileLabel, { color: theme.ink }]}>{block.label}</Text>
                  <Text style={[styles.tileHint, { color: theme.inkSubtle }]}>{block.hint}</Text>
                </Pressable>
              )
            })}
          </View>
        ) : null}

        {tiles.length === 0 ? (
          <Notice
            tone="info"
            title="Nothing assigned yet"
            message="Once your role gets permissions, the numbers you are responsible for show up here."
          />
        ) : null}

        {shortcuts.length > 0 ? (
          <>
            <Text style={[styles.group, { color: theme.inkSubtle }]}>Jump to</Text>

            <View style={styles.shortcuts}>
              {shortcuts.map((item) => (
                <Pressable
                  key={item.href}
                  onPress={() => router.push(item.href as never)}
                  style={({ pressed }) => [
                    styles.shortcut,
                    { backgroundColor: pressed ? theme.brandSoft : theme.surface, borderColor: theme.line },
                  ]}
                >
                  <Icon name={item.icon} size={16} color={theme.brand} />
                  <Text style={[styles.shortcutLabel, { color: theme.ink }]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
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
    opacity: 0.85,
  },
  heroName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroMeta: {
    fontSize: font.sm,
    opacity: 0.9,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
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
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  tileLabel: {
    fontSize: font.md,
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
  },
  shortcuts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  shortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
  },
  shortcutLabel: {
    fontSize: font.sm,
    fontWeight: '600',
  },
})
