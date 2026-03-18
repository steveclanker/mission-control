'use client'

import { useState, useEffect } from 'react'
import { useNavigateToPanel } from '@/lib/navigation'

interface DailyData {
  date: string
  shopify: { totalOrders: number; totalRevenue: number; aov: number; newCustomers: number; returningCustomers: number; topProducts: { name: string; qty: number }[] }
  meta: { spend: number; roas: number; purchases: number; cpa: number; clicks: number }
  googleAds?: { spend: number }
}

interface StockSummary {
  totalSkus: number; outOfStock: number; critical: number; low: number; watch: number; healthy: number
}

interface StockData {
  generatedAt: string
  summary: StockSummary
  skus: { productTitle: string; variantTitle: string; currentStock: number; sold30d: number; dailyRate: number; daysRemaining: number; status: string }[]
}

function fmt(n: number, d = 2) { return n.toLocaleString('en-AU', { minimumFractionDigits: d, maximumFractionDigits: d }) }

function QuickStat({ label, value, sub, color, onClick }: { label: string; value: string; sub?: string; color?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`bg-card border border-border rounded-xl p-5 ${onClick ? 'cursor-pointer hover:border-primary/40 transition-all' : ''}`}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${color || 'text-foreground'}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1.5">{sub}</div>}
    </div>
  )
}

