'use client'

import { Icon } from './Icon'
import { useSentimentPanel } from '../hooks/useSentimentPanel'

type Props = {
  symbol: string
}

export function SentimentPanel({ symbol }: Props) {
  const sentiment = useSentimentPanel()


  return (
    <div className="space-y-6">
      {/* Sentiment Configuration */}
      {symbol && (
        <div className="rounded-2xl p-4 bg-white/70 dark:bg-slate-900/70 shadow">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Analysis Period</label>
              <select
                value={sentiment.sentimentPeriod}
                onChange={(e) => sentiment.setSentimentPeriod(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40 focus:border-blue-400"
              >
                <option value="1y">1 Year</option>
                <option value="2y">2 Years (Recommended)</option>
                <option value="5y">5 Years</option>
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Longer periods provide more comprehensive analysis
              </p>
            </div>
            
            <button
              onClick={() => sentiment.fetchSentiment(symbol)}
              disabled={!symbol.trim() || sentiment.sentimentStatus === 'loading'}
              className="rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 active:from-purple-800 active:to-blue-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white px-6 py-3 font-medium whitespace-nowrap"
            >
              {sentiment.sentimentStatus === 'loading' 
                ? (<span className="inline-flex items-center gap-2"><Icon name="spinner" /> Analyzing...</span>) 
                : (<span className="inline-flex items-center gap-2"><Icon name="brain" /> Generate Analysis</span>)}
            </button>
          </div>
        </div>
      )}

      {/* Sentiment Analysis Display */}
      <div className="rounded-2xl p-6 bg-white/70 dark:bg-slate-900/70 shadow">
        {sentiment.sentimentStatus === 'idle' && (
          <div className="text-center p-12">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-purple-600/10 text-purple-600 dark:text-purple-400">
              <Icon name="brain" className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
              AI Investment Analysis
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Get comprehensive LLM-powered investment insights combining technical analysis, 
              market trends, and financial fundamentals.
            </p>
          </div>
        )}
        
        {sentiment.sentimentStatus === 'loading' && (
          <div className="text-center p-12">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-600/10 text-slate-600 dark:text-slate-300">
              <Icon name="spinner" className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Generating Analysis...
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              Our AI is analyzing market data, technical indicators, and financial metrics...
            </p>
          </div>
        )}
        
        {sentiment.sentimentStatus === 'error' && (
          <div className="text-center p-12">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-600/10 text-red-600 dark:text-red-400">
              <Icon name="alert" className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
              Analysis Failed
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              Unable to generate analysis. Please check your connection and try again.
            </p>
          </div>
        )}
        
        {sentiment.sentimentStatus === 'success' && sentiment.sentimentData && (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center pb-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-2xl font-semibold text-slate-800 dark:text-slate-200">
                AI Investment Analysis
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                {sentiment.sentimentData?.company_name} • Generated {new Date(sentiment.sentimentData?.analysis_timestamp || Date.now()).toLocaleDateString()}
              </p>
            </div>
            
            {/* Analysis Content */}
            {sentiment.sentimentData?.sentiment_analysis && (
              <div className="grid gap-6">
                {(() => {
                  const analysis = sentiment.sentimentData?.sentiment_analysis
                  if (!analysis) return null
                  
                  // Check if any analysis fields have actual content (not empty strings)
                  const hasContent = analysis.executive_summary?.trim() || 
                                   analysis.sentiment_analysis?.trim() || 
                                   analysis.technical_outlook?.trim() || 
                                   analysis.fundamental_assessment?.trim() || 
                                   analysis.investment_recommendation?.trim() ||
                                   analysis.full_analysis?.trim()
                  
                  // Check if content contains error messages
                  const allContent = [
                    analysis.executive_summary,
                    analysis.sentiment_analysis, 
                    analysis.technical_outlook,
                    analysis.fundamental_assessment,
                    analysis.investment_recommendation,
                    analysis.full_analysis
                  ].join(' ').toLowerCase()
                  
                  const containsError = allContent.includes('[error]') || 
                                      allContent.includes('rate-limited') ||
                                      allContent.includes('api error') ||
                                      allContent.includes('provider returned error') ||
                                      allContent.includes('temporarily unavailable')
                  
                  if (!hasContent) {
                    return (
                      <div className="p-6 rounded-lg bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 text-center">
                        <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">Analysis Not Available</h4>
                        <p className="text-slate-700 dark:text-slate-300">
                          AI analysis could not be generated for {sentiment.sentimentData.company_name || symbol}. 
                          This may occur with certain ETFs, international stocks, or due to insufficient data.
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                          Try a different ticker symbol or check back later.
                        </p>
                      </div>
                    )
                  }
                  
                  if (containsError) {
                    return (
                      <div className="p-6 rounded-lg bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-center">
                        <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">Analysis Service Temporarily Unavailable</h4>
                        <p className="text-slate-700 dark:text-slate-300">
                          The AI analysis service is currently experiencing high demand and is temporarily rate-limited.
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                          Please try again in a few minutes. The service typically becomes available again shortly.
                        </p>
                      </div>
                    )
                  }
                  
                  return (
                    <>
                      {/* Executive Summary */}
                      {analysis.executive_summary?.trim() && (
                        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500">
                          <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Executive Summary</h4>
                          <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {analysis.executive_summary}
                          </div>
                        </div>
                      )}
                      
                      {/* Sentiment Analysis */}
                      {analysis.sentiment_analysis?.trim() && (
                        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500">
                          <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">Market Sentiment</h4>
                          <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {analysis.sentiment_analysis}
                          </div>
                        </div>
                      )}
                      
                      {/* Technical Outlook */}
                      {analysis.technical_outlook?.trim() && (
                        <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500">
                          <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">Technical Analysis</h4>
                          <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {analysis.technical_outlook}
                          </div>
                        </div>
                      )}
                      
                      {/* Fundamental Assessment */}
                      {analysis.fundamental_assessment?.trim() && (
                        <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500">
                          <h4 className="font-semibold text-orange-800 dark:text-orange-300 mb-2">Fundamental Analysis</h4>
                          <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {analysis.fundamental_assessment}
                          </div>
                        </div>
                      )}
                      
                      {/* Investment Recommendation */}
                      {analysis.investment_recommendation?.trim() && (
                        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500">
                          <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">Investment Recommendation</h4>
                          <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {analysis.investment_recommendation}
                          </div>
                        </div>
                      )}
                      
                      {/* Full Analysis (fallback) */}
                      {!analysis.executive_summary?.trim() && !analysis.sentiment_analysis?.trim() && 
                       !analysis.technical_outlook?.trim() && !analysis.fundamental_assessment?.trim() && 
                       !analysis.investment_recommendation?.trim() && analysis.full_analysis?.trim() && (
                        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/20 border-l-4 border-slate-500">
                          <h4 className="font-semibold text-slate-800 dark:text-slate-300 mb-2">Investment Analysis</h4>
                          <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {analysis.full_analysis}
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
            
            
            {/* Disclaimer */}
            <div className="mt-8 p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-3">
                <Icon name="alert" className="h-5 w-5 mt-0.5 text-amber-600" />
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  <strong className="block text-slate-800 dark:text-slate-200 mb-1">Educational Use Only</strong>
                  This AI-generated analysis is for educational purposes only and not personalized investment advice. 
                  Markets are unpredictable - always conduct your own research and consult with financial professionals 
                  before making investment decisions.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}