import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Icon } from '@/components/ui/Icon'
import { ListRow } from '@/components/ui/ListRow'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Employee } from '@/lib/types'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

export default function EmployeesScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { can } = useAuth()
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const result = await apiList<Employee>('/employees?per_page=100')

    return result.data
  }, [])

  const list = useResource<Employee[]>(load, [])

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
      (row) =>
        (row.user?.name ?? '').toLowerCase().includes(term) ||
        (row.user?.email ?? '').toLowerCase().includes(term) ||
        row.employee_code.toLowerCase().includes(term)
    )
  }, [list.data, search])

  return (
    <Screen title="Employees" subtitle={`${list.data?.length ?? 0} total`}>
      {list.loading ? (
        <Loader />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.uuid}
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
                placeholder="Name, email or code"
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
                title={search ? 'No matches' : 'No employees yet'}
                message={search ? 'Try a different search term.' : 'No one has been added to this company yet.'}
              />
            </View>
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.user?.name ?? '—'}
              subtitle={item.designation?.name ?? item.user?.email ?? '—'}
              badge={item.employee_code}
              meta={item.employment_status === 'active' ? undefined : item.employment_status}
              onPress={can('user.permission') ? () => router.push(`/employees/${item.uuid}`) : undefined}
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
