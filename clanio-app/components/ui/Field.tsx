import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Props = {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  error?: string | null
  secure?: boolean
  keyboardType?: KeyboardTypeOptions
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  editable?: boolean
  multiline?: boolean
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secure = false,
  keyboardType,
  autoCapitalize = 'none',
  editable = true,
  multiline = false,
}: Props) {
  const theme = useTheme()
  const [focused, setFocused] = useState(false)
  const [reveal, setReveal] = useState(false)

  const borderColor = error ? theme.danger : focused ? theme.brand : theme.line

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.inkMuted }]}>{label}</Text>

      <View style={[styles.inputWrap, { borderColor, backgroundColor: theme.surface }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.inkSubtle}
          secureTextEntry={secure && !reveal}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={editable}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            { color: theme.ink, height: multiline ? 96 : undefined, textAlignVertical: multiline ? 'top' : 'center' },
          ]}
        />

        {secure ? (
          <Pressable onPress={() => setReveal((current) => !current)} hitSlop={10} style={styles.reveal}>
            <Text style={[styles.revealText, { color: theme.brand }]}>{reveal ? 'HIDE' : 'SHOW'}</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: font.md,
  },
  reveal: {
    paddingLeft: spacing.md,
  },
  revealText: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  error: {
    fontSize: font.sm,
  },
})
