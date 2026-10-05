import { apiRequest } from './api'
import type { NavIconName } from '@/components/nav-icons'

export type NavItem = {
  id: string
  label: string
  permissions: string[]
  selfService?: boolean
}

export type NavGroup = {
  id: string
  label: string
  icon: NavIconName
  solo?: boolean
  platformOnly?: boolean
  items?: NavItem[]
}

type NavigationResponse = {
  groups: NavGroup[]
}

/** Sidebar backend se aata hai, pehle se filtered — konsa group/item dikhana hai wo waha tay hota hai */
export function fetchNavigation(token: string): Promise<NavigationResponse> {
  return apiRequest<NavigationResponse>('/navigation', { token })
}
