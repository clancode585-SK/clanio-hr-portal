import { useCallback } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { ErrorState, Loader } from '@/components/ui/States'
import { api } from '@/lib/api'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Person = {
  user_id: number
  name: string
  employee_code: string | null
  designation: string | null
  roles: string[]
}

type Team = { id: number; name: string; employee_count: number; employees?: Person[] }
type Dept = {
  id: number
  name: string
  employee_count: number
  teams?: Team[]
  employees_without_team?: Person[]
}
type Branch = {
  id: number
  name: string
  code: string
  is_head_office: boolean
  employee_count: number
  departments?: Dept[]
  employees_without_department?: Person[]
}
type Chart = {
  company: { name: string; branch_count: number; department_count: number; team_count: number; employee_count: number }
  branches: Branch[]
  unassigned: { employee_count: number; employees: Person[] }
}

export default function OrgChartScreen() {
  const theme = useTheme()
  const load = useCallback(() => api<Chart>('/org-chart'), [])
  const chart = useResource<Chart>(load, [])

  if (chart.loading) {
    return (
      <Screen title="Org Chart">
        <Loader />
      </Screen>
    )
  }

  if (chart.error || !chart.data) {
    return (
      <Screen title="Org Chart">
        <ErrorState message={chart.error ?? 'Could not load the org chart.'} onRetry={chart.reload} />
      </Screen>
    )
  }

  const { company, branches, unassigned } = chart.data

  return (
    <Screen title="Org Chart" subtitle={company.name}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={chart.refreshing} onRefresh={chart.refresh} tintColor={theme.brand} />
        }
      >
        <View style={styles.stats}>
          <Stat label="Branches" value={company.branch_count} />
          <Stat label="Departments" value={company.department_count} />
          <Stat label="Teams" value={company.team_count} />
          <Stat label="People" value={company.employee_count} />
        </View>

        {branches.map((branch) => (
          <View key={branch.id} style={[styles.branch, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <View style={styles.branchHead}>
              <Text style={[styles.branchName, { color: theme.ink }]}>{branch.name}</Text>
              <Text style={[styles.count, { color: theme.brand }]}>{branch.employee_count}</Text>
            </View>
            <Text style={[styles.branchMeta, { color: theme.inkSubtle }]}>
              {branch.code}
              {branch.is_head_office ? ' · Head office' : ''}
            </Text>

            {(branch.departments ?? []).map((dept) => (
              <View key={dept.id} style={[styles.dept, { borderLeftColor: theme.brand }]}>
                <View style={styles.deptHead}>
                  <Text style={[styles.deptName, { color: theme.ink }]}>{dept.name}</Text>
                  <Text style={[styles.deptCount, { color: theme.inkMuted }]}>{dept.employee_count}</Text>
                </View>

                {(dept.teams ?? [])
                  .filter((team) => team.employee_count > 0)
                  .map((team) => (
                    <View key={team.id} style={styles.team}>
                      <Text style={[styles.teamName, { color: theme.inkMuted }]}>{team.name}</Text>
                      {(team.employees ?? []).map((person) => (
                        <PersonRow key={person.user_id} person={person} />
                      ))}
                    </View>
                  ))}

                {(dept.employees_without_team ?? []).map((person) => (
                  <PersonRow key={person.user_id} person={person} />
                ))}
              </View>
            ))}

            {branch.employee_count === 0 ? (
              <Text style={[styles.emptyLine, { color: theme.inkSubtle }]}>No one here yet</Text>
            ) : null}
          </View>
        ))}

        {unassigned.employee_count > 0 ? (
          <View style={[styles.branch, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <View style={styles.branchHead}>
              <Text style={[styles.branchName, { color: theme.ink }]}>Unassigned</Text>
              <Text style={[styles.count, { color: theme.warning }]}>{unassigned.employee_count}</Text>
            </View>
            <Text style={[styles.branchMeta, { color: theme.inkSubtle }]}>No branch set</Text>
            {unassigned.employees.map((person) => (
              <PersonRow key={person.user_id} person={person} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

function PersonRow({ person }: { person: Person }) {
  const theme = useTheme()

  return (
    <View style={styles.person}>
      <View style={[styles.dot, { backgroundColor: theme.brand }]} />
      <View style={styles.personText}>
        <Text style={[styles.personName, { color: theme.ink }]}>{person.name}</Text>
        <Text style={[styles.personMeta, { color: theme.inkSubtle }]}>
          {[person.designation, person.roles?.[0], person.employee_code].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  const theme = useTheme()

  return (
    <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <Text style={[styles.statValue, { color: theme.ink }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.inkMuted }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  statValue: {
    fontSize: font.xl,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  branch: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 2,
  },
  branchHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  branchName: {
    fontSize: font.lg,
    fontWeight: '700',
  },
  count: {
    fontSize: font.lg,
    fontWeight: '800',
  },
  branchMeta: {
    fontSize: font.xs,
    marginBottom: spacing.sm,
  },
  dept: {
    borderLeftWidth: 2,
    paddingLeft: spacing.md,
    marginTop: spacing.md,
    gap: 4,
  },
  deptHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deptName: {
    fontSize: font.md,
    fontWeight: '600',
  },
  deptCount: {
    fontSize: font.sm,
    fontWeight: '600',
  },
  team: {
    marginTop: spacing.sm,
    gap: 3,
  },
  teamName: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  personText: {
    flex: 1,
  },
  personName: {
    fontSize: font.sm,
    fontWeight: '600',
  },
  personMeta: {
    fontSize: font.xs,
  },
  emptyLine: {
    fontSize: font.sm,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
})
