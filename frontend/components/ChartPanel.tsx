'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { calculatePeriodMetrics } from '../utils'
import { useChartManager } from '../hooks/useChartManager'
import { useTheme } from '../hooks/useTheme'
import type { HistoricalData } from '../hooks/useStockQueries'

// Simplified interface since React Query handles caching
interface CachedData {
  historical: HistoricalData[]
  summary?: any
  interval?: string
  companyName?: string
  dateRange?: { start: string; end: string }
}

type Props = {
  symbol: string
  currentData: HistoricalData[]
  cachedData: Record<string, CachedData>
  selectedPeriod: string
  periods: Array<{ label: string; value: string }>
  status: 'idle' | 'loading' | 'success' | 'error'
  onPeriodChange: (period: string) => void
}

export function ChartPanel({ 
  symbol, 
  currentData, 
  cachedData, 
  selectedPeriod, 
  periods, 
  status,
  onPeriodChange 
}: Props) {
  const chartPlotRef = useRef<HTMLDivElement | null>(null)
  const { chartManager, isReady } = useChartManager(chartPlotRef)
  const isDarkMode = useTheme()
  const [indicators, setIndicators] = useState({ ma20: true, ma50: true, ma200: false, rsi: false })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem('chartIndicators')
      if (saved) setIndicators(JSON.parse(saved))
    } catch {}
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('chartIndicators', JSON.stringify(indicators))
  }, [indicators])

  const tickerKey = symbol.toUpperCase()
  const cached = cachedData[tickerKey]

  // Theme detection is now handled by useTheme hook

  // Chart rendering logic
  useEffect(() => {
    if (!isReady || !chartManager || !currentData.length) return

    // Get cached data for company name
    const tickerKey = symbol.toUpperCase()
    const cacheKey = `${tickerKey}_${selectedPeriod}`
    const cached = cachedData[cacheKey] || cachedData[tickerKey]
    const interval = cached?.interval || '1d'
    const companyName = cached?.companyName || ''
    
    // Create interval label for display
    const intervalLabels: Record<string, string> = {
      '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min', '1h': '1hr',
      '1d': 'Daily', '1wk': 'Weekly', '1mo': 'Monthly'
    }
    const intervalLabel = intervalLabels[interval] || interval
    
    const title = `${symbol} - ${companyName} (${selectedPeriod.toUpperCase()}${interval ? ` • ${intervalLabel} Candles` : ''})`

    const drawChart = () => {
      const success = chartManager.createCandlestickChart(currentData, {
        title,
        height: 560,
        showVolume: true,
        showPredictions: false,
        theme: isDarkMode ? 'dark' : 'light',
        indicators
      })
      
      if (!success) {
        console.warn('Failed to create chart for', symbol)
      }
    }

    // Small delay to ensure DOM is ready
    setTimeout(drawChart, 50)
  }, [currentData, symbol, selectedPeriod, cachedData, isDarkMode, isReady, chartManager, indicators])

  // Cleanup is handled automatically by useChartManager

  return (
    <div className="space-y-4">
      {/* Time Period & Indicators */}
      {cached && (
        <div className="rounded-2xl p-4 bg-white/70 dark:bg-slate-900/70 shadow">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-slate-600 dark:text-slate-300 py-2 mr-2">Period:</span>
            {periods.map(p => (
              <button
                key={p.value}
                onClick={() => onPeriodChange(p.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedPeriod === p.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}

            <span className="mx-3 h-6 w-px bg-slate-200 dark:bg-slate-700" />

            <span className="text-sm text-slate-600 dark:text-slate-300">Indicators:</span>
            <label className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer">
              <input type="checkbox" checked={indicators.ma20} onChange={e => setIndicators(prev => ({ ...prev, ma20: e.target.checked }))} /> MA20
            </label>
            <label className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer">
              <input type="checkbox" checked={indicators.ma50} onChange={e => setIndicators(prev => ({ ...prev, ma50: e.target.checked }))} /> MA50
            </label>
            <label className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer">
              <input type="checkbox" checked={indicators.ma200} onChange={e => setIndicators(prev => ({ ...prev, ma200: e.target.checked }))} /> MA200
            </label>
            <label className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer">
              <input type="checkbox" checked={indicators.rsi} onChange={e => setIndicators(prev => ({ ...prev, rsi: e.target.checked }))} /> RSI
            </label>
          </div>
        </div>
      )}

      {/* Stock Metrics Display */}
      {currentData.length > 0 && status === 'success' && cached && (
        <div className="rounded-2xl p-4 bg-white/70 dark:bg-slate-900/70 shadow">
          {(() => {
            const periodMetrics = calculatePeriodMetrics(currentData, selectedPeriod)
            if (!periodMetrics) return null

            return (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                      {periodMetrics.currentPrice.toFixed(2)} USD
                    </h3>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`${
                        periodMetrics.periodChange >= 0 ? 'text-green-600' : 'text-red-600'
                      } font-medium`}>
                        {periodMetrics.periodChange >= 0 ? '+' : ''}
                        {periodMetrics.periodChange.toFixed(2)} (
                        {periodMetrics.periodChangePercent.toFixed(2)}%)
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">{periodMetrics.periodLabel}</span>
                    </div>
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {periodMetrics.endDate.toLocaleString('en-US', { 
                      day: 'numeric', 
                      month: 'short', 
                      hour: '2-digit', 
                      minute: '2-digit',
                      timeZoneName: 'short'
                    })} • {periodMetrics.dataPoints} data points
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">Period High</div>
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {periodMetrics.periodHigh.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">Period Low</div>
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {periodMetrics.periodLow.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">Avg Volume</div>
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {Math.round(periodMetrics.avgVolume).toLocaleString()}
                    </div>
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* Chart Container */}
      <div className="rounded-2xl p-2 bg-white/70 dark:bg-slate-900/70 shadow relative">
        <div ref={chartPlotRef} style={{height: 560}} />
        
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 rounded-2xl">
            <div className="text-center p-8">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400">
                <Icon name="chart" className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Stock Chart
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-md">
                Enter a stock ticker symbol above to view interactive price charts and technical analysis.
              </p>
            </div>
          </div>
        )}
        
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 rounded-2xl">
            <div className="text-center p-8">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-600/10 text-red-600 dark:text-red-400">
                <Icon name="alert" className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Error Loading Chart
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-md">
                Unable to load chart data. Please check the ticker symbol and try again.
              </p>
            </div>
          </div>
        )}
        
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 rounded-2xl">
            <div className="text-center p-8">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-600/10 text-slate-600 dark:text-slate-300">
                <Icon name="spinner" className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Loading Chart
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-md">
                Fetching stock data and generating interactive chart...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
