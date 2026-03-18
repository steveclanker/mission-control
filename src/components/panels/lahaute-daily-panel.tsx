'use client'

import { useState, useEffect } from 'react'

interface DailyData {
  date: string
  shopify: {
    totalOrders: number
    totalRevenue: number
    aov: number
    refunds: number
    returningRate: number
    newCustomers: number
    returningCustomers: number
    topProducts: { name: string; qty: number }[]
  }
  meta: {
    spend: number
    impressions: number
    clicks: number
    cpc: number
    purchases: number
    purchaseRevenue: number
    roas: number
    cpa: number
  }
  ga4?: {
    sessions: number
    totalRevenue: number
  }
  googleAds?: {
    spend: number
    clicks: number
    conversions: number
    conversionValue: number
  }
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color || 'text-foreground'}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  )
}

function TopProducts({ products }: { products: { name: string; qty: number }[] }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-sm font-semibold text-foreground mb-3">Top Products</div>
      <div className="space-y-2">
        {products.slice(0, 5).map((p, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
              <span className="text-sm text-foreground">{p.name}</span>
            </div>
            <span className="text-sm font-medium text-foreground">{p.qty} sold</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LaHauteDailyPanel() {
  const [data, setData] = useState<DailyData | null>(null)
  const [weekData, setWeekData] = useState<DailyData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/lahaute/daily').then(r => r.json()),
      fetch('/api/lahaute/daily?range=7').then(r => r.json()),
    ])
      .then(([latest, week]) => {
        if (latest.error) { setError(latest.error); return }
        setData(latest)
        setWeekData(Array.isArray(week) ? week : [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Loading daily data...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="text-red-400">No daily data available yet. Run the daily summary script to populate.</div>
      </div>
    )
  }

  const totalAdSpend = (data.meta?.spend || 0) + (data.googleAds?.spend || 0)
  const mer = data.shopify.totalRevenue > 0 ? (totalAdSpend / data.shopify.totalRevenue * 100) : 0
  const totalRoas = totalAdSpend > 0 ? (data.shopify.totalRevenue / totalAdSpend) : 0

  // Week totals
  const weekRevenue = weekData.reduce((sum, d) => sum + (d.shopify?.totalRevenue || 0), 0)
  const weekOrders = weekData.reduce((sum, d) => sum + (d.shopify?.totalOrders || 0), 0)
  const weekAdSpend = weekData.reduce((sum, d) => sum + (d.meta?.spend || 0) + (d.googleAds?.spend || 0), 0)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily P&L</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(data.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${mer < 40 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            MER: {fmt(mer, 1)}%
          </div>
        </div>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          label="Revenue" 
          value={`$${fmt(data.shopify.totalRevenue)}`}
          sub={`${data.shopify.totalOrders} orders`}
          color="text-green-400"
        />
        <MetricCard 
          label="Total Ad Spend" 
          value={`$${fmt(totalAdSpend)}`}
          sub={`Meta: $${fmt(data.meta?.spend || 0)}${data.googleAds ? ` | Google: $${fmt(data.googleAds.spend)}` : ''}`}
        />
        <MetricCard 
          label="ROAS (Blended)" 
          value={`${fmt(totalRoas, 2)}x`}
          sub={`Meta ROAS: ${fmt(data.meta?.roas || 0, 2)}x`}
          color={totalRoas >= 2.5 ? 'text-green-400' : totalRoas >= 1.5 ? 'text-yellow-400' : 'text-red-400'}
        />
        <MetricCard 
          label="AOV" 
          value={`$${fmt(data.shopify.aov)}`}
          sub={`${data.shopify.newCustomers} new / ${data.shopify.returningCustomers} returning`}
        />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          label="Meta CPA" 
          value={`$${fmt(data.meta?.cpa || 0)}`}
          sub={`${data.meta?.purchases || 0} purchases`}
        />
        <MetricCard 
          label="Meta CPC" 
          value={`$${fmt(data.meta?.cpc || 0)}`}
          sub={`${(data.meta?.clicks || 0).toLocaleString()} clicks`}
        />
        <MetricCard 
          label="Returning Rate" 
          value={`${fmt(data.shopify.returningRate, 1)}%`}
          sub={`${data.shopify.returningCustomers} repeat buyers`}
          color={data.shopify.returningRate >= 30 ? 'text-green-400' : 'text-yellow-400'}
        />
        <MetricCard 
          label="GA4 Sessions" 
          value={data.ga4?.sessions?.toLocaleString() || 'N/A'}
          sub={data.ga4 ? `$${fmt(data.ga4.totalRevenue)} GA4 rev` : 'Not connected'}
        />
      </div>

      {/* Products + Weekly Trend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.shopify.topProducts && <TopProducts products={data.shopify.topProducts} />}
        
        {/* Weekly Summary */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm font-semibold text-foreground mb-3">Last 7 Days</div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Revenue</span>
              <span className="text-sm font-medium text-foreground">${fmt(weekRevenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Orders</span>
              <span className="text-sm font-medium text-foreground">{weekOrders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Ad Spend</span>
              <span className="text-sm font-medium text-foreground">${fmt(weekAdSpend)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg Daily Rev</span>
              <span className="text-sm font-medium text-foreground">${fmt(weekRevenue / (weekData.length || 1))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Week MER</span>
              <span className={`text-sm font-medium ${weekRevenue > 0 && (weekAdSpend / weekRevenue * 100) < 40 ? 'text-green-400' : 'text-red-400'}`}>
                {weekRevenue > 0 ? fmt(weekAdSpend / weekRevenue * 100, 1) : '0.0'}%
              </span>
            </div>
          </div>

          {/* Mini daily bars */}
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex items-end justify-between gap-1 h-16">
              {weekData.map((d, i) => {
                const maxRev = Math.max(...weekData.map(w => w.shopify?.totalRevenue || 0))
                const height = maxRev > 0 ? ((d.shopify?.totalRevenue || 0) / maxRev * 100) : 0
                const dayLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short' }).charAt(0)
                return (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div 
                      className="w-full bg-primary/60 rounded-sm min-h-[2px]" 
                      style={{ height: `${Math.max(height, 3)}%` }}
                      title={`${d.date}: $${fmt(d.shopify?.totalRevenue || 0)}`}
                    />
                    <span className="text-[10px] text-muted-foreground">{dayLabel}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
