import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Select, type Option } from '@/components/ui/Select'
import { ErrorState, Loader } from '@/components/ui/States'
import { Stepper } from '@/components/ui/Stepper'
import { today } from '@/lib/clock'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { employmentTypes, loadFormOptions, managerHint, type FormOptions } from '@/lib/employeeOptions'
import type { Employee } from '@/lib/types'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

const steps = ['Person', 'Placement', 'Job details', 'Review']

type Form = {
  name: string
  email: string
  password: string
  phone: string
  fatherName: string
  dateOfBirth: string
  branchId: string | null
  departmentId: string | null
  teamId: string | null
  roleId: string | null
  designationId: string | null
  managerId: string | null
  shiftId: string | null
  dateOfJoining: string
  employmentType: string
  employeeCode: string
}

function blank(): Form {
  return {
    name: '',
    email: '',
    password: '',
    phone: '',
    fatherName: '',
    dateOfBirth: '',
    branchId: null,
    departmentId: null,
    teamId: null,
    roleId: null,
    designationId: null,
    managerId: null,
    shiftId: null,
    dateOfJoining: today(),
    employmentType: 'full_time',
    employeeCode: '',
  }
}

export default function EmployeeCreateScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { can } = useAuth()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Form>(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => loadFormOptions(can), [can])
  const options = useResource<FormOptions>(load, [])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [String(key)]: '' }))
  }

  const lists = useMemo(() => {
    const data = options.data

    if (!data) {
      return {
        branches: [] as Option[],
        departments: [] as Option[],
        teams: [] as Option[],
        roles: [] as Option[],
        designations: [] as Option[],
        managers: [] as Option[],
        shifts: [] as Option[],
      }
    }

    const departmentId = form.departmentId ? Number(form.departmentId) : null

    return {
      branches: data.branches.map((row) => ({
        value: String(row.id),
        label: row.name,
        hint: row.is_head_office ? 'Head office' : row.code,
      })),
      departments: data.departments.map((row) => ({ value: String(row.id), label: row.name, hint: row.code })),
      teams: data.teams
        .filter((row) => departmentId === null || row.department_id === departmentId)
        .map((row) => ({ value: String(row.id), label: row.name, hint: row.department?.name })),
      roles: data.roles
        .filter((row) => !row.is_system)
        .map((row) => ({ value: String(row.id), label: row.name, hint: scopeLabel(row.data_scope) })),
      designations: data.designations
        .filter((row) => departmentId === null || row.department_id === null || row.department_id === departmentId)
        .map((row) => ({ value: String(row.id), label: row.name, hint: row.department?.name ?? 'Any department' })),
      managers: data.managers.map((row) => ({ value: String(row.id), label: row.name, hint: managerHint(row) })),
      shifts: data.shifts.map((row) => ({
        value: String(row.id),
        label: row.name,
        hint: `${row.start_time?.slice(0, 5)} - ${row.end_time?.slice(0, 5)}${row.is_default ? ' · default' : ''}`,
      })),
    }
  }, [options.data, form.departmentId])

  const validateStep = (): boolean => {
    const next: Record<string, string> = {}

    if (step === 0) {
      if (!form.name.trim()) {
        next.name = 'Name is required'
      }

      if (!form.email.trim()) {
        next.email = 'Email is required'
      } else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
        next.email = 'Enter a valid email'
      }

      if (form.password.length < 8) {
        next.password = 'At least 8 characters'
      } else if (!/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password)) {
        next.password = 'Must contain letters and numbers'
      }

      if (!form.fatherName.trim()) {
        next.fatherName = "Father's name is required"
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth.trim())) {
        next.dateOfBirth = 'Date of birth is required as YYYY-MM-DD'
      } else if (form.dateOfBirth.trim() >= today()) {
        next.dateOfBirth = 'That date has not happened yet'
      }
    }

    if (step === 1 && !form.roleId) {
      next.roleId = 'Pick a role'
    }

    if (step === 2 && !form.dateOfJoining.trim()) {
      next.dateOfJoining = 'Joining date is required'
    }

    setErrors(next)

    return Object.keys(next).length === 0
  }

  const next = () => {
    if (!validateStep()) {
      return
    }

    setProblem(null)
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  const back = () => {
    setProblem(null)
    setStep((current) => Math.max(current - 1, 0))
  }

  const submit = async () => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)
    setErrors({})

    const body: Record<string, unknown> = {
      user: {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim() || null,
        branch_id: form.branchId ? Number(form.branchId) : null,
        department_id: form.departmentId ? Number(form.departmentId) : null,
        team_id: form.teamId ? Number(form.teamId) : null,
        role_ids: form.roleId ? [Number(form.roleId)] : [],
      },
      designation_id: form.designationId ? Number(form.designationId) : null,
      work_shift_id: form.shiftId ? Number(form.shiftId) : null,
      reporting_manager_id: form.managerId ? Number(form.managerId) : null,
      date_of_joining: form.dateOfJoining.trim(),
      employment_type: form.employmentType,
      father_name: form.fatherName.trim(),
      date_of_birth: form.dateOfBirth.trim(),
    }

    if (form.employeeCode.trim()) {
      body.employee_code = form.employeeCode.trim().toUpperCase()
    }

    try {
      const created = await api<Employee>('/employees', { method: 'POST', body })

      router.replace(`/permissions?type=employee&id=${created.user_id}` as never)
    } catch (error) {
      handle(error)
    } finally {
      setBusy(false)
    }
  }

  const handle = (error: unknown) => {
    if (!(error instanceof ApiError)) {
      setProblem('Something went wrong. Please try again.')

      return
    }

    if (error.status === 422 && Object.keys(error.fields).length > 0) {
      const mapped: Record<string, string> = {}
      let firstStep = step

      for (const [field, messages] of Object.entries(error.fields)) {
        const key = fieldKey(field)

        mapped[key] = messages[0]
        firstStep = Math.min(firstStep, stepOf(key))
      }

      setErrors(mapped)
      setStep(firstStep)
      setProblem('Check the highlighted fields.')

      return
    }

    setProblem(error.message)
  }

  if (options.loading) {
    return (
      <Screen title="New employee" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (options.error || !options.data) {
    return (
      <Screen title="New employee" leading="back">
        <ErrorState message={options.error ?? 'Could not load form data.'} onRetry={options.reload} />
      </Screen>
    )
  }

  const missingShift = options.data.shifts.length === 0
  const missingRole = lists.roles.length === 0

  return (
    <Screen title="New employee" subtitle={steps[step]} leading="back">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Stepper steps={steps} current={step} />

          {problem ? <Notice tone="danger" title="Could not save" message={problem} /> : null}

          {step === 0 ? (
            <>
              <Field
                label="Full name"
                value={form.name}
                onChangeText={(value) => set('name', value)}
                placeholder="Rahul Verma"
                autoCapitalize="words"
                error={errors.name}
                editable={!busy}
              />
              <Field
                label="Work email"
                value={form.email}
                onChangeText={(value) => set('email', value)}
                placeholder="rahul@company.com"
                keyboardType="email-address"
                error={errors.email}
                editable={!busy}
              />
              <Field
                label="Temporary password"
                value={form.password}
                onChangeText={(value) => set('password', value)}
                placeholder="At least 8 characters"
                secure
                error={errors.password}
                editable={!busy}
              />
              <Field
                label="Phone"
                value={form.phone}
                onChangeText={(value) => set('phone', value)}
                placeholder="Optional"
                keyboardType="phone-pad"
                error={errors.phone}
                editable={!busy}
              />
              <Field
                label="Father's name"
                value={form.fatherName}
                onChangeText={(value) => set('fatherName', value)}
                placeholder="Ramesh Verma"
                autoCapitalize="words"
                error={errors.fatherName}
                editable={!busy}
              />
              <Field
                label="Date of birth"
                value={form.dateOfBirth}
                onChangeText={(value) => set('dateOfBirth', value)}
                placeholder="YYYY-MM-DD"
                error={errors.dateOfBirth}
                editable={!busy}
              />
              <Notice
                tone="info"
                title="They fill the rest themselves"
                message="On their first login they accept the policies, then get a form for address, bank, documents and nominee. They can skip it and finish later."
              />
            </>
          ) : null}

          {step === 1 ? (
            <>
              {missingRole ? (
                <Notice
                  tone="warning"
                  title="No role to assign"
                  message="Create at least one role before adding people, otherwise they cannot sign in with any access."
                />
              ) : null}

              <Select
                label="Branch"
                value={form.branchId}
                options={lists.branches}
                onChange={(value) => set('branchId', value)}
                placeholder="No branch"
                allowClear
                error={errors.branchId}
                disabled={busy}
              />
              <Select
                label="Department"
                value={form.departmentId}
                options={lists.departments}
                onChange={(value) => {
                  set('departmentId', value)
                  set('teamId', null)
                  set('designationId', null)
                }}
                placeholder="No department"
                allowClear
                error={errors.departmentId}
                disabled={busy}
              />
              <Select
                label="Team"
                value={form.teamId}
                options={lists.teams}
                onChange={(value) => set('teamId', value)}
                placeholder="No team"
                allowClear
                error={errors.teamId}
                disabled={busy}
              />
              <Select
                label="Role"
                value={form.roleId}
                options={lists.roles}
                onChange={(value) => set('roleId', value)}
                placeholder="Select role"
                error={errors.roleId}
                disabled={busy}
              />
              <Select
                label="Designation"
                value={form.designationId}
                options={lists.designations}
                onChange={(value) => set('designationId', value)}
                placeholder="No designation"
                allowClear
                error={errors.designationId}
                disabled={busy}
              />
              <Select
                label="Reporting manager"
                value={form.managerId}
                options={lists.managers}
                onChange={(value) => set('managerId', value)}
                placeholder="No manager"
                allowClear
                error={errors.managerId}
                disabled={busy}
              />
              <Notice
                tone="info"
                title="Why the manager matters"
                message="Leave, expense and exit requests go to this person. Without it they land nowhere."
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              {missingShift ? (
                <Notice
                  tone="warning"
                  title="No work shift yet"
                  message="Attendance and leave need a shift. Create one under Setup before this person starts."
                />
              ) : null}

              <Field
                label="Date of joining"
                value={form.dateOfJoining}
                onChangeText={(value) => set('dateOfJoining', value)}
                placeholder="YYYY-MM-DD"
                error={errors.dateOfJoining}
                editable={!busy}
              />
              <Select
                label="Employment type"
                value={form.employmentType}
                options={employmentTypes}
                onChange={(value) => set('employmentType', value ?? 'full_time')}
                error={errors.employmentType}
                disabled={busy}
              />
              <Select
                label="Work shift"
                value={form.shiftId}
                options={lists.shifts}
                onChange={(value) => set('shiftId', value)}
                placeholder="Company default"
                allowClear
                error={errors.shiftId}
                disabled={busy}
              />
              <Field
                label="Employee code"
                value={form.employeeCode}
                onChangeText={(value) => set('employeeCode', value)}
                placeholder="Leave blank to auto-generate"
                autoCapitalize="characters"
                error={errors.employeeCode}
                editable={!busy}
              />
            </>
          ) : null}

          {step === 3 ? (
            <View style={[styles.review, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Line label="Name" value={form.name} />
              <Line label="Email" value={form.email} />
              <Line label="Phone" value={form.phone || '—'} />
              <Line label="Father" value={form.fatherName} />
              <Line label="Born" value={form.dateOfBirth} />
              <Line label="Branch" value={labelOf(lists.branches, form.branchId)} />
              <Line label="Department" value={labelOf(lists.departments, form.departmentId)} />
              <Line label="Team" value={labelOf(lists.teams, form.teamId)} />
              <Line label="Role" value={labelOf(lists.roles, form.roleId)} />
              <Line label="Designation" value={labelOf(lists.designations, form.designationId)} />
              <Line label="Manager" value={labelOf(lists.managers, form.managerId)} />
              <Line label="Joining" value={form.dateOfJoining} />
              <Line label="Type" value={labelOf(employmentTypes, form.employmentType)} />
              <Line label="Shift" value={labelOf(lists.shifts, form.shiftId)} />
              <Line label="Code" value={form.employeeCode || 'Auto'} />
            </View>
          ) : null}

          <View style={styles.actions}>
            {step < steps.length - 1 ? (
              <Button label="Continue" onPress={next} disabled={busy} fullWidth />
            ) : (
              <Button label="Create employee" onPress={submit} loading={busy} fullWidth />
            )}

            {step > 0 ? <Button label="Back" variant="secondary" onPress={back} disabled={busy} fullWidth /> : null}
          </View>

          {step === steps.length - 1 ? (
            <Text style={[styles.hint, { color: theme.inkSubtle }]}>
              After creating, you land on the permission screen with their role and department already applied.
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

function scopeLabel(scope: string): string {
  return (
    {
      all_company: 'Whole company',
      branch: 'Own branch',
      department: 'Own department',
      team: 'Own team',
      self: 'Own data only',
    }[scope] ?? scope
  )
}

function labelOf(options: Option[], value: string | null): string {
  if (!value) {
    return '—'
  }

  return options.find((option) => option.value === value)?.label ?? '—'
}

function fieldKey(field: string): string {
  return (
    {
      'user.name': 'name',
      'user.email': 'email',
      'user.password': 'password',
      'user.phone': 'phone',
      'user.branch_id': 'branchId',
      'user.department_id': 'departmentId',
      'user.team_id': 'teamId',
      'user.role_ids': 'roleId',
      'user.role_ids.0': 'roleId',
      designation_id: 'designationId',
      reporting_manager_id: 'managerId',
      work_shift_id: 'shiftId',
      date_of_joining: 'dateOfJoining',
      employment_type: 'employmentType',
      employee_code: 'employeeCode',
    }[field] ?? field
  )
}

function stepOf(key: string): number {
  if (['name', 'email', 'password', 'phone'].includes(key)) {
    return 0
  }

  if (['branchId', 'departmentId', 'teamId', 'roleId', 'designationId', 'managerId'].includes(key)) {
    return 1
  }

  return 2
}

function Line({ label, value }: { label: string; value: string }) {
  const theme = useTheme()

  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, { color: theme.inkMuted }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.lineValue, { color: theme.ink }]}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  review: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: 9,
  },
  lineLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  lineValue: {
    flexShrink: 1,
    fontSize: font.sm,
    fontWeight: '600',
    textAlign: 'right',
  },
  actions: {
    gap: spacing.md,
  },
  hint: {
    fontSize: font.sm,
    textAlign: 'center',
    lineHeight: 19,
  },
})
