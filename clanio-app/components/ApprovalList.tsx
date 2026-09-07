import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ListRow } from '@/components/ui/ListRow'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { api, apiList, ApiError } from '@/lib/api'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

export type Row = {
  key: string
  title: string
  subtitle?: string
  badge?: string
  meta?: string
  search: string
}

export type Detail = { label: string; value: string }

export type Action = {
  key: string
  label: string
  tone: 'primary' | 'danger' | 'secondary'
  path: string
  method?: 'PUT' | 'POST' | 'DELETE'
  remarks?: 'none' | 'optional' | 'required'
  remarksKey?: string
  remarksLabel?: string
  body?: Record<string, unknown>
  extra?: ExtraField[]
}

export type ExtraField = {
  key: string
  label: string
  placeholder?: string
  required?: boolean
}

type Props<T> = {
  title: string
  endpoint: string
  toRow: (item: T) => Row
  toDetails: (item: T) => Detail[]
  toActions: (item: T) => Action[]
  searchPlaceholder?: string
  emptyTitle?: string
  emptyMessage?: string
  filters?: { key: string; label: string; test: (item: T) => boolean }[]
}

export function ApprovalList<T>({
  title,
  endpoint,
  toRow,
  toDetails,
  toActions,
  searchPlaceholder = 'Search',
  emptyTitle = 'Nothing pending',
  emptyMessage = 'Requests will show up here when someone raises one.',
  filters,
}: Props<T>) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  const [items, setItems] = useState<T[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')

  const [open, setOpen] = useState<T | null>(null)
  const [remarks, setRemarks] = useState('')
  const [extras, setExtras] = useState<Record<string, string>>({})
  const [running, setRunning] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const pull = useCallback(
    async (mode: 'load' | 'refresh') => {
      mode === 'load' ? setLoading(true) : setRefreshing(true)
      setError(null)

      try {
        const joiner = endpoint.includes('?') ? '&' : '?'
        const result = await apiList<T>(`${endpoint}${joiner}per_page=100`)

        setItems(result.data)
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Could not load data.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [endpoint]
  )

  useFocusEffect(
    useCallback(() => {
      void pull(items === null ? 'load' : 'refresh')
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [endpoint])
  )

  const visible = useMemo(() => {
    let source = items ?? []

    if (filters && filter !== 'all') {
      const active = filters.find((entry) => entry.key === filter)

      if (active) {
        source = source.filter(active.test)
      }
    }

    const term = search.trim().toLowerCase()
    const mapped = source.map((item) => ({ item, row: toRow(item) }))

    return term ? mapped.filter((entry) => entry.row.search.toLowerCase().includes(term)) : mapped
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, filter])

  const close = () => {
    setOpen(null)
    setRemarks('')
    setProblem(null)
  }

  const run = async (action: Action) => {
    if (running) {
      return
    }

    if (action.remarks === 'required' && remarks.trim().length < 3) {
      setProblem('Please write a short reason first.')

      return
    }

    setRunning(action.key)
    setProblem(null)

    for (const field of action.extra ?? []) {
      if (field.required && String(extras[field.key] ?? '').trim().length === 0) {
        setProblem(`${field.label} is required.`)

        return
      }
    }

    const body: Record<string, unknown> = { ...(action.body ?? {}) }

    for (const field of action.extra ?? []) {
      const value = String(extras[field.key] ?? '').trim()

      if (value.length > 0) {
        body[field.key] = value
      }
    }

    if (action.remarks && action.remarks !== 'none' && remarks.trim()) {
      body[action.remarksKey ?? 'remarks'] = remarks.trim()
    }

    try {
      await api(action.path, {
        method: action.method ?? 'PUT',
        body: Object.keys(body).length > 0 ? body : {},
      })

      close()
      await pull('refresh')
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not complete that action.')
    } finally {
      setRunning(null)
    }
  }

  const actions = open ? toActions(open) : []
  const needsRemarks = actions.some((action) => action.remarks && action.remarks !== 'none')
  const extraFields = actions.flatMap((action) => action.extra ?? [])
  const requiredBy = actions.find((action) => action.remarks === 'required')

  return (
    <Screen title={title} subtitle={`${items?.length ?? 0} total`}>
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState message={error} onRetry={() => pull('load')} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(entry) => entry.row.key}
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
                  placeholder={searchPlaceholder}
                  placeholderTextColor={theme.inkSubtle}
                  style={[styles.searchInput, { color: theme.ink }]}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>

              {filters ? (
                <View style={[styles.tabs, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
                  {[{ key: 'all', label: 'All' }, ...filters].map((entry) => {
                    const active = entry.key === filter

                    return (
                      <Pressable
                        key={entry.key}
                        onPress={() => setFilter(entry.key)}
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
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyState
                title={search ? 'No matches' : emptyTitle}
                message={search ? 'Try a different search term.' : emptyMessage}
              />
            </View>
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.row.title}
              subtitle={item.row.subtitle}
              badge={item.row.badge}
              meta={item.row.meta}
              onPress={() => {
                setOpen(item.item)
                setRemarks('')
                setProblem(null)
              }}
            />
          )}
        />
      )}

      <Modal visible={open !== null} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}
          >
            <View style={[styles.grab, { backgroundColor: theme.line }]} />

            {open ? (
              <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
                <Text style={[styles.sheetTitle, { color: theme.ink }]}>{toRow(open).title}</Text>
                <Text style={[styles.sheetSub, { color: theme.inkMuted }]}>{toRow(open).subtitle}</Text>

                <View style={[styles.details, { borderColor: theme.line }]}>
                  {toDetails(open).map((detail) => (
                    <View key={detail.label} style={styles.detail}>
                      <Text style={[styles.detailLabel, { color: theme.inkMuted }]}>{detail.label}</Text>
                      <Text style={[styles.detailValue, { color: theme.ink }]}>{detail.value}</Text>
                    </View>
                  ))}
                </View>

                {problem ? <Notice tone="danger" title="Failed" message={problem} /> : null}

                {extraFields.length > 0 ? (
                  <View style={styles.remarks}>
                    {extraFields.map((field) => (
                      <View key={field.key} style={styles.extra}>
                        <Text style={[styles.remarksLabel, { color: theme.inkMuted }]}>{field.label}</Text>
                        <TextInput
                          value={extras[field.key] ?? ''}
                          onChangeText={(next) => setExtras((current) => ({ ...current, [field.key]: next }))}
                          placeholder={field.placeholder}
                          placeholderTextColor={theme.inkSubtle}
                          style={[
                            styles.extraInput,
                            { color: theme.ink, borderColor: theme.line, backgroundColor: theme.canvas },
                          ]}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}

                {needsRemarks && actions.length > 0 ? (
                  <View style={styles.remarks}>
                    <Text style={[styles.remarksLabel, { color: theme.inkMuted }]}>
                      {requiredBy?.remarksLabel ?? 'Remarks'}
                      {requiredBy ? ' (required to reject)' : ' (optional)'}
                    </Text>
                    <TextInput
                      value={remarks}
                      onChangeText={setRemarks}
                      placeholder="Write a short note"
                      placeholderTextColor={theme.inkSubtle}
                      multiline
                      style={[
                        styles.remarksInput,
                        { color: theme.ink, borderColor: theme.line, backgroundColor: theme.canvas },
                      ]}
                    />
                  </View>
                ) : null}

                <View style={styles.sheetActions}>
                  {actions.length === 0 ? (
                    <Notice tone="info" title="No action available" message="This record is already closed." />
                  ) : null}

                  {actions.map((action) => (
                    <Button
                      key={action.key}
                      label={action.label}
                      variant={action.tone === 'danger' ? 'danger' : action.tone === 'secondary' ? 'secondary' : 'primary'}
                      onPress={() => run(action)}
                      loading={running === action.key}
                      disabled={running !== null && running !== action.key}
                      fullWidth
                    />
                  ))}

                  <Button label="Close" variant="ghost" onPress={close} disabled={running !== null} fullWidth />
                </View>
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    gap: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: radius.sm,
  },
  tabLabel: {
    fontSize: font.sm,
  },
  empty: {
    flex: 1,
    minHeight: 320,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
  },
  grab: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  sheetBody: {
    paddingHorizontal: spacing.xl,
  },
  sheetTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sheetSub: {
    fontSize: font.sm,
    marginBottom: spacing.lg,
  },
  details: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: 9,
  },
  detailLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  detailValue: {
    flexShrink: 1,
    fontSize: font.sm,
    fontWeight: '600',
    textAlign: 'right',
  },
  extra: {
    gap: 6,
  },
  extraInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    fontSize: font.md,
  },
  remarks: {
    gap: 6,
    marginBottom: spacing.lg,
  },
  remarksLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  remarksInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: font.md,
    height: 84,
    textAlignVertical: 'top',
  },
  sheetActions: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
})
