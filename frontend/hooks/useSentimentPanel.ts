'use client'

import { useState, useCallback } from 'react'
import { useSentimentAnalysis } from './useStockQueries'

/**
 * React Query-based hook for sentiment panel  
 * Replaces useSentiment with proper caching
 */
export function useSentimentPanel() {
  // Configuration state
  const [sentimentPeriod, setSentimentPeriod] = useState('2y')
  const [currentTicker, setCurrentTicker] = useState('')

  // React Query hook for sentiment analysis
  const sentimentQuery = useSentimentAnalysis(currentTicker, sentimentPeriod, true)

  // Trigger sentiment analysis manually
  const fetchSentiment = useCallback(async (symbol: string) => {
    if (!symbol.trim()) return
    
    setCurrentTicker(symbol.toUpperCase())
    // Refetch will trigger the query with the new ticker
    await sentimentQuery.refetch()
  }, [sentimentQuery])

  return {
    // Configuration
    sentimentPeriod,
    setSentimentPeriod,
    
    // Sentiment state (from React Query)
    sentimentStatus: sentimentQuery.isLoading ? 'loading' 
                    : sentimentQuery.isError ? 'error'
                    : sentimentQuery.data ? 'success' 
                    : 'idle',
    sentimentData: sentimentQuery.data,
    sentimentError: sentimentQuery.error,
    
    // Actions
    fetchSentiment,
    
    // React Query controls
    refetch: sentimentQuery.refetch,
    isStale: sentimentQuery.isStale,
  }
}