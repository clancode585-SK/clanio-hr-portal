import { useState } from 'react'
import { DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer'
import { usePathname, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from '@/components/ui/Icon'
import { Logo } from '@/components/ui/Logo'
import { ThemeSwitch } from '@/components/ui/ThemeSwitch'
import { useAuth } from '@/lib/auth'
import { useUnread } from '@/lib/useUnread'
import { config } from '@/lib/config'
import { platformSections, visibleSections } from '@/lib/nav'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

export function DrawerContent(props: DrawerContentComponentProps) {
  const theme = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const { profile, can, signOut, isSuperAdmin, companyId } = useAuth()

  const onPlatform = isSuperAdmin && companyId === null
  const unread = useUnread()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const sections = onPlatform ? platformSections : visibleSections(can, profile?.roles?.[0]?.slug)
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
      <View style={[styles.brand, { paddingTop: insets.top + spacing.lg, borderBottomColor: theme.line }]}>
        <Logo size={36} />
        <View style={styles.brandText}>
          <Text style={[styles.brandName, { color: theme.ink }]}>{config.appName}</Text>
          <Text numberOfLines={1} style={[styles.brandMeta, { color: theme.inkSubtle }]}>
            {onPlatform ? 'Platform console' : `Workspace ${config.companyId}`}
          </Text>
        </View>
      </View>

      <DrawerContentScrollView {...props} contentContainerStyle={styles.scroll}>
        {sections.map((section, index) => {
          const key = section.title ?? `section-${index}`
          const holdsActive = section.items.some(
            (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
          )
          // Jis group me abhi ho wo khula rehta hai, baaki band — user chahe to toggle kare
          const open = section.title === null || !(collapsed[key] ?? !holdsActive)

          return (
            <View key={key} style={styles.section}>
              {section.title ? (
                <Pressable
                  onPress={() => setCollapsed((prev) => ({ ...prev, [key]: !(prev[key] ?? !holdsActive) }))}
                  style={({ pressed }) => [
                    styles.sectionHead,
                    { backgroundColor: pressed ? theme.canvas : 'transparent' },
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: theme.inkSubtle }]}>{section.title}</Text>
                  <Icon
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={theme.inkSubtle}
                  />
                </Pressable>
              ) : null}

              {open
                ? section.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                    const badge = item.href === '/notifications' && unread > 0

                    return (
                      <Pressable
                        key={item.href}
                        onPress={() => go(item.href)}
                        style={({ pressed }) => [
                          styles.item,
                          {
                            backgroundColor: active
                              ? theme.brandSoft
                              : pressed
                                ? theme.canvas
                                : 'transparent',
                          },
                        ]}
                      >
                        <Icon
                          name={item.icon}
                          size={19}
                          color={active ? theme.brand : theme.inkMuted}
                        />
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.itemLabel,
                            {
                              color: active ? theme.brand : theme.ink,
                              fontWeight: active ? '700' : '500',
                            },
                          ]}
                        >
                          {item.label}
                        </Text>

                        {badge ? (
                          <View style={[styles.badge, { backgroundColor: theme.danger }]}>
                            <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    )
                  })
                : null}
            </View>
          )
        })}
      </DrawerContentScrollView>

      <View style={[styles.footer, { borderTopColor: theme.line, paddingBottom: insets.bottom + spacing.md }]}>
        <ThemeSwitch />

        <View style={[styles.profile, { backgroundColor: theme.canvas }]}>
          <View style={[styles.avatar, { backgroundColor: theme.brand }]}>
            <Text style={[styles.avatarText, { color: theme.onBrand }]}>{initials || '?'}</Text>
          </View>
          <View style={styles.profileText}>
            <Text numberOfLines={1} style={[styles.profileName, { color: theme.ink }]}>
              {profile?.name ?? '—'}
            </Text>
            <Text numberOfLines={1} style={[styles.profileMeta, { color: theme.inkSubtle }]}>
              {profile?.roles?.[0]?.name ?? profile?.email ?? '—'}
            </Text>
          </View>
          <Pressable
            onPress={leave}
            hitSlop={10}
            style={({ pressed }) => [
              styles.logout,
              { backgroundColor: pressed ? theme.dangerSoft : 'transparent' },
            ]}
          >
            <Icon name="log-out-outline" size={18} color={theme.danger} />
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
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
  },
  brandText: {
    flex: 1,
  },
  brandName: {
    fontSize: font.lg,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandMeta: {
    fontSize: 12,
    marginTop: 1,
  },
  scroll: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  itemLabel: {
    flex: 1,
    fontSize: 15.5,
    letterSpacing: -0.1,
  },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
  },
  avatar: {
    width: 38,
    height: 38,
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
    fontSize: 14,
    fontWeight: '700',
  },
  profileMeta: {
    fontSize: 12,
    marginTop: 1,
  },
  logout: {
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
})
