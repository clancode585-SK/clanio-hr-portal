import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '@/theme/useTheme'
import { font, spacing } from '@/theme/tokens'

type Props = {
  steps: string[]
  current: number
}

export function Stepper({ steps, current }: Props) {
  const theme = useTheme()

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        {steps.map((step, index) => {
          const done = index < current
          const active = index === current

          return (
            <View key={step} style={styles.segment}>
              <View
                style={[
                  styles.bar,
                  { backgroundColor: done || active ? theme.brand : theme.line },
                ]}
              />
            </View>
          )
        })}
      </View>

      <View style={styles.labels}>
        <Text style={[styles.step, { color: theme.brand }]}>
          Step {current + 1} of {steps.length}
        </Text>
        <Text style={[styles.name, { color: theme.ink }]}>{steps[current]}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  track: {
    flexDirection: 'row',
    gap: 5,
  },
  segment: {
    flex: 1,
  },
  bar: {
    height: 3,
    borderRadius: 2,
  },
  labels: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  step: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: font.md,
    fontWeight: '700',
  },
})
