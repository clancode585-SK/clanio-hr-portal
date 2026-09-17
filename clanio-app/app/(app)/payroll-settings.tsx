import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Select } from '@/components/ui/Select'
import { ErrorState, Loader } from '@/components/ui/States'
import { Toggle } from '@/components/ui/Toggle'
import { ApiError, api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Payload = {
  company_id: number
  settings: Record<string, string | number | boolean>
  meaning: Record<string, string>
}

export default function PayrollSettingsScreen() {
  const theme = useTheme()
  const { can } = useAuth()

  const load = useCallback(() => api<Payload>('/payroll-settings'), [])
  const record = useResource<Payload>(load, [])

  const [payDay, setPayDay] = useState('')
  const [payTime, setPayTime] = useState('')
  const [reviewDay, setReviewDay] = useState('')
  const [codeOn, setCodeOn] = useState(true)
  const [codeTo, setCodeTo] = useState('admin')
  const [earlyBlock, setEarlyBlock] = useState(true)
  const [gratuity, setGratuity] = useState(false)
  const [encashment, setEncashment] = useState(false)
  const [noticeBasis, setNoticeBasis] = useState('gross')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const settings = record.data?.settings

  useEffect(() => {
    if (!settings) {
      return
    }

    setPayDay(String(settings.salary_pay_day ?? ''))
    setPayTime(String(settings.salary_pay_time ?? ''))
    setReviewDay(String(settings.payroll_review_day ?? ''))
    setCodeOn(Boolean(settings.transfer_otp_enabled))
    setCodeTo(String(settings.transfer_otp_to ?? 'admin'))
    setEarlyBlock(Boolean(settings.transfer_early_block))
    setGratuity(Boolean(settings.gratuity_enabled))
    setEncashment(Boolean(settings.encashment_enabled))
    setNoticeBasis(String(settings.notice_recovery_basis ?? 'gross'))
  }, [settings])

  const canEdit = can('payroll.approve')

  const save = async () => {
    if (busy) {
      return
    }

    const found: Record<string, string> = {}
    const day = Number(payDay)
    const review = Number(reviewDay)

    if (!Number.isInteger(day) || day < 1 || day > 28) {
      found.salary_pay_day = '1 se 28 ke beech koi date do'
    }

    if (!/^\d{2}:\d{2}$/.test(payTime.trim())) {
      found.salary_pay_time = 'Time aise do — 10:00'
    }

    if (!Number.isInteger(review) || review < 1 || review > 28) {
      found.payroll_review_day = '1 se 28 ke beech koi date do'
    }

    setErrors(found)

    if (Object.keys(found).length > 0) {
      return
    }

    setBusy(true)
    setProblem(null)
    setDone(null)

    try {
      await api('/payroll-settings', {
        method: 'PUT',
        body: {
          salary_pay_day: day,
          salary_pay_time: payTime.trim(),
          payroll_review_day: review,
          transfer_otp_enabled: codeOn,
          transfer_otp_to: codeTo,
          transfer_early_block: earlyBlock,
          gratuity_enabled: gratuity,
          encashment_enabled: encashment,
          notice_recovery_basis: noticeBasis,
        },
      })

      setDone('Settings save ho gayi.')
      await record.refresh()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not save the settings.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Payroll Settings">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Payroll Settings">
        <ErrorState message={record.error ?? 'Could not load the settings.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const meaning = record.data.meaning

  return (
    <Screen title="Payroll Settings" subtitle="Salary kab aur kaise jaati hai">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
        keyboardShouldPersistTaps="handled"
      >
        {done ? <Notice tone="success" title="Done" message={done} /> : null}
        {problem ? <Notice tone="danger" title="Could not save" message={problem} /> : null}

        {!canEdit ? (
          <Notice
            tone="info"
            title="Sirf dekh sakte ho"
            message="Ye settings badalne ka haq admin ke paas hai."
          />
        ) : null}

        <Text style={[styles.section, { color: theme.inkMuted }]}>Salary ka din</Text>

        <Field
          label="Deduction date (mahine ki tarikh)"
          value={payDay}
          onChangeText={setPayDay}
          placeholder="7"
          keyboardType="number-pad"
          error={errors.salary_pay_day}
          editable={canEdit && !busy}
        />
        <Text style={[styles.meaning, { color: theme.inkSubtle }]}>{meaning.salary_pay_day}</Text>

        <Field
          label="Transfer ka time"
          value={payTime}
          onChangeText={setPayTime}
          placeholder="10:00"
          error={errors.salary_pay_time}
          editable={canEdit && !busy}
        />
        <Text style={[styles.meaning, { color: theme.inkSubtle }]}>{meaning.salary_pay_time}</Text>

        <Field
          label="HR review shuru hone ka din"
          value={reviewDay}
          onChangeText={setReviewDay}
          placeholder="25"
          keyboardType="number-pad"
          error={errors.payroll_review_day}
          editable={canEdit && !busy}
        />
        <Text style={[styles.meaning, { color: theme.inkSubtle }]}>{meaning.payroll_review_day}</Text>

        <Text style={[styles.section, { color: theme.inkMuted }]}>Paise ki safety</Text>

        <Toggle
          label="Bhejne se pehle code maango"
          value={codeOn}
          onChange={setCodeOn}
          hint={meaning.transfer_otp_enabled}
          disabled={!canEdit || busy}
        />

        <Select
          label="Code kahan jaaye"
          value={codeTo}
          options={[
            { value: 'admin', label: 'Admin ke email par', hint: 'Jo salary bhejne ka haq rakhta hai' },
            { value: 'account', label: 'Bank account ke email par', hint: 'Company bank account me jo email diya hai' },
          ]}
          onChange={(value) => setCodeTo(value ?? 'admin')}
          disabled={!canEdit || busy}
        />

        <Toggle
          label="Pay date se pehle transfer band"
          value={earlyBlock}
          onChange={setEarlyBlock}
          hint={meaning.transfer_early_block}
          disabled={!canEdit || busy}
        />

        <Text style={[styles.section, { color: theme.inkMuted }]}>Full and final</Text>

        <Toggle
          label="Gratuity dena hai"
          value={gratuity}
          onChange={setGratuity}
          hint={meaning.gratuity_enabled}
          disabled={!canEdit || busy}
        />

        <Toggle
          label="Bachi chhutti ka paisa dena hai"
          value={encashment}
          onChange={setEncashment}
          hint={meaning.encashment_enabled}
          disabled={!canEdit || busy}
        />

        <Select
          label="Notice shortfall ka hisaab"
          value={noticeBasis}
          options={[
            { value: 'gross', label: 'Poore gross par' },
            { value: 'basic', label: 'Sirf basic par' },
          ]}
          onChange={(value) => setNoticeBasis(value ?? 'gross')}
          disabled={!canEdit || busy}
        />

        {canEdit ? (
          <Button label="Save settings" onPress={() => void save()} loading={busy} fullWidth />
        ) : null}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  section: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  meaning: {
    fontSize: font.xs,
    marginTop: -spacing.sm,
  },
})
