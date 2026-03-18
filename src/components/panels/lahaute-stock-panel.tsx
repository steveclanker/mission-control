'use client'

import { useState, useEffect } from 'react'

interface SkuData {
  productTitle: string
  variantTitle: string
  sku: string
  currentStock: number
  sold30d: number
  dailyRate: number
  daysRemaining: number
  status: 'out_of_stock' | 'critical' | 'low' | 'watch' | 'healthy'
  price: number
}

interface StockData {
  generatedAt: string
  summary: {
    totalSkus: number
    outOfStock: number
    critical: number
    low: number
    watch: number
    healthy: number
  }
  skus: SkuData[]
}

const STATUS_CONFIG = {
  out_of_stock: { label: 'Out of Stock', color: 'bg-red-500', textColor: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20', icon: '🔴' },
  critical: { label: 'Critical', color: 'bg-red-500', textColor: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20', icon: '🔴' },
  low: { label: 'Low', color: 'bg-yellow-500', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/20', icon: '🟡' },
  watch: { label: 'Watch', color: 'bg-yellow-500', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/20', icon: '🟡' },
  healthy: { label: 'Healthy', color: 'bg-green-500', textColor: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20', icon: '🟢' },
}

type FilterType = 'all' | 'out_of_stock' | 'critical' | 'low' | 'watch' | 'healthy' | 'attention' | 'bestsellers'
type SortType = 'status' | 'popular' | 'days_left' | 'stock_low'

export function LaHauteStockPanel() {
  const [data, setData] = useState<StockData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('bestsellers')
  const [sort, setSort] = useState<SortType>('popular')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/lahaute/stock')
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-muted-foreground">Loading stock data...</div>
  if (!data) return <div className="p-6 text-red-400">No stock data available. Run the stock pull script.</div>

  const { summary, skus } = data

  // Filter SKUs
  let filtered = [...skus]
  if (filter === 'attention') {
    filtered = skus.filter(s => ['out_of_stock', 'critical', 'low'].includes(s.status))
  } else if (filter === 'bestsellers') {
    filtered = skus.filter(s => s.sold30d > 0)
  } else if (filter !== 'all') {
    filtered = skus.filter(s => s.status === filter)
  }

  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(s => 
      s.productTitle.toLowerCase().includes(q) || 
      s.variantTitle.toLowerCase().includes(q) ||
      s.sku.toLowerCase().includes(q)
    )
  }

  // Sort
  if (sort === 'popular') {
    filtered.sort((a, b) => b.sold30d - a.sold30d)
  } else if (sort === 'days_left') {
    filtered.sort((a, b) => a.daysRemaining - b.daysRemaining)
  } else if (sort === 'stock_low') {
    filtered.sort((a, b) => a.currentStock - b.currentStock)
  } else {
    // Default status sort
    const order = { out_of_stock: 0, critical: 1, low: 2, watch: 3, healthy: 4 }
    filtered.sort((a, b) => (order[a.status] - order[b.status]) || (a.daysRemaining - b.daysRemaining))
  }

  // Group by product for cleaner display
  const grouped: Record<string, SkuData[]> = {}
  for (const sku of filtered) {
    if (!grouped[sku.productTitle]) grouped[sku.productTitle] = []
    grouped[sku.productTitle].push(sku)
  }

  const attentionCount = summary.outOfStock + summary.critical + summary.low

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stock Levels</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Updated {new Date(data.generatedAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })} - {summary.totalSkus} SKUs tracked
          </p>
        </div>
        {attentionCount > 0 && (
          <div className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            {attentionCount} need attention
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { key: 'out_of_stock' as const, label: 'Out of Stock', count: summary.outOfStock, icon: '🔴' },
          { key: 'critical' as const, label: 'Critical (<7d)', count: summary.critical, icon: '🔴' },
          { key: 'low' as const, label: 'Low (7-14d)', count: summary.low, icon: '🟡' },
          { key: 'watch' as const, label: 'Watch (14-30d)', count: summary.watch, icon: '🟡' },
          { key: 'healthy' as const, label: 'Healthy (30d+)', count: summary.healthy, icon: '🟢' },
        ].map(({ key, label, count, icon }) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? 'all' : key)}
            className={`bg-card border rounded-xl p-3 text-left transition-all ${
              filter === key ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/30'
            }`}
          >
            <div className="text-xs text-muted-foreground">{icon} {label}</div>
            <div className="text-xl font-bold text-foreground mt-1">{count}</div>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search product or SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        {[
          { key: 'bestsellers' as FilterType, label: 'Best Sellers', count: skus.filter(s => s.sold30d > 0).length },
          { key: 'attention' as FilterType, label: 'Needs Attention', count: attentionCount },
          { key: 'all' as FilterType, label: 'All', count: summary.totalSkus },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              filter === key
                ? key === 'attention' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Sort Bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort by:</span>
        {[
          { key: 'popular' as SortType, label: 'Most Popular' },
          { key: 'days_left' as SortType, label: 'Days Left' },
          { key: 'stock_low' as SortType, label: 'Lowest Stock' },
          { key: 'status' as SortType, label: 'Status' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={`px-2.5 py-1.5 rounded-md text-xs transition-all ${
              sort === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Product List */}
      <div className="space-y-2 max-h-[650px] overflow-y-auto">
        {Object.entries(grouped).map(([productName, variants]) => {
          const isOpen = expanded.has(productName)
          const totalStock = variants.reduce((s, v) => s + v.currentStock, 0)
          const totalSold = variants.reduce((s, v) => s + v.sold30d, 0)
          const worstStatus = variants.reduce((worst, v) => {
            const order = { out_of_stock: 0, critical: 1, low: 2, watch: 3, healthy: 4 }
            return order[v.status] < order[worst] ? v.status : worst
          }, 'healthy' as SkuData['status'])
          const oosCount = variants.filter(v => v.currentStock <= 0).length
          const critCount = variants.filter(v => v.status === 'critical').length
          const cfg = STATUS_CONFIG[worstStatus]

          return (
            <div key={productName} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Product Header - clickable */}
              <button
                onClick={() => {
                  const next = new Set(expanded)
                  isOpen ? next.delete(productName) : next.add(productName)
                  setExpanded(next)
                }}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-sm">{isOpen ? '\u25BC' : '\u25B6'}</span>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-foreground">{productName}</div>
                    <div className="text-xs text-muted-foreground">{variants.length} variants - {totalSold} sold (30d)</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {oosCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                      {oosCount} sold out
                    </span>
                  )}
                  {critCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                      {critCount} critical
                    </span>
                  )}
                  <div className="text-right">
                    <div className={`text-sm font-medium ${totalStock <= 0 ? 'text-red-400' : 'text-foreground'}`}>{totalStock} units</div>
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.color}`} />
                </div>
              </button>

              {/* Expanded SKU rows */}
              {isOpen && (
                <div className="border-t border-border">
                  {/* SKU Header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wide bg-secondary/30">
                    <div className="col-span-4">Variant</div>
                    <div className="col-span-2 text-right">Stock</div>
                    <div className="col-span-2 text-right">30d Sold</div>
                    <div className="col-span-2 text-right">Daily Rate</div>
                    <div className="col-span-2 text-right">Days Left</div>
                  </div>
                  {variants.map((sku, i) => {
                    const skuCfg = STATUS_CONFIG[sku.status]
                    return (
                      <div key={`${sku.sku}-${i}`} className={`grid grid-cols-12 gap-2 px-4 py-2 items-center border-t border-border/50 ${
                        sku.status === 'out_of_stock' || sku.status === 'critical' ? 'bg-red-500/5' : ''
                      }`}>
                        <div className="col-span-4">
                          <span className="text-sm text-foreground">{sku.variantTitle}</span>
                          {sku.sku && <span className="text-xs text-muted-foreground ml-2">{sku.sku}</span>}
                        </div>
                        <div className={`col-span-2 text-right text-sm font-medium ${sku.currentStock <= 0 ? 'text-red-400' : 'text-foreground'}`}>
                          {sku.currentStock}
                        </div>
                        <div className="col-span-2 text-right text-sm text-muted-foreground">
                          {sku.sold30d}
                        </div>
                        <div className="col-span-2 text-right text-sm text-muted-foreground">
                          {sku.dailyRate > 0 ? `${sku.dailyRate}/day` : '-'}
                        </div>
                        <div className={`col-span-2 text-right text-sm font-medium ${skuCfg.textColor}`}>
                          {sku.status === 'out_of_stock' ? 'SOLD OUT' : sku.daysRemaining >= 999 ? '99+' : `${sku.daysRemaining}d`}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {Object.keys(grouped).length === 0 && (
          <div className="bg-card border border-border rounded-xl px-4 py-8 text-center text-muted-foreground">
            No products match your filter
          </div>
        )}
      </div>
    </div>
  )
}
