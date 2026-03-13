'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSmartPoll } from '@/lib/use-smart-poll'

interface Activity {
  id: number
  type: string
  entity_type: string
  entity_id: number
  actor: string
  description: string
  data?: any
  created_at: number
  entity?: {
    type: string
    id?: number
    title?: string
    name?: string
    status?: string
    content_preview?: string
    task_title?: string
  }
}

// Category groupings for filters
const categoryMap: Record<string, string> = {
  task_created: 'tasks',
  task_updated: 'tasks',
  task_deleted: 'tasks',
  comment_added: 'tasks',
  assignment: 'tasks',
  agent_created: 'agents',
  agent_status_change: 'agents',
  agent_heartbeat: 'system',
  chat_message: 'social',
  social_post: 'social',
  cost_logged: 'system',
  standup_generated: 'system',
  mention: 'social',
  lifecycle_sync: 'system',
}

const categories = [
  { id: 'all', label: 'All', icon: '⚡' },
  { id: 'tasks', label: 'Tasks', icon: '📋' },
  { id: 'agents', label: 'Agents', icon: '🤖' },
  { id: 'social', label: 'Social', icon: '💬' },
  { id: 'system', label: 'System', icon: '⚙️' },
]

const activityIcons: Record<string, string> = {
  task_created: '✚',
  task_updated: '✎',
  task_deleted: '✖',
  comment_added: '💬',
  agent_created: '🤖',
  agent_status_change: '⚡',
  agent_heartbeat: '💓',
  chat_message: '💭',
  social_post: '📣',
  cost_logged: '💰',
  standup_generated: '📊',
  mention: '📌',
  assignment: '👤',
  lifecycle_sync: '🔄',
}

