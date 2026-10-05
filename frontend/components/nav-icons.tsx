type IconProps = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function GridIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  )
}

function BuildingIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="4" y="3" width="11" height="18" rx="1" />
      <path d="M8 7h3M8 11h3M8 15h3M15 10h5v11h-5" />
    </svg>
  )
}

function UsersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16.5 5.2a3.2 3.2 0 0 1 0 6.1M19.5 20a5.5 5.5 0 0 0-3.8-6.1" />
    </svg>
  )
}

function UserIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  )
}

function UserMinusIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20a7 7 0 0 1 14 0" />
      <path d="M17 10h5" />
    </svg>
  )
}

function ClockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 2.5v4M16 2.5v4" />
    </svg>
  )
}

function TrendingUpIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 17l6-6 4 4 7-8" />
      <path d="M14 7h6v6" />
    </svg>
  )
}

function WalletIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <path d="M15 12.5h4M16.5 10.5v4" />
    </svg>
  )
}

function CheckSquareIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="m8 12 2.5 2.5L16.5 9" />
    </svg>
  )
}

function ReceiptIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 2.5h12v19l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  )
}

function BriefcaseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="2.5" y="7.5" width="19" height="12.5" rx="2" />
      <path d="M8 7.5V5.5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2.5 13h19" />
    </svg>
  )
}

function FileTextIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 2.5h8l4 4v15H6Z" />
      <path d="M14 2.5V7h4M9 12h6M9 16h6" />
    </svg>
  )
}

function FolderIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 6a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8.5A1.5 1.5 0 0 1 20.5 8v10a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 18Z" />
    </svg>
  )
}

function BellIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 9.5a6 6 0 0 1 12 0c0 4.5 1.5 6 1.5 6h-15s1.5-1.5 1.5-6Z" />
      <path d="M10 19.5a2 2 0 0 0 4 0" />
    </svg>
  )
}

function HeadsetIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <rect x="2.5" y="13" width="4" height="6" rx="1.5" />
      <rect x="17.5" y="13" width="4" height="6" rx="1.5" />
      <path d="M19.5 19v.5a3 3 0 0 1-3 3H13" />
    </svg>
  )
}

function ShieldIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 2.5 19.5 6v6c0 5-3.5 8-7.5 9.5C8 20 4.5 17 4.5 12V6Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export const NAV_ICONS = {
  grid: GridIcon,
  building: BuildingIcon,
  users: UsersIcon,
  user: UserIcon,
  'user-minus': UserMinusIcon,
  clock: ClockIcon,
  calendar: CalendarIcon,
  'trending-up': TrendingUpIcon,
  wallet: WalletIcon,
  'check-square': CheckSquareIcon,
  receipt: ReceiptIcon,
  briefcase: BriefcaseIcon,
  'file-text': FileTextIcon,
  folder: FolderIcon,
  bell: BellIcon,
  headset: HeadsetIcon,
  shield: ShieldIcon,
} as const

export type NavIconName = keyof typeof NAV_ICONS
