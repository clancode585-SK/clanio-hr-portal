import { useState } from 'react'
import { useRouter } from 'expo-router'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { api, ApiError } from '@/lib/api'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

export default function ForgotPasswordScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [stage, setStage] = useState<'request' | 'reset'>('request')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const fail = (caught: unknown, fallback: string) => {
    if (caught instanceof ApiError && caught.status === 422 && Object.keys(caught.fields).length > 0) {
      const mapped: Record<string, string> = {}

      for (const [field, messages] of Object.entries(caught.fields)) {
        mapped[field] = messages[0]
      }

      setErrors(mapped)
      setProblem('Check the highlighted fields.')

      return
    }

    setProblem(caught instanceof ApiError ? caught.message : fallback)
  }

  const request = async () => {
    if (busy) {
      return
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErrors({ email: 'Enter a valid email' })

      return
    }

    setErrors({})
    setBusy(true)
    setProblem(null)

    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim().toLowerCase() } })

      setSent('If that email exists, a reset link is on its way. Paste the code from it below.')
      setStage('reset')
    } catch (caught) {
      fail(caught, 'Could not send the reset link.')
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    if (busy) {
      return
    }

    const found: Record<string, string> = {}

    if (token.trim().length !== 64) {
      found.token = 'The code is 64 characters long'
    }

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      found.password = 'At least 8 characters with a letter and a number'
    }

    if (password !== confirm) {
      found.password_confirmation = 'Both passwords must match'
    }

    setErrors(found)

    if (Object.keys(found).length > 0) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { token: token.trim(), password, password_confirmation: confirm },
      })

      router.replace('/login')
    } catch (caught) {
      fail(caught, 'Could not reset the password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[styles.wrap, { backgroundColor: theme.canvas, paddingTop: insets.top + spacing.xl }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.ink }]}>Reset your password</Text>
          <Text style={[styles.subtitle, { color: theme.inkMuted }]}>
            {stage === 'request'
              ? 'We will email you a code to set a new one.'
              : 'Paste the code from the email and pick a new password.'}
          </Text>

          {sent ? <Notice tone="success" title="Check your email" message={sent} /> : null}
          {problem ? <Notice tone="danger" title="Failed" message={problem} /> : null}

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            {stage === 'request' ? (
              <>
                <Field
                  label="Work email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@company.com"
                  keyboardType="email-address"
                  error={errors.email}
                  editable={!busy}
                />
                <Button label="Send reset link" onPress={request} loading={busy} fullWidth />
              </>
            ) : (
              <>
                <Field
                  label="Code from the email"
                  value={token}
                  onChangeText={setToken}
                  placeholder="64 character code"
                  error={errors.token}
                  editable={!busy}
                />
                <Field
                  label="New password"
                  value={password}
                  onChangeText={setPassword}
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
                <Button label="Set new password" onPress={reset} loading={busy} fullWidth />
                <Button
                  label="Send the code again"
                  variant="ghost"
                  onPress={() => setStage('request')}
                  disabled={busy}
                  fullWidth
                />
              </>
            )}
          </View>

          <Pressable onPress={() => router.replace('/login')} disabled={busy}>
            <Text style={[styles.link, { color: theme.brand }]}>Back to sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: font.md,
    lineHeight: 21,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  link: {
    fontSize: font.sm,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
})
