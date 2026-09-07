import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  Alert,
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
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { ListRow } from '@/components/ui/ListRow'
import { Notice } from '@/components/ui/Notice'
import { Select, type Option } from '@/components/ui/Select'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { Toggle } from '@/components/ui/Toggle'
import { api, apiList, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Values = Record<string, any>

export type FieldSpec = {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'time' | 'select' | 'toggle' | 'days'
  placeholder?: string
  hint?: string
  required?: boolean
  multiline?: boolean
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  options?: Option[]
  optionsKey?: string
  allowClear?: boolean
  lockOnEdit?: boolean
  max?: number
  minLength?: number
  min?: number
  maxValue?: number
  integer?: boolean
  pattern?: RegExp
  patternMessage?: string
  afterKey?: string
  afterMessage?: string
}

export type CrudRow = {
  key: string
  title: string
  subtitle?: string
  badge?: string
  meta?: string
  search: string
}

export type RowAction<T> = {
  key: string
  label: string
  method: 'PUT' | 'POST' | 'DELETE'
  path: (item: T) => string
  tone?: 'primary' | 'secondary' | 'danger'
  permission?: string
  visible?: (item: T) => boolean
  body?: Record<string, unknown>
  prompt?: FieldSpec[] | ((item: T) => FieldSpec[])
  promptTitle?: string
  confirmLabel?: string
}

type Props<T> = {
  title: string
  endpoint: string
  singular: string
  fields: FieldSpec[]
  toRow: (item: T) => CrudRow
  toForm?: (item: T) => Values
  defaults?: Values
  permissions?: { create?: string; edit?: string; delete?: string }
  loadOptions?: () => Promise<Record<string, Option[]>>
  searchPlaceholder?: string
  emptyTitle?: string
  emptyMessage?: string
  notice?: { title: string; message: string }
  sort?: (a: T, b: T) => number
  transform?: (values: Values, mode: 'create' | 'edit') => Values
  updateMethod?: 'PUT' | 'POST'
  rowActions?: RowAction<T>[]
  allowUpdate?: boolean
  allowCreate?: boolean
  screenActions?: ScreenAction[]
}

export type ScreenAction = {
  label: string
  path: string
  method: 'POST' | 'PUT'
  prompt: FieldSpec[]
  title?: string
  confirmLabel?: string
  permission?: string
}

type Pending = {
  label: string
  title?: string
  confirmLabel?: string
  path: string
  method: 'PUT' | 'POST' | 'DELETE'
  tone?: 'primary' | 'secondary' | 'danger'
  body?: Record<string, unknown>
  prompt?: FieldSpec[]
}

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function blank(specs: FieldSpec[]): Values {
  const base: Values = {}

  for (const spec of specs) {
    base[spec.key] = spec.type === 'toggle' ? false : spec.type === 'days' ? [] : spec.type === 'select' ? null : ''
  }

  return base
}

function check(specs: FieldSpec[], values: Values): Record<string, string> {
  const next: Record<string, string> = {}

  for (const spec of specs) {
    const value = values[spec.key]

    if (spec.required) {
      const empty =
        spec.type === 'days'
          ? !Array.isArray(value) || value.length === 0
          : spec.type === 'select'
            ? value === null || value === ''
            : String(value ?? '').trim().length === 0

      if (empty) {
        next[spec.key] = `${spec.label} is required`

        continue
      }
    }

    const text = String(value ?? '').trim()

    if (text.length === 0) {
      continue
    }

    if (spec.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      next[spec.key] = 'Use YYYY-MM-DD'

      continue
    }

    if (spec.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
      next[spec.key] = 'Use HH:MM, like 09:30'

      continue
    }

    if (spec.type === 'number') {
      const amount = Number(text)

      if (Number.isNaN(amount)) {
        next[spec.key] = 'Numbers only'

        continue
      }

      if (spec.integer && !Number.isInteger(amount)) {
        next[spec.key] = 'Whole numbers only'

        continue
      }

      if (spec.min !== undefined && amount < spec.min) {
        next[spec.key] = `Cannot be less than ${spec.min}`

        continue
      }

      if (spec.maxValue !== undefined && amount > spec.maxValue) {
        next[spec.key] = `Cannot be more than ${spec.maxValue}`

        continue
      }
    }

    if (spec.type === 'text') {
      if (spec.minLength !== undefined && text.length < spec.minLength) {
        next[spec.key] = `At least ${spec.minLength} characters`

        continue
      }

      if (spec.max !== undefined && text.length > spec.max) {
        next[spec.key] = `${text.length} of ${spec.max} characters used`

        continue
      }

      if (spec.pattern && !spec.pattern.test(text)) {
        next[spec.key] = spec.patternMessage ?? 'This format is not allowed'

        continue
      }
    }

    if (spec.afterKey) {
      const other = String(values[spec.afterKey] ?? '').trim()

      if (other.length > 0 && text < other) {
        next[spec.key] = spec.afterMessage ?? 'Must come after the earlier date'
      }
    }
  }

  return next
}

function build(specs: FieldSpec[], values: Values, skipLocked: boolean): Values {
  const body: Values = {}

  for (const spec of specs) {
    if (skipLocked && spec.lockOnEdit) {
      continue
    }

    const value = values[spec.key]

    if (spec.type === 'toggle') {
      body[spec.key] = Boolean(value)

      continue
    }

    if (spec.type === 'days') {
      body[spec.key] = value

      continue
    }

    if (spec.type === 'select') {
      if (value === null || value === '') {
        if (spec.allowClear) {
          body[spec.key] = null
        }

        continue
      }

      body[spec.key] = spec.key.endsWith('_id') ? Number(value) : value

      continue
    }

    const text = String(value ?? '').trim()

    if (text.length === 0) {
      if (spec.allowClear) {
        body[spec.key] = null
      }

      continue
    }

    body[spec.key] = spec.type === 'number' ? Number(text) : text
  }

  return body
}

export function CrudList<T extends Record<string, any>>({
  title,
  endpoint,
  singular,
  fields,
  toRow,
  toForm,
  defaults = {},
  permissions = {},
  loadOptions,
  searchPlaceholder = 'Search',
  emptyTitle = 'Nothing here yet',
  emptyMessage = 'Records will show up here once they exist.',
  notice,
  sort,
  transform,
  updateMethod = 'PUT',
  rowActions = [],
  allowUpdate = true,
  allowCreate = true,
  screenActions = [],
}: Props<T>) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { can } = useAuth()

  const [items, setItems] = useState<T[] | null>(null)
  const [choices, setChoices] = useState<Record<string, Option[]>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [editing, setEditing] = useState<T | null>(null)
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Values>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [prompting, setPrompting] = useState<Pending | null>(null)

  const canCreate = allowCreate && (!permissions.create || can(permissions.create))
  const openScreenActions = screenActions.filter((entry) => !entry.permission || can(entry.permission))
  const canEdit = !permissions.edit || can(permissions.edit)
  const canUpdate = allowUpdate && canEdit
  const canDelete = permissions.delete ? can(permissions.delete) : false

  const pull = useCallback(
    async (mode: 'load' | 'refresh') => {
      mode === 'load' ? setLoading(true) : setRefreshing(true)
      setError(null)

      try {
        const joiner = endpoint.includes('?') ? '&' : '?'
        const [list, options] = await Promise.all([
          apiList<T>(`${endpoint}${joiner}per_page=100`),
          loadOptions ? loadOptions() : Promise.resolve({}),
        ])

        setItems(list.data)
        setChoices(options)
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Could not load data.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [endpoint]
  )

  useFocusEffect(
    useCallback(() => {
      void pull(items === null ? 'load' : 'refresh')
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [endpoint])
  )

  const rows = useMemo(() => {
    const source = [...(items ?? [])]

    if (sort) {
      source.sort(sort)
    }

    const term = search.trim().toLowerCase()

    return source
      .map((item) => ({ item, row: toRow(item) }))
      .filter((entry) => (term ? entry.row.search.toLowerCase().includes(term) : true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search])

  const seed = (item: T | null): Values => {
    const merged = { ...blank(fields), ...defaults }

    if (!item) {
      return merged
    }

    const raw = toForm ? toForm(item) : item

    for (const spec of fields) {
      const value = raw[spec.key]

      if (value === undefined || value === null) {
        continue
      }

      if (spec.type === 'toggle') {
        merged[spec.key] = Boolean(value)
      } else if (spec.type === 'days') {
        merged[spec.key] = Array.isArray(value) ? value.map(Number) : []
      } else if (spec.type === 'time') {
        merged[spec.key] = String(value).slice(0, 5)
      } else {
        merged[spec.key] = String(value)
      }
    }

    return merged
  }

  const start = (item: T | null) => {
    setEditing(item)
    setValues(seed(item))
    setErrors({})
    setProblem(null)
    setPrompting(null)
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    setEditing(null)
    setPrompting(null)
    setErrors({})
    setProblem(null)
  }

  const set = (key: string, value: any) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) {
        return current
      }

      const next = { ...current }
      delete next[key]

      return next
    })
  }

  const catchApi = (caught: unknown, fallback: string) => {
    if (caught instanceof ApiError && caught.status === 422 && Object.keys(caught.fields).length > 0) {
      const mapped: Record<string, string> = {}

      for (const [field, messages] of Object.entries(caught.fields)) {
        mapped[field] = messages[0]
      }

      setErrors(mapped)
      setProblem('Check the highlighted fields.')

      return
    }

    setProblem(caught instanceof ApiError ? caught.message : fallback)
  }

  const submit = async () => {
    if (busy) {
      return
    }

    const found = check(fields, values)

    setErrors(found)

    if (Object.keys(found).length > 0) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      const id = editing ? String(editing.uuid ?? editing.id) : null
      const body = build(fields, values, Boolean(editing))

      await api(id ? `${endpoint}/${id}` : endpoint, {
        method: id ? updateMethod : 'POST',
        body: transform ? transform(body, editing ? 'edit' : 'create') : body,
      })

      close()
      await pull('refresh')
    } catch (caught) {
      catchApi(caught, 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const trigger = (entry: RowAction<T>) => {
    if (!editing || busy) {
      return
    }

    setProblem(null)
    setErrors({})

    const fields = typeof entry.prompt === 'function' ? entry.prompt(editing) : entry.prompt

    const pending: Pending = {
      label: entry.label,
      title: entry.promptTitle,
      confirmLabel: entry.confirmLabel,
      path: entry.path(editing),
      method: entry.method,
      tone: entry.tone,
      body: entry.body,
      prompt: fields,
    }

    if (fields) {
      setValues(blank(fields))
      setPrompting(pending)

      return
    }

    void run(pending, entry.body ?? {})
  }

  const startScreenAction = (entry: ScreenAction) => {
    setEditing(null)
    setValues(blank(entry.prompt))
    setErrors({})
    setProblem(null)
    setPrompting({
      label: entry.label,
      title: entry.title,
      confirmLabel: entry.confirmLabel,
      path: entry.path,
      method: entry.method,
      prompt: entry.prompt,
    })
    setOpen(true)
  }

  const run = async (entry: Pending, body: Values) => {
    setBusy(true)
    setProblem(null)

    try {
      await api(entry.path, { method: entry.method, body })
      close()
      await pull('refresh')
    } catch (caught) {
      catchApi(caught, 'Could not complete that action.')
    } finally {
      setBusy(false)
    }
  }

  const confirmPrompt = () => {
    if (!prompting?.prompt) {
      return
    }

    const found = check(prompting.prompt, values)

    setErrors(found)

    if (Object.keys(found).length > 0) {
      return
    }

    void run(prompting, { ...(prompting.body ?? {}), ...build(prompting.prompt, values, false) })
  }

  const remove = () => {
    if (!editing) {
      return
    }

    const id = String(editing.uuid ?? editing.id)

    Alert.alert(`Delete this ${singular}?`, 'It will stop showing anywhere it is used.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true)

          try {
            await api(`${endpoint}/${id}`, { method: 'DELETE' })
            close()
            await pull('refresh')
          } catch (caught) {
            setProblem(caught instanceof ApiError ? caught.message : 'Could not delete.')
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }

  const optionsFor = (spec: FieldSpec): Option[] =>
    spec.optionsKey ? (choices[spec.optionsKey] ?? []) : (spec.options ?? [])

  const renderField = (spec: FieldSpec) => {
    if (spec.type === 'toggle') {
      return (
        <Toggle
          key={spec.key}
          label={spec.label}
          hint={spec.hint}
          value={Boolean(values[spec.key])}
          onChange={(next) => set(spec.key, next)}
          disabled={busy}
        />
      )
    }

    if (spec.type === 'select') {
      return (
        <Select
          key={spec.key}
          label={spec.label}
          value={values[spec.key] ?? null}
          options={optionsFor(spec)}
          onChange={(next) => set(spec.key, next)}
          placeholder={spec.placeholder ?? 'Select'}
          allowClear={spec.allowClear}
          error={errors[spec.key]}
          disabled={busy}
        />
      )
    }

    if (spec.type === 'days') {
      const picked: number[] = values[spec.key] ?? []

      return (
        <View key={spec.key} style={styles.days}>
          <Text style={[styles.daysLabel, { color: theme.inkMuted }]}>{spec.label}</Text>

          <View style={styles.dayRow}>
            {weekdays.map((day, index) => {
              const active = picked.includes(index)

              return (
                <Pressable
                  key={day}
                  disabled={busy}
                  onPress={() =>
                    set(spec.key, active ? picked.filter((value) => value !== index) : [...picked, index].sort())
                  }
                  style={[
                    styles.day,
                    {
                      backgroundColor: active ? theme.brand : theme.surface,
                      borderColor: active ? theme.brand : theme.line,
                    },
                  ]}
                >
                  <Text style={[styles.dayText, { color: active ? theme.onBrand : theme.inkMuted }]}>{day}</Text>
                </Pressable>
              )
            })}
          </View>

          {errors[spec.key] ? <Text style={[styles.error, { color: theme.danger }]}>{errors[spec.key]}</Text> : null}
        </View>
      )
    }

    return (
      <Field
        key={spec.key}
        label={spec.label}
        value={String(values[spec.key] ?? '')}
        onChangeText={(next) => set(spec.key, next)}
        placeholder={spec.placeholder}
        keyboardType={spec.type === 'number' ? 'decimal-pad' : undefined}
        autoCapitalize={spec.autoCapitalize ?? 'none'}
        multiline={spec.multiline}
        maxLength={spec.max}
        error={errors[spec.key]}
        editable={!busy && (canUpdate || prompting !== null || !editing)}
      />
    )
  }

  const available = editing
    ? rowActions.filter(
        (entry) => (!entry.permission || can(entry.permission)) && (!entry.visible || entry.visible(editing))
      )
    : []

  return (
    <Screen
      title={title}
      subtitle={`${items?.length ?? 0} total`}
      action={canCreate ? { label: 'Add', onPress: () => start(null) } : undefined}
    >
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState message={error} onRetry={() => pull('load')} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(entry) => entry.row.key}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => pull('refresh')} tintColor={theme.brand} />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              {notice ? <Notice tone="info" title={notice.title} message={notice.message} /> : null}

              {openScreenActions.length > 0 ? (
                <View style={styles.screenActions}>
                  {openScreenActions.map((entry) => (
                    <Pressable
                      key={entry.label}
                      onPress={() => startScreenAction(entry)}
                      style={({ pressed }) => [
                        styles.screenAction,
                        { backgroundColor: pressed ? theme.brandSoft : theme.surface, borderColor: theme.brand },
                      ]}
                    >
                      <Text style={[styles.screenActionText, { color: theme.brand }]}>{entry.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

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
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyState
                title={search ? 'No matches' : emptyTitle}
                message={search ? 'Try a different search term.' : emptyMessage}
                action={canCreate && !search ? { label: `Add ${singular}`, onPress: () => start(null) } : undefined}
              />
            </View>
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.row.title}
              subtitle={item.row.subtitle}
              badge={item.row.badge}
              meta={item.row.meta}
              onPress={canEdit || canDelete || rowActions.length > 0 ? () => start(item.item) : undefined}
            />
          )}
        />
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={[styles.grab, { backgroundColor: theme.line }]} />

            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>
                {prompting
                  ? (prompting.title ?? prompting.label)
                  : editing
                    ? canUpdate
                      ? `Edit ${singular}`
                      : String(toRow(editing).title)
                    : `New ${singular}`}
              </Text>

              {problem ? <Notice tone="danger" title="Could not save" message={problem} /> : null}

              {prompting ? (
                <View style={styles.form}>
                  {prompting.prompt?.map(renderField)}

                  <Button
                    label={prompting.confirmLabel ?? prompting.label}
                    variant={prompting.tone === 'danger' ? 'danger' : 'primary'}
                    onPress={confirmPrompt}
                    loading={busy}
                    fullWidth
                  />
                  <Button label="Back" variant="ghost" onPress={() => (editing ? start(editing) : close())} disabled={busy} fullWidth />
                </View>
              ) : (
                <View style={styles.form}>
                  {fields.filter((spec) => !(spec.lockOnEdit && editing)).map(renderField)}

                  {canUpdate || !editing ? (
                    <Button
                      label={editing ? 'Save changes' : `Create ${singular}`}
                      onPress={submit}
                      loading={busy}
                      fullWidth
                    />
                  ) : null}

                  {available.map((entry) => (
                    <Button
                      key={entry.key}
                      label={entry.label}
                      variant={entry.tone === 'danger' ? 'danger' : entry.tone === 'primary' ? 'primary' : 'secondary'}
                      onPress={() => trigger(entry)}
                      disabled={busy}
                      fullWidth
                    />
                  ))}

                  {editing && canDelete ? (
                    <Button label={`Delete ${singular}`} variant="danger" onPress={remove} disabled={busy} fullWidth />
                  ) : null}

                  <Button label="Cancel" variant="ghost" onPress={close} disabled={busy} fullWidth />
                </View>
              )}
            </ScrollView>
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
    gap: spacing.md,
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
  empty: {
    flex: 1,
    minHeight: 320,
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
  days: {
    gap: spacing.sm,
  },
  daysLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dayRow: {
    flexDirection: 'row',
    gap: 6,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  dayText: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  error: {
    fontSize: font.sm,
  },
  screenActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  screenAction: {
    flexGrow: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  screenActionText: {
    fontSize: font.sm,
    fontWeight: '700',
  },
})
