'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import { LogoutIcon, SpinnerIcon } from '@/components/icons'
import { logout } from '@/lib/auth'
import { fetchNavigation, type NavGroup } from '@/lib/nav'
import { fetchProfile, type Profile } from '@/lib/profile'
import { clearSession, readSession } from '@/lib/session'

export default function DashboardPage() {
  const router = useRouter()
  const [session] = useState(() => readSession())
  const [profile, setProfile] = useState<Profile | null>(null)
  const [groups, setGroups] = useState<NavGroup[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState('dashboard')

  useEffect(() => {
    if (!session) {
      router.replace('/login')

      return
    }

    let cancelled = false

    Promise.all([fetchProfile(session.token), fetchNavigation(session.token)])
      .then(([profileResult, navigationResult]) => {
        if (!cancelled) {
          setProfile(profileResult)
          setGroups(navigationResult.groups)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Could not load your workspace. Please sign in again.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [router, session])

  const signOut = async () => {
    const token = session?.token

    clearSession()
    router.replace('/login')

    if (token) {
      await logout(token).catch(() => undefined)
    }
  }

  if (!session) {
    return null
  }

  if (loadError) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas px-4">
        <div className="max-w-sm space-y-3 text-center">
          <p className="text-sm font-semibold text-danger">{loadError}</p>
          <button
            type="button"
            onClick={signOut}
            className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-body hover:border-danger/40 hover:text-danger"
          >
            Back to sign in
          </button>
        </div>
      </main>
    )
  }

  if (!profile || !groups) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas">
        <SpinnerIcon className="h-6 w-6 animate-spin text-muted" />
      </main>
    )
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <Sidebar groups={groups} activeId={activeId} onSelect={setActiveId} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-6 py-3.5">
          <div>
            <p className="text-sm font-semibold text-heading">{profile.name}</p>
            <p className="text-xs text-muted">{profile.roles[0]?.name ?? (profile.is_super_admin ? 'Super Admin' : 'Member')}</p>
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-body transition hover:border-danger/40 hover:text-danger"
            >
              <LogoutIcon className="h-4.5 w-4.5" />
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <h1 className="text-2xl font-bold tracking-tight text-heading">{activeId}</h1>
          <p className="mt-2 text-sm text-muted">This screen is not built yet.</p>
        </main>
      </div>
    </div>
  )
}
