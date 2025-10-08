'use client'

import { Icon } from './Icon'
import { useState } from 'react'
import { SentimentChatPanel } from './SentimentChatPanel'
import { useSentimentPanel } from '../hooks/useSentimentPanel'

type Props = {
  symbol: string
}

export function SentimentPanel({ symbol }: Props) {
  const sentiment = useSentimentPanel()
  const [isChatOpen, setIsChatOpen] = useState(false)


  return (
    <div className="space-y-6">
      {/* Sentiment Action */}
      {symbol && (
        <div className="rounded-2xl p-4 bg-white/70 dark:bg-slate-900/70 shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Generate a fresh AI investment analysis for <strong>{symbol.toUpperCase()}</strong>.
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
            {/* Overview */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/60 dark:bg-slate-900/60">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-800 dark:text-slate-200">
                    {sentiment.sentimentData.company_name} <span className="text-slate-400">({sentiment.sentimentData.ticker})</span>
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Analyzed {new Date(sentiment.sentimentData?.analysis_timestamp || Date.now()).toLocaleString()} • Model: {sentiment.sentimentData?.metadata?.llm_model || 'N/A'}
                  </div>
                </div>
                {(() => {
                  const analysis = sentiment.sentimentData?.sentiment_analysis
                  const sa = typeof analysis?.sentiment_analysis === 'object' ? analysis.sentiment_analysis : undefined
                  const label = sa?.label as string | undefined
                  const confidence = typeof sa?.confidence === 'number' ? sa.confidence : undefined
                  return (
                    <div className="flex items-center gap-3">
                      {label && (
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                          label === 'BULLISH' ? 'bg-green-600 text-white' :
                          label === 'BEARISH' ? 'bg-red-600 text-white' :
                          'bg-gray-600 text-white'
                        }`}>
                          {label}
                        </span>
                      )}
                      {typeof confidence === 'number' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600 dark:text-slate-300">Confidence</span>
                          <div className="w-36 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div className="bg-slate-900 dark:bg-slate-100 h-2 rounded-full" style={{ width: `${Math.round(confidence * 100)}%` }} />
                          </div>
                          <span className="text-xs text-slate-600 dark:text-slate-300">{Math.round(confidence * 100)}%</span>
                        </div>
                      )}
                      <button
                        onClick={() => setIsChatOpen(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm"
                      >
                        <Icon name="message-square" className="h-4 w-4" /> Chat
                      </button>
                    </div>
                  )
                })()}
              </div>
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
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60">
                          <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Executive Summary</h4>
                          <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {analysis.executive_summary}
                          </div>
                        </div>
                      )}
                      {/* Sentiment + Technical (2-col) */}
                      <div className="grid md:grid-cols-2 gap-4">
                      {(typeof analysis.sentiment_analysis === 'string' ? analysis.sentiment_analysis?.trim() : analysis.sentiment_analysis?.full_text?.trim()) && (
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60">
                          <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">
                            Market Sentiment
                            {analysis.sentiment_analysis?.label && (
                              <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${
                                analysis.sentiment_analysis.label === 'BULLISH' ? 'bg-green-200 text-green-800' :
                                analysis.sentiment_analysis.label === 'BEARISH' ? 'bg-red-200 text-red-800' :
                                'bg-gray-200 text-gray-800'
                              }`}>
                                {analysis.sentiment_analysis.label}
                                {analysis.sentiment_analysis.confidence && ` (${Math.round(analysis.sentiment_analysis.confidence * 100)}%)`}
                              </span>
                            )}
                          </h4>
                          <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {typeof analysis.sentiment_analysis === 'string' ? analysis.sentiment_analysis : analysis.sentiment_analysis?.full_text}
                          </div>
                          {analysis.sentiment_analysis?.drivers && analysis.sentiment_analysis.drivers.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                              <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">Key Drivers:</p>
                              <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-300 space-y-1">
                                {analysis.sentiment_analysis.drivers.map((driver: string, idx: number) => (
                                  <li key={idx}>{driver}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Technical Outlook */}
                      {analysis.technical_outlook?.trim() && (
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60">
                          <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">Technical Analysis</h4>
                          <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {analysis.technical_outlook}
                          </div>
                        </div>
                      )}
                      </div>
                      {/* Fundamental + Recommendation (2-col) */}
                      <div className="grid md:grid-cols-2 gap-4">
                      {analysis.fundamental_assessment?.trim() && (
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60">
                          <h4 className="font-semibold text-orange-800 dark:text-orange-300 mb-2">Fundamental Analysis</h4>
                          <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {analysis.fundamental_assessment}
                          </div>
                        </div>
                      )}
                      
                      {/* Investment Recommendation */}
                      {(typeof analysis.investment_recommendation === 'string' ? analysis.investment_recommendation?.trim() : analysis.investment_recommendation?.action) && (
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60">
                          <h4 className="font-semibold text-indigo-800 dark:text-indigo-300 mb-2">
                            Investment Recommendation
                            {analysis.investment_recommendation?.action && (
                              <span className={`ml-2 px-3 py-1 rounded-lg text-sm font-bold ${
                                analysis.investment_recommendation.action === 'BUY' ? 'bg-green-500 text-white' :
                                analysis.investment_recommendation.action === 'SELL' ? 'bg-red-500 text-white' :
                                analysis.investment_recommendation.action === 'HOLD' ? 'bg-yellow-500 text-white' :
                                'bg-blue-500 text-white'
                              }`}>
                                {analysis.investment_recommendation.action}
                              </span>
                            )}
                            {analysis.investment_recommendation?.time_horizon && (
                              <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400">
                                {analysis.investment_recommendation.time_horizon.replace('_', ' ')}
                              </span>
                            )}
                          </h4>
                          <div className="text-slate-700 dark:text-slate-300 space-y-3">
                            {typeof analysis.investment_recommendation === 'string' ? (
                              <div className="whitespace-pre-wrap">{analysis.investment_recommendation}</div>
                            ) : (
                              <>
                                {analysis.investment_recommendation?.rationale && (
                                  <div>
                                    <p className="font-semibold text-sm text-indigo-800 dark:text-indigo-300 mb-1">Rationale:</p>
                                    <p className="text-sm">{analysis.investment_recommendation.rationale}</p>
                                  </div>
                                )}
                                {analysis.investment_recommendation?.confidence && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="font-semibold text-indigo-800 dark:text-indigo-300">Confidence:</span>
                                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2 max-w-xs">
                                      <div
                                        className="bg-indigo-600 h-2 rounded-full transition-all"
                                        style={{ width: `${analysis.investment_recommendation.confidence * 100}%` }}
                                      />
                                    </div>
                                    <span>{Math.round(analysis.investment_recommendation.confidence * 100)}%</span>
                                  </div>
                                )}
                                {analysis.investment_recommendation?.entry_considerations && (
                                  <div className="text-sm">
                                    <p className="font-semibold text-green-700 dark:text-green-400">Entry Considerations:</p>
                                    <p className="text-slate-600 dark:text-slate-400">{analysis.investment_recommendation.entry_considerations}</p>
                                  </div>
                                )}
                                {analysis.investment_recommendation?.exit_considerations && (
                                  <div className="text-sm">
                                    <p className="font-semibold text-red-700 dark:text-red-400">Exit Considerations:</p>
                                    <p className="text-slate-600 dark:text-slate-400">{analysis.investment_recommendation.exit_considerations}</p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      </div>

                      {/* Risk Factors - Access from top level, not sentiment_analysis */}
                      <div className="grid md:grid-cols-2 gap-4">
                      {sentiment.sentimentData?.risks && sentiment.sentimentData.risks.length > 0 && (
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60">
                          <h4 className="font-semibold text-red-800 dark:text-red-300 mb-3">Risk Factors</h4>
                          <div className="space-y-3">
                            {sentiment.sentimentData.risks.map((risk: any, idx: number) => (
                              <div key={idx} className="flex gap-3 text-sm">
                                <div className={`px-2 py-1 rounded text-xs font-bold h-fit whitespace-nowrap ${
                                  risk.severity === 'HIGH' ? 'bg-red-200 text-red-900' :
                                  risk.severity === 'MEDIUM' ? 'bg-orange-200 text-orange-900' :
                                  'bg-yellow-200 text-yellow-900'
                                }`}>
                                  {risk.severity}
                                </div>
                                <div className="flex-1">
                                  <span className="font-semibold text-red-900 dark:text-red-200">{risk.category}:</span>
                                  <span className="text-slate-700 dark:text-slate-300 ml-1">{risk.description}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Catalysts - Access from top level, not sentiment_analysis */}
                      {sentiment.sentimentData?.catalysts && sentiment.sentimentData.catalysts.length > 0 && (
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60">
                          <h4 className="font-semibold text-cyan-800 dark:text-cyan-300 mb-3">Potential Catalysts</h4>
                          <div className="space-y-3">
                            {sentiment.sentimentData.catalysts.map((catalyst: any, idx: number) => (
                              <div key={idx} className="flex gap-3 text-sm">
                                <div className={`px-2 py-1 rounded text-xs font-bold h-fit whitespace-nowrap ${
                                  catalyst.potential_impact === 'POSITIVE' ? 'bg-green-200 text-green-900' :
                                  catalyst.potential_impact === 'NEGATIVE' ? 'bg-red-200 text-red-900' :
                                  'bg-gray-200 text-gray-900'
                                }`}>
                                  {catalyst.potential_impact}
                                </div>
                                <div className="flex-1">
                                  <p className="font-semibold text-cyan-900 dark:text-cyan-200">{catalyst.event}</p>
                                  {catalyst.expected_timing && (
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Expected: {catalyst.expected_timing}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      </div>

                      {/* News Context - Access from top level, not sentiment_analysis */}
                      <div className="grid md:grid-cols-2 gap-4">
                      {sentiment.sentimentData?.news_context && sentiment.sentimentData.news_context.length > 0 && (
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60">
                          <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-1">Recent Company News</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Headlines related to this company from finance-focused sources.</p>
                          <div className="space-y-2">
                            {sentiment.sentimentData.news_context.slice(0, 5).map((headline: any, idx: number) => (
                              <div key={idx} className="text-sm">
                                {headline.url ? (
                                  <a href={headline.url} target="_blank" rel="noopener noreferrer" className="text-slate-800 dark:text-slate-200 font-medium underline-offset-2 hover:underline">
                                    {headline.title}
                                  </a>
                                ) : (
                                  <p className="text-slate-800 dark:text-slate-200 font-medium">{headline.title}</p>
                                )}
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  {headline.source && `${headline.source} • `}
                                  {headline.published_at && new Date(headline.published_at).toLocaleDateString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Macro News Context */}
                      {sentiment.sentimentData?.macro_context && sentiment.sentimentData.macro_context.length > 0 && (
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60">
                          <h4 className="font-semibold text-slate-800 dark:text-slate-300 mb-1">Recent Market/Macro News</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Broader market and economic headlines that may influence the sector.</p>
                          <div className="space-y-2">
                            {sentiment.sentimentData.macro_context.slice(0, 5).map((headline: any, idx: number) => (
                              <div key={idx} className="text-sm">
                                {headline.url ? (
                                  <a href={headline.url} target="_blank" rel="noopener noreferrer" className="text-slate-800 dark:text-slate-200 font-medium underline-offset-2 hover:underline">
                                    {headline.title}
                                  </a>
                                ) : (
                                  <p className="text-slate-800 dark:text-slate-200 font-medium">{headline.title}</p>
                                )}
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  {headline.source && `${headline.source} • `}
                                  {headline.published_at && new Date(headline.published_at).toLocaleDateString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      </div>

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
      {isChatOpen && sentiment.sentimentData && (
        <SentimentChatPanel
          ticker={symbol}
          period="1y"
          sentimentAnalysisId={sentiment.sentimentData?.metadata?.analysis_id}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </div>
  )
}
