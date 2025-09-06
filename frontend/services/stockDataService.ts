/**
 * Unified Stock Data Service
 * 
 * Single source of truth for all stock data operations.
 * Consolidates duplicate fetching logic from useStockData, LiveChart, and other components.
 */

export interface StockData {
  ticker: string
  company_name: string
  period: string
  interval: string
  data_points: number
  date_range: { start: string; end: string }
  ohlcv: HistoricalData[]
}

export interface HistoricalData {
  date: string
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface StockSummary {
  ticker: string
  securityType?: string
  quoteType?: string
  market?: {
    country: string
    market: string
    currency: string
    timezone: string
  }
  company?: {
    longName?: string
    shortName?: string
    exchange?: string
    currency?: string
    sector?: string
    industry?: string
    country?: string
    website?: string
    summary?: string
    employees?: number
    founded?: string
    headquarters?: string
  }
  metrics?: Record<string, any>
  price?: Record<string, any>
  dividends?: Record<string, any>
  splits?: Record<string, any>
  shares?: Record<string, any>
  analyst?: Record<string, any>
  earnings?: Record<string, any>
  financial?: Record<string, any>
  holders?: {
    major?: Record<string, any>
    institutional?: Array<{
      holder: string
      shares: number
      dateReported: string
      pctOut: number
      value: number
    }>
  }
  news?: Array<{
    title: string
    publisher: string
    link: string
    providerPublishTime: number
    type: string
  }>
  upgrades_downgrades?: Array<any>
  calendar?: Record<string, any>
  recommendations?: Record<string, any>
  sustainability?: Record<string, any>
  etf?: {
    expenseRatio?: number
    netAssets?: number
    inceptionDate?: string
    category?: string
    fundFamily?: string
    ytdReturn?: number
    threeYearAverageReturn?: number
    fiveYearAverageReturn?: number
    topHoldings?: Array<any>
  }
  mutualFund?: {
    expenseRatio?: number
    netAssets?: number
    inceptionDate?: string
    category?: string
    fundFamily?: string
    ytdReturn?: number
    threeYearAverageReturn?: number
    fiveYearAverageReturn?: number
  }
  crypto?: {
    marketCap?: number
    volume24Hr?: number
    circulatingSupply?: number
    maxSupply?: number
  }
}

export interface TickerInfo {
  symbol: string
  longName?: string
  shortName?: string
  exchange?: string
  valid: boolean
  error?: string
}

export interface SentimentAnalysis {
  ticker: string
  company_name: string
  analysis_timestamp: string
  sentiment_analysis: {
    executive_summary: string
    sentiment_analysis: string
    technical_outlook: string
    fundamental_assessment: string
    investment_recommendation: string
    full_analysis: string
  }
  metadata: Record<string, any>
  disclaimer: string
}

export interface PredictionResult {
  ticker: string
  company_name: string
  model_name: string
  forecast_dates: string[]
  forecast_prices: number[]
  confidence_lower: number[]
  confidence_upper: number[]
  metrics: Record<string, any>
}

/**
 * Simplified stock data service class
 * 
 * Note: Caching is now handled by React Query, so we only need the API calling functions
 */
class StockDataService {
  private baseUrl: string
  
  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ''
  }

  /**
   * Validate ticker symbol
   * Note: Caching handled by React Query
   */
  async validateTicker(ticker: string): Promise<boolean> {
    if (!ticker?.trim()) return false
    
    try {
      const response = await fetch(`${this.baseUrl}/financial/ticker/${encodeURIComponent(ticker)}`)
      
      if (response.ok) {
        const result = await response.json()
        // Additional validation - ensure it's not just echoing back unknown data
        return !!result?.symbol && 
               result.symbol === ticker.toUpperCase() && 
               result.exchange !== 'Unknown'
      }
      
      return false
    } catch (error) {
      console.error('Ticker validation error:', error)
      return false
    }
  }

  /**
   * Get ticker information
   * Note: Caching handled by React Query
   */
  async getTickerInfo(ticker: string): Promise<TickerInfo> {
    try {
      const response = await fetch(`${this.baseUrl}/financial/ticker/${encodeURIComponent(ticker)}`)
      
      if (!response.ok) {
        return {
          symbol: ticker.toUpperCase(),
          valid: false,
          error: `HTTP ${response.status}`
        }
      }
      
      const result = await response.json()
      return {
        symbol: result.symbol || ticker.toUpperCase(),
        longName: result.longName,
        shortName: result.shortName,
        exchange: result.exchange,
        valid: true
      }
    } catch (error) {
      console.error('Get ticker info error:', error)
      return {
        symbol: ticker.toUpperCase(),
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Fetch historical stock data
   * Note: Caching handled by React Query
   */
  async fetchStockData(ticker: string, period: string = '1y'): Promise<StockData> {
    
    const response = await fetch(
      `${this.baseUrl}/financial/history/${encodeURIComponent(ticker)}?period=${period}`
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }
    
    const result = await response.json()
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch stock data')
    }
    
    return result.data
  }

  /**
   * Fetch comprehensive stock summary
   * Note: Caching handled by React Query
   */
  async fetchStockSummary(ticker: string): Promise<StockSummary> {
    const response = await fetch(`${this.baseUrl}/financial/summary/${encodeURIComponent(ticker)}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch summary: HTTP ${response.status}`)
    }
    
    const result = await response.json()
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch stock summary')
    }
    
    return result.data
  }

  /**
   * Get sentiment analysis
   * Note: Caching handled by React Query
   */
  async fetchSentimentAnalysis(
    ticker: string, 
    period: string = '2y', 
    includePredictions: boolean = true
  ): Promise<SentimentAnalysis> {
    const params = new URLSearchParams({
      period,
      include_predictions: includePredictions.toString()
    })
    
    const response = await fetch(
      `${this.baseUrl}/financial/sentiment/${encodeURIComponent(ticker)}?${params}`
    )
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sentiment: HTTP ${response.status}`)
    }
    
    const result = await response.json()
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch sentiment analysis')
    }
    
    return result.data
  }

  /**
   * Get stock predictions
   * Note: Caching handled by React Query
   */
  async fetchPrediction(
    ticker: string,
    model: string = 'chronos-bolt-small',
    forecastDays: number = 30,
    period: string = '2y'
  ): Promise<PredictionResult> {
    const requestBody = {
      ticker,
      model,
      forecast_days: forecastDays,
      period
    }
    
    const response = await fetch(`${this.baseUrl}/financial/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch prediction: HTTP ${response.status}`)
    }
    
    const result = await response.json()
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch prediction')
    }
    
    return result.data
  }

  // Cache methods removed - React Query handles all caching automatically!
}

// Export singleton instance
export const stockDataService = new StockDataService()
export default stockDataService
