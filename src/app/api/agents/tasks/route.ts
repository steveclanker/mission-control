/**
 * Agent Task Execution API
 * 
 * Allows agents to:
 * - Get pending tasks assigned to them
 * - Update task execution status  
 * - Report progress and results
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTaskSyncEngine, ExecutionUpdate } from '@/lib/task-sync'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * GET /api/agents/tasks - Get pending tasks for agent
 * Query params: agent_id, limit
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id')
    const limit = parseInt(searchParams.get('limit') || '10')

    const syncEngine = getTaskSyncEngine(auth.user.workspace_id)
    const pendingTasks = syncEngine.getPendingTasks(agentId || undefined)

    // Format tasks for agent consumption
    const formattedTasks = pendingTasks.slice(0, limit).map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      execution_status: (task as any).execution_status,
      assigned_to: task.assigned_to,
      source: (task as any).source,
      external_id: (task as any).external_id,
      created_at: task.created_at,
      due_date: task.due_date,
      estimated_hours: task.estimated_hours,
      tags: task.tags ? JSON.parse(task.tags) : [],
      metadata: task.metadata ? JSON.parse(task.metadata) : {}
    }))

    return NextResponse.json({
      tasks: formattedTasks,
      total: pendingTasks.length,
      agent_id: agentId
    })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/agents/tasks error')
    return NextResponse.json({ error: 'Failed to fetch agent tasks' }, { status: 500 })
  }
}

