import { useRouter } from 'expo-router'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { ThemeSwitch } from '@/components/ui/ThemeSwitch'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

export default function ProfileScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { profile, refreshProfile, signOut } = useAuth()

  const initials = (profile?.name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  const leave = async () => {
    await signOut()
    router.replace('/login')
  }

  return (
    <Screen title="My Profile" subtitle={profile?.employee?.employee_code ?? undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refreshProfile} tintColor={theme.brand} />}
      >
        <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <View style={[styles.avatar, { backgroundColor: theme.brandSoft }]}>
            <Text style={[styles.avatarText, { color: theme.brand }]}>{initials || '?'}</Text>
          </View>
          <Text style={[styles.name, { color: theme.ink }]}>{profile?.name ?? '—'}</Text>
          <Text style={[styles.email, { color: theme.inkMuted }]}>{profile?.email ?? '—'}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Row label="Role" value={profile?.roles?.map((role) => role.name).join(', ') || '—'} />
          <Row label="Designation" value={profile?.employee?.designation?.name ?? '—'} />
          <Row label="Department" value={profile?.department?.name ?? '—'} />
          <Row label="Phone" value={profile?.phone ?? '—'} />
          <Row label="Joined" value={profile?.employee?.date_of_joining ?? '—'} />
          <Row label="Permissions" value={String(profile?.permissions?.length ?? 0)} />
        </View>

        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: theme.inkMuted }]}>Appearance</Text>
          <ThemeSwitch />
        </View>

        <Button label="Sign out" variant="secondary" onPress={leave} fullWidth />
      </ScrollView>
    </Screen>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme()

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.inkMuted }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.rowValue, { color: theme.ink }]}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: font.xxl,
    fontWeight: '800',
  },
  name: {
    fontSize: font.xl,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  email: {
    fontSize: font.sm,
  },
  block: {
    gap: spacing.sm,
  },
  blockTitle: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
    paddingVertical: 11,
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
})
