import { useCallback, useState } from 'react'
import { Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Select } from '@/components/ui/Select'
import { ErrorState, Loader } from '@/components/ui/States'
import { formatStamp, zoneLabel } from '@/lib/clock'
import { ApiError, api, apiList } from '@/lib/api'
import { downloadFile } from '@/lib/download'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Interview = Record<string, any>

const verdicts = [
  { value: 'selected', label: 'Selected — take them forward' },
  { value: 'hold', label: 'On hold — not sure yet' },
  { value: 'rejected', label: 'Rejected' },
]

export default function InterviewsScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  const [showPast, setShowPast] = useState(false)

  const load = useCallback(async (): Promise<Interview[]> => {
    const result = await apiList<Interview>(`/interviews/mine?per_page=100${showPast ? '&all=1' : ''}`)

    return result.data
  }, [showPast])

  const record = useResource<Interview[]>(load, [showPast])

  const [open, setOpen] = useState<Interview | null>(null)
  const [verdict, setVerdict] = useState<string | null>(null)
  const [rating, setRating] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const sheet = (interview: Interview) => {
    setOpen(interview)
    setVerdict(null)
    setRating('')
    setNotes('')
    setProblem(null)
    setDone(null)
  }

  const submit = async (status: 'done' | 'no_show') => {
    if (!open || busy) {
      return
    }

    if (status === 'done' && verdict === null) {
      setProblem('Say whether they are selected, rejected or on hold.')

      return
    }

    if (status === 'done' && notes.trim().length === 0) {
      setProblem('Write a few lines on how the round went.')

      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(`/interviews/${open.uuid}/feedback`, {
        method: 'PUT',
        body: {
          status,
          ...(status === 'done'
            ? {
                verdict,
                feedback: notes.trim(),
                ...(rating.trim() ? { rating: Number(rating) } : {}),
              }
            : {}),
        },
      })

      setDone(status === 'done' ? 'Feedback sent to the hiring team.' : 'Marked as did not turn up.')
      setOpen(null)
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not save the feedback.')
    } finally {
      setBusy(false)
    }
  }

  const grab = async () => {
    if (!open || busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await downloadFile(
        `/candidates/${open.application?.candidate?.uuid}/resume`,
        `${open.application?.candidate?.name ?? 'candidate'}.pdf`
      )
    } catch {
      setProblem('Could not download the resume.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="My Interviews">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="My Interviews">
        <ErrorState message={record.error ?? 'Could not load your interviews.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const list = record.data
  const pending = list.filter((row) => row.status === 'scheduled')
  const zone = zoneLabel()

  return (
    <Screen
      title="My Interviews"
      subtitle={`${pending.length === 0 ? 'Nothing to take' : `${pending.length} to take`}${zone ? ` · times in ${zone}` : ''}`}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {done ? <Notice tone="success" title="Done" message={done} /> : null}

        <View style={styles.chips}>
          <Chip label="To take" active={!showPast} onPress={() => setShowPast(false)} />
          <Chip label="Everything" active={showPast} onPress={() => setShowPast(true)} />
        </View>

        {list.length === 0 ? (
          <Notice
            tone="info"
            title={showPast ? 'No interviews yet' : 'Nothing lined up'}
            message="When HR puts you on a round, it shows up here with the candidate and the joining link."
          />
        ) : null}

        {list.map((row) => (
          <Pressable
            key={row.uuid}
            onPress={() => sheet(row)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: pressed ? theme.canvas : theme.surface, borderColor: theme.line },
            ]}
          >
            <View style={styles.head}>
              <Text numberOfLines={1} style={[styles.name, { color: theme.ink }]}>
                {row.application?.candidate?.name ?? 'Candidate'}
              </Text>
              <View style={[styles.tag, { backgroundColor: soft(theme, row) }]}>
                <Text style={[styles.tagText, { color: ink(theme, row) }]}>{state(row)}</Text>
              </View>
            </View>

            <Text style={[styles.meta, { color: theme.inkMuted }]}>
              {row.label} · {row.application?.opening?.title ?? 'Role'}
            </Text>

            <Text style={[styles.meta, { color: theme.ink }]}>
              {stamp(row.scheduled_at)} · {row.duration_minutes} min
            </Text>

            {row.mode === 'in_person' && row.location ? (
              <Text style={[styles.meta, { color: theme.inkSubtle }]}>At {row.location}</Text>
            ) : null}

            {row.meeting_url && row.status === 'scheduled' ? (
              <Pressable onPress={() => void Linking.openURL(row.meeting_url)}>
                <Text style={[styles.join, { color: theme.brand }]}>Join the video call</Text>
              </Pressable>
            ) : null}

            {row.verdict ? (
              <Text style={[styles.meta, { color: theme.inkSubtle }]}>
                You said {word(row.verdict)}
                {row.rating ? ` · ${row.rating}/5` : ''}
              </Text>
            ) : null}
          </Pressable>
        ))}
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
            <Text style={[styles.sheetTitle, { color: theme.ink }]}>
              {open?.application?.candidate?.name ?? ''}
            </Text>
            <Pressable onPress={() => setOpen(null)} hitSlop={10}>
              <Text style={[styles.close, { color: theme.inkSubtle }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {open ? (
              <>
                {problem ? <Notice tone="danger" title="Could not do that" message={problem} /> : null}

                <Row label="Round" value={`${open.label} · round ${open.round_no}`} strong />
                <Row label="Role" value={open.application?.opening?.title} />
                <Row label="When" value={stamp(open.scheduled_at)} />
                <Row label="How long" value={`${open.duration_minutes} minutes`} />
                <Row label="Email" value={open.application?.candidate?.email} />
                <Row label="Phone" value={open.application?.candidate?.phone} />
                {open.location ? <Row label="Where" value={open.location} /> : null}

                {open.meeting_url && open.status === 'scheduled' ? (
                  <Button
                    label="Join the video call"
                    onPress={() => void Linking.openURL(open.meeting_url)}
                    fullWidth
                  />
                ) : null}

                {open.application?.candidate?.has_resume ? (
                  <Button label="Download resume" variant="secondary" onPress={grab} loading={busy} fullWidth />
                ) : null}

                {open.status === 'scheduled' ? (
                  <View style={styles.form}>
                    <Text style={[styles.group, { color: theme.inkSubtle }]}>Your feedback</Text>

                    <Select
                      label="What do you say"
                      value={verdict}
                      options={verdicts}
                      onChange={setVerdict}
                      placeholder="Pick one"
                    />

                    <Field
                      label="Score out of 5"
                      value={rating}
                      onChangeText={setRating}
                      placeholder="4"
                      keyboardType="number-pad"
                      editable={!busy}
                      maxLength={1}
                    />

                    <Field
                      label="How did it go"
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Strong on system design. Explained trade-offs well. Some gaps in SQL tuning."
                      autoCapitalize="sentences"
                      multiline
                      editable={!busy}
                      maxLength={4000}
                    />

                    <Button label="Send feedback" onPress={() => void submit('done')} loading={busy} fullWidth />
                    <Button
                      label="They did not turn up"
                      variant="ghost"
                      onPress={() => void submit('no_show')}
                      loading={busy}
                      fullWidth
                    />
                  </View>
                ) : (
                  <>
                    {open.feedback ? (
                      <View style={[styles.noteBox, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
                        <Text style={[styles.noteLabel, { color: theme.inkSubtle }]}>
                          What you wrote{open.verdict ? ` · ${word(open.verdict)}` : ''}
                          {open.rating ? ` · ${open.rating}/5` : ''}
                        </Text>
                        <Text style={[styles.noteText, { color: theme.ink }]}>{open.feedback}</Text>
                      </View>
                    ) : null}

                    <Notice
                      tone="info"
                      title={state(open)}
                      message={
                        open.status === 'cancelled'
                          ? open.cancel_reason ?? 'This round was called off.'
                          : 'This round is closed. Nothing left to do.'
                      }
                    />
                  </>
                )}
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

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme()

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? theme.brand : theme.surface, borderColor: active ? theme.brand : theme.line },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? '#FFFFFF' : theme.inkMuted }]}>{label}</Text>
    </Pressable>
  )
}

function stamp(value: string | null): string {
  if (!value) {
    return '—'
  }

  return formatStamp(value)
}

function word(verdict: string): string {
  if (verdict === 'selected') {
    return 'Selected'
  }

  if (verdict === 'rejected') {
    return 'Rejected'
  }

  return 'On hold'
}

function state(row: Interview): string {
  if (row.status === 'cancelled') {
    return 'Cancelled'
  }

  if (row.status === 'no_show') {
    return 'Did not turn up'
  }

  if (row.status === 'done') {
    return row.verdict ? word(row.verdict) : 'Done'
  }

  return 'To take'
}

function soft(theme: ReturnType<typeof useTheme>, row: Interview): string {
  if (row.status === 'cancelled' || row.status === 'no_show' || row.verdict === 'rejected') {
    return theme.dangerSoft
  }

  if (row.verdict === 'selected') {
    return theme.successSoft
  }

  if (row.verdict === 'hold') {
    return theme.warningSoft
  }

  return theme.infoSoft
}

function ink(theme: ReturnType<typeof useTheme>, row: Interview): string {
  if (row.status === 'cancelled' || row.status === 'no_show' || row.verdict === 'rejected') {
    return theme.danger
  }

  if (row.verdict === 'selected') {
    return theme.success
  }

  if (row.verdict === 'hold') {
    return theme.warning
  }

  return theme.info
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 3,
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
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tagText: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  meta: {
    fontSize: font.xs,
  },
  join: {
    fontSize: font.sm,
    fontWeight: '700',
    marginTop: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 17, 33, 0.45)',
  },
  sheet: {
    maxHeight: '86%',
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
  group: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  form: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  noteBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  noteLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  noteText: {
    fontSize: font.sm,
    lineHeight: 20,
  },
})
