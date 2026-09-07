import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Select, type Option } from '@/components/ui/Select'
import { ErrorState, Loader } from '@/components/ui/States'
import { api, apiList, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { EmployeeUser } from '@/lib/types'
import { useResource } from '@/lib/useResource'
import { spacing } from '@/theme/tokens'

const priorities: Option[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export default function TaskCreateScreen() {
  const router = useRouter()
  const { can } = useAuth()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [priority, setPriority] = useState('normal')
  const [dueDate, setDueDate] = useState('')
  const [estimated, setEstimated] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!can('user.view')) {
      return [] as EmployeeUser[]
    }

    const result = await apiList<EmployeeUser>('/users?per_page=100')

    return result.data
  }, [can])

  const users = useResource<EmployeeUser[]>(load, [])

  const assignees = useMemo<Option[]>(
    () => (users.data ?? []).map((row) => ({ value: String(row.id), label: row.name, hint: row.email })),
    [users.data]
  )

  const submit = async () => {
    if (busy) {
      return
    }

    const next: Record<string, string> = {}

    if (title.trim().length < 3) {
      next.title = 'Give the task a title'
    }

    setErrors(next)

    if (Object.keys(next).length > 0) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api('/tasks', {
        method: 'POST',
        body: {
          title: title.trim(),
          description: description.trim() || null,
          assignee_id: assigneeId ? Number(assigneeId) : null,
          priority,
          due_date: dueDate.trim() || null,
          estimated_hours: estimated.trim() ? Number(estimated) : null,
        },
      })

      router.replace('/tasks')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 422 && Object.keys(caught.fields).length > 0) {
        const mapped: Record<string, string> = {}

        for (const [field, messages] of Object.entries(caught.fields)) {
          mapped[field] = messages[0]
        }

        setErrors(mapped)
        setProblem('Check the highlighted fields.')
      } else {
        setProblem(caught instanceof ApiError ? caught.message : 'Could not create the task.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (users.loading) {
    return (
      <Screen title="New task" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (users.error) {
    return (
      <Screen title="New task" leading="back">
        <ErrorState message={users.error} onRetry={users.reload} />
      </Screen>
    )
  }

  return (
    <Screen title="New task" leading="back">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {problem ? <Notice tone="danger" title="Could not save" message={problem} /> : null}

          <Field
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Ship the payroll export"
            autoCapitalize="sentences"
            error={errors.title}
            editable={!busy}
          />
          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What exactly needs doing"
            autoCapitalize="sentences"
            error={errors.description}
            editable={!busy}
            multiline
          />
          <Select
            label="Assign to"
            value={assigneeId}
            options={assignees}
            onChange={setAssigneeId}
            placeholder="Unassigned"
            allowClear
            error={errors.assignee_id}
            disabled={busy}
          />
          <Select
            label="Priority"
            value={priority}
            options={priorities}
            onChange={(value) => setPriority(value ?? 'normal')}
            error={errors.priority}
            disabled={busy}
          />
          <Field
            label="Due date"
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD"
            error={errors.due_date}
            editable={!busy}
          />
          <Field
            label="Estimated hours"
            value={estimated}
            onChangeText={setEstimated}
            placeholder="Optional"
            keyboardType="decimal-pad"
            error={errors.estimated_hours}
            editable={!busy}
          />

          <View style={styles.actions}>
            <Button label="Create task" onPress={submit} loading={busy} fullWidth />
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
  actions: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
})
