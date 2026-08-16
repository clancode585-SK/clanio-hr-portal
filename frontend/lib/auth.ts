import { apiRequest } from './api'

export type LoginPayload = {
  email: string
  password: string
  company_slug?: string
}

export type LoginResponse = {
  token: string
  role: string | null
}

export function login(payload: LoginPayload): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: payload })
}

export function logout(token: string): Promise<null> {
  return apiRequest<null>('/auth/logout', { method: 'POST', token })
}
