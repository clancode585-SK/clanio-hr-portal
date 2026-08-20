import type { ReactNode } from 'react'
import { useNavigation, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from '@/components/ui/Icon'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Props = {
  title: string
  subtitle?: string
  leading?: 'menu' | 'back'
  action?: { label: string; onPress: () => void }
  children: ReactNode
}

export function Screen({ title, subtitle, leading = 'menu', action, children }: Props) {
  const theme = useTheme()
  const router = useRouter()
  const navigation = useNavigation<{ openDrawer: () => void }>()
  const insets = useSafeAreaInsets()

  const onLeading = () => {
    if (leading === 'back') {
      router.back()

      return
    }

    navigation.openDrawer()
  }

  return (
    <View style={[styles.wrap, { backgroundColor: theme.canvas }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.sm, backgroundColor: theme.surface, borderBottomColor: theme.line },
        ]}
      >
        <Pressable onPress={onLeading} hitSlop={10} style={[styles.iconButton, { backgroundColor: theme.canvas }]}>
          <Icon name={leading === 'back' ? 'chevron-back' : 'menu-outline'} size={leading === 'back' ? 24 : 18} color={theme.ink} />
        </Pressable>

        <View style={styles.titles}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.ink }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={[styles.subtitle, { color: theme.inkSubtle }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {action ? (
          <Pressable
            onPress={action.onPress}
            style={({ pressed }) => [styles.action, { backgroundColor: theme.brand, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.actionLabel, { color: theme.onBrand }]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: {
    flex: 1,
  },
  title: {
    fontSize: font.xl,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: font.xs,
    marginTop: 1,
  },
  action: {
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  actionLabel: {
    fontSize: font.sm,
    fontWeight: '700',
  },
  body: {
    flex: 1,
  },
})
