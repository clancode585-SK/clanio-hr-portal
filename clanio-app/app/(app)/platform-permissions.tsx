import { useCallback, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Icon } from '@/components/ui/Icon'
import { Notice } from '@/components/ui/Notice'
import { ErrorState, Loader } from '@/components/ui/States'
import { apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Permission = Record<string, any>

export default function PlatformPermissionsScreen() {
  const theme = useTheme()
  const { isSuperAdmin } = useAuth()

  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    const result = await apiList<Permission>('/permissions?per_page=300')

    return result.data
  }, [])

  const record = useResource<Permission[]>(load, [])

  const groups = useMemo(() => {
    const rows = record.data ?? []
    const term = search.trim().toLowerCase()
    const filtered = term
      ? rows.filter((row) => `${row.slug ?? ''} ${row.name ?? ''} ${row.module ?? ''}`.toLowerCase().includes(term))
      : rows

    const map = new Map<string, Permission[]>()

    for (const row of filtered) {
      const key = String(row.module ?? String(row.slug ?? '').split('.')[0] ?? 'other')

      map.set(key, [...(map.get(key) ?? []), row])
    }

    return [...map.entries()]
      .map(([module, items]) => ({ module, items: items.sort((a, b) => String(a.slug).localeCompare(String(b.slug))) }))
      .sort((a, b) => a.module.localeCompare(b.module))
  }, [record.data, search])

  if (!isSuperAdmin) {
    return (
      <Screen title="Permissions">
        <View style={styles.padded}>
          <Notice
            tone="warning"
            title="Platform owners only"
            message="This is the master list every company draws its roles from."
          />
        </View>
      </Screen>
    )
  }

  if (record.loading) {
    return (
      <Screen title="Permissions">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Permissions">
        <ErrorState message={record.error ?? 'Could not load permissions.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const total = record.data.length

  return (
    <Screen title="Permissions" subtitle={`${total} across ${groups.length} modules`}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        <Notice
          tone="info"
          title="This list is fixed"
          message="Companies switch modules on or off and build roles from these. The list itself ships with Clanio."
        />

        <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Icon name="search-outline" size={18} color={theme.inkSubtle} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search permissions"
            placeholderTextColor={theme.inkSubtle}
            style={[styles.searchInput, { color: theme.ink }]}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        {groups.length === 0 ? (
          <Notice tone="info" title="No matches" message="Try a different search term." />
        ) : null}

        {groups.map((group) => {
          const expanded = open === group.module || search.trim().length > 0

          return (
            <View key={group.module} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Pressable
                onPress={() => setOpen(open === group.module ? null : group.module)}
                style={styles.cardHead}
              >
                <View style={styles.cardText}>
                  <Text style={[styles.cardTitle, { color: theme.ink }]}>{group.module.replace(/_/g, ' ')}</Text>
                  <Text style={[styles.cardHint, { color: theme.inkSubtle }]}>
                    {group.items.length} permission{group.items.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <Icon
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.inkSubtle}
                />
              </Pressable>

              {expanded ? (
                <View style={[styles.list, { borderTopColor: theme.line }]}>
                  {group.items.map((row) => (
                    <View key={String(row.id ?? row.slug)} style={styles.row}>
                      <Text style={[styles.slug, { color: theme.brand }]}>{row.slug}</Text>
                      <Text style={[styles.name, { color: theme.inkMuted }]}>{row.name ?? row.description ?? ''}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )
        })}
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
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: font.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: font.md,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  cardHint: {
    fontSize: font.xs,
  },
  list: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  row: {
    paddingVertical: 6,
    gap: 2,
  },
  slug: {
    fontSize: font.sm,
    fontWeight: '700',
  },
  name: {
    fontSize: font.xs,
  },
})
