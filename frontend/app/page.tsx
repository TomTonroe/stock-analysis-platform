"use client"
import Script from 'next/script'
import { StockAnalysisApp } from '../components/StockAnalysisApp'
import { HelpPanel } from '../components/HelpPanel'
import { useEffect, useState } from 'react'

export default function HomePage() {
  const [ticker, setTicker] = useState('')

  // Restore last ticker after mount to avoid SSR mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lastTicker')
      if (saved) setTicker(saved)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && ticker) {
      localStorage.setItem('lastTicker', ticker)
    }
  }, [ticker])

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      {/* Plotly via CDN for minimal deps */}
      <Script src="https://cdn.plot.ly/plotly-2.27.0.min.js" strategy="afterInteractive" />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              <span className="text-slate-700 dark:text-slate-200">S</span><span className="text-blue-600 dark:text-blue-400">A</span><span className="text-green-600 dark:text-green-400">P</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Live charts, AI forecasts, and company insights</p>
          </div>
          <HelpPanel />
        </header>

        <StockAnalysisApp ticker={ticker} onTickerChange={setTicker} />
      </div>
    </main>
  )
}
