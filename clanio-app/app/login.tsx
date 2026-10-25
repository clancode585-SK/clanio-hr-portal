import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from '@/components/ui/Icon'
import { Logo } from '@/components/ui/Logo'
import { Notice } from '@/components/ui/Notice'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { config } from '@/lib/config'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'
import type { Theme } from '@/theme/tokens'

type Blocker = {
  tone: 'danger' | 'warning'
  title: string
  message: string
}

type Workspace = { slug: string; name: string }

const THROTTLE_SECONDS = 60

const FEATURES = [
  { icon: 'people-outline' as const, label: 'Manage\nPeople' },
  { icon: 'shield-checkmark-outline' as const, label: 'Automate\nPayroll' },
  { icon: 'flash-outline' as const, label: 'Boost\nProductivity' },
]

const CHART_BARS = [0.35, 0.5, 0.42, 0.62, 0.55, 0.8, 0.95]

export default function LoginScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { ready, token, signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [remember, setRemember] = useState(true)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [blocker, setBlocker] = useState<Blocker | null>(null)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
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

  const submit = async (companySlug?: string) => {
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
      await signIn(email.trim(), password, companySlug)
      router.replace('/dashboard')
    } catch (error) {
      handleFailure(error)
    } finally {
      setBusy(false)
    }
  }

  const handleFailure = (error: unknown) => {
    setWorkspaces([])

    if (error instanceof ApiError && error.code === 'AUTH_COMPANY_REQUIRED') {
      const list = Array.isArray(error.raw.companies) ? (error.raw.companies as Workspace[]) : []

      setWorkspaces(list.filter((row) => typeof row?.slug === 'string'))
      setBlocker({
        tone: 'warning',
        title: 'Which workspace',
        message: list.length > 0 ? error.message : error.message + ' Ask your HR for the workspace name.',
      })

      return
    }

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

  const signInLabel = cooldown > 0 ? `Wait ${cooldown}s` : 'Sign in'

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.canvas }]} pointerEvents="none">
        <View style={[styles.blobTopLeft, { backgroundColor: theme.brand, opacity: theme.name === 'dark' ? 0.18 : 0.16 }]} />
        <View style={[styles.blobTopRight, { backgroundColor: theme.brand, opacity: theme.name === 'dark' ? 0.16 : 0.14 }]} />
        <View style={[styles.blobBottom, { backgroundColor: theme.brand, opacity: theme.name === 'dark' ? 0.12 : 0.1 }]} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.introRow}>
          <View style={styles.brandBlock}>
            <View style={styles.brandRow}>
              <Logo size={48} />
              <View>
                <Text style={[styles.brandName, { color: theme.ink }]}>{config.appName}</Text>
                <Text style={[styles.brandTag, { color: theme.inkSubtle }]}>HR, payroll and people</Text>
              </View>
            </View>
          </View>

          <DashboardGlyph theme={theme} />
        </View>

        <View style={styles.headings}>
          <Text style={[styles.eyebrow, { color: theme.inkSubtle }]}>SMART HR SOLUTIONS</Text>
          <Text style={styles.title}>
            <Text style={{ color: theme.ink }}>Better People.{'\n'}</Text>
            <Text style={{ color: theme.brand }}>Stronger Businesses.</Text>
          </Text>
          <Text style={[styles.subtitle, { color: theme.inkMuted }]}>
            Manage your people, payroll and workforce — all in one place.
          </Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((feature, index) => (
            <View key={feature.icon} style={styles.featureItem}>
              {index > 0 ? <View style={[styles.featureSep, { backgroundColor: theme.line }]} /> : null}
              <View style={[styles.featureIcon, { backgroundColor: theme.brandSoft }]}>
                <Icon name={feature.icon} size={18} color={theme.brand} />
              </View>
              <Text style={[styles.featureLabel, { color: theme.inkMuted }]}>{feature.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.cardTitle, { color: theme.ink }]}>Welcome Back</Text>
          <Text style={[styles.cardSubtitle, { color: theme.inkMuted }]}>Sign in to continue to your account</Text>

          {blocker ? <Notice tone={blocker.tone} title={blocker.title} message={blocker.message} /> : null}

          <View style={styles.fieldWrap}>
            <Text style={[styles.fieldLabel, { color: theme.ink }]}>Email Address</Text>
            <View
              style={[
                styles.inputWrap,
                {
                  borderColor: fieldErrors.email ? theme.danger : emailFocused ? theme.brand : theme.line,
                  backgroundColor: theme.canvas,
                },
              ]}
            >
              <Icon name="mail-outline" size={18} color={theme.inkSubtle} />
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value)
                  setFieldErrors((current) => ({ ...current, email: '' }))
                }}
                placeholder="you@company.com"
                placeholderTextColor={theme.inkSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                style={[styles.input, { color: theme.ink }]}
              />
            </View>
            {fieldErrors.email ? <Text style={[styles.errorText, { color: theme.danger }]}>{fieldErrors.email}</Text> : null}
          </View>

          <View style={styles.fieldWrap}>
            <Text style={[styles.fieldLabel, { color: theme.ink }]}>Password</Text>
            <View
              style={[
                styles.inputWrap,
                {
                  borderColor: fieldErrors.password ? theme.danger : passwordFocused ? theme.brand : theme.line,
                  backgroundColor: theme.canvas,
                },
              ]}
            >
              <Icon name="lock-closed-outline" size={18} color={theme.inkSubtle} />
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value)
                  setFieldErrors((current) => ({ ...current, password: '' }))
                }}
                placeholder="Enter your password"
                placeholderTextColor={theme.inkSubtle}
                secureTextEntry={!reveal}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                style={[styles.input, { color: theme.ink }]}
              />
              <Pressable onPress={() => setReveal((current) => !current)} hitSlop={10}>
                <Icon name={reveal ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.inkSubtle} />
              </Pressable>
            </View>
            {fieldErrors.password ? (
              <Text style={[styles.errorText, { color: theme.danger }]}>{fieldErrors.password}</Text>
            ) : null}
          </View>

          <View style={styles.optionsRow}>
            <Pressable style={styles.rememberRow} onPress={() => setRemember((current) => !current)} hitSlop={8}>
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: remember ? theme.brand : 'transparent',
                    borderColor: remember ? theme.brand : theme.line,
                  },
                ]}
              >
                {remember ? <Icon name="checkmark" size={13} color={theme.onBrand} /> : null}
              </View>
              <Text style={[styles.rememberText, { color: theme.inkMuted }]}>Remember me</Text>
            </Pressable>

            <Pressable onPress={() => router.push('/forgot-password')} disabled={busy} hitSlop={8}>
              <Text style={[styles.linkText, { color: theme.brand }]}>Forgot password?</Text>
            </Pressable>
          </View>

          {workspaces.length > 0 ? (
            <View style={styles.workspaces}>
              {workspaces.map((row) => (
                <Pressable
                  key={row.slug}
                  onPress={() => void submit(row.slug)}
                  disabled={busy}
                  style={[styles.workspaceButton, { borderColor: theme.line, backgroundColor: theme.canvas }]}
                >
                  <Text style={[styles.workspaceLabel, { color: theme.ink }]}>{row.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Pressable
              onPress={() => void submit()}
              disabled={busy || cooldown > 0}
              style={({ pressed }) => [
                styles.signInButton,
                {
                  backgroundColor: theme.brand,
                  opacity: busy || cooldown > 0 ? 0.6 : pressed ? 0.88 : 1,
                },
              ]}
            >
              <Text style={[styles.signInLabel, { color: theme.onBrand }]}>{signInLabel}</Text>
              {!busy && cooldown === 0 ? <Icon name="arrow-forward" size={18} color={theme.onBrand} /> : null}
            </Pressable>
          )}

          <Text style={[styles.support, { color: theme.inkSubtle }]}>
            Need help?{' '}
            <Text style={[styles.linkText, { color: theme.brand }]} onPress={() => undefined}>
              Contact support
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const AVATAR_TINTS = ['#FFD9A8', '#C9E8FF', '#FFC9D9'] as const

function DashboardGlyph({ theme }: { theme: Theme }) {
  return (
    <View style={styles.glyphWrap}>
      <View style={[styles.glyphBlob, { backgroundColor: theme.brandSoft }]} />

      <View style={[styles.glyphCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <View style={styles.glyphHeaderRow}>
          <View style={[styles.glyphAvatar, { backgroundColor: theme.brandSoft }]}>
            <Icon name="person" size={10} color={theme.brand} />
          </View>
          <View style={styles.glyphLines}>
            <View style={[styles.glyphLine, { backgroundColor: theme.line, width: '75%' }]} />
            <View style={[styles.glyphLine, { backgroundColor: theme.line, width: '50%' }]} />
          </View>
        </View>

        <View style={styles.glyphMetricRow}>
          <Text style={[styles.glyphMetricLabel, { color: theme.inkSubtle }]}>People</Text>
          <View style={[styles.glyphTrendPill, { backgroundColor: theme.successSoft }]}>
            <Icon name="caret-up" size={10} color={theme.success} />
            <Text style={[styles.glyphTrend, { color: theme.success }]}>12%</Text>
          </View>
        </View>
        <Text style={[styles.glyphMetricValue, { color: theme.ink }]}>128</Text>

        <View style={styles.glyphChart}>
          {CHART_BARS.map((height, index) => (
            <View
              key={index}
              style={[
                styles.glyphBar,
                {
                  height: 28 * height,
                  backgroundColor: index === CHART_BARS.length - 1 ? theme.brand : theme.brandSoft,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.avatarStack}>
        {AVATAR_TINTS.map((tint, index) => (
          <View
            key={tint}
            style={[
              styles.avatarDot,
              { backgroundColor: tint, borderColor: theme.surface, marginLeft: index === 0 ? 0 : -10, zIndex: AVATAR_TINTS.length - index },
            ]}
          >
            <Icon name="person" size={10} color="#FFFFFF" />
          </View>
        ))}
      </View>

      <Text style={[styles.annotation, { color: theme.brand }]}>Simple{'\n'}Secure{'\n'}Smarter</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  blobTopLeft: {
    position: 'absolute',
    top: -80,
    left: -90,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.6,
  },
  blobTopRight: {
    position: 'absolute',
    top: -40,
    right: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.5,
  },
  blobBottom: {
    position: 'absolute',
    bottom: -200,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  introRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brandBlock: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandName: {
    fontSize: font.xl,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  brandTag: {
    fontSize: font.xs,
    marginTop: 2,
  },
  glyphWrap: {
    width: 116,
    height: 122,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  glyphBlob: {
    position: 'absolute',
    top: -4,
    right: 2,
    width: 98,
    height: 98,
    borderRadius: 49,
    opacity: 0.8,
  },
  glyphCard: {
    width: 106,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.sm,
    gap: 4,
  },
  glyphHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  glyphAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphLines: {
    flex: 1,
    gap: 4,
  },
  glyphLine: {
    height: 4,
    borderRadius: 2,
  },
  glyphMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  glyphMetricLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  glyphTrendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  glyphTrend: {
    fontSize: 9,
    fontWeight: '700',
  },
  glyphMetricValue: {
    fontSize: font.lg,
    fontWeight: '800',
  },
  glyphChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 20,
    marginTop: 2,
  },
  glyphBar: {
    flex: 1,
    borderRadius: 2,
  },
  avatarStack: {
    flexDirection: 'row',
    marginTop: 6,
    marginRight: 6,
  },
  avatarDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  annotation: {
    fontSize: 9,
    fontStyle: 'italic',
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: 10,
    marginTop: 4,
    marginRight: 6,
    transform: [{ rotate: '-4deg' }],
  },
  headings: {
    gap: 6,
  },
  eyebrow: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: font.sm,
    lineHeight: 19,
    maxWidth: 420,
  },
  features: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  featureItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
  },
  featureSep: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 16,
    width: 1,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: font.lg,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: font.xs,
    marginTop: -4,
    marginBottom: 2,
  },
  fieldWrap: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: 11,
    fontSize: font.sm,
  },
  errorText: {
    fontSize: font.xs,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberText: {
    fontSize: font.xs,
    fontWeight: '500',
  },
  linkText: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  workspaces: {
    gap: spacing.sm,
  },
  workspaceButton: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  workspaceLabel: {
    fontSize: font.sm,
    fontWeight: '600',
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: 13,
    paddingVertical: 13,
  },
  signInLabel: {
    fontSize: font.sm,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  support: {
    fontSize: font.xs,
    textAlign: 'center',
    marginTop: 2,
  },
})
