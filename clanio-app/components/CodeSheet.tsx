import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Money } from '@/lib/money'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

export type Verification = {
  uuid: string
  sent_to: string
  amount: number
  headcount: number
  minutes_left: number
  tries_left: number
  action: string
  scheduled_for?: string | null
}

type Props = {
  verification: Verification | null
  busy: boolean
  problem: string | null
  onSubmit: (code: string) => void
  onResend: () => void
  onClose: () => void
}

export function CodeSheet({ verification, busy, problem, onSubmit, onResend, onClose }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [code, setCode] = useState('')

  useEffect(() => {
    setCode('')
  }, [verification?.uuid])

  const ready = /^\d{6}$/.test(code.trim())

  return (
    <Modal visible={verification !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={[styles.head, { borderBottomColor: theme.line }]}>
          <Text style={[styles.title, { color: theme.ink }]}>Ek code aur</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={[styles.close, { color: theme.inkMuted }]}>✕</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          {problem ? <Notice tone="danger" title="Code nahi chala" message={problem} /> : null}

          {verification ? (
            <>
              <Text style={[styles.amount, { color: theme.ink }]}>
                {Money.rupee(verification.amount, 2)}
              </Text>

              <Text style={[styles.line, { color: theme.inkMuted }]}>
                {verification.headcount > 1
                  ? `${verification.headcount} employees ki salary`
                  : 'Ek transfer'}
                {verification.action === 'schedule' ? ' schedule karne' : ' bhejne'} ke liye
              </Text>

              <Text style={[styles.line, { color: theme.inkMuted }]}>
                6 digit ka code <Text style={{ color: theme.ink, fontWeight: '800' }}>{verification.sent_to}</Text>{' '}
                par bheja gaya hai. Wahi daalo.
              </Text>

              <Field
                label="Code"
                value={code}
                onChangeText={(value) => setCode(value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="000000"
                keyboardType="number-pad"
                editable={!busy}
              />

              <Text style={[styles.small, { color: theme.inkSubtle }]}>
                {verification.minutes_left} minute tak chalega · {verification.tries_left} koshish bachi hai
              </Text>

              <Button
                label="Confirm and send"
                onPress={() => onSubmit(code.trim())}
                loading={busy}
                disabled={!ready || busy}
                fullWidth
              />

              <Button label="Naya code bhejo" variant="secondary" onPress={onResend} disabled={busy} fullWidth />

              <Text style={[styles.small, { color: theme.inkSubtle }]}>
                Code kisi ko mat batao. Iske bina paisa nahi jaayega.
              </Text>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: font.md,
    fontWeight: '800',
  },
  close: {
    fontSize: font.md,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  amount: {
    fontSize: font.xl,
    fontWeight: '800',
  },
  line: {
    fontSize: font.sm,
    paddingBottom: spacing.xs,
  },
  small: {
    fontSize: font.xs,
    paddingBottom: spacing.sm,
  },
})
