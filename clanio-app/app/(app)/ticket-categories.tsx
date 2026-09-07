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

type Item = Record<string, any>

type RouteDraft = {
  route_to: string
  label: string
  hint: string
  department_id: string | null
  user_id: string | null
  is_default: boolean
}

const scopes: Option[] = [
  { value: 'internal', label: 'Inside the company', hint: 'Goes to HR, IT or a manager' },
  { value: 'platform', label: 'Clanio support', hint: 'Goes to the product team' },
]

const priorities: Option[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const targets: Option[] = [
  { value: 'department', label: 'A department', hint: 'Anyone in that department picks it up' },
  { value: 'manager', label: 'Reporting manager', hint: 'The raiser own manager' },
  { value: 'user', label: 'One person', hint: 'Always the same handler' },
  { value: 'super_admin', label: 'Clanio support', hint: 'Leaves the company' },
]

const emptyRoute: RouteDraft = {
  route_to: 'department',
  label: '',
  hint: '',
  department_id: null,
  user_id: null,
  is_default: false,
}

export default function TicketCategoriesScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { can } = useAuth()

  const [items, setItems] = useState<Item[] | null>(null)
  const [departments, setDepartments] = useState<Option[]>([])
  const [users, setUsers] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [scope, setScope] = useState<string | null>('internal')
  const [priority, setPriority] = useState<string | null>('medium')
  const [responseHours, setResponseHours] = useState('')
  const [resolutionHours, setResolutionHours] = useState('')
  const [routes, setRoutes] = useState<RouteDraft[]>([{ ...emptyRoute, is_default: true }])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canManage = can('ticket.category_manage')

  const pull = useCallback(async (mode: 'load' | 'refresh') => {
    mode === 'load' ? setLoading(true) : setRefreshing(true)
    setError(null)

    try {
      const [categories, departmentList, userList] = await Promise.all([
        apiList<Item>('/ticket-categories?per_page=100'),
        apiList<Item>('/departments?per_page=100').catch(() => ({ data: [] as Item[] })),
        apiList<Item>('/users?per_page=200').catch(() => ({ data: [] as Item[] })),
      ])

      setItems(categories.data)
      setDepartments(departmentList.data.map((row) => ({ value: String(row.id), label: row.name })))
      setUsers(userList.data.map((row) => ({ value: String(row.id), label: row.name, hint: row.email })))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load categories.')
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

  const sorted = useMemo(
    () => [...(items ?? [])].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)),
    [items]
  )

  const start = (item: Item | null) => {
    setEditing(item)
    setErrors({})
    setProblem(null)
    setName(item?.name ?? '')
    setCode(item?.code ?? '')
    setScope(item?.scope ?? 'internal')
    setPriority(item?.default_priority ?? 'medium')
    setResponseHours(item?.response_hours != null ? String(item.response_hours) : '')
    setResolutionHours(item?.resolution_hours != null ? String(item.resolution_hours) : '')
    setRoutes(
      item?.routes?.length
        ? item.routes.map((row: Item) => ({
            route_to: row.route_to ?? 'department',
            label: row.label ?? '',
            hint: row.hint ?? '',
            department_id: row.department_id != null ? String(row.department_id) : null,
            user_id: row.user_id != null ? String(row.user_id) : null,
            is_default: Boolean(row.is_default),
          }))
        : [{ ...emptyRoute, is_default: true }]
    )
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    setEditing(null)
    setErrors({})
    setProblem(null)
  }

  const setRoute = (index: number, patch: Partial<RouteDraft>) => {
    setRoutes((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)))
  }

  const makeDefault = (index: number) => {
    setRoutes((current) => current.map((row, position) => ({ ...row, is_default: position === index })))
  }

  const addRoute = () => {
    setRoutes((current) => [...current, { ...emptyRoute }])
  }

  const dropRoute = (index: number) => {
    setRoutes((current) => (current.length === 1 ? current : current.filter((_, position) => position !== index)))
  }

  const submit = async () => {
    if (busy) {
      return
    }

    const next: Record<string, string> = {}

    if (name.trim().length < 2) {
      next.name = 'Name is required'
    }

    if (!/^[a-z0-9_]+$/.test(code.trim())) {
      next.code = 'Lowercase letters, numbers and underscore only'
    }

    routes.forEach((row, index) => {
      if (row.label.trim().length < 2) {
        next[`routes.${index}.label`] = 'Give this option a label'
      }

      if (row.route_to === 'department' && !row.department_id) {
        next[`routes.${index}.department_id`] = 'Pick a department'
      }

      if (row.route_to === 'user' && !row.user_id) {
        next[`routes.${index}.user_id`] = 'Pick a person'
      }
    })

    setErrors(next)

    if (Object.keys(next).length > 0) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      const id = editing ? String(editing.uuid ?? editing.id) : null

      await api(id ? `/ticket-categories/${id}` : '/ticket-categories', {
        method: id ? 'PUT' : 'POST',
        body: {
          name: name.trim(),
          code: code.trim(),
          scope,
          default_priority: priority,
          response_hours: responseHours.trim() ? Number(responseHours) : null,
          resolution_hours: resolutionHours.trim() ? Number(resolutionHours) : null,
          routes: routes.map((row, index) => ({
            route_to: row.route_to,
            label: row.label.trim(),
            hint: row.hint.trim() || null,
            department_id: row.route_to === 'department' && row.department_id ? Number(row.department_id) : null,
            user_id: row.route_to === 'user' && row.user_id ? Number(row.user_id) : null,
            is_default: row.is_default,
            sort_order: index,
          })),
        },
      })

      close()
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
        setProblem(caught instanceof ApiError ? caught.message : 'Could not save.')
      }
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    if (!editing) {
      return
    }

    Alert.alert('Delete this category?', 'People will not be able to raise tickets under it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true)

          try {
            await api(`/ticket-categories/${editing.uuid ?? editing.id}`, { method: 'DELETE' })
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

  return (
    <Screen
      title="Ticket Categories"
      subtitle={`${items?.length ?? 0} total`}
      action={canManage ? { label: 'Add', onPress: () => start(null) } : undefined}
    >
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState message={error} onRetry={() => pull('load')} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => String(item.uuid ?? item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => pull('refresh')} tintColor={theme.brand} />
          }
          ListHeaderComponent={
            <Notice
              tone="info"
              title="Routing lives here"
              message="Each category decides who a ticket reaches and how fast it must be answered."
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyState
                title="No categories"
                message="Add the reasons people raise tickets for."
                action={canManage ? { label: 'Add category', onPress: () => start(null) } : undefined}
              />
            </View>
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={`${item.routes?.length ?? 0} routing option${(item.routes?.length ?? 0) === 1 ? '' : 's'}`}
              badge={item.code}
              meta={item.scope === 'platform' ? 'Clanio' : item.default_priority}
              onPress={canManage ? () => start(item) : undefined}
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
                {editing ? 'Edit category' : 'New category'}
              </Text>

              {problem ? <Notice tone="danger" title="Could not save" message={problem} /> : null}

              <View style={styles.form}>
                <Field label="Name" value={name} onChangeText={setName} placeholder="Payroll question" autoCapitalize="sentences" error={errors.name} editable={!busy} />
                <Field label="Code" value={code} onChangeText={setCode} placeholder="payroll_question" error={errors.code} editable={!busy} />
                <Select label="Scope" value={scope} options={scopes} onChange={setScope} error={errors.scope} disabled={busy} />
                <Select label="Default priority" value={priority} options={priorities} onChange={setPriority} error={errors.default_priority} disabled={busy} />
                <Field label="Respond within (hours)" value={responseHours} onChangeText={setResponseHours} placeholder="4" keyboardType="number-pad" error={errors.response_hours} editable={!busy} />
                <Field label="Resolve within (hours)" value={resolutionHours} onChangeText={setResolutionHours} placeholder="24" keyboardType="number-pad" error={errors.resolution_hours} editable={!busy} />

                <Text style={[styles.group, { color: theme.inkSubtle }]}>Where tickets go</Text>

                {routes.map((row, index) => (
                  <View key={index} style={[styles.route, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
                    <View style={styles.routeHead}>
                      <Text style={[styles.routeTitle, { color: theme.ink }]}>Option {index + 1}</Text>

                      {routes.length > 1 ? (
                        <Pressable onPress={() => dropRoute(index)} disabled={busy} hitSlop={8}>
                          <Icon name="trash-outline" size={18} color={theme.danger} />
                        </Pressable>
                      ) : null}
                    </View>

                    <Select
                      label="Goes to"
                      value={row.route_to}
                      options={targets}
                      onChange={(next) => setRoute(index, { route_to: next ?? 'department' })}
                      error={errors[`routes.${index}.route_to`]}
                      disabled={busy}
                    />

                    {row.route_to === 'department' ? (
                      <Select
                        label="Department"
                        value={row.department_id}
                        options={departments}
                        onChange={(next) => setRoute(index, { department_id: next })}
                        placeholder="Which department"
                        error={errors[`routes.${index}.department_id`]}
                        disabled={busy}
                      />
                    ) : null}

                    {row.route_to === 'user' ? (
                      <Select
                        label="Person"
                        value={row.user_id}
                        options={users}
                        onChange={(next) => setRoute(index, { user_id: next })}
                        placeholder="Who handles it"
                        error={errors[`routes.${index}.user_id`]}
                        disabled={busy}
                      />
                    ) : null}

                    <Field
                      label="Label"
                      value={row.label}
                      onChangeText={(next) => setRoute(index, { label: next })}
                      placeholder="Send to HR"
                      autoCapitalize="sentences"
                      error={errors[`routes.${index}.label`]}
                      editable={!busy}
                    />
                    <Field
                      label="Hint"
                      value={row.hint}
                      onChangeText={(next) => setRoute(index, { hint: next })}
                      placeholder="Shown under the label"
                      autoCapitalize="sentences"
                      editable={!busy}
                    />

                    <Toggle
                      label="Pre-selected"
                      hint="This option is chosen unless the raiser changes it"
                      value={row.is_default}
                      onChange={() => makeDefault(index)}
                      disabled={busy}
                    />
                  </View>
                ))}

                <Button label="Add another option" variant="secondary" onPress={addRoute} disabled={busy} fullWidth />
                <Button label={editing ? 'Save changes' : 'Create category'} onPress={submit} loading={busy} fullWidth />

                {editing ? (
                  <Button label="Delete category" variant="danger" onPress={remove} disabled={busy} fullWidth />
                ) : null}

                <Button label="Cancel" variant="ghost" onPress={close} disabled={busy} fullWidth />
              </View>
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
  empty: {
    flex: 1,
    minHeight: 320,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '92%',
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
  group: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  route: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  routeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeTitle: {
    fontSize: font.sm,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
})
