import { useCallback } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { ErrorState, Loader } from '@/components/ui/States'
import { api } from '@/lib/api'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Settings = {
  company_id: number
  name: string
  slug: string
  status: string
  settings: Record<string, string | number | boolean>
  meaning: Record<string, string>
}

const labels: Record<string, string> = {
  sod_cutoff: 'SOD cutoff',
  eod_cutoff: 'EOD cutoff',
  regularization_days: 'Regularization window',
  expense_claim_days: 'Expense claim window',
  notice_period_days: 'Notice period',
  policy_gate_enabled: 'Policy gate',
  ticket_sla_enabled: 'Ticket SLA',
  fiscal_year_start: 'Fiscal year starts',
  timezone: 'Timezone',
  currency: 'Currency',
}

export default function CompanySettingsScreen() {
  const theme = useTheme()
  const load = useCallback(() => api<Settings>('/company-settings'), [])
  const record = useResource<Settings>(load, [])

  if (record.loading) {
    return (
      <Screen title="Company Settings">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Company Settings">
        <ErrorState message={record.error ?? 'Could not load settings.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const { name, slug, status, settings, meaning } = record.data

  return (
    <Screen title="Company Settings" subtitle={name}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.company, { color: theme.ink }]}>{name}</Text>
          <Text style={[styles.slug, { color: theme.inkSubtle }]}>
            {slug} · {status}
          </Text>
        </View>

        {Object.entries(settings).map(([key, value]) => (
          <View key={key} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <View style={styles.head}>
              <Text style={[styles.label, { color: theme.ink }]}>{labels[key] ?? key}</Text>
              <Text style={[styles.value, { color: theme.brand }]}>{format(value)}</Text>
            </View>
            {meaning[key] ? <Text style={[styles.meaning, { color: theme.inkMuted }]}>{meaning[key]}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </Screen>
  )
}

function format(value: string | number | boolean): string {
  if (typeof value === 'boolean') {
    return value ? 'On' : 'Off'
  }

  return String(value)
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
  },
  company: {
    fontSize: font.lg,
    fontWeight: '700',
  },
  slug: {
    fontSize: font.xs,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  label: {
    fontSize: font.md,
    fontWeight: '600',
    flexShrink: 1,
  },
  value: {
    fontSize: font.md,
    fontWeight: '700',
  },
  meaning: {
    fontSize: font.sm,
    lineHeight: 19,
  },
})
