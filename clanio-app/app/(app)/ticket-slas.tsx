import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { ErrorState, Loader } from '@/components/ui/States'
import { ApiError, api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Sla = {
  priority: string
  label: string
  response_hours: number
  resolution_hours: number
  is_default: boolean
}

type Draft = Record<string, { response: string; resolution: string }>

const tones: Record<string, 'danger' | 'warning' | 'brand' | 'muted'> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'brand',
  low: 'muted',
}

export default function TicketSlaScreen() {
  const theme = useTheme()
  const { can } = useAuth()

  const load = useCallback(() => api<Sla[]>('/ticket-slas'), [])
  const record = useResource<Sla[]>(load, [])

  const [draft, setDraft] = useState<Draft>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!record.data) {
      return
    }

    setDraft(
      Object.fromEntries(
        record.data.map((row) => [
          row.priority,
          { response: String(row.response_hours), resolution: String(row.resolution_hours) },
        ])
      )
    )
  }, [record.data])

  const canEdit = can('ticket.category_manage')

  const set = (priority: string, key: 'response' | 'resolution', value: string) => {
    setDraft((current) => ({ ...current, [priority]: { ...current[priority], [key]: value } }))
    setErrors((current) => ({ ...current, [`${priority}.${key}`]: '' }))
    setSaved(false)
  }

  const dirty = (record.data ?? []).filter((row) => {
    const entry = draft[row.priority]

    if (!entry) {
      return false
    }

    return entry.response !== String(row.response_hours) || entry.resolution !== String(row.resolution_hours)
  })

  const check = (): boolean => {
    const found: Record<string, string> = {}

    for (const row of dirty) {
      const entry = draft[row.priority]
      const response = Number(entry.response)
      const resolution = Number(entry.resolution)

      if (!Number.isInteger(response) || response < 1 || response > 720) {
        found[`${row.priority}.response`] = 'Between 1 and 720 hours'
      }

      if (!Number.isInteger(resolution) || resolution < 1 || resolution > 2160) {
        found[`${row.priority}.resolution`] = 'Between 1 and 2160 hours'
      }

      if (!found[`${row.priority}.resolution`] && resolution < response) {
        found[`${row.priority}.resolution`] = 'Cannot be quicker than the first response'
      }
    }

    setErrors(found)

    return Object.keys(found).length === 0
  }

  const save = async () => {
    if (busy || dirty.length === 0 || !check()) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      const updated = await api<Sla[]>('/ticket-slas', {
        method: 'PUT',
        body: {
          slas: dirty.map((row) => ({
            priority: row.priority,
            response_hours: Number(draft[row.priority].response),
            resolution_hours: Number(draft[row.priority].resolution),
          })),
        },
      })

      record.setData(updated)
      setSaved(true)
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    if (!record.data) {
      return
    }

    setDraft(
      Object.fromEntries(
        record.data.map((row) => [
          row.priority,
          { response: String(row.response_hours), resolution: String(row.resolution_hours) },
        ])
      )
    )
    setErrors({})
    setProblem(null)
    setSaved(false)
  }

  if (record.loading) {
    return (
      <Screen title="Response Times">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Response Times">
        <ErrorState message={record.error ?? 'Could not load response times.'} onRetry={record.reload} />
      </Screen>
    )
  }

  return (
    <Screen title="Response Times" subtitle="How quickly each ticket must be answered">
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {canEdit ? null : (
          <Notice
            tone="info"
            title="Read only"
            message="These are the targets your helpdesk works to. Only someone who manages ticket categories can change them."
          />
        )}

        {saved ? <Notice tone="success" title="Saved" message="New response times are live." /> : null}
        {problem ? <Notice tone="danger" title="Could not save" message={problem} /> : null}

        {record.data.map((row) => {
          const entry = draft[row.priority] ?? { response: '', resolution: '' }
          const accent = toneColor(theme, tones[row.priority] ?? 'muted')

          return (
            <View key={row.priority} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <View style={styles.head}>
                <View style={[styles.dot, { backgroundColor: accent }]} />
                <Text style={[styles.priority, { color: theme.ink }]}>{row.label}</Text>
                <Text style={[styles.badge, { color: theme.inkSubtle }]}>
                  {row.is_default ? 'Default' : 'Set by you'}
                </Text>
              </View>

              <View style={styles.pair}>
                <View style={styles.half}>
                  <Field
                    label="First reply within"
                    value={entry.response}
                    onChangeText={(value) => set(row.priority, 'response', value)}
                    keyboardType="number-pad"
                    editable={canEdit}
                    maxLength={4}
                    error={errors[`${row.priority}.response`]}
                  />
                  <Text style={[styles.unit, { color: theme.inkSubtle }]}>{describe(entry.response)}</Text>
                </View>

                <View style={styles.half}>
                  <Field
                    label="Resolved within"
                    value={entry.resolution}
                    onChangeText={(value) => set(row.priority, 'resolution', value)}
                    keyboardType="number-pad"
                    editable={canEdit}
                    maxLength={4}
                    error={errors[`${row.priority}.resolution`]}
                  />
                  <Text style={[styles.unit, { color: theme.inkSubtle }]}>{describe(entry.resolution)}</Text>
                </View>
              </View>
            </View>
          )
        })}

        {canEdit ? (
          <View style={styles.actions}>
            <Button
              label={dirty.length === 0 ? 'Nothing to save' : `Save ${dirty.length} change${dirty.length === 1 ? '' : 's'}`}
              onPress={save}
              loading={busy}
              disabled={dirty.length === 0}
              fullWidth
            />
            {dirty.length > 0 ? <Button label="Undo" variant="ghost" onPress={reset} fullWidth /> : null}
          </View>
        ) : null}

        <Notice
          tone="info"
          title="Where these are used"
          message="Every new ticket gets a due date from its priority. Turn the ticket SLA off in Company Settings if you do not want due dates at all."
        />
      </ScrollView>
    </Screen>
  )
}

function describe(value: string): string {
  const hours = Number(value)

  if (!Number.isFinite(hours) || hours <= 0) {
    return 'hours'
  }

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }

  const days = Math.floor(hours / 24)
  const rest = hours % 24

  return `${days} day${days === 1 ? '' : 's'}${rest > 0 ? ` ${rest}h` : ''}`
}

function toneColor(theme: ReturnType<typeof useTheme>, tone: 'danger' | 'warning' | 'brand' | 'muted'): string {
  if (tone === 'danger') {
    return theme.danger
  }

  if (tone === 'warning') {
    return theme.warning
  }

  if (tone === 'brand') {
    return theme.brand
  }

  return theme.inkSubtle
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  priority: {
    flex: 1,
    fontSize: font.md,
    fontWeight: '700',
  },
  badge: {
    fontSize: font.xs,
    fontWeight: '600',
  },
  pair: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  unit: {
    fontSize: font.xs,
    marginTop: -spacing.xs,
  },
  actions: {
    gap: spacing.sm,
  },
})
