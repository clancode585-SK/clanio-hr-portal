import { api } from './api'

export type Plan = {
  id: number
  uuid: string
  name: string
  code: string
  tagline: string | null
  price_per_seat: number
  currency: string
  billing_cycle: string
  min_seats: number
  max_seats: number
  trial_days: number
  gst_percent: number
  highlights: string[]
  is_popular: boolean
  company_count: number
}

export type Order = {
  seats: number
  pricePerSeat: number
  subtotal: number
  gstPercent: number
  gst: number
  total: number
}

export async function loadPlans(): Promise<Plan[]> {
  try {
    return await api<Plan[]>('/plans')
  } catch {
    return []
  }
}

export function priceOrder(plan: Plan, seats: number): Order {
  const subtotal = Math.round(plan.price_per_seat * seats * 100) / 100
  const gst = Math.round((subtotal * plan.gst_percent) / 100 * 100) / 100

  return {
    seats,
    pricePerSeat: plan.price_per_seat,
    subtotal,
    gstPercent: plan.gst_percent,
    gst,
    total: Math.round((subtotal + gst) * 100) / 100,
  }
}

export function money(value: number): string {
  return '₹' + Math.round(value).toLocaleString('en-IN')
}
