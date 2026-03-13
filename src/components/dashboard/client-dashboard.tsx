'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMissionControl } from '@/store'
import { useNavigateToPanel } from '@/lib/navigation'
import { useSmartPoll } from '@/lib/use-smart-poll'

interface ClientStats {
  tasks: {
    total: number
    done: number
    in_progress: number
    pending: number
    review: number
  }
  agents: {
    total: number
    online: number
    busy: number
    primaryAgent: { name: string; role: string; status: string; last_activity?: string } | null
  }
  costs: {
    thisMonth: number
    lastMonth: number
  }
  recentCompleted: Array<{
    id: number
    title: string
    completed_at: number
    assigned_to?: string
  }>
  currentTasks: Array<{
    id: number
    title: string
    status: string
    priority: string
    assigned_to?: string
    updated_at: number
  }>
}

export function ClientDashboard() {
  const { tasks, agents } = useMissionControl()
  const navigateToPanel = useNavigateToPanel()
  const [stats, setStats] = useState<ClientStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      // Fetch tasks
      const tasksRes = await fetch('/api/tasks?limit=100')
      const tasksData = await tasksRes.json()
      const allTasks = tasksData.tasks || []

      // Fetch agents
      const agentsRes = await fetch('/api/agents')
      const agentsData = await agentsRes.json()
      const allAgents = agentsData.agents || agentsData || []

      // Fetch costs
      let costThisMonth = 0
      try {
        const costsRes = await fetch('/api/costs?timeframe=month')
        const costsData = await costsRes.json()
        costThisMonth = costsData.totalCost || costsData.total || 0
      } catch {}

      // Calculate task stats
      const done = allTasks.filter((t: any) => t.status === 'done').length
      const inProgress = allTasks.filter((t: any) => t.status === 'in_progress').length
      const review = allTasks.filter((t: any) => t.status === 'review' || t.status === 'quality_review').length
      const pending = allTasks.filter((t: any) => t.status === 'inbox' || t.status === 'assigned').length

      // Find primary agent (first one, or busiest)
      const onlineAgents = allAgents.filter((a: any) => a.status !== 'offline')
      const busyAgents = allAgents.filter((a: any) => a.status === 'busy')
      const primaryAgent = allAgents.length > 0 ? allAgents[0] : null

      // Recent completed (last 10)
      const recentCompleted = allTasks
        .filter((t: any) => t.status === 'done')
        .sort((a: any, b: any) => (b.updated_at || 0) - (a.updated_at || 0))
        .slice(0, 10)
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          completed_at: t.updated_at,
          assigned_to: t.assigned_to,
        }))

      // Current in-progress tasks
      const currentTasks = allTasks
        .filter((t: any) => t.status === 'in_progress' || t.status === 'review' || t.status === 'quality_review')
        .sort((a: any, b: any) => (b.updated_at || 0) - (a.updated_at || 0))
        .slice(0, 10)
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          assigned_to: t.assigned_to,
          updated_at: t.updated_at,
        }))

      setStats({
        tasks: { total: allTasks.length, done, in_progress: inProgress, pending, review },
        agents: {
          total: allAgents.length,
          online: onlineAgents.length,
          busy: busyAgents.length,
          primaryAgent: primaryAgent ? {
            name: primaryAgent.name,
            role: primaryAgent.role,
            status: primaryAgent.status,
            last_activity: primaryAgent.last_activity,
          } : null,
        },
        costs: { thisMonth: costThisMonth, lastMonth: 0 },
        recentCompleted,
        currentTasks,
      })
    } catch (err) {
      console.error('Failed to fetch client stats:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useSmartPoll(fetchStats, { intervalMs: 30000, label: 'client-dashboard' })

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-secondary/50 rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-secondary/50 rounded-xl" />)}
          </div>
          <div className="h-64 bg-secondary/50 rounded-xl" />
        </div>
      </div>
    )
  }

  const agentStatus = stats?.agents.primaryAgent?.status || 'offline'
  const statusConfig = {
    idle: { label: 'Online — Ready', color: 'text-green-400', bg: 'bg-green-500/20', dot: 'bg-green-500', ring: 'ring-green-500/30' },
    busy: { label: 'Working', color: 'text-blue-400', bg: 'bg-blue-500/20', dot: 'bg-blue-500 animate-pulse', ring: 'ring-blue-500/30' },
    offline: { label: 'Offline', color: 'text-muted-foreground', bg: 'bg-muted/50', dot: 'bg-muted-foreground', ring: 'ring-muted-foreground/30' },
    error: { label: 'Needs Attention', color: 'text-amber-400', bg: 'bg-amber-500/20', dot: 'bg-amber-500 animate-pulse', ring: 'ring-amber-500/30' },
  }
  const sc = statusConfig[agentStatus as keyof typeof statusConfig] || statusConfig.offline

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Agent Status Hero Card */}
      <div className={`rounded-2xl border border-border ${sc.bg} p-6 flex items-center gap-5`}>
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center ring-4 ${sc.ring}`}>
          <span className="text-2xl">🤖</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <h2 className="text-lg font-semibold text-foreground">
              {stats?.agents.primaryAgent?.name || 'Your Agent'}
            </h2>
            <span className={`w-2.5 h-2.5 rounded-full ${sc.dot}`} />
            <span className={`text-sm font-medium ${sc.color}`}>{sc.label}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {stats?.agents.primaryAgent?.role || 'AI Assistant'}
            {stats?.agents.primaryAgent?.last_activity && (
              <> · Last active: {stats.agents.primaryAgent.last_activity}</>
            )}
          </p>
          {(stats?.agents.total || 0) > 1 && (
            <p className="text-xs text-muted-foreground mt-1">
              {stats!.agents.online} of {stats!.agents.total} agents online
              {stats!.agents.busy > 0 && ` · ${stats!.agents.busy} working`}
            </p>
          )}
        </div>
        <button
          onClick={() => navigateToPanel('tasks')}
          className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          View Tasks
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3l5 5-5 5" />
          </svg>
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Completed"
          value={stats?.tasks.done ?? 0}
          icon="✅"
          color="text-green-400"
          bg="bg-green-500/10"
        />
        <StatCard
          label="In Progress"
          value={stats?.tasks.in_progress ?? 0}
          icon="⚡"
          color="text-blue-400"
          bg="bg-blue-500/10"
        />
        <StatCard
          label="Pending"
          value={(stats?.tasks.pending ?? 0) + (stats?.tasks.review ?? 0)}
          icon="📋"
          color="text-amber-400"
          bg="bg-amber-500/10"
        />
        <StatCard
          label="Cost This Month"
          value={`$${(stats?.costs.thisMonth ?? 0).toFixed(2)}`}
          icon="💰"
          color="text-cyan-400"
          bg="bg-cyan-500/10"
          isText
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Current Tasks */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="text-blue-400">⚡</span>
              Tasks In Progress
            </h3>
            <button
              onClick={() => navigateToPanel('tasks')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all →
            </button>
          </div>
          <div className="divide-y divide-border">
            {stats?.currentTasks && stats.currentTasks.length > 0 ? (
              stats.currentTasks.map((task) => (
                <div key={task.id} className="px-4 py-3 flex items-center gap-3">
                  <StatusDot status={task.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.assigned_to && <span>{task.assigned_to} · </span>}
                      {formatStatus(task.status)}
                    </p>
                  </div>
                  <PriorityBadge priority={task.priority} />
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">No tasks in progress</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Your agent is standing by</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Completed */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="text-green-400">✅</span>
              Recently Completed
            </h3>
            <span className="text-xs text-muted-foreground">{stats?.tasks.done ?? 0} total</span>
          </div>
          <div className="divide-y divide-border">
            {stats?.recentCompleted && stats.recentCompleted.length > 0 ? (
              stats.recentCompleted.map((task) => (
                <div key={task.id} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-green-500 text-xs">✓</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.assigned_to && <span>{task.assigned_to} · </span>}
                      {formatTimeAgo(task.completed_at)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">No completed tasks yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction label="Chat with Agent" icon="💬" onClick={() => navigateToPanel('overview')} />
        <QuickAction label="View All Tasks" icon="📋" onClick={() => navigateToPanel('tasks')} />
        <QuickAction label="Social Media" icon="📱" onClick={() => navigateToPanel('social')} />
        <QuickAction label="Analytics" icon="📊" onClick={() => navigateToPanel('analytics')} />
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color, bg, isText }: {
  label: string; value: number | string; icon: string; color: string; bg: string; isText?: boolean
}) {
  return (
    <div className={`rounded-xl border border-border ${bg} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color} font-mono`}>
        {isText ? value : typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  )
}

function QuickAction({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-border bg-card hover:bg-secondary/50 p-4 flex flex-col items-center gap-2 transition-colors"
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </button>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    in_progress: 'bg-blue-500 animate-pulse',
    review: 'bg-purple-500',
    quality_review: 'bg-purple-500',
    done: 'bg-green-500',
  }
  return <span className={`w-2 h-2 rounded-full ${colors[status] || 'bg-muted-foreground'}`} />
}

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { label: string; color: string }> = {
    urgent: { label: 'Urgent', color: 'text-red-400 bg-red-500/15' },
    critical: { label: 'Critical', color: 'text-red-400 bg-red-500/15' },
    high: { label: 'High', color: 'text-amber-400 bg-amber-500/15' },
    medium: { label: 'Med', color: 'text-blue-400 bg-blue-500/15' },
    low: { label: 'Low', color: 'text-muted-foreground bg-muted/50' },
  }
  const c = config[priority] || config.medium
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${c.color}`}>{c.label}</span>
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return ''
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(timestamp * 1000).toLocaleDateString()
}
