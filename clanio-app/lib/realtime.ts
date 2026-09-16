import { api } from './api'
import { config } from './config'

type Connection = {
  driver: string
  key: string
  host: string
  port: number
  scheme: string
  force_tls: boolean
}

type RealtimeConfig = {
  connection: Connection
  auth_endpoint: string
  channels: { personal: string | null; company: string | null }
  events: string[]
  unread_count?: number
}

export type RealtimeEvent = {
  name: string
  channel: string
  payload: Record<string, any>
}

type Listener = (event: RealtimeEvent) => void

const listeners = new Set<Listener>()

let socket: WebSocket | null = null
let socketId: string | null = null
let token: string | null = null
let retry = 0
let timer: ReturnType<typeof setTimeout> | null = null
let stopped = true
let subscribed: string[] = []

export function onRealtime(listener: Listener): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

function emit(event: RealtimeEvent): void {
  for (const listener of listeners) {
    listener(event)
  }
}

function socketUrl(connection: Connection): string {
  const host = resolveHost(connection.host)
  const scheme = connection.force_tls || connection.scheme === 'https' ? 'wss' : 'ws'

  return `${scheme}://${host}:${connection.port}/app/${connection.key}?protocol=7&client=clanio&version=1.0`
}

function resolveHost(host: string): string {
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '0.0.0.0') {
    return host
  }

  const apiHost = config.apiUrl.replace(/^https?:\/\//, '').split(/[:/]/)[0]

  return apiHost || host
}

async function authorise(channel: string, endpoint: string): Promise<string | null> {
  if (!socketId || !token) {
    return null
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ socket_id: socketId, channel_name: channel }),
    })

    if (!response.ok) {
      return null
    }

    const body = (await response.json()) as { auth?: string }

    return body.auth ?? null
  } catch {
    return null
  }
}

async function subscribe(channels: string[], endpoint: string): Promise<void> {
  for (const channel of channels) {
    const auth = await authorise(channel, endpoint)

    if (!auth || socket?.readyState !== WebSocket.OPEN) {
      continue
    }

    socket.send(
      JSON.stringify({
        event: 'pusher:subscribe',
        data: { channel, auth },
      })
    )
  }
}

function scheduleRetry(activeToken: string): void {
  if (stopped) {
    return
  }

  const delay = Math.min(30000, 2000 * 2 ** Math.min(retry, 4))

  retry += 1

  timer = setTimeout(() => {
    void open(activeToken)
  }, delay)
}

async function open(activeToken: string): Promise<void> {
  if (stopped || activeToken !== token) {
    return
  }

  let settings: RealtimeConfig

  try {
    settings = await api<RealtimeConfig>('/realtime/config', { token: activeToken, skipAuthHandler: true })
  } catch {
    scheduleRetry(activeToken)

    return
  }

  if (settings.connection.driver === 'null' || !settings.connection.key) {
    return
  }

  const channels = [settings.channels.personal, settings.channels.company].filter(
    (name): name is string => typeof name === 'string' && name.length > 0
  )

  let ws: WebSocket

  try {
    ws = new WebSocket(socketUrl(settings.connection))
  } catch {
    scheduleRetry(activeToken)

    return
  }

  socket = ws

  ws.onmessage = (message) => {
    let frame: { event?: string; channel?: string; data?: unknown }

    try {
      frame = JSON.parse(String(message.data))
    } catch {
      return
    }

    const name = frame.event ?? ''

    if (name === 'pusher:connection_established') {
      const data = typeof frame.data === 'string' ? JSON.parse(frame.data) : frame.data
      socketId = (data as { socket_id?: string })?.socket_id ?? null
      retry = 0
      subscribed = channels
      void subscribe(channels, settings.auth_endpoint)

      return
    }

    if (name === 'pusher:ping') {
      ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }))

      return
    }

    if (name.startsWith('pusher:') || name.startsWith('pusher_internal:')) {
      return
    }

    const payload: Record<string, any> =
      typeof frame.data === 'string' ? safeParse(frame.data) : ((frame.data ?? {}) as Record<string, any>)

    emit({
      name: String(payload?.event ?? name),
      channel: frame.channel ?? '',
      payload: (payload?.payload ?? payload ?? {}) as Record<string, any>,
    })
  }

  ws.onclose = () => {
    if (socket === ws) {
      socket = null
      socketId = null
    }

    scheduleRetry(activeToken)
  }

  ws.onerror = () => {
    try {
      ws.close()
    } catch {
      scheduleRetry(activeToken)
    }
  }
}

function safeParse(value: string): Record<string, any> {
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

export function startRealtime(activeToken: string): void {
  if (token === activeToken && socket) {
    return
  }

  stopRealtime()

  stopped = false
  token = activeToken
  retry = 0

  void open(activeToken)
}

export function stopRealtime(): void {
  stopped = true
  token = null
  socketId = null
  retry = 0
  subscribed = []

  if (timer) {
    clearTimeout(timer)
    timer = null
  }

  if (socket) {
    const closing = socket
    socket = null

    try {
      closing.close()
    } catch {
      socketId = null
    }
  }
}

export function realtimeChannels(): string[] {
  return subscribed
}
