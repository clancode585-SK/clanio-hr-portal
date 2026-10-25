import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon, type IconName } from '@/components/ui/Icon'
import { useTheme, useThemeMode, type ThemeMode } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

const options: { mode: ThemeMode; label: string; icon: IconName }[] = [
  { mode: 'light', label: 'Light', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Dark', icon: 'moon-outline' },
]

/** Chhota dropdown — jagah nahi ghera, khulne par hi options dikhte hain */
export function ThemeSwitch() {
  const theme = useTheme()
  const { mode, setMode } = useThemeMode()
  const [open, setOpen] = useState(false)

  // Mode 'system' ho sakta hai — tab jo theme asli me chal raha hai wahi dikhana chahiye
  const current = options.find((option) => option.mode === theme.name) ?? options[0]

  return (
    <View style={styles.wrap}>
      {open ? (
        <View style={[styles.menu, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          {options.map((option) => {
            const active = mode === 'system' ? option.mode === theme.name : option.mode === mode

            return (
              <Pressable
                key={option.mode}
                onPress={() => {
                  setMode(option.mode)
                  setOpen(false)
                }}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: active || pressed ? theme.brandSoft : 'transparent' },
                ]}
              >
                <Icon name={option.icon} size={16} color={active ? theme.brand : theme.inkMuted} />
                <Text
                  style={[
                    styles.label,
                    { color: active ? theme.brand : theme.ink, fontWeight: active ? '700' : '500' },
                  ]}
                >
                  {option.label}
                </Text>
                {active ? <Icon name="checkmark" size={15} color={theme.brand} /> : null}
              </Pressable>
            )
          })}
        </View>
      ) : null}

      <Pressable
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [
          styles.trigger,
          { backgroundColor: pressed ? theme.canvas : 'transparent' },
        ]}
      >
        <Icon name={current.icon} size={16} color={theme.inkMuted} />
        <Text style={[styles.triggerLabel, { color: theme.inkMuted }]}>{current.label}</Text>
        <Icon name={open ? 'chevron-down' : 'chevron-up'} size={13} color={theme.inkSubtle} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  menu: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 4,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  label: {
    flex: 1,
    fontSize: font.sm,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 7,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  triggerLabel: {
    flex: 1,
    fontSize: font.xs,
    fontWeight: '600',
  },
})
