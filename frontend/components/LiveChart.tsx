'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useChartManager } from '../hooks/useChartManager'
import { useTheme } from '../hooks/useTheme'
import stockDataService from '../services/stockDataService'

// Declarative market session configs (UTC offsets ignore DST for simplicity)
type MarketConfig = { name: string; test: (sym: string) => boolean; offset: number; start: number; end: number }
const MARKET_CONFIGS: MarketConfig[] = [
  // Australia (ASX)
  { name: 'AU', test: (s) => s.endsWith('.AX'), offset: 10, start: 10, end: 16 },
  // Canada (TSX)
  { name: 'CA', test: (s) => s.endsWith('.TO'), offset: -5, start: 9.5, end: 16 },
  // United Kingdom (LSE)
  { name: 'UK', test: (s) => s.endsWith('.L'), offset: 0, start: 8, end: 16.5 },
  // Default to US (NYSE/NASDAQ)
  { name: 'US', test: (_) => true, offset: -5, start: 9.5, end: 16 },
]

type Props = { ticker: string; onTickerChange?: (t: string) => void }
type Tick = { open:number; high:number; low:number; close:number; volume:number; change:number; change_percent:number; timestamp:string; candle_start?:string }

export function LiveChart({ ticker, onTickerChange }: Props) {
  const [status, setStatus] = useState<'idle'|'connecting'|'connected'|'disconnected'|'error'|'streaming_unavailable'>('idle')
  const [last, setLast] = useState<Tick | null>(null)
  const [mounted, setMounted] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const plotRef = useRef<HTMLDivElement | null>(null)
  const { chartManager, isReady } = useChartManager(plotRef)
  const isDarkMode = useTheme()
  const initializedRef = useRef(false)
  const wsRef = useRef<WebSocket | null>(null)
  // Live candlestick data (aggregated per PERIOD_SECONDS)
  const dataRef = useRef({ 
    // Candle arrays
    timestamps: [] as Date[],
    open: [] as number[],
    high: [] as number[],
    low: [] as number[],
    close: [] as number[],
    volumes: [] as number[],  // Period volume (derived from cumulative)
    // Derived helpers
    changes: [] as number[],  // change percent for last tick in candle (used for colors)
    // For tracking
    keys: [] as string[], 
    idx: new Map<string,number>(), 
    max: 200,  // keep more candles
    lastCumulativeVolume: 0  // Track previous cumulative to calculate period volume
  })
  const [periodSeconds, setPeriodSeconds] = useState<number>(30)  // Default 30-second candlesticks
  const chartInitedRef = useRef(false)

  // Persist candle duration
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('liveCandleSeconds')
    if (saved) setPeriodSeconds(parseInt(saved, 10) || 30)
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('liveCandleSeconds', String(periodSeconds))
  }, [periodSeconds])

  useEffect(() => { setMounted(true) }, [])
  

  function wsUrl(sym: string) {
    const base = process.env.NEXT_PUBLIC_WS_BASE_URL || (location.protocol === 'https:' ? `wss://${location.host}` : `ws://${location.host}`)
    return `${base}/ws/${encodeURIComponent(sym)}`
  }

  // Use unified service for ticker validation
  async function validate(sym: string) {
    return await stockDataService.validateTicker(sym)
  }

  function getMarketDayRange(symbol: string): [number, number] {
    // Compute trading day window purely in UTC to avoid host local time issues.
    const cfg = MARKET_CONFIGS.find(c => c.test(symbol)) as MarketConfig
    const nowUtcMs = Date.now()
    const offsetMs = cfg.offset * 60 * 60 * 1000
    // Convert current UTC time to market 'local' time by adding offset
    const marketNow = new Date(nowUtcMs + offsetMs)
    // Extract Y/M/D in UTC from the offset-adjusted time (acts as market local Y/M/D)
    const y = marketNow.getUTCFullYear()
    const m = marketNow.getUTCMonth()
    const d = marketNow.getUTCDate()
    // Midnight of that market-local day, expressed in UTC ms
    const marketMidnightUtcMs = Date.UTC(y, m, d) - offsetMs
    const startMs = marketMidnightUtcMs + cfg.start * 60 * 60 * 1000
    const endMs = marketMidnightUtcMs + cfg.end * 60 * 60 * 1000
    return [startMs, endMs]
  }

  function reset() { 
    dataRef.current = { 
      timestamps: [],
      open: [],
      high: [],
      low: [],
      close: [],
      volumes: [],
      changes: [],
      keys: [], 
      idx: new Map(), 
      max: 200,
      lastCumulativeVolume: 0
    } 
  }

  function draw() {
    if (!isReady || !chartManager) return
    const d = dataRef.current
    const rows = d.timestamps.map((ts, i) => ({
      timestamp: ts.toISOString(),
      open: d.open[i],
      high: d.high[i],
      low: d.low[i],
      close: d.close[i],
      volume: d.volumes[i],
    }))
    if (rows.length === 0) return
    const cfg = {
      title: `${ticker} Live (${periodSeconds}s)`,
      height: 560,
      showVolume: true,
      theme: isDarkMode ? 'dark' as const : 'light' as const,
    }
    if (!chartInitedRef.current) {
      const ok = chartManager.createCandlestickChart(rows as any, cfg)
      if (ok) chartInitedRef.current = true
    } else {
      chartManager.updateChart(rows as any, cfg)
    }
  }

  // no seeding; we stream-only like the static version

  function upsert(t: Tick) {
    const d = dataRef.current
    // Bucket ticks into PERIOD_SECONDS candles (client-side bucket)
    const tsTick = new Date(t.timestamp)
    const bucketMs = periodSeconds * 1000
    const bucketStartMs = Math.floor(tsTick.getTime() / bucketMs) * bucketMs
    const key = new Date(bucketStartMs).toISOString()
    let i = d.idx.get(key)
    const ts = new Date(bucketStartMs)
    
    // Calculate period volume (difference from previous cumulative volume)
    const currentCumVolume = t.volume
    const periodVolume = Math.max(0, currentCumVolume - d.lastCumulativeVolume)
    d.lastCumulativeVolume = currentCumVolume
    
    if (i == null) {
      // New period - create new entry
      d.timestamps.push(ts)
      d.open.push(t.close)
      d.high.push(t.close)
      d.low.push(t.close)
      d.close.push(t.close)
      d.volumes.push(periodVolume)
      d.changes.push(t.change_percent)
      d.keys.push(key)
      i = d.timestamps.length - 1
      d.idx.set(key, i)
      
      // Maintain maximum data point history
      if (d.timestamps.length > d.max) {
        d.timestamps.shift()
        d.open.shift()
        d.high.shift()
        d.low.shift()
        d.close.shift()
        d.volumes.shift()
        d.changes.shift()
        d.keys.shift()
        d.idx = new Map(d.keys.map((k, j) => [k, j]))
      }
    } else {
      // Update existing period
      // Update OHLC
      d.close[i] = t.close
      d.high[i] = Math.max(d.high[i], t.close)
      d.low[i] = Math.min(d.low[i], t.close)
      d.volumes[i] += periodVolume  // Accumulate volume for this period
      d.changes[i] = t.change_percent  // Update change percentage
    }
  }

  async function startLiveStream() {
    if (!ticker.trim()) return
    
    setStatus('connecting')
    setHasStarted(true)
    reset()
    
    console.log(`🔍 Validating ticker: ${ticker.trim()}`)
    const isValid = await validate(ticker.trim())
    console.log(`✅ Ticker validation result: ${isValid}`)
    
    if (!isValid) { 
      console.error(`❌ Ticker validation failed for: ${ticker.trim()}`)
      setStatus('error')
      return 
    }
    
    // Start empty and let the stream populate
    const wsUrlString = wsUrl(ticker.trim())
    console.log(`🌐 Connecting WebSocket to: ${wsUrlString}`)
    const ws = new WebSocket(wsUrlString)
    wsRef.current = ws
    
    ws.onopen = () => setStatus('connected')
    ws.onmessage = ev => { 
      try { 
        const data = JSON.parse(ev.data);
        
        // Check if this is a system message about streaming availability
        if (data.source === 'system_message' && data.streaming_available === false) {
          console.log(`Streaming unavailable: ${data.message} (${data.reason})`);
          setStatus('streaming_unavailable');
          return;
        }
        
        // Check if this is a system message about successful connection
        if (data.source === 'system_message' && data.streaming_available === true) {
          console.log(`Streaming connected: ${data.message}`);
          setStatus('connected');
          return;
        }
        
        // Handle normal tick data
        const t = data as Tick; 
        setLast(t); 
        upsert(t); 
        draw();
        
        // Log each tick for monitoring frequency
        console.log(`📈 Tick: ${ticker} $${t.close} (${t.change >= 0 ? '+' : ''}${t.change_percent.toFixed(2)}%)`);
      } catch(e) {
        console.error('Error parsing WebSocket message:', e);
      } 
    }
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Only set error status if we haven't already determined streaming is unavailable
      setStatus(prevStatus => prevStatus === 'streaming_unavailable' ? 'streaming_unavailable' : 'error');
    }
    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      // Only set disconnected status if we haven't already determined streaming is unavailable
      setStatus(prevStatus => prevStatus === 'streaming_unavailable' ? 'streaming_unavailable' : 'disconnected');
    }
  }
  
  function stopLiveStream() {
    try {
      wsRef.current?.close()
    } catch {}
    setStatus('idle')
    setHasStarted(false)
    setLast(null)
    reset()
    chartInitedRef.current = false
  }


  return (
    <section className="space-y-4">
      <div className="rounded-2xl p-4 sm:p-6 bg-white/70 dark:bg-slate-900/70 shadow">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex-1 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400">
                <Icon name="candles" className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  {ticker || 'No ticker selected'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Live streaming {ticker ? 'ready' : 'requires ticker selection'}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              Candle:
              {([10, 30, 60, 300] as const).map(s => (
                <button
                  key={s}
                  onClick={() => { setLast(null); reset(); setPeriodSeconds(s); chartInitedRef.current = false; }}
                  className={`px-2 py-1 rounded-md border ${periodSeconds===s? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  {s >= 60 ? `${s/60}m` : `${s}s`}
                </button>
              ))}
            </div>
            {/* Market timezone label */}
            <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 ml-2">
              {(() => { const cfg = MARKET_CONFIGS.find(c => c.test(ticker)) as any; return cfg ? `Market UTC${cfg.offset>=0?'+':''}${cfg.offset}` : '' })()}
            </span>
            {status === 'idle' || status === 'error' || status === 'disconnected' || status === 'connecting' ? (
              <button 
                onClick={() => ticker.trim() && startLiveStream()}
                disabled={!ticker.trim() || status === 'connecting'}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white px-5 py-3 font-medium whitespace-nowrap inline-flex items-center gap-2"
              >
                {status === 'connecting' ? (
                  <>
                    <Icon name="spinner" /> Connecting...
                  </>
                ) : (
                  <>
                    <Icon name="play" /> Start Stream
                  </>
                )}
              </button>
            ) : (
              <button 
                onClick={stopLiveStream}
                className="rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-5 py-3 font-medium whitespace-nowrap inline-flex items-center gap-2"
              >
                <Icon name="stop" /> Stop
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center text-slate-600 dark:text-slate-300">
            <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${
              status==='connected'?'bg-emerald-400':
              status==='connecting'?'bg-amber-400':
              status==='streaming_unavailable'?'bg-orange-400':
              status==='idle'?'bg-slate-400':
              'bg-red-400'
            }`}></span>
            {status === 'streaming_unavailable' ? 'Live streaming not available' : 
             status === 'idle' ? 'Ready to stream' :
             status[0].toUpperCase()+status.slice(1)}
          </div>
          <div className="text-slate-500 dark:text-slate-400">
            Last update: <span className={last ? 'text-green-600 dark:text-green-400' : ''}>{last? new Date(last.timestamp).toLocaleTimeString() : '—'}</span>
            {last && <span className="text-xs ml-1">({Math.round((Date.now() - new Date(last.timestamp).getTime()) / 1000)}s ago)</span>}
          </div>
          <div className="text-slate-500 dark:text-slate-400 truncate">WebSocket: <span className="font-mono">{mounted ? wsUrl(ticker) : '—'}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 shadow">
            <div className="text-slate-500 dark:text-slate-400 mb-3">Live Metrics</div>
            <div className="space-y-4">
              <Metric label="Price" value={last?`$${last.close.toFixed(2)}`:'—'} emphasize />
              <Metric label="Change" value={last?`${last.change>=0?'+':''}${last.change.toFixed(2)} (${last.change_percent.toFixed(2)}%)`:'—'} color={last? (last.change>=0?'green':'red') : undefined} />
              <div className="grid grid-cols-2 gap-4">
                <Metric label="High" value={last?`$${last.high.toFixed(2)}`:'—'} />
                <Metric label="Low" value={last?`$${last.low.toFixed(2)}`:'—'} />
              </div>
              <Metric label="Volume" value={last? last.volume.toLocaleString() :'—'} />
            </div>
          </div>
        </div>
        <div className="lg:col-span-3">
          <div className="rounded-2xl p-2 bg-white/70 dark:bg-slate-900/70 shadow relative">
            <div ref={plotRef} style={{height:560}} />
            
            {!hasStarted && status === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 rounded-2xl">
                <div className="text-center p-8">
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400">
                    <Icon name="candles" className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Live Stock Chart
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-md">
                    Enter a stock ticker symbol above and click "Start Stream" to view real-time candlestick charts with live price updates.
                  </p>
                </div>
              </div>
            )}

            {status === 'streaming_unavailable' && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 rounded-2xl">
                <div className="text-center p-8">
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Icon name="ban" className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Live Streaming Not Available
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-md">
                    Real-time data streaming is currently unavailable. This typically occurs outside market hours or when Yahoo Finance WebSocket is not providing live updates.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Metric({ label, value, emphasize, color }: { label:string; value:string; emphasize?:boolean; color?:'green'|'red' }){
  return (
    <div>
      <div className="text-slate-400 text-xs">{label}</div>
      <div className={emphasize? 'text-2xl font-semibold' : 'text-slate-800 dark:text-slate-200'} style={color?{color: color==='green'? '#10b981':'#ef4444'}:{}}>{value}</div>
    </div>
  )
}
