import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Icon } from '@/components/ui/Icon'
import { ListRow } from '@/components/ui/ListRow'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { apiList } from '@/lib/api'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

export type Row = {
  key: string
  title: string
  subtitle?: string
  badge?: string
  meta?: string
  href?: string
  search: string
}

type Props<T> = {
  title: string
  endpoint: string
  toRow: (item: T) => Row
  searchPlaceholder?: string
  emptyTitle?: string
  emptyMessage?: string
  action?: { label: string; href: string }
  sort?: (a: T, b: T) => number
}

export function ResourceList<T>({
  title,
  endpoint,
  toRow,
  searchPlaceholder = 'Search',
  emptyTitle = 'Nothing here yet',
  emptyMessage = 'Records will show up here once they exist.',
  action,
  sort,
}: Props<T>) {
  const theme = useTheme()
  const router = useRouter()
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const joiner = endpoint.includes('?') ? '&' : '?'
    const result = await apiList<T>(`${endpoint}${joiner}per_page=100`)

    return result.data
  }, [endpoint])

  const list = useResourceList<T>(load, endpoint)

  const rows = useMemo(() => {
    const source = [...(list.data ?? [])]

    if (sort) {
      source.sort(sort)
    }

    const mapped = source.map(toRow)
    const term = search.trim().toLowerCase()

    return term ? mapped.filter((row) => row.search.toLowerCase().includes(term)) : mapped
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data, search])

  return (
    <Screen
      title={title}
      subtitle={`${list.data?.length ?? 0} total`}
      action={action ? { label: action.label, onPress: () => router.push(action.href as never) } : undefined}
    >
      {list.loading ? (
        <Loader />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={theme.brand} />
          }
          ListHeaderComponent={
            <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Icon name="search-outline" size={18} color={theme.inkSubtle} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={searchPlaceholder}
                placeholderTextColor={theme.inkSubtle}
                style={[styles.searchInput, { color: theme.ink }]}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyState
                title={search ? 'No matches' : emptyTitle}
                message={search ? 'Try a different search term.' : emptyMessage}
                action={
                  action && !search ? { label: action.label, onPress: () => router.push(action.href as never) } : undefined
                }
              />
            </View>
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.title}
              subtitle={item.subtitle}
              badge={item.badge}
              meta={item.meta}
              onPress={item.href ? () => router.push(item.href as never) : undefined}
            />
          )}
        />
      )}
    </Screen>
  )
}

function useResourceList<T>(loader: () => Promise<T[]>, key: string) {
  const [data, setData] = useState<T[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (mode: 'load' | 'refresh') => {
      mode === 'load' ? setLoading(true) : setRefreshing(true)
      setError(null)

      try {
        setData(await loader())
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load data.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [loader]
  )

  useFocusEffect(
    useCallback(() => {
      void run(data === null ? 'load' : 'refresh')
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key])
  )

  return { data, loading, refreshing, error, reload: () => run('load'), refresh: () => run('refresh') }
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: font.md,
  },
  empty: {
    flex: 1,
    minHeight: 320,
  },
})
