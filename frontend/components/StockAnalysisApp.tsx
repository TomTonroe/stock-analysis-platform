'use client'

import { useEffect, useRef, useState } from 'react'
import { useStockComplete, usePeriodManager, type HistoricalData } from '../hooks/useStockQueries'
import { TickerSearch } from './TickerSearch'
import { LiveChart } from './LiveChart'
import { ChartPanel } from './ChartPanel'
import { CompanyInfoView } from './CompanyInfoView'
import { ForecastPanel } from './ForecastPanel'
import { SentimentPanel } from './SentimentPanel'

type Props = { 
  ticker: string
  onTickerChange?: (t: string) => void 
}

type PanelType = 'chart' | 'summary' | 'live' | 'forecast' | 'insights'

export function StockAnalysisApp({ ticker, onTickerChange }: Props) {
  const [activePanel, setActivePanel] = useState<PanelType>('chart')
  const [currentTicker, setCurrentTicker] = useState(ticker)
  const [inputValue, setInputValue] = useState(ticker)
  const inputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)
  const [watchlist, setWatchlist] = useState<string[]>([])
  
  // React Query hooks for data fetching
  const periodManager = usePeriodManager(currentTicker)
  const stockComplete = useStockComplete(currentTicker, periodManager.selectedPeriod)
  
  const handleTickerSelect = (newTicker: string) => {
    const upperTicker = newTicker.toUpperCase()
    setCurrentTicker(upperTicker)
    setInputValue(upperTicker)
    onTickerChange?.(upperTicker)
  }

  const handleInputChange = (value: string) => {
    setInputValue(value)
  }

  const handleSearch = () => {
    if (inputValue.trim()) {
      handleTickerSelect(inputValue.trim())
    }
  }

  // Sync with parent-provided ticker (e.g., restored from localStorage)
  useEffect(() => {
    const next = (ticker || '').toUpperCase()
    setCurrentTicker(next)
    setInputValue(next)
  }, [ticker])

  // Persist selected period and restore on load
  useEffect(() => {
    setMounted(true)
    // Load watchlist
    try {
      const wl = typeof window !== 'undefined' ? localStorage.getItem('watchlist') : null
      if (wl) setWatchlist(JSON.parse(wl))
    } catch {}
    // Restore active panel
    const savedPanel = typeof window !== 'undefined' ? (localStorage.getItem('activePanel') as PanelType | null) : null
    if (savedPanel) setActivePanel(savedPanel)

    const saved = typeof window !== 'undefined' ? localStorage.getItem('selectedPeriod') : null
    if (saved && saved !== periodManager.selectedPeriod) {
      periodManager.changePeriod(saved)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedPeriod', periodManager.selectedPeriod)
    }
  }, [periodManager.selectedPeriod])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activePanel', activePanel)
    }
  }, [activePanel])

  // Persist watchlist
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('watchlist', JSON.stringify(watchlist))
    }
  }, [watchlist])

  const addToWatchlist = () => {
    const t = currentTicker.trim().toUpperCase()
    if (!t) return
    setWatchlist(prev => prev.includes(t) ? prev : [...prev, t])
  }

  const removeFromWatchlist = (t: string) => {
    setWatchlist(prev => prev.filter(x => x !== t))
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (e.key === '/' && !isTyping) {
        e.preventDefault()
        inputRef.current?.focus()
        return
      }
      if (isTyping) return
      if (e.key === '1') setActivePanel('chart')
      else if (e.key === '2') setActivePanel('summary')
      else if (e.key === '3') setActivePanel('live')
      else if (e.key === '4') setActivePanel('forecast')
      else if (e.key === '5') setActivePanel('insights')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Create compatible data structure for existing components
  const compatibleData = {
    symbol: currentTicker,
    inputValue,
    status: stockComplete.isLoading ? 'loading' as const : 
            stockComplete.isError ? 'error' as const :
            stockComplete.data.historical ? 'success' as const : 'idle' as const,
    selectedPeriod: periodManager.selectedPeriod,
    currentData: stockComplete.data.historical?.ohlcv || [] as HistoricalData[],
    cachedData: {
      [currentTicker]: {
        historical: stockComplete.data.historical?.ohlcv || [],
        summary: stockComplete.data.summary,
        interval: stockComplete.data.historical?.interval,
        companyName: stockComplete.data.historical?.company_name,
        dateRange: stockComplete.data.historical?.date_range
      }
    },
    periods: periodManager.periods,
    handlePeriodChange: periodManager.changePeriod,
    error: stockComplete.error
  }

  return (
    <div className="space-y-6">
      {/* Simplified Stock Search - Direct TickerSearch usage */}
      <div className="rounded-2xl p-4 sm:p-6 bg-white/70 dark:bg-slate-900/70 shadow">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex-1 flex">
            <div className="flex-1">
              <TickerSearch 
                onTickerSelect={handleTickerSelect}
                onInputChange={handleInputChange}
                placeholder="Enter ticker symbol..."
                value={inputValue}
                inputRef={inputRef}
                className="w-full rounded-l-xl rounded-r-none border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40 focus:border-blue-400"
              />
            </div>
            <button 
              onClick={handleSearch}
              disabled={!compatibleData.inputValue.trim() || compatibleData.status === 'loading'}
              className="-ml-px rounded-r-xl rounded-l-none bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white px-4 py-2 text-sm font-medium whitespace-nowrap"
            >
              {!mounted || compatibleData.status !== 'loading' ? 'Search' : 'Searching...'}
            </button>
          </div>
        </div>

        {/* Status chips */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {/* Status chip */}
          <span
            className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border ${
              compatibleData.status === 'success' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' :
              compatibleData.status === 'loading' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' :
              compatibleData.status === 'error' ? 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30' :
              'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30'
            }`}
          >
            {compatibleData.status === 'loading' ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" className="opacity-25"/><path d="M21 12a9 9 0 0 1-9 9" className="opacity-75"/></svg>
                Loading
              </>
            ) : compatibleData.status === 'error' ? (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                Error
              </>
            ) : compatibleData.status === 'success' ? (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>
                Loaded
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/></svg>
                Ready
              </>
            )}
          </span>

          {/* Ticker chip */}
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border bg-slate-500/5 text-slate-700 dark:text-slate-300 border-slate-500/20">
            <span className="font-medium">Ticker:</span>
            <span className="font-mono">{compatibleData.symbol || '—'}</span>
          </span>

          {/* Period/Interval chip */}
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border bg-slate-500/5 text-slate-700 dark:text-slate-300 border-slate-500/20">
            <span className="font-medium">Period:</span>
            <span>{compatibleData.selectedPeriod}</span>
            {stockComplete.data.historical?.interval && <span className="opacity-70">• {stockComplete.data.historical.interval}</span>}
          </span>

          {/* Date range chip */}
          {stockComplete.data.historical?.date_range && (
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border bg-slate-500/5 text-slate-700 dark:text-slate-300 border-slate-500/20">
              <span className="font-medium">Range:</span>
              <span>
                {new Date(stockComplete.data.historical.date_range.start).toLocaleDateString()} – {new Date(stockComplete.data.historical.date_range.end).toLocaleDateString()}
              </span>
            </span>
          )}

          {/* Watchlist controls */}
          <button
            onClick={addToWatchlist}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-500/30"
          >
            ★ Add to Watchlist
          </button>
        </div>
      </div>

      {/* Panel Navigation */}
      <div className="rounded-2xl bg-white/70 dark:bg-slate-900/70 shadow">
        <div className="px-4 pt-3">
          <nav className="flex items-center gap-4 overflow-x-auto border-b border-slate-200 dark:border-slate-700 pb-1" aria-label="Panels">
            <button
              onClick={() => setActivePanel('chart')}
              aria-pressed={activePanel === 'chart'}
              className={`-mb-px inline-flex items-center gap-2 py-2 text-sm font-medium border-b-2 transition-colors ${
                activePanel === 'chart'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 dark:text-slate-300 dark:hover:text-white dark:hover:border-slate-600'
              }`}
            >
              <span className="inline-flex items-center"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg></span>
              Chart
            </button>
            <button
              onClick={() => setActivePanel('summary')}
              aria-pressed={activePanel === 'summary'}
              className={`-mb-px inline-flex items-center gap-2 py-2 text-sm font-medium border-b-2 transition-colors ${
                activePanel === 'summary'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 dark:text-slate-300 dark:hover:text-white dark:hover:border-slate-600'
              }`}
            >
              <span className="inline-flex items-center"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h2v2H7zM11 7h2v2h-2zM15 7h2v2h-2zM7 11h2v2H7zM11 11h2v2h-2zM15 11h2v2h-2zM7 15h10v4H7z" fill="currentColor" stroke="none"/></svg></span>
              Summary
            </button>
            <button
              onClick={() => setActivePanel('live')}
              aria-pressed={activePanel === 'live'}
              className={`-mb-px inline-flex items-center gap-2 py-2 text-sm font-medium border-b-2 transition-colors ${
                activePanel === 'live'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 dark:text-slate-300 dark:hover:text-white dark:hover:border-slate-600'
              }`}
            >
              <span className="inline-flex items-center"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2 20h2v-4H2zM7 20h2v-8H7zM12 20h2V6h-2zM17 20h2V3h-2z"/></svg></span>
              Live
            </button>
            <button
              onClick={() => setActivePanel('forecast')}
              aria-pressed={activePanel === 'forecast'}
              className={`-mb-px inline-flex items-center gap-2 py-2 text-sm font-medium border-b-2 transition-colors ${
                activePanel === 'forecast'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 dark:text-slate-300 dark:hover:text-white dark:hover:border-slate-600'
              }`}
            >
              <span className="inline-flex items-center"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg></span>
              Forecast
            </button>
            <button
              onClick={() => setActivePanel('insights')}
              aria-pressed={activePanel === 'insights'}
              className={`-mb-px inline-flex items-center gap-2 py-2 text-sm font-medium border-b-2 transition-colors ${
                activePanel === 'insights'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 dark:text-slate-300 dark:hover:text-white dark:hover:border-slate-600'
              }`}
            >
              <span className="inline-flex items-center"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6a3 3 0 0 1 3-3 3 3 0 0 1 3 3h0a3 3 0 0 1 3 3c0 1.1-.6 2.1-1.5 2.6A3.5 3.5 0 0 1 19 15a3 3 0 0 1-3 3h-1a3 3 0 0 1-3 3 3 3 0 0 1-3-3h0a3 3 0 0 1-3-3c0-1.1.6-2.1 1.5-2.6A3.5 3.5 0 0 1 5 9a3 3 0 0 1 3-3Z"/></svg></span>
              AI Insights
            </button>
          </nav>
        </div>
      </div>

      {/* Watchlist quick switch */}
      {watchlist.length > 0 && (
        <div className="rounded-2xl p-3 bg-white/70 dark:bg-slate-900/70 shadow">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Watchlist</div>
          <div className="flex flex-wrap gap-2">
            {watchlist.map(t => (
              <div key={t} className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border ${t===currentTicker? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'}`}>
                <button onClick={() => handleTickerSelect(t)} className="font-mono">{t}</button>
                <button onClick={() => removeFromWatchlist(t)} className="text-xs opacity-70 hover:opacity-100">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel Content */}
      {activePanel === 'chart' && (
        <ChartPanel
          symbol={compatibleData.symbol}
          currentData={compatibleData.currentData}
          cachedData={compatibleData.cachedData}
          selectedPeriod={compatibleData.selectedPeriod}
          periods={compatibleData.periods}
          status={compatibleData.status}
          onPeriodChange={compatibleData.handlePeriodChange}
        />
      )}

      {activePanel === 'summary' && compatibleData.cachedData[compatibleData.symbol]?.summary && (
        <CompanyInfoView 
          summary={compatibleData.cachedData[compatibleData.symbol].summary} 
          ticker={compatibleData.symbol} 
        />
      )}

      {activePanel === 'summary' && !compatibleData.cachedData[compatibleData.symbol]?.summary && compatibleData.status !== 'loading' && (
        <div className="rounded-2xl p-6 bg-white/70 dark:bg-slate-900/70 shadow">
          <div className="text-center p-12">
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
              No Summary Data
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Enter a stock ticker symbol and click "Search" to view comprehensive company summary and financial metrics.
            </p>
          </div>
        </div>
      )}

      {activePanel === 'live' && (
        <LiveChart 
          ticker={compatibleData.symbol} 
          onTickerChange={onTickerChange}
        />
      )}

      {activePanel === 'forecast' && (
        <ForecastPanel
          symbol={compatibleData.symbol}
          currentData={compatibleData.currentData}
        />
      )}

      {activePanel === 'insights' && (
        <SentimentPanel
          symbol={compatibleData.symbol}
        />
      )}
    </div>
  )
}
