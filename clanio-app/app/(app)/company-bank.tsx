import { useCallback, useState } from 'react'
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { ApiError, api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatShortDateTime } from '@/lib/clock'
import { Money } from '@/lib/money'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Account = Record<string, any>

type Loaded = {
  accounts?: Account[]
  provider?: string
  is_mock?: boolean
  note?: string | null
}

type Statement = {
  account?: Account
  transactions?: Record<string, any>[]
}

export default function CompanyBankScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { can } = useAuth()

  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<Account | null>(null)
  const [statement, setStatement] = useState<Statement | null>(null)
  const [topUp, setTopUp] = useState('')
  const [form, setForm] = useState(blank())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => api<Loaded>('/company-bank-accounts'), [])
  const record = useResource<Loaded>(load, [])

  const canManage = can('company_bank.manage')

  const set = (key: keyof ReturnType<typeof blank>, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  const closeAdd = () => {
    setAdding(false)
    setErrors({})
    setProblem(null)
  }

  const save = async () => {
    if (busy) {
      return
    }

    const found: Record<string, string> = {}

    if (form.label.trim().length < 2) {
      found.label = 'Isko koi naam do, jaise Salary account'
    }

    if (form.account_holder_name.trim().length < 3) {
      found.account_holder_name = 'Account par jo naam hai wahi'
    }

    if (form.bank_name.trim().length < 3) {
      found.bank_name = 'Kaunsa bank?'
    }

    if (form.account_number.trim().length < 6) {
      found.account_number = 'Poora account number daalo'
    }

    if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(form.ifsc_code.trim())) {
      found.ifsc_code = 'IFSC aise hota hai — ICIC0000456'
    }

    setErrors(found)

    if (Object.keys(found).length > 0) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api('/company-bank-accounts', {
        method: 'POST',
        body: {
          label: form.label.trim(),
          account_holder_name: form.account_holder_name.trim(),
          bank_name: form.bank_name.trim(),
          account_number: form.account_number.trim(),
          ifsc_code: form.ifsc_code.trim().toUpperCase(),
          branch_name: form.branch_name.trim() || null,
          contact_email: form.contact_email.trim() || null,
        },
      })

      setForm(blank())
      closeAdd()
      setDone('Account add ho gaya. Isse salary jaayegi.')
      await record.refresh()
    } catch (caught) {
      if (caught instanceof ApiError && Object.keys(caught.fields).length > 0) {
        const mapped: Record<string, string> = {}

        for (const [field, messages] of Object.entries(caught.fields)) {
          mapped[field] = messages[0]
        }

        setErrors(mapped)
        setProblem('Check the highlighted fields.')
      } else {
        setProblem(caught instanceof ApiError ? caught.message : 'Could not add the account.')
      }
    } finally {
      setBusy(false)
    }
  }

  const sheet = async (account: Account) => {
    setOpen(account)
    setStatement(null)
    setTopUp('')
    setProblem(null)
    setDone(null)

    try {
      setStatement(await api<Statement>(`/company-bank-accounts/${account.uuid}/statement?per_page=30`))
    } catch {
      setStatement(null)
    }
  }

  const addMoney = async () => {
    if (!open || busy) {
      return
    }

    const amount = Number(topUp)

    if (!Number.isFinite(amount) || amount <= 0) {
      setProblem('Amount zero se zyada hona chahiye.')

      return
    }

    setBusy(true)
    setProblem(null)

    try {
      const fresh = await api<Account>(`/company-bank-accounts/${open.uuid}/top-up`, {
        method: 'POST',
        body: { amount, narration: 'Test top-up' },
      })

      setOpen(fresh)
      setTopUp('')
      setDone(`${Money.rupee(amount)} daal diya. Balance ab ${Money.rupee(fresh.balance)}.`)
      setStatement(await api<Statement>(`/company-bank-accounts/${open.uuid}/statement?per_page=30`))
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not add the balance.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Company Bank">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Company Bank">
        <ErrorState message={record.error ?? 'Could not load the accounts.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const accounts = record.data.accounts ?? []

  return (
    <Screen
      title="Company Bank"
      subtitle={accounts.length === 0 ? 'No account yet' : `${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
      action={canManage ? { label: 'Add', onPress: () => setAdding(true) } : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {done ? <Notice tone="success" title="Done" message={done} /> : null}

        {record.data.is_mock ? (
          <Notice tone="warning" title="Test bank laga hai" message={record.data.note ?? ''} />
        ) : null}

        {accounts.length === 0 ? (
          <EmptyState
            title="No company account yet"
            message="Salary isi account se jaayegi. Ek add karo, phir payroll approve karke bhej sakte ho."
            action={canManage ? { label: 'Add an account', onPress: () => setAdding(true) } : undefined}
          />
        ) : null}

        {accounts.map((account) => (
          <Pressable
            key={account.uuid}
            onPress={() => void sheet(account)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: pressed ? theme.canvas : theme.surface, borderColor: theme.line },
            ]}
          >
            <View style={styles.head}>
              <Text style={[styles.label, { color: theme.ink }]}>{account.label}</Text>
              {account.is_primary ? (
                <View style={[styles.tag, { backgroundColor: theme.brandSoft }]}>
                  <Text style={[styles.tagText, { color: theme.brand }]}>Primary</Text>
                </View>
              ) : null}
            </View>

            <Text style={[styles.bank, { color: theme.inkMuted }]}>
              {account.bank_name} · {account.account_masked}
            </Text>
            <Text style={[styles.bank, { color: theme.inkSubtle }]}>
              {account.account_holder_name} · {account.ifsc_code}
            </Text>

            <Text style={[styles.balance, { color: theme.ink }]}>{Money.rupee(account.balance, 2)}</Text>
            <Text style={[styles.bank, { color: theme.inkSubtle }]}>Tap to see the statement</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={adding} transparent animationType="slide" onRequestClose={closeAdd}>
        <Pressable style={styles.backdrop} onPress={closeAdd} />

        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={[styles.grab, { backgroundColor: theme.line }]} />

          <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.sheetTitle, { color: theme.ink }]}>Add a company account</Text>

            {problem ? <Notice tone="danger" title="Could not add" message={problem} /> : null}

            <View style={styles.form}>
              <Field label="Call it" value={form.label} onChangeText={(v) => set('label', v)} placeholder="Salary account" error={errors.label} editable={!busy} />
              <Field label="Account holder name" value={form.account_holder_name} onChangeText={(v) => set('account_holder_name', v)} placeholder="As printed on the passbook" autoCapitalize="words" error={errors.account_holder_name} editable={!busy} />
              <Field label="Bank name" value={form.bank_name} onChangeText={(v) => set('bank_name', v)} placeholder="ICICI Bank" autoCapitalize="words" error={errors.bank_name} editable={!busy} />
              <Field label="Account number" value={form.account_number} onChangeText={(v) => set('account_number', v)} placeholder="Full number, no spaces" keyboardType="number-pad" error={errors.account_number} editable={!busy} />
              <Field label="IFSC code" value={form.ifsc_code} onChangeText={(v) => set('ifsc_code', v)} placeholder="ICIC0000456" autoCapitalize="characters" maxLength={11} error={errors.ifsc_code} editable={!busy} />
              <Field label="Branch" value={form.branch_name} onChangeText={(v) => set('branch_name', v)} placeholder="Optional" autoCapitalize="words" editable={!busy} />
              <Field label="Code kis email par jaaye" value={form.contact_email} onChangeText={(v) => set('contact_email', v)} placeholder="accounts@company.com" keyboardType="email-address" autoCapitalize="none" error={errors.contact_email} editable={!busy} />

              <Button label="Add this account" onPress={save} loading={busy} fullWidth />
              <Button label="Cancel" variant="ghost" onPress={closeAdd} disabled={busy} fullWidth />
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={open !== null} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)} />

        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={[styles.sheetHead, { borderBottomColor: theme.line }]}>
            <Text style={[styles.sheetTitle, { color: theme.ink, marginBottom: 0 }]}>{open?.label ?? ''}</Text>
            <Pressable onPress={() => setOpen(null)} hitSlop={10}>
              <Text style={[styles.closeMark, { color: theme.inkMuted }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {problem ? <Notice tone="danger" title="Could not do that" message={problem} /> : null}
            {done ? <Notice tone="success" title="Done" message={done} /> : null}

            {open ? (
              <>
                <Text style={[styles.sheetBalance, { color: theme.ink }]}>{Money.rupee(open.balance, 2)}</Text>
                <Text style={[styles.bank, { color: theme.inkMuted }]}>
                  {open.bank_name} · {open.account_masked} · {open.ifsc_code}
                </Text>

                {record.data?.is_mock && canManage ? (
                  <View style={styles.block}>
                    <Field
                      label="Add test balance"
                      value={topUp}
                      onChangeText={setTopUp}
                      placeholder="500000"
                      keyboardType="number-pad"
                      editable={!busy}
                    />
                    <Button label="Add it" variant="secondary" onPress={addMoney} loading={busy} fullWidth />
                  </View>
                ) : null}

                <Text style={[styles.blockTitle, { color: theme.inkMuted }]}>Statement</Text>

                {(statement?.transactions ?? []).length === 0 ? (
                  <Notice tone="info" title="Nothing yet" message="Jab salary jaayegi, har transfer yahan dikhega." />
                ) : null}

                {(statement?.transactions ?? []).map((row) => (
                  <View key={String(row.uuid ?? row.id)} style={[styles.txn, { borderBottomColor: theme.line }]}>
                    <View style={styles.txnLeft}>
                      <Text numberOfLines={2} style={[styles.txnNarration, { color: theme.ink }]}>
                        {row.narration}
                      </Text>
                      <Text style={[styles.txnMeta, { color: theme.inkSubtle }]}>
                        {formatShortDateTime(row.happened_at)}
                        {row.reference ? ` · ${row.reference}` : ''}
                      </Text>
                    </View>

                    <View style={styles.txnRight}>
                      <Text
                        style={[
                          styles.txnAmount,
                          { color: row.direction === 'debit' ? theme.danger : theme.success },
                        ]}
                      >
                        {row.direction === 'debit' ? '−' : '+'}
                        {Money.rupee(row.amount, 2)}
                      </Text>
                      <Text style={[styles.txnMeta, { color: theme.inkSubtle }]}>
                        {Money.rupee(row.balance_after, 2)}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  )
}

function blank() {
  return {
    label: '',
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    branch_name: '',
    contact_email: '',
  }
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
    gap: 3,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
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
  bank: {
    fontSize: font.xs,
  },
  balance: {
    fontSize: font.xl,
    fontWeight: '800',
    letterSpacing: -0.4,
    paddingTop: 6,
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
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  sheetBody: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  sheetTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: spacing.lg,
  },
  sheetBalance: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  closeMark: {
    fontSize: font.lg,
    fontWeight: '700',
  },
  form: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  block: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  blockTitle: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  txn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderBottomWidth: 1,
    paddingVertical: spacing.md,
  },
  txnLeft: {
    flex: 1,
    gap: 2,
  },
  txnRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  txnNarration: {
    fontSize: font.sm,
    fontWeight: '600',
  },
  txnMeta: {
    fontSize: 10,
  },
  txnAmount: {
    fontSize: font.sm,
    fontWeight: '800',
  },
})
