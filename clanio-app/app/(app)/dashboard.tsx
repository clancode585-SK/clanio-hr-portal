import { useCallback } from 'react'
import { useRouter } from 'expo-router'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Icon } from '@/components/ui/Icon'
import { apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { visibleSections } from '@/lib/nav'
import { useResource } from '@/lib/useResource'
import type { Department, Designation, Employee, Role } from '@/lib/types'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Counts = {
  departments: number | null
  roles: number | null
  designations: number | null
  employees: number | null
}

export default function DashboardScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { profile, can } = useAuth()

  const load = useCallback(async (): Promise<Counts> => {
    const total = async (path: string, allowed: boolean) => {
      if (!allowed) {
        return null
      }

      const result = await apiList<Department | Role | Designation | Employee>(`${path}?per_page=1`)

      return result.meta?.total ?? 0
    }

    const [departments, roles, designations, employees] = await Promise.all([
      total('/departments', can('department.view')),
      total('/roles', can('role.view')),
      total('/designations', can('designation.view')),
      total('/employees', can('employee.view')),
    ])

    return { departments, roles, designations, employees }
  }, [can])

  const counts = useResource<Counts>(load, [profile?.id])
  const sections = visibleSections(can)

  const tiles = [
    { key: 'employees', label: 'Employees', value: counts.data?.employees, href: '/employees' },
    { key: 'departments', label: 'Departments', value: counts.data?.departments, href: '/departments' },
    { key: 'designations', label: 'Designations', value: counts.data?.designations, href: '/designations' },
    { key: 'roles', label: 'Roles', value: counts.data?.roles, href: '/roles' },
  ].filter((tile) => tile.value !== null && tile.value !== undefined)

  return (
    <Screen title="Dashboard" subtitle={profile?.roles?.[0]?.name ?? undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={counts.refreshing} onRefresh={counts.refresh} tintColor={theme.brand} />
        }
      >
        <View style={[styles.hero, { backgroundColor: theme.brand }]}>
          <Text style={[styles.heroEyebrow, { color: theme.onBrand }]}>Welcome back</Text>
          <Text style={[styles.heroName, { color: theme.onBrand }]}>{profile?.name ?? '—'}</Text>
          <Text style={[styles.heroMeta, { color: theme.onBrand }]}>
            {profile?.employee?.employee_code ? `${profile.employee.employee_code} · ` : ''}
            {profile?.permissions?.length ?? 0} permissions
          </Text>
        </View>

        <View style={styles.tiles}>
          {tiles.map((tile) => (
            <Pressable
              key={tile.key}
              onPress={() => router.push(tile.href as never)}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: theme.surface, borderColor: theme.line, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.tileValue, { color: theme.ink }]}>
                {counts.loading ? '—' : (tile.value ?? 0)}
              </Text>
              <Text style={[styles.tileLabel, { color: theme.inkMuted }]}>{tile.label}</Text>
            </Pressable>
          ))}
        </View>

        {sections
          .filter((section) => section.title)
          .map((section) => (
            <View key={section.title} style={styles.group}>
              <Text style={[styles.groupTitle, { color: theme.inkSubtle }]}>{section.title}</Text>

              <View style={[styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                {section.items.map((item, index) => (
                  <Pressable
                    key={item.href}
                    onPress={() => router.push(item.href as never)}
                    style={({ pressed }) => [
                      styles.link,
                      {
                        borderTopColor: theme.line,
                        borderTopWidth: index === 0 ? 0 : 1,
                        backgroundColor: pressed ? theme.canvas : 'transparent',
                      },
                    ]}
                  >
                    <Icon name={item.icon} size={16} color={theme.brand} />
                    <Text style={[styles.linkLabel, { color: theme.ink }]}>{item.label}</Text>
                    <Icon name="chevron-forward" size={22} color={theme.inkSubtle} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: 3,
  },
  heroEyebrow: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  heroName: {
    fontSize: font.xxl,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  heroMeta: {
    fontSize: font.sm,
    opacity: 0.9,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 2,
  },
  tileValue: {
    fontSize: font.xxl,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  tileLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  linkLabel: {
    flex: 1,
    fontSize: font.md,
    fontWeight: '500',
  },
})
