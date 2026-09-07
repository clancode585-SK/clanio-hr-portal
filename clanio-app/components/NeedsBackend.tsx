import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Notice } from '@/components/ui/Notice'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Props = {
  title: string
  subtitle: string
  summary: string
  table: { name: string; columns: string[] }
  endpoints: string[]
  screenPlan: string[]
}

export function NeedsBackend({ title, subtitle, summary, table, endpoints, screenPlan }: Props) {
  const theme = useTheme()

  return (
    <Screen title={title} subtitle={subtitle}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Notice tone="warning" title="Waiting on the backend" message={summary} />

        <Text style={[styles.group, { color: theme.inkSubtle }]}>Table to create</Text>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.tableName, { color: theme.brand }]}>{table.name}</Text>

          <View style={styles.columns}>
            {table.columns.map((column) => (
              <View key={column} style={[styles.column, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
                <Text style={[styles.columnText, { color: theme.ink }]}>{column}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={[styles.group, { color: theme.inkSubtle }]}>Endpoints to add</Text>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          {endpoints.map((endpoint) => (
            <Text key={endpoint} style={[styles.endpoint, { color: theme.ink }]}>
              {endpoint}
            </Text>
          ))}
        </View>

        <Text style={[styles.group, { color: theme.inkSubtle }]}>What this screen will do</Text>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          {screenPlan.map((line) => (
            <View key={line} style={styles.bullet}>
              <View style={[styles.dot, { backgroundColor: theme.brand }]} />
              <Text style={[styles.bulletText, { color: theme.ink }]}>{line}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  group: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  tableName: {
    fontSize: font.md,
    fontWeight: '800',
  },
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  column: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  columnText: {
    fontSize: font.xs,
    fontWeight: '600',
  },
  endpoint: {
    fontSize: font.sm,
    fontWeight: '600',
    paddingVertical: 3,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: font.sm,
    lineHeight: 20,
  },
})
