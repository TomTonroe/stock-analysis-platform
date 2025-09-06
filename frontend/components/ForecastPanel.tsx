'use client'

import { useEffect, useRef } from 'react'
import { Icon } from './Icon'
import { useForecastPanel } from '../hooks/useForecastPanel'
import { useChartManager } from '../hooks/useChartManager'
import { useTheme } from '../hooks/useTheme'
import type { HistoricalData } from '../hooks/useStockQueries'
import type { PredictionData } from '../utils/ChartManager'

type Props = {
  symbol: string
  currentData: HistoricalData[]
}

export function ForecastPanel({ symbol, currentData }: Props) {
  const predictions = useForecastPanel()
  const predictPlotRef = useRef<HTMLDivElement | null>(null)
  const { chartManager, isReady } = useChartManager(predictPlotRef)
  const isDarkMode = useTheme()

  // Theme detection is now handled by useTheme hook

  // Fetch available models on component mount
  useEffect(() => {
    predictions.fetchAvailableModels()
  }, [predictions.fetchAvailableModels])

  // Chart rendering for predictions
  useEffect(() => {
    if (!isReady || !chartManager || !currentData.length) return

    const drawPredictionChart = () => {
      // Prepare prediction data in the expected format
      let predictionData: PredictionData | undefined
      if (predictions.predictionData?.forecast_dates && predictions.predictionData?.forecast_prices) {
        predictionData = {
          forecast_dates: predictions.predictionData.forecast_dates,
          forecast_prices: predictions.predictionData.forecast_prices,
          confidence_upper: predictions.predictionData.confidence_upper,
          confidence_lower: predictions.predictionData.confidence_lower,
          model_name: predictions.availableModels[predictions.selectedModel]?.name || predictions.selectedModel
        }
      }

      const title = predictionData 
        ? `${symbol} - ${predictionData.model_name} Prediction (${predictions.forecastDays}d forecast)`
        : `${symbol} Price Forecast`

      // Use ChartManager for unified chart operations
      const chartState = chartManager.getState()
      if (chartState.isInitialized) {
        const success = chartManager.updateChart(currentData, {
          title,
          height: 560,
          showVolume: true,
          showPredictions: true,
          theme: isDarkMode ? 'dark' : 'light'
        }, predictionData)
        
        if (!success) {
          console.warn('Failed to update prediction chart for', symbol)
        }
      } else {
        const success = chartManager.createCandlestickChart(currentData, {
          title,
          height: 560,
          showVolume: true,
          showPredictions: true,
          theme: isDarkMode ? 'dark' : 'light'
        }, predictionData)
        
        if (!success) {
          console.warn('Failed to create prediction chart for', symbol)
        }
      }
    }

    drawPredictionChart()
  }, [currentData, symbol, predictions.predictionData, predictions.selectedModel, predictions.forecastDays, predictions.availableModels, isDarkMode, isReady, chartManager])

  // Cleanup is handled automatically by useChartManager

  return (
    <div className="space-y-6">
      {/* Prediction Configuration */}
      {symbol && (
        <div className="rounded-2xl p-4 bg-white/70 dark:bg-slate-900/70 shadow">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">AI Model</label>
              <select
                value={predictions.selectedModel}
                onChange={(e) => predictions.setSelectedModel(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40 focus:border-blue-400"
              >
                {Object.entries(predictions.availableModels).map(([key, model]) => (
                  <option key={key} value={key}>{model.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {predictions.availableModels[predictions.selectedModel]?.description}
              </p>
            </div>
            
            <div className="flex-1 min-w-32">
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Forecast Days</label>
              <select
                value={predictions.forecastDays}
                onChange={(e) => predictions.setForecastDays(parseInt(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40 focus:border-blue-400"
              >
                <option value={7}>1 Week</option>
                <option value={14}>2 Weeks</option>
                <option value={30}>1 Month</option>
                <option value={60}>2 Months</option>
                <option value={90}>3 Months</option>
              </select>
            </div>

            <button
              onClick={() => predictions.fetchPrediction(symbol)}
              disabled={!symbol.trim() || predictions.predictionStatus === 'loading'}
              className="rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white px-6 py-3 font-medium whitespace-nowrap"
            >
              {predictions.predictionStatus === 'loading' 
                ? (<span className="inline-flex items-center gap-2"><Icon name="spinner" /> Predicting...</span>) 
                : (<span className="inline-flex items-center gap-2"><Icon name="bolt" /> Run Forecast</span>)}
            </button>
          </div>
        </div>
      )}

      {/* Prediction Chart */}
      <div className="rounded-2xl p-2 bg-white/70 dark:bg-slate-900/70 shadow relative">
        <div ref={predictPlotRef} style={{height: 560}} />
        
        {predictions.predictionStatus === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 rounded-2xl">
            <div className="text-center p-8">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-purple-600/10 text-purple-600 dark:text-purple-400">
                <Icon name="bolt" className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
                AI Stock Forecasts
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-md">
                Configure your AI model and forecast period above, then click "Run Forecast" to generate future price predictions.
              </p>
            </div>
          </div>
        )}
        
        {predictions.predictionStatus === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 rounded-2xl">
            <div className="text-center p-8">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-600/10 text-slate-600 dark:text-slate-300">
                <Icon name="spinner" className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Running AI Prediction
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-md">
                {predictions.availableModels[predictions.selectedModel]?.name} is analyzing {symbol} and generating {predictions.forecastDays}-day predictions...
              </p>
            </div>
          </div>
        )}
        
        {predictions.predictionStatus === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 rounded-2xl">
            <div className="text-center p-8">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-600/10 text-red-600 dark:text-red-400">
                <Icon name="alert" className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Prediction Failed
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-md">
                Unable to generate predictions. Try a different model or forecast period.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Prediction Results */}
      {predictions.predictionStatus === 'success' && predictions.predictionData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl p-6 bg-white/70 dark:bg-slate-900/70 shadow">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 inline-flex items-center gap-2">
              <Icon name="chart" /> Prediction Results
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  ${predictions.predictionData.forecast_prices?.[predictions.predictionData.forecast_prices.length - 1]?.toFixed(2) || '—'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Target Price</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {predictions.predictionData.metrics?.accuracy ? `${predictions.predictionData.metrics.accuracy.toFixed(1)}%` : 
                   predictions.predictionData.metrics?.mape ? `${(100 - predictions.predictionData.metrics.mape).toFixed(1)}%` : '—'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Est. Accuracy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">
                  {predictions.forecastDays}d
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Forecast Period</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-purple-600 mb-1">
                  {predictions.availableModels[predictions.selectedModel]?.name.split(' ').pop() || '—'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">AI Model</div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2 inline-flex items-center gap-2"><Icon name="chart" className="h-4 w-4" /> Forecast Summary</h4>
              {predictions.predictionData.forecast_prices && predictions.predictionData.forecast_prices.length > 0 && (
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {(() => {
                    const firstPrice = predictions.predictionData.forecast_prices[0]
                    const lastPrice = predictions.predictionData.forecast_prices[predictions.predictionData.forecast_prices.length - 1]
                    const priceChange = lastPrice - firstPrice
                    const percentChange = (priceChange / firstPrice) * 100
                    return (
                      <p>
                        Expected to {percentChange >= 0 ? 'increase' : 'decrease'} by{' '}
                        <span className={`font-medium ${percentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${Math.abs(priceChange).toFixed(2)} ({Math.abs(percentChange).toFixed(1)}%)
                        </span>{' '}
                        over the next {predictions.forecastDays} days.
                      </p>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 inline-flex items-center gap-2">
              <Icon name="target" /> Key Metrics
            </h3>
            <div className="space-y-3 text-sm">
              {predictions.predictionData.metrics?.mae && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">MAE:</span>
                  <span className="font-medium">${predictions.predictionData.metrics.mae.toFixed(2)}</span>
                </div>
              )}
              {predictions.predictionData.metrics?.mape && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">MAPE:</span>
                  <span className="font-medium">{predictions.predictionData.metrics.mape.toFixed(1)}%</span>
                </div>
              )}
              {predictions.predictionData.metrics?.data_points && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Training Data:</span>
                  <span className="font-medium">{predictions.predictionData.metrics.data_points.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Model:</span>
                <span className="font-medium">{predictions.selectedModel}</span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="text-xs text-amber-800 dark:text-amber-200 inline-flex items-start gap-2">
                <Icon name="alert" className="h-4 w-4 mt-0.5" />
                <span>
                  <strong>Disclaimer:</strong> AI predictions are for educational purposes only. Not financial advice. Markets are unpredictable — always do your own research.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}