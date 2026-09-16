import { useCallback, useMemo, useState } from 'react'
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
import { Icon, type IconName } from '@/components/ui/Icon'
import { Notice } from '@/components/ui/Notice'
import { ErrorState, Loader } from '@/components/ui/States'
import { api, ApiError } from '@/lib/api'
import { downloadText } from '@/lib/download'
import { useResource } from '@/lib/useResource'
import { pickFile, toFormData, type PickedFile } from '@/lib/upload'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Column = {
  name: string
  required: boolean
  note: string
}

type Module = {
  module: string
  label: string
  step: string
  hint: string
  needs: string[]
  allowed: boolean
  columns: Column[]
}

type Result = {
  module: string
  file: string
  total: number
  created: number
  updated: number
  failed: number
  failures: { row: number; reference: string; message: string }[]
}

const steps: { key: string; title: string; hint: string }[] = [
  { key: 'foundation', title: 'Start here', hint: 'Nothing else depends on these' },
  { key: 'structure', title: 'Then structure', hint: 'Needs departments in place' },
  { key: 'people', title: 'Then people', hint: 'Needs the setup above' },
  { key: 'records', title: 'Finally records', hint: 'Needs employees in place' },
]

const icons: Record<string, IconName> = {
  departments: 'business-outline',
  designations: 'ribbon-outline',
  branches: 'location-outline',
  work_shifts: 'timer-outline',
  leave_types: 'albums-outline',
  holidays: 'sunny-outline',
  teams: 'people-circle-outline',
  employees: 'people-outline',
  leave_balances: 'wallet-outline',
  attendance: 'time-outline',
  assets: 'laptop-outline',
}

