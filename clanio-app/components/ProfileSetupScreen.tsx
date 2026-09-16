import { useCallback, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Select } from '@/components/ui/Select'
import { Stepper } from '@/components/ui/Stepper'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { documentTypes, pickFile, toFormData, type PickedFile } from '@/lib/upload'
import { useTheme } from '@/theme/useTheme'

const STEPS = ['About you', 'Bank account', 'Documents', 'Family']

const genders = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

const maritalStatuses = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
]

const accountTypes = [
  { value: 'savings', label: 'Savings' },
  { value: 'current', label: 'Current' },
]

const relations = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'brother', label: 'Brother' },
  { value: 'sister', label: 'Sister' },
  { value: 'other', label: 'Other' },
]

const requiredDocuments = [
  { type: 'photo', label: 'Passport photo' },
  { type: 'aadhaar', label: 'Aadhaar card' },
  { type: 'pan', label: 'PAN card' },
]

export function ProfileSetupScreen({ onDone }: { onDone?: () => void } = {}) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { profile, onboarding, finishProfileStep, refreshOnboarding, refreshProfile, signOut } = useAuth()

  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const employee = profile?.employee

  const [personalPhone, setPersonalPhone] = useState(employee?.personal_phone ?? profile?.phone ?? '')
  const [gender, setGender] = useState<string | null>(employee?.gender ?? null)
  const [maritalStatus, setMaritalStatus] = useState<string | null>(employee?.marital_status ?? null)
  const [currentAddress, setCurrentAddress] = useState(employee?.current_address ?? '')
  const [pan, setPan] = useState(employee?.pan_number ?? '')
  const [contactName, setContactName] = useState(employee?.emergency_contact_name ?? '')
  const [contactRelation, setContactRelation] = useState<string | null>(employee?.emergency_contact_relation ?? null)
  const [contactPhone, setContactPhone] = useState(employee?.emergency_contact_phone ?? '')

  const [holder, setHolder] = useState(profile?.name ?? '')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [accountType, setAccountType] = useState<string | null>('savings')
  const [bankSaved, setBankSaved] = useState(false)

  const [uploaded, setUploaded] = useState<string[]>([])

  const [memberName, setMemberName] = useState('')
  const [memberRelation, setMemberRelation] = useState<string | null>(null)
  const [memberPhone, setMemberPhone] = useState('')
  const [familySaved, setFamilySaved] = useState(false)

  const percent = onboarding?.profile?.percent ?? 0

  const fail = useCallback((caught: unknown, fallback: string) => {
    if (caught instanceof ApiError && caught.status === 422 && Object.keys(caught.fields).length > 0) {
      const mapped: Record<string, string> = {}

      for (const [field, messages] of Object.entries(caught.fields)) {
        mapped[field.split('.').pop() ?? field] = messages[0]
      }

      setErrors(mapped)
      setProblem('Check the highlighted fields.')

      return
    }

    setProblem(caught instanceof ApiError ? caught.message : fallback)
  }, [])

  const forward = async () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
      setErrors({})
      setProblem(null)

      return
    }

    await close()
  }

  const close = async () => {
    setBusy(true)

    try {
      await refreshProfile()
      await finishProfileStep()
      onDone?.()
    } finally {
      setBusy(false)
    }
  }

  const savePersonal = async () => {
    const found: Record<string, string> = {}

    if (personalPhone.trim().length < 10) {
      found.personal_phone = 'Enter a reachable phone number'
    }

    if (gender === null) {
      found.gender = 'Pick one'
    }

    if (currentAddress.trim().length < 8) {
      found.current_address = 'Where do you live right now?'
    }

    if (!/^[A-Za-z]{5}\d{4}[A-Za-z]$/.test(pan.trim())) {
      found.pan_number = 'PAN looks like ABCDE1234F'
    }

    if (contactName.trim().length < 3) {
      found.emergency_contact_name = 'Who should we call in an emergency?'
    }

    if (contactPhone.trim().length < 10) {
      found.emergency_contact_phone = 'Enter their phone number'
    }

    setErrors(found)

    if (Object.keys(found).length > 0) {
      setProblem('These ones are needed before we can move on.')

      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api('/profile', {
        method: 'PUT',
        body: {
          personal_phone: personalPhone.trim(),
          gender,
          marital_status: maritalStatus,
          current_address: currentAddress.trim(),
          pan_number: pan.trim().toUpperCase(),
          emergency_contact_name: contactName.trim(),
          emergency_contact_relation: contactRelation,
          emergency_contact_phone: contactPhone.trim(),
        },
      })

      await refreshOnboarding()
      await forward()
    } catch (caught) {
      fail(caught, 'Could not save your details.')
    } finally {
      setBusy(false)
    }
  }

  const saveBank = async () => {
    const found: Record<string, string> = {}

    if (holder.trim().length < 3) {
      found.account_holder_name = 'Name as printed on the passbook'
    }

    if (bankName.trim().length < 3) {
      found.bank_name = 'Which bank?'
    }

    if (accountNumber.trim().length < 6) {
      found.account_number = 'Enter the full account number'
    }

    if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifsc.trim())) {
      found.ifsc_code = 'IFSC looks like HDFC0000123'
    }

    setErrors(found)

    if (Object.keys(found).length > 0) {
      setProblem('Salary goes to this account, so it has to be right.')

      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api('/profile/bank-accounts', {
        method: 'POST',
        body: {
          account_holder_name: holder.trim(),
          bank_name: bankName.trim(),
          account_number: accountNumber.trim(),
          ifsc_code: ifsc.trim().toUpperCase(),
          account_type: accountType,
        },
      })

      setBankSaved(true)
      await refreshOnboarding()
      await forward()
    } catch (caught) {
      fail(caught, 'Could not save the account.')
    } finally {
      setBusy(false)
    }
  }

  const upload = async (type: string, label: string) => {
    if (busy) {
      return
    }

    let picked: PickedFile | null = null

    try {
      picked = await pickFile(documentTypes)
    } catch {
      setProblem('Could not open the file picker.')

      return
    }

    if (picked === null) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api('/profile/documents', {
        method: 'POST',
        body: toFormData(picked, 'file', { type, title: label }),
      })

      setUploaded((current) => (current.includes(type) ? current : [...current, type]))
      await refreshOnboarding()
    } catch (caught) {
      fail(caught, 'Could not upload that file.')
    } finally {
      setBusy(false)
    }
  }

  const saveFamily = async () => {
    const found: Record<string, string> = {}

    if (memberName.trim().length < 3) {
      found.name = 'Their full name'
    }

    if (memberRelation === null) {
      found.relation = 'How are they related?'
    }

    setErrors(found)

    if (Object.keys(found).length > 0) {
      setProblem('Add a name and a relation, or skip this step.')

      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api('/profile/family', {
        method: 'POST',
        body: {
          name: memberName.trim(),
          relation: memberRelation,
          phone: memberPhone.trim() || null,
          is_nominee: true,
          nominee_share: 100,
        },
      })

      setFamilySaved(true)
      await refreshOnboarding()
      await close()
    } catch (caught) {
      fail(caught, 'Could not save the family member.')
    } finally {
      setBusy(false)
    }
  }

  const docsDone = requiredDocuments.filter((row) => uploaded.includes(row.type)).length

  return (
    <View style={[styles.wrap, { backgroundColor: theme.canvas, paddingTop: insets.top + 16 }]}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: theme.brand }]}>Set up your profile</Text>
        <Text style={[styles.title, { color: theme.ink }]}>
          {(profile?.name ?? 'Welcome').split(' ')[0]}, a few things about you
        </Text>
        <Text style={[styles.subtitle, { color: theme.inkMuted }]}>
          HR has set up your account. These are the bits only you can fill. You can skip any of it and
          finish later from My Profile.
        </Text>

        <View style={styles.progressRow}>
          <View style={[styles.track, { backgroundColor: theme.line }]}>
            <View style={[styles.fill, { backgroundColor: theme.brand, width: `${Math.min(100, Math.max(0, percent))}%` }]} />
          </View>
          <Text style={[styles.percent, { color: theme.brand }]}>{percent}%</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Stepper steps={STEPS} current={step} />

          {problem ? <Notice tone="danger" title="Not saved" message={problem} /> : null}

          {step === 0 ? (
            <View style={styles.form}>
              <Field
                label="Your phone"
                value={personalPhone}
                onChangeText={setPersonalPhone}
                placeholder="10 digit mobile"
                keyboardType="phone-pad"
                error={errors.personal_phone}
                editable={!busy}
              />
              <Select label="Gender" value={gender} options={genders} onChange={setGender} error={errors.gender} />
              <Select
                label="Marital status"
                value={maritalStatus}
                options={maritalStatuses}
                onChange={setMaritalStatus}
                placeholder="Optional"
                allowClear
              />
              <Field
                label="Where you live now"
                value={currentAddress}
                onChangeText={setCurrentAddress}
                placeholder="House, street, city, PIN"
                multiline
                error={errors.current_address}
                editable={!busy}
              />
              <Field
                label="PAN number"
                value={pan}
                onChangeText={setPan}
                placeholder="ABCDE1234F"
                autoCapitalize="characters"
                maxLength={10}
                error={errors.pan_number}
                editable={!busy}
              />

              <Text style={[styles.groupTitle, { color: theme.inkMuted }]}>If something happens, who do we call</Text>

              <Field
                label="Their name"
                value={contactName}
                onChangeText={setContactName}
                placeholder="Full name"
                autoCapitalize="words"
                error={errors.emergency_contact_name}
                editable={!busy}
              />
              <Select
                label="Relation"
                value={contactRelation}
                options={relations}
                onChange={setContactRelation}
                placeholder="Optional"
                allowClear
              />
              <Field
                label="Their phone"
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="10 digit mobile"
                keyboardType="phone-pad"
                error={errors.emergency_contact_phone}
                editable={!busy}
              />

              <Button label="Save and continue" onPress={savePersonal} loading={busy} fullWidth />
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.form}>
              <Notice
                tone="info"
                title="This is where your salary lands"
                message="Type it exactly as it appears on your passbook or cheque."
              />

              {bankSaved ? (
                <Notice tone="success" title="Account saved" message="You can add another one later if you need to." />
              ) : (
                <>
                  <Field
                    label="Account holder name"
                    value={holder}
                    onChangeText={setHolder}
                    placeholder="As printed on the passbook"
                    autoCapitalize="words"
                    error={errors.account_holder_name}
                    editable={!busy}
                  />
                  <Field
                    label="Bank name"
                    value={bankName}
                    onChangeText={setBankName}
                    placeholder="HDFC Bank"
                    autoCapitalize="words"
                    error={errors.bank_name}
                    editable={!busy}
                  />
                  <Field
                    label="Account number"
                    value={accountNumber}
                    onChangeText={setAccountNumber}
                    placeholder="Full number, no spaces"
                    keyboardType="number-pad"
                    error={errors.account_number}
                    editable={!busy}
                  />
                  <Field
                    label="IFSC code"
                    value={ifsc}
                    onChangeText={setIfsc}
                    placeholder="HDFC0000123"
                    autoCapitalize="characters"
                    maxLength={11}
                    error={errors.ifsc_code}
                    editable={!busy}
                  />
                  <Select
                    label="Account type"
                    value={accountType}
                    options={accountTypes}
                    onChange={setAccountType}
                  />

                  <Button label="Save and continue" onPress={saveBank} loading={busy} fullWidth />
                </>
              )}
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.form}>
              <Notice
                tone="info"
                title={docsDone + ' of ' + requiredDocuments.length + ' uploaded'}
                message="A clear photo of each is fine. PDF or image, up to 5MB."
              />

              {requiredDocuments.map((row) => {
                const done = uploaded.includes(row.type)

                return (
                  <Pressable
                    key={row.type}
                    onPress={() => void upload(row.type, row.label)}
                    disabled={busy}
                    style={[
                      styles.docRow,
                      { backgroundColor: theme.surface, borderColor: done ? theme.success : theme.line },
                    ]}
                  >
                    <View style={styles.flex}>
                      <Text style={[styles.docLabel, { color: theme.ink }]}>{row.label}</Text>
                      <Text style={[styles.docHint, { color: theme.inkSubtle }]}>{done ? 'Uploaded' : 'Tap to pick a file'}</Text>
                    </View>
                    <Text style={[styles.docMark, { color: done ? theme.success : theme.brand }]}>{done ? '✓' : '+'}</Text>
                  </Pressable>
                )
              })}
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.form}>
              <Notice
                tone="info"
                title="Your nominee"
                message="One family member is enough for now. Skip it if you would rather not."
              />

              {familySaved ? (
                <Notice tone="success" title="Saved" message="Added as your nominee." />
              ) : (
                <>
                  <Field
                    label="Their name"
                    value={memberName}
                    onChangeText={setMemberName}
                    placeholder="Full name"
                    autoCapitalize="words"
                    error={errors.name}
                    editable={!busy}
                  />
                  <Select
                    label="Relation"
                    value={memberRelation}
                    options={relations}
                    onChange={setMemberRelation}
                    error={errors.relation}
                  />
                  <Field
                    label="Their phone"
                    value={memberPhone}
                    onChangeText={setMemberPhone}
                    placeholder="Optional"
                    keyboardType="phone-pad"
                    editable={!busy}
                  />

                  <Button label="Save and finish" onPress={saveFamily} loading={busy} fullWidth />
                </>
              )}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { borderTopColor: theme.line, paddingBottom: insets.bottom + 16 }]}>
        {step < STEPS.length - 1 ? (
          <Button label="Skip this step" variant="secondary" onPress={() => void forward()} disabled={busy} fullWidth />
        ) : null}

        <Button label="Finish later" variant="ghost" onPress={() => void close()} disabled={busy} fullWidth />

        {step > 0 ? (
          <Pressable onPress={() => setStep(step - 1)} disabled={busy}>
            <Text style={[styles.back, { color: theme.inkMuted }]}>Back</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => void signOut()} disabled={busy}>
            <Text style={[styles.back, { color: theme.inkMuted }]}>Sign out</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  head: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  percent: {
    fontSize: 13,
    fontWeight: '800',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  form: {
    gap: 16,
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingTop: 4,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  docLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  docHint: {
    fontSize: 12,
  },
  docMark: {
    fontSize: 20,
    fontWeight: '800',
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  back: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 8,
  },
})
