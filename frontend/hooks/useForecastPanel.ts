'use client'

import { useState, useCallback } from 'react'
import { usePrediction, usePredictionModels } from './useStockQueries'

/**
 * React Query-based hook for forecast panel
 * Replaces usePredictions with proper caching
 */
export function useForecastPanel() {
  // Configuration state
  const [selectedModel, setSelectedModel] = useState('chronos-bolt-small')
  const [forecastDays, setForecastDays] = useState(30)
  const [currentTicker, setCurrentTicker] = useState('')

  // React Query hooks
  const modelsQuery = usePredictionModels()
  const predictionQuery = usePrediction(currentTicker, selectedModel, forecastDays, '2y')

  // Trigger prediction manually
  const fetchPrediction = useCallback(async (symbol: string) => {
    if (!symbol.trim()) return
    
    setCurrentTicker(symbol.toUpperCase())
    // Refetch will trigger the query with the new ticker
    await predictionQuery.refetch()
  }, [predictionQuery])

  // Fetch models on mount
  const fetchAvailableModels = useCallback(async () => {
    if (!modelsQuery.data) {
      await modelsQuery.refetch()
    }
  }, [modelsQuery])

  return {
    // Configuration
    selectedModel,
    setSelectedModel,
    forecastDays,
    setForecastDays,
    availableModels: modelsQuery.data || {},
    
    // Prediction state (from React Query)
    predictionStatus: predictionQuery.isLoading ? 'loading' 
                     : predictionQuery.isError ? 'error'
                     : predictionQuery.data ? 'success' 
                     : 'idle',
    predictionData: predictionQuery.data,
    predictionError: predictionQuery.error,
    
    // Models state
    modelsStatus: modelsQuery.isLoading ? 'loading' 
                 : modelsQuery.isError ? 'error'
                 : modelsQuery.data ? 'success'
                 : 'idle',
    
    // Actions
    fetchAvailableModels,
    fetchPrediction,
    
    // React Query controls
    refetch: predictionQuery.refetch,
    isStale: predictionQuery.isStale,
  }
}