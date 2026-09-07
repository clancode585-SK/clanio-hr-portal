import { useCallback, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
import { imageAndPdf, pickFile, toFormData, type PickedFile } from '@/lib/upload'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Row = Record<string, any>

const documentKinds: Option[] = [
  { value: 'photo', label: 'Passport photo' },
  { value: 'aadhaar', label: 'Aadhaar card' },
  { value: 'pan', label: 'PAN card' },
  { value: 'resume', label: 'Resume' },
  { value: 'offer_letter', label: 'Offer letter' },
  { value: 'appointment_letter', label: 'Appointment letter' },
  { value: 'education_certificate', label: 'Education certificate' },
  { value: 'experience_letter', label: 'Experience letter' },
  { value: 'relieving_letter', label: 'Relieving letter' },
  { value: 'salary_slip', label: 'Previous salary slip' },
  { value: 'bank_passbook', label: 'Bank passbook or cheque' },
  { value: 'address_proof', label: 'Address proof' },
  { value: 'other', label: 'Other' },
]

type Loaded = {
  family: Row[]
  banks: Row[]
  documents: Row[]
}

const relations: Option[] = [
  'father',
  'mother',
  'spouse',
  'son',
  'daughter',
  'brother',
  'sister',
  'other',
].map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }))

const accountTypes: Option[] = [
  { value: 'savings', label: 'Savings' },
  { value: 'current', label: 'Current' },
]

const tabs = [
  { key: 'family', label: 'Family' },
  { key: 'bank', label: 'Bank' },
  { key: 'documents', label: 'Documents' },
]

