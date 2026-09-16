import { useCallback, useState } from 'react'
import { useRouter } from 'expo-router'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { ThemeSwitch } from '@/components/ui/ThemeSwitch'
import { ProfileSetupScreen } from '@/components/ProfileSetupScreen'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Section = {
  key: string
  label: string
  done: number
  total: number
  percent: number
}

type Completion = {
  percent?: number
  missing?: string[]
  pending?: string[]
  sections?: Section[]
}

export default function ProfileScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { profile, refreshProfile, refreshOnboarding, signOut } = useAuth()

  const [open, setOpen] = useState(false)
  const [setup, setSetup] = useState(false)
  const [tourNote, setTourNote] = useState<string | null>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      return await api<Completion>('/profile/completion')
    } catch {
      return {} as Completion
    }
  }, [])

  const completion = useResource<Completion>(load, [])

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

  const close = () => {
    setOpen(false)
    setErrors({})
    setProblem(null)
  }

  const changePassword = async () => {
    if (busy) {
      return
    }

    const found: Record<string, string> = {}

    if (current.length === 0) {
      found.current_password = 'Enter your current password'
    }

    if (next.length < 8 || !/[a-zA-Z]/.test(next) || !/\d/.test(next)) {
      found.password = 'At least 8 characters with a letter and a number'
    }

    if (next !== confirm) {
      found.password_confirmation = 'Both passwords must match'
    }

    setErrors(found)

    if (Object.keys(found).length > 0) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { current_password: current, password: next, password_confirmation: confirm },
      })

      setCurrent('')
      setNext('')
      setConfirm('')
      close()
      setDone('Password changed. Use the new one next time you sign in.')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 422 && Object.keys(caught.fields).length > 0) {
        const mapped: Record<string, string> = {}

        for (const [field, messages] of Object.entries(caught.fields)) {
          mapped[field] = messages[0]
        }

        setErrors(mapped)
        setProblem('Check the highlighted fields.')
      } else {
        setProblem(caught instanceof ApiError ? caught.message : 'Could not change the password.')
      }
    } finally {
      setBusy(false)
    }
  }

  const percent = completion.data?.percent
  const missing = completion.data?.pending ?? completion.data?.missing ?? []
  const sections = completion.data?.sections ?? []

  const closeSetup = () => {
    setSetup(false)
    void completion.refresh()
    void refreshProfile()
  }

  const replayTour = async () => {
    try {
      await api('/onboarding/tour-reset', { method: 'POST' })
      await refreshOnboarding()
      setTourNote('The tour will open the next time you come back to the app.')
    } catch {
      setTourNote(null)
    }
  }

  return (
    <Screen title="My Profile" subtitle={profile?.employee?.employee_code ?? undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              void refreshProfile()
              void completion.refresh()
            }}
            tintColor={theme.brand}
          />
        }
      >
        {done ? <Notice tone="success" title="Saved" message={done} /> : null}

        <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <View style={[styles.avatar, { backgroundColor: theme.brandSoft }]}>
            <Text style={[styles.avatarText, { color: theme.brand }]}>{initials || '?'}</Text>
          </View>
          <Text style={[styles.name, { color: theme.ink }]}>{profile?.name ?? '—'}</Text>
          <Text style={[styles.email, { color: theme.inkMuted }]}>{profile?.email ?? '—'}</Text>
        </View>

        {percent != null ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <View style={styles.progressHead}>
              <Text style={[styles.progressLabel, { color: theme.inkMuted }]}>Profile completeness</Text>
              <Text style={[styles.progressValue, { color: theme.brand }]}>{percent}%</Text>
            </View>

            <View style={[styles.track, { backgroundColor: theme.canvas }]}>
              <View
                style={[styles.fill, { backgroundColor: theme.brand, width: `${Math.min(100, Math.max(0, percent))}%` }]}
              />
            </View>

            {missing.length > 0 ? (
              <Text style={[styles.missing, { color: theme.inkSubtle }]}>Still missing: {missing.join(', ')}</Text>
            ) : null}

            {sections.length > 0 ? (
              <View style={styles.sections}>
                {sections.map((section) => (
                  <View key={section.key} style={styles.sectionRow}>
                    <Text
                      style={[
                        styles.sectionMark,
                        { color: section.percent === 100 ? theme.success : theme.inkSubtle },
                      ]}
                    >
                      {section.percent === 100 ? '✓' : '○'}
                    </Text>
                    <Text style={[styles.sectionLabel, { color: theme.ink }]}>{section.label}</Text>
                    <Text style={[styles.sectionCount, { color: theme.inkSubtle }]}>
                      {section.done}/{section.total}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {percent < 100 ? (
              <View style={styles.finish}>
                <Button label="Finish my profile" onPress={() => setSetup(true)} fullWidth />
              </View>
            ) : null}
          </View>
        ) : null}

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

        {tourNote ? <Notice tone="info" title="Tour reset" message={tourNote} /> : null}

        <Button label="Show the tour again" variant="secondary" onPress={() => void replayTour()} fullWidth />

        <Button
          label="Change password"
          variant="secondary"
          onPress={() => {
            setOpen(true)
            setDone(null)
          }}
          fullWidth
        />
        <Button label="Sign out" variant="secondary" onPress={leave} fullWidth />
      </ScrollView>

      <Modal visible={setup} animationType="slide" onRequestClose={closeSetup}>
        <ProfileSetupScreen onDone={closeSetup} />
      </Modal>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={[styles.grab, { backgroundColor: theme.line }]} />

            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>Change password</Text>

              {problem ? <Notice tone="danger" title="Could not change" message={problem} /> : null}

              <View style={styles.form}>
                <Field
                  label="Current password"
                  value={current}
                  onChangeText={setCurrent}
                  placeholder="The one you use today"
                  secure
                  error={errors.current_password}
                  editable={!busy}
                />
                <Field
                  label="New password"
                  value={next}
                  onChangeText={setNext}
                  placeholder="At least 8 characters"
                  secure
                  error={errors.password}
                  editable={!busy}
                />
                <Field
                  label="Repeat new password"
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Type it again"
                  secure
                  error={errors.password_confirmation}
                  editable={!busy}
                />

                <Button label="Update password" onPress={changePassword} loading={busy} fullWidth />
                <Button label="Cancel" variant="ghost" onPress={close} disabled={busy} fullWidth />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme()

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.inkMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.ink }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  hero: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: 4,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: font.xl,
    fontWeight: '800',
  },
  name: {
    fontSize: font.lg,
    fontWeight: '700',
  },
  email: {
    fontSize: font.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: 9,
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
    fontWeight: '600',
    textAlign: 'right',
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  progressLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  progressValue: {
    fontSize: font.lg,
    fontWeight: '800',
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  missing: {
    fontSize: font.xs,
    paddingVertical: spacing.md,
  },
  sections: {
    paddingBottom: spacing.sm,
    gap: 6,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionMark: {
    fontSize: font.sm,
    fontWeight: '800',
    width: 14,
  },
  sectionLabel: {
    flex: 1,
    fontSize: font.sm,
    fontWeight: '600',
  },
  sectionCount: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  finish: {
    paddingBottom: spacing.md,
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
  },
  grab: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  sheetBody: {
    paddingHorizontal: spacing.xl,
  },
  sheetTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
})
