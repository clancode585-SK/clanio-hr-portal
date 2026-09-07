import { useCallback, useState } from 'react'
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
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { api, apiList, ApiError } from '@/lib/api'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Row = Record<string, any>

const statuses: Option[] = [
  { value: 'cleared', label: 'Cleared', hint: 'Nothing pending from this desk' },
  { value: 'blocked', label: 'Blocked', hint: 'Something is still outstanding' },
  { value: 'not_applicable', label: 'Not applicable', hint: 'Does not apply to this person' },
]

export default function ClearanceScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  const [signing, setSigning] = useState<Row | null>(null)
  const [status, setStatus] = useState<string | null>('cleared')
  const [remarks, setRemarks] = useState('')
  const [amount, setAmount] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const result = await apiList<Row>('/clearance/pending?per_page=100')

    return result.data
  }, [])

  const record = useResource<Row[]>(load, [])

  const open = (row: Row) => {
    setSigning(row)
    setStatus('cleared')
    setRemarks('')
    setAmount('')
    setProblem(null)
  }

  const sign = async () => {
    if (!signing || busy) {
      return
    }

    const exitId = signing.exit?.uuid ?? signing.exit?.id ?? signing.employee_exit_id ?? signing.exit_id

    if (!exitId) {
      setProblem('This item is not linked to an exit.')

      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(`/exits/${exitId}/clearance/${signing.uuid ?? signing.id}`, {
        method: 'PUT',
        body: {
          status,
          remarks: remarks.trim() || null,
          recoverable_amount: amount.trim() ? Number(amount) : null,
        },
      })

      setSigning(null)
      await record.reload()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not sign this off.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Clearance">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Clearance">
        <ErrorState message={record.error ?? 'Could not load clearance.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const items = record.data

  return (
    <Screen title="Clearance" subtitle={items.length === 0 ? 'Nothing pending' : `${items.length} waiting on you`}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState
              title="All clear"
              message="When someone resigns, the items your desk owns show up here."
            />
          </View>
        ) : (
          items.map((row) => (
            <ListRow
              key={String(row.uuid ?? row.id)}
              title={row.title ?? row.item?.title ?? 'Clearance item'}
              subtitle={row.employee?.user?.name ?? row.employee_name ?? row.exit?.employee?.user?.name ?? undefined}
              badge={row.department ?? row.item?.department ?? undefined}
              meta={row.status}
              onPress={() => open(row)}
            />
          ))
        )}
      </ScrollView>

      <Modal visible={signing !== null} transparent animationType="slide" onRequestClose={() => setSigning(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSigning(null)} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={[styles.grab, { backgroundColor: theme.line }]} />

            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>
                {signing?.title ?? signing?.item?.title ?? 'Sign this off'}
              </Text>

              {problem ? <Notice tone="danger" title="Failed" message={problem} /> : null}

              <View style={styles.form}>
                <Select label="Outcome" value={status} options={statuses} onChange={setStatus} disabled={busy} />
                <Field
                  label="Amount to recover"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Leave blank if nothing is due"
                  keyboardType="decimal-pad"
                  editable={!busy}
                />
                <Field
                  label="Remarks"
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="Optional"
                  autoCapitalize="sentences"
                  editable={!busy}
                  multiline
                />

                <Button label="Sign off" onPress={sign} loading={busy} fullWidth />
                <Button label="Cancel" variant="ghost" onPress={() => setSigning(null)} disabled={busy} fullWidth />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    minHeight: 320,
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
    paddingBottom: spacing.lg,
  },
})
