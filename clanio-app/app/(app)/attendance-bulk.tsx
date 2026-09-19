import { useCallback, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { ApiError, api, apiList } from '@/lib/api'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Employee = Record<string, any>

type Result = {
  date: string
  status: string
  marked: number
  skipped: { employee_code: string; reason: string }[]
}

const statuses: { key: string; label: string }[] = [
  { key: 'present', label: 'Present' },
  { key: 'half_day', label: 'Half day' },
  { key: 'absent', label: 'Absent' },
]

export default function BulkAttendanceScreen() {
  const theme = useTheme()

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState('present')
  const [chosen, setChosen] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<Employee[]> => {
    const list = await apiList<Employee>('/employees?per_page=200')

    return list.data
  }, [])

  const record = useResource<Employee[]>(load, [])
  const employees = record.data ?? []

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()

    if (needle === '') {
      return employees
    }

    return employees.filter((row) =>
      `${row.user?.name ?? ''} ${row.employee_code ?? ''}`.toLowerCase().includes(needle)
    )
  }, [employees, search])

  const toggle = (uuid: string) => {
    setResult(null)
    setChosen((current) =>
      current.includes(uuid) ? current.filter((id) => id !== uuid) : [...current, uuid]
    )
  }

  const allShown = shown.length > 0 && shown.every((row) => chosen.includes(row.uuid))

  const toggleAll = () => {
    setResult(null)
    setChosen(allShown ? [] : shown.map((row) => row.uuid))
  }

  const submit = async () => {
    if (busy || chosen.length === 0) {
      return
    }

    setBusy(true)
    setProblem(null)
    setResult(null)

    try {
      setResult(
        await api<Result>('/attendance/bulk', {
          method: 'POST',
          body: { date: date.trim(), status, employee_uuids: chosen },
        })
      )
      setChosen([])
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Mark nahi ho paaya.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Bulk Attendance">
        <Loader />
      </Screen>
    )
  }

  if (record.error !== null) {
    return (
      <Screen title="Bulk Attendance">
        <ErrorState message={record.error} onRetry={record.refresh} />
      </Screen>
    )
  }

  return (
    <Screen title="Bulk Attendance" subtitle={`${chosen.length} chune`}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {problem ? <Notice tone="danger" title="Nahi ho paaya" message={problem} /> : null}

        {result !== null ? (
          <Notice
            tone={result.skipped.length > 0 ? 'warning' : 'success'}
            title={`${result.marked} mark ho gaye`}
            message={
              result.skipped.length === 0
                ? `${result.date} · ${result.status}`
                : result.skipped.map((row) => `${row.employee_code} — ${row.reason}`).join('\n')
            }
          />
        ) : null}

        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Field label="Date" value={date} onChangeText={setDate} placeholder="2026-09-18" editable={!busy} />

          <Text style={[styles.label, { color: theme.inkSubtle }]}>Status</Text>
          <View style={styles.chips}>
            {statuses.map((row) => {
              const on = status === row.key

              return (
                <Pressable
                  key={row.key}
                  onPress={() => {
                    setStatus(row.key)
                    setResult(null)
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: on ? theme.brand : theme.canvas,
                      borderColor: on ? theme.brand : theme.line,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: on ? '#fff' : theme.ink }]}>{row.label}</Text>
                </Pressable>
              )
            })}
          </View>

          <Text style={[styles.hint, { color: theme.inkSubtle }]}>
            Weekly off, holiday aur approved leave wale apne aap chhoot jaayenge — unke naam baad me dikhenge.
          </Text>
        </View>

        <Field label="Employee dhoondo" value={search} onChangeText={setSearch} placeholder="Naam ya code" />

        <Pressable onPress={toggleAll} style={styles.selectAll}>
          <Text style={[styles.selectAllText, { color: theme.brand }]}>
            {allShown ? 'Sabko hatao' : `Saare ${shown.length} chuno`}
          </Text>
        </Pressable>

        {shown.length === 0 ? (
          <EmptyState title="Koi employee nahi" message="Search badal kar dekho." />
        ) : (
          shown.map((row) => {
            const on = chosen.includes(row.uuid)

            return (
              <Pressable
                key={row.uuid}
                onPress={() => toggle(row.uuid)}
                style={[
                  styles.row,
                  {
                    backgroundColor: on ? theme.brandSoft : theme.surface,
                    borderColor: on ? theme.brand : theme.line,
                  },
                ]}
              >
                <View style={[styles.box, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.brand : 'transparent' }]}>
                  {on ? <Text style={styles.tick}>✓</Text> : null}
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.name, { color: theme.ink }]} numberOfLines={1}>
                    {row.user?.name ?? 'Employee'}
                  </Text>
                  <Text style={[styles.code, { color: theme.inkSubtle }]}>
                    {row.employee_code} · {row.designation?.name ?? '—'}
                  </Text>
                </View>
              </Pressable>
            )
          })
        )}

        <Button
          label={`${chosen.length} employee ko ${statuses.find((s) => s.key === status)?.label ?? ''} mark karo`}
          onPress={() => void submit()}
          loading={busy}
          disabled={chosen.length === 0}
          fullWidth
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  label: { fontSize: font.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontSize: font.sm, fontWeight: '600' },
  hint: { fontSize: font.xs, lineHeight: 17 },
  selectAll: { paddingVertical: spacing.xs },
  selectAllText: { fontSize: font.sm, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontSize: 12, fontWeight: '800' },
  rowText: { flex: 1 },
  name: { fontSize: font.sm, fontWeight: '700' },
  code: { fontSize: font.xs },
})
