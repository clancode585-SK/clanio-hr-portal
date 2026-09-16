const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const HAS_OFFSET = /[zZ]$|[+-]\d{2}:?\d{2}$/

type Moment = { date: Date; dateOnly: boolean }

let zone: string | null = null

export function setCompanyZone(value?: string | null): void {
  zone = typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function moment(value?: string | null): Moment | null {
  if (!value) {
    return null
  }

  if (DATE_ONLY.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(year, month - 1, day, 12)

    return Number.isNaN(date.getTime()) ? null : { date, dateOnly: true }
  }

  const date = new Date(HAS_OFFSET.test(value) ? value : value.replace(' ', 'T') + 'Z')

  return Number.isNaN(date.getTime()) ? null : { date, dateOnly: false }
}

function options(base: Intl.DateTimeFormatOptions, at: Moment): Intl.DateTimeFormatOptions {
  return zone && !at.dateOnly ? { ...base, timeZone: zone } : base
}

function render(value: string | null | undefined, base: Intl.DateTimeFormatOptions, fallback: string): string {
  const at = moment(value)

  if (at === null) {
    return fallback
  }

  try {
    return at.date.toLocaleString('en-IN', options(base, at))
  } catch {
    return at.date.toLocaleString('en-IN', base)
  }
}

export function formatDate(value?: string | null, fallback = '—'): string {
  return render(value, { day: 'numeric', month: 'short' }, fallback)
}

export function formatFullDate(value?: string | null, fallback = '—'): string {
  return render(value, { day: 'numeric', month: 'short', year: 'numeric' }, fallback)
}

export function formatWeekday(value?: string | null, fallback = '—'): string {
  return render(value, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }, fallback)
}

export function formatDateTime(value?: string | null, fallback = '—'): string {
  return render(
    value,
    { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' },
    fallback
  )
}

export function formatStamp(value?: string | null, fallback = '—'): string {
  return render(
    value,
    { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' },
    fallback
  )
}

export function formatShortDateTime(value?: string | null, fallback = '—'): string {
  return render(value, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }, fallback)
}

export function formatTime(value?: string | null, fallback = '—'): string {
  return render(value, { hour: '2-digit', minute: '2-digit' }, fallback)
}

export function zoneLabel(): string {
  if (zone === null) {
    return ''
  }

  try {
    const parts = new Intl.DateTimeFormat('en-IN', { timeZone: zone, timeZoneName: 'short' }).formatToParts(new Date())

    return parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
}

export function today(): string {
  const now = new Date()

  if (zone === null) {
    return localDate(now)
  }

  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now)
  } catch {
    return localDate(now)
  }
}

export function daysBefore(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)

  return localDate(new Date(year, month - 1, day - days, 12))
}

function localDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
