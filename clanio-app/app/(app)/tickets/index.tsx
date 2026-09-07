import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Icon } from '@/components/ui/Icon'
import { ListRow } from '@/components/ui/ListRow'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { apiList, ApiError } from '@/lib/api'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Ticket = Record<string, any>

const tabs = [
  { key: 'open', label: 'Open' },
  { key: 'mine', label: 'Mine' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'closed', label: 'Closed' },
]

export default function TicketsScreen() {
  const theme = useTheme()
  const router = useRouter()

  const [items, setItems] = useState<Ticket[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('open')

  const pull = useCallback(async (mode: 'load' | 'refresh') => {
    mode === 'load' ? setLoading(true) : setRefreshing(true)
    setError(null)

    try {
      const result = await apiList<Ticket>('/tickets?per_page=100')

      setItems(result.data)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load tickets.')
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
    let rows = items ?? []

    if (tab === 'open') {
      rows = rows.filter((row) => ['open', 'in_progress'].includes(row.status))
    } else if (tab === 'mine') {
      rows = rows.filter((row) => row.is_raiser)
    } else if (tab === 'waiting') {
      rows = rows.filter((row) => row.status === 'waiting_on_user')
    } else {
      rows = rows.filter((row) => ['closed', 'cancelled', 'resolved'].includes(row.status))
    }

    const term = search.trim().toLowerCase()

    return term
      ? rows.filter((row) => `${row.subject ?? ''} ${row.ticket_no ?? ''}`.toLowerCase().includes(term))
      : rows
  }, [items, tab, search])

  return (
    <Screen
      title="Helpdesk"
      subtitle={`${items?.length ?? 0} total`}
      action={{ label: 'Raise', onPress: () => router.push('/tickets/new') }}
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
              <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                <Icon name="search-outline" size={18} color={theme.inkSubtle} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search tickets"
                  placeholderTextColor={theme.inkSubtle}
                  style={[styles.searchInput, { color: theme.ink }]}
                  autoCorrect={false}
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
                title={search ? 'No matches' : 'Nothing here'}
                message={search ? 'Try a different search term.' : 'Support requests show up here.'}
                action={search ? undefined : { label: 'Raise a ticket', onPress: () => router.push('/tickets/new') }}
              />
            </View>
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.subject}
              subtitle={[item.raiser?.name, item.category?.name].filter(Boolean).join(' · ')}
              badge={item.ticket_no}
              meta={item.sla?.state === 'breached' ? 'Late' : item.status}
              onPress={() => router.push(`/tickets/${item.uuid ?? item.id}` as never)}
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
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
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
    gap: 2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: radius.sm,
  },
  tabLabel: {
    fontSize: font.xs,
  },
  empty: {
    flex: 1,
    minHeight: 320,
  },
})
