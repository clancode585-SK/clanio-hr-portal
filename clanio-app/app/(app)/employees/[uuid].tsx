import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { PermissionPicker } from '@/components/PermissionPicker'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { ErrorState, Loader } from '@/components/ui/States'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Employee, PermissionTree, UserPermissions } from '@/lib/types'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Loaded = {
  employee: Employee
  tree: PermissionTree
  access: UserPermissions | null
}

export default function EmployeeDetailScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { can } = useAuth()
  const { uuid } = useLocalSearchParams<{ uuid: string }>()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const canManage = can('user.permission')

  const load = useCallback(async (): Promise<Loaded> => {
    const employee = await api<Employee>(`/employees/${uuid}`)

    const [tree, access] = await Promise.all([
      api<PermissionTree>('/permissions/tree'),
      canManage ? api<UserPermissions>(`/users/${employee.user_id}/permissions`) : Promise.resolve(null),
    ])

    return { employee, tree, access }
  }, [canManage, uuid])

  const record = useResource<Loaded>(load, [uuid])

  useEffect(() => {
    if (!record.data?.access) {
      return
    }

    setSelected(new Set(record.data.access.effective))
  }, [record.data])

  const inherited = useMemo(() => {
    const access = record.data?.access

    if (!access) {
      return new Set<string>()
    }

    return new Set([...access.from_roles, ...access.from_department])
  }, [record.data])

  const modules = useMemo(() => record.data?.tree.modules ?? [], [record.data])

  const toggle = (slug: string) => {
    setSaved(false)
    setSelected((current) => {
      const next = new Set(current)

      if (next.has(slug)) {
        next.delete(slug)
      } else {
        next.add(slug)
      }

      return next
    })
  }

  const toggleMany = (slugs: string[], on: boolean) => {
    setSaved(false)
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

  const reset = async () => {
    if (!record.data?.access || busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(`/users/${record.data.access.user_id}/permissions`, { method: 'DELETE' })
      await record.reload()
      setSaved(true)
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not reset.')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!record.data?.access || busy) {
      return
    }

    setBusy(true)
    setProblem(null)
    setSaved(false)

    try {
      await api(`/users/${record.data.access.user_id}/permissions`, {
        method: 'PUT',
        body: { permissions: Array.from(selected) },
      })

      await record.reload()
      setSaved(true)
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Employee" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Employee" leading="back">
        <ErrorState message={record.error ?? 'Employee not found.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const { employee, access } = record.data
  const grantedCount = access ? selected.size - [...selected].filter((slug) => inherited.has(slug)).length : 0
  const revokedCount = access ? [...inherited].filter((slug) => !selected.has(slug)).length : 0

  return (
    <Screen title={employee.user?.name ?? 'Employee'} subtitle={employee.employee_code} leading="back">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Row label="Email" value={employee.user?.email ?? '—'} />
            <Row label="Designation" value={employee.designation?.name ?? '—'} />
            <Row label="Role" value={access?.roles?.map((role) => role.name).join(', ') || '—'} />
            <Row label="Joined" value={employee.date_of_joining} />
            <Row label="Status" value={employee.employment_status} />
          </View>

          {!canManage ? (
            <Notice
              tone="info"
              title="Read only"
              message="You need the 'Assign User Permissions' access to change these."
            />
          ) : null}

          {access ? (
            <>
              <View style={styles.stats}>
                <Stat label="Effective" value={access.effective.length} tone={theme.ink} />
                <Stat label="From role" value={access.from_roles.length} tone={theme.info} />
                <Stat label="From dept" value={access.from_department.length} tone={theme.warning} />
              </View>

              {canManage ? (
                <Button
                  label="Manage permissions"
                  onPress={() => router.push(`/permissions?type=employee&id=${employee.user_id}` as never)}
                  fullWidth
                />
              ) : null}
            </>
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
      <Text style={[styles.rowValue, { color: theme.ink }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
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
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: 10,
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
    fontWeight: '500',
    textAlign: 'right',
  },
  section: {
    gap: 3,
  },
  sectionTitle: {
    fontSize: font.lg,
    fontWeight: '700',
  },
  sectionMeta: {
    fontSize: font.sm,
    lineHeight: 19,
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
