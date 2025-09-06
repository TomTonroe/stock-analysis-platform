/**
 * UI helper functions for stock components
 */

import type { SecurityType, CalendarEvent } from './types'

export function getSecurityTypeBadge(securityType?: string) {
  const colors: Record<string, string> = {
    stock: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    etf: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    mutual_fund: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    crypto: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    index: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    currency: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  }
  const color = colors[securityType || 'stock'] || colors.stock
  const label = (securityType || 'stock').replace('_', ' ')
  
  return {
    className: `inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`,
    label: label.charAt(0).toUpperCase() + label.slice(1)
  }
}

export function normalizeCalendarEvents(calendar: { earnings?: any; dividends?: any; exDividend?: any }): CalendarEvent[] {
  // Normalize upcoming from calendar
  const normalize = (v: any): any[] => Array.isArray(v) ? v : (v ? [v] : [])
  
  const upcomingRaw = [
    ...normalize(calendar?.earnings).map((d: any) => ({ type: 'earnings', icon: 'chart', title: 'Earnings', date: d })),
    ...normalize(calendar?.dividends).map((d: any) => ({ type: 'dividend', icon: 'cash', title: 'Dividend', date: d })),
    ...normalize(calendar?.exDividend).map((d: any) => ({ type: 'ex-dividend', icon: 'calendar', title: 'Ex-Dividend', date: d })),
  ]
  
  const toDate = (d: any) => {
    try { return new Date(d) } catch { return null }
  }
  
  return upcomingRaw
    .map(e => ({ ...e, dt: toDate(e.date) }))
    .filter(e => e.dt && !isNaN(e.dt.getTime()))
    .sort((a, b) => (a.dt as Date).getTime() - (b.dt as Date).getTime())
    .slice(0, 6)
}
