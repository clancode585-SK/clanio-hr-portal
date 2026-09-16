import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Select } from '@/components/ui/Select'
import { ErrorState, Loader } from '@/components/ui/States'
import { formatDate, formatDateTime } from '@/lib/clock'
import { api, apiList } from '@/lib/api'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Change = {
  field: string
  label: string
  from: string | null
  to: string | null
}

type Entry = {
  id: number
  event: string
  entity: string
  entity_label: string
  entity_id: number | null
  actor: string | null
  actor_email: string | null
  ip_address: string | null
  happened_at: string | null
  change_count: number
  changes: Change[]
}

type Choice = {
  value: string | number
  label: string
  total: number
}

type Filters = {
  entities: Choice[]
  events: Choice[]
  actors: Choice[]
  total: number
}

const PER_PAGE = 25

export default function AuditLogScreen() {
  const theme = useTheme()

  const [filters, setFilters] = useState<Filters | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)

  const [event, setEvent] = useState<string | null>(null)
  const [entity, setEntity] = useState<string | null>(null)
  const [actor, setActor] = useState<string | null>(null)

  const query = useCallback(
    (target: number): string => {
      const parts = [`per_page=${PER_PAGE}`, `page=${target}`]

      if (event) {
        parts.push(`event=${encodeURIComponent(event)}`)
      }

      if (entity) {
        parts.push(`entity=${encodeURIComponent(entity)}`)
      }

      if (actor) {
        parts.push(`actor_id=${encodeURIComponent(actor)}`)
      }

      return parts.join('&')
    },
    [event, entity, actor]
  )

  const fetchPage = useCallback(
    async (target: number, mode: 'load' | 'refresh' | 'more') => {
      if (mode === 'load') {
        setLoading(true)
      } else if (mode === 'refresh') {
        setRefreshing(true)
      } else {
        setMore(true)
      }

      setError(null)

      try {
        const result = await apiList<Entry>(`/audit-logs?${query(target)}`)

        setEntries((current) => (mode === 'more' ? [...current, ...result.data] : result.data))
        setPage(result.meta?.current_page ?? target)
        setLastPage(result.meta?.last_page ?? 1)
        setTotal(result.meta?.total ?? result.data.length)
      } catch {
        setError('Could not load the audit log.')
      } finally {
        setLoading(false)
        setRefreshing(false)
        setMore(false)
      }
    },
    [query]
  )

  useEffect(() => {
    let live = true

    void api<Filters>('/audit-logs/filters').then((data) => {
      if (live) {
        setFilters(data)
      }
    })

    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    setOpen(null)
    void fetchPage(1, 'load')
  }, [fetchPage])

  const clear = () => {
    setEvent(null)
    setEntity(null)
    setActor(null)
  }

  const active = [event, entity, actor].filter(Boolean).length

  if (loading) {
    return (
      <Screen title="Audit Log">
        <Loader />
      </Screen>
    )
  }

  if (error && entries.length === 0) {
    return (
      <Screen title="Audit Log">
        <ErrorState message={error} onRetry={() => fetchPage(1, 'load')} />
      </Screen>
    )
  }

  return (
    <Screen title="Audit Log" subtitle={`${total} ${total === 1 ? 'change' : 'changes'} recorded`}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchPage(1, 'refresh')} tintColor={theme.brand} />
        }
      >
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Select
            label="What happened"
            value={event}
            options={(filters?.events ?? []).map((row) => ({
              value: String(row.value),
              label: row.label,
              hint: `${row.total}`,
            }))}
            onChange={setEvent}
            placeholder="Anything"
            allowClear
          />

          <Select
            label="What changed"
            value={entity}
            options={(filters?.entities ?? []).map((row) => ({
              value: String(row.value),
              label: row.label,
              hint: `${row.total}`,
            }))}
            onChange={setEntity}
            placeholder="Everything"
            allowClear
          />

          <Select
            label="Who did it"
            value={actor}
            options={(filters?.actors ?? []).map((row) => ({
              value: String(row.value),
              label: row.label,
              hint: `${row.total}`,
            }))}
            onChange={setActor}
            placeholder="Anyone"
            allowClear
          />

          {active > 0 ? <Button label="Clear filters" variant="ghost" size="sm" onPress={clear} /> : null}
        </View>

        {error ? <Notice tone="danger" title="Could not load more" message={error} /> : null}

        {entries.length === 0 ? (
          <Notice
            tone="info"
            title="Nothing here"
            message={active > 0 ? 'No changes match these filters.' : 'Changes will appear here as people work.'}
          />
        ) : null}

        {entries.map((entry) => {
          const expanded = open === entry.id

          return (
            <Pressable
              key={entry.id}
              onPress={() => setOpen(expanded ? null : entry.id)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: pressed ? theme.canvas : theme.surface, borderColor: theme.line },
              ]}
            >
              <View style={styles.head}>
                <View style={[styles.tag, { backgroundColor: eventSoft(theme, entry.event) }]}>
                  <Text style={[styles.tagText, { color: eventInk(theme, entry.event) }]}>{entry.event}</Text>
                </View>
                <Text numberOfLines={1} style={[styles.entity, { color: theme.ink }]}>
                  {entry.entity_label}
                </Text>
                <Text style={[styles.when, { color: theme.inkSubtle }]}>{ago(entry.happened_at)}</Text>
              </View>

              <Text style={[styles.who, { color: theme.inkMuted }]}>
                {entry.actor ?? 'System'}
                {entry.entity_id ? ` · record #${entry.entity_id}` : ''}
                {entry.change_count > 0 ? ` · ${entry.change_count} ${entry.change_count === 1 ? 'field' : 'fields'}` : ''}
              </Text>

              {expanded ? (
                <View style={[styles.detail, { borderTopColor: theme.line }]}>
                  {entry.changes.length === 0 ? (
                    <Text style={[styles.empty, { color: theme.inkSubtle }]}>No field values were recorded.</Text>
                  ) : (
                    entry.changes.map((change) => (
                      <View key={change.field} style={styles.change}>
                        <Text style={[styles.field, { color: theme.inkMuted }]}>{change.label}</Text>
                        <View style={styles.values}>
                          <Text numberOfLines={2} style={[styles.from, { color: theme.inkSubtle }]}>
                            {change.from ?? 'empty'}
                          </Text>
                          <Text style={[styles.arrow, { color: theme.inkSubtle }]}>→</Text>
                          <Text numberOfLines={2} style={[styles.to, { color: theme.ink }]}>
                            {change.to ?? 'empty'}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}

                  <Text style={[styles.foot, { color: theme.inkSubtle }]}>
                    {stamp(entry.happened_at)}
                    {entry.actor_email ? ` · ${entry.actor_email}` : ''}
                    {entry.ip_address ? ` · ${entry.ip_address}` : ''}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          )
        })}

        {page < lastPage ? (
          <Button
            label={more ? 'Loading' : `Load ${Math.min(PER_PAGE, total - entries.length)} more`}
            variant="secondary"
            loading={more}
            onPress={() => fetchPage(page + 1, 'more')}
            fullWidth
          />
        ) : null}
      </ScrollView>
    </Screen>
  )
}

function ago(value: string | null): string {
  if (!value) {
    return ''
  }

  const then = new Date(value).getTime()
  const minutes = Math.floor((Date.now() - then) / 60000)

  if (minutes < 1) {
    return 'just now'
  }

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)

  if (days < 30) {
    return `${days}d ago`
  }

  return formatDate(value)
}