export default function DataImportScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  const [open, setOpen] = useState<Module | null>(null)
  const [file, setFile] = useState<PickedFile | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState<'sample' | 'import' | null>(null)

  const load = useCallback(() => api<Module[]>('/imports/modules'), [])
  const record = useResource<Module[]>(load, [])

  const grouped = useMemo(() => {
    const modules = record.data ?? []

    return steps
      .map((step) => ({ ...step, modules: modules.filter((row) => row.step === step.key) }))
      .filter((step) => step.modules.length > 0)
  }, [record.data])

  const start = (module: Module) => {
    setOpen(module)
    setFile(null)
    setResult(null)
    setProblem(null)
  }

  const close = () => {
    setOpen(null)
    setFile(null)
    setResult(null)
    setProblem(null)
  }

  const sample = async () => {
    if (!open || busy) {
      return
    }

    setBusy('sample')
    setProblem(null)

    try {
      await downloadText(`/imports/${open.module}/sample`, `${open.module}-sample.csv`)
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : 'Could not prepare the sample file.')
    } finally {
      setBusy(null)
    }
  }

  const choose = async () => {
    if (busy) {
      return
    }

    try {
      const picked = await pickFile(['text/csv', 'text/comma-separated-values', 'text/plain'])

      if (picked) {
        setFile(picked)
        setResult(null)
        setProblem(null)
      }
    } catch {
      setProblem('Could not open the file picker.')
    }
  }

  const upload = async () => {
    if (!open || !file || busy) {
      return
    }

    setBusy('import')
    setProblem(null)
    setResult(null)

    try {
      const outcome = await api<Result>(`/imports/${open.module}`, {
        method: 'POST',
        body: toFormData(file, 'file'),
      })

      setResult(outcome)
      setFile(null)
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'The import could not be run.')
    } finally {
      setBusy(null)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Data Import">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Data Import">
        <ErrorState message={record.error ?? 'Could not load the import modules.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const allowed = record.data.filter((row) => row.allowed).length

  return (
    <Screen title="Data Import" subtitle={`${allowed} of ${record.data.length} open to you`}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        <Notice
          tone="info"
          title="Bring your spreadsheet across"
          message="Pick what you are importing, download its sample file, paste your data in, then upload it back."
        />

        {grouped.map((step) => (
          <View key={step.key} style={styles.group}>
            <Text style={[styles.groupTitle, { color: theme.inkSubtle }]}>{step.title}</Text>
            <Text style={[styles.groupHint, { color: theme.inkSubtle }]}>{step.hint}</Text>

            <View style={styles.grid}>
              {step.modules.map((module) => (
                <Pressable
                  key={module.module}
                  onPress={() => (module.allowed ? start(module) : undefined)}
                  style={({ pressed }) => [
                    styles.tile,
                    {
                      backgroundColor: pressed && module.allowed ? theme.canvas : theme.surface,
                      borderColor: theme.line,
                      opacity: module.allowed ? 1 : 0.5,
                    },
                  ]}
                >
                  <View style={[styles.tileIcon, { backgroundColor: theme.brandSoft }]}>
                    <Icon name={icons[module.module] ?? 'document-text-outline'} size={20} color={theme.brand} />
                  </View>

                  <Text style={[styles.tileLabel, { color: theme.ink }]}>{module.label}</Text>
                  <Text numberOfLines={2} style={[styles.tileHint, { color: theme.inkSubtle }]}>
                    {module.allowed ? module.hint : 'You do not have permission'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={open !== null} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={[styles.grab, { backgroundColor: theme.line }]} />

            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>Import {open?.label.toLowerCase()}</Text>
              <Text style={[styles.sheetHint, { color: theme.inkMuted }]}>{open?.hint}</Text>

              {problem ? <Notice tone="danger" title="Import failed" message={problem} /> : null}

              {result ? (
                <View style={styles.form}>
                  <Notice
                    tone={result.failed === 0 ? 'success' : 'warning'}
                    title={
                      result.failed === 0
                        ? 'All rows went in'
                        : `${result.failed} of ${result.total} rows were rejected`
                    }
                    message={`${result.created} created, ${result.updated} updated, ${result.failed} failed — from ${result.file}`}
                  />

                  {result.failures.length > 0 ? (
                    <>
                      <Text style={[styles.group, { color: theme.inkSubtle }]}>What went wrong</Text>

                      {result.failures.map((failure) => (
                        <View
                          key={failure.row}
                          style={[styles.failure, { backgroundColor: theme.canvas, borderColor: theme.line }]}
                        >
                          <Text style={[styles.failureRow, { color: theme.danger }]}>
                            Row {failure.row}
                            {failure.reference ? ` · ${failure.reference}` : ''}
                          </Text>
                          <Text style={[styles.failureText, { color: theme.ink }]}>{failure.message}</Text>
                        </View>
                      ))}
                    </>
                  ) : null}

                  <Button label="Import another file" variant="secondary" onPress={() => setResult(null)} fullWidth />
                  <Button label="Done" variant="ghost" onPress={close} fullWidth />
                </View>
              ) : (
                <View style={styles.form}>
                  {open?.needs?.length ? (
                    <Notice
                      tone="warning"
                      title="Import these first"
                      message={`${open.label} link to ${open.needs.join(', ')} by their code, so those have to exist already.`}
                    />
                  ) : null}

                  <Button
                    label="Download the sample file"
                    variant="secondary"
                    onPress={sample}
                    loading={busy === 'sample'}
                    disabled={busy !== null}
                    fullWidth
                  />

                  <Pressable
                    onPress={choose}
                    disabled={busy !== null}
                    style={[styles.picker, { backgroundColor: theme.canvas, borderColor: file ? theme.brand : theme.line }]}
                  >
                    <Icon
                      name={file ? 'document-text-outline' : 'cloud-upload-outline'}
                      size={22}
                      color={file ? theme.brand : theme.inkSubtle}
                    />
                    <Text style={[styles.pickerLabel, { color: file ? theme.ink : theme.inkSubtle }]}>
                      {file ? file.name : 'Choose your filled CSV'}
                    </Text>
                    {file?.size ? (
                      <Text style={[styles.pickerMeta, { color: theme.inkSubtle }]}>
                        {Math.max(1, Math.round(file.size / 1024))} KB
                      </Text>
                    ) : null}
                  </Pressable>

                  <Button
                    label={`Import ${open?.label.toLowerCase()}`}
                    onPress={upload}
                    loading={busy === 'import'}
                    disabled={!file || busy !== null}
                    fullWidth
                  />

                  <Text style={[styles.group, { color: theme.inkSubtle }]}>
                    Columns in the file ({open?.columns.length ?? 0})
                  </Text>

                  <View style={[styles.columns, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
                    {open?.columns.map((column) => (
                      <View key={column.name} style={styles.column}>
                        <View style={styles.columnHead}>
                          <Text style={[styles.columnName, { color: theme.ink }]}>{column.name}</Text>
                          {column.required ? (
                            <Text style={[styles.required, { color: theme.danger }]}>required</Text>
                          ) : null}
                        </View>
                        {column.note ? (
                          <Text style={[styles.columnNote, { color: theme.inkSubtle }]}>{column.note}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>

                  <Notice
                    tone="info"
                    title="Safe to run twice"
                    message="Rows that already exist are updated, new ones are created. Nothing is duplicated."
                  />

                  <Button label="Cancel" variant="ghost" onPress={close} disabled={busy !== null} fullWidth />
                </View>
              )}
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
    gap: spacing.lg,
  },
  group: {
    gap: spacing.xs,
  },
  groupTitle: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  groupHint: {
    fontSize: font.xs,
    marginBottom: spacing.sm,
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
    gap: 3,
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
    lineHeight: 16,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '92%',
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
  },
  sheetHint: {
    fontSize: font.sm,
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  picker: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: 4,
  },
  pickerLabel: {
    fontSize: font.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  pickerMeta: {
    fontSize: font.xs,
  },
  columns: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  column: {
    paddingVertical: 7,
    gap: 1,
  },
  columnHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  columnName: {
    fontSize: font.sm,
    fontWeight: '700',
  },
  required: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  columnNote: {
    fontSize: font.xs,
    lineHeight: 16,
  },
  failure: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  failureRow: {
    fontSize: font.xs,
    fontWeight: '800',
  },
  failureText: {
    fontSize: font.sm,
    lineHeight: 19,
  },
})
