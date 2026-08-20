import { DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer'
import { usePathname, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from '@/components/ui/Icon'
import { Logo } from '@/components/ui/Logo'
import { ThemeSwitch } from '@/components/ui/ThemeSwitch'
import { useAuth } from '@/lib/auth'
import { config } from '@/lib/config'
import { visibleSections } from '@/lib/nav'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

export function DrawerContent(props: DrawerContentComponentProps) {
  const theme = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const { profile, can, signOut } = useAuth()

  const sections = visibleSections(can)
  const initials = (profile?.name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  const go = (href: string) => {
    props.navigation.closeDrawer()
    router.push(href as never)
  }

  const leave = async () => {
    props.navigation.closeDrawer()
    await signOut()
    router.replace('/login')
  }

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surface }]}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.lg }]}
      >
        <View style={styles.brand}>
          <Logo size={40} />
          <View style={styles.brandText}>
            <Text style={[styles.brandName, { color: theme.ink }]}>{config.appName}</Text>
            <Text style={[styles.brandMeta, { color: theme.inkSubtle }]}>Workspace {config.companyId}</Text>
          </View>
        </View>

        {sections.map((section, index) => (
          <View key={section.title ?? `section-${index}`} style={styles.section}>
            {section.title ? (
              <Text style={[styles.sectionTitle, { color: theme.inkSubtle }]}>{section.title}</Text>
            ) : null}

            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

              return (
                <Pressable
                  key={item.href}
                  onPress={() => go(item.href)}
                  style={({ pressed }) => [
                    styles.item,
                    {
                      backgroundColor: active ? theme.brandSoft : pressed ? theme.canvas : 'transparent',
                    },
                  ]}
                >
                  <Icon name={item.icon} size={16} color={active ? theme.brand : theme.inkMuted} />
                  <Text
                    style={[
                      styles.itemLabel,
                      { color: active ? theme.brand : theme.ink, fontWeight: active ? '700' : '500' },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ))}
      </DrawerContentScrollView>

      <View style={[styles.footer, { borderTopColor: theme.line, paddingBottom: insets.bottom + spacing.md }]}>
        <ThemeSwitch />

        <View style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: theme.brandSoft }]}>
            <Text style={[styles.avatarText, { color: theme.brand }]}>{initials || '?'}</Text>
          </View>
          <View style={styles.profileText}>
            <Text numberOfLines={1} style={[styles.profileName, { color: theme.ink }]}>
              {profile?.name ?? '—'}
            </Text>
            <Text numberOfLines={1} style={[styles.profileMeta, { color: theme.inkSubtle }]}>
              {profile?.roles?.[0]?.name ?? profile?.email ?? '—'}
            </Text>
          </View>
          <Pressable onPress={leave} hitSlop={10} style={styles.logout}>
            <Icon name="log-out-outline" size={18} color={theme.inkMuted} />
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  scroll: {
    paddingBottom: spacing.xl,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  brandText: {
    flex: 1,
  },
  brandName: {
    fontSize: font.lg,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandMeta: {
    fontSize: font.xs,
  },
  section: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
    gap: 2,
  },
  sectionTitle: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  itemLabel: {
    fontSize: font.md,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: font.sm,
    fontWeight: '800',
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: font.sm,
    fontWeight: '700',
  },
  profileMeta: {
    fontSize: font.xs,
  },
  logout: {
    padding: spacing.xs,
  },
})
