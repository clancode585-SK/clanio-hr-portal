import { readItem, removeItem, writeItem } from './storage'

const TOKEN_KEY = 'clanio.token'
const ROLE_KEY = 'clanio.role'

let cachedToken: string | null = null

export async function loadSession(): Promise<{ token: string | null; role: string | null }> {
  const [token, role] = await Promise.all([readItem(TOKEN_KEY), readItem(ROLE_KEY)])

  cachedToken = token

  return { token, role }
}

export async function saveSession(token: string, role: string | null): Promise<void> {
  cachedToken = token

  await writeItem(TOKEN_KEY, token)

  if (role) {
    await writeItem(ROLE_KEY, role)

    return
  }

  await removeItem(ROLE_KEY)
}

export async function clearSession(): Promise<void> {
  cachedToken = null

  await Promise.all([removeItem(TOKEN_KEY), removeItem(ROLE_KEY)])
}

export function currentToken(): string | null {
  return cachedToken
}
