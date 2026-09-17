import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Select, type Option } from '@/components/ui/Select'
import { ErrorState, Loader } from '@/components/ui/States'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import {
  bloodGroups,
  employmentTypes,
  genders,
  loadFormOptions,
  managerHint,
  maritalStatuses,
  type FormOptions,
} from '@/lib/employeeOptions'
import type { Employee } from '@/lib/types'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, spacing } from '@/theme/tokens'

type Loaded = {
  employee: Employee
  options: FormOptions
}

export default function EmployeeEditScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { can } = useAuth()
  const { uuid } = useLocalSearchParams<{ uuid: string }>()

  const [designationId, setDesignationId] = useState<string | null>(null)
  const [shiftId, setShiftId] = useState<string | null>(null)
  const [managerId, setManagerId] = useState<string | null>(null)
  const [dateOfJoining, setDateOfJoining] = useState('')
  const [employmentType, setEmploymentType] = useState('full_time')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [fatherName, setFatherName] = useState('')
  const [gender, setGender] = useState<string | null>(null)
  const [maritalStatus, setMaritalStatus] = useState<string | null>(null)
  const [bloodGroup, setBloodGroup] = useState<string | null>(null)
  const [personalEmail, setPersonalEmail] = useState('')
  const [personalPhone, setPersonalPhone] = useState('')
  const [currentAddress, setCurrentAddress] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyRelation, setEmergencyRelation] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [panNumber, setPanNumber] = useState('')
  const [aadhaarNumber, setAadhaarNumber] = useState('')
  const [insurerName, setInsurerName] = useState('')
  const [insuranceNumber, setInsuranceNumber] = useState('')
  const [insuranceTill, setInsuranceTill] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<Loaded> => {
    const [employee, options] = await Promise.all([api<Employee>(`/employees/${uuid}`), loadFormOptions(can)])

    return { employee, options }
  }, [can, uuid])

  const record = useResource<Loaded>(load, [uuid])

  useEffect(() => {
    const employee = record.data?.employee

    if (!employee) {
      return
    }

    setDesignationId(employee.designation_id ? String(employee.designation_id) : null)
    setShiftId(employee.work_shift_id ? String(employee.work_shift_id) : null)
    setManagerId(employee.reporting_manager_id ? String(employee.reporting_manager_id) : null)
    setDateOfJoining(employee.date_of_joining ?? '')
    setEmploymentType(employee.employment_type ?? 'full_time')
    setDateOfBirth(employee.date_of_birth ?? '')
    setFatherName(employee.father_name ?? '')
    setGender(employee.gender ?? null)
    setMaritalStatus(employee.marital_status ?? null)
    setBloodGroup(employee.blood_group ?? null)
    setPersonalEmail(employee.personal_email ?? '')
    setPersonalPhone(employee.personal_phone ?? '')
    setCurrentAddress(employee.current_address ?? '')
    setEmergencyName(employee.emergency_contact_name ?? '')
    setEmergencyRelation(employee.emergency_contact_relation ?? '')
    setEmergencyPhone(employee.emergency_contact_phone ?? '')
    setPanNumber(employee.pan_number ?? '')
    setAadhaarNumber(employee.aadhaar_number ?? '')
    setInsurerName(employee.insurer_name ?? '')
    setInsuranceNumber(employee.insurance_number ?? '')
    setInsuranceTill(employee.insurance_valid_till ?? '')
  }, [record.data])

  const lists = useMemo(() => {
    const data = record.data?.options

    if (!data) {
      return { designations: [] as Option[], shifts: [] as Option[], managers: [] as Option[] }
    }

    return {
      designations: data.designations.map((row) => ({
        value: String(row.id),
        label: row.name,
        hint: row.department?.name ?? 'Any department',
      })),
      shifts: data.shifts.map((row) => ({
        value: String(row.id),
        label: row.name,
        hint: `${row.start_time?.slice(0, 5)} - ${row.end_time?.slice(0, 5)}`,
      })),
      managers: data.managers
        .filter((row) => row.id !== record.data?.employee.user_id)
        .map((row) => ({ value: String(row.id), label: row.name, hint: managerHint(row) })),
    }
  }, [record.data])

  const canEdit = can('employee.edit')
  const canDelete = can('employee.delete')

  const save = async () => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)
    setSaved(false)
    setErrors({})

    const body = {
      designation_id: designationId ? Number(designationId) : null,
      work_shift_id: shiftId ? Number(shiftId) : null,
      reporting_manager_id: managerId ? Number(managerId) : null,
      date_of_joining: dateOfJoining.trim(),
      employment_type: employmentType,
      date_of_birth: dateOfBirth.trim() || null,
      father_name: fatherName.trim() || null,
      gender,
      marital_status: maritalStatus,
      blood_group: bloodGroup,
      personal_email: personalEmail.trim() || null,
      personal_phone: personalPhone.trim() || null,
      current_address: currentAddress.trim() || null,
      emergency_contact_name: emergencyName.trim() || null,
      emergency_contact_relation: emergencyRelation.trim() || null,
      emergency_contact_phone: emergencyPhone.trim() || null,
      pan_number: panNumber.trim().toUpperCase() || null,
      aadhaar_number: aadhaarNumber.trim() || null,
      insurer_name: insurerName.trim() || null,
      insurance_number: insuranceNumber.trim() || null,
      insurance_valid_till: insuranceTill.trim() || null,
    }

    try {
      await api<Employee>(`/employees/${uuid}`, { method: 'PUT', body })
      setSaved(true)
    } catch (error) {
      handle(error)
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    const name = record.data?.employee.user?.name ?? 'This employee'

    Alert.alert('Remove employee?', `${name} will no longer appear anywhere and cannot sign in.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusy(true)

          try {
            await api(`/employees/${uuid}`, { method: 'DELETE' })
            router.replace('/employees')
          } catch (error) {
            handle(error)
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }

  const handle = (error: unknown) => {
    if (!(error instanceof ApiError)) {
      setProblem('Something went wrong. Please try again.')

      return
    }

    if (error.status === 422 && Object.keys(error.fields).length > 0) {
      const mapped: Record<string, string> = {}

      for (const [field, messages] of Object.entries(error.fields)) {
        mapped[field] = messages[0]
      }

      setErrors(mapped)
      setProblem('Check the highlighted fields.')

      return
    }

    setProblem(error.message)
  }

  if (record.loading) {
    return (
      <Screen title="Edit employee" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Edit employee" leading="back">
        <ErrorState message={record.error ?? 'Employee not found.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const { employee } = record.data

  return (
    <Screen
      title={employee.user?.name ?? 'Employee'}
      subtitle={employee.employee_code}
      leading="back"
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {problem ? <Notice tone="danger" title="Could not save" message={problem} /> : null}
          {saved ? <Notice tone="success" title="Saved" message="Employee details have been updated." /> : null}

          <Notice
            tone="info"
            title="Login details are separate"
            message="Name, work email and role live on the user account. Change those from Users."
          />

          <Text style={[styles.group, { color: theme.inkSubtle }]}>Job</Text>

          <Select
            label="Designation"
            value={designationId}
            options={lists.designations}
            onChange={setDesignationId}
            placeholder="No designation"
            allowClear
            error={errors.designation_id}
            disabled={!canEdit || busy}
          />
          <Select
            label="Reporting manager"
            value={managerId}
            options={lists.managers}
            onChange={setManagerId}
            placeholder="No manager"
            allowClear
            error={errors.reporting_manager_id}
            disabled={!canEdit || busy}
          />
          <Select
            label="Work shift"
            value={shiftId}
            options={lists.shifts}
            onChange={setShiftId}
            placeholder="Company default"
            allowClear
            error={errors.work_shift_id}
            disabled={!canEdit || busy}
          />
          <Field
            label="Date of joining"
            value={dateOfJoining}
            onChangeText={setDateOfJoining}
            placeholder="YYYY-MM-DD"
            error={errors.date_of_joining}
            editable={canEdit && !busy}
          />
          <Select
            label="Employment type"
            value={employmentType}
            options={employmentTypes}
            onChange={(value) => setEmploymentType(value ?? 'full_time')}
            error={errors.employment_type}
            disabled={!canEdit || busy}
          />

          <Text style={[styles.group, { color: theme.inkSubtle }]}>Personal</Text>

          <Field
            label="Date of birth"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="YYYY-MM-DD"
            error={errors.date_of_birth}
            editable={canEdit && !busy}
          />
          <Field
            label="Father's name"
            value={fatherName}
            onChangeText={setFatherName}
            placeholder="Ramesh Verma"
            autoCapitalize="words"
            error={errors.father_name}
            editable={canEdit && !busy}
          />
          <Select
            label="Gender"
            value={gender}
            options={genders}
            onChange={setGender}
            placeholder="Not set"
            allowClear
            error={errors.gender}
            disabled={!canEdit || busy}
          />
          <Select
            label="Marital status"
            value={maritalStatus}
            options={maritalStatuses}
            onChange={setMaritalStatus}
            placeholder="Not set"
            allowClear
            error={errors.marital_status}
            disabled={!canEdit || busy}
          />
          <Select
            label="Blood group"
            value={bloodGroup}
            options={bloodGroups}
            onChange={setBloodGroup}
            placeholder="Not set"
            allowClear
            error={errors.blood_group}
            disabled={!canEdit || busy}
          />
          <Field
            label="Personal email"
            value={personalEmail}
            onChangeText={setPersonalEmail}
            placeholder="Optional"
            keyboardType="email-address"
            error={errors.personal_email}
            editable={canEdit && !busy}
          />
          <Field
            label="Personal phone"
            value={personalPhone}
            onChangeText={setPersonalPhone}
            placeholder="Optional"
            keyboardType="phone-pad"
            error={errors.personal_phone}
            editable={canEdit && !busy}
          />
          <Field
            label="Current address"
            value={currentAddress}
            onChangeText={setCurrentAddress}
            placeholder="Optional"
            autoCapitalize="sentences"
            error={errors.current_address}
            editable={canEdit && !busy}
            multiline
          />

          <Text style={[styles.group, { color: theme.inkSubtle }]}>Emergency contact</Text>

          <Field
            label="Name"
            value={emergencyName}
            onChangeText={setEmergencyName}
            placeholder="Optional"
            autoCapitalize="words"
            error={errors.emergency_contact_name}
            editable={canEdit && !busy}
          />
          <Field
            label="Relation"
            value={emergencyRelation}
            onChangeText={setEmergencyRelation}
            placeholder="Father, spouse, sibling"
            autoCapitalize="words"
            error={errors.emergency_contact_relation}
            editable={canEdit && !busy}
          />
          <Field
            label="Phone"
            value={emergencyPhone}
            onChangeText={setEmergencyPhone}
            placeholder="Optional"
            keyboardType="phone-pad"
            error={errors.emergency_contact_phone}
            editable={canEdit && !busy}
          />

          <Text style={[styles.group, { color: theme.inkSubtle }]}>Statutory</Text>

          <Field
            label="PAN"
            value={panNumber}
            onChangeText={setPanNumber}
            placeholder="ABCDE1234F"
            autoCapitalize="characters"
            error={errors.pan_number}
            editable={canEdit && !busy}
          />
          <Field
            label="Aadhaar"
            value={aadhaarNumber}
            onChangeText={setAadhaarNumber}
            placeholder="12 digits"
            keyboardType="number-pad"
            error={errors.aadhaar_number}
            editable={canEdit && !busy}
          />

          <Text style={[styles.group, { color: theme.inkSubtle }]}>Insurance</Text>

          <Field
            label="Insurance company"
            value={insurerName}
            onChangeText={setInsurerName}
            placeholder="Star Health"
            error={errors.insurer_name}
            editable={canEdit && !busy}
          />
          <Field
            label="Policy / insurance ID"
            value={insuranceNumber}
            onChangeText={setInsuranceNumber}
            placeholder="P/1234/56/78"
            error={errors.insurance_number}
            editable={canEdit && !busy}
          />
          <Field
            label="Valid till"
            value={insuranceTill}
            onChangeText={setInsuranceTill}
            placeholder="2027-03-31"
            error={errors.insurance_valid_till}
            editable={canEdit && !busy}
          />

          <Text style={[styles.hint, { color: theme.inkSubtle }]}>
            Sirf record ke liye. Claim humare yahan se nahi hota — family me kaun cover hai wo Records me
            har member par mark karo.
          </Text>

          <View style={styles.actions}>
            {canEdit ? <Button label="Save changes" onPress={save} loading={busy} fullWidth /> : null}
            {canDelete ? (
              <Button label="Remove employee" variant="danger" onPress={remove} disabled={busy} fullWidth />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  group: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  hint: {
    fontSize: font.xs,
    lineHeight: 17,
    marginTop: -spacing.xs,
  },
  actions: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
})
