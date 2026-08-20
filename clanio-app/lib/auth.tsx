import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, setUnauthenticatedHandler } from './api'
import { clearSession, loadSession, saveSession } from './session'
import type { LoginResult, PolicyGate, Profile } from './types'

type AuthState = {
  ready: boolean
  token: string | null
  profile: Profile | null
  policyGate: PolicyGate | null
  permissions: Set<string>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  can: (slug: string) => boolean
  canAny: (slugs: string[]) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [policyGate, setPolicyGate] = useState<PolicyGate | null>(null)
  const signingOut = useRef(false)

  const reset = useCallback(async () => {
    if (signingOut.current) {
      return
    }

    signingOut.current = true

    await clearSession()

    setToken(null)
    setProfile(null)
    setPolicyGate(null)
    signingOut.current = false
  }, [])

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      void reset()
    })

    return () => setUnauthenticatedHandler(null)
  }, [reset])

  useEffect(() => {
    let active = true

    const restore = async () => {
      const stored = await loadSession()

      if (!stored.token) {
        if (active) {
          setReady(true)
        }

        return
      }

      try {
        const me = await api<Profile>('/profile', { token: stored.token, skipAuthHandler: true })

        if (!active) {
          return
        }

        setToken(stored.token)
        setProfile(me)
      } catch {
        await clearSession()
      } finally {
        if (active) {
          setReady(true)
        }
      }
    }

    void restore()

    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api<LoginResult>('/auth/login', {
      method: 'POST',
      body: { email, password },
      token: null,
      skipAuthHandler: true,
    })

    await saveSession(result.token, result.role)

    const me = await api<Profile>('/profile', { token: result.token })

    setToken(result.token)
    setProfile(me)
    setPolicyGate(result.policy_gate)
  }, [])

  const signOut = useCallback(async () => {
    const active = token

    await reset()

    if (active) {
      await api('/auth/logout', { method: 'POST', token: active, skipAuthHandler: true }).catch(() => undefined)
    }
  }, [reset, token])

  const refreshProfile = useCallback(async () => {
    if (!token) {
      return
    }

    try {
      const me = await api<Profile>('/profile', { token })

      setProfile(me)
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthenticated) {
        await reset()
      }
    }
  }, [reset, token])

  const permissions = useMemo(() => new Set(profile?.permissions ?? []), [profile])

  const can = useCallback((slug: string) => permissions.has(slug), [permissions])

  const canAny = useCallback((slugs: string[]) => slugs.some((slug) => permissions.has(slug)), [permissions])

  const value = useMemo<AuthState>(
    () => ({ ready, token, profile, policyGate, permissions, signIn, signOut, refreshProfile, can, canAny }),
    [ready, token, profile, policyGate, permissions, signIn, signOut, refreshProfile, can, canAny]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext)

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return value
}
