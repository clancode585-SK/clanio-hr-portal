import { useCallback, useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Select, type Option } from '@/components/ui/Select'
import { ErrorState, Loader } from '@/components/ui/States'
import { api, apiList, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Department, Designation } from '@/lib/types'
import { useResource } from '@/lib/useResource'
import { spacing } from '@/theme/tokens'

type Loaded = {
  designation: Designation | null
  departments: Department[]
}

export default function DesignationFormScreen() {
  const router = useRouter()
  const { can } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()
  const creating = id === 'new'

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [level, setLevel] = useState('5')
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<Loaded> => {
    const [designation, departments] = await Promise.all([
      creating ? Promise.resolve(null) : api<Designation>(`/designations/${id}`),
      can('department.view')
        ? apiList<Department>('/departments?per_page=100').then((result) => result.data)
        : Promise.resolve([]),
    ])

    return { designation, departments }
  }, [can, creating, id])

  const record = useResource<Loaded>(load, [id])

  useEffect(() => {
    const found = record.data?.designation

    if (!found) {
      return
    }

    setName(found.name)
    setCode(found.code)
    setLevel(String(found.level))
    setDepartmentId(found.department_id ? String(found.department_id) : null)
    setDescription(found.description ?? '')
  }, [record.data])

  const canSave = creating ? can('designation.create') : can('designation.edit')
  const canDelete = !creating && can('designation.delete')

  const departmentOptions: Option[] = (record.data?.departments ?? []).map((department) => ({
    value: String(department.id),
    label: department.name,
    hint: department.code,
  }))

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
      level: Number(level) || 1,
      department_id: departmentId ? Number(departmentId) : null,
      description: description.trim() || null,
    }

    try {
      if (creating) {
        await api<Designation>('/designations', { method: 'POST', body })
      } else {
        await api<Designation>(`/designations/${id}`, { method: 'PUT', body })
      }

      router.back()
    } catch (error) {
      handle(error)
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    Alert.alert('Delete this designation?', `${name} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true)

          try {
            await api(`/designations/${id}`, { method: 'DELETE' })
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
      <Screen title="Designation" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (record.error) {
    return (
      <Screen title="Designation" leading="back">
        <ErrorState message={record.error} onRetry={record.reload} />
      </Screen>
    )
  }

  return (
    <Screen
      title={creating ? 'New designation' : name || 'Designation'}
      subtitle={creating ? 'Job title' : `Level ${record.data?.designation?.level ?? ''}`}
      leading="back"
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {problem ? <Notice tone="danger" title="Could not save" message={problem} /> : null}

          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Software Engineer"
            autoCapitalize="words"
            error={errors.name}
            editable={canSave && !busy}
          />

          <Field
            label="Code"
            value={code}
            onChangeText={setCode}
            placeholder="SE"
            autoCapitalize="characters"
            error={errors.code}
            editable={canSave && !busy}
          />

          <Field
            label="Level"
            value={level}
            onChangeText={setLevel}
            placeholder="5"
            keyboardType="number-pad"
            error={errors.level}
            editable={canSave && !busy}
          />

          <Select
            label="Department"
            value={departmentId}
            options={departmentOptions}
            onChange={setDepartmentId}
            placeholder="All departments"
            allowClear
            error={errors.department_id}
            disabled={!canSave || busy}
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

          <Notice
            tone="info"
            title="Note"
            message="A designation is only a job title. Permissions come from the role, not from here."
          />

          <View style={styles.actions}>
            {canSave ? <Button label={creating ? 'Create' : 'Save changes'} onPress={save} loading={busy} fullWidth /> : null}
            {canDelete ? <Button label="Delete designation" variant="danger" onPress={remove} disabled={busy} fullWidth /> : null}
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
