import { apiRequest } from './api'

export type Profile = {
  id: number
  name: string
  email: string
  is_super_admin: boolean
  roles: { slug: string; name: string }[]
  permissions: string[]
  organisation: {
    company_id: number | null
  } | null
}

export function fetchProfile(token: string): Promise<Profile> {
  return apiRequest<Profile>('/profile', { token })
}
