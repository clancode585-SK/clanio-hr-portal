import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Icon } from '@/components/ui/Icon'
import { ListRow } from '@/components/ui/ListRow'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Designation } from '@/lib/types'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

export default function DesignationsScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { can } = useAuth()
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const result = await apiList<Designation>('/designations?per_page=100')

    return result.data
  }, [])

  const list = useResource<Designation[]>(load, [])

  useFocusEffect(
    useCallback(() => {
      void list.refresh()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  )

  const filtered = useMemo(() => {
    const rows = [...(list.data ?? [])].sort((a, b) => a.level - b.level)
    const term = search.trim().toLowerCase()

    if (!term) {
      return rows
    }

    return rows.filter(
      (row) => row.name.toLowerCase().includes(term) || row.code.toLowerCase().includes(term)
    )
  }, [list.data, search])

  const canCreate = can('designation.create')

  return (
    <Screen
      title="Designations"
      subtitle={`${list.data?.length ?? 0} total`}
      action={canCreate ? { label: 'New', onPress: () => router.push('/designations/new') } : undefined}
    >
      {list.loading ? (
        <Loader />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
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
                placeholder="Search designations"
                placeholderTextColor={theme.inkSubtle}
                style={[styles.searchInput, { color: theme.ink }]}
                autoCorrect={false}
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyState
                title={search ? 'No matches' : 'No designations yet'}
                message={
                  search
                    ? 'Try a different search term.'
                    : 'A designation is the job title, like Software Engineer or HR Manager.'
                }
                action={
                  canCreate && !search
                    ? { label: 'Create designation', onPress: () => router.push('/designations/new') }
                    : undefined
                }
              />
            </View>
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={item.department?.name ?? 'All departments'}
              badge={`L${item.level}`}
              meta={`${item.employees_count} ${item.employees_count === 1 ? 'person' : 'people'}`}
              onPress={() => router.push(`/designations/${item.id}`)}
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
