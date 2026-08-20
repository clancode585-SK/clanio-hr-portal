import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from '@/components/ui/Icon'
import type { PermissionModule } from '@/lib/types'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Mark = 'on' | 'off' | 'partial'

type Props = {
  modules: PermissionModule[]
  selected: Set<string>
  locked?: Set<string>
  onToggle: (slug: string) => void
  onToggleMany: (slugs: string[], next: boolean) => void
  readOnly?: boolean
}

function moduleLabel(key: string): string {
  return key
    .split('_')
    .map((part) => (part === 'hr' ? 'HR' : part === 'it' ? 'IT' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ')
}

export function PermissionPicker({
  modules,
  selected,
  locked,
  onToggle,
  onToggleMany,
  readOnly = false,
}: Props) {
  const theme = useTheme()
  const [open, setOpen] = useState<Set<string>>(new Set())

  const assignable = useMemo(
    () =>
      modules.map((entry) => ({
        ...entry,
        permissions: entry.permissions.filter((permission) => permission.can_assign),
      })),
    [modules]
  )

  const allSlugs = useMemo(
    () => assignable.flatMap((entry) => entry.permissions.map((permission) => permission.slug)),
    [assignable]
  )

  const totalSelected = allSlugs.filter((slug) => selected.has(slug)).length
  const everything: Mark = totalSelected === 0 ? 'off' : totalSelected === allSlugs.length ? 'on' : 'partial'

  const toggleOpen = (key: string) => {
    setOpen((current) => {
      const next = new Set(current)

      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }

      return next
    })
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        disabled={readOnly}
        onPress={() => onToggleMany(allSlugs, everything !== 'on')}
        style={({ pressed }) => [
          styles.selectAll,
          {
            backgroundColor: pressed ? theme.canvas : theme.surface,
            borderColor: everything === 'off' ? theme.line : theme.brand,
            opacity: readOnly ? 0.6 : 1,
          },
        ]}
      >
        <Box mark={everything} disabled={readOnly} />
        <View style={styles.selectAllText}>
          <Text style={[styles.selectAllTitle, { color: theme.ink }]}>Select all modules</Text>
          <Text style={[styles.selectAllMeta, { color: theme.inkMuted }]}>
            {totalSelected} of {allSlugs.length} permissions
          </Text>
        </View>
      </Pressable>

      {assignable.map((entry) => {
        const slugs = entry.permissions.map((permission) => permission.slug)
        const count = slugs.filter((slug) => selected.has(slug)).length
        const mark: Mark = count === 0 ? 'off' : count === slugs.length ? 'on' : 'partial'
        const expanded = open.has(entry.module)
        const disabled = readOnly || !entry.is_enabled

        if (slugs.length === 0) {
          return null
        }

        return (
          <View
            key={entry.module}
            style={[
              styles.module,
              { backgroundColor: theme.surface, borderColor: mark === 'off' ? theme.line : theme.brand },
            ]}
          >
            <View style={styles.moduleHead}>
              <Pressable
                disabled={disabled}
                onPress={() => onToggleMany(slugs, mark !== 'on')}
                hitSlop={6}
                style={{ opacity: disabled ? 0.5 : 1 }}
              >
                <Box mark={mark} disabled={disabled} />
              </Pressable>

              <Pressable style={styles.moduleTitleArea} onPress={() => toggleOpen(entry.module)}>
                <View style={styles.moduleTitleRow}>
                  <Text style={[styles.moduleTitle, { color: theme.ink }]}>{moduleLabel(entry.module)}</Text>
                  {!entry.is_enabled ? (
                    <View style={[styles.tag, { backgroundColor: theme.warningSoft }]}>
                      <Text style={[styles.tagText, { color: theme.warning }]}>OFF</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.moduleMeta, { color: theme.inkMuted }]}>
                  {count} / {slugs.length} selected
                </Text>
              </Pressable>

              <Pressable onPress={() => toggleOpen(entry.module)} hitSlop={10} style={styles.chevron}>
                <Text style={[styles.chevronText, { color: theme.inkSubtle }]}>{expanded ? '⌃' : '⌄'}</Text>
              </Pressable>
            </View>

            {expanded ? (
              <View style={[styles.children, { borderTopColor: theme.line }]}>
                {entry.permissions.map((permission) => {
                  const isLocked = locked?.has(permission.slug) ?? false
                  const checked = selected.has(permission.slug)

                  return (
                    <Pressable
                      key={permission.slug}
                      disabled={disabled || isLocked}
                      onPress={() => onToggle(permission.slug)}
                      style={({ pressed }) => [
                        styles.child,
                        {
                          backgroundColor: pressed ? theme.canvas : 'transparent',
                          opacity: disabled || isLocked ? 0.55 : 1,
                        },
                      ]}
                    >
                      <Box mark={checked ? 'on' : 'off'} disabled={disabled || isLocked} />
                      <View style={styles.childText}>
                        <Text style={[styles.childTitle, { color: theme.ink }]}>{permission.name}</Text>
                        <Text style={[styles.childSlug, { color: theme.inkSubtle }]}>{permission.slug}</Text>
                      </View>
                      {isLocked ? <Icon name="lock-closed" size={13} color={theme.inkSubtle} /> : null}
                    </Pressable>
                  )
                })}
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

function Box({ mark, disabled }: { mark: Mark; disabled?: boolean }) {
  const theme = useTheme()

  const background = mark === 'off' ? 'transparent' : theme.brand
  const border = mark === 'off' ? theme.line : theme.brand

  return (
    <View
      style={[
        styles.box,
        { backgroundColor: background, borderColor: border, opacity: disabled ? 0.6 : 1 },
      ]}
    >
      {mark === 'on' ? <Text style={[styles.boxMark, { color: theme.onBrand }]}>✓</Text> : null}
      {mark === 'partial' ? <View style={[styles.dash, { backgroundColor: theme.onBrand }]} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  selectAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  selectAllText: {
    flex: 1,
    gap: 1,
  },
  selectAllTitle: {
    fontSize: font.md,
    fontWeight: '700',
  },
  selectAllMeta: {
    fontSize: font.xs,
  },
  module: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  moduleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  moduleTitleArea: {
    flex: 1,
    gap: 1,
  },
  moduleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  moduleTitle: {
    fontSize: font.md,
    fontWeight: '600',
  },
  moduleMeta: {
    fontSize: font.xs,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chevron: {
    paddingHorizontal: spacing.xs,
  },
  chevronText: {
    fontSize: font.lg,
    fontWeight: '700',
  },
  children: {
    borderTopWidth: 1,
    paddingVertical: spacing.xs,
  },
  child: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    paddingLeft: 46,
  },
  childText: {
    flex: 1,
    gap: 1,
  },
  childTitle: {
    fontSize: font.sm,
    fontWeight: '500',
  },
  childSlug: {
    fontSize: font.xs,
    fontVariant: ['tabular-nums'],
  },
  box: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxMark: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 16,
  },
  dash: {
    width: 10,
    height: 2,
    borderRadius: 1,
  },
})
