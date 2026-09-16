import { useCallback, useEffect, useState } from 'react'
import * as Clipboard from 'expo-clipboard'
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { ErrorState, Loader } from '@/components/ui/States'
import { ApiError, api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useResource } from '@/lib/useResource'
import { useTheme } from '@/theme/useTheme'
import { font, radius, spacing } from '@/theme/tokens'

type Page = {
  embed_key: string
  headline: string | null
  intro: string | null
  layout: string
  accent_color: string
  show_powered_by: boolean
  allowed_domains: string | null
  is_connected: boolean
  connected_at: string | null
  last_seen_at: string | null
  last_seen_domain: string | null
  view_count: number
  live_openings: number
  total_applications: number
  hosted_url: string
  feed_url: string
  snippet: string
  intake_url: string
  intake_script: string
  intake_count: number
  intake_last_at: string | null
}

export default function CareerPageScreen() {
  const theme = useTheme()
  const { can } = useAuth()

  const load = useCallback(() => api<Page>('/career-page'), [])
  const record = useResource<Page>(load, [])

  const [headline, setHeadline] = useState('')
  const [intro, setIntro] = useState('')
  const [layout, setLayout] = useState<string | null>('cards')
  const [colour, setColour] = useState('')
  const [domains, setDomains] = useState('')
  const [badge, setBadge] = useState(true)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [scriptCopied, setScriptCopied] = useState(false)

  useEffect(() => {
    const page = record.data

    if (!page) {
      return
    }

    setHeadline(page.headline ?? '')
    setIntro(page.intro ?? '')
    setLayout(page.layout)
    setColour(page.accent_color)
    setDomains(page.allowed_domains ?? '')
    setBadge(page.show_powered_by)
  }, [record.data])

  const canEdit = can('recruitment.career_page')

  const save = async () => {
    if (busy) {
      return
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(colour.trim())) {
      setProblem('Use a colour like #1B2A6B.')

      return
    }

    setBusy(true)
    setProblem(null)
    setDone(null)

    try {
      const updated = await api<Page>('/career-page', {
        method: 'PUT',
        body: {
          headline: headline.trim() || null,
          intro: intro.trim() || null,
          layout,
          accent_color: colour.trim(),
          show_powered_by: badge,
          allowed_domains: domains.trim() || null,
        },
      })

      record.setData(updated)
      setDone('Saved. Your career page picked it up straight away.')
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!record.data) {
      return
    }

    await Clipboard.setStringAsync(record.data.snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const copyScript = async () => {
    if (!record.data) {
      return
    }

    await Clipboard.setStringAsync(record.data.intake_script)
    setScriptCopied(true)
    setTimeout(() => setScriptCopied(false), 2500)
  }

  const reissue = async () => {
    if (busy) {
      return
    }

    setBusy(true)
    setProblem(null)
    setDone(null)

    try {
      const updated = await api<Page>('/career-page/regenerate', { method: 'POST' })

      record.setData(updated)
      setDone('New snippet issued. Replace the old one on your website or the jobs will stop showing.')
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : 'Could not issue a new snippet.')
    } finally {
      setBusy(false)
    }
  }

  if (record.loading) {
    return (
      <Screen title="Career Page">
        <Loader />
      </Screen>
    )
  }

  if (record.error || !record.data) {
    return (
      <Screen title="Career Page">
        <ErrorState message={record.error ?? 'Could not load the career page.'} onRetry={record.reload} />
      </Screen>
    )
  }

  const page = record.data

  return (
    <Screen title="Career Page" subtitle={`${page.live_openings} live · ${page.total_applications} applications`}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={record.refreshing} onRefresh={record.refresh} tintColor={theme.brand} />
        }
      >
        <View
          style={[
            styles.status,
            {
              backgroundColor: page.is_connected ? theme.successSoft : theme.warningSoft,
              borderColor: page.is_connected ? theme.success : theme.warning,
            },
          ]}
        >
          <View style={styles.statusHead}>
            <View
              style={[styles.dot, { backgroundColor: page.is_connected ? theme.success : theme.warning }]}
            />
            <Text style={[styles.statusTitle, { color: page.is_connected ? theme.success : theme.warning }]}>
              {page.is_connected ? 'Connected' : 'Not connected yet'}
            </Text>
          </View>

          <Text style={[styles.statusBody, { color: theme.ink }]}>
            {page.is_connected
              ? `${page.last_seen_domain ?? 'Your website'} · last seen ${ago(page.last_seen_at)} · ${page.view_count} ${page.view_count === 1 ? 'view' : 'views'}`
              : 'Paste the snippet below on your careers page. This turns green on its own the moment it loads.'}
          </Text>
        </View>

        {done ? <Notice tone="success" title="Done" message={done} /> : null}
        {problem ? <Notice tone="danger" title="Could not do that" message={problem} /> : null}

        <Text style={[styles.group, { color: theme.inkSubtle }]}>Put it on your website</Text>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.cardTitle, { color: theme.ink }]}>Paste these two lines</Text>
          <Text style={[styles.cardBody, { color: theme.inkMuted }]}>
            Put them where you want the openings to appear on your careers page. In WordPress, Wix or Shopify this
            goes in a Custom HTML or Embed block. No developer needed.
          </Text>

          <View style={[styles.code, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
            <Text style={[styles.codeText, { color: theme.ink }]} selectable>
              {page.snippet}
            </Text>
          </View>

          <Button label={copied ? 'Copied' : 'Copy the snippet'} onPress={copy} fullWidth />
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.cardTitle, { color: theme.ink }]}>Or just share a link</Text>
          <Text style={[styles.cardBody, { color: theme.inkMuted }]}>
            This is a ready career page we host for you. Paste it on LinkedIn, Naukri, WhatsApp or your website menu.
          </Text>

          <Pressable onPress={() => void Linking.openURL(page.hosted_url)}>
            <Text style={[styles.link, { color: theme.brand }]} selectable>
              {page.hosted_url}
            </Text>
          </Pressable>

          <Button
            label="Open it"
            variant="secondary"
            onPress={() => void Linking.openURL(page.hosted_url)}
            fullWidth
          />
        </View>

        <Text style={[styles.group, { color: theme.inkSubtle }]}>Resumes from a Google Form</Text>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.cardTitle, { color: theme.ink }]}>
            {page.intake_count > 0
              ? `${page.intake_count} ${page.intake_count === 1 ? 'person has' : 'people have'} come through the form`
              : 'Connect your Google Form'}
          </Text>
          <Text style={[styles.cardBody, { color: theme.inkMuted }]}>
            A Google Form cannot post to us on its own. Paste this script into the form once and every submission
            lands here. In your form: three dots, then Apps Script, paste, then add a trigger for On form submit.
          </Text>

          <Text style={[styles.cardBody, { color: theme.inkSubtle }]}>
            Your form must have a question naming the role — use the exact job title or its web address.
          </Text>

          <View style={[styles.code, { backgroundColor: theme.canvas, borderColor: theme.line }]}>
            <Text style={[styles.codeText, { color: theme.ink }]} numberOfLines={8} selectable>
              {page.intake_script}
            </Text>
          </View>

          <Button
            label={scriptCopied ? 'Copied' : 'Copy the script'}
            variant="secondary"
            onPress={copyScript}
            fullWidth
          />

          {page.intake_last_at ? (
            <Text style={[styles.cardBody, { color: theme.inkSubtle }]}>
              Last one came in {ago(page.intake_last_at)}.
            </Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.cardTitle, { color: theme.ink }]}>Job feed for Indeed</Text>
          <Text style={[styles.cardBody, { color: theme.inkMuted }]}>
            Give this to Indeed or any board that crawls a feed. Your live openings stay in sync on their own.
          </Text>

          <Pressable onPress={() => void Linking.openURL(page.feed_url)}>
            <Text style={[styles.link, { color: theme.brand }]} selectable>
              {page.feed_url}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.group, { color: theme.inkSubtle }]}>How it looks</Text>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Field
            label="Heading"
            value={headline}
            onChangeText={setHeadline}
            placeholder="Current Openings"
            autoCapitalize="words"
            editable={canEdit && !busy}
            maxLength={150}
          />

          <Field
            label="A line about working here"
            value={intro}
            onChangeText={setIntro}
            placeholder="We build BFSI software and we hire people who care about the detail."
            autoCapitalize="sentences"
            multiline
            editable={canEdit && !busy}
            maxLength={1000}
          />

          <Select
            label="Layout"
            value={layout}
            options={[
              { value: 'cards', label: 'Cards side by side' },
              { value: 'list', label: 'One per row' },
            ]}
            onChange={setLayout}
            disabled={!canEdit || busy}
          />

          <Field
            label="Button colour"
            value={colour}
            onChangeText={setColour}
            placeholder="#1B2A6B"
            autoCapitalize="characters"
            editable={canEdit && !busy}
            maxLength={7}
          />

          <Toggle
            label="Show the Clanio credit"
            hint="A small line at the bottom of the openings."
            value={badge}
            onChange={setBadge}
            disabled={!canEdit || busy}
          />
        </View>

        <Text style={[styles.group, { color: theme.inkSubtle }]}>Keep it to your own sites</Text>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Field
            label="Allowed websites"
            value={domains}
            onChangeText={setDomains}
            placeholder="amitysoftware.com, careers.amitysoftware.com"
            editable={canEdit && !busy}
            maxLength={500}
          />
          <Text style={[styles.cardBody, { color: theme.inkSubtle }]}>
            Leave this blank and anyone can show your openings. Fill it in and only these sites can.
          </Text>
        </View>

        {canEdit ? (
          <View style={styles.actions}>
            <Button label="Save" onPress={save} loading={busy} fullWidth />
            <Button label="Issue a new snippet" variant="ghost" onPress={reissue} loading={busy} fullWidth />
          </View>
        ) : (
          <Notice
            tone="info"
            title="Read only"
            message="Only someone who manages the career page can change these."
          />
        )}
      </ScrollView>
    </Screen>
  )
}

function ago(value: string | null): string {
  if (!value) {
    return 'never'
  }

  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000)

  if (minutes < 1) {
    return 'just now'
  }

  if (minutes < 60) {
    return `${minutes} min ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h ago`
  }

  return `${Math.floor(hours / 24)}d ago`
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  status: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 6,
  },
  statusHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusTitle: {
    fontSize: font.md,
    fontWeight: '800',
  },
  statusBody: {
    fontSize: font.sm,
    lineHeight: 20,
  },
  group: {
    fontSize: font.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: font.md,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: font.sm,
    lineHeight: 20,
  },
  code: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 19,
  },
  link: {
    fontSize: font.sm,
    fontWeight: '600',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
})
