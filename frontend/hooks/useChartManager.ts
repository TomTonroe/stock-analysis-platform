'use client'

import { useRef, useEffect } from 'react'
import { ChartManager } from '../utils/ChartManager'

/**
 * Hook for managing ChartManager instances
 * 
 * Provides a consistent interface for chart operations across components
 */
export function useChartManager(elementRef: React.RefObject<HTMLDivElement>) {
  const chartManagerRef = useRef<ChartManager | null>(null)

  // Initialize ChartManager when element is available
  useEffect(() => {
    if (elementRef.current && !chartManagerRef.current) {
      chartManagerRef.current = new ChartManager(elementRef.current)
    }
    
    return () => {
      if (chartManagerRef.current) {
        chartManagerRef.current.cleanup()
        chartManagerRef.current = null
      }
    }
  }, [elementRef])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartManagerRef.current) {
        chartManagerRef.current.cleanup()
      }
    }
  }, [])

  return {
    chartManager: chartManagerRef.current,
    isReady: !!chartManagerRef.current && !!elementRef.current
  }
}