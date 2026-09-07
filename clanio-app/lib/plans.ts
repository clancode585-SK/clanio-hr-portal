export type Plan = {
  code: string
  name: string
  tagline: string
  pricePerSeat: number
  minSeats: number
  maxSeats: number
  highlights: string[]
  popular?: boolean
}

export const gstPercent = 18

export const currency = 'INR'

export const plans: Plan[] = [
  {
    code: 'starter',
    name: 'Starter',
    tagline: 'Small teams getting off spreadsheets',
    pricePerSeat: 99,
    minSeats: 5,
    maxSeats: 25,
    highlights: ['Attendance and leave', 'Employee records', 'Helpdesk'],
  },
  {
    code: 'growth',
    name: 'Growth',
    tagline: 'Running HR properly, with approvals',
    pricePerSeat: 179,
    minSeats: 10,
    maxSeats: 100,
    highlights: ['Everything in Starter', 'Expenses and assets', 'Goals and appraisals'],
    popular: true,
  },
  {
    code: 'scale',
    name: 'Scale',
    tagline: 'Multi branch, multi department',
    pricePerSeat: 299,
    minSeats: 25,
    maxSeats: 500,
    highlights: ['Everything in Growth', 'Branches and shifts', 'Exit and clearance'],
  },
]

export function planByCode(code: string | null): Plan | null {
  return plans.find((plan) => plan.code === code) ?? null
}

export type Order = {
  seats: number
  pricePerSeat: number
  subtotal: number
  gst: number
  total: number
}

export function priceOrder(plan: Plan, seats: number): Order {
  const subtotal = plan.pricePerSeat * seats
  const gst = Math.round((subtotal * gstPercent) / 100)

  return {
    seats,
    pricePerSeat: plan.pricePerSeat,
    subtotal,
    gst,
    total: subtotal + gst,
  }
}

export function money(value: number): string {
  return '₹' + Math.round(value).toLocaleString('en-IN')
}
