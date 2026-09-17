import { useCallback, useState } from 'react'
import { useRouter } from 'expo-router'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Pager } from '@/components/ui/Pager'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { ApiError, api, apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatDate } from '@/lib/clock'
import { Money } from '@/lib/money'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Settlement = Record<string, any>
type Waiting = Record<string, any>

type PageMeta = {
  current_page: number
  per_page: number
  total: number
  last_page: number
}

type Loaded = {
  settlements: Settlement[]
  page: PageMeta | null
  waiting: Waiting[]
}

const PER_PAGE = 25

export default function FnfScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { can } = useAuth()

  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const load = useCallback(async (): Promise<Loaded> => {
    const settlements = await apiList<Settlement>(`/fnf-settlements?per_page=${PER_PAGE}&page=${page}`)
    const waiting = await api<Waiting[]>('/fnf-settlements/pending-exits')

    return { settlements: settlements.data, page: (settlements.meta as PageMeta) ?? null, waiting }
  }, [page])

  const record = useResource<Loaded>(load, [page])

  const canManage = can('fnf.manage')
  const canApprove = can('fnf.approve')

  const approveAll = async (uuids: string[]) => {
    if (busy) {
      return
    }

    setBusy('bulk')
    setProblem(null)
    setDone(null)

    try {
      const result = await api<Record<string, any>>('/fnf-settlements/bulk-approve', {
        method: 'POST',
        body: { uuids },
      })

      const left = (result.skipped ?? []).length

      setDone(
        `${result.approved} settlement approve ho gaye (${Money.rupee(result.approved_amount)})`
        + (left > 0 ? ` · ${left} chhod diye` : '')
      )

      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not approve them.')
    } finally {
      setBusy(null)
    }
  }

  const build = async (exit: Waiting) => {
    if (busy) {
      return
    }

    setBusy(exit.exit_uuid)
    setProblem(null)

    try {
      const made = await api<Settlement>('/fnf-settlements', {
        method: 'POST',
        body: { exit_uuid: exit.exit_uuid },
      })

      await record.refresh()
      router.push(`/fnf/${made.uuid}` as never)
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not build the settlement.')
    } finally {
      setBusy(null)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Full & Final">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Full & Final">
        <ErrorState message={record.error ?? 'Could not load settlements.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const { settlements, page: pageMeta, waiting } = record.data
  const readyToApprove = settlements.filter((row) => row.status === 'calculated' && !row.is_stopped)

  return (
    <Screen
      title="Full & Final"
      subtitle={`${pageMeta?.total ?? settlements.length} settlement${(pageMeta?.total ?? settlements.length) === 1 ? '' : 's'}`}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {done ? <Notice tone="success" title="Done" message={done} /> : null}
        {problem ? <Notice tone="danger" title="Could not do that" message={problem} /> : null}

        {canApprove && readyToApprove.length > 0 ? (
          <>
            <Button
              label={`Approve ${readyToApprove.length} settlement${readyToApprove.length === 1 ? '' : 's'} in one go`}
              onPress={() => void approveAll(readyToApprove.map((row) => row.uuid))}
              loading={busy === 'bulk'}
              fullWidth
            />
            <Text style={[styles.cta, { color: theme.inkSubtle }]}>
              Jinko stop kiya hai wo chhoot jaayenge.
            </Text>
          </>
        ) : null}

        {waiting.length > 0 ? (
          <>
            <Text style={[styles.section, { color: theme.inkMuted }]}>Settlement banna baaki hai</Text>

            {waiting.map((exit) => (
              <Pressable
                key={exit.exit_uuid}
                disabled={!canManage || busy !== null}
                onPress={() => void build(exit)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: pressed ? theme.canvas : theme.surface, borderColor: theme.line },
                ]}
              >
                <View style={styles.head}>
                  <Text numberOfLines={1} style={[styles.name, { color: theme.ink }]}>
                    {exit.employee_name ?? exit.employee_code}
                  </Text>
                  <View style={[styles.tag, { backgroundColor: exit.is_ready ? theme.infoSoft : theme.warningSoft }]}>
                    <Text style={[styles.tagText, { color: exit.is_ready ? theme.info : theme.warning }]}>
                      {exit.is_ready ? 'Ready' : 'On notice'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.meta, { color: theme.inkMuted }]}>
                  {exit.employee_code} · last day {formatDate(exit.last_working_date)}
                </Text>

                <Text style={[styles.cta, { color: canManage ? theme.brand : theme.inkSubtle }]}>
                  {canManage ? 'Tap karke hisaab banao' : 'HR hisaab banayegi'}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}

        {settlements.length > 0 ? (
          <Text style={[styles.section, { color: theme.inkMuted }]}>Settlements</Text>
        ) : null}

        {settlements.map((row) => (
          <Pressable
            key={row.uuid}
            onPress={() => router.push(`/fnf/${row.uuid}` as never)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: pressed ? theme.canvas : theme.surface, borderColor: theme.line },
            ]}
          >
            <View style={styles.head}>
              <Text numberOfLines={1} style={[styles.name, { color: theme.ink }]}>
                {row.employee_name}
              </Text>
              <View style={[styles.tag, { backgroundColor: soft(theme, row) }]}>
                <Text style={[styles.tagText, { color: ink(theme, row) }]}>{row.status_label}</Text>
              </View>
            </View>

            <Text style={[styles.meta, { color: theme.inkMuted }]}>
              {row.employee_code} · last day {formatDate(row.last_working_date)}
            </Text>

            <View style={styles.numbers}>
              <Text style={[styles.net, { color: row.owes_company ? theme.danger : theme.ink }]}>
                {row.owes_company ? '−' : ''}
                {Money.rupee(Math.abs(Number(row.net_payable)))}
              </Text>
              <Text style={[styles.days, { color: theme.inkSubtle }]}>{row.payment_label}</Text>
            </View>

            {row.is_editable && Number(row.suggestions_pending) > 0 ? (
              <Text style={[styles.flag, { color: theme.warning }]}>
                {row.suggestions_pending} sujhaav review karne hain
              </Text>
            ) : null}

            {row.is_stopped ? (
              <Text style={[styles.flag, { color: theme.danger }]}>
                Stopped{row.hold_reason ? ` — ${row.hold_reason}` : ''}
              </Text>
            ) : null}
          </Pressable>
        ))}

        {pageMeta ? (
          <Pager
            page={pageMeta.current_page}
            lastPage={pageMeta.last_page}
            total={pageMeta.total}
            perPage={pageMeta.per_page}
            busy={record.refreshing || busy !== null}
            onChange={setPage}
          />
        ) : null}

        {settlements.length === 0 && waiting.length === 0 ? (
          <EmptyState
            title="Kuch pending nahi"
            message="Jab kisi ka exit approve hoga, uska full and final yahan aayega."
          />
        ) : null}
      </ScrollView>
    </Screen>
  )
}

function soft(theme: ReturnType<typeof useTheme>, row: Settlement): string {
  if (row.owes_company) {
    return theme.dangerSoft
  }

  return row.status === 'settled'
    ? theme.successSoft
    : row.status === 'approved'
      ? theme.infoSoft
      : row.status === 'cancelled'
        ? theme.dangerSoft
        : theme.warningSoft
}

function ink(theme: ReturnType<typeof useTheme>, row: Settlement): string {
  if (row.owes_company) {
    return theme.danger
  }

  return row.status === 'settled'
    ? theme.success
    : row.status === 'approved'
      ? theme.info
      : row.status === 'cancelled'
        ? theme.danger
        : theme.warning
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  section: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flexShrink: 1,
    fontSize: font.md,
    fontWeight: '700',
  },
  tag: {
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  meta: {
    fontSize: font.xs,
  },
  numbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: 4,
  },
  net: {
    fontSize: font.lg,
    fontWeight: '800',
  },
  days: {
    fontSize: font.xs,
    fontWeight: '600',
  },
  flag: {
    fontSize: font.xs,
    fontWeight: '700',
    paddingTop: 2,
  },
  cta: {
    fontSize: font.xs,
    fontWeight: '700',
    paddingTop: 4,
  },
})
