'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMissionControl } from '@/store'

/**
 * Real-Time Hub - Polling-based real-time updates
 * 
 * This provides real-time-like updates via efficient polling.
 * Works through Cloudflare tunnels and anywhere WebSocket fails.
 * 
 * Features:
 * - Automatic polling with configurable intervals
 * - Smart batching of updates
 * - Agent status streaming
 * - Task progress updates
 * - Instant notification delivery
 */

export interface RealTimeConfig {
  enabled: boolean
  pollIntervalMs: number
  agentStatusIntervalMs: number
  taskStatusIntervalMs: number
  notificationIntervalMs: number
}

export interface AgentStatus {
  id: string
  name: string
  status: 'online' | 'offline' | 'busy' | 'idle'
  last_seen: number
  current_task?: string
  uptime_hours?: number
}

export interface TaskUpdate {
  id: number
  title: string
  status: string
  execution_status: string
  progress?: number
  updated_at: number
}

export interface Notification {
  id: string
  type: 'task_completed' | 'task_failed' | 'agent_online' | 'agent_offline' | 'mention' | 'assignment'
  title: string
  message: string
  timestamp: number
  read: boolean
}

const DEFAULT_CONFIG: RealTimeConfig = {
  enabled: true,
  pollIntervalMs: 30000,      // 30 seconds for general updates
  agentStatusIntervalMs: 15000, // 15 seconds for agent status
  taskStatusIntervalMs: 10000,  // 10 seconds for active task updates
  notificationIntervalMs: 20000 // 20 seconds for notifications
}

/**
 * Hook for real-time agent status updates
 */
export function useAgentStatus() {
  const [agents, setAgents] = useState<AgentStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchAgentStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/agents?limit=50')
      if (!response.ok) throw new Error('Failed to fetch agent status')
      const data = await response.json()
      
      const agentStatuses: AgentStatus[] = (data.agents || []).map((agent: any) => ({
        id: agent.id,
        name: agent.name,
        status: determineAgentStatus(agent.last_seen, agent.status),
        last_seen: agent.last_seen,
        current_task: agent.current_task,
        uptime_hours: agent.uptime_hours
      }))
      
      setAgents(agentStatuses)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgentStatus()
    intervalRef.current = setInterval(fetchAgentStatus, DEFAULT_CONFIG.agentStatusIntervalMs)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchAgentStatus])

  return { agents, loading, error, refresh: fetchAgentStatus }
}

/**
 * Hook for real-time task updates
 */
export function useTaskUpdates(taskIds?: number[]) {
  const [tasks, setTasks] = useState<TaskUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchTasks = useCallback(async () => {
    try {
      const url = taskIds && taskIds.length > 0
        ? `/api/tasks?ids=${taskIds.join(',')}`
        : '/api/tasks?status=in_progress,executing&limit=20'
      
      const response = await fetch(url)
      if (!response.ok) return
      const data = await response.json()
      
      const taskUpdates: TaskUpdate[] = (data.tasks || []).map((task: any) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        execution_status: task.execution_status || 'pending',
        progress: task.progress,
        updated_at: task.updated_at
      }))
      
      setTasks(taskUpdates)
    } catch (err) {
      console.error('Failed to fetch task updates:', err)
    } finally {
      setLoading(false)
    }
  }, [taskIds])

  useEffect(() => {
    fetchTasks()
    intervalRef.current = setInterval(fetchTasks, DEFAULT_CONFIG.taskStatusIntervalMs)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchTasks])

  return { tasks, loading, refresh: fetchTasks }
}

/**
 * Hook for real-time notifications
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications?limit=20')
      if (!response.ok) return
      const data = await response.json()
      
      const notifs: Notification[] = (data.notifications || []).map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: n.created_at,
        read: n.read_at !== null
      }))
      
      setNotifications(notifs)
      setUnreadCount(notifs.filter(n => !n.read).length)
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    }
  }, [])

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' })
      fetchNotifications()
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }, [fetchNotifications])

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' })
      fetchNotifications()
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    }
  }, [fetchNotifications])

  useEffect(() => {
    fetchNotifications()
    intervalRef.current = setInterval(fetchNotifications, DEFAULT_CONFIG.notificationIntervalMs)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchNotifications])

  return { notifications, unreadCount, markAsRead, markAllAsRead, refresh: fetchNotifications }
}

/**
 * Hook for real-time dashboard metrics
 */
export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/analytics?type=dashboard')
      if (!response.ok) return
      const data = await response.json()
      setMetrics(data.metrics)
    } catch (err) {
      console.error('Failed to fetch metrics:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
    intervalRef.current = setInterval(fetchMetrics, DEFAULT_CONFIG.pollIntervalMs)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchMetrics])

  return { metrics, loading, refresh: fetchMetrics }
}

/**
 * Combined real-time updates hook
 */
export function useRealTimeUpdates(config: Partial<RealTimeConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const { addLog } = useMissionControl()
  
  const agentStatus = useAgentStatus()
  const taskUpdates = useTaskUpdates()
  const notifications = useNotifications()
  const dashboardMetrics = useDashboardMetrics()

  // Log significant changes
  useEffect(() => {
    if (notifications.unreadCount > 0) {
      addLog({
        id: `notif-${Date.now()}`,
        timestamp: Date.now(),
        level: 'info',
        source: 'real-time',
        message: `${notifications.unreadCount} unread notification(s)`
      })
    }
  }, [notifications.unreadCount, addLog])

  return {
    agents: agentStatus,
    tasks: taskUpdates,
    notifications,
    metrics: dashboardMetrics,
    isConnected: true // Always "connected" with polling
  }
}

// Helper functions

function determineAgentStatus(lastSeen: number | null, reportedStatus: string): AgentStatus['status'] {
  if (!lastSeen) return 'offline'
  
  const now = Math.floor(Date.now() / 1000)
  const timeSinceLastSeen = now - lastSeen
  
  // If last seen within 5 minutes and reported online, they're online
  if (timeSinceLastSeen < 300 && reportedStatus === 'online') {
    return 'online'
  }
  
  // If last seen within 15 minutes, they're idle
  if (timeSinceLastSeen < 900) {
    return 'idle'
  }
  
  // Otherwise offline
  return 'offline'
}