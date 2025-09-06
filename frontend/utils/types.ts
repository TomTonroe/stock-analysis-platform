/**
 * Shared types for stock analysis components
 */

export type PeriodMetrics = {
  currentPrice: number
  periodChange: number
  periodChangePercent: number
  periodHigh: number
  periodLow: number
  avgVolume: number
  dataPoints: number
  periodLabel: string
  startDate: Date
  endDate: Date
}

export type SecurityType = 'stock' | 'etf' | 'mutual_fund' | 'crypto' | 'index' | 'currency'

export type CalendarEvent = {
  type: 'earnings' | 'dividend' | 'ex-dividend'
  icon: string
  title: string
  date: any
  dt?: Date
}