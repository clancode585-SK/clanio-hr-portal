import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { onRealtime } from '@/lib/realtime'

// Topbar aur sidebar dono ko yahi count chahiye — ek hi jagah se, warna har screen apni call maarti
let value = 0
let pulledAt = 0
let wired = false

const listeners = new Set<(count: number) => void>()
const STALE_MS = 30000

function publish(next: number): void {
  value = next
  listeners.forEach((listener) => listener(next))
}

async function pull(): Promise<void> {
  try {
    const result = await api<{ unread_count?: number }>('/notifications/unread-count')

    pulledAt = Date.now()
    publish(Number(result.unread_count ?? 0))
  } catch {
    publish(0)
  }
}

export function refreshUnread(): void {
  void pull()
}

/** Sign out ya company badalne par purana count nahi rehna chahiye */
export function resetUnread(): void {
  pulledAt = 0
  publish(0)
}

export function useUnread(): number {
  const [count, setCount] = useState(value)

  useEffect(() => {
    listeners.add(setCount)

    if (!wired) {
      wired = true
      onRealtime((event) => {
        if (event.name.startsWith('notification.') || event.name === 'announcement.new') {
          void pull()
        }
      })
    }

    if (Date.now() - pulledAt > STALE_MS) {
      void pull()
    }

    return () => {
      listeners.delete(setCount)
    }
  }, [])

  return count
}
