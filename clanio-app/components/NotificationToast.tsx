import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon, type IconName } from '@/components/ui/Icon'
import { useAuth } from '@/lib/auth'
import { onRealtime, type RealtimeEvent } from '@/lib/realtime'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Toast = {
  id: number
  title: string
  body: string
  group: string
  href: string | null
}

const icons: Record<string, IconName> = {
  leave: 'calendar-outline',
  attendance: 'time-outline',
  document: 'document-text-outline',
  task: 'checkbox-outline',
  report: 'clipboard-outline',
  expense: 'card-outline',
  exit: 'exit-outline',
  performance: 'trophy-outline',
  asset: 'laptop-outline',
  policy: 'reader-outline',
  holiday: 'sunny-outline',
  announcement: 'megaphone-outline',
  ticket: 'chatbubbles-outline',
  account: 'person-circle-outline',
}

const routes: Record<string, string> = {
  leave: '/leaves',
  attendance: '/attendance',
  document: '/employees',
  task: '/tasks',
  report: '/daily-reports',
  expense: '/expense-claims',
  exit: '/exits',
  performance: '/goals',
  asset: '/asset-requests',
  policy: '/my-policies',
  holiday: '/holidays',
  announcement: '/notifications',
  ticket: '/tickets',
  account: '/profile',
}

let nextId = 1

export function NotificationToast() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { token } = useAuth()

  const [toast, setToast] = useState<Toast | null>(null)
  const slide = useRef(new Animated.Value(-160)).current
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }

    Animated.timing(slide, {
      toValue: -160,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => setToast(null))
  }, [slide])

  useEffect(() => {
    if (!token) {
      return
    }

    return onRealtime((event: RealtimeEvent) => {
      if (event.name !== 'notification.new' && event.name !== 'announcement.new') {
        return
      }

      const data = event.payload?.notification ?? event.payload ?? {}
      const group = String(data.group ?? 'account')
      const title = String(data.title ?? 'New update')

      if (!title) {
        return
      }

      setToast({
        id: nextId++,
        title,
        body: String(data.body ?? ''),
        group,
        href: typeof data.action_url === 'string' && data.action_url.startsWith('/')
          ? data.action_url
          : (routes[group] ?? '/notifications'),
      })
    })
  }, [token])

  useEffect(() => {
    if (!toast) {
      return
    }

    slide.setValue(-160)

    Animated.timing(slide, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start()

    hideTimer.current = setTimeout(dismiss, 5000)

    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
        hideTimer.current = null
      }
    }
  }, [toast, slide, dismiss])

  if (!toast || !token) {
    return null
  }

  const open = () => {
    const href = toast.href

    dismiss()

    if (href) {
      router.push(href as never)
    }
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: insets.top + spacing.sm, transform: [{ translateY: slide }] }]}
    >
      <Pressable
        onPress={open}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: pressed ? theme.canvas : theme.surface,
            borderColor: theme.line,
            shadowColor: '#0D1A33',
          },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: theme.brandSoft }]}>
          <Icon name={icons[toast.group] ?? 'notifications-outline'} size={20} color={theme.brand} />
        </View>

        <View style={styles.text}>
          <Text style={[styles.app, { color: theme.brand }]}>Clanio</Text>
          <Text numberOfLines={1} style={[styles.title, { color: theme.ink }]}>
            {toast.title}
          </Text>
          {toast.body ? (
            <Text numberOfLines={2} style={[styles.body, { color: theme.inkMuted }]}>
              {toast.body}
            </Text>
          ) : null}
        </View>

        <Pressable onPress={dismiss} hitSlop={10} style={styles.close}>
          <Icon name="close" size={18} color={theme.inkSubtle} />
        </Pressable>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    paddingHorizontal: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 1,
  },
  app: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: font.md,
    fontWeight: '700',
  },
  body: {
    fontSize: font.sm,
    lineHeight: 19,
  },
  close: {
    paddingTop: 2,
  },
})
