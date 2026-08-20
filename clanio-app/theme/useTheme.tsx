import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { readItem, writeItem } from '@/lib/storage'
import { darkTheme, lightTheme, type Theme } from './tokens'

export type ThemeMode = 'system' | 'light' | 'dark'

type ThemeState = {
  theme: Theme
  mode: ThemeMode
  ready: boolean
  setMode: (mode: ThemeMode) => void
}

const MODE_KEY = 'clanio.theme'

const ThemeContext = createContext<ThemeState>({
  theme: lightTheme,
  mode: 'system',
  ready: false,
  setMode: () => undefined,
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>('system')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    const restore = async () => {
      const stored = await readItem(MODE_KEY)

      if (active) {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setModeState(stored)
        }

        setReady(true)
      }
    }

    void restore()

    return () => {
      active = false
    }
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    void writeItem(MODE_KEY, next)
  }, [])

  const theme = useMemo(() => {
    const resolved = mode === 'system' ? scheme : mode

    return resolved === 'dark' ? darkTheme : lightTheme
  }, [mode, scheme])

  const value = useMemo<ThemeState>(() => ({ theme, mode, ready, setMode }), [theme, mode, ready, setMode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme
}

export function useThemeMode(): { mode: ThemeMode; setMode: (mode: ThemeMode) => void } {
  const { mode, setMode } = useContext(ThemeContext)

  return { mode, setMode }
}
