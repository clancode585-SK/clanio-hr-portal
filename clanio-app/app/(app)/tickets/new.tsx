import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Select, type Option } from '@/components/ui/Select'
import { ErrorState, Loader } from '@/components/ui/States'
import { api, ApiError } from '@/lib/api'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Route = {
  id: number
  label: string
  hint: string | null
  route_to: string
  is_default: boolean
}

type Category = {
  id: number
  name: string
  code: string
  scope: string
  default_priority: string
  routes: Route[]
}

const priorities: Option[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export default function TicketCreateScreen() {
  const theme = useTheme()
  const router = useRouter()

  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [routeId, setRouteId] = useState<number | null>(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => api<Category[]>('/ticket-categories'), [])
  const categories = useResource<Category[]>(load, [])

  const options = useMemo<Option[]>(
    () =>
      (categories.data ?? []).map((row) => ({
        value: String(row.id),
        label: row.name,
        hint: row.scope === 'platform' ? 'Clanio support' : undefined,
      })),
    [categories.data]
  )

  const selected = useMemo(
    () => (categories.data ?? []).find((row) => String(row.id) === categoryId) ?? null,
    [categories.data, categoryId]
  )

  const pickCategory = (value: string | null) => {
    setCategoryId(value)
    setErrors({})

    const category = (categories.data ?? []).find((row) => String(row.id) === value)

    if (!category) {
      setRouteId(null)

      return
    }

    setPriority(category.default_priority)

    const fallback = category.routes.find((route) => route.is_default)

    setRouteId(fallback ? fallback.id : category.routes.length === 1 ? category.routes[0].id : null)
  }

  const submit = async () => {
    if (busy) {
      return
    }

    const next: Record<string, string> = {}

    if (!categoryId) {
      next.category_id = 'Pick a category'
    }

    if (selected && selected.routes.length > 0 && routeId === null) {
      next.route_id = 'Choose who this goes to'
    }

    if (subject.trim().length < 3) {
      next.subject = 'Write a short subject'
    }

    if (message.trim().length < 5) {
      next.message = 'Describe the problem'
    }

    setErrors(next)

    if (Object.keys(next).length > 0) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api('/tickets', {
        method: 'POST',
        body: {
          category_id: Number(categoryId),
          route_id: routeId,
          subject: subject.trim(),
          message: message.trim(),
          priority: priority ?? undefined,
        },
      })

      router.replace('/tickets')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 422 && Object.keys(caught.fields).length > 0) {
        const mapped: Record<string, string> = {}

        for (const [field, messages] of Object.entries(caught.fields)) {
          mapped[field] = messages[0]
        }

        setErrors(mapped)
        setProblem('Check the highlighted fields.')
      } else {
        setProblem(caught instanceof ApiError ? caught.message : 'Could not raise the ticket.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (categories.loading) {
    return (
      <Screen title="Raise a ticket" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (categories.error) {
    return (
      <Screen title="Raise a ticket" leading="back">
        <ErrorState message={categories.error} onRetry={categories.reload} />
      </Screen>
    )
  }

  const routes = selected?.routes ?? []

  return (
    <Screen title="Raise a ticket" leading="back">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {problem ? <Notice tone="danger" title="Could not send" message={problem} /> : null}

          <Select
            label="What is this about"
            value={categoryId}
            options={options}
            onChange={pickCategory}
            placeholder="Select a category"
            error={errors.category_id}
            disabled={busy}
          />

          {selected ? (
            <View style={styles.block}>
              <Text style={[styles.blockTitle, { color: theme.inkMuted }]}>Who should handle this</Text>

              {routes.length === 1 ? (
                <View style={[styles.locked, { backgroundColor: theme.brandSoft, borderColor: theme.brand }]}>
                  <Text style={[styles.lockedLabel, { color: theme.brand }]}>{routes[0].label}</Text>
                  <Text style={[styles.lockedHint, { color: theme.inkMuted }]}>
                    {routes[0].hint ?? 'Only this team handles this category.'}
                  </Text>
                </View>
              ) : (
                routes.map((route) => {
                  const active = route.id === routeId

                  return (
                    <Pressable
                      key={route.id}
                      onPress={() => setRouteId(route.id)}
                      style={({ pressed }) => [
                        styles.option,
                        {
                          backgroundColor: active ? theme.brandSoft : pressed ? theme.canvas : theme.surface,
                          borderColor: active ? theme.brand : theme.line,
                        },
                      ]}
                    >
                      <View style={[styles.radio, { borderColor: active ? theme.brand : theme.line }]}>
                        {active ? <View style={[styles.radioDot, { backgroundColor: theme.brand }]} /> : null}
                      </View>
                      <View style={styles.optionText}>
                        <Text style={[styles.optionLabel, { color: theme.ink }]}>{route.label}</Text>
                        {route.hint ? (
                          <Text style={[styles.optionHint, { color: theme.inkSubtle }]}>{route.hint}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  )
                })
              )}

              {errors.route_id ? (
                <Text style={[styles.error, { color: theme.danger }]}>{errors.route_id}</Text>
              ) : null}
            </View>
          ) : null}

          <Field
            label="Subject"
            value={subject}
            onChangeText={setSubject}
            placeholder="July payslip is not downloading"
            autoCapitalize="sentences"
            error={errors.subject}
            editable={!busy}
          />
          <Field
            label="Detail"
            value={message}
            onChangeText={setMessage}
            placeholder="What happened, and what did you already try"
            autoCapitalize="sentences"
            error={errors.message}
            editable={!busy}
            multiline
          />
          <Select
            label="Priority"
            value={priority}
            options={priorities}
            onChange={setPriority}
            placeholder="Normal"
            error={errors.priority}
            disabled={busy}
          />

          <View style={styles.actions}>
            <Button label="Send request" onPress={submit} loading={busy} fullWidth />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  block: {
    gap: spacing.sm,
  },
  blockTitle: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  locked: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 2,
  },
  lockedLabel: {
    fontSize: font.md,
    fontWeight: '700',
  },
  lockedHint: {
    fontSize: font.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  radio: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  optionText: {
    flex: 1,
    gap: 1,
  },
  optionLabel: {
    fontSize: font.md,
    fontWeight: '600',
  },
  optionHint: {
    fontSize: font.sm,
  },
  error: {
    fontSize: font.sm,
  },
  actions: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
})
