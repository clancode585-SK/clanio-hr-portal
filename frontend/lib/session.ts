export type Session = {
  token: string
  role: string | null
}

const STORAGE_KEY = 'clanio.session'

export function saveSession(session: Session, remember: boolean): void {
  const value = JSON.stringify(session)

  if (remember) {
    window.localStorage.setItem(STORAGE_KEY, value)
    window.sessionStorage.removeItem(STORAGE_KEY)

    return
  }

  window.sessionStorage.setItem(STORAGE_KEY, value)
  window.localStorage.removeItem(STORAGE_KEY)
}

export function readSession(): Session | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Session

    return typeof parsed?.token === 'string' && parsed.token.length > 0 ? parsed : null
  } catch {
    return null
  }
}

export function clearSession(): void {
  window.sessionStorage.removeItem(STORAGE_KEY)
  window.localStorage.removeItem(STORAGE_KEY)
}

export function formatRole(role: string | null | undefined): string {
  if (!role) {
    return 'User'
  }

  return role
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((word) => (word.toLowerCase() === 'hr' ? 'HR' : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
}
