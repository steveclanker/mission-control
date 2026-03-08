/**
 * Task Sync Engine - Central orchestration for unified task management
 * 
 * This module synchronizes tasks across all systems:
 * - Telegram ↔ Mission Control
 * - Supabase ↔ Mission Control  
 * - AI Dashboard ↔ Mission Control
 * - Agent execution ↔ Mission Control
 */

import { getDatabase, Task } from '@/lib/db'
import { eventBus } from '@/lib/event-bus'
import { logger } from '@/lib/logger'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface TaskSyncOptions {
  workspaceId: number
  agentId?: string
  source: 'telegram' | 'supabase' | 'dashboard' | 'manual' | 'agent'
}

export interface ExternalTask {
  id: string
  title: string
  description?: string
  status: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  assignedTo?: string
  source: string
  metadata?: Record<string, any>
}

export interface ExecutionUpdate {
  taskId: number
  status: 'pending' | 'executing' | 'completed' | 'failed'
  progress?: number
  details?: string
  error?: string
}

/**
 * Central Task Sync Engine
 */
export class TaskSyncEngine {
  private db: ReturnType<typeof getDatabase>
  private workspaceId: number

  constructor(workspaceId: number = 1) {
    this.db = getDatabase()
    this.workspaceId = workspaceId
  }

