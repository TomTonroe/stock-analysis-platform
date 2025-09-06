'use client'

import type { RefObject } from 'react'

export function TickerSearch({ 
  onTickerSelect,
  onInputChange,
  placeholder = "Enter exact ticker (e.g. AAPL, TEAM, BTC-USD)...", 
  initialValue = "",
  value,
  className,
  inputRef,
}: { 
  onTickerSelect: (ticker: string) => void
  onInputChange?: (value: string) => void
  placeholder?: string
  initialValue?: string,
  value?: string,
  className?: string,
  inputRef?: RefObject<HTMLInputElement>,
}) {
  return (
    <input
      type="text"
      ref={inputRef}
      // Prefer controlled value when provided; fallback to defaultValue for backwards-compat
      {...(value !== undefined ? { value } : { defaultValue: initialValue })}
      onChange={(e) => {
        const value = e.target.value
        onInputChange?.(value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const value = (e.target as HTMLInputElement).value.trim()
          if (value) {
            onTickerSelect(value.toUpperCase())
          }
        }
      }}
      placeholder={placeholder}
      className={
        className ||
        "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-800 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40 focus:border-blue-400"
      }
    />
  )
}
