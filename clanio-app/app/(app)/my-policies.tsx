import { useCallback, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { ListRow } from '@/components/ui/ListRow'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState, Loader } from '@/components/ui/States'
import { api, ApiError } from '@/lib/api'
import { downloadFile } from '@/lib/download'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Policy = Record<string, any>

export default function MyPoliciesScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  const [reading, setReading] = useState<Policy | null>(null)
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const result = await api<{ items?: Policy[] }>('/my-policies')

    return result.items ?? []
  }, [])

  const record = useResource<Policy[]>(load, [])

  const openFile = async () => {
    if (!reading || busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await downloadFile(
        `/policies/${reading.uuid ?? reading.id}/download`,
        reading.original_name ?? `${reading.title ?? 'policy'}.pdf`
      )
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : 'Could not open the document.')
    } finally {
      setBusy(false)
    }
  }

  const accept = async () => {
    if (!reading || busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(`/policies/${reading.policy_uuid ?? reading.policy_id}/acknowledge`, {
        method: 'PUT',
        body: { note: note.trim() || null },
      })

      setReading(null)
      setNote('')
      await record.reload()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not record your acceptance.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Policies">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Policies">
        <ErrorState message={record.error ?? 'Could not load policies.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const policies = record.data
  const pending = policies.filter((row) => row.needs_ack && !row.acknowledged_at)

  return (
    <Screen title="Policies" subtitle={pending.length > 0 ? `${pending.length} need your acceptance` : 'All accepted'}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {pending.length > 0 ? (
          <Notice
            tone="warning"
            title="Pending acceptance"
            message="Open each one, read it, then confirm you have understood it."
          />
        ) : null}

        {policies.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState title="No policies" message="Anything HR publishes for you will land here." />
          </View>
        ) : null}

        {policies.map((row) => (
          <ListRow
            key={String(row.uuid ?? row.id)}
            title={row.title}
            subtitle={row.summary ?? row.category ?? undefined}
            badge={row.version ?? undefined}
            meta={row.acknowledged_at ? 'Accepted' : row.needs_ack ? 'Pending' : 'Read'}
            onPress={() => {
              setReading(row)
              setNote('')
              setProblem(null)
            }}
          />
        ))}
      </ScrollView>

      <Modal visible={reading !== null} transparent animationType="slide" onRequestClose={() => setReading(null)}>
        <Pressable style={styles.backdrop} onPress={() => setReading(null)} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={[styles.grab, { backgroundColor: theme.line }]} />

            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>{reading?.title}</Text>

              {reading?.effective_from ? (
                <Text style={[styles.meta, { color: theme.inkSubtle }]}>
                  Effective from {reading.effective_from}
                  {reading.version ? ` · ${reading.version}` : ''}
                </Text>
              ) : null}

              {problem ? <Notice tone="danger" title="Failed" message={problem} /> : null}

              {reading?.summary ? (
                <Text style={[styles.summary, { color: theme.inkMuted }]}>{reading.summary}</Text>
              ) : null}

              {reading?.body ? (
                <Text style={[styles.body, { color: theme.ink }]}>{reading.body}</Text>
              ) : (
                <View style={styles.actions}>
                  <Notice
                    tone="info"
                    title="This one is a document"
                    message="Open the file to read it, then come back and accept."
                  />
                  <Button label="Open the document" variant="secondary" onPress={openFile} loading={busy} fullWidth />
                </View>
              )}

              <View style={styles.actions}>
                {reading?.acknowledged_at ? (
                  <Notice
                    tone="success"
                    title="You accepted this"
                    message={`Recorded on ${String(reading.acknowledged_at).slice(0, 10)}.`}
                  />
                ) : reading?.needs_ack ? (
                  <>
                    <View style={[styles.composer, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
                      <TextInput
                        value={note}
                        onChangeText={setNote}
                        placeholder="Add a note (optional)"
                        placeholderTextColor={theme.inkSubtle}
                        style={[styles.composerInput, { color: theme.ink }]}
                        multiline
                      />
                    </View>

                    <Button label="I have read and accept this" onPress={accept} loading={busy} fullWidth />
                  </>
                ) : null}

                <Button label="Close" variant="ghost" onPress={() => setReading(null)} disabled={busy} fullWidth />
              </View>
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
    gap: spacing.md,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    minHeight: 320,
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
  },
  meta: {
    fontSize: font.xs,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  summary: {
    fontSize: font.md,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  body: {
    fontSize: font.sm,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  composer: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  composerInput: {
    fontSize: font.md,
    minHeight: 54,
    textAlignVertical: 'top',
  },
})
