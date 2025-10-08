'use client'

import type { RefObject } from 'react'
import { Icon } from './Icon'

type Props = {
  ticker: string
  inputValue: string
  onInputChange: (v: string) => void
  onSearch: () => void
  watchlist: string[]
  onSelectTicker: (t: string) => void
  onRemoveTicker: (t: string) => void
  isStarred: boolean
  onToggleStar: () => void
  inputRef?: RefObject<HTMLInputElement>
}

export function TopBar({
  ticker,
  inputValue,
  onInputChange,
  onSearch,
  watchlist,
  onSelectTicker,
  onRemoveTicker,
  isStarred,
  onToggleStar,
  inputRef,
}: Props) {
  return (
    <div className="rounded-2xl p-4 sm:p-5 bg-white/70 dark:bg-slate-900/70 shadow space-y-3">
      {/* Search */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-stretch">
          <div className="relative flex-1">
            <Icon name="search" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSearch()
              }}
              placeholder="Search ticker (e.g., AAPL, MSFT, SPY, BTC-USD)"
              className="w-full rounded-l-xl rounded-r-none border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40 focus:border-blue-400"
            />
          </div>
          <button
            onClick={onSearch}
            disabled={!inputValue.trim()}
            className="-ml-px rounded-r-xl rounded-l-none bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white px-4 py-2 text-sm font-medium whitespace-nowrap"
          >
            Search
          </button>
        </div>
        {/* Star current ticker */}
        <button
          onClick={onToggleStar}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${
            isStarred
              ? 'bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-300'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          aria-pressed={isStarred}
          title={isStarred ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          <Icon name="star" className={`h-4 w-4 ${isStarred ? 'text-yellow-500' : 'text-slate-500'}`} />
          <span className="hidden sm:inline">{isStarred ? 'Starred' : 'Star'}</span>
        </button>
      </div>

      {/* Watchlist */}
      <div className="space-y-1">
        <div className="text-xs text-slate-500 dark:text-slate-400">Watchlist</div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {watchlist.length === 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400">No tickers yet — use the star to add {ticker || 'a ticker'}.</span>
          )}
          {watchlist.map((w) => (
            <div
              key={w}
              className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border whitespace-nowrap ${
                w === ticker
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
              }`}
              title={w}
            >
              <button onClick={() => onSelectTicker(w)} className="font-mono text-xs">{w}</button>
              <button onClick={() => onRemoveTicker(w)} className="text-xs opacity-70 hover:opacity-100" aria-label={`Remove ${w}`}>
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
