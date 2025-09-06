import { Icon } from './Icon'
import { fmtUsd, fmtMoney, fmtPct, fmtNum, formatDate, getSecurityTypeBadge, normalizeCalendarEvents } from '../utils'
import type { StockSummary } from '../services/stockDataService'

type Props = {
  summary: StockSummary
  ticker: string
}

export function CompanyInfoView({ summary, ticker }: Props) {
  return (
    <div className="space-y-6">
      {/* Company Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl p-6 bg-white/70 dark:bg-slate-900/70 shadow lg:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {summary?.company?.longName || ticker}
                </h1>
                {(() => {
                  const badge = getSecurityTypeBadge(summary?.securityType)
                  return (
                    <span className={badge.className}>
                      <Icon name="building" className="h-3.5 w-3.5" /> {badge.label}
                    </span>
                  )
                })()}
                {summary?.market?.country && (
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" title={`${summary.market.country} - ${summary.market.currency}`}>
                    {summary.market.country} • {summary.market.currency}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm mb-2">
                <span className="font-mono text-lg">{ticker}</span>
                <span>•</span>
                <span>{summary?.company?.exchange}</span>
                {summary?.market && (
                  <>
                    <span>•</span>
                    <span>{summary.market.market} ({summary.market.currency})</span>
                  </>
                )}
                {summary?.company?.sector && (
                  <>
                    <span>•</span>
                    <span>{summary.company.sector}</span>
                  </>
                )}
              </div>
              {summary?.company?.headquarters && (
                <div className="text-slate-500 dark:text-slate-400 text-sm mb-3 inline-flex items-center gap-2">
                  <Icon name="map-pin" className="h-4 w-4" /> {summary.company.headquarters}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {fmtUsd(summary?.price?.lastPrice || summary?.price?.previousClose)}
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-sm">Current Price</div>
            </div>
          </div>
          
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {summary?.company?.summary || 'No company description available.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            {summary?.company?.website && (
              <a href={summary.company.website} target="_blank" rel="noopener noreferrer" 
                 className="text-blue-600 hover:text-blue-700 text-sm inline-flex items-center gap-1">
                <Icon name="globe" className="h-4 w-4" /> Website
              </a>
            )}
            {summary?.company?.employees && (
              <span className="text-slate-500 dark:text-slate-400 text-sm inline-flex items-center gap-1">
                <Icon name="users" className="h-4 w-4" /> {summary.company.employees.toLocaleString()} employees
              </span>
            )}
            {summary?.analyst?.recommendationKey && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                summary.analyst.recommendationKey === 'buy' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                summary.analyst.recommendationKey === 'hold' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                summary.analyst.recommendationKey === 'sell' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
              }`}>
                {summary.analyst.recommendationKey.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
          <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">Company Snapshot</div>
          <Grid rows={[
            ['Industry', summary?.company?.industry],
            ['Country', summary?.company?.country],
            ['Currency', summary?.company?.currency],
            ['Exchange', summary?.company?.exchange],
          ]} />
        </div>
      </div>

      {/* Analyst Information (Stocks only) */}
      {summary?.securityType === 'stock' && summary?.analyst && (
        <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
          <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">Analyst Recommendations</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">
                {summary.analyst.recommendationKey?.toUpperCase() || '—'}
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-sm">Consensus Rating</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                {fmtUsd(summary.analyst.targetMeanPrice)}
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-sm">Price Target</div>
            </div>
            <div>
              <div className="text-lg text-slate-600 dark:text-slate-300 mb-1">
                {fmtUsd(summary.analyst.targetLowPrice)} - {fmtUsd(summary.analyst.targetHighPrice)}
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-sm">Target Range</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">
                {summary.analyst.numberOfAnalystOpinions || '—'}
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-sm">Analysts</div>
            </div>
          </div>
        </div>
      )}

      {/* Events (Upcoming only) */}
      {summary?.calendar && (
        <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
          <div className="text-slate-500 dark:text-slate-400 mb-4 font-medium">Upcoming Events</div>
          <EventsList calendar={summary.calendar} />
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
          <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">Valuation</div>
          <Grid rows={[
            ['Market Cap', fmtMoney(summary?.metrics?.marketCap)],
            ['Enterprise Value', fmtMoney(summary?.metrics?.enterpriseValue)],
            ['P/E (TTM)', fmtNum(summary?.metrics?.trailingPE)],
            ['P/E (Forward)', fmtNum(summary?.metrics?.forwardPE)],
            ['P/B Ratio', fmtNum(summary?.metrics?.priceToBook)],
            ['PEG Ratio', fmtNum(summary?.metrics?.pegRatio)],
            ['P/S Ratio', fmtNum(summary?.financial?.priceToSalesTrailing12Months)],
            ['EV/Revenue', fmtNum(summary?.financial?.enterpriseToRevenue)],
          ]} />
        </div>

        <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
          <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">Price & Volume</div>
          <Grid rows={[
            ['Previous Close', fmtUsd(summary?.price?.previousClose)],
            ['Day Range', summary?.price?.dayLow && summary?.price?.dayHigh ? `${fmtUsd(summary.price.dayLow)} - ${fmtUsd(summary.price.dayHigh)}` : '—'],
            ['52W Range', summary?.price?.fiftyTwoWeekLow && summary?.price?.fiftyTwoWeekHigh ? `${fmtUsd(summary.price.fiftyTwoWeekLow)} - ${fmtUsd(summary.price.fiftyTwoWeekHigh)}` : '—'],
            ['Volume', fmtNum(summary?.price?.volume)],
            ['Avg Volume', fmtNum(summary?.price?.avgVolume)],
            ['50D Average', fmtUsd(summary?.price?.fiftyDayAverage)],
            ['200D Average', fmtUsd(summary?.price?.twoHundredDayAverage)],
            ['Beta', fmtNum(summary?.metrics?.beta)],
          ]} />
        </div>

        <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
          <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">Financial Health</div>
          <Grid rows={[
            ['Total Revenue', fmtMoney(summary?.financial?.totalRevenue)],
            ['Total Cash', fmtMoney(summary?.financial?.totalCash)],
            ['Total Debt', fmtMoney(summary?.financial?.totalDebt)],
            ['Current Ratio', fmtNum(summary?.metrics?.currentRatio)],
            ['Quick Ratio', fmtNum(summary?.metrics?.quickRatio)],
            ['Debt/Equity', fmtNum(summary?.metrics?.debtToEquity)],
            ['ROE', fmtPct(summary?.metrics?.returnOnEquity)],
            ['ROA', fmtPct(summary?.metrics?.returnOnAssets)],
          ]} />
        </div>

        <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
          <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">Profitability</div>
          <Grid rows={[
            ['Profit Margins', fmtPct(summary?.metrics?.profitMargins)],
            ['Gross Margins', fmtPct(summary?.metrics?.grossMargins)],
            ['Operating Margins', fmtPct(summary?.metrics?.operatingMargins)],
            ['Revenue Growth', fmtPct(summary?.metrics?.revenueGrowth)],
            ['Earnings Growth', fmtPct(summary?.metrics?.earningsGrowth)],
            ['Forward EPS', fmtUsd(summary?.earnings?.forwardEps)],
            ['Trailing EPS', fmtUsd(summary?.earnings?.trailingEps)],
            ['Book Value', fmtUsd(summary?.financial?.bookValue)],
          ]} />
        </div>

        {/* Analyst Targets */}
        {(summary?.analyst?.targetLowPrice || summary?.analyst?.targetMeanPrice || summary?.analyst?.targetHighPrice) && (
          <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
            <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">Analyst Targets</div>
            <Grid rows={[
              ['Low', fmtUsd(summary?.analyst?.targetLowPrice)],
              ['Mean', fmtUsd(summary?.analyst?.targetMeanPrice)],
              ['High', fmtUsd(summary?.analyst?.targetHighPrice)],
              ['Rec. Mean', fmtNum(summary?.analyst?.recommendationMean)],
            ]} />
          </div>
        )}

        {/* Upcoming Events */}
        <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
          <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">Upcoming Events</div>
          <EventsList calendar={summary?.calendar || {}} />
        </div>
      </div>

      {/* ETF-Specific Information */}
      {summary?.securityType === 'etf' && summary?.etf && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
            <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">ETF Basics</div>
            <Grid rows={[
              ['Expense Ratio', summary.etf.expenseRatio ? fmtPct(summary.etf.expenseRatio / 100) : '—'],
              ['Net Assets', fmtMoney(summary.etf.netAssets)],
              ['Fund Family', summary.etf.fundFamily || '—'],
              ['Category', summary.etf.category || '—'],
              ['Inception Date', formatDate(summary.etf.inceptionDate)],
            ]} />
          </div>

          <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
            <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">Performance</div>
            <Grid rows={[
              ['YTD Return', fmtPct(summary.etf.ytdReturn)],
              ['3Y Avg Return', fmtPct(summary.etf.threeYearAverageReturn)],
              ['5Y Avg Return', fmtPct(summary.etf.fiveYearAverageReturn)],
            ]} />
          </div>

          <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
            <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">Fund Details</div>
            {summary.etf.topHoldings && summary.etf.topHoldings.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm text-slate-600 dark:text-slate-300 mb-2">Top Holdings:</div>
                {summary.etf.topHoldings.slice(0, 5).map((holding: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-200">{holding.symbol || holding.holdingName}</span>
                    <span className="text-slate-500 dark:text-slate-400">{fmtPct(holding.holdingPercent / 100)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 dark:text-slate-400 text-sm">Holdings data not available</div>
            )}
          </div>
        </div>
      )}

      {/* Crypto-Specific Information */}
      {summary?.securityType === 'crypto' && summary?.crypto && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
            <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">Crypto Metrics</div>
            <Grid rows={[
              ['Market Cap', fmtMoney(summary.crypto.marketCap)],
              ['24hr Volume', fmtMoney(summary.crypto.volume24Hr)],
              ['Circulating Supply', fmtNum(summary.crypto.circulatingSupply)],
              ['Max Supply', summary.crypto.maxSupply ? fmtNum(summary.crypto.maxSupply) : 'Unlimited'],
            ]} />
          </div>
          <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
            <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">Supply Info</div>
            <div className="space-y-3">
              {summary.crypto.maxSupply && summary.crypto.circulatingSupply && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Supply Progress</span>
                    <span>{fmtPct(summary.crypto.circulatingSupply / summary.crypto.maxSupply)}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{width: `${(summary.crypto.circulatingSupply / summary.crypto.maxSupply) * 100}%`}}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mutual Fund-Specific Information */}
      {summary?.securityType === 'mutual_fund' && summary?.mutualFund && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
            <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">Fund Basics</div>
            <Grid rows={[
              ['Expense Ratio', summary.mutualFund.expenseRatio ? fmtPct(summary.mutualFund.expenseRatio / 100) : '—'],
              ['Net Assets', fmtMoney(summary.mutualFund.netAssets)],
              ['Fund Family', summary.mutualFund.fundFamily || '—'],
              ['Category', summary.mutualFund.category || '—'],
              ['Inception Date', formatDate(summary.mutualFund.inceptionDate)],
            ]} />
          </div>
          <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
            <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">Performance</div>
            <Grid rows={[
              ['YTD Return', fmtPct(summary.mutualFund.ytdReturn)],
              ['3Y Avg Return', fmtPct(summary.mutualFund.threeYearAverageReturn)],
              ['5Y Avg Return', fmtPct(summary.mutualFund.fiveYearAverageReturn)],
            ]} />
          </div>
        </div>
      )}

      {/* Shares & Ownership (Stocks and ETFs only) */}
      {(summary?.securityType === 'stock' || summary?.securityType === 'etf') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
            <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">Share Information</div>
            <Grid rows={[
              ['Shares Outstanding', fmtNum(summary?.shares?.sharesOutstanding)],
              ['Float', fmtNum(summary?.shares?.floatShares)],
              ['Held by Insiders', fmtPct(summary?.shares?.heldByInsiders)],
              ['Held by Institutions', fmtPct(summary?.shares?.heldByInstitutions)],
              ...(summary?.securityType === 'stock' ? [
                ['Short Ratio', fmtNum(summary?.shares?.shortRatio)] as [string, string | number | null | undefined],
                ['Short % of Float', fmtPct(summary?.shares?.shortPercentOfFloat)] as [string, string | number | null | undefined],
              ] : [])
            ]} />
          </div>

          <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
            <div className="text-slate-500 dark:text-slate-400 mb-3 font-medium">
              {summary?.securityType === 'etf' ? 'Distributions & Splits' : 'Dividends & Splits'}
            </div>
            <Grid rows={[
              [summary?.securityType === 'etf' ? 'Distribution Rate' : 'Dividend Rate', fmtUsd(summary?.dividends?.dividendRate)],
              [summary?.securityType === 'etf' ? 'Distribution Yield' : 'Dividend Yield', fmtPct(summary?.dividends?.dividendYield)],
              ['Payout Ratio', fmtPct(summary?.dividends?.payoutRatio)],
              ['5Y Avg Yield', fmtPct(summary?.dividends?.fiveYearAvgDividendYield)],
              ['Ex-Dividend Date', formatDate(summary?.dividends?.exDividendDate)],
              ['Last Split Date', formatDate(summary?.splits?.lastSplitDate)],
            ]} />
          </div>
        </div>
      )}

      {/* News */}
      {summary?.news && summary.news.length > 0 && (
        <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
          <div className="text-slate-500 dark:text-slate-400 mb-4 font-medium">Latest News</div>
          <div className="space-y-4">
            {summary.news.slice(0, 5).map((article, i) => (
              <div key={i} className="border-b border-slate-200 dark:border-slate-700 last:border-0 pb-4 last:pb-0">
                <a href={article.link} target="_blank" rel="noopener noreferrer" 
                   className="block hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg p-2 -m-2 transition-colors">
                  <h3 className="font-medium text-slate-800 dark:text-slate-100 mb-1 hover:text-blue-600">
                    {article.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <span>{article.publisher}</span>
                    <span>•</span>
                    <span>{formatDate(article.providerPublishTime * 1000)}</span>
                    {article.type && (
                      <>
                        <span>•</span>
                        <span className="capitalize">{article.type}</span>
                      </>
                    )}
                  </div>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Institutional Holders (Stocks and ETFs only) */}
      {(summary?.securityType === 'stock' || summary?.securityType === 'etf') && summary?.holders?.institutional && summary.holders.institutional.length > 0 && (
        <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
          <div className="text-slate-500 dark:text-slate-400 mb-4 font-medium">
            {summary?.securityType === 'etf' ? 'Top Institutional Holders' : 'Top Institutional Holders'}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 text-slate-500 dark:text-slate-400 font-medium">Institution</th>
                  <th className="text-right py-2 text-slate-500 dark:text-slate-400 font-medium">Shares</th>
                  <th className="text-right py-2 text-slate-500 dark:text-slate-400 font-medium">% Out</th>
                  <th className="text-right py-2 text-slate-500 dark:text-slate-400 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {summary.holders.institutional.slice(0, 10).map((holder, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <td className="py-2 text-slate-800 dark:text-slate-100">{holder.holder}</td>
                    <td className="py-2 text-right text-slate-600 dark:text-slate-300">{fmtNum(holder.shares)}</td>
                    <td className="py-2 text-right text-slate-600 dark:text-slate-300">{fmtPct(holder.pctOut / 100)}</td>
                    <td className="py-2 text-right text-slate-600 dark:text-slate-300">{fmtMoney(holder.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Grid({ rows }: { rows: [string, string | number | null | undefined][] }) {
  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      {rows.map(([k, v]) => (
        <div key={k}><div className="text-slate-400">{k}</div><div className="text-slate-800 dark:text-slate-200">{v ?? '—'}</div></div>
      ))}
    </div>
  )
}

function EventsList({ calendar }: { calendar: { earnings?: any; dividends?: any; exDividend?: any } }) {
  const upcoming = normalizeCalendarEvents(calendar)

  if (upcoming.length === 0) {
    return <div className="text-slate-500 dark:text-slate-400 text-sm">No event data available</div>
  }
  return (
    <ul className="space-y-2">
      {upcoming.map((e, i) => (
        <li key={i} className="flex items-start gap-3 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60">
          <span className="text-lg leading-5"><Icon name={e.icon as any} className="h-4 w-4" /></span>
          <div>
            <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{e.title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{(e.dt as Date).toLocaleDateString()}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}
