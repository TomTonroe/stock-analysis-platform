/**
 * React Query Hooks for Stock Data
 * 
 * Modern server state management using TanStack Query.
 * Replaces the custom useStockData and useSimplifiedStockData hooks.
 */

'use client'

import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryClient'
import stockDataService, {
  type StockData,
  type StockSummary,
  type SentimentAnalysis,
  type PredictionResult,
  type HistoricalData
} from '../services/stockDataService'

// Re-export types for convenience
export type { StockData, StockSummary, SentimentAnalysis, PredictionResult, HistoricalData }

/**
 * Hook for stock historical data
 */
export function useStockHistory(ticker: string, period: string = '1y') {
  return useQuery({
    queryKey: queryKeys.stock.history(ticker, period),
    queryFn: () => stockDataService.fetchStockData(ticker, period),
    enabled: !!ticker.trim(),
    staleTime: 15 * 60 * 1000, // 15 minutes for historical data
    gcTime: 60 * 60 * 1000, // 1 hour garbage collection
  })
}

/**
 * Hook for stock summary/company information
 */
export function useStockSummary(ticker: string) {
  return useQuery({
    queryKey: queryKeys.stock.summary(ticker),
    queryFn: () => stockDataService.fetchStockSummary(ticker),
    enabled: !!ticker.trim(),
    staleTime: 30 * 60 * 1000, // 30 minutes for summary data
    gcTime: 2 * 60 * 60 * 1000, // 2 hours garbage collection
  })
}

/**
 * Hook for ticker validation
 */
export function useTickerValidation(ticker: string) {
  return useQuery({
    queryKey: queryKeys.stock.validation(ticker),
    queryFn: () => stockDataService.validateTicker(ticker),
    enabled: !!ticker.trim() && ticker.length >= 1,
    staleTime: 30 * 60 * 1000, // 30 minutes for validation
    gcTime: 60 * 60 * 1000, // 1 hour garbage collection
    retry: false, // Don't retry validation failures
  })
}

/**
 * Hook for sentiment analysis (manual trigger)
 */
export function useSentimentAnalysis(
  ticker: string, 
  period: string = '2y', 
  includePredictions: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.analysis.sentiment(ticker, period),
    queryFn: () => stockDataService.fetchSentimentAnalysis(ticker, period, includePredictions),
    enabled: false, // Only run when manually triggered
    staleTime: 2 * 60 * 60 * 1000, // 2 hours for sentiment (expensive operation)  
    gcTime: 4 * 60 * 60 * 1000, // 4 hours garbage collection
  })
}

/**
 * Hook for stock predictions (manual trigger)
 */
export function usePrediction(
  ticker: string,
  model: string = 'chronos-bolt-small',
  forecastDays: number = 30,
  period: string = '2y'
) {
  return useQuery({
    queryKey: queryKeys.analysis.prediction(ticker, model, forecastDays, period),
    queryFn: () => stockDataService.fetchPrediction(ticker, model, forecastDays, period),
    enabled: false, // Only run when manually triggered
    staleTime: 60 * 60 * 1000, // 1 hour for predictions
    gcTime: 2 * 60 * 60 * 1000, // 2 hours garbage collection
  })
}

/**
 * Hook for prediction models list
 */
export function usePredictionModels() {
  return useQuery({
    queryKey: ['prediction', 'models'],
    queryFn: async () => {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || ''
      const response = await fetch(`${base}/financial/models`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }
      
      const result = await response.json()
      if (!result.success || !result.data?.models) {
        throw new Error(result.message || 'Failed to fetch models')
      }
      
      return result.data.models
    },
    staleTime: 24 * 60 * 60 * 1000, // Models rarely change, cache for 24 hours
    gcTime: 48 * 60 * 60 * 1000, // Keep in cache for 48 hours
  })
}

/**
 * Comprehensive hook that fetches both historical data and summary
 * Replaces the main functionality of useStockData/useSimplifiedStockData
 */
export function useStockComplete(ticker: string, period: string = '1y') {
  const historyQuery = useStockHistory(ticker, period)
  const summaryQuery = useStockSummary(ticker)
  
  return {
    // Combined data
    data: {
      historical: historyQuery.data,
      summary: summaryQuery.data,
    },
    
    // Combined states
    isLoading: historyQuery.isLoading || summaryQuery.isLoading,
    isError: historyQuery.isError || summaryQuery.isError,
    error: historyQuery.error || summaryQuery.error,
    
    // Individual query states for granular control
    history: historyQuery,
    summary: summaryQuery,
    
    // Helper methods
    refetchAll: () => {
      historyQuery.refetch()
      summaryQuery.refetch()
    },
  }
}

/**
 * Hook for prefetching multiple periods of data
 * Useful for period switching without loading states
 */
export function useStockMultiPeriod(ticker: string, periods: string[]) {
  const queries = useQueries({
    queries: periods.map(period => ({
      queryKey: queryKeys.stock.history(ticker, period),
      queryFn: () => stockDataService.fetchStockData(ticker, period),
      enabled: !!ticker.trim(),
      staleTime: 15 * 60 * 1000,
    })),
  })
  
  return {
    queries,
    isLoading: queries.some(q => q.isLoading),
    isError: queries.some(q => q.isError),
    data: queries.reduce((acc, query, index) => {
      if (query.data) {
        acc[periods[index]] = query.data
      }
      return acc
    }, {} as Record<string, StockData>),
  }
}

/**
 * Mutation for clearing stock cache
 */
export function useClearStockCache() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (ticker?: string) => {
      if (ticker) {
        // Clear specific ticker cache from React Query only
        await queryClient.invalidateQueries({ 
          predicate: (query) => {
            return query.queryKey.includes(ticker.toUpperCase())
          }
        })
      } else {
        // Clear all stock cache from React Query
        await queryClient.invalidateQueries({ 
          queryKey: queryKeys.stock.all 
        })
        await queryClient.invalidateQueries({ 
          queryKey: queryKeys.analysis.all 
        })
      }
    },
  })
}

/**
 * Custom hook for managing period selection with prefetching
 */
export function usePeriodManager(ticker: string, initialPeriod: string = '1y') {
  const queryClient = useQueryClient()
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod)
  
  const periods = [
    { label: '1D', value: '1d' },
    { label: '5D', value: '5d' },
    { label: '1M', value: '1mo' },
    { label: '3M', value: '3mo' },
    { label: '6M', value: '6mo' },
    { label: '1Y', value: '1y' },
    { label: '2Y', value: '2y' },
    { label: '5Y', value: '5y' },
    { label: 'MAX', value: 'max' }
  ]
  
  const currentQuery = useStockHistory(ticker, selectedPeriod)
  
  const changePeriod = async (newPeriod: string) => {
    setSelectedPeriod(newPeriod)
    
    // Prefetch the new period if not already cached
    await queryClient.prefetchQuery({
      queryKey: queryKeys.stock.history(ticker, newPeriod),
      queryFn: () => stockDataService.fetchStockData(ticker, newPeriod),
      staleTime: 15 * 60 * 1000,
    })
  }
  
  return {
    selectedPeriod,
    periods,
    changePeriod,
    currentData: currentQuery.data,
    isLoading: currentQuery.isLoading,
    isError: currentQuery.isError,
    error: currentQuery.error,
  }
}

// Import useState for usePeriodManager
import { useState } from 'react'