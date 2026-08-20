import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { ErrorState, Loader } from '@/components/ui/States'
import { api, ApiError } from '@/lib/api'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Today = {
  attendance_date: string
  status?: string
  is_checked_in: boolean
  can_check_in: boolean
  can_check_out: boolean
  first_check_in_at: string | null
  last_check_out_at: string | null
  worked_human?: string
  running_since?: string | null
}

export default function MyAttendanceScreen() {
  const theme = useTheme()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const load = useCallback(() => api<Today>('/attendance/today'), [])
  const today = useResource<Today>(load, [])

  const punch = async (direction: 'check-in' | 'check-out') => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(`/attendance/${direction}`, { method: 'POST' })
      await today.reload()
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not update attendance.')
    } finally {
      setBusy(false)
    }
  }

  if (today.loading) {
    return (
      <Screen title="My Attendance">
        <Loader />
      </Screen>
    )
  }

  if (today.error || !today.data) {
    return (
      <Screen title="My Attendance">
        <ErrorState message={today.error ?? 'Could not load attendance.'} onRetry={today.reload} />
      </Screen>
    )
  }

  const data = today.data

  return (
    <Screen title="My Attendance" subtitle={data.attendance_date}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={today.refreshing} onRefresh={today.refresh} tintColor={theme.brand} />
        }
      >
        {problem ? <Notice tone="danger" title="Failed" message={problem} /> : null}

        <View style={[styles.hero, { backgroundColor: data.is_checked_in ? theme.success : theme.brand }]}>
          <Text style={styles.heroEyebrow}>{data.is_checked_in ? 'Currently working' : 'Not checked in'}</Text>
          <Text style={styles.heroValue}>{data.worked_human ?? '0h 0m'}</Text>
          <Text style={styles.heroMeta}>{data.status ?? 'Today'}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Row label="First check in" value={formatTime(data.first_check_in_at)} />
          <Row label="Last check out" value={formatTime(data.last_check_out_at)} />
        </View>

        <View style={styles.actions}>
          {data.can_check_in ? (
            <Button label="Check in" onPress={() => punch('check-in')} loading={busy} fullWidth />
          ) : null}
          {data.can_check_out ? (
            <Button label="Check out" variant="secondary" onPress={() => punch('check-out')} loading={busy} fullWidth />
          ) : null}
          {!data.can_check_in && !data.can_check_out ? (
            <Notice tone="info" title="Done for today" message="No further punches are allowed right now." />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  )
}

function formatTime(value: string | null): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme()

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.inkMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.ink }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: 2,
  },
  heroEyebrow: {
    color: '#FFFFFF',
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  heroValue: {
    color: '#FFFFFF',
    fontSize: font.xxxl,
    fontWeight: '700',
    letterSpacing: -1,
  },
  heroMeta: {
    color: '#FFFFFF',
    fontSize: font.sm,
    opacity: 0.9,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  rowLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  rowValue: {
    fontSize: font.sm,
    fontWeight: '600',
  },
  actions: {
    gap: spacing.md,
  },
})
