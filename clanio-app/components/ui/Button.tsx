import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'sm'

type Props = {
  label: string
  onPress?: () => void
  variant?: Variant
  size?: Size
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  style?: ViewStyle
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: Props) {
  const theme = useTheme()
  const inactive = disabled || loading

  const background = {
    primary: theme.brand,
    secondary: theme.surface,
    ghost: 'transparent',
    danger: theme.danger,
  }[variant]

  const color = {
    primary: theme.onBrand,
    secondary: theme.ink,
    ghost: theme.brand,
    danger: '#FFFFFF',
  }[variant]

  const border = variant === 'secondary' ? theme.line : 'transparent'

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        {
          backgroundColor: background,
          borderColor: border,
          opacity: inactive ? 0.55 : pressed ? 0.85 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <Text style={[styles.label, { color, fontSize: size === 'sm' ? font.sm : font.md }]}>{label}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  md: {
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
  },
  sm: {
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
})
