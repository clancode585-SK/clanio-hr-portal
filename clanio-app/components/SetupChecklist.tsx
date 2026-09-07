import { useCallback } from 'react'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from '@/components/ui/Icon'
import { apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Step = {
  key: string
  label: string
  hint: string
  href: string
  done: boolean
  count: number
}

export function SetupChecklist() {
  const theme = useTheme()
  const router = useRouter()
  const { can } = useAuth()

  const load = useCallback(async (): Promise<Step[]> => {
    const count = async (path: string, allowed: boolean) => {
      if (!allowed) {
        return -1
      }

      try {
        const result = await apiList<Record<string, any>>(`${path}?per_page=100`)

        return result.meta?.total ?? result.data.length
      } catch {
        return -1
      }
    }

    const [roles, departments, designations, shifts, employees, clearance] = await Promise.all([
      count('/roles', can('role.view')),
      count('/departments', can('department.view')),
      count('/designations', can('designation.view')),
      count('/work-shifts', can('work_shift.view')),
      count('/employees', can('employee.view')),
      count('/clearance-items', can('clearance.manage')),
    ])

    const steps: Step[] = [
      {
        key: 'roles',
        label: 'Add the roles people will hold',
        hint: 'Manager, team lead, member — an employee cannot be added without one',
        href: '/roles',
        done: roles > 1,
        count: roles,
      },
      {
        key: 'departments',
        label: 'Add your departments',
        hint: 'Technology, Sales, Human Resources',
        href: '/departments',
        done: departments > 0,
        count: departments,
      },
      {
        key: 'designations',
        label: 'Add designations',
        hint: 'The job titles people are hired into',
        href: '/designations',
        done: designations > 0,
        count: designations,
      },
      {
        key: 'shifts',
        label: 'Set the work shift',
        hint: 'Office hours, grace time and weekly offs',
        href: '/work-shifts',
        done: shifts > 0,
        count: shifts,
      },
      {
        key: 'employees',
        label: 'Add your first employee',
        hint: 'Everything above has to exist first',
        href: '/employees',
        done: employees > 1,
        count: employees,
      },
      {
        key: 'clearance',
        label: 'Build the exit checklist',
        hint: 'What a leaver has to settle before their last day',
        href: '/clearance-items',
        done: clearance > 0,
        count: clearance,
      },
    ]

    return steps.filter((step) => step.count >= 0)
  }, [can])

  const record = useResource<Step[]>(load, [])

  const steps = record.data ?? []

  if (record.loading || steps.length === 0) {
    return null
  }

  const done = steps.filter((step) => step.done).length

  if (done === steps.length) {
    return null
  }

  const next = steps.find((step) => !step.done)

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surface, borderColor: theme.brand }]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: theme.ink }]}>Finish setting up</Text>
          <Text style={[styles.subtitle, { color: theme.inkMuted }]}>
            {done} of {steps.length} done{next ? ` · next: ${next.label.toLowerCase()}` : ''}
          </Text>
        </View>

        <Text style={[styles.progress, { color: theme.brand }]}>
          {Math.round((done / steps.length) * 100)}%
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: theme.canvas }]}>
        <View style={[styles.fill, { backgroundColor: theme.brand, width: `${(done / steps.length) * 100}%` }]} />
      </View>

      <View style={styles.steps}>
        {steps.map((step) => (
          <Pressable
            key={step.key}
            onPress={() => router.push(step.href as never)}
            style={({ pressed }) => [styles.step, { backgroundColor: pressed ? theme.canvas : 'transparent' }]}
          >
            <View
              style={[
                styles.check,
                {
                  backgroundColor: step.done ? theme.success : 'transparent',
                  borderColor: step.done ? theme.success : theme.line,
                },
              ]}
            >
              {step.done ? <Icon name="checkmark" size={13} color="#FFFFFF" /> : null}
            </View>

            <View style={styles.stepText}>
              <Text
                style={[
                  styles.stepLabel,
                  { color: step.done ? theme.inkSubtle : theme.ink, fontWeight: step.done ? '500' : '700' },
                ]}
              >
                {step.label}
              </Text>
              {!step.done ? <Text style={[styles.stepHint, { color: theme.inkSubtle }]}>{step.hint}</Text> : null}
            </View>

            {step.done ? (
              <Text style={[styles.stepCount, { color: theme.inkSubtle }]}>{step.count}</Text>
            ) : (
              <Icon name="chevron-forward" size={18} color={theme.inkSubtle} />
            )}
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: font.md,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: font.xs,
  },
  progress: {
    fontSize: font.lg,
    fontWeight: '800',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  steps: {
    gap: 2,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.sm,
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    gap: 1,
  },
  stepLabel: {
    fontSize: font.sm,
  },
  stepHint: {
    fontSize: font.xs,
  },
  stepCount: {
    fontSize: font.xs,
    fontWeight: '700',
  },
})
