import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { PermissionPicker } from '@/components/PermissionPicker'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Select, type Option } from '@/components/ui/Select'
import { ErrorState, Loader } from '@/components/ui/States'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { PermissionTree, Role } from '@/lib/types'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, spacing } from '@/theme/tokens'

type Loaded = {
  role: Role | null
  tree: PermissionTree
}

const scopeOptions: Option[] = [
  { value: 'all_company', label: 'Whole company', hint: 'MD, CEO, HR head' },
  { value: 'branch', label: 'Own branch', hint: 'Branch manager' },
  { value: 'department', label: 'Own department', hint: 'Department manager' },
  { value: 'team', label: 'Own team', hint: 'Team lead' },
  { value: 'self', label: 'Own data only', hint: 'Member' },
]

export default function RoleFormScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { can } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()
  const creating = id === 'new'

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [level, setLevel] = useState('8')
  const [scope, setScope] = useState<string | null>('self')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<Loaded> => {
    const [role, tree] = await Promise.all([
      creating ? Promise.resolve(null) : api<Role>(`/roles/${id}`),
      api<PermissionTree>('/permissions/tree'),
    ])

    return { role, tree }
  }, [creating, id])

  const record = useResource<Loaded>(load, [id])

  useEffect(() => {
    const found = record.data?.role

    if (!found) {
      return
    }

    setName(found.name)
    setSlug(found.slug)
    setLevel(String(found.hierarchy_level))
    setScope(found.data_scope)
    setDescription(found.description ?? '')
    setSelected(new Set((found.permissions ?? []).map((permission) => permission.slug)))
  }, [record.data])

  const isSystem = record.data?.role?.is_system ?? false
  const canSave = (creating ? can('role.create') : can('role.edit')) && !isSystem
  const canDelete = !creating && can('role.delete') && !isSystem

  const modules = useMemo(() => record.data?.tree.modules ?? [], [record.data])

  const toggle = (permission: string) => {
    setSelected((current) => {
      const next = new Set(current)

      if (next.has(permission)) {
        next.delete(permission)
      } else {
        next.add(permission)
      }

      return next
    })
  }

  const toggleMany = (slugs: string[], on: boolean) => {
    setSelected((current) => {
      const next = new Set(current)

      for (const item of slugs) {
        if (on) {
          next.add(item)
        } else {
          next.delete(item)
        }
      }

      return next
    })
  }

  const save = async () => {
    if (busy) {
      return
    }

    setErrors({})
    setProblem(null)

    if (selected.size === 0) {
      setProblem('Select at least one permission.')

      return
    }

    setBusy(true)

    const body = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      hierarchy_level: Number(level) || 8,
      data_scope: scope ?? 'self',
      permissions: Array.from(selected),
    }

    try {
      if (creating) {
        const created = await api<Role>('/roles', { method: 'POST', body })

        router.replace(`/permissions?type=role&id=${created.id}` as never)

        return
      }

      await api<Role>(`/roles/${id}`, { method: 'PUT', body })
      router.back()
    } catch (error) {
      handle(error)
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    Alert.alert('Delete this role?', `${name} will be removed. Anyone holding it loses that access.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true)

          try {
            await api(`/roles/${id}`, { method: 'DELETE' })
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
        mapped[field.split('.')[0]] = messages[0]
      }

      setErrors(mapped)

      if (mapped.permissions) {
        setProblem(mapped.permissions)
      }

      return
    }

    setProblem(error.message)
  }

  if (record.loading) {
    return (
      <Screen title="Role" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (record.error) {
    return (
      <Screen title="Role" leading="back">
        <ErrorState message={record.error} onRetry={record.reload} />
      </Screen>
    )
  }

  return (
    <Screen
      title={creating ? 'New role' : name || 'Role'}
      subtitle={`${selected.size} permissions selected`}
      leading="back"
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {problem ? <Notice tone="danger" title="Could not save" message={problem} /> : null}

          {isSystem ? (
            <Notice
              tone="warning"
              title="System role"
              message="This role ships with the product and cannot be edited or removed."
            />
          ) : null}

          <Field
            label="Name"
            value={name}
            onChangeText={(value) => {
              setName(value)

              if (creating) {
                setSlug(value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
              }
            }}
            placeholder="Team Lead"
            autoCapitalize="words"
            error={errors.name}
            editable={canSave && !busy}
          />

          <Field
            label="Slug"
            value={slug}
            onChangeText={setSlug}
            placeholder="team_lead"
            error={errors.slug}
            editable={canSave && !busy && creating}
          />

          <Field
            label="Hierarchy level"
            value={level}
            onChangeText={setLevel}
            placeholder="8"
            keyboardType="number-pad"
            error={errors.hierarchy_level}
            editable={canSave && !busy}
          />

          <Select
            label="Data scope"
            value={scope}
            options={scopeOptions}
            onChange={setScope}
            error={errors.data_scope}
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

          {creating ? (
            <>
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.ink }]}>Starting permissions</Text>
                <Text style={[styles.sectionMeta, { color: theme.inkMuted }]}>
                  Pick at least one to create the role. You can refine everything on the next screen.
                </Text>
              </View>

              <PermissionPicker
                modules={modules}
                selected={selected}
                onToggle={toggle}
                onToggleMany={toggleMany}
                readOnly={!canSave}
              />
            </>
          ) : (
            <Button
              label={`Manage permissions (${selected.size})`}
              variant="secondary"
              onPress={() => router.push(`/permissions?type=role&id=${id}` as never)}
              fullWidth
            />
          )}

          <View style={styles.actions}>
            {canSave ? (
              <Button label={creating ? 'Create role' : 'Save changes'} onPress={save} loading={busy} fullWidth />
            ) : null}
            {canDelete ? (
              <Button label="Delete role" variant="danger" onPress={remove} disabled={busy} fullWidth />
            ) : null}
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
  section: {
    gap: 3,
    paddingTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: font.lg,
    fontWeight: '700',
  },
  sectionMeta: {
    fontSize: font.sm,
    lineHeight: 19,
  },
  actions: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
})
