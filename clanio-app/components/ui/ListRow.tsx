import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from './Icon'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Props = {
  title: string
  subtitle?: string
  badge?: string
  meta?: string
  onPress?: () => void
}

export function ListRow({ title, subtitle, badge, meta, onPress }: Props) {
  const theme = useTheme()

  const initials = title
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.canvas : theme.surface,
          borderColor: theme.line,
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: theme.brandSoft }]}>
        <Text style={[styles.avatarText, { color: theme.brand }]}>{initials || '?'}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.ink }]}>
            {title}
          </Text>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
              <Text style={[styles.badgeText, { color: theme.inkMuted }]}>{badge}</Text>
            </View>
          ) : null}
        </View>

        {subtitle ? (
          <Text numberOfLines={1} style={[styles.subtitle, { color: theme.inkMuted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {meta ? <Text style={[styles.meta, { color: theme.inkSubtle }]}>{meta}</Text> : null}

      {onPress ? <Icon name="chevron-forward" size={22} color={theme.inkSubtle} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: font.sm,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: font.md,
    fontWeight: '600',
    flexShrink: 1,
  },
  subtitle: {
    fontSize: font.sm,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  meta: {
    fontSize: font.xs,
    fontWeight: '600',
  },
})
