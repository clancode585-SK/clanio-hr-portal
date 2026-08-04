'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { ApiError } from '@/lib/api'
import { login } from '@/lib/auth'
import { config } from '@/lib/config'
import { readSession, saveSession } from '@/lib/session'
import { AlertIcon, EyeIcon, EyeOffIcon, SpinnerIcon } from './icons'

export function LoginForm() {
  const router = useRouter()
  const emailId = useId()
  const passwordId = useId()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string[]>>({})

  useEffect(() => {
    if (readSession()) {
      router.replace('/dashboard')
    }
  }, [router])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setFields({})

    try {
      const session = await login({
        email: email.trim(),
        password,
        company_slug: config.workspaceSlug || undefined,
      })

      saveSession({ token: session.token, role: session.role }, remember)
      router.replace('/dashboard')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Something went wrong. Please try again.')
      setFields(cause instanceof ApiError ? cause.fields : {})
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto w-full max-w-[26rem] space-y-6 rounded-2xl border border-line bg-surface p-7 shadow-[0_30px_70px_-45px_rgba(15,22,41,0.55)] sm:p-8"
    >
      <header className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight text-heading">Sign in to your workspace</h2>
        <p className="text-sm text-muted">Enter your details to continue</p>
      </header>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger"
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor={emailId} className="block text-sm font-medium text-heading">
          Email Address
        </label>
        <input
          id={emailId}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email address"
          aria-invalid={Boolean(fields.email)}
          className="w-full rounded-xl border border-line bg-surface-soft px-4 py-3 text-sm text-heading outline-none transition placeholder:text-muted/70 hover:border-line-strong focus:border-brand focus:bg-surface"
        />
        {fields.email ? <p className="text-xs text-danger">{fields.email[0]}</p> : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={passwordId} className="block text-sm font-medium text-heading">
            Password
          </label>
          <a href="/forgot-password" className="text-xs font-semibold text-brand transition hover:text-brand-strong">
            Forgot Password?
          </a>
        </div>
        <div className="relative">
          <input
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            aria-invalid={Boolean(fields.password)}
            className="w-full rounded-xl border border-line bg-surface-soft py-3 pl-4 pr-12 text-sm text-heading outline-none transition placeholder:text-muted/70 hover:border-line-strong focus:border-brand focus:bg-surface"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted transition hover:text-heading"
          >
            {showPassword ? <EyeOffIcon className="h-4.5 w-4.5" /> : <EyeIcon className="h-4.5 w-4.5" />}
          </button>
        </div>
        {fields.password ? <p className="text-xs text-danger">{fields.password[0]}</p> : null}
      </div>

      <label className="flex w-fit cursor-pointer select-none items-center gap-2 text-sm text-body">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          className="h-4 w-4 cursor-pointer rounded border-line accent-brand"
        />
        Remember me
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? (
          <>
            <SpinnerIcon className="h-4.5 w-4.5 animate-spin" />
            Signing in...
          </>
        ) : (
          'Login'
        )}
      </button>
    </form>
  )
}
