import { useCallback, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Select } from '@/components/ui/Select'
import { ErrorState, Loader } from '@/components/ui/States'
import { formatFullDate, formatStamp } from '@/lib/clock'
import { ApiError, api, apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { downloadFile } from '@/lib/download'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Opening = Record<string, any>
type Applicant = Record<string, any>
type Interview = Record<string, any>
type Manager = { id: number; name: string; designation: string | null }
type Stage = { stage: string; label: string; total: number }

type Loaded = {
  opening: Opening
  pipeline: Stage[]
  applicants: Applicant[]
  managers: Manager[]
}

const rounds = [
  { value: 'telephonic', label: 'Telephonic screening' },
  { value: 'technical', label: 'Technical round' },
  { value: 'managerial', label: 'Managerial round' },
  { value: 'hr', label: 'HR round' },
  { value: 'final', label: 'Final round' },
]

const modes = [
  { value: 'video', label: 'Video call (link made for you)' },
  { value: 'in_person', label: 'In person' },
  { value: 'phone', label: 'Phone call' },
]

const verdicts = [
  { value: 'selected', label: 'Selected' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'hold', label: 'On hold' },
]

const stageLabels: Record<string, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  joined: 'Joined',
  rejected: 'Rejected',
  dropped: 'Dropped',
}

const moveTo: Record<string, { value: string; label: string }[]> = {
  applied: [
    { value: 'screening', label: 'Shortlist for screening' },
    { value: 'rejected', label: 'Reject' },
  ],
  screening: [
    { value: 'interview', label: 'Move to interview' },
    { value: 'rejected', label: 'Reject' },
  ],
  interview: [
    { value: 'offer', label: 'Make an offer' },
    { value: 'rejected', label: 'Reject' },
  ],
  offer: [
    { value: 'joined', label: 'Mark joined' },
    { value: 'dropped', label: 'Candidate dropped out' },
  ],
}

