import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, setPolicyBlockedHandler, setUnauthenticatedHandler } from './api'
import { setCompanyZone } from './clock'
import { config } from './config'
import { clearSession, loadSession, saveSession } from './session'
import { registerPush, unregisterPush } from './push'
import { startRealtime, stopRealtime } from './realtime'
import { setCompanyId } from './tenant'
import type { LoginResult, OnboardingState, PolicyGate, Profile } from './types'

type AuthState = {
  ready: boolean
  token: string | null
  profile: Profile | null
  policyGate: PolicyGate | null
  permissions: Set<string>
  signIn: (email: string, password: string, companySlug?: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  can: (slug: string) => boolean
  canAny: (slugs: string[]) => boolean
  isSuperAdmin: boolean
  policyBlocked: boolean
  clearPolicyBlock: () => void
  onboarding: OnboardingState | null
  onboardingStep: 'policies' | 'profile' | 'tour' | null
  refreshOnboarding: () => Promise<void>
  finishProfileStep: () => Promise<void>
  finishTour: () => Promise<void>
  companyId: string | null
  viewCompany: (id: string | null) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function applyTenant(me: Profile): void {
  setCompanyId(me.is_super_admin === true ? null : config.companyId)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [policyGate, setPolicyGate] = useState<PolicyGate | null>(null)
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null)
  const [companyId, setActiveCompany] = useState<string | null>(null)
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
    setOnboarding(null)
    setCompanyId(null)
    setActiveCompany(null)
    signingOut.current = false
  }, [])

  useEffect(() => {
    setCompanyZone(profile?.organisation?.timezone ?? null)
  }, [profile])

  useEffect(() => {
    if (token) {
      startRealtime(token)
      void registerPush()

      return () => stopRealtime()
    }

    stopRealtime()
  }, [token])

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      void reset()
    })

    setPolicyBlockedHandler(() => {
      setPolicyGate({ blocked: true, pending: 0 })
    })

    return () => {
      setUnauthenticatedHandler(null)
      setPolicyBlockedHandler(null)
    }
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

        applyTenant(me)
        setToken(stored.token)
        setProfile(me)

        // App khulte hi session aage badha dete hain, warna 7 din baad achanak logout
        void api<{ token: string }>('/auth/refresh', { method: 'POST', token: stored.token })
          .then(async (fresh) => {
            if (active && fresh?.token) {
              await saveSession(fresh.token, stored.role)
              setToken(fresh.token)
            }
          })
          .catch(() => {
            // Refresh na ho to purana token chalta rahega
          })
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

  const signIn = useCallback(async (email: string, password: string, companySlug?: string) => {
    const result = await api<LoginResult>('/auth/login', {
      method: 'POST',
      body: { email, password, ...(companySlug ? { company_slug: companySlug } : {}) },
      token: null,
      skipAuthHandler: true,
    })

    await saveSession(result.token, result.role)

    setCompanyId(null)

    const me = await api<Profile>('/profile', { token: result.token })

    applyTenant(me)
    setToken(result.token)
    setProfile(me)
    setPolicyGate(result.policy_gate)
    setOnboarding(result.onboarding ?? null)
  }, [])

  const signOut = useCallback(async () => {
    const active = token

    await unregisterPush()

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

  const viewCompany = useCallback(
    async (id: string | null) => {
      setCompanyId(id)
      setActiveCompany(id)

      if (!token) {
        return
      }

      try {
        setProfile(await api<Profile>('/profile', { token }))
      } catch (error) {
        if (error instanceof ApiError && error.isUnauthenticated) {
          await reset()
        }
      }
    },
    [reset, token]
  )

  const refreshOnboarding = useCallback(async () => {
    if (!token) {
      return
    }

    try {
      setOnboarding(await api<OnboardingState>('/onboarding', { token }))
    } catch {
      setOnboarding((current) => current)
    }
  }, [token])

  const finishProfileStep = useCallback(async () => {
    if (!token) {
      return
    }

    try {
      setOnboarding(await api<OnboardingState>('/onboarding/profile-seen', { method: 'POST', token }))
    } catch {
      await refreshOnboarding()
    }
  }, [refreshOnboarding, token])

  const finishTour = useCallback(async () => {
    if (!token) {
      return
    }

    try {
      setOnboarding(await api<OnboardingState>('/onboarding/tour-done', { method: 'POST', token }))
    } catch {
      await refreshOnboarding()
    }
  }, [refreshOnboarding, token])

  useEffect(() => {
    if (token) {
      void refreshOnboarding()
    }
  }, [refreshOnboarding, token])

  const clearPolicyBlock = useCallback(() => {
    setPolicyGate({ blocked: false, pending: 0 })
    void refreshOnboarding()
  }, [refreshOnboarding])

  const permissions = useMemo(() => new Set(profile?.permissions ?? []), [profile])

  const onboardingStep = onboarding?.step ?? null

  const can = useCallback((slug: string) => permissions.has(slug), [permissions])

  const canAny = useCallback((slugs: string[]) => slugs.some((slug) => permissions.has(slug)), [permissions])

  const value = useMemo<AuthState>(
    () => ({
      ready,
      token,
      profile,
      policyGate,
      permissions,
      signIn,
      signOut,
      refreshProfile,
      can,
      canAny,
      isSuperAdmin: profile?.is_super_admin === true,
      companyId,
      viewCompany,
      policyBlocked: policyGate?.blocked === true,
      clearPolicyBlock,
      onboarding,
      onboardingStep,
      refreshOnboarding,
      finishProfileStep,
      finishTour,
    }),
    [
      ready,
      token,
      profile,
      policyGate,
      permissions,
      signIn,
      signOut,
      refreshProfile,
      can,
      canAny,
      companyId,
      viewCompany,
      clearPolicyBlock,
      onboarding,
      onboardingStep,
      refreshOnboarding,
      finishProfileStep,
      finishTour,
    ]
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
