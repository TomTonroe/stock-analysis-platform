'use client'

import { useState, useEffect } from 'react'

/**
 * Unified theme detection hook
 * 
 * Simplifies theme detection across components by providing a single source of truth.
 * Replaces duplicate MutationObserver logic in ChartPanel and ForecastPanel.
 */
export function useTheme() {
  const [isDark, setIsDark] = useState(false)
  
  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    
    // Set initial theme
    updateTheme()
    
    // Listen for theme changes using MutationObserver
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, { 
      attributes: true,
      attributeFilter: ['class']
    })
    
    return () => observer.disconnect()
  }, [])
  
  return isDark
}