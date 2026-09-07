import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Props = {
  label: string
  value: boolean
  onChange: (value: boolean) => void
  hint?: string
  disabled?: boolean
}

export function Toggle({ label, value, onChange, hint, disabled = false }: Props) {
  const theme = useTheme()

  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      style={[
        styles.wrap,
        { backgroundColor: theme.surface, borderColor: value ? theme.brand : theme.line, opacity: disabled ? 0.6 : 1 },
      ]}
    >
      <View style={styles.text}>
        <Text style={[styles.label, { color: theme.ink }]}>{label}</Text>
        {hint ? <Text style={[styles.hint, { color: theme.inkSubtle }]}>{hint}</Text> : null}
      </View>

      <View style={[styles.track, { backgroundColor: value ? theme.brand : theme.line }]}>
        <View style={[styles.knob, { backgroundColor: theme.surface, alignSelf: value ? 'flex-end' : 'flex-start' }]} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: font.md,
    fontWeight: '600',
  },
  hint: {
    fontSize: font.xs,
  },
  track: {
    width: 44,
    height: 26,
    borderRadius: radius.pill,
    padding: 3,
    justifyContent: 'center',
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
})
