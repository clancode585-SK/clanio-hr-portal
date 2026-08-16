import { config } from './config'

export type ApiEnvelope<T> = {
  success: boolean
  status: number
  message: string
  data: T
}

export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: FieldErrors

  constructor(message: string, status: number, code: string, fields: FieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string | null
  signal?: AbortSignal
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = options

  const headers: Record<string, string> = { Accept: 'application/json' }

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
    throw new ApiError(
      'Cannot reach the server. Check your connection and try again.',
      0,
      'NETWORK_ERROR'
    )
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok || payload?.success === false) {
    throw new ApiError(
      payload?.message ?? 'Something went wrong. Please try again.',
      payload?.status ?? response.status,
      payload?.error_code ?? 'REQUEST_FAILED',
      normaliseFieldErrors(payload?.errors)
    )
  }

  return (payload as ApiEnvelope<T>).data
}

function normaliseFieldErrors(errors: unknown): FieldErrors {
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