  /**
   * Import task from external system into Mission Control
   */
  async importTask(externalTask: ExternalTask, options: TaskSyncOptions): Promise<number> {
    const now = Math.floor(Date.now() / 1000)
    
    // Check if task already exists
    const existing = this.db.prepare(`
      SELECT id FROM tasks 
      WHERE external_id = ? AND source = ? AND workspace_id = ?
    `).get(externalTask.id, externalTask.source, options.workspaceId) as { id: number } | undefined

    if (existing) {
      logger.info(`Task ${externalTask.id} from ${externalTask.source} already exists as ${existing.id}`)
      return existing.id
    }

    // Get default project
    const defaultProject = this.db.prepare(`
      SELECT id FROM projects 
      WHERE workspace_id = ? AND status = 'active'
      ORDER BY CASE WHEN slug = 'general' THEN 0 ELSE 1 END, id ASC
      LIMIT 1
    `).get(options.workspaceId) as { id: number } | undefined

    if (!defaultProject) {
      throw new Error(`No active project available in workspace ${options.workspaceId}`)
    }

    // Update project ticket counter
    this.db.prepare(`
      UPDATE projects 
      SET ticket_counter = ticket_counter + 1, updated_at = unixepoch()
      WHERE id = ? AND workspace_id = ?
    `).run(defaultProject.id, options.workspaceId)

    const projectInfo = this.db.prepare(`
      SELECT ticket_counter FROM projects 
      WHERE id = ? AND workspace_id = ?
    `).get(defaultProject.id, options.workspaceId) as { ticket_counter: number }

    // Create task
    const insertStmt = this.db.prepare(`
      INSERT INTO tasks (
        title, description, status, priority, project_id, project_ticket_no,
        assigned_to, created_by, created_at, updated_at, 
        source, external_id, agent_id, execution_status, workspace_id, tags, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = insertStmt.run(
      externalTask.title,
      externalTask.description || '',
      this.normalizeStatus(externalTask.status),
      externalTask.priority || 'medium',
      defaultProject.id,
      projectInfo.ticket_counter,
      externalTask.assignedTo,
      `${externalTask.source}-sync`,
      now,
      now,
      externalTask.source,
      externalTask.id,
      options.agentId,
      'pending',
      options.workspaceId,
      JSON.stringify(['auto-imported', externalTask.source]),
      JSON.stringify(externalTask.metadata || {})
    )

    const taskId = Number(result.lastInsertRowid)
    
    logger.info(`Imported task ${externalTask.id} from ${externalTask.source} as MC task ${taskId}`)

    // Broadcast to real-time clients
    const createdTask = this.getTaskById(taskId)
    if (createdTask) {
      eventBus.broadcast('task.imported', {
        ...createdTask,
        source: externalTask.source,
        external_id: externalTask.id
      })
    }

    return taskId
  }

  /**
   * Sync task status back to external systems
   */
  async syncTaskStatus(taskId: number, newStatus: string): Promise<void> {
    const task = this.getTaskById(taskId)
    if (!task) {
      logger.error(`Task ${taskId} not found for status sync`)
      return
    }

    const now = Math.floor(Date.now() / 1000)

    // Update local task
    this.db.prepare(`
      UPDATE tasks 
      SET status = ?, updated_at = ?
      WHERE id = ? AND workspace_id = ?
    `).run(newStatus, now, taskId, this.workspaceId)

    // Sync to external systems based on source
    try {
      switch (task.source) {
        case 'supabase':
          await this.syncToSupabase(task, newStatus)
          break
        case 'dashboard':
          await this.syncToDashboard(task, newStatus)
          break
        case 'telegram':
          await this.syncToTelegram(task, newStatus)
          break
      }
    } catch (error) {
      logger.error({ err: error, taskId, newStatus }, 'Failed to sync task status to external system')
    }

    // Broadcast status change
    eventBus.broadcast('task.status_changed', {
      id: taskId,
      status: newStatus,
      updated_at: now,
      source: task.source
    })
  }

  /**
   * Update task execution status
   */
  async updateExecution(update: ExecutionUpdate): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    
    const updateFields: string[] = ['execution_status = ?', 'updated_at = ?']
    const values: any[] = [update.status, now]

    if (update.status === 'executing' && !update.details?.includes('started_at')) {
      updateFields.push('started_at = ?')
      values.push(now)
    }

    if (update.status === 'completed' || update.status === 'failed') {
      updateFields.push('completed_at = ?')
      values.push(now)

      // Also update main status
      const mainStatus = update.status === 'completed' ? 'done' : 'blocked'
      updateFields.push('status = ?')
      values.push(mainStatus)
    }

    if (update.details) {
      updateFields.push('execution_details = ?')
      values.push(JSON.stringify({
        timestamp: now,
        details: update.details,
        progress: update.progress,
        error: update.error
      }))
    }

    values.push(update.taskId, this.workspaceId)

    this.db.prepare(`
      UPDATE tasks 
      SET ${updateFields.join(', ')}
      WHERE id = ? AND workspace_id = ?
    `).run(...values)

    // Record timing data
    this.recordTaskTiming(update.taskId, update.status, now)

    // Broadcast execution update
    eventBus.broadcast('task.execution_updated', {
      id: update.taskId,
      execution_status: update.status,
      progress: update.progress,
      updated_at: now
    })

    logger.info(`Task ${update.taskId} execution updated: ${update.status}`)
  }

  /**
   * Get pending tasks for agent execution
   */
  getPendingTasks(agentId?: string): Task[] {
    let query = `
      SELECT * FROM tasks 
      WHERE workspace_id = ? AND execution_status = 'pending' 
      AND status IN ('todo', 'in_progress', 'assigned')
    `
    const params: any[] = [this.workspaceId]

    if (agentId) {
      query += ' AND (agent_id = ? OR agent_id IS NULL OR assigned_to = ?)'
      params.push(agentId, agentId)
    }

    query += ' ORDER BY priority DESC, created_at ASC'

    return this.db.prepare(query).all(...params) as Task[]
  }

  /**
   * Sync Telegram task creation
   */
  async syncFromTelegram(messageData: {
    message_id: number
    text: string
    from_user: string
    chat_id: string
  }): Promise<number | null> {
    // Parse task from Telegram message
    const taskData = this.parseTelegramTask(messageData.text)
    if (!taskData) return null

    const externalTask: ExternalTask = {
      id: `tg_${messageData.message_id}`,
      title: taskData.title,
      description: taskData.description,
      status: 'todo',
      priority: taskData.priority,
      assignedTo: taskData.assignedTo || 'iris',
      source: 'telegram',
      metadata: {
        telegram_message_id: messageData.message_id,
        chat_id: messageData.chat_id,
        from_user: messageData.from_user,
        original_text: messageData.text
      }
    }

    try {
      const taskId = await this.importTask(externalTask, {
        workspaceId: this.workspaceId,
        agentId: taskData.assignedTo || 'iris',
        source: 'telegram'
      })

      // Store telegram message ID for thread tracking
      this.db.prepare(`
        UPDATE tasks 
        SET telegram_message_id = ?
        WHERE id = ? AND workspace_id = ?
      `).run(messageData.message_id, taskId, this.workspaceId)

      return taskId
    } catch (error) {
      logger.error({ err: error, messageData }, 'Failed to sync task from Telegram')
      return null
    }
  }

  // Private helper methods

  private getTaskById(id: number): (Task & { source?: string, external_id?: string, agent_id?: string }) | undefined {
    return this.db.prepare(`
      SELECT * FROM tasks 
      WHERE id = ? AND workspace_id = ?
    `).get(id, this.workspaceId) as any
  }

  private normalizeStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'todo',
      'todo': 'todo',
      'in_progress': 'in_progress',
      'doing': 'in_progress',
      'review': 'quality_review',
      'done': 'done',
      'completed': 'done',
      'blocked': 'blocked',
      'cancelled': 'cancelled'
    }
    return statusMap[status.toLowerCase()] || 'todo'
  }

  private parseTelegramTask(text: string): {
    title: string
    description?: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    assignedTo?: string
  } | null {
    // Simple parsing for now - can be enhanced
    const taskPatterns = [
      /^(?:task|todo|do):\s*(.+)$/i,
      /^(.+)$/
    ]

    for (const pattern of taskPatterns) {
      const match = text.match(pattern)
      if (match) {
        let title = match[1].trim()
        let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
        let assignedTo: string | undefined

        // Extract priority markers
        const priorityMatch = title.match(/\[(!{1,3}|urgent|high|medium|low)\]/i)
        if (priorityMatch) {
          const p = priorityMatch[1].toLowerCase()
          if (p === '!!!' || p === 'urgent') priority = 'urgent'
          else if (p === '!!' || p === 'high') priority = 'high'
          else if (p === '!' || p === 'medium') priority = 'medium'
          else if (p === 'low') priority = 'low'
          
          title = title.replace(priorityMatch[0], '').trim()
        }

        // Extract assignment
        const assignMatch = title.match(/@(\w+)/i)
        if (assignMatch) {
          assignedTo = assignMatch[1].toLowerCase()
          title = title.replace(assignMatch[0], '').trim()
        }

        if (title.length > 3) {
          return { title, priority, assignedTo }
        }
      }
    }

    return null
  }

  private async syncToSupabase(task: Task & { external_id?: string }, status: string): Promise<void> {
    if (!task.external_id) return

    try {
      await execAsync(`~/clawd/scripts/mc.sh task-update "${task.external_id}" "${status}"`)
    } catch (error) {
      logger.error({ err: error, taskId: task.id }, 'Failed to sync to Supabase')
    }
  }

  private async syncToDashboard(task: Task & { external_id?: string }, status: string): Promise<void> {
    // Dashboard sync implementation would go here
    logger.info(`Would sync task ${task.id} to dashboard with status ${status}`)
  }

  private async syncToTelegram(task: Task & { telegram_message_id?: number }, status: string): Promise<void> {
    if (!task.telegram_message_id) return

    // Telegram status update implementation would go here
    logger.info(`Would update Telegram message ${task.telegram_message_id} with status ${status}`)
  }

  private recordTaskTiming(taskId: number, phase: string, timestamp: number): void {
    // Get previous phase timestamp to calculate duration
    const previousTiming = this.db.prepare(`
      SELECT timestamp FROM task_timing
      WHERE task_id = ? AND workspace_id = ?
      ORDER BY timestamp DESC LIMIT 1
    `).get(taskId, this.workspaceId) as { timestamp: number } | undefined

    const duration = previousTiming ? timestamp - previousTiming.timestamp : 0

    this.db.prepare(`
      INSERT INTO task_timing (task_id, phase, timestamp, duration_from_previous, workspace_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(taskId, phase, timestamp, duration, this.workspaceId)
  }
}

// Global instance
let globalSyncEngine: TaskSyncEngine | null = null

export function getTaskSyncEngine(workspaceId: number = 1): TaskSyncEngine {
  if (!globalSyncEngine || globalSyncEngine['workspaceId'] !== workspaceId) {
    globalSyncEngine = new TaskSyncEngine(workspaceId)
  }
  return globalSyncEngine
}