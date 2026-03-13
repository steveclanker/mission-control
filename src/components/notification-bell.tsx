'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMissionControl } from '@/store'
import {
  isPushSupported,
  getPermissionState,
  requestPermission,
  registerServiceWorker,
  PushPermissionState,
} from '@/lib/notifications-push'

interface NotifItem {
  id: number
  recipient: string
  type: string
  title: string
  message: string
  read_at: number | null
  created_at: number
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function typeIcon(type: string): string {
  switch (type) {
    case 'assignment': return '📋'
    case 'mention': return '@'
    case 'status_change': return '🤖'
    case 'due_date': return '⏰'
    case 'chat_message': return '💬'
    default: return '🔔'
  }
}

export function NotificationBell() {
  const { currentUser } = useMissionControl()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotifItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pushState, setPushState] = useState<PushPermissionState>('default')
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const recipient = currentUser?.username || 'jad'

  // Initialize push state
  useEffect(() => {
    if (isPushSupported()) {
      setPushState(getPermissionState())
      registerServiceWorker()
    } else {
      setPushState('unsupported')
    }
  }, [])

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?recipient=${encodeURIComponent(recipient)}&limit=20`)
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {
      // silent
    }
  }, [recipient])

  // Poll every 15s
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 15000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleEnablePush = async () => {
    const result = await requestPermission()
    setPushState(result)
  }

  const markAllRead = async () => {
    setLoading(true)
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, markAllRead: true }),
    })
    await fetchNotifications()
    setLoading(false)
  }

  const markRead = async (id: number) => {
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read_at: Math.floor(Date.now() / 1000) } : n))
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-smooth flex items-center justify-center relative"
        title="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-2xs flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-80 max-h-[28rem] bg-card border border-border rounded-lg shadow-xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            <div className="flex items-center gap-2">
              {pushState === 'default' && (
                <button
                  onClick={handleEnablePush}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary hover:bg-primary/25 transition-smooth"
                >
                  Enable push
                </button>
              )}
              {pushState === 'granted' && (
                <span className="text-[10px] text-green-400">🔔 Push on</span>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-smooth"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="text-2xl mb-2">🔔</span>
                <p className="text-xs text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => !n.read_at && markRead(n.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-border/30 hover:bg-surface-1/50 transition-smooth ${
                    !n.read_at ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm mt-0.5 flex-shrink-0">{typeIcon(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-xs font-medium truncate ${!n.read_at ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {n.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{n.message}</p>
                    </div>
                    {!n.read_at && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BellIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 13h4M3.5 10c0-1-1-2-1-4a5.5 5.5 0 0111 0c0 2-1 3-1 4H3.5z" />
    </svg>
  )
}
