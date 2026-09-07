export const palette = {
  brand: '#3395FF',
  brandDark: '#1A73E8',
  brandDeep: '#0C2451',
  brandSoft: '#EBF3FF',
  brandSoftDark: '#0F2647',

  navy: '#02042B',
  navySurface: '#0C1B33',
  navyLine: '#1D2E4A',

  ink: '#0D1A33',
  inkMuted: '#515978',
  inkSubtle: '#8B95AC',

  surface: '#FFFFFF',
  canvas: '#F7F9FC',
  line: '#E1E5EA',

  darkInk: '#EEF2F8',
  darkInkMuted: '#9BA7C0',
  darkInkSubtle: '#6B778F',

  success: '#0F8A5F',
  successSoft: '#E3F7EE',
  successSoftDark: '#0A2A1E',
  warning: '#C2700B',
  warningSoft: '#FEF3E2',
  warningSoftDark: '#2E1F08',
  danger: '#D13B3B',
  dangerSoft: '#FDECEC',
  dangerSoftDark: '#2C1214',
  info: '#0C7FA8',
  infoSoft: '#E4F4FB',
  infoSoftDark: '#08262F',
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
  brand: '#5AACFF',
  brandDark: palette.brand,
  brandSoft: '#0F2647',
  ink: palette.darkInk,
  inkMuted: palette.darkInkMuted,
  inkSubtle: palette.darkInkSubtle,
  surface: palette.navySurface,
  canvas: palette.navy,
  line: palette.navyLine,
  success: '#4ADE9B',
  successSoft: palette.successSoftDark,
  warning: '#F0A94A',
  warningSoft: palette.warningSoftDark,
  danger: '#F07171',
  dangerSoft: palette.dangerSoftDark,
  info: '#4EC5E8',
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
  md: 10,
  lg: 14,
  xl: 18,
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
