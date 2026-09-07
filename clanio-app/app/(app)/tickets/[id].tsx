import { useCallback, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { ErrorState, Loader } from '@/components/ui/States'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Ticket = Record<string, any>

export default function TicketDetailScreen() {
  const theme = useTheme()
  const { can } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [reply, setReply] = useState('')
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => api<Ticket>(`/tickets/${id}`), [id])
  const record = useResource<Ticket>(load, [id])

  const act = async (key: string, path: string, body: Record<string, unknown> = {}) => {
    if (busy) {
      return
    }

    setBusy(key)
    setProblem(null)

    try {
      await api(path, { method: 'POST', body })
      setReply('')
      setNote('')
      await record.reload()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not complete that action.')
    } finally {
      setBusy(null)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Ticket" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Ticket" leading="back">
        <ErrorState message={record.error ?? 'Ticket not found.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const ticket = record.data
  const canHandle = can('ticket.resolve') || can('ticket.view_all')
  const isOpen = ['open', 'in_progress', 'waiting_on_user'].includes(ticket.status)
  const slaTone =
    ticket.sla?.state === 'breached' ? theme.danger : ticket.sla?.state === 'due_soon' ? theme.warning : theme.success

  return (
    <Screen title={ticket.ticket_no} subtitle={ticket.stage_label} leading="back">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {problem ? <Notice tone="danger" title="Failed" message={problem} /> : null}

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.subject, { color: theme.ink }]}>{ticket.subject}</Text>
            <Text style={[styles.message, { color: theme.inkMuted }]}>{ticket.message}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Row label="Raised by" value={ticket.raiser?.name ?? '—'} />
            <Row label="Category" value={ticket.category?.name ?? '—'} />
            <Row label="Goes to" value={ticket.route?.label ?? '—'} />
            <Row label="Assigned" value={ticket.assignee?.name ?? ticket.department?.name ?? 'Nobody yet'} />
            <Row label="Priority" value={ticket.priority ?? '—'} />
            <Row label="Status" value={ticket.status ?? '—'} />
          </View>

          {ticket.sla?.has_target ? (
            <View style={[styles.sla, { backgroundColor: theme.surface, borderColor: slaTone }]}>
              <Text style={[styles.slaState, { color: slaTone }]}>
                {ticket.sla.state === 'breached'
                  ? 'Past the deadline'
                  : ticket.sla.state === 'paused'
                    ? 'Clock paused'
                    : ticket.sla.minutes_left != null
                      ? `${Math.floor(ticket.sla.minutes_left / 60)}h left`
                      : 'On track'}
              </Text>
              <Text style={[styles.slaMeta, { color: theme.inkSubtle }]}>
                Due {formatDate(ticket.sla.resolution_due_at)}
              </Text>
            </View>
          ) : null}

          {ticket.resolution_note ? (
            <Notice tone="success" title="Resolution" message={ticket.resolution_note} />
          ) : null}

          <Text style={[styles.group, { color: theme.inkSubtle }]}>
            Conversation ({(ticket.comments ?? []).length})
          </Text>

          {(ticket.comments ?? []).map((row: Record<string, any>) => (
            <View
              key={String(row.uuid ?? row.id)}
              style={[
                styles.comment,
                {
                  backgroundColor: row.is_internal ? theme.warningSoft : theme.surface,
                  borderColor: row.is_internal ? theme.warning : theme.line,
                },
              ]}
            >
              <Text style={[styles.commentAuthor, { color: theme.brand }]}>
                {row.author?.name ?? 'Someone'}
                {row.is_internal ? ' · internal note' : ''}
              </Text>
              <Text style={[styles.commentBody, { color: theme.ink }]}>{row.body}</Text>
            </View>
          ))}

          {isOpen ? (
            <View style={[styles.composer, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder="Write a reply"
                placeholderTextColor={theme.inkSubtle}
                style={[styles.composerInput, { color: theme.ink }]}
                multiline
              />
              <Button
                label="Send reply"
                size="sm"
                onPress={() => act('reply', `/tickets/${id}/comments`, { body: reply.trim() })}
                loading={busy === 'reply'}
                disabled={reply.trim().length === 0}
              />
            </View>
          ) : null}

          <View style={styles.actions}>
            {canHandle && ticket.status === 'open' ? (
              <Button
                label="Assign to me"
                onPress={() => act('claim', `/tickets/${id}/claim`)}
                loading={busy === 'claim'}
                fullWidth
              />
            ) : null}

            {canHandle && ['open', 'in_progress'].includes(ticket.status) ? (
              <>
                <View style={[styles.composer, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Resolution note, or what you need from them"
                    placeholderTextColor={theme.inkSubtle}
                    style={[styles.composerInput, { color: theme.ink }]}
                    multiline
                  />
                </View>

                <Button
                  label="Mark resolved"
                  onPress={() => act('resolve', `/tickets/${id}/resolve`, { resolution_note: note.trim() })}
                  loading={busy === 'resolve'}
                  disabled={note.trim().length < 3}
                  fullWidth
                />
                <Button
                  label="Ask for more info"
                  variant="secondary"
                  onPress={() => act('ask', `/tickets/${id}/ask-info`, { body: note.trim() })}
                  loading={busy === 'ask'}
                  disabled={note.trim().length < 3}
                  fullWidth
                />
              </>
            ) : null}

            {ticket.is_raiser && ticket.status === 'resolved' ? (
              <>
                <Button
                  label="Close ticket"
                  onPress={() => act('close', `/tickets/${id}/close`)}
                  loading={busy === 'close'}
                  fullWidth
                />
                {ticket.can_reopen ? (
                  <Button
                    label="Still a problem"
                    variant="secondary"
                    onPress={() => act('reopen', `/tickets/${id}/reopen`, { body: reply.trim() || 'Still facing this.' })}
                    loading={busy === 'reopen'}
                    fullWidth
                  />
                ) : null}
              </>
            ) : null}

            {ticket.is_raiser && ['open', 'in_progress', 'waiting_on_user'].includes(ticket.status) ? (
              <Button
                label="Cancel request"
                variant="danger"
                onPress={() => act('cancel', `/tickets/${id}/cancel`)}
                loading={busy === 'cancel'}
                fullWidth
              />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme()

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.inkMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.ink }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  subject: {
    fontSize: font.lg,
    fontWeight: '700',
    paddingTop: spacing.sm,
  },
  message: {
    fontSize: font.sm,
    lineHeight: 21,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: 9,
  },
  rowLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  rowValue: {
    flexShrink: 1,
    fontSize: font.sm,
    fontWeight: '600',
    textAlign: 'right',
    textTransform: 'capitalize',
  },
  sla: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 2,
  },
  slaState: {
    fontSize: font.md,
    fontWeight: '700',
  },
  slaMeta: {
    fontSize: font.xs,
  },
  group: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  comment: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 3,
  },
  commentAuthor: {
    fontSize: font.xs,
    fontWeight: '800',
  },
  commentBody: {
    fontSize: font.sm,
    lineHeight: 20,
  },
  composer: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  composerInput: {
    fontSize: font.md,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actions: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
})
