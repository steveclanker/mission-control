'use client'

import React, { useState, useCallback } from 'react'
import { useSmartPoll } from '@/lib/use-smart-poll'
import { createClientLogger } from '@/lib/client-logger'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts'

const log = createClientLogger('CostTracker')

interface CostData {
  totalCost: number
  totalTokens: number
  projectedMonthlyCost: number
  dailyCosts: Array<{ date: string; cost: number; tokens: number }>
  modelBreakdown: Array<{ model: string; cost: number }>
  agentBreakdown: Array<{ agent: string; cost: number }>
  budget: {
    monthly: number
    alertThreshold: number
    used: number
    usedPercent: number
    alert: boolean
  }
  timeframe: string
}

const CHART_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899']

export function CostTrackerPanel() {
  const [costData, setCostData] = useState<CostData | null>(null)
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('month')
  const [isLoading, setIsLoading] = useState(false)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [thresholdInput, setThresholdInput] = useState('80')

  const loadCosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/costs?timeframe=${timeframe}`)
      if (res.ok) {
        const data = await res.json()
        setCostData(data)
      }
    } catch (error) {
      log.error('Failed to load costs:', error)
    }
  }, [timeframe])

  useSmartPoll(loadCosts, 60000)

  const saveBudget = async () => {
    try {
      const res = await fetch('/api/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyBudget: parseFloat(budgetInput) || 100,
          alertThreshold: (parseFloat(thresholdInput) || 80) / 100,
        }),
      })
      if (res.ok) {
        setShowBudgetModal(false)
        loadCosts()
      }
    } catch (error) {
      log.error('Failed to save budget:', error)
    }
  }

  const formatCost = (cost: number) => `$${cost.toFixed(4)}`
  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
    return tokens.toString()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="border-b border-zinc-800 pb-4">
        <h1 className="text-3xl font-bold text-zinc-100">Cost Tracker</h1>
        <p className="text-zinc-400 mt-2">Monitor spending across agents, models, and sessions</p>

        <div className="flex gap-2 mt-4">
          {(['day', 'week', 'month'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-2 rounded font-medium transition-colors capitalize ${
                timeframe === tf ? 'bg-primary text-primary-foreground' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {tf}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => {
              setBudgetInput(String(costData?.budget?.monthly || 100))
              setThresholdInput(String((costData?.budget?.alertThreshold || 0.8) * 100))
              setShowBudgetModal(true)
            }}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-md hover:bg-zinc-700 transition-colors text-sm"
          >
            Set Budget
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-500 mb-1">Total Spend</div>
          <div className="text-2xl font-bold text-zinc-100">{formatCost(costData?.totalCost || 0)}</div>
          <div className="text-xs text-zinc-500 mt-1">this {timeframe}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-500 mb-1">Total Tokens</div>
          <div className="text-2xl font-bold text-zinc-100">{formatTokens(costData?.totalTokens || 0)}</div>
          <div className="text-xs text-zinc-500 mt-1">this {timeframe}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-500 mb-1">Projected Monthly</div>
          <div className="text-2xl font-bold text-violet-400">{formatCost(costData?.projectedMonthlyCost || 0)}</div>
          <div className="text-xs text-zinc-500 mt-1">at current rate</div>
        </div>
        <div className={`border rounded-lg p-4 ${
          costData?.budget?.alert
            ? 'bg-red-500/10 border-red-500/20'
            : 'bg-zinc-900 border-zinc-800'
        }`}>
          <div className="text-xs text-zinc-500 mb-1">Budget</div>
          <div className={`text-2xl font-bold ${costData?.budget?.alert ? 'text-red-400' : 'text-emerald-400'}`}>
            {((costData?.budget?.usedPercent || 0) * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            of ${costData?.budget?.monthly || 100}/mo
          </div>
          {/* Budget bar */}
          <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                costData?.budget?.alert ? 'bg-red-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, (costData?.budget?.usedPercent || 0) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Budget Alert */}
      {costData?.budget?.alert && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <span className="text-red-400 text-lg">⚠️</span>
          <div>
            <div className="text-sm font-medium text-red-300">Budget Alert</div>
            <div className="text-xs text-red-400/70">
              You&apos;ve used {((costData.budget.usedPercent) * 100).toFixed(0)}% of your ${costData.budget.monthly}/month budget.
            </div>
          </div>
        </div>
      )}

      {/* Daily Cost Chart */}
      {costData && costData.dailyCosts.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Daily Spending</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={costData.dailyCosts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 11 }} />
                <YAxis stroke="#71717a" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                <Line type="monotone" dataKey="cost" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Model Breakdown */}
        {costData && costData.modelBreakdown.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">Cost by Model</h2>
            <div className="space-y-3">
              {costData.modelBreakdown.map((item, i) => (
                <div key={item.model} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-sm text-zinc-300 truncate max-w-[200px]">{item.model}</span>
                  </div>
                  <span className="text-sm font-mono text-zinc-400">{formatCost(item.cost)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agent Breakdown */}
        {costData && costData.agentBreakdown.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">Cost by Agent</h2>
            <div className="space-y-3">
              {costData.agentBreakdown.map((item, i) => (
                <div key={item.agent} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-sm text-zinc-300">{item.agent}</span>
                  </div>
                  <span className="text-sm font-mono text-zinc-400">{formatCost(item.cost)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* No data state */}
      {costData && costData.totalCost === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <p className="text-lg">No cost data for this {timeframe} yet.</p>
          <p className="text-sm mt-2">Cost tracking starts automatically as agents process tasks.</p>
        </div>
      )}

      {/* Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-zinc-100 mb-4">Set Budget</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Monthly Budget ($)</label>
                <input
                  type="number"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  placeholder="100"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Alert Threshold (%)</label>
                <input
                  type="number"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  placeholder="80"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={saveBudget}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowBudgetModal(false)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