export function LaHauteOverviewPanel() {
  const [daily, setDaily] = useState<DailyData | null>(null)
  const [todayData, setTodayData] = useState<any>(null)
  const [stock, setStock] = useState<StockData | null>(null)
  const [weekData, setWeekData] = useState<DailyData[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedDate, setSelectedDate] = useState<string>('') // empty = today
  const [dateData, setDateData] = useState<DailyData | null>(null)
  const navigateToPanel = useNavigateToPanel()

  useEffect(() => {
    Promise.all([
      fetch('/api/lahaute/today').then(r => r.json()).catch(() => null),
      fetch('/api/lahaute/daily').then(r => r.json()).catch(() => null),
      fetch('/api/lahaute/stock').then(r => r.json()).catch(() => null),
      fetch('/api/lahaute/daily?range=7').then(r => r.json()).catch(() => []),
    ])
      .then(([t, d, s, w]) => {
        if (t && !t.error) setTodayData(t)
        if (d && !d.error) setDaily(d)
        if (s && !s.error) setStock(s)
        if (Array.isArray(w)) setWeekData(w)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>

  const isToday = !selectedDate
  const activeData = isToday ? todayData : (selectedDate === daily?.date ? daily : dateData)
  const activeRevenue = activeData?.shopify?.totalRevenue || 0
  const activeOrders = activeData?.shopify?.totalOrders || 0
  const activeAov = activeData?.shopify?.aov || 0
  const activeNewCust = activeData?.shopify?.newCustomers || 0
  const activeRetCust = activeData?.shopify?.returningCustomers || 0
  const hasAdData = !isToday && activeData?.meta
  const totalAdSpend = hasAdData ? (activeData.meta?.spend || 0) + (activeData.googleAds?.spend || 0) : 0
  const mer = activeRevenue > 0 && totalAdSpend > 0 ? (totalAdSpend / activeRevenue * 100) : 0
  const blendedRoas = totalAdSpend > 0 ? (activeRevenue / totalAdSpend) : 0

  // Fetch data when date changes
  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    if (!date) return // today = use todayData
    if (date === daily?.date) return // yesterday = already loaded
    fetch(`/api/lahaute/daily?date=${date}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setDateData(d) })
      .catch(() => setDateData(null))
  }

  // Week calcs
  const weekRev = weekData.reduce((s, d) => s + (d.shopify?.totalRevenue || 0), 0)
  const weekOrders = weekData.reduce((s, d) => s + (d.shopify?.totalOrders || 0), 0)
  const weekSpend = weekData.reduce((s, d) => s + (d.meta?.spend || 0) + (d.googleAds?.spend || 0), 0)

  // Stock alerts — only items that actually sell, grouped by product
  const alertSkus = stock?.skus?.filter(s => 
    ['out_of_stock', 'critical', 'low'].includes(s.status) && s.sold30d > 0
  ) || []
  
  // Group alerts by product
  const alertsByProduct: Record<string, typeof alertSkus> = {}
  for (const sku of alertSkus) {
    if (!alertsByProduct[sku.productTitle]) alertsByProduct[sku.productTitle] = []
    alertsByProduct[sku.productTitle].push(sku)
  }
  // Sort products by total daily rate (most important first), take top 10
  const alertProducts = Object.entries(alertsByProduct)
    .map(([name, skus]) => ({
      name,
      skus: skus.sort((a, b) => b.dailyRate - a.dailyRate),
      totalDailyRate: skus.reduce((s, v) => s + v.dailyRate, 0),
      oosCount: skus.filter(s => s.currentStock <= 0).length,
      critCount: skus.filter(s => s.status === 'critical').length,
    }))
    .sort((a, b) => b.totalDailyRate - a.totalDailyRate)
    .slice(0, 10)
  
  const attentionCount = Object.keys(alertsByProduct).length

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{greeting}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isToday 
              ? <>Today &mdash; {now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}{todayData && <span className="ml-2 text-xs">(as of {new Date(todayData.asOf).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })})</span>}</>
              : <>{activeData ? new Date(activeData.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : selectedDate}</>
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDateChange('')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isToday ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => handleDateChange(daily?.date || '')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedDate === daily?.date ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Yesterday
          </button>
          <input
            type="date"
            value={selectedDate}
            max={new Date().toISOString().split('T')[0]}
            onChange={e => handleDateChange(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Key Metrics */}
      {activeData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickStat
            label="Revenue"
            value={`$${fmt(activeRevenue)}`}
            sub={`${activeOrders} orders | AOV $${fmt(activeAov)}`}
            color="text-green-400"
            onClick={() => navigateToPanel('daily')}
          />
          {hasAdData ? (
            <QuickStat
              label="Ad Spend"
              value={`$${fmt(totalAdSpend)}`}
              sub={`MER: ${fmt(mer, 1)}%`}
              onClick={() => navigateToPanel('daily')}
            />
          ) : (
            <QuickStat
              label="Customers"
              value={`${activeNewCust + activeRetCust}`}
              sub={`${activeNewCust} new | ${activeRetCust} returning`}
            />
          )}
          {hasAdData ? (
            <QuickStat
              label="Blended ROAS"
              value={`${fmt(blendedRoas, 2)}x`}
              sub={`Meta: ${fmt(activeData?.meta?.roas || 0, 2)}x | CPA: $${fmt(activeData?.meta?.cpa || 0)}`}
              color={blendedRoas >= 2.5 ? 'text-green-400' : blendedRoas >= 1.5 ? 'text-yellow-400' : 'text-red-400'}
              onClick={() => navigateToPanel('daily')}
            />
          ) : (
            <QuickStat
              label="Items Sold"
              value={`${activeData?.shopify?.totalItems || 0}`}
              sub={`Avg ${activeOrders > 0 ? fmt((activeData?.shopify?.totalItems || 0) / activeOrders, 1) : '0'} per order`}
            />
          )}
          <QuickStat
            label="Stock Alerts"
            value={attentionCount > 0 ? `${attentionCount}` : 'All good'}
            sub={stock ? `${stock.summary.outOfStock} sold out | ${stock.summary.critical} critical` : 'No data'}
            color={attentionCount > 0 ? 'text-red-400' : 'text-green-400'}
            onClick={() => navigateToPanel('stock')}
          />
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* 7-Day Trend */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Last 7 Days</h2>
            <button onClick={() => navigateToPanel('daily')} className="text-xs text-primary hover:underline">View details</button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Revenue</span>
              <span className="text-sm font-medium text-foreground">${fmt(weekRev)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Orders</span>
              <span className="text-sm font-medium text-foreground">{weekOrders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Ad Spend</span>
              <span className="text-sm font-medium text-foreground">${fmt(weekSpend)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Week MER</span>
              <span className={`text-sm font-medium ${weekRev > 0 && (weekSpend / weekRev * 100) < 40 ? 'text-green-400' : 'text-yellow-400'}`}>
                {weekRev > 0 ? fmt(weekSpend / weekRev * 100, 1) : '0.0'}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg Daily</span>
              <span className="text-sm font-medium text-foreground">${fmt(weekRev / (weekData.length || 1))}</span>
            </div>
          </div>

          {/* Mini chart */}
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex items-end justify-between gap-1 h-20">
              {weekData.map((d, i) => {
                const maxRev = Math.max(...weekData.map(w => w.shopify?.totalRevenue || 0))
                const height = maxRev > 0 ? ((d.shopify?.totalRevenue || 0) / maxRev * 100) : 0
                const day = new Date(d.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short' }).substring(0, 2)
                return (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div className="text-[9px] text-muted-foreground">${Math.round((d.shopify?.totalRevenue || 0) / 1000)}k</div>
                    <div className="w-full bg-primary/60 rounded-sm min-h-[2px]" style={{ height: `${Math.max(height, 3)}%` }}
                      title={`${d.date}: $${fmt(d.shopify?.totalRevenue || 0)}`} />
                    <span className="text-[10px] text-muted-foreground">{day}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Stock Alerts */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Stock Alerts</h2>
            <button onClick={() => navigateToPanel('stock')} className="text-xs text-primary hover:underline">View all stock</button>
          </div>
          {alertProducts.length > 0 ? (
            <div className="space-y-1">
              {alertProducts.map((product) => {
                const isOpen = expanded.has('alert-' + product.name)
                return (
                  <div key={product.name}>
                    <button
                      onClick={() => {
                        const next = new Set(expanded)
                        const key = 'alert-' + product.name
                        isOpen ? next.delete(key) : next.add(key)
                        setExpanded(next)
                      }}
                      className="w-full flex items-center justify-between py-2 hover:bg-secondary/50 rounded-lg px-2 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{isOpen ? '\u25BC' : '\u25B6'}</span>
                        <span className="text-sm font-medium text-foreground">{product.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {product.oosCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">{product.oosCount} sold out</span>
                        )}
                        {product.critCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">{product.critCount} critical</span>
                        )}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="ml-6 mb-2 space-y-1">
                        {product.skus.map((sku, i) => (
                          <div key={i} className="flex items-center justify-between py-1 px-2 text-sm">
                            <span className="text-muted-foreground">{sku.variantTitle}</span>
                            <span className={`font-medium ${
                              sku.currentStock <= 0 ? 'text-red-400' : sku.status === 'critical' ? 'text-red-400' : 'text-yellow-400'
                            }`}>
                              {sku.currentStock <= 0 ? 'SOLD OUT' : `${sku.currentStock} left (${sku.daysRemaining}d)`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {attentionCount > 10 && (
                <button onClick={() => navigateToPanel('stock')} className="w-full text-center text-xs text-primary hover:underline pt-2">
                  +{attentionCount - 10} more products need attention
                </button>
              )}
            </div>
          ) : (
            <div className="text-sm text-green-400 py-4 text-center">All stock levels healthy</div>
          )}
        </div>
      </div>

      {/* Top Products */}
      {activeData?.shopify?.topProducts && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Top Products {isToday ? 'Today' : ''}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {activeData.shopify.topProducts.slice(0, 6).map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <span className="text-lg font-bold text-muted-foreground w-6">{i + 1}</span>
                <div>
                  <div className="text-sm text-foreground">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.qty} sold</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
