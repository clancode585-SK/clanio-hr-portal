import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from './Icon'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

export type Option = {
  value: string
  label: string
  hint?: string
}

type Props = {
  label: string
  value: string | null
  options: Option[]
  onChange: (value: string | null) => void
  placeholder?: string
  error?: string | null
  allowClear?: boolean
  disabled?: boolean
}

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  error,
  allowClear = false,
  disabled = false,
}: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)

  const current = options.find((option) => option.value === value) ?? null

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.inkMuted }]}>{label}</Text>

      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.control,
          {
            backgroundColor: pressed ? theme.canvas : theme.surface,
            borderColor: error ? theme.danger : theme.line,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.value, { color: current ? theme.ink : theme.inkSubtle }]}
        >
          {current?.label ?? placeholder}
        </Text>
        <Text style={[styles.caret, { color: theme.inkSubtle }]}>⌄</Text>
      </Pressable>

      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <View style={[styles.sheetHead, { borderBottomColor: theme.line }]}>
            <Text style={[styles.sheetTitle, { color: theme.ink }]}>{label}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <Icon name="close" size={16} color={theme.inkMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.sheetBody}>
            {allowClear ? (
              <Pressable
                onPress={() => {
                  onChange(null)
                  setOpen(false)
                }}
                style={({ pressed }) => [styles.option, { backgroundColor: pressed ? theme.canvas : 'transparent' }]}
              >
                <Text style={[styles.optionLabel, { color: theme.inkMuted }]}>{placeholder}</Text>
                {value === null ? <Icon name="checkmark" size={16} color={theme.brand} /> : null}
              </Pressable>
            ) : null}

            {options.map((option) => {
              const active = option.value === value

              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: pressed ? theme.canvas : 'transparent' },
                  ]}
                >
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, { color: theme.ink, fontWeight: active ? '700' : '500' }]}>
                      {option.label}
                    </Text>
                    {option.hint ? (
                      <Text style={[styles.optionHint, { color: theme.inkSubtle }]}>{option.hint}</Text>
                    ) : null}
                  </View>
                  {active ? <Icon name="checkmark" size={16} color={theme.brand} /> : null}
                </Pressable>
              )
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  value: {
    flex: 1,
    fontSize: font.md,
  },
  caret: {
    fontSize: font.lg,
    fontWeight: '700',
  },
  error: {
    fontSize: font.sm,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: font.lg,
    fontWeight: '700',
  },
  sheetBody: {
    paddingHorizontal: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  optionText: {
    flex: 1,
    gap: 1,
  },
  optionLabel: {
    fontSize: font.md,
  },
  optionHint: {
    fontSize: font.xs,
  },
})
