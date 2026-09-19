import { useCallback, useEffect, useState } from 'react'
import { DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer'
import { usePathname, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from '@/components/ui/Icon'
import { Logo } from '@/components/ui/Logo'
import { ThemeSwitch } from '@/components/ui/ThemeSwitch'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { onRealtime } from '@/lib/realtime'
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
  const [unread, setUnread] = useState(0)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const pullUnread = useCallback(async () => {
    try {
      const result = await api<{ unread_count?: number }>('/notifications/unread-count')

      setUnread(Number(result.unread_count ?? 0))
    } catch {
      setUnread(0)
    }
  }, [])

  useEffect(() => {
    void pullUnread()

    return onRealtime((event) => {
      if (event.name.startsWith('notification.') || event.name === 'announcement.new') {
        void pullUnread()
      }
    })
  }, [pullUnread, pathname])
  const sections = onPlatform ? platformSections : visibleSections(can)
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
                  style={styles.sectionHead}
                >
                  <Text style={[styles.sectionTitle, { color: theme.inkSubtle }]}>{section.title}</Text>
                  <Icon
                    name={open ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={13}
                    color={theme.inkSubtle}
                  />
                </Pressable>
              ) : null}

              {open
                ? section.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

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
                        <View
                          style={[
                            styles.rail,
                            { backgroundColor: active ? theme.brand : 'transparent' },
                          ]}
                        />
                        <Icon name={item.icon} size={16} color={active ? theme.brand : theme.inkMuted} />
                        <Text
                          style={[
                            styles.itemLabel,
                            { color: active ? theme.ink : theme.inkMuted, fontWeight: active ? '700' : '500' },
                          ]}
                        >
                          {item.label}
                        </Text>

                        {item.href === '/notifications' && unread > 0 ? (
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
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.md,
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
    paddingRight: spacing.md,
    paddingLeft: spacing.sm,
    borderRadius: radius.sm,
  },
  rail: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: font.xs,
    fontWeight: '800',
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
