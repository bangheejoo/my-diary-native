import React, { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ColorTheme, AppColors } from '../theme/colors'
import { getThemeColors } from '../theme/colors'

const FONT_SCALE: Record<'sm' | 'md' | 'lg', number> = { sm: 0.85, md: 1.0, lg: 1.15 }

interface ThemeContextType {
  colors: AppColors
  colorTheme: ColorTheme
  isDark: boolean
  fontSize: 'sm' | 'md' | 'lg'
  fontScale: number
  setColorTheme: (c: ColorTheme) => void
  toggleDark: () => void
  setFontSize: (s: 'sm' | 'md' | 'lg') => void
}

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>('pink')
  const [isDark, setIsDark] = useState(false)
  const [fontSize, setFontSizeState] = useState<'sm' | 'md' | 'lg'>('md')

  useEffect(() => {
    async function load() {
      const [c, d, f] = await Promise.all([
        AsyncStorage.getItem('colorTheme'),
        AsyncStorage.getItem('darkMode'),
        AsyncStorage.getItem('fontSize'),
      ])
      if (c) setColorThemeState(c as ColorTheme)
      if (d === 'true') setIsDark(true)
      if (f) setFontSizeState(f as 'sm' | 'md' | 'lg')
    }
    load()
  }, [])

  const colors = getThemeColors(colorTheme, isDark)

  function setColorTheme(c: ColorTheme) {
    setColorThemeState(c)
    AsyncStorage.setItem('colorTheme', c)
  }

  function toggleDark() {
    const next = !isDark
    setIsDark(next)
    AsyncStorage.setItem('darkMode', String(next))
  }

  function setFontSize(s: 'sm' | 'md' | 'lg') {
    setFontSizeState(s)
    AsyncStorage.setItem('fontSize', s)
  }

  const fontScale = FONT_SCALE[fontSize]

  return (
    <ThemeContext.Provider value={{ colors, colorTheme, isDark, fontSize, fontScale, setColorTheme, toggleDark, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
