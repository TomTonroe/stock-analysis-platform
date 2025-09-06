"use client"

import { useEffect, useRef, useState } from 'react'
import { ThemeToggle } from './ThemeToggle'
import { Icon } from './Icon'

export function HelpPanel() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (e.key === '?' && !isTyping) {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return
      const target = e.target as Node
      if (panelRef.current && !panelRef.current.contains(target) && buttonRef.current && !buttonRef.current.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 bg-white/70 dark:bg-slate-900/70 hover:bg-slate-50 dark:hover:bg-slate-800"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icon name="info" className="h-4 w-4" /> Help
      </button>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Help and keyboard shortcuts"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold">Help & Shortcuts</h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Live charts, AI forecasts, and company insights</p>
            </div>
            <ThemeToggle />
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <h4 className="font-medium mb-1">Keyboard Shortcuts</h4>
              <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                <li><kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">/</kbd> Focus search</li>
                <li><kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">Enter</kbd> Search</li>
                <li><kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">1–5</kbd> Switch panels (Chart, Summary, Live, Forecast, Insights)</li>
                <li><kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">?</kbd> Toggle help</li>
                <li><kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">Esc</kbd> Close panel</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-1">Tips</h4>
              <ul className="list-disc pl-5 text-slate-700 dark:text-slate-300">
                <li>Search supports exact tickers like AAPL, TSLA, BTC-USD</li>
                <li>Change the period from the Chart tab to adjust the range</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-1 inline-flex items-center gap-2"><Icon name="globe" className="h-4 w-4" /> Ticker Suffix Guide</h4>
              <ul className="list-disc pl-5 text-slate-700 dark:text-slate-300">
                <li><span className="font-medium">US (NYSE/NASDAQ):</span> no suffix — e.g. <code className="font-mono">AAPL</code>, <code className="font-mono">MSFT</code>, <code className="font-mono">TSLA</code></li>
                <li><span className="font-medium">UK (LSE):</span> <code className="font-mono">.L</code> — e.g. <code className="font-mono">VOD.L</code></li>
                <li><span className="font-medium">Canada (TSX):</span> <code className="font-mono">.TO</code> — e.g. <code className="font-mono">SHOP.TO</code></li>
                <li><span className="font-medium">Australia (ASX):</span> <code className="font-mono">.AX</code> — e.g. <code className="font-mono">BHP.AX</code></li>
                <li><span className="font-medium">Crypto pairs:</span> hyphenated — e.g. <code className="font-mono">BTC-USD</code>, <code className="font-mono">ETH-USD</code></li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
