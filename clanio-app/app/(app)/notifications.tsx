import { useCallback, useEffect, useState } from 'react'
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
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Notice } from '@/components/ui/Notice'
import { Select, type Option } from '@/components/ui/Select'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { Toggle } from '@/components/ui/Toggle'
import { formatDate } from '@/lib/clock'
import { api, apiList, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { onRealtime } from '@/lib/realtime'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Preference = {
  scope: string
  in_app: boolean
  push: boolean
  email: boolean
}

const priorities: Option[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
]

type Item = {
  id: number
  uuid: string
  type: string
  group: string
  title: string
  body: string | null
  priority: string
  is_read: boolean
  read_at: string | null
  created_at: string
}

export default function NotificationsScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { can } = useAuth()

  const [items, setItems] = useState<Item[] | null>(null)
  const [unreadCount, setUnreadCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [sheet, setSheet] = useState<'settings' | 'announce' | null>(null)
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState<string | null>('normal')
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Option[]>([])

  const pull = useCallback(async (mode: 'load' | 'refresh') => {
    mode === 'load' ? setLoading(true) : setRefreshing(true)
    setError(null)

    try {
      const [result, summary] = await Promise.all([
        apiList<Item>('/notifications?per_page=100'),
        api<{ unread_count?: number }>('/notifications/unread-count').catch(
          () => ({}) as { unread_count?: number }
        ),
      ])

      setItems(result.data)
      setUnreadCount(summary.unread_count ?? null)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load notifications.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(
    () =>
      onRealtime((event) => {
        if (event.name.startsWith('notification.') || event.name === 'announcement.new') {
          void pull('refresh')
        }
      }),
    [pull]
  )

  useFocusEffect(
    useCallback(() => {
      void pull(items === null ? 'load' : 'refresh')
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  )

  const markRead = async (item: Item) => {
    if (item.is_read) {
      return
    }

    setItems((current) =>
      (current ?? []).map((row) => (row.id === item.id ? { ...row, is_read: true } : row))
    )

    await api(`/notifications/${item.uuid ?? item.id}/read`, { method: 'PUT' }).catch(() => undefined)
  }

  const markAll = async () => {
    if (busy) {
      return
    }

    setBusy(true)

    try {
      await api('/notifications/read-all', { method: 'PUT' })
      await pull('refresh')
    } catch {
      setError('Could not mark all as read.')
    } finally {
      setBusy(false)
    }
  }

  const openSettings = async () => {
    setSheet('settings')
    setProblem(null)

    try {
      const list = await api<Preference[]>('/notifications/preferences')

      setPreferences(list)
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not load preferences.')
    }
  }

  const togglePreference = (scope: string, key: 'in_app' | 'push' | 'email', value: boolean) => {
    setPreferences((current) => current.map((row) => (row.scope === scope ? { ...row, [key]: value } : row)))
  }

  const savePreferences = async () => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api('/notifications/preferences', {
        method: 'PUT',
        body: {
          preferences: preferences.map((row) => ({
            scope: row.scope,
            in_app: row.in_app,
            push: row.push,
            email: row.email,
          })),
        },
      })

      setSheet(null)
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not save preferences.')
    } finally {
      setBusy(false)
    }
  }

  const openAnnounce = async () => {
    setSheet('announce')
    setProblem(null)
    setErrors({})
    setTitle('')
    setMessage('')
    setPriority('normal')
    setDepartmentId(null)

    try {
      const list = await apiList<Record<string, any>>('/departments?per_page=100')

      setDepartments(list.data.map((row) => ({ value: String(row.id), label: row.name })))
    } catch {
      setDepartments([])
    }
  }

  const announce = async () => {
    if (busy) {
      return
    }

    const found: Record<string, string> = {}

    if (title.trim().length < 3) {
      found.title = 'Write a headline'
    }

    setErrors(found)

    if (Object.keys(found).length > 0) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api('/notifications/announce', {
        method: 'POST',
        body: {
          title: title.trim(),
          body: message.trim() || null,
          priority,
          department_id: departmentId ? Number(departmentId) : null,
        },
      })

      setSheet(null)
      await pull('refresh')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 422 && Object.keys(caught.fields).length > 0) {
        const mapped: Record<string, string> = {}

        for (const [field, messages] of Object.entries(caught.fields)) {
          mapped[field] = messages[0]
        }

        setErrors(mapped)
        setProblem('Check the highlighted fields.')
      } else {
        setProblem(caught instanceof ApiError ? caught.message : 'Could not send the announcement.')
      }
    } finally {
      setBusy(false)
    }
  }

  const unread = unreadCount ?? (items ?? []).filter((item) => !item.is_read).length

  return (
    <Screen
      title="Notifications"
      subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
      action={{ label: 'Settings', onPress: openSettings }}
    >
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState message={error} onRetry={() => pull('load')} />
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={(item) => String(item.uuid ?? item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => pull('refresh')} tintColor={theme.brand} />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              {can('notification.send') ? (
                <Button label="Send an announcement" variant="secondary" size="sm" onPress={openAnnounce} fullWidth />
              ) : null}

              {unread > 0 ? (
                <Button
                  label="Mark all as read"
                  variant="secondary"
                  size="sm"
                  onPress={markAll}
                  loading={busy}
                  fullWidth
                />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyState title="Nothing yet" message="Approvals, reminders and updates will land here." />
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => markRead(item)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: pressed ? theme.canvas : theme.surface,
                  borderColor: item.is_read ? theme.line : theme.brand,
                },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: item.is_read ? 'transparent' : theme.brand }]} />

              <View style={styles.body}>
                <Text style={[styles.title, { color: theme.ink, fontWeight: item.is_read ? '500' : '700' }]}>
                  {item.title}
                </Text>
                {item.body ? (
                  <Text numberOfLines={2} style={[styles.text, { color: theme.inkMuted }]}>
                    {item.body}
                  </Text>
                ) : null}
                <Text style={[styles.meta, { color: theme.inkSubtle }]}>
                  {item.group} · {relative(item.created_at)}
                </Text>
              </View>

              {item.priority === 'high' ? (
                <Icon name="alert-circle-outline" size={16} color={theme.warning} />
              ) : null}
            </Pressable>
          )}
        />
      )}
      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={[styles.grab, { backgroundColor: theme.line }]} />

            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>
                {sheet === 'announce' ? 'Send an announcement' : 'What you get notified about'}
              </Text>

              {problem ? <Notice tone="danger" title="Failed" message={problem} /> : null}

              {sheet === 'settings' ? (
                <View style={styles.form}>
                  {preferences.length === 0 ? (
                    <Loader />
                  ) : (
                    preferences.map((row) => (
                      <View key={row.scope} style={styles.prefGroup}>
                        <Text style={[styles.prefTitle, { color: theme.inkSubtle }]}>{row.scope}</Text>

                        <Toggle
                          label="In the app"
                          value={row.in_app}
                          onChange={(next) => togglePreference(row.scope, 'in_app', next)}
                          disabled={busy}
                        />
                        <Toggle
                          label="Push"
                          value={row.push}
                          onChange={(next) => togglePreference(row.scope, 'push', next)}
                          disabled={busy}
                        />
                        <Toggle
                          label="Email"
                          value={row.email}
                          onChange={(next) => togglePreference(row.scope, 'email', next)}
                          disabled={busy}
                        />
                      </View>
                    ))
                  )}

                  <Button label="Save preferences" onPress={savePreferences} loading={busy} fullWidth />
                  <Button label="Cancel" variant="ghost" onPress={() => setSheet(null)} disabled={busy} fullWidth />
                </View>
              ) : (
                <View style={styles.form}>
                  <Field
                    label="Headline"
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Office closed on Friday"
                    autoCapitalize="sentences"
                    error={errors.title}
                    editable={!busy}
                  />
                  <Field
                    label="Message"
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Anything else people should know"
                    autoCapitalize="sentences"
                    error={errors.body}
                    editable={!busy}
                    multiline
                  />
                  <Select
                    label="Priority"
                    value={priority}
                    options={priorities}
                    onChange={setPriority}
                    error={errors.priority}
                    disabled={busy}
                  />
                  <Select
                    label="Only one department"
                    value={departmentId}
                    options={departments}
                    onChange={setDepartmentId}
                    placeholder="Everyone"
                    allowClear
                    error={errors.department_id}
                    disabled={busy}
                  />

                  <Button label="Send to everyone" onPress={announce} loading={busy} fullWidth />
                  <Button label="Cancel" variant="ghost" onPress={() => setSheet(null)} disabled={busy} fullWidth />
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  )
}

function relative(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)

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

  return days < 7 ? `${days}d ago` : formatDate(value)
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    minHeight: 320,
  },
  header: {
    gap: spacing.sm,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '90%',
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
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  prefGroup: {
    gap: spacing.sm,
  },
  prefTitle: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  body: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: font.md,
  },
  text: {
    fontSize: font.sm,
    lineHeight: 19,
  },
  meta: {
    fontSize: font.xs,
    textTransform: 'capitalize',
  },
})
