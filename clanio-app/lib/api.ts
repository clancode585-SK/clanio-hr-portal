import { config } from './config'
import { currentToken } from './session'
import type { PageMeta } from './types'

export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: FieldErrors
  readonly retryAfter: number | null

  constructor(
    message: string,
    status: number,
    code: string,
    fields: FieldErrors = {},
    retryAfter: number | null = null
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.retryAfter = retryAfter
  }

  get isNetwork(): boolean {
    return this.status === 0
  }

  get isUnauthenticated(): boolean {
    return this.status === 401
  }

  get isThrottled(): boolean {
    return this.status === 429
  }

  firstField(): string | null {
    const keys = Object.keys(this.fields)

    return keys.length > 0 ? this.fields[keys[0]][0] : null
  }
}

type Envelope<T> = {
  success: boolean
  status: number
  message: string
  data: T
  meta?: PageMeta
  error_code?: string
  errors?: unknown
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string | null
  signal?: AbortSignal
  skipAuthHandler?: boolean
}

type UnauthenticatedHandler = () => void

let onUnauthenticated: UnauthenticatedHandler | null = null

export function setUnauthenticatedHandler(handler: UnauthenticatedHandler | null): void {
  onUnauthenticated = handler
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const payload = await request<T>(path, options)

  return payload.data
}

export async function apiList<T>(
  path: string,
  options: RequestOptions = {}
): Promise<{ data: T[]; meta: PageMeta | null }> {
  const payload = await request<T[]>(path, options)

  return { data: payload.data ?? [], meta: payload.meta ?? null }
}

async function request<T>(path: string, options: RequestOptions): Promise<Envelope<T>> {
  const { method = 'GET', body, signal, skipAuthHandler = false } = options
  const token = options.token === undefined ? currentToken() : options.token

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Company-Id': config.companyId,
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response: Response

  try {
    response = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection.', 0, 'NETWORK_ERROR')
  }

  const payload = (await response.json().catch(() => null)) as Envelope<T> | null

  if (!response.ok || payload?.success === false) {
    const status = payload?.status ?? response.status
    const code = payload?.error_code ?? 'REQUEST_FAILED'

    if (status === 401 && !skipAuthHandler) {
      onUnauthenticated?.()
    }

    throw new ApiError(
      payload?.message ?? 'Something went wrong. Please try again.',
      status,
      code,
      normaliseErrors(payload?.errors),
      readRetryAfter(response)
    )
  }

  return payload as Envelope<T>
}

function readRetryAfter(response: Response): number | null {
  const header = response.headers.get('Retry-After')

  if (!header) {
    return null
  }

  const seconds = Number(header)

  return Number.isFinite(seconds) ? seconds : null
}

function normaliseErrors(errors: unknown): FieldErrors {
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) {
    return {}
  }

  const result: FieldErrors = {}

  for (const [field, messages] of Object.entries(errors as Record<string, unknown>)) {
    if (Array.isArray(messages) && messages.length > 0) {
      result[field] = messages.map(String)
    }
  }

  return result
}
