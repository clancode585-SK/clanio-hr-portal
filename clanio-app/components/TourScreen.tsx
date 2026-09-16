import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { Icon, type IconName } from '@/components/ui/Icon'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/theme/useTheme'

type Stop = {
  key: string
  icon: IconName
  where: string
  title: string
  body: string
  permissions: string[]
  href?: string
}

const STOPS: Stop[] = [
  {
    key: 'menu',
    icon: 'menu-outline',
    where: 'Top left corner',
    title: 'Everything lives behind the menu',
    body: 'Tap the three lines at the top left to open the side menu. Whatever your role can do shows up there — nothing else.',
    permissions: [],
  },
  {
    key: 'dashboard',
    icon: 'grid-outline',
    where: 'Dashboard',
    title: 'Your day in one screen',
    body: "Who is in, what is pending on you, what is due today. Start here every morning.",
    permissions: [],
    href: '/dashboard',
  },
  {
    key: 'my-attendance',
    icon: 'person-outline',
    where: 'My Space → My Attendance',
    title: 'Punch in and punch out',
    body: 'Check in when you start, check out when you leave. Forgot a punch? Raise a correction from My Requests.',
    permissions: [],
    href: '/my-attendance',
  },
  {
    key: 'my-leave',
    icon: 'airplane-outline',
    where: 'My Space → My Leave',
    title: 'Ask for leave',
    body: 'Pick the type and the dates, add a reason, send it. Your balance and where the request has reached both show here.',
    permissions: [],
    href: '/my-leave',
  },
  {
    key: 'my-requests',
    icon: 'paper-plane-outline',
    where: 'My Space → My Requests',
    title: 'Money back, fixes, assets',
    body: 'Expense claims, attendance corrections, a new laptop, resignation — every request you raise starts from this one screen.',
    permissions: [],
    href: '/my-requests',
  },
  {
    key: 'tasks',
    icon: 'checkbox-outline',
    where: 'Monitor → Tasks',
    title: 'Your work list',
    body: 'Tasks assigned to you, what is overdue, and the hours you log against each one.',
    permissions: [],
    href: '/tasks',
  },
  {
    key: 'approvals',
    icon: 'checkmark-done-outline',
    where: 'Approve',
    title: 'Things waiting on you',
    body: 'Leave, attendance fixes and expenses from your team land here. Approve or send them back with a reason.',
    permissions: ['leave.approve', 'attendance.regularize', 'expense.verify'],
    href: '/leaves',
  },
  {
    key: 'employees',
    icon: 'people-outline',
    where: 'People → Employees',
    title: 'The people list',
    body: 'Add a joiner, open a record, see reporting lines. New employees get a login the moment you create them.',
    permissions: ['employee.view'],
    href: '/employees',
  },
  {
    key: 'openings',
    icon: 'megaphone-outline',
    where: 'People → Openings',
    title: 'Hiring runs from here',
    body: 'Post an opening once and it shows on your website careers page. Applicants, interview rounds and offer letters all sit under the opening.',
    permissions: ['recruitment.view'],
    href: '/openings',
  },
  {
    key: 'notifications',
    icon: 'notifications-outline',
    where: 'My Space → Notifications',
    title: 'Nothing gets missed',
    body: 'Approvals, reminders and updates show up as a banner right away, and stay in this list so you can come back to them.',
    permissions: [],
    href: '/notifications',
  },
  {
    key: 'profile',
    icon: 'id-card-outline',
    where: 'My Space → My Profile',
    title: 'Finish your profile any time',
    body: 'Whatever you skipped during setup — bank, documents, family — you can fill it in from here whenever you are ready.',
    permissions: [],
    href: '/profile',
  },
]

export function TourScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { profile, canAny, finishTour } = useAuth()

  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)

  const stops = useMemo(
    () => STOPS.filter((stop) => stop.permissions.length === 0 || canAny(stop.permissions)),
    [canAny]
  )

  const stop = stops[Math.min(index, stops.length - 1)]
  const last = index >= stops.length - 1

  const done = async (href?: string) => {
    if (busy) {
      return
    }

    setBusy(true)

    try {
      await finishTour()

      if (href) {
        router.push(href as never)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[styles.wrap, { backgroundColor: theme.canvas, paddingTop: insets.top + 16 }]}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: theme.brand }]}>Quick tour</Text>
        <Text style={[styles.title, { color: theme.ink }]}>
          {(profile?.name ?? 'Welcome').split(' ')[0]}, here is how to get around
        </Text>
        <Text style={[styles.subtitle, { color: theme.inkMuted }]}>
          {stops.length} short stops. Skip it and it will not come up again.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <View style={[styles.badge, { backgroundColor: theme.brandSoft }]}>
            <Icon name={stop.icon} size={24} color={theme.brand} />
          </View>

          <Text style={[styles.where, { color: theme.brand }]}>{stop.where}</Text>
          <Text style={[styles.stopTitle, { color: theme.ink }]}>{stop.title}</Text>
          <Text style={[styles.body, { color: theme.inkMuted }]}>{stop.body}</Text>
        </View>

        <View style={styles.dots}>
          {stops.map((row, position) => (
            <Pressable key={row.key} onPress={() => setIndex(position)} hitSlop={8}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: position === index ? theme.brand : theme.line,
                    width: position === index ? 20 : 7,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.counter, { color: theme.inkSubtle }]}>
          {index + 1} of {stops.length}
        </Text>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.line, paddingBottom: insets.bottom + 16 }]}>
        {last ? (
          <Button label="Got it, open the app" onPress={() => void done()} loading={busy} fullWidth />
        ) : (
          <Button label="Next" onPress={() => setIndex(index + 1)} disabled={busy} fullWidth />
        )}

        {stop.href && !last ? (
          <Button
            label="Take me there"
            variant="secondary"
            onPress={() => void done(stop.href)}
            disabled={busy}
            fullWidth
          />
        ) : null}

        <Pressable onPress={() => void done()} disabled={busy}>
          <Text style={[styles.skip, { color: theme.inkMuted }]}>Skip the tour</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  head: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 18,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 22,
    gap: 8,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  where: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  stopTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  counter: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  skip: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 8,
  },
})