export default function OpeningDetailScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { can } = useAuth()
  const { uuid } = useLocalSearchParams<{ uuid: string }>()

  const [filter, setFilter] = useState<string | null>(null)
  const [open, setOpen] = useState<Applicant | null>(null)
  const [stage, setStage] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [ctc, setCtc] = useState('')
  const [joining, setJoining] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const [letter, setLetter] = useState<Record<string, any> | null | undefined>(undefined)
  const [offering, setOffering] = useState(false)
  const [ctcOffer, setCtcOffer] = useState('')
  const [joinDay, setJoinDay] = useState('')
  const [title, setTitle] = useState('')
  const [reportsTo, setReportsTo] = useState('')
  const [probation, setProbation] = useState('6')
  const [notice, setNotice] = useState('30')
  const [replyBy, setReplyBy] = useState('')
  const [terms, setTerms] = useState('')

  const [history, setHistory] = useState<Interview[] | null>(null)
  const [booking, setBooking] = useState(false)
  const [kind, setKind] = useState<string | null>('technical')
  const [mode, setMode] = useState<string | null>('video')
  const [who, setWho] = useState<string | null>(null)
  const [day, setDay] = useState('')
  const [slot, setSlot] = useState('')
  const [minutes, setMinutes] = useState('45')
  const [place, setPlace] = useState('')

  const load = useCallback(async (): Promise<Loaded> => {
    const [opening, pipeline, applicants, managers] = await Promise.all([
      api<Opening>(`/openings/${uuid}`),
      api<Stage[]>(`/openings/${uuid}/pipeline`),
      apiList<Applicant>(`/openings/${uuid}/applications?per_page=100`),
      api<Manager[]>('/employees/reporting-managers').catch(() => [] as Manager[]),
    ])

    return { opening, pipeline, applicants: applicants.data, managers }
  }, [uuid])

  const record = useResource<Loaded>(load, [uuid])
  const canManage = can('recruitment.manage')

  const sheet = (applicant: Applicant) => {
    setOpen(applicant)
    setStage(null)
    setReason('')
    setCtc('')
    setJoining('')
    setProblem(null)
    setBooking(false)
    setHistory(null)
    setKind('technical')
    setMode('video')
    setWho(null)
    setDay('')
    setSlot('')
    setMinutes('45')
    setPlace('')

    setLetter(undefined)
    setOffering(false)
    setCtcOffer(String(applicant.offered_ctc ?? applicant.candidate?.expected_ctc ?? ''))
    setJoinDay('')
    setTitle('')
    setReportsTo('')
    setProbation('6')
    setNotice('30')
    setReplyBy('')
    setTerms('')

    void api<Interview[]>(`/applications/${applicant.uuid}/interviews`)
      .then(setHistory)
      .catch(() => setHistory([]))

    void api<Record<string, any> | null>(`/applications/${applicant.uuid}/offer-letter`)
      .then(setLetter)
      .catch(() => setLetter(null))
  }

  const raiseLetter = async () => {
    if (!open || busy) {
      return
    }

    if (ctcOffer.trim().length === 0) {
      setProblem('Enter the annual CTC.')

      return
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(joinDay.trim())) {
      setProblem('Give the joining date as YYYY-MM-DD.')

      return
    }

    setBusy(true)
    setProblem(null)

    try {
      const made = await api<Record<string, any>>(`/applications/${open.uuid}/offer-letter`, {
        method: 'POST',
        body: {
          annual_ctc: Number(ctcOffer),
          joining_date: joinDay.trim(),
          ...(title.trim() ? { designation: title.trim() } : {}),
          ...(reportsTo.trim() ? { reporting_to: reportsTo.trim() } : {}),
          ...(probation.trim() ? { probation_months: Number(probation) } : {}),
          ...(notice.trim() ? { notice_days: Number(notice) } : {}),
          ...(replyBy.trim() ? { valid_till: replyBy.trim() } : {}),
          ...(terms.trim() ? { extra_terms: terms.trim() } : {}),
        },
      })

      setLetter(made)
      setOffering(false)
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not raise the offer letter.')
    } finally {
      setBusy(false)
    }
  }

  const answerLetter = async (decision: 'accepted' | 'declined') => {
    if (!letter || busy) {
      return
    }

    if (decision === 'declined' && reason.trim().length === 0) {
      setProblem('Say why they turned it down.')

      return
    }

    setBusy(true)
    setProblem(null)

    try {
      const updated = await api<Record<string, any>>(`/offer-letters/${letter.uuid}/answer`, {
        method: 'PUT',
        body: { status: decision, ...(reason.trim() ? { reason: reason.trim() } : {}) },
      })

      setLetter(updated)
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not save that.')
    } finally {
      setBusy(false)
    }
  }

  const grabLetter = async () => {
    if (!letter || busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await downloadFile(`/offer-letters/${letter.uuid}/download`, `${letter.letter_number}.html`)
    } catch {
      setProblem('Could not download the letter.')
    } finally {
      setBusy(false)
    }
  }

  const book = async () => {
    if (!open || busy) {
      return
    }

    if (who === null) {
      setProblem('Pick who will take the round.')

      return
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.trim())) {
      setProblem('Give the date as YYYY-MM-DD.')

      return
    }

    if (!/^\d{2}:\d{2}$/.test(slot.trim())) {
      setProblem('Give the time as HH:MM, like 15:30.')

      return
    }

    if (mode === 'in_person' && place.trim().length === 0) {
      setProblem('Say where the candidate should come.')

      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(`/applications/${open.uuid}/interviews`, {
        method: 'POST',
        body: {
          kind,
          mode,
          interviewer_id: Number(who),
          scheduled_at: `${day.trim()} ${slot.trim()}:00`,
          duration_minutes: Number(minutes) || 45,
          ...(mode === 'in_person' ? { location: place.trim() } : {}),
        },
      })

      setBooking(false)
      setHistory(await api<Interview[]>(`/applications/${open.uuid}/interviews`))
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not schedule this round.')
    } finally {
      setBusy(false)
    }
  }

  const drop = async (interview: Interview) => {
    if (!open || busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(`/interviews/${interview.uuid}/cancel`, {
        method: 'PUT',
        body: { reason: 'Cancelled from the applicant screen' },
      })

      setHistory(await api<Interview[]>(`/applications/${open.uuid}/interviews`))
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not cancel this round.')
    } finally {
      setBusy(false)
    }
  }

  const move = async () => {
    if (!open || !stage || busy) {
      return
    }

    if (stage === 'rejected' && reason.trim().length === 0) {
      setProblem('Say why, so the record makes sense later.')

      return
    }

    if (stage === 'offer' && ctc.trim().length === 0) {
      setProblem('Enter the offered CTC.')

      return
    }

    if (stage === 'joined' && joining.trim().length === 0) {
      setProblem('Enter the joining date.')

      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(`/applications/${open.uuid}/move`, {
        method: 'PUT',
        body: {
          stage,
          ...(reason.trim() ? { rejection_reason: reason.trim() } : {}),
          ...(ctc.trim() ? { offered_ctc: Number(ctc) } : {}),
          ...(joining.trim() ? { joining_date: joining.trim() } : {}),
        },
      })

      setOpen(null)
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not move this candidate.')
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
        `/candidates/${open.candidate.uuid}/resume`,
        open.candidate.resume_name ?? 'resume.pdf'
      )
    } catch {
      setProblem('Could not download the resume.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Opening" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Opening" leading="back">
        <ErrorState message={record.error ?? 'Could not load this opening.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const { opening, pipeline, applicants } = record.data
  const shown = filter ? applicants.filter((row) => row.stage === filter) : applicants
  const busyStages = pipeline.filter((row) => row.total > 0)

  return (
    <Screen title={opening.title} subtitle={`${opening.location} · ${opening.experience_label}`} leading="back">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Row label="Status" value={opening.is_live ? 'Live on the career page' : labelFor(opening.status)} />
          <Row label="Positions" value={String(opening.positions)} />
          <Row label="Employment" value={String(opening.employment_type).replace('_', ' ')} />
          {opening.department ? <Row label="Department" value={opening.department} /> : null}
          {opening.closes_on ? <Row label="Closes on" value={opening.closes_on} /> : null}
          <Row label="Applicants" value={`${opening.application_count ?? 0} total, ${opening.open_count ?? 0} in process`} />
        </View>

        {opening.status === 'draft' ? (
          <Notice
            tone="warning"
            title="Still a draft"
            message="This is not on your career page yet. Publish it from the Openings list when the description is ready."
          />
        ) : null}

        {busyStages.length > 0 ? (
          <>
            <Text style={[styles.group, { color: theme.inkSubtle }]}>Pipeline</Text>
            <View style={styles.chips}>
              <Chip label={`All ${applicants.length}`} active={filter === null} onPress={() => setFilter(null)} />
              {busyStages.map((row) => (
                <Chip
                  key={row.stage}
                  label={`${stageLabels[row.stage] ?? row.label} ${row.total}`}
                  active={filter === row.stage}
                  onPress={() => setFilter(filter === row.stage ? null : row.stage)}
                />
              ))}
            </View>
          </>
        ) : null}

        <Text style={[styles.group, { color: theme.inkSubtle }]}>
          {filter ? stageLabels[filter] ?? filter : 'Applicants'}
        </Text>

        {shown.length === 0 ? (
          <Notice
            tone="info"
            title={applicants.length === 0 ? 'No applicants yet' : 'Nobody at this stage'}
            message={
              applicants.length === 0
                ? opening.is_live
                  ? 'This opening is live. Applications will land here as people apply.'
                  : 'Publish the opening so people can find and apply to it.'
                : 'Pick another stage to see those candidates.'
            }
          />
        ) : null}

        {shown.map((row) => (
          <Pressable
            key={row.uuid}
            onPress={() => sheet(row)}
            style={({ pressed }) => [
              styles.person,
              { backgroundColor: pressed ? theme.canvas : theme.surface, borderColor: theme.line },
            ]}
          >
            <View style={styles.personHead}>
              <Text numberOfLines={1} style={[styles.personName, { color: theme.ink }]}>
                {row.candidate?.name}
              </Text>
              <View style={[styles.tag, { backgroundColor: stageSoft(theme, row.stage) }]}>
                <Text style={[styles.tagText, { color: stageInk(theme, row.stage) }]}>
                  {stageLabels[row.stage] ?? row.stage}
                </Text>
              </View>
            </View>

            <Text style={[styles.personMeta, { color: theme.inkMuted }]}>
              {[
                row.candidate?.total_experience ? `${row.candidate.total_experience} yrs` : null,
                row.candidate?.current_company,
                row.candidate?.current_location,
              ]
                .filter(Boolean)
                .join(' · ') || row.candidate?.email}
            </Text>

            <Text style={[styles.personMeta, { color: theme.inkSubtle }]}>
              Applied {when(row.applied_at)} from {String(row.source).replace('_', ' ')}
              {row.candidate?.expected_ctc ? ` · expects ₹${Number(row.candidate.expected_ctc).toLocaleString('en-IN')}` : ''}
            </Text>
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
            <Text style={[styles.sheetTitle, { color: theme.ink }]}>{open?.candidate?.name ?? ''}</Text>
            <Pressable onPress={() => setOpen(null)} hitSlop={10}>
              <Text style={[styles.close, { color: theme.inkSubtle }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {open ? (
              <>
                {problem ? <Notice tone="danger" title="Could not do that" message={problem} /> : null}

                <Row label="Stage" value={stageLabels[open.stage] ?? open.stage} strong />
                <Row label="Email" value={open.candidate?.email} />
                <Row label="Phone" value={open.candidate?.phone} />
                {open.candidate?.total_experience ? (
                  <Row label="Experience" value={`${open.candidate.total_experience} years`} />
                ) : null}
                {open.candidate?.current_company ? (
                  <Row label="Currently at" value={open.candidate.current_company} />
                ) : null}
                {open.candidate?.current_location ? (
                  <Row label="Location" value={open.candidate.current_location} />
                ) : null}
                {open.candidate?.current_ctc ? (
                  <Row label="Current CTC" value={`₹${Number(open.candidate.current_ctc).toLocaleString('en-IN')}`} />
                ) : null}
                {open.candidate?.expected_ctc ? (
                  <Row label="Expected CTC" value={`₹${Number(open.candidate.expected_ctc).toLocaleString('en-IN')}`} />
                ) : null}
                {open.candidate?.notice_period_days !== null && open.candidate?.notice_period_days !== undefined ? (
                  <Row label="Notice period" value={`${open.candidate.notice_period_days} days`} />
                ) : null}
                {open.candidate?.linkedin_url ? <Row label="LinkedIn" value={open.candidate.linkedin_url} /> : null}
                <Row label="Came from" value={String(open.source).replace('_', ' ')} />
                <Row label="Applied" value={when(open.applied_at)} />
                {open.moved_by ? <Row label="Last moved by" value={open.moved_by} /> : null}
                {open.offered_ctc ? (
                  <Row label="Offered" value={`₹${Number(open.offered_ctc).toLocaleString('en-IN')}`} />
                ) : null}
                {open.joining_date ? <Row label="Joining" value={open.joining_date} /> : null}
                {open.rejection_reason ? <Row label="Rejected because" value={open.rejection_reason} /> : null}

                {open.cover_note ? (
                  <View style={[styles.noteBox, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
                    <Text style={[styles.noteLabel, { color: theme.inkSubtle }]}>What they wrote</Text>
                    <Text style={[styles.noteText, { color: theme.ink }]}>{open.cover_note}</Text>
                  </View>
                ) : null}

                {open.stage === 'offer' || letter ? (
                  <>
                    <Divider />

                    <Text style={[styles.group, { color: theme.inkSubtle }]}>Offer letter</Text>

                    {letter === undefined ? (
                      <Text style={[styles.personMeta, { color: theme.inkSubtle }]}>Loading</Text>
                    ) : letter === null ? (
                      offering ? (
                        <View style={styles.booking}>
                          <Field
                            label="Annual CTC"
                            value={ctcOffer}
                            onChangeText={setCtcOffer}
                            placeholder="1850000"
                            keyboardType="number-pad"
                            editable={!busy}
                          />
                          <Field
                            label="Joining date"
                            value={joinDay}
                            onChangeText={setJoinDay}
                            placeholder="YYYY-MM-DD"
                            editable={!busy}
                            maxLength={10}
                          />
                          <Field
                            label="Designation on the letter"
                            value={title}
                            onChangeText={setTitle}
                            placeholder={opening.designation ?? opening.title}
                            autoCapitalize="words"
                            editable={!busy}
                            maxLength={150}
                          />
                          <Field
                            label="Reporting to"
                            value={reportsTo}
                            onChangeText={setReportsTo}
                            placeholder="Amit Kumar"
                            autoCapitalize="words"
                            editable={!busy}
                            maxLength={150}
                          />
                          <Field
                            label="Probation (months)"
                            value={probation}
                            onChangeText={setProbation}
                            placeholder="6"
                            keyboardType="number-pad"
                            editable={!busy}
                            maxLength={2}
                          />
                          <Field
                            label="Notice period (days)"
                            value={notice}
                            onChangeText={setNotice}
                            placeholder="30"
                            keyboardType="number-pad"
                            editable={!busy}
                            maxLength={3}
                          />
                          <Field
                            label="Ask them to reply by"
                            value={replyBy}
                            onChangeText={setReplyBy}
                            placeholder="YYYY-MM-DD, optional"
                            editable={!busy}
                            maxLength={10}
                          />
                          <Field
                            label="Other terms"
                            value={terms}
                            onChangeText={setTerms}
                            placeholder="One line per point"
                            autoCapitalize="sentences"
                            multiline
                            editable={!busy}
                            maxLength={4000}
                          />

                          <Notice
                            tone="info"
                            title="What the candidate gets"
                            message="A letterhead PDF-ready letter by email, and Accept or Decline buttons on their own tracking page."
                          />

                          <Button label="Raise the offer letter" onPress={raiseLetter} loading={busy} fullWidth />
                          <Button label="Not now" variant="ghost" onPress={() => setOffering(false)} fullWidth />
                        </View>
                      ) : canManage ? (
                        <Button
                          label="Raise an offer letter"
                          variant="secondary"
                          onPress={() => setOffering(true)}
                          fullWidth
                        />
                      ) : (
                        <Text style={[styles.personMeta, { color: theme.inkSubtle }]}>No letter raised yet.</Text>
                      )
                    ) : (
                      <View style={[styles.round, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
                        <View style={styles.personHead}>
                          <Text style={[styles.roundTitle, { color: theme.ink }]}>{letter.letter_number}</Text>
                          <Text style={[styles.tagText, { color: letterInk(theme, letter) }]}>
                            {letterState(letter)}
                          </Text>
                        </View>

                        <Text style={[styles.personMeta, { color: theme.inkMuted }]}>
                          ₹{Number(letter.annual_ctc).toLocaleString('en-IN')} · joins {letter.joining_date}
                          {letter.designation ? ` · ${letter.designation}` : ''}
                        </Text>

                        {letter.valid_till ? (
                          <Text style={[styles.personMeta, { color: theme.inkSubtle }]}>
                            Reply by {letter.valid_till}
                            {letter.has_lapsed ? ' — that date has passed' : ''}
                          </Text>
                        ) : null}

                        {letter.decline_reason ? (
                          <Text style={[styles.personMeta, { color: theme.inkSubtle }]}>{letter.decline_reason}</Text>
                        ) : null}

                        <Button
                          label="Download the letter"
                          variant="ghost"
                          size="sm"
                          onPress={grabLetter}
                          disabled={busy}
                        />

                        {canManage && letter.is_open ? (
                          <>
                            <Button
                              label="They accepted"
                              size="sm"
                              onPress={() => void answerLetter('accepted')}
                              disabled={busy}
                            />
                            <Button
                              label="They turned it down"
                              variant="danger"
                              size="sm"
                              onPress={() => void answerLetter('declined')}
                              disabled={busy}
                            />
                          </>
                        ) : null}
                      </View>
                    )}
                  </>
                ) : null}

                <Divider />

                <Text style={[styles.group, { color: theme.inkSubtle }]}>Interview rounds</Text>

                {history === null ? (
                  <Text style={[styles.personMeta, { color: theme.inkSubtle }]}>Loading rounds</Text>
                ) : history.length === 0 ? (
                  <Text style={[styles.personMeta, { color: theme.inkSubtle }]}>No round scheduled yet.</Text>
                ) : (
                  history.map((row) => (
                    <View
                      key={row.uuid}
                      style={[styles.round, { backgroundColor: theme.canvas, borderColor: theme.line }]}
                    >
                      <View style={styles.personHead}>
                        <Text style={[styles.roundTitle, { color: theme.ink }]}>
                          Round {row.round_no} · {row.label}
                        </Text>
                        <Text style={[styles.tagText, { color: roundInk(theme, row) }]}>
                          {roundState(row)}
                        </Text>
                      </View>

                      <Text style={[styles.personMeta, { color: theme.inkMuted }]}>
                        {stamp(row.scheduled_at)} · {row.duration_minutes} min
                        {row.interviewer ? ` · ${row.interviewer}` : ''}
                      </Text>

                      {row.mode === 'in_person' && row.location ? (
                        <Text style={[styles.personMeta, { color: theme.inkSubtle }]}>At {row.location}</Text>
                      ) : null}

                      {row.meeting_url && row.status === 'scheduled' ? (
                        <Pressable onPress={() => void Linking.openURL(row.meeting_url)}>
                          <Text style={[styles.joinLink, { color: theme.brand }]}>Join the video call</Text>
                        </Pressable>
                      ) : null}

                      {row.feedback ? (
                        <Text style={[styles.personMeta, { color: theme.ink }]}>
                          {row.verdict ? `${verdictWord(row.verdict)}${row.rating ? ` · ${row.rating}/5` : ''} — ` : ''}
                          {row.feedback}
                        </Text>
                      ) : null}

                      {row.cancel_reason ? (
                        <Text style={[styles.personMeta, { color: theme.inkSubtle }]}>{row.cancel_reason}</Text>
                      ) : null}

                      {canManage && row.status === 'scheduled' ? (
                        <Button
                          label="Cancel this round"
                          variant="ghost"
                          size="sm"
                          onPress={() => void drop(row)}
                          disabled={busy}
                        />
                      ) : null}
                    </View>
                  ))
                )}

                {canManage && !booking && open.stage !== 'joined' && open.stage !== 'rejected' && open.stage !== 'dropped' ? (
                  <Button
                    label={(history ?? []).length === 0 ? 'Schedule an interview' : 'Schedule another round'}
                    variant="secondary"
                    onPress={() => setBooking(true)}
                    fullWidth
                  />
                ) : null}

                {canManage && booking ? (
                  <View style={styles.booking}>
                    <Select label="Which round" value={kind} options={rounds} onChange={setKind} />
                    <Select
                      label="Who takes it"
                      value={who}
                      options={(record.data?.managers ?? []).map((row) => ({
                        value: String(row.id),
                        label: row.name,
                        hint: row.designation ?? undefined,
                      }))}
                      onChange={setWho}
                      placeholder="Pick an interviewer"
                    />
                    <Select label="How" value={mode} options={modes} onChange={setMode} />

                    <Field
                      label="Date"
                      value={day}
                      onChangeText={setDay}
                      placeholder="YYYY-MM-DD"
                      editable={!busy}
                      maxLength={10}
                    />
                    <Field
                      label="Time"
                      value={slot}
                      onChangeText={setSlot}
                      placeholder="15:30"
                      editable={!busy}
                      maxLength={5}
                    />
                    <Field
                      label="How long (minutes)"
                      value={minutes}
                      onChangeText={setMinutes}
                      placeholder="45"
                      keyboardType="number-pad"
                      editable={!busy}
                      maxLength={3}
                    />

                    {mode === 'in_person' ? (
                      <Field
                        label="Where"
                        value={place}
                        onChangeText={setPlace}
                        placeholder="4th Floor, Tech Park, Noida"
                        autoCapitalize="sentences"
                        editable={!busy}
                        maxLength={200}
                      />
                    ) : (
                      <Notice
                        tone="info"
                        title={mode === 'video' ? 'A video link is made for you' : 'We will note it as a phone call'}
                        message={
                          mode === 'video'
                            ? 'Both sides get a joining link. Nothing to install, it opens in the browser.'
                            : 'The candidate gets an email saying you will call them.'
                        }
                      />
                    )}

                    <Button label="Schedule and tell everyone" onPress={book} loading={busy} fullWidth />
                    <Button label="Not now" variant="ghost" onPress={() => setBooking(false)} fullWidth />
                  </View>
                ) : null}

                <Divider />

                <View style={styles.sheetActions}>
                  {open.candidate?.has_resume ? (
                    <Button label="Download resume" variant="secondary" onPress={grab} loading={busy} fullWidth />
                  ) : null}

                  {canManage && (moveTo[open.stage] ?? []).length > 0 ? (
                    <>
                      <Select
                        label="Move this candidate to"
                        value={stage}
                        options={moveTo[open.stage] ?? []}
                        onChange={setStage}
                        placeholder="Pick the next step"
                        allowClear
                      />

                      {stage === 'rejected' || stage === 'dropped' ? (
                        <Field
                          label="Why"
                          value={reason}
                          onChangeText={setReason}
                          placeholder="Not enough banking domain depth"
                          autoCapitalize="sentences"
                          editable={!busy}
                          maxLength={255}
                        />
                      ) : null}

                      {stage === 'offer' ? (
                        <Field
                          label="Offered CTC"
                          value={ctc}
                          onChangeText={setCtc}
                          placeholder="1700000"
                          keyboardType="number-pad"
                          editable={!busy}
                        />
                      ) : null}

                      {stage === 'joined' ? (
                        <Field
                          label="Joining date"
                          value={joining}
                          onChangeText={setJoining}
                          placeholder="YYYY-MM-DD"
                          editable={!busy}
                          maxLength={10}
                        />
                      ) : null}

                      <Button label="Move" onPress={move} loading={busy} disabled={stage === null} fullWidth />
                    </>
                  ) : null}

                  {canManage && (moveTo[open.stage] ?? []).length === 0 ? (
                    <Notice
                      tone="info"
                      title="This one is done"
                      message={`${open.candidate?.name} is marked ${stageLabels[open.stage] ?? open.stage}. Nothing left to move.`}
                    />
                  ) : null}
                </View>
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

function Divider() {
  const theme = useTheme()

  return <View style={[styles.divider, { backgroundColor: theme.line }]} />
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme()

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.brand : theme.surface,
          borderColor: active ? theme.brand : theme.line,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? '#FFFFFF' : theme.inkMuted }]}>{label}</Text>
    </Pressable>
  )
}

function labelFor(status: string): string {
  if (status === 'draft') {
    return 'Draft, not public'
  }

  if (status === 'on_hold') {
    return 'On hold'
  }

  if (status === 'closed') {
    return 'Closed'
  }

  return 'Open'
}

function when(value: string | null): string {
  if (!value) {
    return '—'
  }

  return formatFullDate(value)
}

function stamp(value: string | null): string {
  if (!value) {
    return '—'
  }

  return formatStamp(value)
}

function verdictWord(verdict: string): string {
  if (verdict === 'selected') {
    return 'Selected'
  }

  if (verdict === 'rejected') {
    return 'Rejected'
  }

  return 'On hold'
}

function roundState(row: Interview): string {
  if (row.status === 'cancelled') {
    return 'Cancelled'
  }

  if (row.status === 'no_show') {
    return 'Did not turn up'
  }

  if (row.status === 'done') {
    return row.verdict ? verdictWord(row.verdict) : 'Done'
  }

  return 'Scheduled'
}

function letterState(row: Record<string, any>): string {
  if (row.status === 'accepted') {
    return 'Accepted'
  }

  if (row.status === 'declined') {
    return 'Turned down'
  }

  if (row.status === 'withdrawn') {
    return 'Withdrawn'
  }

  return row.has_lapsed ? 'No reply yet' : 'Waiting on them'
}

function letterInk(theme: ReturnType<typeof useTheme>, row: Record<string, any>): string {
  if (row.status === 'accepted') {
    return theme.success
  }

  if (row.status === 'declined' || row.status === 'withdrawn') {
    return theme.danger
  }

  return row.has_lapsed ? theme.danger : theme.warning
}

function roundInk(theme: ReturnType<typeof useTheme>, row: Interview): string {
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

function stageSoft(theme: ReturnType<typeof useTheme>, stage: string): string {
  if (stage === 'joined') {
    return theme.successSoft
  }

  if (stage === 'rejected' || stage === 'dropped') {
    return theme.dangerSoft
  }

  if (stage === 'offer') {
    return theme.warningSoft
  }

  return theme.infoSoft
}

function stageInk(theme: ReturnType<typeof useTheme>, stage: string): string {
  if (stage === 'joined') {
    return theme.success
  }

  if (stage === 'rejected' || stage === 'dropped') {
    return theme.danger
  }

  if (stage === 'offer') {
    return theme.warning
  }

  return theme.info
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  group: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  person: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 2,
  },
  personHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  personName: {
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
  personMeta: {
    fontSize: font.xs,
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
  noteBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
    marginTop: spacing.xs,
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
  sheetActions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  round: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 3,
  },
  roundTitle: {
    flex: 1,
    fontSize: font.sm,
    fontWeight: '700',
  },
  joinLink: {
    fontSize: font.sm,
    fontWeight: '700',
    marginTop: 2,
  },
  booking: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs,
  },
})
