import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { PermissionPicker } from '@/components/PermissionPicker'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Select, type Option } from '@/components/ui/Select'
import { ErrorState, Loader } from '@/components/ui/States'
import { api, apiList, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Department, Employee, PermissionTree, Role, UserPermissions } from '@/lib/types'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Scope = 'department' | 'role' | 'employee'

type DepartmentAccess = {
  department_id: number
  department_name: string
  permissions: string[]
  employees: number
}

type Loaded = {
  tree: PermissionTree
  departments: Department[]
  roles: Role[]
  employees: Employee[]
}

const scopes: { key: Scope; label: string }[] = [
  { key: 'department', label: 'Department' },
  { key: 'role', label: 'Role' },
  { key: 'employee', label: 'Employee' },
]

export default function PermissionsScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { can } = useAuth()
  const params = useLocalSearchParams<{ type?: string; id?: string }>()

  const [scope, setScope] = useState<Scope>((params.type as Scope) ?? 'department')
  const [targetId, setTargetId] = useState<string | null>(params.id ?? null)
  const [seedDepartment, setSeedDepartment] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [inherited, setInherited] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [loadingTarget, setLoadingTarget] = useState(false)

  const loadBase = useCallback(async (): Promise<Loaded> => {
    const [tree, departments, roles, employees] = await Promise.all([
      api<PermissionTree>('/permissions/tree'),
      can('department.view') ? apiList<Department>('/departments?per_page=100').then((r) => r.data) : Promise.resolve([]),
      can('role.view') ? apiList<Role>('/roles?per_page=100').then((r) => r.data) : Promise.resolve([]),
      can('employee.view') ? apiList<Employee>('/employees?per_page=100').then((r) => r.data) : Promise.resolve([]),
    ])

    return { tree, departments, roles, employees }
  }, [can])

  const base = useResource<Loaded>(loadBase, [])

  const options = useMemo<Option[]>(() => {
    if (!base.data) {
      return []
    }

    if (scope === 'department') {
      return base.data.departments.map((row) => ({ value: String(row.id), label: row.name, hint: row.code }))
    }

    if (scope === 'role') {
      return base.data.roles
        .filter((row) => !row.is_system)
        .map((row) => ({ value: String(row.id), label: row.name, hint: row.data_scope }))
    }

    return base.data.employees
      .filter((row) => row.user !== null)
      .map((row) => ({
        value: String(row.user?.id),
        label: row.user?.name ?? 'Employee',
        hint: row.employee_code,
      }))
  }, [base.data, scope])

  const departmentOptions = useMemo<Option[]>(
    () => (base.data?.departments ?? []).map((row) => ({ value: String(row.id), label: row.name, hint: row.code })),
    [base.data]
  )

  useEffect(() => {
    if (!targetId) {
      setSelected(new Set())
      setInherited(new Set())

      return
    }

    let active = true

    const pull = async () => {
      setLoadingTarget(true)
      setProblem(null)
      setSaved(false)

      try {
        if (scope === 'department') {
          const access = await api<DepartmentAccess>(`/departments/${targetId}/permissions`)

          if (active) {
            setSelected(new Set(access.permissions))
            setInherited(new Set())
          }

          return
        }

        if (scope === 'role') {
          const role = await api<Role>(`/roles/${targetId}`)

          if (active) {
            setSelected(new Set((role.permissions ?? []).map((permission) => permission.slug)))
            setInherited(new Set())
          }

          return
        }

        const access = await api<UserPermissions>(`/users/${targetId}/permissions`)

        if (active) {
          setSelected(new Set(access.effective))
          setInherited(new Set([...access.from_roles, ...access.from_department]))
        }
      } catch (error) {
        if (active) {
          setProblem(error instanceof ApiError ? error.message : 'Could not load permissions.')
        }
      } finally {
        if (active) {
          setLoadingTarget(false)
        }
      }
    }

    void pull()

    return () => {
      active = false
    }
  }, [scope, targetId])

  const applySeed = async (departmentId: string | null) => {
    setSeedDepartment(departmentId)

    if (!departmentId) {
      return
    }

    try {
      const access = await api<DepartmentAccess>(`/departments/${departmentId}/permissions`)

      setSelected((current) => new Set([...current, ...access.permissions]))
      setSaved(false)
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not load department permissions.')
    }
  }

  const toggle = (slug: string) => {
    setSaved(false)
    setSelected((current) => {
      const next = new Set(current)

      next.has(slug) ? next.delete(slug) : next.add(slug)

      return next
    })
  }

  const toggleMany = (slugs: string[], on: boolean) => {
    setSaved(false)
    setSelected((current) => {
      const next = new Set(current)

      for (const slug of slugs) {
        on ? next.add(slug) : next.delete(slug)
      }

      return next
    })
  }

  const save = async () => {
    if (!targetId || busy) {
      return
    }

    setBusy(true)
    setProblem(null)
    setSaved(false)

    const permissions = Array.from(selected)

    try {
      if (scope === 'department') {
        await api(`/departments/${targetId}/permissions`, { method: 'PUT', body: { permissions } })
      } else if (scope === 'role') {
        if (permissions.length === 0) {
          setProblem('A role needs at least one permission.')
          setBusy(false)

          return
        }

        await api(`/roles/${targetId}`, { method: 'PUT', body: { permissions } })
      } else {
        await api(`/users/${targetId}/permissions`, { method: 'PUT', body: { permissions } })
      }

      setSaved(true)
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not save permissions.')
    } finally {
      setBusy(false)
    }
  }

  const switchScope = (next: Scope) => {
    setScope(next)
    setTargetId(null)
    setSeedDepartment(null)
    setSelected(new Set())
    setInherited(new Set())
    setProblem(null)
    setSaved(false)
  }

  if (base.loading) {
    return (
      <Screen title="Permissions">
        <Loader />
      </Screen>
    )
  }

  if (base.error || !base.data) {
    return (
      <Screen title="Permissions">
        <ErrorState message={base.error ?? 'Could not load permissions.'} onRetry={base.reload} />
      </Screen>
    )
  }

  const targetLabel = options.find((option) => option.value === targetId)?.label
  const extra = [...selected].filter((slug) => !inherited.has(slug)).length
  const removed = [...inherited].filter((slug) => !selected.has(slug)).length

  return (
    <Screen
      title="Permissions"
      subtitle={targetLabel ? `${targetLabel} · ${selected.size} selected` : 'Pick who to configure'}
      leading={params.id ? 'back' : 'menu'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.tabs, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
          {scopes.map((entry) => {
            const active = entry.key === scope

            return (
              <Pressable
                key={entry.key}
                onPress={() => switchScope(entry.key)}
                style={[styles.tab, { backgroundColor: active ? theme.surface : 'transparent' }]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: active ? theme.brand : theme.inkMuted, fontWeight: active ? '700' : '500' },
                  ]}
                >
                  {entry.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <Select
          label={scope}
          value={targetId}
          options={options}
          onChange={setTargetId}
          placeholder={`Select ${scope}`}
        />

        {scope === 'role' && targetId ? (
          <Select
            label="Copy from department"
            value={seedDepartment}
            options={departmentOptions}
            onChange={applySeed}
            placeholder="Optional starting point"
            allowClear
          />
        ) : null}

        {problem ? <Notice tone="danger" title="Failed" message={problem} /> : null}
        {saved ? <Notice tone="success" title="Saved" message="Permissions have been updated." /> : null}

        {!targetId ? (
          <Notice
            tone="info"
            title={hintTitle(scope)}
            message={hintMessage(scope)}
          />
        ) : loadingTarget ? (
          <Loader />
        ) : (
          <>
            {scope === 'employee' ? (
              <View style={styles.stats}>
                <Stat label="Effective" value={selected.size} tone={theme.ink} />
                <Stat label="Extra given" value={extra} tone={theme.success} />
                <Stat label="Taken away" value={removed} tone={theme.danger} />
              </View>
            ) : null}

            <PermissionPicker
              modules={base.data.tree.modules}
              selected={selected}
              onToggle={toggle}
              onToggleMany={toggleMany}
            />

            <View style={styles.actions}>
              <Button label="Save permissions" onPress={save} loading={busy} fullWidth />
              <Button label="Done" variant="secondary" onPress={() => router.back()} disabled={busy} fullWidth />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

function hintTitle(scope: Scope): string {
  return scope === 'department' ? 'Department access' : scope === 'role' ? 'Role access' : 'Employee access'
}

function hintMessage(scope: Scope): string {
  if (scope === 'department') {
    return 'Whatever you tick here goes to every person in that department, whatever their role.'
  }

  if (scope === 'role') {
    return 'This applies to everyone holding the role. Start from a department if you want a quick base.'
  }

  return 'Starts from the role and department. Change it here to give or take away access for this one person.'
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const theme = useTheme()

  return (
    <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.inkMuted }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  tabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radius.sm,
  },
  tabLabel: {
    fontSize: font.sm,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 1,
  },
  statValue: {
    fontSize: font.xl,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  actions: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
})
