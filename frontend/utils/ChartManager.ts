/**
 * Centralized Chart Management Utility
 * 
 * Consolidates all chart operations into a single, reusable class.
 * Replaces scattered chart logic across components with unified operations.
 */

import { SMA, RSI } from 'technicalindicators'
import type { HistoricalData } from '../services/stockDataService'

export type ChartTheme = 'light' | 'dark'

export interface ChartConfig {
  title: string
  height?: number
  showVolume?: boolean
  showPredictions?: boolean
  theme?: ChartTheme
  indicators?: {
    ma20?: boolean
    ma50?: boolean
    ma200?: boolean
    rsi?: boolean
  }
}

export interface PredictionData {
  forecast_dates: string[]
  forecast_prices: number[]
  confidence_upper?: number[]
  confidence_lower?: number[]
  model_name: string
}

export interface ChartState {
  isInitialized: boolean
  element: HTMLElement | null
  lastConfig: ChartConfig | null
}

export class ChartManager {
  private state: ChartState = {
    isInitialized: false,
    element: null,
    lastConfig: null
  }

  constructor(private element: HTMLElement) {
    this.state.element = element
  }

  /**
   * Create a candlestick chart with optional predictions
   */
  createCandlestickChart(
    data: HistoricalData[],
    config: ChartConfig,
    predictionData?: PredictionData
  ): boolean {
    const Plotly = (window as any).Plotly
    if (!Plotly || !this.state.element || !data.length) return false

    // Clean up any existing chart first
    this.cleanup()

    // Proper theme detection - check both config and DOM
    const isDark = config.theme === 'dark' || 
      (config.theme === 'light' ? false : document.documentElement.classList.contains('dark'))

    const traces: any[] = []
    
    // Main candlestick chart
    const candlestick:any = {
      x: data.map(d => d.timestamp),
      open: data.map(d => d.open),
      high: data.map(d => d.high),
      low: data.map(d => d.low),
      close: data.map(d => d.close),
      type: 'candlestick',
      name: 'Price',
      increasing: { 
        line: { color: '#16a34a', width: 1.5 },
        fillcolor: isDark ? '#16a34a' : '#dcfce7'
      },
      decreasing: { 
        line: { color: '#dc2626', width: 1.5 },
        fillcolor: isDark ? '#dc2626' : '#fef2f2'
      },
      xaxis: 'x',
      yaxis: 'y',
      showlegend: false, // Remove from legend
      hovertemplate: 'Time: %{x}<br>'+
        'O: $%{open:.2f}<br>H: $%{high:.2f}<br>L: $%{low:.2f}<br>C: $%{close:.2f}<extra></extra>'
    }
    traces.push(candlestick)

    // Indicators: moving averages using technicalindicators library
    const closes = data.map(d => d.close)
    const times = data.map(d => d.timestamp)
    const addMa = (period: number, color: string, label: string) => {
      const maValues = SMA.calculate({ period, values: closes })
      // Pad with nulls to align with original data length
      const paddedMa = Array(period - 1).fill(null).concat(maValues)
      
      traces.push({
        x: times,
        y: paddedMa,
        type: 'scatter',
        mode: 'lines',
        name: label,
        line: { color, width: 1.5 },
        xaxis: 'x', yaxis: 'y',
        hovertemplate: `${label}: $%{y:.2f}<extra></extra>`,
        showlegend: false
      })
    }
    if (config.indicators?.ma20) addMa(20, isDark ? '#38bdf8' : '#0284c7', 'MA20')
    if (config.indicators?.ma50) addMa(50, isDark ? '#f59e0b' : '#d97706', 'MA50')
    if (config.indicators?.ma200) addMa(200, isDark ? '#a78bfa' : '#7c3aed', 'MA200')

    // Add prediction traces if provided
    if (predictionData && config.showPredictions) {
      this._addPredictionTraces(traces, predictionData, isDark)
    }

    // Volume trace (if enabled) - positioned at bottom 20% of chart
    if (config.showVolume) {
      const volume = {
        x: data.map(d => d.timestamp),
        y: data.map(d => d.volume),
        type: 'bar',
        name: 'Volume',
        yaxis: 'y2',
        marker: {
          color: data.map((d, i) => {
            if (i === 0) return isDark ? '#16a34a' : '#22c55e' // Fix first tick color
            return d.close >= data[i-1].close 
              ? (isDark ? '#16a34a' : '#22c55e') 
              : (isDark ? '#dc2626' : '#ef4444')
          }),
          opacity: 0.5
        },
        hovertemplate: 'Vol: %{y:,.0f}<extra></extra>',
        showlegend: false // Remove from legend
      }
      traces.push(volume)
    }

    // RSI indicator (separate panel) using technicalindicators library
    if (config.indicators?.rsi) {
      const rsiValues = RSI.calculate({ period: 14, values: closes })
      // Pad with nulls to align with original data length
      const paddedRsi = Array(14).fill(null).concat(rsiValues)
      
      traces.push({
        x: times,
        y: paddedRsi,
        type: 'scatter',
        mode: 'lines',
        name: 'RSI(14)',
        line: { color: isDark ? '#f97316' : '#ea580c', width: 1 },
        yaxis: 'y3',
        hovertemplate: 'RSI: %{y:.1f}<extra></extra>',
        showlegend: false
      })
    }

    const layout = this._createLayout(config, isDark, data)

    const plotConfig = {
      responsive: true,
      displayModeBar: false,
      scrollZoom: false,
    }

    try {
      Plotly.newPlot(this.state.element, traces, layout, plotConfig)
      this.state.isInitialized = true
      this.state.lastConfig = config
      return true
    } catch (error) {
      console.error('Failed to create chart:', error)
      return false
    }
  }

