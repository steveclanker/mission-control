/**
 * Agent Task Management - Individual Task Operations
 * PUT /api/agents/tasks/[id] - Update task execution status
 * GET /api/agents/tasks/[id] - Get specific task details
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTaskSyncEngine, ExecutionUpdate } from '@/lib/task-sync'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getDatabase } from '@/lib/db'

/**
 * PUT /api/agents/tasks/[id] - Update task execution status
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const resolvedParams = await params
    const taskId = parseInt(resolvedParams.id)

    if (!taskId || isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    const { 
      execution_status, 
      progress, 
      details, 
      error: executionError,
      result 
    } = body

    const syncEngine = getTaskSyncEngine(auth.user.workspace_id)

    const update: ExecutionUpdate = {
      taskId,
      status: execution_status,
      progress,
      details: details || result || undefined,
      error: executionError
    }

    await syncEngine.updateExecution(update)

    return NextResponse.json({ 
      success: true, 
      task_id: taskId,
      status: execution_status 
    })
  } catch (error) {
    logger.error({ err: error }, 'PUT /api/agents/tasks/[id] error')
    return NextResponse.json({ error: 'Failed to update task execution' }, { status: 500 })
  }
}

/**
 * GET /api/agents/tasks/[id] - Get specific task details
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const resolvedParams = await params
    const taskId = parseInt(resolvedParams.id)

    if (!taskId || isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    const db = getDatabase()
    const task = db.prepare(`
      SELECT * FROM tasks 
      WHERE id = ? AND workspace_id = ?
    `).get(taskId, auth.user.workspace_id) as any

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({
      task: {
        ...task,
        tags: task.tags ? JSON.parse(task.tags) : [],
        metadata: task.metadata ? JSON.parse(task.metadata) : {},
        execution_details: task.execution_details ? JSON.parse(task.execution_details) : null
      }
    })
  } catch (error) {
    logger.error({ err: error, taskId: (await params).id }, 'GET /api/agents/tasks/[id] error')
    return NextResponse.json({ error: 'Failed to fetch task details' }, { status: 500 })
  }
}