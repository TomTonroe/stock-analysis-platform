/**
 * React Query Client Configuration
 * 
 * Centralized configuration for TanStack Query with optimized settings
 * for financial data caching and error handling.
 */

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache times optimized for financial data
      staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
      gcTime: 30 * 60 * 1000, // 30 minutes - garbage collection time
      
      // Error handling
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (bad ticker, etc.)
        if (error && typeof error === 'object' && 'status' in error) {
          const status = error.status as number
          if (status >= 400 && status < 500) {
            return false
          }
        }
        // Retry up to 2 times for other errors
        return failureCount < 2
      },
      
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Network mode - handle offline scenarios
      networkMode: 'online',
      
      // Refetch behavior
      refetchOnWindowFocus: false, // Don't refetch on window focus for financial data
      refetchOnReconnect: true, // Refetch when coming back online
    },
    mutations: {
      // Mutation retry settings
      retry: 1,
      networkMode: 'online',
    },
  },
})

// Query key factories for consistent key management
export const queryKeys = {
  // Stock data keys
  stock: {
    all: ['stock'] as const,
    history: (ticker: string, period: string) => ['stock', 'history', ticker, period] as const,
    summary: (ticker: string) => ['stock', 'summary', ticker] as const,
    validation: (ticker: string) => ['stock', 'validation', ticker] as const,
  },
  
  // Analysis keys
  analysis: {
    all: ['analysis'] as const,
    sentiment: (ticker: string, period: string) => ['analysis', 'sentiment', ticker, period] as const,
    prediction: (ticker: string, model: string, days: number, period: string) => 
      ['analysis', 'prediction', ticker, model, days, period] as const,
  },
  
  // Real-time data keys
  realtime: {
    all: ['realtime'] as const,
    price: (ticker: string) => ['realtime', 'price', ticker] as const,
  },
} as const

export default queryClient