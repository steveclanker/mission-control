/**
 * Metrics Engine - Agent Performance Analytics
 * 
 * Tracks and calculates:
 * - Agent uptime and activity
 * - Task completion rates and speed
 * - Performance trends over time
 * - Executive dashboard metrics
 */

import { getDatabase } from '@/lib/db'
import { logger } from '@/lib/logger'

export interface AgentMetrics {
  agent_id: string
  date: string
  tasks_completed: number
  tasks_failed: number
  avg_completion_time_minutes: number
  success_rate: number
  uptime_hours: number
  active_hours: number
}

export interface DashboardMetrics {
  total_tasks: number
  tasks_today: number
  tasks_this_week: number
  completion_rate: number
  avg_completion_time: number
  active_agents: number
  tasks_by_status: Record<string, number>
  tasks_by_priority: Record<string, number>
  daily_trends: Array<{
    date: string
    completed: number
    created: number
  }>
  agent_performance: Array<{
    agent_id: string
    tasks_completed: number
    avg_time: number
    success_rate: number
  }>
}

export interface TaskAnalytics {
  task_id: number
  title: string
  created_at: number
  started_at: number | null
  completed_at: number | null
  total_duration_minutes: number | null
  execution_duration_minutes: number | null
  status: string
  execution_status: string
  agent_id: string | null
  priority: string
}

/**
 * Metrics Engine Class
 */
export class MetricsEngine {
  private db: ReturnType<typeof getDatabase>
  private workspaceId: number

  constructor(workspaceId: number = 1) {
    this.db = getDatabase()
    this.workspaceId = workspaceId
  }

