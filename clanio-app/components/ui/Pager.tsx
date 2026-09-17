import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Props = {
  page: number
  lastPage: number
  total: number
  perPage: number
  busy?: boolean
  onChange: (page: number) => void
}

export function Pager({ page, lastPage, total, perPage, busy = false, onChange }: Props) {
  const theme = useTheme()

  if (lastPage <= 1) {
    return null
  }

  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <Step label="‹ Back" disabled={busy || page <= 1} onPress={() => onChange(page - 1)} />

      <View style={styles.middle}>
        <Text style={[styles.page, { color: theme.ink }]}>
          Page {page} of {lastPage}
        </Text>
        <Text style={[styles.range, { color: theme.inkSubtle }]}>
          {from}–{to} of {total}
        </Text>
      </View>

      <Step label="Next ›" disabled={busy || page >= lastPage} onPress={() => onChange(page + 1)} />
    </View>
  )
}

function Step({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  const theme = useTheme()

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        {
          backgroundColor: pressed && !disabled ? theme.canvas : 'transparent',
          borderColor: disabled ? theme.line : theme.brand,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Text style={[styles.stepText, { color: disabled ? theme.inkSubtle : theme.brand }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  middle: {
    alignItems: 'center',
    gap: 2,
  },
  page: {
    fontSize: font.sm,
    fontWeight: '700',
  },
  range: {
    fontSize: font.xs,
  },
  step: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  stepText: {
    fontSize: font.xs,
    fontWeight: '800',
  },
})
