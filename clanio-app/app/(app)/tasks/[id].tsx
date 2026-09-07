import { useCallback, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { api, apiList, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { documentTypes, pickFile, toFormData } from '@/lib/upload'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Task = Record<string, any>
type Comment = Record<string, any>

type Attachment = Record<string, any>

type Loaded = {
  task: Task
  comments: Comment[]
  attachments: Attachment[]
}

const statuses = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'Doing' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
]

export default function TaskDetailScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { can } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [comment, setComment] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async (): Promise<Loaded> => {
    const task = await api<Task>(`/tasks/${id}`)
    const [comments, attachments] = await Promise.all([
      apiList<Comment>(`/tasks/${id}/comments`),
      apiList<Attachment>(`/tasks/${id}/attachments`).catch(() => ({ data: [] as Attachment[] })),
    ])

    return { task, comments: comments.data, attachments: attachments.data }
  }, [id])

  const record = useResource<Loaded>(load, [id])

  const changeStatus = async (status: string) => {
    if (busy) {
      return
    }

    setBusy(status)
    setProblem(null)

    const body: Record<string, unknown> = { status }

    if (status === 'blocked') {
      body.blocked_reason = 'Blocked from the app'
    }

    try {
      await api(`/tasks/${id}/status`, { method: 'PUT', body })
      await record.reload()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not change the status.')
    } finally {
      setBusy(null)
    }
  }

  const addComment = async () => {
    if (busy || comment.trim().length < 1) {
      return
    }

    setBusy('comment')
    setProblem(null)

    try {
      await api(`/tasks/${id}/comments`, { method: 'POST', body: { body: comment.trim() } })
      setComment('')
      await record.reload()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not post the comment.')
    } finally {
      setBusy(null)
    }
  }

  const attach = async () => {
    if (busy) {
      return
    }

    let picked

    try {
      picked = await pickFile(documentTypes)
    } catch {
      setProblem('Could not open the file picker.')

      return
    }

    if (!picked) {
      return
    }

    setBusy('attach')
    setProblem(null)

    try {
      await api(`/tasks/${id}/attachments`, { method: 'POST', body: toFormData(picked, 'file') })
      await record.reload()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not upload the file.')
    } finally {
      setBusy(null)
    }
  }

  const detach = async (attachment: Attachment) => {
    if (busy) {
      return
    }

    setBusy('detach')

    try {
      await api(`/tasks/${id}/attachments/${attachment.uuid ?? attachment.id}`, { method: 'DELETE' })
      await record.reload()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not remove the file.')
    } finally {
      setBusy(null)
    }
  }

  const remove = () => {
    Alert.alert('Delete this task?', 'It will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy('delete')

          try {
            await api(`/tasks/${id}`, { method: 'DELETE' })
            router.replace('/tasks')
          } catch (caught) {
            setProblem(caught instanceof ApiError ? caught.message : 'Could not delete.')
          } finally {
            setBusy(null)
          }
        },
      },
    ])
  }

  if (record.loading) {
    return (
      <Screen title="Task" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Task" leading="back">
        <ErrorState message={record.error ?? 'Task not found.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const { task, comments, attachments } = record.data

  return (
    <Screen title={task.title} subtitle={task.status} leading="back">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {problem ? <Notice tone="danger" title="Failed" message={problem} /> : null}

          {task.description ? (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Text style={[styles.description, { color: theme.ink }]}>{task.description}</Text>
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Row label="Assignee" value={task.assignee?.name ?? 'Unassigned'} />
            <Row label="Priority" value={task.priority ?? '—'} />
            <Row label="Due" value={task.due_date ?? '—'} />
            <Row label="Days left" value={task.days_left != null ? String(task.days_left) : '—'} />
            <Row label="Estimated" value={task.estimated_hours != null ? `${task.estimated_hours} h` : '—'} />
            <Row label="Spent" value={task.spent_hours != null ? `${task.spent_hours} h` : '—'} />
            {task.blocked_reason ? <Row label="Blocked" value={task.blocked_reason} /> : null}
          </View>

          <Text style={[styles.group, { color: theme.inkSubtle }]}>Move to</Text>

          <View style={styles.statuses}>
            {statuses.map((entry) => {
              const active = task.status === entry.key

              return (
                <Pressable
                  key={entry.key}
                  disabled={active || busy !== null}
                  onPress={() => changeStatus(entry.key)}
                  style={({ pressed }) => [
                    styles.status,
                    {
                      backgroundColor: active ? theme.brand : pressed ? theme.canvas : theme.surface,
                      borderColor: active ? theme.brand : theme.line,
                      opacity: busy !== null && busy !== entry.key ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.statusLabel, { color: active ? theme.onBrand : theme.ink }]}>
                    {entry.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <Text style={[styles.group, { color: theme.inkSubtle }]}>Files ({attachments.length})</Text>

          {attachments.map((row) => (
            <Pressable
              key={String(row.uuid ?? row.id)}
              onLongPress={() => detach(row)}
              style={[styles.attachment, { backgroundColor: theme.surface, borderColor: theme.line }]}
            >
              <Text numberOfLines={1} style={[styles.attachmentName, { color: theme.ink }]}>
                {row.original_name ?? row.name ?? 'File'}
              </Text>
              <Text style={[styles.attachmentMeta, { color: theme.inkSubtle }]}>
                {row.size_label ?? (row.size ? `${Math.round(row.size / 1024)} KB` : 'Hold to remove')}
              </Text>
            </Pressable>
          ))}

          <Button
            label="Attach a file"
            variant="secondary"
            size="sm"
            onPress={attach}
            loading={busy === 'attach'}
            fullWidth
          />

          <Text style={[styles.group, { color: theme.inkSubtle }]}>Comments ({comments.length})</Text>

          {comments.map((row) => (
            <View
              key={String(row.uuid ?? row.id)}
              style={[styles.comment, { backgroundColor: theme.surface, borderColor: theme.line }]}
            >
              <Text style={[styles.commentAuthor, { color: theme.brand }]}>{row.author?.name ?? 'Someone'}</Text>
              <Text style={[styles.commentBody, { color: theme.ink }]}>{row.body}</Text>
            </View>
          ))}

          <View style={[styles.composer, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Write a comment"
              placeholderTextColor={theme.inkSubtle}
              style={[styles.composerInput, { color: theme.ink }]}
              multiline
            />
            <Button
              label="Post"
              size="sm"
              onPress={addComment}
              loading={busy === 'comment'}
              disabled={comment.trim().length === 0}
            />
          </View>

          {can('task.delete') ? (
            <Button label="Delete task" variant="danger" onPress={remove} disabled={busy !== null} fullWidth />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
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
  description: {
    fontSize: font.md,
    lineHeight: 22,
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
  group: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  statuses: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  status: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
  },
  statusLabel: {
    fontSize: font.xs,
    fontWeight: '700',
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
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  attachmentName: {
    flex: 1,
    fontSize: font.sm,
    fontWeight: '600',
  },
  attachmentMeta: {
    fontSize: font.xs,
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
})