  /**
   * Update existing chart with new data (more efficient than recreating)
   */
  updateChart(
    data: HistoricalData[],
    config: ChartConfig,
    predictionData?: PredictionData
  ): boolean {
    if (!this.state.isInitialized || !this.state.element) {
      return this.createCandlestickChart(data, config, predictionData)
    }

    const Plotly = (window as any).Plotly
    if (!Plotly || !data.length) return false

    try {
      // Update candlestick data
      const update = {
        x: [data.map(d => d.timestamp)],
        open: [data.map(d => d.open)],
        high: [data.map(d => d.high)],
        low: [data.map(d => d.low)],
        close: [data.map(d => d.close)],
      }

      // Update volume if enabled
      if (config.showVolume) {
        const isDark = config.theme === 'dark' || 
          (config.theme === 'light' ? false : document.documentElement.classList.contains('dark'))
        
        const volumeUpdate = {
          x: [data.map(d => d.timestamp)],
          y: [data.map(d => d.volume)],
          'marker.color': [data.map((d, i) => {
            if (i === 0) return isDark ? '#16a34a' : '#22c55e' // Fix first tick color
            return d.close >= data[i-1].close 
              ? (isDark ? '#16a34a' : '#22c55e') 
              : (isDark ? '#dc2626' : '#ef4444')
          })]
        }
        
        Plotly.restyle(this.state.element, update, [0])
        Plotly.restyle(this.state.element, volumeUpdate, [1])
      } else {
        Plotly.restyle(this.state.element, update, [0])
      }

      // Update title if needed
      if (config.title !== this.state.lastConfig?.title) {
        Plotly.relayout(this.state.element, { title: config.title })
      }

      // Handle prediction data updates
      if (predictionData && config.showPredictions) {
        // For predictions, it's often easier to recreate than update
        return this.createCandlestickChart(data, config, predictionData)
      }

      this.state.lastConfig = config
      return true
    } catch (error) {
      console.error('Failed to update chart:', error)
      // Fallback to recreating chart
      return this.createCandlestickChart(data, config, predictionData)
    }
  }

  /**
   * Clean up chart resources
   */
  cleanup(): void {
    const Plotly = (window as any).Plotly
    if (!Plotly || !this.state.element) return

    try {
      Plotly.purge(this.state.element)
      this.state.isInitialized = false
      this.state.lastConfig = null
    } catch (error) {
      console.error('Failed to cleanup chart:', error)
    }
  }

  /**
   * Get current chart state
   */
  getState(): ChartState {
    return { ...this.state }
  }

  /**
   * Add prediction traces to the chart
   */
  private _addPredictionTraces(traces: any[], predictionData: PredictionData, isDark: boolean) {
    // Forecast line
    const forecastTrace = {
      x: predictionData.forecast_dates,
      y: predictionData.forecast_prices,
      type: 'scatter',
      mode: 'lines+markers',
      name: `${predictionData.model_name} Forecast`,
      line: { 
        color: isDark ? '#8b5cf6' : '#7c3aed',
        width: 2,
        dash: 'dash'
      },
      marker: { 
        color: isDark ? '#8b5cf6' : '#7c3aed',
        size: 4 
      },
      hovertemplate: 'Predicted: $%{y:.2f}<br>%{x}<extra></extra>',
      showlegend: false // Remove from legend
    }
    traces.push(forecastTrace)

    // Confidence bands (if available)
    if (predictionData.confidence_upper && predictionData.confidence_lower) {
      const confidenceTrace = {
        x: [...predictionData.forecast_dates, ...predictionData.forecast_dates.slice().reverse()],
        y: [...predictionData.confidence_upper, ...predictionData.confidence_lower.slice().reverse()],
        fill: 'toself',
        fillcolor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(124, 58, 237, 0.1)',
        line: { color: 'transparent' },
        name: 'Confidence Interval',
        type: 'scatter',
        hoverinfo: 'skip',
        showlegend: false
      }
      traces.push(confidenceTrace)
    }
  }

