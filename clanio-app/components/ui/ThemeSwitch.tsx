import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon, type IconName } from '@/components/ui/Icon'
import { useTheme, useThemeMode, type ThemeMode } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

const options: { mode: ThemeMode; label: string; icon: IconName }[] = [
  { mode: 'light', label: 'Light', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Dark', icon: 'moon-outline' },
  { mode: 'system', label: 'System', icon: 'phone-portrait-outline' },
]

export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const theme = useTheme()
  const { mode, setMode } = useThemeMode()

  return (
    <View style={[styles.wrap, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
      {options.map((option) => {
        const active = option.mode === mode

        return (
          <Pressable
            key={option.mode}
            onPress={() => setMode(option.mode)}
            style={[styles.option, { backgroundColor: active ? theme.surface : 'transparent' }]}
          >
            <Icon name={option.icon} size={15} color={active ? theme.brand : theme.inkMuted} />
            {compact ? null : (
              <Text
                style={[
                  styles.label,
                  { color: active ? theme.brand : theme.inkMuted, fontWeight: active ? '700' : '500' },
                ]}
              >
                {option.label}
              </Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  label: {
    fontSize: font.sm,
  },
})
