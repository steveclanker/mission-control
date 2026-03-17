'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────

interface DigestData {
  summary?: string
  highlights?: string[]
  concerns?: string[]
  stats?: {
    tasks_completed?: number
    tasks_created?: number
    total_cost?: number
    sessions_count?: number
    uptime?: string
    [key: string]: any
  }
}

interface Activity {
  id: string
  type: string
  title?: string
  description?: string
  timestamp: string
  created_at?: string
  metadata?: any
}

interface Task {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  due_date?: string
  assigned_to?: string
  created_at?: string
}

interface CalendarEvent {
  id: string
  title: string
  start_time: string
  end_time: string
  description?: string
  location?: string
  attendees?: string[]
  calendar_name?: string
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  urgent: 'text-red-400 bg-red-500/10 border-red-500/20',
  high: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  low: 'text-green-400 bg-green-500/10 border-green-500/20',
}

const STATUS_ICONS: Record<string, string> = {
  pending: '⏳',
  in_progress: '🔄',
  executing: '⚡',
  todo: '📋',
  assigned: '📌',
}

// ─── Helpers ─────────────────────────────────────────────────────────

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── Component ───────────────────────────────────────────────────────

export function DailySummaryPanel() {
  const [digest, setDigest] = useState<DigestData | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [completedTasks, setCompletedTasks] = useState<Task[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const [digestRes, activitiesRes, tasksRes, calendarRes] = await Promise.allSettled([
        fetch('/api/digest'),
        fetch('/api/activities?limit=30'),
        fetch('/api/tasks'),
        fetch('/api/calendar/today'),
      ])

      if (digestRes.status === 'fulfilled' && digestRes.value.ok) {
        const data = await digestRes.value.json()
        setDigest(data)
      }

      if (activitiesRes.status === 'fulfilled' && activitiesRes.value.ok) {
        const data = await activitiesRes.value.json()
        const list = Array.isArray(data) ? data : data.activities || []
        setActivities(list.filter((a: Activity) => {
          const ts = a.timestamp || a.created_at
          return ts ? isToday(ts) : false
        }))
      }

      if (tasksRes.status === 'fulfilled' && tasksRes.value.ok) {
        const data = await tasksRes.value.json()
        const list = Array.isArray(data) ? data : data.tasks || []
        setTasks(
          list
            .filter((t: Task) => ['pending', 'in_progress', 'executing', 'todo', 'assigned'].includes(t.status))
            .sort((a: Task, b: Task) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))
        )
        setCompletedTasks(
          list
            .filter((t: Task) => ['done', 'completed'].includes(t.status))
            .sort((a: Task, b: Task) => {
              const aTime = new Date(b.created_at || 0).getTime()
              const bTime = new Date(a.created_at || 0).getTime()
              return aTime - bTime
            })
        )
      }

      if (calendarRes.status === 'fulfilled' && calendarRes.value.ok) {
        const data = await calendarRes.value.json()
        const events = Array.isArray(data) ? data : data.events || []
        setCalendarEvents(
          events
            .filter((e: CalendarEvent) => isToday(e.start_time))
            .sort((a: CalendarEvent, b: CalendarEvent) => 
              new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
            )
        )
      }

      setError(null)
    } catch (err) {
      setError('Failed to load daily summary')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => fetchAll(false), 60000)
    return () => clearInterval(interval)
  }, [fetchAll])

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-card rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-card rounded-xl" />)}
        </div>
        <div className="h-64 bg-card rounded-xl" />
      </div>
    )
  }

  const completedToday = digest?.stats?.tasks_completed ?? 0
  const tasksRemaining = tasks.length
  const costToday = digest?.stats?.total_cost
  const uptime = digest?.stats?.uptime

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <span className="text-lg">☀️</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{getGreeting()}, Jad</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-AU', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all disabled:opacity-50"
          title="Refresh"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1.5 8a6.5 6.5 0 0111.3-4.4M14.5 8a6.5 6.5 0 01-11.3 4.4" />
            <polyline points="1.5,3 1.5,8 6,8" />
            <polyline points="14.5,13 14.5,8 10,8" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Completed Today"
          value={completedToday}
          icon="✅"
          color="text-green-400"
        />
        <StatCard
          label="Tasks Remaining"
          value={tasksRemaining}
          icon="📋"
          color="text-blue-400"
        />
        <StatCard
          label="API Cost Today"
          value={costToday != null ? `$${costToday.toFixed(2)}` : '—'}
          icon="💰"
          color="text-amber-400"
        />
        <StatCard
          label="Agent Uptime"
          value={uptime ?? '—'}
          icon="⚡"
          color="text-violet-400"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Today's Activity */}
        <SectionCard title="Today's Activity" icon="🤖" subtitle="What Iris did">
          {digest?.summary && (
            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{digest.summary}</p>
          )}

          {digest?.highlights && digest.highlights.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-1.5">Highlights</p>
              <ul className="space-y-1">
                {digest.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span className="text-green-400 mt-0.5 shrink-0">▸</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {digest?.concerns && digest.concerns.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-1.5">Concerns</p>
              <ul className="space-y-1">
                {digest.concerns.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-400/90">
                    <span className="mt-0.5 shrink-0">⚠️</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activities.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-1.5">Activity Log</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {activities.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-start gap-2 text-sm">
                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5 font-mono">
                      {formatTime(a.timestamp || a.created_at || '')}
                    </span>
                    <span className="text-foreground/80 truncate">{a.title || a.description || a.type}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : !digest?.summary ? (
            <p className="text-sm text-muted-foreground/60 italic">No activity recorded today yet.</p>
          ) : null}
        </SectionCard>

        {/* Pending Tasks */}
        <SectionCard title="Your Todos" icon="📝" subtitle={`${tasks.length} pending`}>
          {tasks.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {tasks.map((t) => (
                <div key={t.id} className="p-2.5 rounded-lg bg-secondary/50 border border-border/50 hover:border-border transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs">{STATUS_ICONS[t.status] || '📋'}</span>
                        <span className="text-sm font-medium text-foreground truncate">{t.title}</span>
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 ml-5">{t.description}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${PRIORITY_COLORS[t.priority] || 'text-muted-foreground bg-secondary border-border'}`}>
                      {t.priority}
                    </span>
                  </div>
                  {t.due_date && (
                    <div className="flex items-center gap-1 mt-1 ml-5">
                      <span className="text-[10px] text-muted-foreground">Due: {new Date(t.due_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="text-3xl mb-2">🎉</span>
              <p className="text-sm text-muted-foreground">All clear! No pending tasks.</p>
            </div>
          )}
        </SectionCard>

        {/* Completed Tasks */}
        <SectionCard title="Completed" icon="✅" subtitle={`${completedTasks.length} done`}>
          {completedTasks.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {completedTasks.map((t) => (
                <div key={t.id} className="p-2.5 rounded-lg bg-green-500/5 border border-green-500/10 hover:border-green-500/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs">✅</span>
                        <span className="text-sm font-medium text-foreground/70 line-through decoration-green-500/30 truncate">{t.title}</span>
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground/60 line-clamp-1 ml-5">{t.description}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${PRIORITY_COLORS[t.priority] || 'text-muted-foreground bg-secondary border-border'}`}>
                      {t.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="text-3xl mb-2">🏗️</span>
              <p className="text-sm text-muted-foreground">No completed tasks yet today.</p>
            </div>
          )}
        </SectionCard>

        {/* Today's Calendar */}
        <CalendarSection />

        {/* Daily Digest Summary */}
        <SectionCard title="Quick Actions" icon="⚡" subtitle="Jump to...">
          <div className="grid grid-cols-2 gap-2">
            <QuickAction href="/tasks" icon="📋" label="Task Board" />
            <QuickAction href="/activity" icon="📊" label="Activity Feed" />
            <QuickAction href="/agents" icon="🤖" label="Agents" />
            <QuickAction href="/analytics" icon="📈" label="Analytics" />
            <QuickAction href="/costs" icon="💰" label="Costs" />
            <QuickAction href="/cron" icon="⏰" label="Cron Jobs" />
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="p-3.5 rounded-xl bg-card border border-border hover:border-border/80 transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base">{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
    </div>
  )
}

function SectionCard({ title, icon, subtitle, children }: { title: string; icon: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{icon}</span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && (
          <span className="text-xs text-muted-foreground ml-auto">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/50 border border-border/50 hover:bg-secondary hover:border-border transition-all text-sm text-foreground/80 hover:text-foreground"
    >
      <span>{icon}</span>
      <span className="truncate">{label}</span>
    </a>
  )
}

function CalendarSection() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCalendarEvents = async () => {
      try {
        const response = await fetch('/api/calendar/today')
        if (response.ok) {
          const data = await response.json()
          const eventList = Array.isArray(data) ? data : data.events || []
          setEvents(
            eventList
              .filter((e: CalendarEvent) => isToday(e.start_time))
              .sort((a: CalendarEvent, b: CalendarEvent) => 
                new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
              )
          )
        } else {
          setError('Failed to load calendar')
        }
      } catch (err) {
        setError('Calendar unavailable')
      } finally {
        setLoading(false)
      }
    }

    fetchCalendarEvents()
  }, [])

  const formatEventTime = (startTime: string, endTime: string) => {
    const start = new Date(startTime)
    const end = new Date(endTime)
    const startStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const endStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return `${startStr} - ${endStr}`
  }

  const getEventStatus = (startTime: string, endTime: string) => {
    const now = new Date()
    const start = new Date(startTime)
    const end = new Date(endTime)
    
    if (now < start) return { status: 'upcoming', color: 'bg-blue-500/40' }
    if (now >= start && now <= end) return { status: 'current', color: 'bg-green-500/40' }
    return { status: 'past', color: 'bg-gray-500/40' }
  }

  const getNextEvent = () => {
    const now = new Date()
    return events.find(e => new Date(e.start_time) > now)
  }

  const currentEvent = events.find(e => {
    const now = new Date()
    const start = new Date(e.start_time)
    const end = new Date(e.end_time)
    return now >= start && now <= end
  })

  const nextEvent = getNextEvent()

  return (
    <SectionCard 
      title="Today's Schedule" 
      icon="📅" 
      subtitle={loading ? "Loading..." : `${events.length} events`}
    >
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 animate-pulse">
              <div className="w-1 h-8 rounded-full bg-muted-foreground/20" />
              <div className="flex-1">
                <div className="h-3 w-32 bg-muted-foreground/20 rounded" />
                <div className="h-2.5 w-20 bg-muted-foreground/10 rounded mt-1" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-sm font-medium text-foreground/80 mb-1">Calendar Error</p>
          <p className="text-xs text-muted-foreground max-w-[220px]">
            {error}
          </p>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
            <span className="text-2xl">🏖️</span>
          </div>
          <p className="text-sm font-medium text-foreground/80 mb-1">Free Day</p>
          <p className="text-xs text-muted-foreground max-w-[220px]">
            No events scheduled for today. Time to focus!
          </p>
        </div>
      ) : (
        <div>
          {/* Current/Next Event Highlight */}
          {(currentEvent || nextEvent) && (
            <div className="mb-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
              {currentEvent ? (
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-medium text-green-400">HAPPENING NOW</span>
                </div>
              ) : nextEvent ? (
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs font-medium text-blue-400">UP NEXT</span>
                </div>
              ) : null}
              
              {(currentEvent || nextEvent) && (
                <div className="ml-4">
                  <p className="text-sm font-medium text-foreground">
                    {(currentEvent || nextEvent)!.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatEventTime(
                      (currentEvent || nextEvent)!.start_time, 
                      (currentEvent || nextEvent)!.end_time
                    )}
                  </p>
                  {(currentEvent || nextEvent)!.location && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      📍 {(currentEvent || nextEvent)!.location}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Full Event List */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {events.map((event) => {
              const { status, color } = getEventStatus(event.start_time, event.end_time)
              const isCurrent = currentEvent?.id === event.id
              const isNext = nextEvent?.id === event.id && !currentEvent
              
              return (
                <div 
                  key={event.id} 
                  className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                    isCurrent ? 'bg-green-500/10 border border-green-500/20' :
                    isNext ? 'bg-blue-500/10 border border-blue-500/20' :
                    'bg-secondary/50 hover:bg-secondary border border-transparent'
                  }`}
                >
                  <div className={`w-1 h-8 rounded-full ${color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium truncate ${
                        status === 'past' ? 'text-muted-foreground line-through' : 'text-foreground'
                      }`}>
                        {event.title}
                      </p>
                      {isCurrent && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                          LIVE
                        </span>
                      )}
                      {isNext && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          NEXT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatEventTime(event.start_time, event.end_time)}
                      </span>
                      {event.location && (
                        <span className="text-xs text-muted-foreground truncate">
                          📍 {event.location}
                        </span>
                      )}
                    </div>
                    {event.attendees && event.attendees.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-muted-foreground">
                          👥 {event.attendees.length} attendee{event.attendees.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </SectionCard>
  )
}
