import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Icon } from '@/components/ui/Icon'
import { ListRow } from '@/components/ui/ListRow'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { apiList, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Company = Record<string, any>

const tabs = [
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'archived', label: 'Archived' },
]

export default function CompaniesScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { isSuperAdmin, companyId, viewCompany } = useAuth()

  const [items, setItems] = useState<Company[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('active')

  const pull = useCallback(async (mode: 'load' | 'refresh') => {
    mode === 'load' ? setLoading(true) : setRefreshing(true)
    setError(null)

    try {
      const result = await apiList<Company>('/companies?per_page=100')

      setItems(result.data)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load companies.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void pull(items === null ? 'load' : 'refresh')
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  )

  const visible = useMemo(() => {
    const rows = (items ?? []).filter((row) => (row.status ?? 'active') === tab)
    const term = search.trim().toLowerCase()

    return term
      ? rows.filter((row) => `${row.name ?? ''} ${row.slug ?? ''} ${row.email ?? ''}`.toLowerCase().includes(term))
      : rows
  }, [items, tab, search])

  if (!isSuperAdmin) {
    return (
      <Screen title="Companies">
        <View style={styles.padded}>
          <Notice
            tone="warning"
            title="Platform owners only"
            message="Only a Clanio super admin can manage the companies on this platform."
          />
        </View>
      </Screen>
    )
  }

  const totalEmployees = (items ?? []).reduce((sum, row) => sum + Number(row.employee_count ?? 0), 0)

  return (
    <Screen
      title="Companies"
      subtitle={`${items?.length ?? 0} on the platform · ${totalEmployees} people`}
      action={{ label: 'Add', onPress: () => router.push('/companies/new') }}
    >
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState message={error} onRetry={() => pull('load')} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => String(item.uuid ?? item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => pull('refresh')} tintColor={theme.brand} />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              {companyId ? (
                <Pressable
                  onPress={() => viewCompany(null)}
                  style={[styles.banner, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}
                >
                  <Icon name="eye-outline" size={18} color={theme.warning} />
                  <Text style={[styles.bannerText, { color: theme.ink }]}>
                    You are inside company {companyId}. Tap to return to the platform view.
                  </Text>
                </Pressable>
              ) : null}

              <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                <Icon name="search-outline" size={18} color={theme.inkSubtle} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search companies"
                  placeholderTextColor={theme.inkSubtle}
                  style={[styles.searchInput, { color: theme.ink }]}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>

              <View style={[styles.tabs, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
                {tabs.map((entry) => {
                  const active = entry.key === tab

                  return (
                    <Pressable
                      key={entry.key}
                      onPress={() => setTab(entry.key)}
                      style={[styles.tab, { backgroundColor: active ? theme.surface : 'transparent' }]}
                    >
                      <Text
                        style={[
                          styles.tabLabel,
                          { color: active ? theme.brand : theme.inkMuted, fontWeight: active ? '700' : '500' },
                        ]}
                      >
                        {entry.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyState
                title={search ? 'No matches' : `No ${tab} companies`}
                message={search ? 'Try a different search term.' : 'Companies you onboard show up here.'}
                action={search ? undefined : { label: 'Add a company', onPress: () => router.push('/companies/new') }}
              />
            </View>
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={[item.city, item.email].filter(Boolean).join(' · ')}
              badge={item.slug}
              meta={`${item.employee_count ?? 0} / ${item.max_employees ?? '—'}`}
              onPress={() => router.push(`/companies/${item.uuid ?? item.id}` as never)}
            />
          )}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
  padded: {
    padding: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bannerText: {
    flex: 1,
    fontSize: font.sm,
    fontWeight: '600',
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
  tabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  tabLabel: {
    fontSize: font.sm,
  },
  empty: {
    flex: 1,
    minHeight: 320,
  },
})