  /**
   * Create chart layout configuration
   */
  private _createLayout(config: ChartConfig, isDark: boolean, data: HistoricalData[]) {
    const isWeeklyOrMonthly = this._isWeeklyOrMonthlyData(data)
    const wantRSI = !!config.indicators?.rsi
    const wantVol = !!config.showVolume
    // Domains
    let yDomain: [number, number] = [0, 1]
    let y2Domain: [number, number] | null = null
    let y3Domain: [number, number] | null = null
    if (wantVol && wantRSI) {
      yDomain = [0.45, 1]
      y2Domain = [0.25, 0.4]
      y3Domain = [0, 0.2]
    } else if (wantVol && !wantRSI) {
      yDomain = [0.35, 1]
      y2Domain = [0, 0.3]
    } else if (!wantVol && wantRSI) {
      yDomain = [0.35, 1]
      y3Domain = [0, 0.3]
    }
    
    return {
      title: {
        text: config.title,
        font: { 
          color: isDark ? '#f1f5f9' : '#334155',
          size: 16,
          family: 'Inter, sans-serif'
        },
        x: 0.02,
        xanchor: 'left'
      },
      height: config.height || 500,
      margin: { t: 60, r: 20, b: 60, l: 80 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { 
        color: isDark ? '#cbd5e1' : '#64748b',
        family: 'Inter, sans-serif'
      },
      xaxis: {
        type: 'date',
        gridcolor: isDark ? '#374151' : '#e2e8f0',
        tickcolor: isDark ? '#6b7280' : '#94a3b8',
        rangebreaks: [
          // Remove weekends for all daily data, but be careful with after-hours
          ...(data.length > 0 && !isWeeklyOrMonthly ? [
            { bounds: ["sat", "mon"] }, // Remove weekends for daily data
            // Only remove after-hours for intraday data (detected by interval)
            ...(this._isIntradayData(data) ? [
              { bounds: [16, 9.5], pattern: "hour" } // Remove after-hours for intraday only
            ] : [])
          ] : []),
        ]
      },
      yaxis: {
        title: 'Price ($)',
        side: 'left',
        domain: yDomain, // Adjust for volume/RSI
        gridcolor: isDark ? '#374151' : '#e2e8f0',
        tickcolor: isDark ? '#6b7280' : '#94a3b8',
        tickformat: '$.2f'
      },
      ...(y2Domain && {
        yaxis2: {
          title: 'Volume',
          side: 'left',
          domain: y2Domain,
          gridcolor: 'transparent',
          tickcolor: 'transparent', // Hide tick marks
          tickfont: { color: 'transparent' }, // Hide tick labels
          showticklabels: false // Completely hide tick labels
        }
      }),
      ...(y3Domain && {
        yaxis3: {
          title: 'RSI',
          side: 'left',
          domain: y3Domain,
          gridcolor: isDark ? '#374151' : '#e2e8f0',
          tickcolor: isDark ? '#6b7280' : '#94a3b8',
          tickfont: { color: isDark ? '#94a3b8' : '#64748b', size: 10 },
          range: [0, 100]
        }
      }),
      showlegend: false, // Remove legend completely
      hovermode: 'x unified',
      hoverlabel: {
        bgcolor: isDark ? '#1e293b' : '#ffffff',
        bordercolor: isDark ? '#475569' : '#d1d5db',
        font: {
          color: isDark ? '#f1f5f9' : '#0f172a'
        }
      },
      dragmode: false
    }
  }

  /**
   * Detect if data represents weekly or monthly intervals
   */
  private _isWeeklyOrMonthlyData(data: HistoricalData[]): boolean {
    if (data.length < 2) return false
    
    const firstDate = new Date(data[0].timestamp)
    const secondDate = new Date(data[1].timestamp)
    const timeDiff = Math.abs(secondDate.getTime() - firstDate.getTime())
    const dayInMs = 24 * 60 * 60 * 1000
    
    // If the interval between data points is 5+ days, consider it weekly/monthly data
    return timeDiff >= 5 * dayInMs
  }

  /**
   * Detect if data represents intraday intervals (minutes/hours)
   */
  private _isIntradayData(data: HistoricalData[]): boolean {
    if (data.length < 2) return false
    
    const firstDate = new Date(data[0].timestamp)
    const secondDate = new Date(data[1].timestamp)
    const timeDiff = Math.abs(secondDate.getTime() - firstDate.getTime())
    const hourInMs = 60 * 60 * 1000
    
    // If interval is less than 2 hours, it's intraday data
    return timeDiff < 2 * hourInMs
  }
}
