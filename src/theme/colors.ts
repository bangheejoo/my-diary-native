export type ColorTheme = 'pink' | 'blue' | 'green' | 'yellow' | 'purple'

const themes: Record<ColorTheme, {
  primary: string
  primaryLight: string
  primaryLight2: string
  primaryDark: string
  primaryDark2: string
  mint: string
  mintDark: string
}> = {
  pink: {
    primary: '#F29199',
    primaryLight: '#F2BDC1',
    primaryLight2: '#F2D7D0',
    primaryDark: '#E8828A',
    primaryDark2: '#9B4C54',
    mint: '#CEF2E8',
    mintDark: '#70bba6',
  },
  blue: {
    primary: '#6aa3ff',
    primaryLight: '#BFD9FF',
    primaryLight2: '#EAF4FF',
    primaryDark: '#5896fc',
    primaryDark2: '#3076e7',
    mint: '#FFE2BD',
    mintDark: '#d2a263',
  },
  green: {
    primary: '#9bd428',
    primaryLight: '#B5E655',
    primaryLight2: '#F0FFF9',
    primaryDark: '#7bb010',
    primaryDark2: '#4d7005',
    mint: '#90ddd3',
    mintDark: '#36988b',
  },
  yellow: {
    primary: '#fcd06a',
    primaryLight: '#ffea98',
    primaryLight2: '#FFFBEB',
    primaryDark: '#fac549',
    primaryDark2: '#d8a122',
    mint: '#93df6d',
    mintDark: '#589d36',
  },
  purple: {
    primary: '#b993ff',
    primaryLight: '#D6C8F2',
    primaryLight2: '#F6F2FF',
    primaryDark: '#744bc0',
    primaryDark2: '#4d298f',
    mint: '#F7CAC9',
    mintDark: '#a35e5d',
  },
}

export const lightColors = {
  white: '#FFFFFF',
  black: '#0D0D0D',
  gray100: '#f9fafb',
  gray200: '#f3f4f6',
  gray300: '#e5e7eb',
  gray400: '#d1d5db',
  gray500: '#9ca3af',
  gray600: '#6b7280',
  gray700: '#374151',
  bg: '#f9fafb',
  surface: '#FFFFFF',
  border: '#e5e7eb',
  text: '#0D0D0D',
  textMuted: '#6b7280',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
}

export const darkColors = {
  ...lightColors,
  bg: '#111827',
  surface: '#1f2937',
  border: '#374151',
  text: '#f9fafb',
  textMuted: '#9ca3af',
  white: '#1f2937',
  black: '#f9fafb',
}

export function getThemeColors(color: ColorTheme, dark: boolean) {
  const base = dark ? darkColors : lightColors
  const t = themes[color]
  return {
    ...base,
    primary: t.primary,
    primaryLight: t.primaryLight,
    primaryLight2: t.primaryLight2,
    mint: t.mint,
    mintDark: t.mintDark,
    primaryDark: t.primaryDark,
    primaryDark2: t.primaryDark2,
  }
}

export type AppColors = ReturnType<typeof getThemeColors>
