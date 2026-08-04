'use client'

import { useState } from 'react'
import { applyTheme, readTheme, type Theme } from '@/lib/theme'
import { MoonIcon, SunIcon } from './icons'

const OPTIONS: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
]

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() => readTheme())

  const select = (value: Theme) => {
    setTheme(value)
    applyTheme(value)
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`inline-flex items-center gap-0.5 rounded-full border border-line bg-surface/80 p-1 backdrop-blur ${className}`}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            onClick={() => select(value)}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
              active ? 'bg-brand text-white' : 'text-muted hover:bg-surface-soft hover:text-heading'
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        )
      })}
    </div>
  )
}
