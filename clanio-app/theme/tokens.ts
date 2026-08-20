export const palette = {
  brand: '#5B54F0',
  brandDark: '#4840D6',
  brandSoft: '#ECEBFE',
  brandSoftDark: '#1E2557',

  ink: '#111827',
  inkMuted: '#6B7280',
  inkSubtle: '#9CA3AF',

  surface: '#FFFFFF',
  canvas: '#F5F6FA',
  line: '#E5E7EB',

  darkInk: '#F3F4F6',
  darkInkMuted: '#9BA3AF',
  darkInkSubtle: '#6B7280',
  darkSurface: '#131B47',
  darkCanvas: '#0B1236',
  darkLine: '#232C5E',

  success: '#16A34A',
  successSoft: '#DCFCE7',
  successSoftDark: '#0D2B1A',
  warning: '#EA580C',
  warningSoft: '#FFEDD5',
  warningSoftDark: '#2E1A0B',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  dangerSoftDark: '#2E1315',
  info: '#0891B2',
  infoSoft: '#CFFAFE',
  infoSoftDark: '#0A2830',
} as const

export type ThemeName = 'light' | 'dark'

export type Theme = {
  name: ThemeName
  brand: string
  brandDark: string
  brandSoft: string
  ink: string
  inkMuted: string
  inkSubtle: string
  surface: string
  canvas: string
  line: string
  success: string
  successSoft: string
  warning: string
  warningSoft: string
  danger: string
  dangerSoft: string
  info: string
  infoSoft: string
  onBrand: string
}

export const lightTheme: Theme = {
  name: 'light',
  brand: palette.brand,
  brandDark: palette.brandDark,
  brandSoft: palette.brandSoft,
  ink: palette.ink,
  inkMuted: palette.inkMuted,
  inkSubtle: palette.inkSubtle,
  surface: palette.surface,
  canvas: palette.canvas,
  line: palette.line,
  success: palette.success,
  successSoft: palette.successSoft,
  warning: palette.warning,
  warningSoft: palette.warningSoft,
  danger: palette.danger,
  dangerSoft: palette.dangerSoft,
  info: palette.info,
  infoSoft: palette.infoSoft,
  onBrand: '#FFFFFF',
}

export const darkTheme: Theme = {
  name: 'dark',
  brand: '#7A72F5',
  brandDark: '#5B54F0',
  brandSoft: palette.brandSoftDark,
  ink: palette.darkInk,
  inkMuted: palette.darkInkMuted,
  inkSubtle: palette.darkInkSubtle,
  surface: palette.darkSurface,
  canvas: palette.darkCanvas,
  line: palette.darkLine,
  success: '#4ADE80',
  successSoft: palette.successSoftDark,
  warning: '#FB923C',
  warningSoft: palette.warningSoftDark,
  danger: '#F87171',
  dangerSoft: palette.dangerSoftDark,
  info: '#22D3EE',
  infoSoft: palette.infoSoftDark,
  onBrand: '#FFFFFF',
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const

export const font = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  xxxl: 32,
} as const
