import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Icon } from '@/components/ui/Icon'
import { ListRow } from '@/components/ui/ListRow'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Department } from '@/lib/types'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

export default function DepartmentsScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { can } = useAuth()
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const result = await apiList<Department>('/departments?per_page=100')

    return result.data
  }, [])

  const list = useResource<Department[]>(load, [])

  useFocusEffect(
    useCallback(() => {
      void list.refresh()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  )

  const filtered = useMemo(() => {
    const rows = list.data ?? []
    const term = search.trim().toLowerCase()

    if (!term) {
      return rows
    }

    return rows.filter(
      (row) => row.name.toLowerCase().includes(term) || row.code.toLowerCase().includes(term)
    )
  }, [list.data, search])

  const canCreate = can('department.create')

  return (
    <Screen
      title="Departments"
      subtitle={`${list.data?.length ?? 0} total`}
      action={canCreate ? { label: 'New', onPress: () => router.push('/departments/new') } : undefined}
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
                placeholder="Search departments"
                placeholderTextColor={theme.inkSubtle}
                style={[styles.searchInput, { color: theme.ink }]}
                autoCorrect={false}
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyState
                title={search ? 'No matches' : 'No departments yet'}
                message={
                  search
                    ? 'Try a different search term.'
                    : 'Create your first department. Employees are grouped under these.'
                }
                action={
                  canCreate && !search
                    ? { label: 'Create department', onPress: () => router.push('/departments/new') }
                    : undefined
                }
              />
            </View>
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={item.description ?? `Code ${item.code}`}
              badge={item.code}
              meta={`${item.users_count} ${item.users_count === 1 ? 'member' : 'members'}`}
              onPress={() => router.push(`/departments/${item.id}`)}
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
