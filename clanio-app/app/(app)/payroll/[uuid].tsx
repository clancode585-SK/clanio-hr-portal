import { useCallback, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CodeSheet, type Verification } from '@/components/CodeSheet'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Pager } from '@/components/ui/Pager'
import { ErrorState, Loader } from '@/components/ui/States'
import { ApiError, api, apiList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { downloadFile } from '@/lib/download'
import { Money } from '@/lib/money'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Run = Record<string, any>
type Slip = Record<string, any>
type Quote = Record<string, any>
type Review = Record<string, any>

type PageMeta = {
  current_page: number
  per_page: number
  total: number
  last_page: number
}

type Loaded = {
  run: Run
  slips: Slip[]
  slipPage: PageMeta | null
  review: Review | null
  runQuote: Quote | null
}

const PER_PAGE = 25

type Waiting = {
  path: string
  body: Record<string, unknown>
  verification: Verification
}

const filters = [
  { key: 'all', label: 'Everyone' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid', label: 'Paid' },
  { key: 'failed', label: 'Failed' },
  { key: 'on_hold', label: 'Stopped' },
]

export default function PayrollRunScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { uuid } = useLocalSearchParams<{ uuid: string }>()
  const { can } = useAuth()

  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<Slip | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [lop, setLop] = useState('')
  const [holdReason, setHoldReason] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState<Waiting | null>(null)
  const [codeProblem, setCodeProblem] = useState<string | null>(null)
  const [scheduling, setScheduling] = useState<Record<string, any> | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleNote, setScheduleNote] = useState('')

  const load = useCallback(async (): Promise<Loaded> => {
    const run = await api<Run>(`/payroll-runs/${uuid}`)
    const query = `per_page=${PER_PAGE}&page=${page}`
      + (filter === 'waiting' ? '&approval=pending' : '')
      + (filter === 'approved' ? '&approval=approved' : '')
      + (['paid', 'failed', 'on_hold'].includes(filter) ? `&status=${filter}` : '')

    const slips = await apiList<Slip>(`/payroll-runs/${uuid}/payslips?${query}`)

    let review: Review | null = null
    let runQuote: Quote | null = null

    if (run.is_editable) {
      try {
        review = await api<Review>(`/payroll-runs/${uuid}/approval-review`)
      } catch {
        review = null
      }
    }

    if (run.is_payable) {
      try {
        runQuote = await api<Quote>(`/payroll-runs/${uuid}/transfer-quote`)
      } catch {
        runQuote = null
      }
    }

    return { run, slips: slips.data, slipPage: (slips.meta as PageMeta) ?? null, review, runQuote }
  }, [uuid, page, filter])

  const record = useResource<Loaded>(load, [uuid, page, filter])

  const canRun = can('payroll.run')
  const canApprove = can('payroll.approve')
  const canPay = can('salary.disburse')

  const act = async (path: string, body: Record<string, unknown> | undefined, message: string) => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(path, { method: 'POST', body })
      setDone(message)
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not do that.')
    } finally {
      setBusy(false)
    }
  }

  const sheet = async (slip: Slip) => {
    setOpen(slip)
    setQuote(null)
    setLop(Money.days(slip.lop_days))
    setHoldReason('')
    setProblem(null)
    setDone(null)

    try {
      setOpen(await api<Slip>(`/payslips/${slip.uuid}`))
    } catch {
      setProblem('Could not load the full payslip.')
    }

    if (!canPay) {
      return
    }

    try {
      setQuote(await api<Quote>(`/payslips/${slip.uuid}/transfer-quote`))
    } catch {
      setQuote(null)
    }
  }

  const closeSheet = () => {
    setOpen(null)
    setQuote(null)
    setProblem(null)
  }

  const saveLop = async () => {
    if (!open || busy) {
      return
    }

    const days = Number(lop)

    if (!Number.isFinite(days) || days < 0 || days > Number(open.working_days)) {
      setProblem(`LOP 0 se ${Money.days(open.working_days)} din ke beech hona chahiye.`)

      return
    }

    setBusy(true)
    setProblem(null)

    try {
      const fresh = await api<Slip>(`/payslips/${open.uuid}/lop`, { method: 'PUT', body: { lop_days: days } })

      setOpen(fresh)
      setDone(`${fresh.employee_name} ka LOP ${Money.days(days)} din kar diya.`)
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not update the LOP.')
    } finally {
      setBusy(false)
    }
  }

  const sendMoney = async (
    path: string,
    body: Record<string, unknown>,
    land: (result: Record<string, any>) => void,
    fallback: string
  ) => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)
    setCodeProblem(null)

    try {
      const answer = await api<Record<string, any>>(path, { method: 'POST', body })

      if (answer?.verification !== undefined) {
        setWaiting({ path, body, verification: answer.verification as Verification })
      } else {
        setWaiting(null)
        land(answer)
        await record.refresh()
      }
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : fallback

      if (waiting !== null) {
        setCodeProblem(message)
      } else {
        setProblem(message)
      }
    } finally {
      setBusy(false)
    }
  }

  const transferOne = async () => {
    if (!open) {
      return
    }

    const slip = open

    await sendMoney(
      `/payslips/${slip.uuid}/transfer`,
      {},
      (result) => {
        if (result.disbursement?.status === 'success') {
          closeSheet()
          setDone(`${result.payslip.employee_name} ko ${Money.rupee(result.payslip.net_payable)} bhej diya.`)
        } else {
          setOpen(result.payslip)
          setProblem(result.disbursement?.failure_reason ?? 'Bank ne mana kiya.')
        }
      },
      'Could not send the salary.'
    )
  }

  const payEveryone = async () => {
    await sendMoney(
      `/payroll-runs/${uuid}/transfer`,
      {},
      (result) => {
        setDone(
          `${result.sent} salary bhej di (${Money.rupee(result.amount_sent)})`
          + (result.failed > 0 ? ` · ${result.failed} fail` : '')
          + (result.skipped_on_hold > 0 ? ` · ${result.skipped_on_hold} stop par chhodi` : '')
          + (result.skipped_unapproved > 0 ? ` · ${result.skipped_unapproved} approve nahi thi` : '')
        )
      },
      'Could not send the salaries.'
    )
  }

  const confirmCode = async (code: string) => {
    if (!waiting) {
      return
    }

    setBusy(true)
    setCodeProblem(null)

    try {
      const answer = await api<Record<string, any>>(waiting.path, {
        method: 'POST',
        body: { ...waiting.body, verification_uuid: waiting.verification.uuid, code },
      })

      setWaiting(null)

      if (answer?.sent !== undefined) {
        setDone(
          `${answer.sent} salary bhej di (${Money.rupee(answer.amount_sent)})`
          + (answer.failed > 0 ? ` · ${answer.failed} fail` : '')
          + (answer.skipped_on_hold > 0 ? ` · ${answer.skipped_on_hold} stop par chhodi` : '')
        )
      } else if (answer?.disbursement !== undefined) {
        closeSheet()
        setDone(
          answer.disbursement.status === 'success'
            ? `${answer.payslip.employee_name} ko ${Money.rupee(answer.payslip.net_payable)} bhej diya.`
            : answer.disbursement.failure_reason ?? 'Bank ne mana kiya.'
        )
      } else {
        setScheduling(null)
        setDone('Transfer ka time set ho gaya.')
      }

      await record.refresh()
    } catch (caught) {
      setCodeProblem(caught instanceof ApiError ? caught.message : 'Code nahi chala.')
    } finally {
      setBusy(false)
    }
  }

  const resendCode = async () => {
    if (!waiting) {
      return
    }

    setBusy(true)
    setCodeProblem(null)

    try {
      const answer = await api<Record<string, any>>(waiting.path, { method: 'POST', body: waiting.body })

      if (answer?.verification !== undefined) {
        setWaiting({ ...waiting, verification: answer.verification as Verification })
      }
    } catch (caught) {
      setCodeProblem(caught instanceof ApiError ? caught.message : 'Naya code nahi bheja ja saka.')
    } finally {
      setBusy(false)
    }
  }

  const approveOne = async (slip: Slip, on: boolean) => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      const fresh = await api<Slip>(`/payslips/${slip.uuid}/${on ? 'approve' : 'unapprove'}`, { method: 'POST' })

      setOpen(fresh)
      setDone(on ? `${fresh.employee_name} ki salary approve ho gayi.` : 'Approval wapas le li.')
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not change the approval.')
    } finally {
      setBusy(false)
    }
  }

  const approveEveryone = async () => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      const result = await api<Record<string, any>>(`/payroll-runs/${uuid}/approve-items`, {
        method: 'POST',
        body: {},
      })

      const left = (result.skipped ?? []).length

      setDone(
        `${result.approved} salary approve ho gayi`
        + (left > 0 ? ` · ${left} chhod di` : '')
      )

      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not approve them.')
    } finally {
      setBusy(false)
    }
  }

  const openSchedule = async () => {
    setBusy(true)
    setProblem(null)

    try {
      const defaults = await api<Record<string, any>>(`/payroll-runs/${uuid}/schedule`)

      setScheduling(defaults)
      setScheduleDate(String(defaults.date ?? ''))
      setScheduleTime(String(defaults.time ?? ''))
      setScheduleNote('')
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not open the schedule.')
    } finally {
      setBusy(false)
    }
  }

  const saveSchedule = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate.trim())) {
      setProblem('Date aise do — 2026-09-07')

      return
    }

    if (!/^\d{2}:\d{2}$/.test(scheduleTime.trim())) {
      setProblem('Time aise do — 10:00')

      return
    }

    await sendMoney(
      `/payroll-runs/${uuid}/schedule`,
      { date: scheduleDate.trim(), time: scheduleTime.trim(), note: scheduleNote.trim() || null },
      () => {
        setScheduling(null)
        setDone('Transfer ka time set ho gaya.')
      },
      'Could not set the time.'
    )
  }

  const dropSchedule = async () => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(`/payroll-runs/${uuid}/schedule`, { method: 'DELETE' })
      setScheduling(null)
      setDone('Schedule hata diya.')
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not remove the schedule.')
    } finally {
      setBusy(false)
    }
  }

  const grab = async (slip: Slip) => {
    setBusy(true)

    try {
      await downloadFile(`/payslips/${slip.uuid}/download`, `Payslip-${slip.employee_code}.html`)
    } catch {
      setProblem('Could not download the payslip.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Payroll" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Payroll" leading="back">
        <ErrorState message={record.error ?? 'Could not load this payroll.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const { run, slips, slipPage, review, runQuote } = record.data

  const shown = slips
  const sendable = Number(runQuote?.headcount ?? 0)
  const waitingCount = Number(run.waiting_approval_count ?? 0)
  const window = run.transfer_window ?? null

  return (
    <Screen title={run.month_label} subtitle={run.status_label} leading="back">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {done ? <Notice tone="success" title="Done" message={done} /> : null}
        {problem ? <Notice tone="danger" title="Could not do that" message={problem} /> : null}

        <View style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <View style={styles.summaryRow}>
            <Stat label="Employees" value={String(run.headcount)} />
            <Stat label="Gross" value={Money.short(run.total_earnings)} />
            <Stat label="Deducted" value={Money.short(run.total_deductions)} />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.line }]} />
          <View style={styles.summaryRow}>
            <Stat label="Net payable" value={Money.rupee(run.total_net)} strong />
            <Stat label="Paid" value={`${run.paid_count} of ${run.headcount}`} />
            <Stat label="Employer cost" value={Money.short(run.total_employer)} />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.line }]} />

          <View style={styles.summaryRow}>
            <Stat label="Approved" value={`${run.approved_count} of ${run.headcount}`} />
            <Stat label="Waiting" value={String(waitingCount)} />
            <Stat label="Stopped" value={String(run.stopped_count ?? 0)} />
          </View>

          {window ? (
            <Text style={[styles.payDate, { color: window.is_open ? theme.success : theme.inkSubtle }]}>
              {window.is_open
                ? `Transfer khula hai — ${window.opens_label} se`
                : `Transfer ${window.opens_label} se khulega`}
              {window.is_scheduled ? ' (HR ne set kiya)' : ''}
            </Text>
          ) : null}
        </View>

        {run.is_editable && canRun ? (
          <Button
            label={run.headcount === 0 ? 'Calculate this month' : 'Calculate again'}
            onPress={() => void act(`/payroll-runs/${uuid}/calculate`, undefined, 'Payroll calculate ho gaya.')}
            loading={busy}
            fullWidth
          />
        ) : null}

        {run.is_editable && canApprove && review ? (
          <View style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.blockTitle, { color: theme.inkMuted }]}>Final approval</Text>

            <View style={styles.summaryRow}>
              <Stat label="Ready" value={String(review.ready_to_approve ?? 0)} />
              <Stat label="Amount" value={Money.short(review.ready_amount)} />
              <Stat label="On LOP" value={String(review.with_lop ?? 0)} />
            </View>

            {Number(review.lop_amount_cut) > 0 ? (
              <Text style={[styles.payDate, { color: theme.inkSubtle }]}>
                LOP ke chalte {Money.rupee(review.lop_amount_cut)} kam ja raha hai
              </Text>
            ) : null}

            {Number(review.ready_to_approve) > 0 ? (
              <Button
                label={`Approve ${review.ready_to_approve} salary in one go`}
                onPress={() => void approveEveryone()}
                loading={busy}
                fullWidth
              />
            ) : null}

            {(review.needs_attention ?? []).length > 0 ? (
              <>
                <Text style={[styles.blockTitle, { color: theme.inkMuted }]}>Inke saath kuch karna hai</Text>

                {(review.needs_attention ?? []).map((row: Record<string, any>) => (
                  <View key={row.uuid} style={styles.attention}>
                    <Text style={[styles.attentionName, { color: theme.ink }]}>
                      {row.employee_name} · {row.employee_code}
                    </Text>
                    <Text style={[styles.attentionWhy, { color: theme.warning }]}>{row.reason}</Text>
                  </View>
                ))}
              </>
            ) : null}
          </View>
        ) : null}

        {run.status === 'calculated' && canApprove ? (
          <Button
            label="Approve this payroll"
            onPress={() => void act(`/payroll-runs/${uuid}/approve`, undefined, 'Approve ho gaya. Ab salary bhej sakte ho.')}
            loading={busy}
            disabled={busy || waitingCount > 0}
            fullWidth
          />
        ) : null}

        {run.status === 'calculated' && canApprove && waitingCount > 0 ? (
          <Notice
            tone="warning"
            title={`${waitingCount} salary par final approval baaki hai`}
            message="Sabko approve karo, ya jinki rokni hai unko stop karo. Uske baad hi payroll approve hoga."
          />
        ) : null}

        {run.status === 'calculated' && canApprove && waitingCount === 0 ? (
          <Notice
            tone="info"
            title="Approve karne ke baad amount lock ho jaayega"
            message="LOP aur recalculate dono band ho jaate hain. Pehle sab check kar lo."
          />
        ) : null}

        {run.is_payable && canPay ? (
          <>
            <Button
              label={window?.is_scheduled ? 'Time badlo' : 'Transfer ka time set karo'}
              variant="secondary"
              onPress={() => void openSchedule()}
              disabled={busy}
              fullWidth
            />

            {window?.is_scheduled ? (
              <>
                <Notice
                  tone="info"
                  title={`Transfer ${window.opens_label} par jaayega`}
                  message={run.schedule_note ? run.schedule_note : 'Us time par apne aap chala jaayega.'}
                />
                <Button
                  label="Schedule hata do"
                  variant="secondary"
                  onPress={() => void dropSchedule()}
                  disabled={busy}
                  fullWidth
                />
              </>
            ) : null}
          </>
        ) : null}

        {run.is_payable && canPay && sendable > 0 ? (
          <Button
            label={
              runQuote?.can_transfer === false
                ? 'Abhi transfer band hai'
                : `Send salary to ${sendable} employee${sendable === 1 ? '' : 's'}`
            }
            onPress={() => void payEveryone()}
            loading={busy}
            disabled={busy || runQuote?.can_transfer === false}
            fullWidth
          />
        ) : null}

        {run.is_payable && canPay && runQuote?.can_transfer === false ? (
          <Notice
            tone="danger"
            title="Abhi nahi bhej sakte"
            message={(runQuote.blockers ?? []).join(' ')}
          />
        ) : null}

        {run.is_payable && canPay && runQuote?.sending_early && runQuote?.can_transfer ? (
          <Notice
            tone="warning"
            title="Pay date se pehle ja raha hai"
            message={`Window ${window?.opens_label} ko khulti hai. Aap fir bhi bhej sakte ho.`}
          />
        ) : null}

        {run.is_payable && canPay && Number(runQuote?.waiting_for_approval) > 0 ? (
          <Notice
            tone="warning"
            title={`${runQuote?.waiting_for_approval} salary approve nahi hui`}
            message="Unki salary is transfer me nahi jaayegi."
          />
        ) : null}

        {run.is_editable && canApprove && run.headcount > 0 ? (
          <Button
            label="Cancel this payroll"
            variant="secondary"
            onPress={() => void act(`/payroll-runs/${uuid}/cancel`, undefined, 'Payroll cancel kar diya.')}
            disabled={busy}
            fullWidth
          />
        ) : null}

        {run.headcount > 0 ? (
          <View style={styles.chips}>
            {filters.map((row) => (
              <Chip
                key={row.key}
                label={row.label}
                count={countFor(run, row.key)}
                active={filter === row.key}
                onPress={() => {
                  setFilter(row.key)
                  setPage(1)
                }}
              />
            ))}
          </View>
        ) : null}

        {slips.length === 0 ? (
          <Notice
            tone="info"
            title={run.headcount === 0 ? 'Kuch calculate nahi hua' : 'Is filter me koi nahi'}
            message={
              run.headcount === 0
                ? 'Calculate dabao — jiska structure set hai uski payslip ban jaayegi.'
                : 'Dusra filter chuno.'
            }
          />
        ) : null}

        {shown.map((slip) => (
          <Pressable
            key={slip.uuid}
            onPress={() => void sheet(slip)}
            style={({ pressed }) => [
              styles.slip,
              { backgroundColor: pressed ? theme.canvas : theme.surface, borderColor: theme.line },
            ]}
          >
            <View style={styles.head}>
              <Text numberOfLines={1} style={[styles.name, { color: theme.ink }]}>
                {slip.employee_name}
              </Text>
              <View style={[styles.tag, { backgroundColor: paySoft(theme, slip.payment_status) }]}>
                <Text style={[styles.tagText, { color: payInk(theme, slip.payment_status) }]}>
                  {slip.payment_label}
                </Text>
              </View>
            </View>

            {slip.payment_status === 'pending' || slip.is_stopped ? (
              <Text
                style={[
                  styles.flag,
                  { color: slip.is_stopped ? theme.danger : slip.is_approved ? theme.success : theme.warning },
                ]}
              >
                {slip.approval_label}
              </Text>
            ) : null}

            <Text style={[styles.meta, { color: theme.inkMuted }]}>
              {slip.employee_code}
              {slip.designation ? ` · ${slip.designation}` : ''}
            </Text>

            <View style={styles.slipNumbers}>
              <Text style={[styles.net, { color: theme.ink }]}>{Money.rupee(slip.net_payable)}</Text>
              <Text style={[styles.days, { color: theme.inkSubtle }]}>
                {Money.days(slip.paid_days)} of {Money.days(slip.working_days)} days
                {slip.lop_days > 0 ? ` · ${Money.days(slip.lop_days)} LOP` : ''}
              </Text>
            </View>

            {slip.lop_differs_from_attendance && slip.lop_locked_by_hr ? (
              <Text style={[styles.flag, { color: theme.warning }]}>
                HR ne LOP set kiya — attendance {Money.days(slip.lop_suggested)} din keh rahi thi
              </Text>
            ) : null}

            {slip.hold_reason ? (
              <Text style={[styles.flag, { color: theme.danger }]}>On hold — {slip.hold_reason}</Text>
            ) : null}
          </Pressable>
        ))}

        {slipPage ? (
          <Pager
            page={slipPage.current_page}
            lastPage={slipPage.last_page}
            total={slipPage.total}
            perPage={slipPage.per_page}
            busy={record.refreshing || busy}
            onChange={setPage}
          />
        ) : null}
      </ScrollView>

      <Modal visible={open !== null} transparent animationType="slide" onRequestClose={closeSheet}>
        <Pressable style={styles.backdrop} onPress={closeSheet} />

        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={[styles.sheetHead, { borderBottomColor: theme.line }]}>
            <Text numberOfLines={1} style={[styles.sheetTitle, { color: theme.ink }]}>
              {open?.employee_name ?? ''}
            </Text>
            <Pressable onPress={closeSheet} hitSlop={10}>
              <Text style={[styles.closeMark, { color: theme.inkMuted }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {problem ? <Notice tone="danger" title="Could not do that" message={problem} /> : null}

            {open ? (
              <>
                <View style={styles.sheetTop}>
                  <Text style={[styles.sheetNet, { color: theme.ink }]}>{Money.rupee(open.net_payable, 2)}</Text>
                  <Text style={[styles.sheetSub, { color: theme.inkMuted }]}>
                    {open.employee_code} · {Money.days(open.paid_days)} of {Money.days(open.working_days)} days paid
                  </Text>
                </View>

                <View style={[styles.lines, { borderColor: theme.line }]}>
                  {(open.lines ?? []).map((line: Record<string, any>) => (
                    <View key={line.code} style={styles.line}>
                      <Text style={[styles.lineName, { color: line.kind === 'employer_cost' ? theme.inkSubtle : theme.ink }]}>
                        {line.name}
                        {line.kind === 'employer_cost' ? ' (company)' : ''}
                      </Text>

                      <View style={styles.lineRight}>
                        {line.was_cut ? (
                          <Text style={[styles.lineFull, { color: theme.inkSubtle }]}>
                            {Money.rupee(line.full_amount)}
                          </Text>
                        ) : null}
                        <Text
                          style={[
                            styles.lineAmount,
                            { color: line.kind === 'deduction' ? theme.danger : theme.ink },
                          ]}
                        >
                          {line.kind === 'deduction' ? '−' : ''}
                          {Money.rupee(line.amount, 2)}
                        </Text>
                      </View>
                    </View>
                  ))}

                  <View style={[styles.line, styles.lineTotal, { borderTopColor: theme.ink }]}>
                    <Text style={[styles.lineName, { color: theme.ink, fontWeight: '800' }]}>Net pay</Text>
                    <Text style={[styles.lineAmount, { color: theme.ink, fontWeight: '800' }]}>
                      {Money.rupee(open.net_payable, 2)}
                    </Text>
                  </View>
                </View>

                {canApprove && (open.run_status === 'draft' || open.run_status === 'calculated') ? (
                  <View style={styles.block}>
                    <Text style={[styles.blockTitle, { color: theme.inkMuted }]}>Final approval</Text>

                    {open.is_stopped ? (
                      <Notice
                        tone="danger"
                        title="Ye salary stop par hai"
                        message={`${open.hold_reason ?? 'HR ne roka hai'} — stop hatao tab approve hoga.`}
                      />
                    ) : open.is_approved ? (
                      <>
                        <Notice
                          tone="success"
                          title="Approve ho chuki hai"
                          message={`${Money.rupee(open.net_payable, 2)} par approval lag gayi. Isi amount se transfer hoga.`}
                        />
                        <Button
                          label="Approval wapas lo"
                          variant="secondary"
                          onPress={() => void approveOne(open, false)}
                          disabled={busy}
                          fullWidth
                        />
                      </>
                    ) : (
                      <Button
                        label={`Approve ${Money.rupee(open.net_payable, 2)}`}
                        onPress={() => void approveOne(open, true)}
                        loading={busy}
                        fullWidth
                      />
                    )}
                  </View>
                ) : null}

                {open.run_status === 'draft' || open.run_status === 'calculated' ? (
                  canRun ? (
                    <View style={styles.block}>
                      <Field
                        label="Loss of pay (days)"
                        value={lop}
                        onChangeText={setLop}
                        placeholder="0"
                        keyboardType="decimal-pad"
                        editable={!busy}
                      />
                      <Text style={[styles.hint, { color: theme.inkSubtle }]}>
                        Attendance {Money.days(open.lop_suggested)} din keh rahi hai. Aapka faisla chalega.
                      </Text>
                      <Button label="Save and recalculate" onPress={saveLop} loading={busy} fullWidth />
                    </View>
                  ) : null
                ) : (
                  <Notice
                    tone="info"
                    title="Amount lock hai"
                    message="Payroll approve ho gaya hai, ab LOP nahi badal sakta."
                  />
                )}

                {canPay && quote ? (
                  <View style={styles.block}>
                    <Text style={[styles.blockTitle, { color: theme.inkMuted }]}>Where the money goes</Text>

                    <View style={[styles.route, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
                      <Text style={[styles.routeLine, { color: theme.ink }]}>
                        {quote.from?.bank_name ?? '—'} {quote.from?.account_masked ?? ''}
                      </Text>
                      <Text style={[styles.routeArrow, { color: theme.inkSubtle }]}>↓ {Money.rupee(quote.amount, 2)}</Text>
                      <Text style={[styles.routeLine, { color: theme.ink }]}>
                        {quote.to?.bank_name ?? 'No employee account'} {quote.to?.masked ?? ''}
                      </Text>
                      {quote.to?.account_holder_name ? (
                        <Text style={[styles.routeName, { color: theme.inkSubtle }]}>
                          {quote.to.account_holder_name} · {quote.to.ifsc_code}
                        </Text>
                      ) : null}
                    </View>

                    {quote.is_mock ? (
                      <Notice
                        tone="warning"
                        title="Test bank laga hai"
                        message="Asli paisa kahin nahi jaayega. Bank ki detail .env me daalne ke baad asli transfer hoga."
                      />
                    ) : null}

                    {quote.can_transfer ? (
                      <Button label="Transfer this salary" onPress={transferOne} loading={busy} fullWidth />
                    ) : (
                      <Notice
                        tone="danger"
                        title="Abhi nahi bhej sakte"
                        message={(quote.blockers ?? []).join(' ')}
                      />
                    )}
                  </View>
                ) : null}

                {canRun && !open.is_paid ? (
                  <View style={styles.block}>
                    {open.payment_status === 'on_hold' ? (
                      <Button
                        label="Stop hatao"
                        variant="secondary"
                        onPress={() => void act(`/payslips/${open.uuid}/release`, undefined, 'Stop hata diya.').then(() => closeSheet())}
                        disabled={busy}
                        fullWidth
                      />
                    ) : (
                      <>
                        <Field
                          label="Salary rokni hai kyunki"
                          value={holdReason}
                          onChangeText={setHoldReason}
                          placeholder="Bank detail check karni hai"
                          editable={!busy}
                        />
                        <Button
                          label="Stop this salary"
                          variant="secondary"
                          onPress={() =>
                            void act(
                              `/payslips/${open.uuid}/hold`,
                              { reason: holdReason.trim() || null },
                              'Salary stop kar di.'
                            ).then(() => closeSheet())
                          }
                          disabled={busy}
                          fullWidth
                        />
                      </>
                    )}
                  </View>
                ) : null}

                {open.run_status === 'approved' || open.run_status === 'paid' ? (
                  <Button
                    label="Download the payslip"
                    variant="secondary"
                    onPress={() => void grab(open)}
                    disabled={busy}
                    fullWidth
                  />
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={scheduling !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setScheduling(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setScheduling(null)} />

        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={[styles.sheetHead, { borderBottomColor: theme.line }]}>
            <Text style={[styles.sheetTitle, { color: theme.ink }]}>Transfer kab jaaye</Text>
            <Pressable onPress={() => setScheduling(null)} hitSlop={10}>
              <Text style={[styles.closeMark, { color: theme.inkMuted }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {problem ? <Notice tone="danger" title="Could not do that" message={problem} /> : null}

            {scheduling ? (
              <>
                <Text style={[styles.hint, { color: theme.inkSubtle }]}>
                  {scheduling.headcount} employees · {Money.rupee(scheduling.amount)} ·{' '}
                  {scheduling.weekday} ko padta hai
                </Text>

                {scheduling.is_sunday ? (
                  <Notice
                    tone="warning"
                    title="Ye Sunday hai"
                    message="Bahut companies Sunday ko transfer nahi karti. Chaho to ek din pehle ki date daal do."
                  />
                ) : null}

                {Number(scheduling.waiting_for_approval) > 0 ? (
                  <Notice
                    tone="warning"
                    title={`${scheduling.waiting_for_approval} salary approve nahi hui`}
                    message="Us din unki salary nahi jaayegi."
                  />
                ) : null}

                <Field
                  label="Date"
                  value={scheduleDate}
                  onChangeText={setScheduleDate}
                  placeholder="2026-09-07"
                  editable={!busy}
                />

                <Field
                  label="Time"
                  value={scheduleTime}
                  onChangeText={setScheduleTime}
                  placeholder="10:00"
                  editable={!busy}
                />

                <Field
                  label="Note"
                  value={scheduleNote}
                  onChangeText={setScheduleNote}
                  placeholder="7 Sunday hai"
                  editable={!busy}
                />

                <Button label="Set this time" onPress={() => void saveSchedule()} loading={busy} fullWidth />
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <CodeSheet
        verification={waiting?.verification ?? null}
        busy={busy}
        problem={codeProblem}
        onSubmit={(code) => void confirmCode(code)}
        onResend={() => void resendCode()}
        onClose={() => {
          setWaiting(null)
          setCodeProblem(null)
        }}
      />
    </Screen>
  )
}

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const theme = useTheme()

  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: theme.inkSubtle }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.ink, fontSize: strong ? font.lg : font.md }]}>{value}</Text>
    </View>
  )
}

function countFor(run: Run, key: string): number | null {
  const counts: Record<string, number> = {
    all: Number(run.headcount ?? 0),
    waiting: Number(run.waiting_approval_count ?? 0),
    approved: Number(run.approved_count ?? 0),
    paid: Number(run.paid_count ?? 0),
    on_hold: Number(run.stopped_count ?? 0),
  }

  return key in counts ? counts[key] : null
}

function Chip({
  label,
  count,
  active,
  onPress,
}: {
  label: string
  count: number | null
  active: boolean
  onPress: () => void
}) {
  const theme = useTheme()

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? theme.brand : theme.surface, borderColor: active ? theme.brand : theme.line },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? '#fff' : theme.inkMuted }]}>
        {count === null ? label : `${label} ${count}`}
      </Text>
    </Pressable>
  )
}

