'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { LogoutIcon } from '@/components/icons'
import { logout } from '@/lib/auth'
import { clearSession, formatRole, readSession, type Session } from '@/lib/session'

export default function DashboardPage() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const current = readSession()

    if (!current) {
      router.replace('/login')

      return
    }

    setSession(current)
    setChecked(true)
  }, [router])

  const signOut = async () => {
    const token = session?.token

    clearSession()
    router.replace('/login')

    if (token) {
      await logout(token).catch(() => undefined)
    }
  }

  if (!checked || !session) {
    return null
  }

  return (
    <main className="min-h-dvh bg-canvas">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
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

        <h1 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">
          Welcome {formatRole(session.role)}
        </h1>
      </div>
    </main>
  )
}