  /**
   * Get comprehensive dashboard metrics
   */
  getDashboardMetrics(): DashboardMetrics {
    const now = Math.floor(Date.now() / 1000)
    const todayStart = now - (now % 86400)
    const weekStart = todayStart - (7 * 86400)

    // Total tasks
    const totalTasks = this.db.prepare(`
      SELECT COUNT(*) as count FROM tasks WHERE workspace_id = ?
    `).get(this.workspaceId) as { count: number }

    // Tasks today
    const tasksToday = this.db.prepare(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE workspace_id = ? AND created_at >= ?
    `).get(this.workspaceId, todayStart) as { count: number }

    // Tasks this week
    const tasksThisWeek = this.db.prepare(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE workspace_id = ? AND created_at >= ?
    `).get(this.workspaceId, weekStart) as { count: number }

    // Completion rate
    const completedTasks = this.db.prepare(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE workspace_id = ? AND status = 'done'
    `).get(this.workspaceId) as { count: number }
    
    const completionRate = totalTasks.count > 0 
      ? (completedTasks.count / totalTasks.count) * 100 
      : 0

    // Average completion time (for completed tasks with timing data)
    const avgTime = this.db.prepare(`
      SELECT AVG((completed_at - started_at) / 60.0) as avg_minutes
      FROM tasks 
      WHERE workspace_id = ? AND completed_at IS NOT NULL AND started_at IS NOT NULL
    `).get(this.workspaceId) as { avg_minutes: number | null }

    // Active agents (heartbeat in last hour)
    const activeAgents = this.db.prepare(`
      SELECT COUNT(DISTINCT agent_id) as count FROM tasks 
      WHERE workspace_id = ? AND execution_status = 'executing'
    `).get(this.workspaceId) as { count: number }

    // Tasks by status
    const statusCounts = this.db.prepare(`
      SELECT status, COUNT(*) as count FROM tasks 
      WHERE workspace_id = ?
      GROUP BY status
    `).all(this.workspaceId) as Array<{ status: string; count: number }>
    
    const tasksByStatus: Record<string, number> = {}
    statusCounts.forEach(row => {
      tasksByStatus[row.status] = row.count
    })

    // Tasks by priority
    const priorityCounts = this.db.prepare(`
      SELECT priority, COUNT(*) as count FROM tasks 
      WHERE workspace_id = ?
      GROUP BY priority
    `).all(this.workspaceId) as Array<{ priority: string; count: number }>
    
    const tasksByPriority: Record<string, number> = {}
    priorityCounts.forEach(row => {
      tasksByPriority[row.priority] = row.count
    })

    // Daily trends (last 14 days)
    const dailyTrends = this.getDailyTrends(14)

    // Agent performance
    const agentPerformance = this.getAgentPerformance()

    return {
      total_tasks: totalTasks.count,
      tasks_today: tasksToday.count,
      tasks_this_week: tasksThisWeek.count,
      completion_rate: Math.round(completionRate * 10) / 10,
      avg_completion_time: avgTime.avg_minutes ? Math.round(avgTime.avg_minutes) : 0,
      active_agents: activeAgents.count,
      tasks_by_status: tasksByStatus,
      tasks_by_priority: tasksByPriority,
      daily_trends: dailyTrends,
      agent_performance: agentPerformance
    }
  }

  /**
   * Get daily task trends
   */
  getDailyTrends(days: number = 14): Array<{ date: string; completed: number; created: number }> {
    const now = Math.floor(Date.now() / 1000)
    const trends: Array<{ date: string; completed: number; created: number }> = []

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = now - (now % 86400) - (i * 86400)
      const dayEnd = dayStart + 86400
      const dateStr = new Date(dayStart * 1000).toISOString().split('T')[0]

      const completed = this.db.prepare(`
        SELECT COUNT(*) as count FROM tasks 
        WHERE workspace_id = ? AND completed_at >= ? AND completed_at < ?
      `).get(this.workspaceId, dayStart, dayEnd) as { count: number }

      const created = this.db.prepare(`
        SELECT COUNT(*) as count FROM tasks 
        WHERE workspace_id = ? AND created_at >= ? AND created_at < ?
      `).get(this.workspaceId, dayStart, dayEnd) as { count: number }

      trends.push({
        date: dateStr,
        completed: completed.count,
        created: created.count
      })
    }

    return trends
  }

  /**
   * Get agent performance metrics
   */
  getAgentPerformance(): Array<{
    agent_id: string
    tasks_completed: number
    avg_time: number
    success_rate: number
  }> {
    const agents = this.db.prepare(`
      SELECT 
        COALESCE(agent_id, assigned_to, 'unassigned') as agent_id,
        COUNT(*) as total_tasks,
        SUM(CASE WHEN execution_status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN execution_status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(CASE 
          WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
          THEN (completed_at - started_at) / 60.0 
          ELSE NULL 
        END) as avg_minutes
      FROM tasks 
      WHERE workspace_id = ? AND (agent_id IS NOT NULL OR assigned_to IS NOT NULL)
      GROUP BY COALESCE(agent_id, assigned_to)
      ORDER BY completed DESC
    `).all(this.workspaceId) as Array<{
      agent_id: string
      total_tasks: number
      completed: number
      failed: number
      avg_minutes: number | null
    }>

    return agents.map(agent => ({
      agent_id: agent.agent_id,
      tasks_completed: agent.completed,
      avg_time: agent.avg_minutes ? Math.round(agent.avg_minutes) : 0,
      success_rate: agent.total_tasks > 0 
        ? Math.round((agent.completed / agent.total_tasks) * 100) 
        : 0
    }))
  }

  /**
   * Get task timing analytics
   */
  getTaskAnalytics(limit: number = 50): TaskAnalytics[] {
    const tasks = this.db.prepare(`
      SELECT 
        id as task_id,
        title,
        created_at,
        started_at,
        completed_at,
        status,
        execution_status,
        agent_id,
        priority
      FROM tasks 
      WHERE workspace_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(this.workspaceId, limit) as Array<{
      task_id: number
      title: string
      created_at: number
      started_at: number | null
      completed_at: number | null
      status: string
      execution_status: string
      agent_id: string | null
      priority: string
    }>

    return tasks.map(task => ({
      ...task,
      total_duration_minutes: task.completed_at && task.created_at
        ? Math.round((task.completed_at - task.created_at) / 60)
        : null,
      execution_duration_minutes: task.completed_at && task.started_at
        ? Math.round((task.completed_at - task.started_at) / 60)
        : null
    }))
  }

  /**
   * Record agent heartbeat for uptime tracking
   */
  recordAgentHeartbeat(agentId: string, status: string = 'online'): void {
    const now = Math.floor(Date.now() / 1000)
    const today = new Date().toISOString().split('T')[0]

    // Check if we have a record for today
    const existing = this.db.prepare(`
      SELECT id, uptime_hours FROM agent_metrics 
      WHERE agent_id = ? AND date = ? AND workspace_id = ?
    `).get(agentId, today, this.workspaceId) as { id: number; uptime_hours: number } | undefined

    if (existing) {
      // Update existing record (add 5 minutes of uptime per heartbeat)
      this.db.prepare(`
        UPDATE agent_metrics 
        SET uptime_hours = uptime_hours + 0.0833
        WHERE id = ?
      `).run(existing.id)
    } else {
      // Create new record for today
      this.db.prepare(`
        INSERT INTO agent_metrics (agent_id, date, uptime_hours, workspace_id)
        VALUES (?, ?, 0.0833, ?)
      `).run(agentId, today, this.workspaceId)
    }
  }

  /**
   * Get agent uptime for a date range
   */
  getAgentUptime(agentId: string, days: number = 7): Array<{ date: string; uptime_hours: number }> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    return this.db.prepare(`
      SELECT date, uptime_hours FROM agent_metrics 
      WHERE agent_id = ? AND date >= ? AND workspace_id = ?
      ORDER BY date ASC
    `).all(agentId, startDateStr, this.workspaceId) as Array<{ date: string; uptime_hours: number }>
  }

  /**
   * Export metrics as CSV
   */
  exportTasksCSV(): string {
    const tasks = this.getTaskAnalytics(1000)
    
    const headers = [
      'task_id', 'title', 'status', 'execution_status', 'priority',
      'agent_id', 'created_at', 'started_at', 'completed_at',
      'total_duration_minutes', 'execution_duration_minutes'
    ]
    
    const rows = tasks.map(task => [
      task.task_id,
      `"${task.title.replace(/"/g, '""')}"`,
      task.status,
      task.execution_status,
      task.priority,
      task.agent_id || '',
      new Date(task.created_at * 1000).toISOString(),
      task.started_at ? new Date(task.started_at * 1000).toISOString() : '',
      task.completed_at ? new Date(task.completed_at * 1000).toISOString() : '',
      task.total_duration_minutes || '',
      task.execution_duration_minutes || ''
    ].join(','))

    return [headers.join(','), ...rows].join('\n')
  }
}

// Global instance
let globalMetricsEngine: MetricsEngine | null = null

export function getMetricsEngine(workspaceId: number = 1): MetricsEngine {
  if (!globalMetricsEngine || globalMetricsEngine['workspaceId'] !== workspaceId) {
    globalMetricsEngine = new MetricsEngine(workspaceId)
  }
  return globalMetricsEngine
}