import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { ErrorState, Loader } from '@/components/ui/States'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Policy = Record<string, any>

type Loaded = {
  items: Policy[]
  pending: number
  cleared: boolean
}

export function PolicyGateScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { profile, signOut, clearPolicyBlock, refreshProfile } = useAuth()

  const [index, setIndex] = useState(0)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<Loaded> => {
    const result = await api<{ items?: Policy[]; pending?: number; gate_cleared?: boolean }>('/my-policies')

    return {
      items: (result.items ?? []).filter((row) => row.status === 'pending' && !row.acknowledged_at),
      pending: Number(result.pending ?? 0),
      cleared: result.gate_cleared !== false,
    }
  }, [])

  const record = useResource<Loaded>(load, [])

  const accept = async () => {
    const policy = record.data?.items[index]

    if (!policy || busy) {
      return
    }

    setBusy(true)
    setProblem(null)

    try {
      await api(`/policies/${policy.policy_uuid ?? policy.policy_id}/acknowledge`, { method: 'PUT', body: {} })

      const remaining = (record.data?.items.length ?? 0) - 1

      if (remaining <= 0) {
        clearPolicyBlock()
        await refreshProfile()

        return
      }

      setIndex(0)
      await record.reload()
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not record your acceptance.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <View style={[styles.wrap, { backgroundColor: theme.canvas, paddingTop: insets.top }]}>
        <Loader />
      </View>
    )
  }

  if (record.error || !record.data) {
    return (
      <View style={[styles.wrap, { backgroundColor: theme.canvas, paddingTop: insets.top }]}>
        <ErrorState message={record.error ?? 'Could not load the policies.'} onRetry={record.reload} />
      </View>
    )
  }

  const { items } = record.data

  if (items.length === 0) {
    return (
      <View style={[styles.wrap, { backgroundColor: theme.canvas, paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.padded}>
          <Notice
            tone="success"
            title="Nothing left to accept"
            message="Tap continue to open the app."
          />
          <Button label="Continue" onPress={clearPolicyBlock} fullWidth />
        </View>
      </View>
    )
  }

  const policy = items[Math.min(index, items.length - 1)]

  return (
    <View style={[styles.wrap, { backgroundColor: theme.canvas, paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: theme.brand }]}>Before you start</Text>
        <Text style={[styles.title, { color: theme.ink }]}>
          {items.length} {items.length === 1 ? 'policy needs' : 'policies need'} your acceptance
        </Text>
        <Text style={[styles.subtitle, { color: theme.inkMuted }]}>
          {profile?.name ? `${profile.name}, read ` : 'Read '}
          each one and confirm. The rest of the app opens once you are done.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        {problem ? <Notice tone="danger" title="Failed" message={problem} /> : null}

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.policyTitle, { color: theme.ink }]}>{policy.title}</Text>
          <Text style={[styles.policyMeta, { color: theme.inkSubtle }]}>
            {[policy.category_label ?? policy.category, policy.version, policy.effective_from]
              .filter(Boolean)
              .join(' · ')}
          </Text>

          {policy.summary ? (
            <Text style={[styles.summary, { color: theme.inkMuted }]}>{policy.summary}</Text>
          ) : null}

          {policy.body ? (
            <Text style={[styles.body, { color: theme.ink }]}>{policy.body}</Text>
          ) : (
            <Notice
              tone="info"
              title="This one is a document"
              message="Open it from the web portal to read the full text, then come back and accept."
            />
          )}
        </View>

        {items.length > 1 ? (
          <Text style={[styles.counter, { color: theme.inkSubtle }]}>
            {index + 1} of {items.length}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg, borderTopColor: theme.line }]}>
        <Button label="I have read and accept this" onPress={accept} loading={busy} fullWidth />

        {items.length > 1 && index < items.length - 1 ? (
          <Button
            label="Read the next one first"
            variant="secondary"
            onPress={() => setIndex(index + 1)}
            disabled={busy}
            fullWidth
          />
        ) : null}

        <Button label="Sign out" variant="ghost" onPress={signOut} disabled={busy} fullWidth />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  padded: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  head: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: 4,
  },
  eyebrow: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: font.sm,
    lineHeight: 20,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  policyTitle: {
    fontSize: font.lg,
    fontWeight: '700',
  },
  policyMeta: {
    fontSize: font.xs,
    textTransform: 'capitalize',
  },
  summary: {
    fontSize: font.md,
    lineHeight: 21,
  },
  body: {
    fontSize: font.sm,
    lineHeight: 22,
  },
  counter: {
    fontSize: font.xs,
    fontWeight: '700',
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
})
