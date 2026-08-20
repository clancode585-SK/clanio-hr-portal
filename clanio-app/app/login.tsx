import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { config } from '@/lib/config'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Blocker = {
  tone: 'danger' | 'warning'
  title: string
  message: string
}

const THROTTLE_SECONDS = 60

export default function LoginScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { ready, token, signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [blocker, setBlocker] = useState<Blocker | null>(null)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (ready && token) {
      router.replace('/dashboard')
    }
  }, [ready, router, token])

  useEffect(() => {
    if (cooldown <= 0) {
      if (timer.current) {
        clearInterval(timer.current)
        timer.current = null
      }

      return
    }

    if (timer.current) {
      return
    }

    timer.current = setInterval(() => {
      setCooldown((current) => {
        if (current <= 1) {
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => {
      if (timer.current) {
        clearInterval(timer.current)
        timer.current = null
      }
    }
  }, [cooldown])

  const startCooldown = (seconds: number) => {
    setCooldown(seconds)
  }

  const submit = async () => {
    if (busy || cooldown > 0) {
      return
    }

    const nextErrors: Record<string, string> = {}

    if (!email.trim()) {
      nextErrors.email = 'Enter your email'
    }

    if (!password) {
      nextErrors.password = 'Enter your password'
    }

    setFieldErrors(nextErrors)
    setBlocker(null)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setBusy(true)

    try {
      await signIn(email.trim(), password)
      router.replace('/dashboard')
    } catch (error) {
      handleFailure(error)
    } finally {
      setBusy(false)
    }
  }

  const handleFailure = (error: unknown) => {
    if (!(error instanceof ApiError)) {
      setBlocker({ tone: 'danger', title: 'Sign in failed', message: 'Something went wrong. Please try again.' })

      return
    }

    if (error.isNetwork) {
      setBlocker({
        tone: 'danger',
        title: 'Connection failed',
        message: `${error.message}\n\nServer: ${config.apiUrl}`,
      })

      return
    }

    if (error.isThrottled) {
      startCooldown(error.retryAfter ?? THROTTLE_SECONDS)
      setBlocker({
        tone: 'warning',
        title: 'Too many attempts',
        message: 'Only 5 sign-in attempts are allowed per minute. Please wait and try again.',
      })

      return
    }

    if (error.status === 423 || error.code === 'ACCOUNT_LOCKED') {
      setBlocker({ tone: 'danger', title: 'Account locked', message: error.message })

      return
    }

    if (error.status === 422) {
      const mapped: Record<string, string> = {}

      for (const [field, messages] of Object.entries(error.fields)) {
        mapped[field] = messages[0]
      }

      setFieldErrors(mapped)

      if (Object.keys(mapped).length === 0) {
        setBlocker({ tone: 'danger', title: 'Sign in failed', message: error.message })
      }

      return
    }

    setBlocker({ tone: 'danger', title: 'Sign in failed', message: error.message })
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <Logo size={44} />
          <Text style={[styles.brandName, { color: theme.ink }]}>{config.appName}</Text>
        </View>

        <View style={styles.headings}>
          <Text style={[styles.title, { color: theme.ink }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: theme.inkMuted }]}>
            Sign in to your workspace
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          {blocker ? <Notice tone={blocker.tone} title={blocker.title} message={blocker.message} /> : null}

          <Field
            label="Email"
            value={email}
            onChangeText={(value) => {
              setEmail(value)
              setFieldErrors((current) => ({ ...current, email: '' }))
            }}
            placeholder="you@company.com"
            keyboardType="email-address"
            error={fieldErrors.email || null}
            editable={!busy}
          />

          <Field
            label="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value)
              setFieldErrors((current) => ({ ...current, password: '' }))
            }}
            placeholder="••••••••"
            secure
            error={fieldErrors.password || null}
            editable={!busy}
          />

          <Button
            label={cooldown > 0 ? `Wait ${cooldown}s` : 'Sign in'}
            onPress={submit}
            loading={busy}
            disabled={cooldown > 0}
            fullWidth
          />

          <Pressable hitSlop={8}>
            <Text style={[styles.help, { color: theme.inkSubtle }]}>
              Forgot your password? Contact your HR team.
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.footer, { color: theme.inkSubtle }]}>
          Company workspace · ID {config.companyId}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandName: {
    fontSize: font.xl,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  headings: {
    gap: 6,
  },
  title: {
    fontSize: font.xxxl,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: font.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  help: {
    fontSize: font.sm,
    textAlign: 'center',
  },
  footer: {
    fontSize: font.xs,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
})
