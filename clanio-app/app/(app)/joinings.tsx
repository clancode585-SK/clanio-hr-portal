import { useCallback, useEffect, useState } from 'react'
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Select, type Option } from '@/components/ui/Select'
import { ErrorState, Loader } from '@/components/ui/States'
import { formatWeekday } from '@/lib/clock'
import { ApiError, api, apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { money } from '@/lib/plans'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Joiner = {
  application_uuid: string
  candidate: string
  email: string
  phone: string
  role: string
  designation: string | null
  joining_date: string
  days_away: number
  annual_ctc: number | null
  letter_number: string | null
}

type Pipeline = {
  overdue: Joiner[]
  this_week: Joiner[]
  later: Joiner[]
  total: number
  joined_this_month: number
}

type Lists = {
  roles: Option[]
  departments: Option[]
  designations: Option[]
  branches: Option[]
  teams: Option[]
  shifts: Option[]
  managers: Option[]
}

const blank: Lists = {
  roles: [],
  departments: [],
  designations: [],
  branches: [],
  teams: [],
  shifts: [],
  managers: [],
}

export default function JoiningsScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { can } = useAuth()

  const load = useCallback(() => api<Pipeline>('/joinings'), [])
  const record = useResource<Pipeline>(load, [])
  const canConvert = can('employee.create')

  const [lists, setLists] = useState<Lists>(blank)

  useEffect(() => {
    let live = true

    const pull = async (path: string, label: (row: any) => string, hint?: (row: any) => string | undefined) => {
      try {
        const result = await apiList<Record<string, any>>(path)

        return result.data.map((row) => ({ value: String(row.id), label: label(row), hint: hint?.(row) }))
      } catch {
        return [] as Option[]
      }
    }

    void Promise.all([
      pull('/roles?per_page=100', (row) => row.name, (row) => (row.is_system ? 'System role' : undefined)),
      pull('/departments?per_page=100', (row) => row.name),
      pull('/designations?per_page=100', (row) => row.name, (row) => row.department?.name),
      pull('/branches?per_page=100', (row) => row.name),
      pull('/teams?per_page=100', (row) => row.name, (row) => row.department?.name),
      pull('/work-shifts?per_page=100', (row) => row.name),
      api<Record<string, any>[]>('/employees/reporting-managers')
        .then((rows) => rows.map((row) => ({ value: String(row.id), label: row.name, hint: row.designation ?? undefined })))
        .catch(() => [] as Option[]),
    ]).then(([roles, departments, designations, branches, teams, shifts, managers]) => {
      if (live) {
        setLists({ roles, departments, designations, branches, teams, shifts, managers })
      }
    })

    return () => {
      live = false
    }
  }, [])

  const [open, setOpen] = useState<Joiner | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [department, setDepartment] = useState<string | null>(null)
  const [designation, setDesignation] = useState<string | null>(null)
  const [branch, setBranch] = useState<string | null>(null)
  const [team, setTeam] = useState<string | null>(null)
  const [shift, setShift] = useState<string | null>(null)
  const [manager, setManager] = useState<string | null>(null)
  const [workEmail, setWorkEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const sheet = (joiner: Joiner) => {
    setOpen(joiner)
    setRole(null)
    setDepartment(null)
    setDesignation(null)
    setBranch(null)
    setTeam(null)
    setShift(null)
    setManager(null)
    setWorkEmail('')
    setProblem(null)
    setDone(null)
  }

  const convert = async () => {
    if (!open || busy) {
      return
    }

    if (role === null) {
      setProblem('Pick the role this person gets in the workspace.')

      return
    }

    setBusy(true)
    setProblem(null)

    try {
      const employee = await api<Record<string, any>>(`/applications/${open.application_uuid}/convert`, {
        method: 'POST',
        body: {
          role_id: Number(role),
          ...(workEmail.trim() ? { work_email: workEmail.trim().toLowerCase() } : {}),
          ...(department ? { department_id: Number(department) } : {}),
          ...(designation ? { designation_id: Number(designation) } : {}),
          ...(branch ? { branch_id: Number(branch) } : {}),
          ...(team ? { team_id: Number(team) } : {}),
          ...(shift ? { work_shift_id: Number(shift) } : {}),
          ...(manager ? { reporting_manager_id: Number(manager) } : {}),
        },
      })

      setOpen(null)
      setDone(`${open.candidate} is on the roll as ${employee.employee_code}. Onboarding has started.`)
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not put this person on the roll.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Joining Soon">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Joining Soon">
        <ErrorState message={record.error ?? 'Could not load the joining pipeline.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const pipeline = record.data
  const groups: { key: string; title: string; hint: string; rows: Joiner[]; tone: 'danger' | 'warning' | 'plain' }[] = [
    {
      key: 'overdue',
      title: 'Their date has passed',
      hint: 'Put them on the roll, or fix the date on the offer.',
      rows: pipeline.overdue,
      tone: 'danger',
    },
    { key: 'this_week', title: 'Joining this week', hint: 'Get their workspace ready.', rows: pipeline.this_week, tone: 'warning' },
    { key: 'later', title: 'Later', hint: 'Accepted, waiting for their date.', rows: pipeline.later, tone: 'plain' },
  ]

  return (
    <Screen
      title="Joining Soon"
      subtitle={pipeline.total === 0 ? 'Nobody waiting' : `${pipeline.total} accepted, waiting to join`}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {done ? <Notice tone="success" title="Done" message={done} /> : null}

        <View style={styles.stats}>
          <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.statValue, { color: pipeline.overdue.length > 0 ? theme.danger : theme.inkSubtle }]}>
              {pipeline.overdue.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.inkMuted }]}>Date passed</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.statValue, { color: pipeline.this_week.length > 0 ? theme.warning : theme.inkSubtle }]}>
              {pipeline.this_week.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.inkMuted }]}>This week</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.statValue, { color: theme.success }]}>{pipeline.joined_this_month}</Text>
            <Text style={[styles.statLabel, { color: theme.inkMuted }]}>Joined this month</Text>
          </View>
        </View>

        {pipeline.total === 0 ? (
          <Notice
            tone="info"
            title="Nobody waiting to join"
            message="Candidates show up here once they accept their offer letter. From here you put them on the roll and onboarding starts."
          />
        ) : null}

        {groups
          .filter((group) => group.rows.length > 0)
          .map((group) => (
            <View key={group.key} style={styles.group}>
              <Text style={[styles.groupTitle, { color: groupInk(theme, group.tone) }]}>{group.title}</Text>
              <Text style={[styles.groupHint, { color: theme.inkSubtle }]}>{group.hint}</Text>

              {group.rows.map((row) => (
                <Pressable
                  key={row.application_uuid}
                  onPress={() => (canConvert ? sheet(row) : undefined)}
                  style={({ pressed }) => [
                    styles.card,
                    {
                      backgroundColor: pressed && canConvert ? theme.canvas : theme.surface,
                      borderColor: group.tone === 'danger' ? theme.danger : theme.line,
                    },
                  ]}
                >
                  <View style={styles.head}>
                    <Text numberOfLines={1} style={[styles.name, { color: theme.ink }]}>
                      {row.candidate}
                    </Text>
                    <Text style={[styles.away, { color: groupInk(theme, group.tone) }]}>{awayWord(row.days_away)}</Text>
                  </View>

                  <Text style={[styles.meta, { color: theme.inkMuted }]}>
                    {row.designation ?? row.role}
                  </Text>

                  <Text style={[styles.meta, { color: theme.inkSubtle }]}>
                    {when(row.joining_date)}
                    {row.annual_ctc ? ` · ${money(row.annual_ctc)}` : ''}
                    {row.letter_number ? ` · ${row.letter_number}` : ''}
                  </Text>

                  <Text style={[styles.meta, { color: theme.inkSubtle }]}>
                    {row.email} · {row.phone}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}

        {canConvert ? null : (
          <Notice
            tone="info"
            title="Read only"
            message="Only someone who can add employees may put a candidate on the roll."
          />
        )}
      </ScrollView>

      <Modal visible={open !== null} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, borderColor: theme.line, paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <View style={[styles.sheetHead, { borderBottomColor: theme.line }]}>
            <Text style={[styles.sheetTitle, { color: theme.ink }]}>{open?.candidate ?? ''}</Text>
            <Pressable onPress={() => setOpen(null)} hitSlop={10}>
              <Text style={[styles.close, { color: theme.inkSubtle }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {open ? (
              <>
                {problem ? <Notice tone="danger" title="Could not do that" message={problem} /> : null}

                <Row label="Joining on" value={when(open.joining_date)} strong />
                <Row label="For" value={open.role} />
                {open.designation ? <Row label="Offered as" value={open.designation} /> : null}
                {open.annual_ctc ? <Row label="Annual CTC" value={money(open.annual_ctc)} /> : null}
                {open.letter_number ? <Row label="Offer letter" value={open.letter_number} /> : null}
                <Row label="Personal email" value={open.email} />
                <Row label="Phone" value={open.phone} />

                <Notice
                  tone="info"
                  title="What happens next"
                  message="A login and an employee record are made, the joining date comes from the offer, and onboarding starts. HR gets told, and so does the new joiner."
                />

                <Select
                  label="Role in the workspace"
                  value={role}
                  options={lists.roles}
                  onChange={setRole}
                  placeholder="Pick a role"
                  disabled={busy}
                />

                <Field
                  label="Work email"
                  value={workEmail}
                  onChangeText={setWorkEmail}
                  placeholder={open.email}
                  keyboardType="email-address"
                  editable={!busy}
                  maxLength={200}
                />

                <Select
                  label="Department"
                  value={department}
                  options={lists.departments}
                  onChange={setDepartment}
                  placeholder="Not set"
                  allowClear
                  disabled={busy}
                />

                <Select
                  label="Designation"
                  value={designation}
                  options={lists.designations}
                  onChange={setDesignation}
                  placeholder="From the opening"
                  allowClear
                  disabled={busy}
                />

                <Select
                  label="Reporting manager"
                  value={manager}
                  options={lists.managers}
                  onChange={setManager}
                  placeholder="Not set"
                  allowClear
                  disabled={busy}
                />

                <Select
                  label="Branch"
                  value={branch}
                  options={lists.branches}
                  onChange={setBranch}
                  placeholder="Not set"
                  allowClear
                  disabled={busy}
                />

                <Select
                  label="Team"
                  value={team}
                  options={lists.teams}
                  onChange={setTeam}
                  placeholder="Not set"
                  allowClear
                  disabled={busy}
                />

                <Select
                  label="Work shift"
                  value={shift}
                  options={lists.shifts}
                  onChange={setShift}
                  placeholder="Company default"
                  allowClear
                  disabled={busy}
                />

                <Button label="Put on the roll" onPress={convert} loading={busy} fullWidth />
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  )
}

function Row({ label, value, strong = false }: { label: string; value?: string | null; strong?: boolean }) {
  const theme = useTheme()

  if (value === null || value === undefined || value === '') {
    return null
  }

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.inkMuted }]}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          { color: strong ? theme.ink : theme.inkMuted, fontWeight: strong ? '800' : '600' },
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

function awayWord(days: number): string {
  if (days < -1) {
    return `${Math.abs(days)} days late`
  }

  if (days === -1) {
    return 'Yesterday'
  }

  if (days === 0) {
    return 'Today'
  }

  if (days === 1) {
    return 'Tomorrow'
  }

  return `in ${days} days`
}

function when(value: string): string {
  return formatWeekday(value)
}

function groupInk(theme: ReturnType<typeof useTheme>, tone: 'danger' | 'warning' | 'plain'): string {
  if (tone === 'danger') {
    return theme.danger
  }

  if (tone === 'warning') {
    return theme.warning
  }

  return theme.inkMuted
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: font.xs,
    textAlign: 'center',
  },
  group: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  groupTitle: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  groupHint: {
    fontSize: font.xs,
    marginBottom: spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 2,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: font.md,
    fontWeight: '700',
  },
  away: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  meta: {
    fontSize: font.xs,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 17, 33, 0.45)',
  },
  sheet: {
    maxHeight: '88%',
    borderTopWidth: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sheetTitle: {
    fontSize: font.lg,
    fontWeight: '800',
  },
  close: {
    fontSize: font.lg,
  },
  sheetBody: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowLabel: {
    fontSize: font.sm,
    flexShrink: 0,
  },
  rowValue: {
    fontSize: font.sm,
    flex: 1,
    textAlign: 'right',
  },
})
