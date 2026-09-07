import { useCallback, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  Alert,
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
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Select, type Option } from '@/components/ui/Select'
import { ErrorState, Loader } from '@/components/ui/States'
import { Toggle } from '@/components/ui/Toggle'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Company = Record<string, any>

type Module = {
  module: string
  is_enabled: boolean
  permissions: number
  note: string | null
}

type Loaded = {
  company: Company
  modules: Module[]
}

const statuses: Option[] = [
  { value: 'active', label: 'Active', hint: 'Everyone can sign in' },
  { value: 'suspended', label: 'Suspended', hint: 'Logins are blocked' },
  { value: 'archived', label: 'Archived', hint: 'Kept for records only' },
]

const emailPattern = /^\S+@\S+\.\S+$/

export default function CompanyDetailScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { isSuperAdmin, viewCompany } = useAuth()

  const [sheet, setSheet] = useState<'edit' | 'modules' | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [modules, setModules] = useState<Module[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<Loaded> => {
    const [company, moduleList] = await Promise.all([
      api<Company>(`/companies/${id}`),
      api<{ modules: Module[] }>(`/companies/${id}/modules`).catch(() => ({ modules: [] as Module[] })),
    ])

    return { company, modules: moduleList.modules ?? [] }
  }, [id])

  const record = useResource<Loaded>(load, [id])

  const openEdit = () => {
    const company = record.data?.company

    setValues({
      name: company?.name ?? '',
      legal_name: company?.legal_name ?? '',
      slug: company?.slug ?? '',
      email: company?.email ?? '',
      phone: company?.phone ?? '',
      city: company?.city ?? '',
      state: company?.state ?? '',
      max_employees: company?.max_employees != null ? String(company.max_employees) : '',
      status: company?.status ?? 'active',
    })
    setErrors({})
    setProblem(null)
    setSheet('edit')
  }

  const openModules = () => {
    setModules(record.data?.modules ?? [])
    setProblem(null)
    setSheet('modules')
  }

  const set = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) {
        return current
      }

      const next = { ...current }
      delete next[key]

      return next
    })
  }

  const saveCompany = async () => {
    if (busy) {
      return
    }

    const next: Record<string, string> = {}
    const name = (values.name ?? '').trim()
    const slug = (values.slug ?? '').trim()
    const email = (values.email ?? '').trim()

    if (name.length < 2) next.name = 'Company name is required'
    if (slug.length < 3) next.slug = 'At least 3 characters'
    else if (!/^[A-Za-z0-9_-]+$/.test(slug)) next.slug = 'Letters, numbers, dash and underscore only'
    if (!emailPattern.test(email)) next.email = 'Enter a valid email'

    const seats = (values.max_employees ?? '').trim()
    if (seats && (!Number.isInteger(Number(seats)) || Number(seats) < 1)) {
      next.max_employees = 'A whole number, 1 or more'
    }

    setErrors(next)

    if (Object.keys(next).length > 0) {
      return
    }

    setBusy(true)
    setProblem(null)

    const optional = (key: string) => {
      const text = (values[key] ?? '').trim()

      return text.length === 0 ? {} : { [key]: text }
    }

    try {
      await api(`/companies/${id}`, {
        method: 'PUT',
        body: {
          name,
          slug: slug.toLowerCase(),
          email: email.toLowerCase(),
          ...optional('legal_name'),
          ...optional('phone'),
          ...optional('city'),
          ...optional('state'),
          ...(seats ? { max_employees: Number(seats) } : {}),
          status: values.status ?? 'active',
        },
      })

      setSheet(null)
      await record.reload()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 422 && Object.keys(caught.fields).length > 0) {
        const mapped: Record<string, string> = {}

        for (const [field, messages] of Object.entries(caught.fields)) {
          mapped[field] = messages[0]
        }

        setErrors(mapped)
        setProblem('Check the highlighted fields.')
      } else {
        setProblem(caught instanceof ApiError ? caught.message : 'Could not save.')
      }
    } finally {
      setBusy(false)
    }
  }

  const saveModules = async () => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    const payload: Record<string, boolean> = {}

    for (const row of modules) {
      payload[row.module] = row.is_enabled
    }

    try {
      await api(`/companies/${id}/modules`, { method: 'PUT', body: { modules: payload } })
      setSheet(null)
      await record.reload()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not save the modules.')
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    const company = record.data?.company

    Alert.alert(
      `Archive ${company?.name ?? 'this company'}?`,
      'Nobody from this company will be able to sign in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            setBusy(true)

            try {
              await api(`/companies/${id}`, { method: 'DELETE' })
              router.replace('/companies' as never)
            } catch (caught) {
              setProblem(caught instanceof ApiError ? caught.message : 'Could not archive.')
            } finally {
              setBusy(false)
            }
          },
        },
      ]
    )
  }

  const enterCompany = async () => {
    const company = record.data?.company

    if (!company) {
      return
    }

    await viewCompany(String(company.id))
    router.replace('/dashboard')
  }

  if (!isSuperAdmin) {
    return (
      <Screen title="Company" leading="back">
        <View style={styles.padded}>
          <Notice tone="warning" title="Platform owners only" message="Only a Clanio super admin can open this." />
        </View>
      </Screen>
    )
  }

  if (record.loading) {
    return (
      <Screen title="Company" leading="back">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Company" leading="back">
        <ErrorState message={record.error ?? 'Company not found.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const { company, modules: current } = record.data
  const enabled = current.filter((row) => row.is_enabled).length
  const seatsUsed = Number(company.employee_count ?? 0)
  const seatCap = Number(company.max_employees ?? 0)
  const seatPercent = seatCap > 0 ? Math.min(100, Math.round((seatsUsed / seatCap) * 100)) : 0

  return (
    <Screen
      title={company.name}
      subtitle={company.slug}
      leading="back"
      action={{ label: 'Edit', onPress: openEdit }}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {problem ? <Notice tone="danger" title="Failed" message={problem} /> : null}

        {company.status !== 'active' ? (
          <Notice
            tone="warning"
            title={company.status === 'suspended' ? 'Suspended' : 'Archived'}
            message="Nobody from this company can sign in right now."
          />
        ) : null}

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <View style={styles.seatHead}>
            <Text style={[styles.seatLabel, { color: theme.inkMuted }]}>Seats used</Text>
            <Text style={[styles.seatValue, { color: theme.brand }]}>
              {seatsUsed}
              {seatCap > 0 ? ` / ${seatCap}` : ''}
            </Text>
          </View>

          {seatCap > 0 ? (
            <View style={[styles.track, { backgroundColor: theme.canvas }]}>
              <View
                style={[
                  styles.fill,
                  { backgroundColor: seatPercent > 90 ? theme.danger : theme.brand, width: `${seatPercent}%` },
                ]}
              />
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Row label="Legal name" value={company.legal_name} />
          <Row label="Email" value={company.email} />
          <Row label="Phone" value={company.phone} />
          <Row label="Location" value={[company.city, company.state, company.country].filter(Boolean).join(', ')} />
          <Row label="Industry" value={company.industry} />
          <Row label="GSTIN" value={company.gstin} />
          <Row label="PAN" value={company.pan_number} />
          <Row label="Currency" value={company.currency} />
          <Row label="Timezone" value={company.timezone} />
          <Row label="Status" value={company.status} />
        </View>

        <Pressable
          onPress={openModules}
          style={({ pressed }) => [
            styles.moduleCard,
            { backgroundColor: pressed ? theme.canvas : theme.surface, borderColor: theme.line },
          ]}
        >
          <View style={styles.moduleText}>
            <Text style={[styles.moduleTitle, { color: theme.ink }]}>Modules</Text>
            <Text style={[styles.moduleHint, { color: theme.inkSubtle }]}>
              {enabled} of {current.length} switched on
            </Text>
          </View>
          <Text style={[styles.moduleAction, { color: theme.brand }]}>Change</Text>
        </Pressable>

        <Button label="Open this company" onPress={enterCompany} disabled={busy} fullWidth />

        {company.status !== 'archived' ? (
          <Button label="Archive company" variant="danger" onPress={remove} disabled={busy} fullWidth />
        ) : null}
      </ScrollView>

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={[styles.grab, { backgroundColor: theme.line }]} />

            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>
                {sheet === 'modules' ? 'What this company can use' : 'Edit company'}
              </Text>

              {problem ? <Notice tone="danger" title="Could not save" message={problem} /> : null}

              {sheet === 'edit' ? (
                <View style={styles.form}>
                  <Field label="Name" value={values.name ?? ''} onChangeText={(v) => set('name', v)} autoCapitalize="words" maxLength={200} error={errors.name} editable={!busy} />
                  <Field label="Legal name" value={values.legal_name ?? ''} onChangeText={(v) => set('legal_name', v)} placeholder="Optional" autoCapitalize="words" maxLength={200} error={errors.legal_name} editable={!busy} />
                  <Field label="Workspace slug" value={values.slug ?? ''} onChangeText={(v) => set('slug', v)} maxLength={100} error={errors.slug} editable={!busy} />
                  <Field label="Email" value={values.email ?? ''} onChangeText={(v) => set('email', v)} keyboardType="email-address" maxLength={255} error={errors.email} editable={!busy} />
                  <Field label="Phone" value={values.phone ?? ''} onChangeText={(v) => set('phone', v)} placeholder="Optional" keyboardType="phone-pad" maxLength={20} error={errors.phone} editable={!busy} />
                  <Field label="City" value={values.city ?? ''} onChangeText={(v) => set('city', v)} placeholder="Optional" autoCapitalize="words" maxLength={100} error={errors.city} editable={!busy} />
                  <Field label="State" value={values.state ?? ''} onChangeText={(v) => set('state', v)} placeholder="Optional" autoCapitalize="words" maxLength={100} error={errors.state} editable={!busy} />
                  <Field label="Seat limit" value={values.max_employees ?? ''} onChangeText={(v) => set('max_employees', v)} placeholder="200" keyboardType="number-pad" error={errors.max_employees} editable={!busy} />
                  <Select label="Status" value={values.status ?? 'active'} options={statuses} onChange={(v) => set('status', v ?? 'active')} error={errors.status} disabled={busy} />

                  <Button label="Save changes" onPress={saveCompany} loading={busy} fullWidth />
                  <Button label="Cancel" variant="ghost" onPress={() => setSheet(null)} disabled={busy} fullWidth />
                </View>
              ) : (
                <View style={styles.form}>
                  <Notice
                    tone="info"
                    title="Switching a module off hides it"
                    message="Its permissions stop working for everyone in this company, even admins."
                  />

                  {modules.map((row) => (
                    <Toggle
                      key={row.module}
                      label={row.module.replace(/_/g, ' ')}
                      hint={`${row.permissions} permission${row.permissions === 1 ? '' : 's'}`}
                      value={row.is_enabled}
                      onChange={(next) =>
                        setModules((current) =>
                          current.map((entry) => (entry.module === row.module ? { ...entry, is_enabled: next } : entry))
                        )
                      }
                      disabled={busy}
                    />
                  ))}

                  <Button label="Save modules" onPress={saveModules} loading={busy} fullWidth />
                  <Button label="Cancel" variant="ghost" onPress={() => setSheet(null)} disabled={busy} fullWidth />
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  )
}

function Row({ label, value }: { label: string; value: unknown }) {
  const theme = useTheme()

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.inkMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.ink }]}>
        {value === null || value === undefined || value === '' ? '—' : String(value)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  padded: {
    padding: spacing.lg,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  seatHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  seatLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  seatValue: {
    fontSize: font.lg,
    fontWeight: '800',
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: 9,
  },
  rowLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  rowValue: {
    flexShrink: 1,
    fontSize: font.sm,
    fontWeight: '600',
    textAlign: 'right',
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  moduleText: {
    flex: 1,
    gap: 2,
  },
  moduleTitle: {
    fontSize: font.md,
    fontWeight: '700',
  },
  moduleHint: {
    fontSize: font.sm,
  },
  moduleAction: {
    fontSize: font.sm,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '90%',
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
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
})
