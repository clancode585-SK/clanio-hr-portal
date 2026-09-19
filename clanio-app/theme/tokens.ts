export const palette = {
  brand: '#3395FF',
  brandDark: '#1A73E8',
  brandDeep: '#0C2451',
  brandSoft: '#EBF3FF',
  brandSoftDark: '#0F2647',

  navy: '#1E2238',
  navySurface: '#272C47',
  navyRaised: '#333A5C',
  navyLine: '#363C5C',

  ink: '#0D1A33',
  inkMuted: '#515978',
  inkSubtle: '#8B95AC',

  surface: '#FFFFFF',
  canvas: '#F7F9FC',
  line: '#E1E5EA',

  darkInk: '#F2F5FA',
  darkInkMuted: '#A9B2CC',
  darkInkSubtle: '#78839F',

  success: '#0F8A5F',
  successSoft: '#E3F7EE',
  successSoftDark: '#1B3A31',
  warning: '#C2700B',
  warningSoft: '#FEF3E2',
  warningSoftDark: '#3B3120',
  danger: '#D13B3B',
  dangerSoft: '#FDECEC',
  dangerSoftDark: '#3E2630',
  info: '#0C7FA8',
  infoSoft: '#E4F4FB',
  infoSoftDark: '#1D3247',
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
  brand: '#6E9BF0',
  brandDark: '#5B8DEF',
  brandSoft: palette.navyRaised,
  ink: palette.darkInk,
  inkMuted: palette.darkInkMuted,
  inkSubtle: palette.darkInkSubtle,
  surface: palette.navySurface,
  canvas: palette.navy,
  line: palette.navyLine,
  success: '#3DD68C',
  successSoft: palette.successSoftDark,
  warning: '#F0B14A',
  warningSoft: palette.warningSoftDark,
  danger: '#F2726F',
  dangerSoft: palette.dangerSoftDark,
  info: '#5AC8E8',
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
