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
import { Icon, type IconName } from '@/components/ui/Icon'
import { ListRow } from '@/components/ui/ListRow'
import { Notice } from '@/components/ui/Notice'
import { Select, type Option } from '@/components/ui/Select'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { daysBefore, today } from '@/lib/clock'
import { api, apiList, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { documentTypes, pickFile, toFormData, type PickedFile } from '@/lib/upload'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Row = Record<string, any>

type Kind = 'expense' | 'regularization' | 'asset' | 'exit'

type Loaded = {
  expenses: Row[]
  regularizations: Row[]
  assets: Row[]
  exits: Row[]
  held: Row[]
}

type EligibleDay = {
  date: string
  weekday: string
  gap_label: string
  can_regularize: boolean
  blocked_reason: string | null
}

const expenseCategories: Option[] = [
  { value: 'travel', label: 'Travel' },
  { value: 'food', label: 'Food' },
  { value: 'internet', label: 'Internet' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'stationery', label: 'Stationery' },
  { value: 'repair', label: 'Repair' },
  { value: 'medical', label: 'Medical' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
]

const assetTypes: Option[] = [
  { value: 'new', label: 'I need a new asset' },
  { value: 'repair', label: 'Something is broken' },
  { value: 'replacement', label: 'Replace what I have' },
  { value: 'return', label: 'Take it back' },
]

const assetCategories: Option[] = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'sim', label: 'SIM card' },
  { value: 'headset', label: 'Headset' },
  { value: 'keyboard', label: 'Keyboard / Mouse' },
  { value: 'id_card', label: 'ID card' },
  { value: 'access_card', label: 'Access card' },
  { value: 'other', label: 'Other' },
]

