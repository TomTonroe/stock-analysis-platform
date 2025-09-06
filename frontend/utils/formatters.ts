/**
 * Formatting utilities for financial data display using Intl.NumberFormat and date-fns
 */

import { format, parseISO, isValid } from 'date-fns'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('en-US')

export function fmtUsd(v?: number | null): string {
  return v == null ? '—' : currencyFormatter.format(v)
}

export function fmtMoney(v?: number | null): string {
  return v == null ? '—' : moneyFormatter.format(v)
}

export function fmtPct(v?: number | null): string {
  return v == null ? '—' : percentFormatter.format(v)
}

export function fmtNum(v?: number | null): string {
  return v == null ? '—' : numberFormatter.format(v)
}

export function formatDate(v?: string | number | null): string {
  if (!v) return '—'
  try {
    let date: Date
    if (typeof v === 'number') {
      date = new Date(v)
    } else if (typeof v === 'string') {
      date = v.includes('T') || v.includes('-') ? parseISO(v) : new Date(v)
    } else {
      return '—'
    }
    
    return isValid(date) ? format(date, 'MMM d, yyyy') : '—'
  } catch {
    return '—'
  }
}

export function formatDateTime(v?: string | number | null): string {
  if (!v) return '—'
  try {
    let date: Date
    if (typeof v === 'number') {
      date = new Date(v)
    } else if (typeof v === 'string') {
      date = v.includes('T') || v.includes('-') ? parseISO(v) : new Date(v)
    } else {
      return '—'
    }
    
    return isValid(date) ? format(date, 'MMM d, yyyy h:mm a') : '—'
  } catch {
    return '—'
  }
}

export function formatRelativeTime(v?: string | number | null): string {
  if (!v) return '—'
  try {
    let date: Date
    if (typeof v === 'number') {
      date = new Date(v)
    } else if (typeof v === 'string') {
      date = v.includes('T') || v.includes('-') ? parseISO(v) : new Date(v)
    } else {
      return '—'
    }
    
    if (!isValid(date)) return '—'
    
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000))
    const diffMinutes = Math.floor(diffMs / (60 * 1000))
    
    if (diffDays > 0) return `${diffDays}d ago`
    if (diffHours > 0) return `${diffHours}h ago`
    if (diffMinutes > 0) return `${diffMinutes}m ago`
    return 'Just now'
  } catch {
    return '—'
  }
}