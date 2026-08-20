import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Tone = 'danger' | 'warning' | 'success' | 'info'

type Props = {
  tone: Tone
  title?: string
  message: string
}

export function Notice({ tone, title, message }: Props) {
  const theme = useTheme()

  const background = {
    danger: theme.dangerSoft,
    warning: theme.warningSoft,
    success: theme.successSoft,
    info: theme.infoSoft,
  }[tone]

  const accent = {
    danger: theme.danger,
    warning: theme.warning,
    success: theme.success,
    info: theme.info,
  }[tone]

  return (
    <View style={[styles.wrap, { backgroundColor: background, borderColor: accent }]}>
      {title ? <Text style={[styles.title, { color: accent }]}>{title}</Text> : null}
      <Text style={[styles.message, { color: theme.ink }]}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: 3,
  },
  title: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  message: {
    fontSize: font.sm,
    lineHeight: 20,
  },
})
