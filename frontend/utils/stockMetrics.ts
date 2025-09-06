/**
 * Stock metrics calculation utilities
 */

import type { HistoricalData } from '../hooks/useStockQueries'
import type { PeriodMetrics } from './types'

export function calculatePeriodMetrics(
  historicalData: HistoricalData[], 
  selectedPeriod: string
): PeriodMetrics | null {
  if (!historicalData || historicalData.length === 0) return null

  const sortedData = [...historicalData].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  const firstPrice = sortedData[0]
  const lastPrice = sortedData[sortedData.length - 1]
  
  // Calculate price change over the period
  const periodChange = lastPrice.close - firstPrice.open
  const periodChangePercent = (periodChange / firstPrice.open) * 100
  
  // Calculate high/low for the period
  const periodHigh = Math.max(...sortedData.map(d => d.high))
  const periodLow = Math.min(...sortedData.map(d => d.low))
  
  // Calculate average volume for the period
  const avgVolume = sortedData.reduce((sum, d) => sum + d.volume, 0) / sortedData.length
  
  // Get period label for display
  const periodLabels: Record<string, string> = {
    '1d': 'today',
    '5d': 'this week',
    '1mo': 'this month',
    '3mo': '3 months',
    '6mo': '6 months',
    '1y': 'this year',
    '2y': '2 years',
    '5y': '5 years',
    '10y': '10 years',
    'ytd': 'year to date',
    'max': 'all time'
  }

  return {
    currentPrice: lastPrice.close,
    periodChange,
    periodChangePercent,
    periodHigh,
    periodLow,
    avgVolume,
    dataPoints: sortedData.length,
    periodLabel: periodLabels[selectedPeriod] || selectedPeriod,
    startDate: new Date(firstPrice.timestamp),
    endDate: new Date(lastPrice.timestamp)
  }
}