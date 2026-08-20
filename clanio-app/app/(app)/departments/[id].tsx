import { useCallback, useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { ErrorState, Loader } from '@/components/ui/States'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Department } from '@/lib/types'
import { useResource } from '@/lib/useResource'
import { spacing } from '@/theme/tokens'

export default function DepartmentFormScreen() {
  const router = useRouter()
  const { can } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()
  const creating = id === 'new'

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (creating) {
      return null
    }

    return api<Department>(`/departments/${id}`)
  }, [creating, id])

  const record = useResource<Department | null>(load, [id])

  useEffect(() => {
    if (!record.data) {
      return
    }

    setName(record.data.name)
    setCode(record.data.code)
    setDescription(record.data.description ?? '')
  }, [record.data])

  const canSave = creating ? can('department.create') : can('department.edit')
  const canDelete = !creating && can('department.delete')

  const save = async () => {
    if (busy) {
      return
    }

    setErrors({})
    setProblem(null)
    setBusy(true)

    const body = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim() || null,
    }

    try {
      if (creating) {
        const created = await api<Department>('/departments', { method: 'POST', body })

        router.replace(`/permissions?type=department&id=${created.id}` as never)

        return
      }

      await api<Department>(`/departments/${id}`, { method: 'PUT', body })
      router.back()
    } catch (error) {
      handle(error)
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    Alert.alert('Delete this department?', `${name} will be removed permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true)

          try {
            await api(`/departments/${id}`, { method: 'DELETE' })
            router.back()
          } catch (error) {
            handle(error)
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }

  const handle = (error: unknown) => {
    if (!(error instanceof ApiError)) {
      setProblem('Something went wrong. Please try again.')

      return
    }

    if (error.status === 422 && Object.keys(error.fields).length > 0) {
      const mapped: Record<string, string> = {}

      for (const [field, messages] of Object.entries(error.fields)) {
        mapped[field] = messages[0]
      }

      setErrors(mapped)

      return
    }

    setProblem(error.message)
  }

  if (record.loading) {
    return (
      <Screen title="Department" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (record.error) {
    return (
      <Screen title="Department" leading="back">
        <ErrorState message={record.error} onRetry={record.reload} />
      </Screen>
    )
  }

  return (
    <Screen
      title={creating ? 'New department' : name || 'Department'}
      subtitle={creating ? 'Create a new department' : `Code ${record.data?.code ?? ''}`}
      leading="back"
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {problem ? <Notice tone="danger" title="Could not save" message={problem} /> : null}

          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Technology"
            autoCapitalize="words"
            error={errors.name}
            editable={canSave && !busy}
          />

          <Field
            label="Code"
            value={code}
            onChangeText={setCode}
            placeholder="TECH"
            autoCapitalize="characters"
            error={errors.code}
            editable={canSave && !busy}
          />

          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Optional"
            autoCapitalize="sentences"
            error={errors.description}
            editable={canSave && !busy}
            multiline
          />

          {record.data ? (
            <Notice
              tone="info"
              title="Usage"
              message={`${record.data.users_count} members · ${record.data.teams_count} teams`}
            />
          ) : null}

          <View style={styles.actions}>
            {canSave ? <Button label={creating ? 'Create' : 'Save changes'} onPress={save} loading={busy} fullWidth /> : null}
            {canDelete ? <Button label="Delete department" variant="danger" onPress={remove} disabled={busy} fullWidth /> : null}
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