const priorities: Option[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const exitTypes: Option[] = [
  { value: 'resignation', label: 'Resignation' },
  { value: 'retirement', label: 'Retirement' },
]

const shortcuts: { kind: Kind; label: string; hint: string; icon: IconName }[] = [
  { kind: 'expense', label: 'Expense claim', hint: 'Get money back', icon: 'card-outline' },
  { kind: 'regularization', label: 'Fix attendance', hint: 'Missed a punch', icon: 'create-outline' },
  { kind: 'asset', label: 'Asset request', hint: 'Laptop, SIM, repair', icon: 'construct-outline' },
  { kind: 'exit', label: 'Resignation', hint: 'Serve your notice', icon: 'exit-outline' },
]

export default function MyRequestsScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { profile } = useAuth()
  const employeeId = profile?.employee?.id ?? null

  const [sheet, setSheet] = useState<Kind | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [category, setCategory] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(today())
  const [purpose, setPurpose] = useState('')
  const [description, setDescription] = useState('')

  const [attendanceDate, setAttendanceDate] = useState(today())
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [reason, setReason] = useState('')

  const [assetType, setAssetType] = useState<string | null>('new')
  const [assetCategory, setAssetCategory] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<string | null>('normal')

  const [eligible, setEligible] = useState<EligibleDay[] | null>(null)
  const [bills, setBills] = useState<PickedFile[]>([])
  const [exitType, setExitType] = useState<string | null>('resignation')
  const [resignationDate, setResignationDate] = useState(today())
  const [lastWorkingDate, setLastWorkingDate] = useState('')

  const load = useCallback(async (): Promise<Loaded> => {
    const pull = async (path: string) => {
      try {
        const result = await apiList<Row>(path)

        return employeeId === null
          ? result.data
          : result.data.filter((row) => Number(row.employee_id) === employeeId)
      } catch {
        return [] as Row[]
      }
    }

    const [expenses, regularizations, assets, exits, held] = await Promise.all([
      pull('/expense-claims?per_page=100'),
      pull('/regularizations?per_page=100'),
      pull('/asset-requests?per_page=100'),
      pull('/exits?per_page=50'),
      apiList<Row>('/my-assets?per_page=50')
        .then((result) => result.data)
        .catch(() => [] as Row[]),
    ])

    return { expenses, regularizations, assets, exits, held }
  }, [employeeId])

  const record = useResource<Loaded>(load, [employeeId])

  const open = (kind: Kind) => {
    setSheet(kind)
    setErrors({})
    setProblem(null)
    setDone(null)

    if (kind === 'regularization') {
      void loadEligible()
    }
  }

  const loadEligible = async () => {
    setEligible(null)

    const to = today()
    const from = daysBefore(to, 30)

    try {
      const result = await api<{ days?: EligibleDay[] }>(`/regularizations/eligible-days?from=${from}&to=${to}`)

      setEligible((result.days ?? []).filter((day) => day.can_regularize))
    } catch {
      setEligible([])
    }
  }

  const close = () => {
    setSheet(null)
    setErrors({})
    setProblem(null)
  }

  const fail = (caught: unknown, fallback: string) => {
    if (caught instanceof ApiError && caught.status === 422 && Object.keys(caught.fields).length > 0) {
      const mapped: Record<string, string> = {}

      for (const [field, messages] of Object.entries(caught.fields)) {
        mapped[field] = messages[0]
      }

      setErrors(mapped)
      setProblem('Check the highlighted fields.')

      return
    }

    setProblem(caught instanceof ApiError ? caught.message : fallback)
  }

  const send = async (path: string, body: Record<string, unknown>, message: string) => {
    setBusy(true)
    setProblem(null)

    try {
      await api(path, { method: 'POST', body })
      close()
      setDone(message)
      await record.reload()
    } catch (caught) {
      fail(caught, 'Could not send the request.')
    } finally {
      setBusy(false)
    }
  }

  const addBill = async () => {
    if (bills.length >= 5) {
      return
    }

    try {
      const picked = await pickFile(documentTypes)

      if (picked) {
        setBills((current) => [...current, picked])
      }
    } catch {
      setProblem('Could not open the file picker.')
    }
  }

  const submitExpense = () => {
    const next: Record<string, string> = {}

    if (!category) {
      next.category = 'Pick a category'
    }

    if (!(Number(amount) > 0)) {
      next.amount = 'Enter an amount'
    }

    if (!isDate(expenseDate)) {
      next.expense_date = 'Use YYYY-MM-DD'
    }

    if (description.trim().length < 3) {
      next.description = 'Say what this was for'
    }

    setErrors(next)

    if (Object.keys(next).length > 0) {
      return
    }

    void submitExpenseClaim()
  }

  const submitExpenseClaim = async () => {
    setBusy(true)
    setProblem(null)

    try {
      const claim = await api<Record<string, any>>('/expense-claims', {
        method: 'POST',
        body: {
          category,
          amount: Number(amount),
          expense_date: expenseDate,
          purpose: purpose.trim() || null,
          description: description.trim(),
        },
      })

      const claimId = claim?.uuid ?? claim?.id

      if (claimId) {
        for (const bill of bills) {
          await api(`/expense-claims/${claimId}/bills`, {
            method: 'POST',
            body: toFormData(bill, 'bill'),
          }).catch(() => undefined)
        }
      }

      setBills([])
      close()
      setDone('Expense claim sent for verification.')
      await record.reload()
    } catch (caught) {
      fail(caught, 'Could not send the claim.')
    } finally {
      setBusy(false)
    }
  }

  const submitRegularization = () => {
    const next: Record<string, string> = {}

    if (!isDate(attendanceDate)) {
      next.attendance_date = 'Use YYYY-MM-DD'
    }

    if (!isTime(checkIn)) {
      next.requested_check_in = checkIn ? 'Use HH:MM, like 09:30' : 'Check in time is required'
    }

    if (!isTime(checkOut)) {
      next.requested_check_out = checkOut ? 'Use HH:MM, like 18:45' : 'Check out time is required'
    }

    if (reason.trim().length < 5) {
      next.reason = 'Explain what happened'
    }

    setErrors(next)

    if (Object.keys(next).length > 0) {
      return
    }

    void send(
      '/regularizations',
      {
        attendance_date: attendanceDate,
        requested_check_in: checkIn,
        requested_check_out: checkOut,
        reason: reason.trim(),
      },
      'Regularization sent to your manager.'
    )
  }

  const submitAsset = () => {
    const next: Record<string, string> = {}

    if (!assetType) {
      next.request_type = 'Pick a request type'
    }

    if (title.trim().length < 3) {
      next.title = 'Give it a short title'
    }

    if (description.trim().length < 5) {
      next.description = 'Describe what you need'
    }

    if (assetType === 'new' && !assetCategory) {
      next.category = 'Pick what kind of asset you need'
    }

    setErrors(next)

    if (Object.keys(next).length > 0) {
      return
    }

    void send(
      '/asset-requests',
      {
        request_type: assetType,
        ...(assetCategory ? { category: assetCategory } : {}),
        title: title.trim(),
        description: description.trim(),
        priority,
      },
      'Asset request sent to IT.'
    )
  }

  const submitExit = () => {
    const next: Record<string, string> = {}

    if (!exitType) {
      next.exit_type = 'Pick a type'
    }

    if (!isDate(resignationDate)) {
      next.resignation_date = 'Use YYYY-MM-DD'
    }

    if (!isDate(lastWorkingDate)) {
      next.requested_last_working_date = 'Use YYYY-MM-DD'
    }

    if (reason.trim().length < 3) {
      next.reason = 'Write a short reason'
    }

    setErrors(next)

    if (Object.keys(next).length > 0) {
      return
    }

    void send(
      '/exits',
      {
        exit_type: exitType,
        resignation_date: resignationDate,
        requested_last_working_date: lastWorkingDate,
        reason: reason.trim(),
      },
      'Resignation submitted. Your manager will review it.'
    )
  }

  if (record.loading) {
    return (
      <Screen title="My Requests">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="My Requests">
        <ErrorState message={record.error ?? 'Could not load your requests.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const { expenses, regularizations, assets, exits, held } = record.data
  const total = expenses.length + regularizations.length + assets.length + exits.length

  return (
    <Screen title="My Requests" subtitle={total === 0 ? 'Nothing raised yet' : `${total} raised`}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {done ? <Notice tone="success" title="Sent" message={done} /> : null}

        <View style={styles.grid}>
          {shortcuts.map((entry) => (
            <Pressable
              key={entry.kind}
              onPress={() => open(entry.kind)}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: pressed ? theme.canvas : theme.surface, borderColor: theme.line },
              ]}
            >
              <View style={[styles.tileIcon, { backgroundColor: theme.brandSoft }]}>
                <Icon name={entry.icon} size={20} color={theme.brand} />
              </View>
              <Text style={[styles.tileLabel, { color: theme.ink }]}>{entry.label}</Text>
              <Text style={[styles.tileHint, { color: theme.inkSubtle }]}>{entry.hint}</Text>
            </Pressable>
          ))}
        </View>

        {total === 0 ? (
          <View style={styles.empty}>
            <EmptyState title="Nothing raised yet" message="Anything you send for approval shows up here." />
          </View>
        ) : null}

        <Group title="What I hold" rows={held} render={(row) => (
          <ListRow
            key={String(row.uuid ?? row.id)}
            title={row.name ?? row.asset?.name ?? 'Asset'}
            subtitle={[row.brand ?? row.asset?.brand, row.model ?? row.asset?.model].filter(Boolean).join(' ')}
            badge={row.asset_code ?? row.asset?.asset_code ?? undefined}
            meta={row.allocated_on ?? undefined}
          />
        )} />

        <Group title="Expense claims" rows={expenses} render={(row) => (
          <ListRow
            key={String(row.uuid ?? row.id)}
            title={`${row.currency ?? '₹'} ${row.amount}`}
            subtitle={[row.category, row.expense_date].filter(Boolean).join(' · ')}
            badge={row.claim_no ?? undefined}
            meta={row.status}
          />
        )} />

        <Group title="Regularizations" rows={regularizations} render={(row) => (
          <ListRow
            key={String(row.uuid ?? row.id)}
            title={row.attendance_date}
            subtitle={row.reason}
            meta={row.status}
          />
        )} />

        <Group title="Asset requests" rows={assets} render={(row) => (
          <ListRow
            key={String(row.uuid ?? row.id)}
            title={row.title}
            subtitle={[row.request_type, row.category].filter(Boolean).join(' · ')}
            badge={row.priority ?? undefined}
            meta={row.status}
          />
        )} />

        <Group title="Resignation" rows={exits} render={(row) => (
          <ListRow
            key={String(row.uuid ?? row.id)}
            title={row.exit_type ?? 'Resignation'}
            subtitle={`Last working day ${row.approved_last_working_date ?? row.requested_last_working_date ?? '—'}`}
            meta={row.status}
          />
        )} />
      </ScrollView>

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={[styles.grab, { backgroundColor: theme.line }]} />

            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>
                {sheet === 'expense'
                  ? 'Claim an expense'
                  : sheet === 'regularization'
                    ? 'Fix an attendance day'
                    : sheet === 'asset'
                      ? 'Ask IT for an asset'
                      : 'Submit resignation'}
              </Text>

              {problem ? <Notice tone="danger" title="Could not send" message={problem} /> : null}

              {sheet === 'expense' ? (
                <View style={styles.form}>
                  <Select label="Category" value={category} options={expenseCategories} onChange={setCategory} placeholder="What kind of expense" error={errors.category} disabled={busy} />
                  <Field label="Amount" value={amount} onChangeText={setAmount} placeholder="1200" keyboardType="decimal-pad" error={errors.amount} editable={!busy} />
                  <Field label="Spent on" value={expenseDate} onChangeText={setExpenseDate} placeholder="YYYY-MM-DD" error={errors.expense_date} editable={!busy} />
                  <Field label="Purpose" value={purpose} onChangeText={setPurpose} placeholder="Optional" autoCapitalize="sentences" error={errors.purpose} editable={!busy} />
                  <Field label="Description" value={description} onChangeText={setDescription} placeholder="Client visit cab fare" autoCapitalize="sentences" error={errors.description} editable={!busy} multiline />
                  {bills.map((bill, index) => (
                    <Pressable
                      key={`${bill.name}-${index}`}
                      onPress={() => setBills((current) => current.filter((_, position) => position !== index))}
                      style={[styles.bill, { backgroundColor: theme.canvas, borderColor: theme.line }]}
                    >
                      <Text numberOfLines={1} style={[styles.billName, { color: theme.ink }]}>
                        {bill.name}
                      </Text>
                      <Text style={[styles.billMeta, { color: theme.inkSubtle }]}>Tap to remove</Text>
                    </Pressable>
                  ))}

                  {bills.length < 5 ? (
                    <Button label="Attach a bill" variant="secondary" onPress={addBill} disabled={busy} fullWidth />
                  ) : null}
                  <Button label="Send claim" onPress={submitExpense} loading={busy} fullWidth />
                </View>
              ) : null}

              {sheet === 'regularization' ? (
                <View style={styles.form}>
                  {eligible === null ? null : eligible.length === 0 ? (
                    <Notice
                      tone="info"
                      title="Nothing to fix"
                      message="No day in the last 30 days has a missing punch you can still correct."
                    />
                  ) : (
                    <View style={styles.chips}>
                      {eligible.slice(0, 12).map((day) => {
                        const active = day.date === attendanceDate

                        return (
                          <Pressable
                            key={day.date}
                            onPress={() => setAttendanceDate(day.date)}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: active ? theme.brand : theme.surface,
                                borderColor: active ? theme.brand : theme.line,
                              },
                            ]}
                          >
                            <Text style={[styles.chipText, { color: active ? theme.onBrand : theme.ink }]}>
                              {day.date.slice(5)} · {day.gap_label}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  )}

                  <Field label="Date" value={attendanceDate} onChangeText={setAttendanceDate} placeholder="YYYY-MM-DD" error={errors.attendance_date} editable={!busy} />
                  <Field label="Check in" value={checkIn} onChangeText={setCheckIn} placeholder="09:30" error={errors.requested_check_in} editable={!busy} />
                  <Field label="Check out" value={checkOut} onChangeText={setCheckOut} placeholder="18:45" error={errors.requested_check_out} editable={!busy} />
                  <Field label="Reason" value={reason} onChangeText={setReason} placeholder="Forgot to punch out after the client call" autoCapitalize="sentences" error={errors.reason} editable={!busy} multiline />
                  <Button label="Send for approval" onPress={submitRegularization} loading={busy} fullWidth />
                </View>
              ) : null}

              {sheet === 'asset' ? (
                <View style={styles.form}>
                  <Select label="What do you need" value={assetType} options={assetTypes} onChange={setAssetType} error={errors.request_type} disabled={busy} />
                  <Select label="Asset type" value={assetCategory} options={assetCategories} onChange={setAssetCategory} placeholder="Optional" allowClear error={errors.category} disabled={busy} />
                  <Field label="Title" value={title} onChangeText={setTitle} placeholder="Laptop battery drains in an hour" autoCapitalize="sentences" error={errors.title} editable={!busy} />
                  <Field label="Detail" value={description} onChangeText={setDescription} placeholder="What is happening and since when" autoCapitalize="sentences" error={errors.description} editable={!busy} multiline />
                  <Select label="Priority" value={priority} options={priorities} onChange={setPriority} error={errors.priority} disabled={busy} />
                  <Button label="Send to IT" onPress={submitAsset} loading={busy} fullWidth />
                </View>
              ) : null}

              {sheet === 'exit' ? (
                <View style={styles.form}>
                  <Notice tone="warning" title="This is final once approved" message="Your manager and HR both review it. You can withdraw only before approval." />
                  <Select label="Type" value={exitType} options={exitTypes} onChange={setExitType} error={errors.exit_type} disabled={busy} />
                  <Field label="Resignation date" value={resignationDate} onChangeText={setResignationDate} placeholder="YYYY-MM-DD" error={errors.resignation_date} editable={!busy} />
                  <Field label="Requested last working day" value={lastWorkingDate} onChangeText={setLastWorkingDate} placeholder="YYYY-MM-DD" error={errors.requested_last_working_date} editable={!busy} />
                  <Field label="Reason" value={reason} onChangeText={setReason} placeholder="Why are you leaving" autoCapitalize="sentences" error={errors.reason} editable={!busy} multiline />
                  <Button label="Submit resignation" variant="danger" onPress={submitExit} loading={busy} fullWidth />
                </View>
              ) : null}

              <Button label="Cancel" variant="ghost" onPress={close} disabled={busy} fullWidth />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  )
}

function Group({
  title,
  rows,
  render,
}: {
  title: string
  rows: Row[]
  render: (row: Row) => React.ReactNode
}) {
  const theme = useTheme()

  if (rows.length === 0) {
    return null
  }

  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: theme.inkSubtle }]}>
        {title} ({rows.length})
      </Text>
      {rows.map(render)}
    </View>
  )
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
  },
  tileIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  tileLabel: {
    fontSize: font.md,
    fontWeight: '700',
  },
  tileHint: {
    fontSize: font.xs,
  },
  empty: {
    minHeight: 220,
  },
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '90%',
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  bill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  billName: {
    flex: 1,
    fontSize: font.sm,
    fontWeight: '600',
  },
  billMeta: {
    fontSize: font.xs,
  },
})
