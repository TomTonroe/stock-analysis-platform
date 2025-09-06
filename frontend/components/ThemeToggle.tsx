'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Icon } from './Icon'

export function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  const current = theme === 'system' ? systemTheme : theme

  return (
    <button
      aria-label="Toggle dark mode"
      onClick={() => setTheme(current === 'dark' ? 'light' : 'dark')}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      {current === 'dark' ? <Icon name="sun" /> : <Icon name="moon" />}
      <span className="text-sm">{current === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  )
}
