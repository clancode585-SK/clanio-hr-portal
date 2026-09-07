import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ListRow } from '@/components/ui/ListRow'
import { Notice } from '@/components/ui/Notice'
import { Select, type Option } from '@/components/ui/Select'
import { ErrorState, Loader } from '@/components/ui/States'
import { api, apiList, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Balance = {
  leave_type_id?: number
  code?: string
  name?: string
  tracks_balance?: boolean
  annual_quota?: number
  year?: number
  opening?: number
  accrued?: number
  used?: number
  available?: number
}

type Request = Record<string, any>

type Loaded = {
  balances: Balance[]
  requests: Request[]
}

export default function MyLeaveScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { profile } = useAuth()
  const employeeId = profile?.employee?.id ?? null

  const [data, setData] = useState<Loaded | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [typeId, setTypeId] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState(today())
  const [toDate, setToDate] = useState(today())
  const [reason, setReason] = useState('')
  const [contact, setContact] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pull = useCallback(async (mode: 'load' | 'refresh') => {
    mode === 'load' ? setLoading(true) : setRefreshing(true)
    setError(null)

    try {
      const [balanceResult, requestResult] = await Promise.all([
        api<Balance[] | { balances?: Balance[] }>('/leaves/my-balance'),
        apiList<Request>('/leaves?per_page=100'),
      ])

      setData({
        balances: Array.isArray(balanceResult) ? balanceResult : (balanceResult.balances ?? []),
        requests: employeeId === null
          ? requestResult.data
          : requestResult.data.filter((row) => Number(row.employee_id) === employeeId),
      })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load leave.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [employeeId])

  useFocusEffect(
    useCallback(() => {
      void pull(data === null ? 'load' : 'refresh')
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employeeId])
  )

  const typeOptions = useMemo<Option[]>(
    () =>
      (data?.balances ?? [])
        .filter((row) => row.leave_type_id != null)
        .map((row) => ({
          value: String(row.leave_type_id),
          label: row.name ?? row.code ?? 'Leave',
          hint: row.tracks_balance === false ? 'No balance tracked' : `${row.available ?? 0} available`,
        })),
    [data]
  )

  const reset = () => {
    setTypeId(null)
    setFromDate(today())
    setToDate(today())
    setReason('')
    setContact('')
    setErrors({})
    setProblem(null)
  }

  const apply = async () => {
    if (busy) {
      return
    }

    const next: Record<string, string> = {}

    if (!typeId) {
      next.leave_type_id = 'Pick a leave type'
    }

    if (reason.trim().length < 3) {
      next.reason = 'Write a short reason'
    }

    setErrors(next)

    if (Object.keys(next).length > 0) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api('/leaves', {
        method: 'POST',
        body: {
          leave_type_id: Number(typeId),
          from_date: fromDate.trim(),
          to_date: toDate.trim(),
          reason: reason.trim(),
          contact_number: contact.trim() || null,
        },
      })

      setOpen(false)
      reset()
      await pull('refresh')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 422 && Object.keys(caught.fields).length > 0) {
        const mapped: Record<string, string> = {}

        for (const [field, messages] of Object.entries(caught.fields)) {
          mapped[field] = messages[0]
        }

        setErrors(mapped)
        setProblem('Check the highlighted fields.')
      } else {
        setProblem(caught instanceof ApiError ? caught.message : 'Could not apply.')
      }
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (item: Request) => {
    try {
      await api(`/leaves/${item.uuid ?? item.id}`, { method: 'DELETE' })
      await pull('refresh')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not cancel.')
    }
  }

  if (loading) {
    return (
      <Screen title="My Leave">
        <Loader />
      </Screen>
    )
  }

  if (error && !data) {
    return (
      <Screen title="My Leave">
        <ErrorState message={error} onRetry={() => pull('load')} />
      </Screen>
    )
  }

  const balances = data?.balances ?? []
  const requests = data?.requests ?? []

  return (
    <Screen title="My Leave" action={{ label: 'Apply', onPress: () => setOpen(true) }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => pull('refresh')} tintColor={theme.brand} />}
      >
        {error ? <Notice tone="danger" title="Something went wrong" message={error} /> : null}

        <Text style={[styles.group, { color: theme.inkSubtle }]}>Balance</Text>

        <View style={styles.cards}>
          {balances.map((row, index) => (
            <View
              key={`${row.leave_type_id ?? index}`}
              style={[styles.balance, { backgroundColor: theme.surface, borderColor: theme.line }]}
            >
              <Text style={[styles.available, { color: theme.brand }]}>
                {row.tracks_balance === false ? '—' : (row.available ?? 0)}
              </Text>
              <Text style={[styles.balanceName, { color: theme.ink }]}>{row.name ?? row.code ?? 'Leave'}</Text>
              <Text style={[styles.balanceMeta, { color: theme.inkSubtle }]}>
                {row.tracks_balance === false
                  ? 'Not counted against a quota'
                  : `${row.used ?? 0} used of ${(row.opening ?? 0) + (row.accrued ?? 0)}`}
              </Text>
            </View>
          ))}

          {balances.length === 0 ? (
            <Notice tone="info" title="No balance" message="No leave types have been set up for you yet." />
          ) : null}
        </View>

        <Text style={[styles.group, { color: theme.inkSubtle }]}>My requests</Text>

        {requests.length === 0 ? (
          <Notice tone="info" title="Nothing applied" message="Your leave requests will show up here." />
        ) : (
          requests.map((item) => (
            <ListRow
              key={String(item.uuid ?? item.id)}
              title={item.leave_type?.name ?? 'Leave'}
              subtitle={`${item.from_date} to ${item.to_date} · ${item.day_count ?? 0} day(s)`}
              badge={item.status}
              meta={item.can_cancel ? 'Cancel' : undefined}
              onPress={item.can_cancel ? () => cancel(item) : undefined}
            />
          ))
        )}
      </ScrollView>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={[styles.grab, { backgroundColor: theme.line }]} />

            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>Apply for leave</Text>

              {problem ? <Notice tone="danger" title="Could not apply" message={problem} /> : null}

              <View style={styles.form}>
                <Select
                  label="Leave type"
                  value={typeId}
                  options={typeOptions}
                  onChange={setTypeId}
                  placeholder="Select type"
                  error={errors.leave_type_id}
                  disabled={busy}
                />
                <Field
                  label="From"
                  value={fromDate}
                  onChangeText={setFromDate}
                  placeholder="YYYY-MM-DD"
                  error={errors.from_date}
                  editable={!busy}
                />
                <Field
                  label="To"
                  value={toDate}
                  onChangeText={setToDate}
                  placeholder="YYYY-MM-DD"
                  error={errors.to_date}
                  editable={!busy}
                />
                <Field
                  label="Reason"
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Why do you need this leave"
                  autoCapitalize="sentences"
                  error={errors.reason}
                  editable={!busy}
                  multiline
                />
                <Field
                  label="Contact number"
                  value={contact}
                  onChangeText={setContact}
                  placeholder="Optional"
                  keyboardType="phone-pad"
                  error={errors.contact_number}
                  editable={!busy}
                />

                <Button label="Send request" onPress={apply} loading={busy} fullWidth />
                <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} disabled={busy} fullWidth />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  )
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
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
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  balance: {
    flexGrow: 1,
    flexBasis: '46%',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 1,
  },
  available: {
    fontSize: font.xxl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  balanceName: {
    fontSize: font.sm,
    fontWeight: '600',
  },
  balanceMeta: {
    fontSize: font.xs,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
  },
  grab: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  sheetBody: {
    paddingHorizontal: spacing.xl,
  },
  sheetTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
})