function stamp(value: string | null): string {
  if (!value) {
    return 'Time not recorded'
  }

  return formatDateTime(value, 'Time not recorded')
}

function eventSoft(theme: ReturnType<typeof useTheme>, event: string): string {
  if (event === 'created') {
    return theme.successSoft
  }

  if (event === 'deleted') {
    return theme.dangerSoft
  }

  return theme.infoSoft
}

function eventInk(theme: ReturnType<typeof useTheme>, event: string): string {
  if (event === 'created') {
    return theme.success
  }

  if (event === 'deleted') {
    return theme.danger
  }

  return theme.info
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  panel: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tagText: {
    fontSize: font.xs,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  entity: {
    flex: 1,
    fontSize: font.sm,
    fontWeight: '700',
  },
  when: {
    fontSize: font.xs,
  },
  who: {
    fontSize: font.xs,
  },
  detail: {
    borderTopWidth: 1,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  change: {
    gap: 2,
  },
  field: {
    fontSize: font.xs,
    fontWeight: '600',
  },
  values: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  from: {
    flex: 1,
    fontSize: font.sm,
    textDecorationLine: 'line-through',
  },
  arrow: {
    fontSize: font.sm,
  },
  to: {
    flex: 1,
    fontSize: font.sm,
    fontWeight: '600',
  },
  empty: {
    fontSize: font.sm,
  },
  foot: {
    fontSize: font.xs,
  },
})