export default function EmployeeRecordsScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { can } = useAuth()
  const { uuid } = useLocalSearchParams<{ uuid: string }>()

  const [tab, setTab] = useState('family')
  const [sheet, setSheet] = useState<'family' | 'bank' | 'document' | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [relation, setRelation] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [occupation, setOccupation] = useState('')

  const [holder, setHolder] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [branch, setBranch] = useState('')
  const [accountType, setAccountType] = useState<string | null>('savings')

  const [documentKind, setDocumentKind] = useState<string | null>(null)
  const [documentNumber, setDocumentNumber] = useState('')
  const [file, setFile] = useState<PickedFile | null>(null)

  const load = useCallback(async (): Promise<Loaded> => {
    const pull = async (path: string, allowed: boolean) => {
      if (!allowed) {
        return [] as Row[]
      }

      const result = await apiList<Row>(`/employees/${uuid}/${path}`)

      return result.data
    }

    const [family, banks, documents] = await Promise.all([
      pull('family', can('employee_family.view')),
      pull('bank-accounts', can('employee_bank.view')),
      pull('documents', can('employee_document.view')),
    ])

    return { family, banks, documents }
  }, [can, uuid])

  const record = useResource<Loaded>(load, [uuid])

  const closeSheet = () => {
    setSheet(null)
    setErrors({})
    setProblem(null)
  }

  const addFamily = async () => {
    if (busy) {
      return
    }

    const next: Record<string, string> = {}

    if (name.trim().length < 2) {
      next.name = 'Name is required'
    }

    if (!relation) {
      next.relation = 'Pick a relation'
    }

    setErrors(next)

    if (Object.keys(next).length > 0) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(`/employees/${uuid}/family`, {
        method: 'POST',
        body: {
          name: name.trim(),
          relation,
          phone: phone.trim() || null,
          occupation: occupation.trim() || null,
        },
      })

      setName('')
      setRelation(null)
      setPhone('')
      setOccupation('')
      closeSheet()
      await record.reload()
    } catch (caught) {
      handle(caught)
    } finally {
      setBusy(false)
    }
  }

  const addBank = async () => {
    if (busy) {
      return
    }

    const next: Record<string, string> = {}

    if (holder.trim().length < 2) {
      next.account_holder_name = 'Required'
    }

    if (bankName.trim().length < 2) {
      next.bank_name = 'Required'
    }

    if (!/^[0-9]{9,18}$/.test(accountNumber.trim())) {
      next.account_number = '9 to 18 digits'
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase())) {
      next.ifsc_code = 'Looks like HDFC0001234'
    }

    setErrors(next)

    if (Object.keys(next).length > 0) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(`/employees/${uuid}/bank-accounts`, {
        method: 'POST',
        body: {
          account_holder_name: holder.trim(),
          bank_name: bankName.trim(),
          account_number: accountNumber.trim(),
          ifsc_code: ifsc.trim().toUpperCase(),
          branch_name: branch.trim() || null,
          account_type: accountType,
        },
      })

      setHolder('')
      setBankName('')
      setAccountNumber('')
      setIfsc('')
      setBranch('')
      closeSheet()
      await record.reload()
    } catch (caught) {
      handle(caught)
    } finally {
      setBusy(false)
    }
  }

  const choose = async () => {
    try {
      const picked = await pickFile(imageAndPdf)

      if (picked) {
        setFile(picked)
        setErrors((current) => ({ ...current, file: '' }))
      }
    } catch {
      setProblem('Could not open the file picker.')
    }
  }

  const uploadDocument = async () => {
    if (busy) {
      return
    }

    const next: Record<string, string> = {}

    if (!documentKind) {
      next.type = 'Pick a document type'
    }

    if (!file) {
      next.file = 'Choose a file first'
    }

    setErrors(next)

    if (Object.keys(next).length > 0 || !file) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(`/employees/${uuid}/documents`, {
        method: 'POST',
        body: toFormData(file, 'file', {
          type: documentKind,
          document_number: documentNumber.trim() || undefined,
        }),
      })

      setFile(null)
      setDocumentKind(null)
      setDocumentNumber('')
      closeSheet()
      await record.reload()
    } catch (caught) {
      handle(caught)
    } finally {
      setBusy(false)
    }
  }

  const verify = async (document: Row) => {
    try {
      await api(`/employees/${uuid}/documents/${document.uuid ?? document.id}/verify`, {
        method: 'PUT',
        body: { status: 'verified' },
      })

      await record.reload()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not verify.')
    }
  }

  const handle = (caught: unknown) => {
    if (caught instanceof ApiError && caught.status === 422 && Object.keys(caught.fields).length > 0) {
      const mapped: Record<string, string> = {}

      for (const [field, messages] of Object.entries(caught.fields)) {
        mapped[field] = messages[0]
      }

      setErrors(mapped)
      setProblem('Check the highlighted fields.')

      return
    }

    setProblem(caught instanceof ApiError ? caught.message : 'Something went wrong.')
  }

  if (record.loading) {
    return (
      <Screen title="Records" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Records" leading="back">
        <ErrorState message={record.error ?? 'Could not load records.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const { family, banks, documents } = record.data
  const canAddFamily = can('employee_family.manage')
  const canAddBank = can('employee_bank.manage')
  const canVerify = can('employee_document.verify')

  return (
    <Screen
      title="Records"
      subtitle={`${family.length} family · ${banks.length} bank · ${documents.length} docs`}
      leading="back"
      action={
        tab === 'family' && canAddFamily
          ? { label: 'Add', onPress: () => setSheet('family') }
          : tab === 'bank' && canAddBank
            ? { label: 'Add', onPress: () => setSheet('bank') }
            : tab === 'documents' && can('employee_document.manage')
              ? { label: 'Upload', onPress: () => setSheet('document') }
              : undefined
      }
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.tabs, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
          {tabs.map((entry) => {
            const active = entry.key === tab

            return (
              <Pressable
                key={entry.key}
                onPress={() => setTab(entry.key)}
                style={[styles.tab, { backgroundColor: active ? theme.surface : 'transparent' }]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: active ? theme.brand : theme.inkMuted, fontWeight: active ? '700' : '500' },
                  ]}
                >
                  {entry.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {problem ? <Notice tone="danger" title="Failed" message={problem} /> : null}

        {tab === 'family'
          ? family.length === 0
            ? <Notice tone="info" title="No family added" message="Family members and nominees show up here." />
            : family.map((row) => (
                <ListRow
                  key={String(row.uuid ?? row.id)}
                  title={row.name}
                  subtitle={[row.relation, row.occupation].filter(Boolean).join(' · ')}
                  badge={row.is_nominee ? 'Nominee' : undefined}
                  meta={row.phone ?? undefined}
                />
              ))
          : null}

        {tab === 'bank'
          ? banks.length === 0
            ? <Notice tone="info" title="No bank account" message="Salary cannot be paid without one." />
            : banks.map((row) => (
                <ListRow
                  key={String(row.uuid ?? row.id)}
                  title={row.bank_name}
                  subtitle={`${row.account_holder_name} · ${row.masked_account ?? row.account_number}`}
                  badge={row.is_primary ? 'Primary' : undefined}
                  meta={row.ifsc_code}
                />
              ))
          : null}

        {tab === 'documents'
          ? documents.length === 0
            ? <Notice tone="info" title="No documents" message="Uploaded documents appear here for verification." />
            : documents.map((row) => (
                <ListRow
                  key={String(row.uuid ?? row.id)}
                  title={row.type_label ?? row.type ?? 'Document'}
                  subtitle={row.original_name ?? undefined}
                  badge={row.status}
                  meta={canVerify && row.status !== 'verified' ? 'Verify' : undefined}
                  onPress={canVerify && row.status !== 'verified' ? () => verify(row) : undefined}
                />
              ))
          : null}
      </ScrollView>

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={closeSheet}>
        <Pressable style={styles.backdrop} onPress={closeSheet} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={[styles.grab, { backgroundColor: theme.line }]} />

            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>
                {sheet === 'family'
                  ? 'Add family member'
                  : sheet === 'bank'
                    ? 'Add bank account'
                    : 'Upload a document'}
              </Text>

              {problem ? <Notice tone="danger" title="Could not save" message={problem} /> : null}

              {sheet === 'family' ? (
                <View style={styles.form}>
                  <Field label="Name" value={name} onChangeText={setName} placeholder="Full name" autoCapitalize="words" error={errors.name} editable={!busy} />
                  <Select label="Relation" value={relation} options={relations} onChange={setRelation} placeholder="Select" error={errors.relation} disabled={busy} />
                  <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="Optional" keyboardType="phone-pad" error={errors.phone} editable={!busy} />
                  <Field label="Occupation" value={occupation} onChangeText={setOccupation} placeholder="Optional" autoCapitalize="words" error={errors.occupation} editable={!busy} />
                  <Button label="Add member" onPress={addFamily} loading={busy} fullWidth />
                </View>
              ) : sheet === 'bank' ? (
                <View style={styles.form}>
                  <Field label="Account holder" value={holder} onChangeText={setHolder} placeholder="As printed on the passbook" autoCapitalize="words" error={errors.account_holder_name} editable={!busy} />
                  <Field label="Bank" value={bankName} onChangeText={setBankName} placeholder="HDFC Bank" autoCapitalize="words" error={errors.bank_name} editable={!busy} />
                  <Field label="Account number" value={accountNumber} onChangeText={setAccountNumber} placeholder="9 to 18 digits" keyboardType="number-pad" error={errors.account_number} editable={!busy} />
                  <Field label="IFSC" value={ifsc} onChangeText={setIfsc} placeholder="HDFC0001234" autoCapitalize="characters" error={errors.ifsc_code} editable={!busy} />
                  <Field label="Branch" value={branch} onChangeText={setBranch} placeholder="Optional" autoCapitalize="words" error={errors.branch_name} editable={!busy} />
                  <Select label="Account type" value={accountType} options={accountTypes} onChange={setAccountType} error={errors.account_type} disabled={busy} />
                  <Button label="Add account" onPress={addBank} loading={busy} fullWidth />
                </View>
              ) : (
                <View style={styles.form}>
                  <Select
                    label="Document type"
                    value={documentKind}
                    options={documentKinds}
                    onChange={setDocumentKind}
                    placeholder="What is this"
                    error={errors.type}
                    disabled={busy}
                  />

                  <Pressable
                    onPress={choose}
                    disabled={busy}
                    style={[
                      styles.picker,
                      { backgroundColor: theme.canvas, borderColor: errors.file ? theme.danger : theme.line },
                    ]}
                  >
                    <Text style={[styles.pickerLabel, { color: file ? theme.ink : theme.inkSubtle }]}>
                      {file ? file.name : 'Choose a JPG, PNG or PDF'}
                    </Text>
                    {file?.size ? (
                      <Text style={[styles.pickerMeta, { color: theme.inkSubtle }]}>
                        {Math.round(file.size / 1024)} KB
                      </Text>
                    ) : null}
                  </Pressable>

                  {errors.file ? <Text style={[styles.error, { color: theme.danger }]}>{errors.file}</Text> : null}

                  <Field
                    label="Document number"
                    value={documentNumber}
                    onChangeText={setDocumentNumber}
                    placeholder="Optional"
                    autoCapitalize="characters"
                    error={errors.document_number}
                    editable={!busy}
                  />

                  <Button label="Upload" onPress={uploadDocument} loading={busy} fullWidth />
                </View>
              )}

              <Button label="Cancel" variant="ghost" onPress={closeSheet} disabled={busy} fullWidth />
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
  },
  tabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  tabLabel: {
    fontSize: font.sm,
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
  picker: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: 3,
  },
  pickerLabel: {
    fontSize: font.md,
    fontWeight: '600',
  },
  pickerMeta: {
    fontSize: font.xs,
  },
  error: {
    fontSize: font.sm,
  },
})
