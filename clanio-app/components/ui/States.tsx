import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Button } from './Button'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

export function Loader() {
  const theme = useTheme()

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={theme.brand} />
    </View>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const theme = useTheme()

  return (
    <View style={styles.center}>
      <View style={[styles.badge, { backgroundColor: theme.dangerSoft }]}>
        <Text style={[styles.badgeText, { color: theme.danger }]}>!</Text>
      </View>
      <Text style={[styles.title, { color: theme.ink }]}>Could not load</Text>
      <Text style={[styles.message, { color: theme.inkMuted }]}>{message}</Text>
      <Button label="Retry" variant="secondary" size="sm" onPress={onRetry} />
    </View>
  )
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string
  message: string
  action?: { label: string; onPress: () => void }
}) {
  const theme = useTheme()

  return (
    <View style={styles.center}>
      <View style={[styles.badge, { backgroundColor: theme.brandSoft }]}>
        <Text style={[styles.badgeText, { color: theme.brand }]}>◦</Text>
      </View>
      <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
      <Text style={[styles.message, { color: theme.inkMuted }]}>{message}</Text>
      {action ? <Button label={action.label} size="sm" onPress={action.onPress} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: font.xxl,
    fontWeight: '800',
  },
  title: {
    fontSize: font.lg,
    fontWeight: '700',
  },
  message: {
    fontSize: font.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
})