// Color scheme: green=completed/created, blue=info, yellow=warning, red=error
const activityColors: Record<string, { text: string; bg: string; border: string }> = {
  task_created: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/40' },
  task_updated: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/40' },
  task_deleted: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40' },
  comment_added: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/40' },
  agent_created: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/40' },
  agent_status_change: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/40' },
  agent_heartbeat: { text: 'text-emerald-400/60', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20' },
  chat_message: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/40' },
  social_post: { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/40' },
  cost_logged: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/40' },
  standup_generated: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/40' },
  mention: { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/40' },
  assignment: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/40' },
  lifecycle_sync: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/40' },
}

const defaultColors = { text: 'text-muted-foreground', bg: 'bg-surface-2', border: 'border-border' }

export function ActivityFeedPanel() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [filter, setFilter] = useState({ type: '', actor: '', limit: 50 })
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const [newCount, setNewCount] = useState(0)

  const fetchActivities = useCallback(async (since?: number) => {
    try {
      if (!since) setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (filter.type) params.append('type', filter.type)
      if (filter.actor) params.append('actor', filter.actor)
      if (filter.limit) params.append('limit', filter.limit.toString())
      if (since) params.append('since', Math.floor(since / 1000).toString())

      const response = await fetch(`/api/activities?${params}`)
      if (!response.ok) throw new Error('Failed to fetch activities')

      const data = await response.json()

      if (since) {
        setActivities(prev => {
          const newActivities = data.activities || []
          const existingIds = new Set(prev.map((a: Activity) => a.id))
          const uniqueNew = newActivities.filter((a: Activity) => !existingIds.has(a.id))
          if (uniqueNew.length > 0) setNewCount(c => c + uniqueNew.length)
          return [...uniqueNew, ...prev].slice(0, filter.limit)
        })
      } else {
        setActivities(data.activities || [])
      }

      setLastRefresh(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [filter])

  const lastRefreshRef = useRef(lastRefresh)
  useEffect(() => { lastRefreshRef.current = lastRefresh }, [lastRefresh])

  useEffect(() => { fetchActivities() }, [fetchActivities])

  const pollActivities = useCallback(() => {
    fetchActivities(lastRefreshRef.current)
  }, [fetchActivities])

  // Poll every 10 seconds
  useSmartPoll(pollActivities, 10000, { enabled: autoRefresh })

  // Clear new count after 5 seconds
  useEffect(() => {
    if (newCount > 0) {
      const t = setTimeout(() => setNewCount(0), 5000)
      return () => clearTimeout(t)
    }
  }, [newCount])

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now()
    const diffMs = now - (timestamp * 1000)
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffSec < 30) return 'Just now'
    if (diffMin < 1) return `${diffSec}s ago`
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  // Filter by category
  const filteredActivities = activeCategory === 'all'
    ? activities
    : activities.filter(a => (categoryMap[a.type] || 'system') === activeCategory)

  const actors = Array.from(new Set(activities.map(a => a.actor))).sort()

  // Count per category
  const categoryCounts: Record<string, number> = { all: activities.length }
  activities.forEach(a => {
    const cat = categoryMap[a.type] || 'system'
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
  })

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-foreground">Activity Feed</h2>
          <div className={`w-2.5 h-2.5 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
          {newCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full animate-in fade-in">
              +{newCount} new
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 text-sm rounded-md transition-smooth ${
              autoRefresh
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            {autoRefresh ? '● Live' : '○ Paused'}
          </button>
          <button
            onClick={() => fetchActivities()}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-smooth"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-4 pt-3 pb-2 border-b border-border flex-shrink-0">
        <div className="flex gap-1.5 overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-smooth ${
                activeCategory === cat.id
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              {(categoryCounts[cat.id] ?? 0) > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-2 text-muted-foreground">
                  {categoryCounts[cat.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="px-4 py-2 border-b border-border bg-surface-1/50 flex-shrink-0">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Actor:</label>
            <select
              value={filter.actor}
              onChange={(e) => setFilter(prev => ({ ...prev, actor: e.target.value }))}
              className="bg-surface-2 text-foreground text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50 border border-border"
            >
              <option value="">All</option>
              {actors.map(actor => (
                <option key={actor} value={actor}>{actor}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Show:</label>
            <select
              value={filter.limit}
              onChange={(e) => setFilter(prev => ({ ...prev, limit: parseInt(e.target.value) }))}
              className="bg-surface-2 text-foreground text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50 border border-border"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 m-4 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 ml-2">×</button>
        </div>
      )}

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && activities.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-muted-foreground text-sm">Loading activities...</span>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/50">
            <span className="text-2xl mb-2">📭</span>
            <p className="text-sm">No activities found</p>
            <p className="text-xs mt-1">
              {activeCategory !== 'all' ? 'Try switching categories' : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredActivities.map((activity, index) => {
              const colors = activityColors[activity.type] || defaultColors
              const icon = activityIcons[activity.type] || '•'

              return (
                <div
                  key={`${activity.id}-${index}`}
                  className={`rounded-lg p-3 border-l-3 ${colors.border} ${colors.bg} hover:brightness-110 transition-smooth`}
                  style={{ borderLeftWidth: '3px' }}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs ${colors.bg} ${colors.text}`}>
                      {icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-foreground text-sm">
                            <span className="font-medium text-primary">{activity.actor}</span>
                            {' '}
                            <span className={colors.text}>{activity.description}</span>
                          </p>

                          {/* Entity Details */}
                          {activity.entity && (
                            <div className="mt-1.5 p-2 bg-surface-1/60 rounded-md text-xs border border-border/30">
                              {activity.entity.type === 'task' && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">📋</span>
                                  <span className="text-foreground">{activity.entity.title}</span>
                                  {activity.entity.status && (
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                      activity.entity.status === 'done' ? 'bg-green-500/15 text-green-400' :
                                      activity.entity.status === 'in_progress' ? 'bg-blue-500/15 text-blue-400' :
                                      activity.entity.status === 'failed' ? 'bg-red-500/15 text-red-400' :
                                      'bg-primary/10 text-primary'
                                    }`}>
                                      {activity.entity.status}
                                    </span>
                                  )}
                                </div>
                              )}

                              {activity.entity.type === 'comment' && (
                                <div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">💬 on</span>
                                    <span className="text-foreground">{activity.entity.task_title}</span>
                                  </div>
                                  {activity.entity.content_preview && (
                                    <div className="mt-1 text-muted-foreground/70 italic truncate">
                                      &ldquo;{activity.entity.content_preview}&rdquo;
                                    </div>
                                  )}
                                </div>
                              )}

                              {activity.entity.type === 'agent' && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">🤖</span>
                                  <span className="text-foreground">{activity.entity.name}</span>
                                  {activity.entity.status && (
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                      activity.entity.status === 'online' ? 'bg-green-500/15 text-green-400' :
                                      activity.entity.status === 'offline' ? 'bg-red-500/15 text-red-400' :
                                      'bg-yellow-500/15 text-yellow-400'
                                    }`}>
                                      {activity.entity.status}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Extra data */}
                          {activity.data && Object.keys(activity.data).length > 0 && (
                            <details className="mt-1.5">
                              <summary className="text-xs text-muted-foreground/50 cursor-pointer hover:text-muted-foreground">
                                Details
                              </summary>
                              <pre className="mt-1 text-xs text-muted-foreground bg-surface-1 p-2 rounded-md overflow-auto max-h-24 border border-border/30">
                                {JSON.stringify(activity.data, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>

                        {/* Timestamp */}
                        <div className="flex-shrink-0 text-[10px] text-muted-foreground/50 whitespace-nowrap">
                          {formatRelativeTime(activity.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-3 bg-surface-1 text-xs text-muted-foreground flex-shrink-0">
        <div className="flex justify-between items-center">
          <span>
            {filteredActivities.length} of {activities.length} activities
            {activeCategory !== 'all' && ` (${activeCategory})`}
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
            Polling every 10s · {new Date(lastRefresh).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  )
}
