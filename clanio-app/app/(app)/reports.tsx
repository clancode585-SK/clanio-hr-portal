import { useCallback, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { ApiError, api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { downloadFile } from '@/lib/download'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Report = {
  key: string
  label: string
  hint: string
  param: 'month' | 'year' | 'range' | 'quarter' | 'fy' | 'none'
  group: string
  format?: string
}

type Built = {
  title: string
  period: string | null
  columns: string[] | null
  rows: (string | number)[][]
  lines?: string[]
  row_count: number
  truncated: boolean
  skipped?: string[]
}

export default function ReportsScreen() {
  const theme = useTheme()
  const { can } = useAuth()

  const [picked, setPicked] = useState<Report | null>(null)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`)
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))

  const [built, setBuilt] = useState<Built | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState<'run' | 'download' | 'form16' | null>(null)

  const [quarter, setQuarter] = useState('Q1')

  const load = useCallback(async (): Promise<{ reports: Report[] }> => {
    const [list, statutory] = await Promise.all([
      api<{ reports: Report[] }>('/reports'),
      api<{ returns: Report[] }>('/statutory-returns'),
    ])

    // Statutory returns usi screen par, alag group me
    return {
      reports: [
        ...list.reports,
        ...statutory.returns.map((row) => ({ ...row, group: 'Statutory returns' })),
      ],
    }
  }, [])

  const record = useResource<{ reports: Report[] }>(load, [])

  const canExport = can('report.export')

  const query = useMemo(() => {
    if (picked === null) {
      return ''
    }

    if (picked.param === 'month') {
      return `?month=${month.trim()}`
    }

    if (picked.param === 'year') {
      return `?year=${year.trim()}`
    }

    if (picked.param === 'range') {
      return `?from=${from.trim()}&to=${to.trim()}`
    }

    if (picked.param === 'quarter') {
      return `?quarter=${quarter.trim()}&year=${year.trim()}`
    }

    if (picked.param === 'fy') {
      return `?fy=${year.trim()}`
    }

    return ''
  }, [picked, month, year, from, to, quarter])

  const base = useMemo(
    () => (picked?.group === 'Statutory returns' ? '/statutory-returns' : '/reports'),
    [picked]
  )

  const run = async () => {
    if (picked === null || busy) {
      return
    }

    setBusy('run')
    setProblem(null)
    setBuilt(null)

    try {
      setBuilt(await api<Built>(`${base}/${picked.key}${query}`))
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Report nahi ban payi.')
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (picked === null || busy) {
      return
    }

    setBusy('download')
    setProblem(null)

    try {
      await downloadFile(`${base}/${picked.key}/download${query}`, `${picked.key}.${picked.format ?? 'csv'}`)
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'File download nahi hui.')
    } finally {
      setBusy(null)
    }
  }

  // Register ke saath hi sabka Part B ek file me — print karke sign kar do
  const bulkForm16 = async () => {
    if (busy) {
      return
    }

    setBusy('form16')
    setProblem(null)

    try {
      await downloadFile(`/form16/bulk?fy=${year.trim()}`, `Form16B-all-${year.trim()}.pdf`)
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Form 16 download nahi hua.')
    } finally {
      setBusy(null)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Reports">
        <Loader />
      </Screen>
    )
  }

  if (record.error !== null) {
    return (
      <Screen title="Reports">
        <ErrorState message={record.error} onRetry={record.refresh} />
      </Screen>
    )
  }

  const reports = record.data?.reports ?? []
  const groups = [...new Set(reports.map((row) => row.group))]

  return (
    <Screen title="Reports" subtitle={`${reports.length} report · CSV download`}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {problem ? <Notice tone="danger" title="Nahi ho paaya" message={problem} /> : null}

        {!canExport ? (
          <Notice
            tone="info"
            title="Sirf dekh sakte ho"
            message="Download ka haq nahi hai — report screen par dikh jayegi, file nahi milegi."
          />
        ) : null}

        {groups.map((group) => (
          <View key={group}>
            <Text style={[styles.group, { color: theme.inkSubtle }]}>{group}</Text>

            {reports
              .filter((row) => row.group === group)
              .map((row) => {
                const on = picked?.key === row.key

                return (
                  <Pressable
                    key={row.key}
                    onPress={() => {
                      setPicked(on ? null : row)
                      setBuilt(null)
                      setProblem(null)
                    }}
                    style={({ pressed }) => [
                      styles.card,
                      {
                        backgroundColor: pressed ? theme.canvas : theme.surface,
                        borderColor: on ? theme.brand : theme.line,
                      },
                    ]}
                  >
                    <Text style={[styles.label, { color: theme.ink }]}>{row.label}</Text>
                    <Text style={[styles.hint, { color: theme.inkMuted }]}>{row.hint}</Text>
                  </Pressable>
                )
              })}
          </View>
        ))}

        {picked !== null ? (
          <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.panelTitle, { color: theme.ink }]}>{picked.label}</Text>

            {picked.param === 'month' ? (
              <Field label="Mahina" value={month} onChangeText={setMonth} placeholder="2026-09" editable={!busy} />
            ) : null}

            {picked.param === 'year' ? (
              <Field label="Saal" value={year} onChangeText={setYear} keyboardType="numeric" placeholder="2026" editable={!busy} />
            ) : null}

            {picked.param === 'fy' ? (
              <>
                <Field label="Financial year" value={year} onChangeText={setYear} keyboardType="numeric" placeholder="2026" editable={!busy} />
                <Text style={[styles.hint, { color: theme.inkSubtle }]}>
                  Shuru ka saal likho — 2026 matlab FY 2026-27 (Apr 2026 se Mar 2027)
                </Text>
              </>
            ) : null}

            {picked.param === 'range' ? (
              <>
                <Field label="From" value={from} onChangeText={setFrom} placeholder="2026-01-01" editable={!busy} />
                <Field label="To" value={to} onChangeText={setTo} placeholder="2026-12-31" editable={!busy} />
              </>
            ) : null}

            {picked.param === 'quarter' ? (
              <>
                <Field label="Quarter" value={quarter} onChangeText={setQuarter} placeholder="Q1" editable={!busy} />
                <Field label="Saal" value={year} onChangeText={setYear} keyboardType="numeric" placeholder="2026" editable={!busy} />
                <Text style={[styles.hint, { color: theme.inkSubtle }]}>
                  Financial year ka quarter — Q1 April se shuru
                </Text>
              </>
            ) : null}

            <View style={styles.actions}>
              <Button label="Dekho" onPress={() => void run()} loading={busy === 'run'} />
              {canExport ? (
                <Button
                  label={`${(picked.format ?? 'csv').toUpperCase()} download`}
                  variant="secondary"
                  onPress={() => void save()}
                  loading={busy === 'download'}
                />
              ) : null}
              {canExport && picked.key === 'form16-register' ? (
                <Button
                  label="Sabka Form 16 download"
                  variant="secondary"
                  onPress={() => void bulkForm16()}
                  loading={busy === 'form16'}
                />
              ) : null}
            </View>

            {picked.key === 'form16-register' ? (
              <Text style={[styles.hint, { color: theme.inkSubtle }]}>
                Ek hi file me sabka Part B — har employee naye page par. Jinka TDS 0 hai unko
                salary certificate dena kaafi hai.
              </Text>
            ) : null}
          </View>
        ) : null}

        {built !== null ? (
          <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.panelTitle, { color: theme.ink }]}>
              {built.title}
              {built.period ? ` · ${built.period}` : ''}
            </Text>
            <Text style={[styles.hint, { color: theme.inkMuted }]}>
              {built.row_count} row{built.row_count === 1 ? '' : 's'}
              {built.truncated ? ' · screen par sirf pehle 100, file me poora' : ''}
            </Text>

            {(built.skipped ?? []).length > 0 ? (
              <Notice
                tone="warning"
                title={`${built.skipped?.length} employee chhoote`}
                message={(built.skipped ?? []).join(' · ')}
              />
            ) : null}

            {built.row_count === 0 ? (
              <EmptyState title="Koi data nahi" message="Is period me kuch nahi mila." />
            ) : built.columns === null ? (
              // ECR text file — column nahi, seedhi line hoti hai
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  {(built.lines ?? []).map((line, index) => (
                    <Text key={index} style={[styles.line, { color: theme.ink }]} numberOfLines={1}>
                      {line}
                    </Text>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  <View style={[styles.row, { borderBottomColor: theme.line }]}>
                    {built.columns.map((column) => (
                      <Text key={column} style={[styles.head, { color: theme.inkSubtle }]} numberOfLines={1}>
                        {column}
                      </Text>
                    ))}
                  </View>

                  {built.rows.map((row, index) => (
                    <View key={index} style={[styles.row, { borderBottomColor: theme.line }]}>
                      {row.map((cell, cellIndex) => (
                        <Text key={cellIndex} style={[styles.cell, { color: theme.ink }]} numberOfLines={1}>
                          {String(cell)}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  group: { fontSize: font.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.xs },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, gap: 2 },
  label: { fontSize: font.md, fontWeight: '700' },
  hint: { fontSize: font.xs, lineHeight: 17 },
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  panelTitle: { fontSize: font.md, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  row: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 6 },
  head: { width: 120, fontSize: font.xs, fontWeight: '800', paddingRight: spacing.sm },
  cell: { width: 120, fontSize: font.xs, paddingRight: spacing.sm },
  line: { fontSize: font.xs, fontFamily: 'monospace', paddingVertical: 3 },
})
