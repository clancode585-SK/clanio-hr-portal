import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Icon } from '@/components/ui/Icon'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/theme/useTheme'

export function ProfileNudge() {
  const theme = useTheme()
  const router = useRouter()
  const { onboarding, onboardingStep } = useAuth()

  const [hidden, setHidden] = useState(false)

  const percent = onboarding?.profile?.percent ?? 100
  const pending = onboarding?.profile?.pending ?? []

  if (hidden || onboardingStep !== null || onboarding?.profile?.needed !== true) {
    return null
  }

  return (
    <View style={[styles.wrap, { backgroundColor: theme.warningSoft, borderBottomColor: theme.line }]}>
      <Pressable style={styles.body} onPress={() => router.push('/profile')}>
        <Icon name="alert-circle-outline" size={18} color={theme.warning} />

        <View style={styles.text}>
          <Text style={[styles.title, { color: theme.warning }]}>Please complete your profile</Text>
          <Text numberOfLines={1} style={[styles.hint, { color: theme.inkMuted }]}>
            {percent}% done{pending.length > 0 ? ' · ' + pending.join(', ') : ''}
          </Text>
        </View>

        <Text style={[styles.go, { color: theme.warning }]}>Open</Text>
      </Pressable>

      <Pressable onPress={() => setHidden(true)} hitSlop={10} style={styles.close}>
        <Icon name="close-outline" size={18} color={theme.inkSubtle} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
  },
  hint: {
    fontSize: 11,
  },
  go: {
    fontSize: 12,
    fontWeight: '800',
  },
  close: {
    paddingLeft: 10,
    paddingVertical: 10,
  },
})