function paySoft(theme: ReturnType<typeof useTheme>, status: string): string {
  return status === 'paid'
    ? theme.successSoft
    : status === 'failed'
      ? theme.dangerSoft
      : status === 'on_hold'
        ? theme.warningSoft
        : theme.infoSoft
}

function payInk(theme: ReturnType<typeof useTheme>, status: string): string {
  return status === 'paid'
    ? theme.success
    : status === 'failed'
      ? theme.danger
      : status === 'on_hold'
        ? theme.warning
        : theme.info
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  summary: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  divider: {
    height: 1,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statValue: {
    fontWeight: '700',
  },
  payDate: {
    fontSize: font.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  slip: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flexShrink: 1,
    fontSize: font.md,
    fontWeight: '700',
  },
  tag: {
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  meta: {
    fontSize: font.xs,
  },
  slipNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: 4,
  },
  net: {
    fontSize: font.lg,
    fontWeight: '800',
  },
  days: {
    fontSize: font.xs,
    fontWeight: '600',
  },
  flag: {
    fontSize: font.xs,
    fontWeight: '600',
    paddingTop: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  sheetTitle: {
    flexShrink: 1,
    fontSize: font.lg,
    fontWeight: '800',
  },
  closeMark: {
    fontSize: font.lg,
    fontWeight: '700',
  },
  sheetBody: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  sheetTop: {
    paddingBottom: spacing.md,
    gap: 2,
  },
  sheetNet: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  sheetSub: {
    fontSize: font.sm,
  },
  lines: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 7,
  },
  lineTotal: {
    borderTopWidth: 1.5,
    marginTop: 4,
    paddingTop: 10,
  },
  lineName: {
    flexShrink: 1,
    fontSize: font.sm,
    fontWeight: '600',
  },
  lineRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  lineFull: {
    fontSize: font.xs,
    textDecorationLine: 'line-through',
  },
  lineAmount: {
    fontSize: font.sm,
    fontWeight: '700',
  },
  block: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  attention: {
    gap: 2,
    paddingTop: 4,
  },
  attentionName: {
    fontSize: font.sm,
    fontWeight: '700',
  },
  attentionWhy: {
    fontSize: font.xs,
  },
  blockTitle: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  route: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 4,
  },
  routeLine: {
    fontSize: font.sm,
    fontWeight: '700',
  },
  routeArrow: {
    fontSize: font.xs,
    fontWeight: '700',
  },
  routeName: {
    fontSize: font.xs,
  },
  hint: {
    fontSize: font.xs,
    lineHeight: 16,
  },
})
