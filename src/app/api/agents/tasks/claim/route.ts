/**
 * POST /api/agents/tasks/claim - Claim a task for execution
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTaskSyncEngine } from '@/lib/task-sync'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { task_id, agent_id } = body

    if (!task_id || !agent_id) {
      return NextResponse.json({ error: 'task_id and agent_id required' }, { status: 400 })
    }

    const syncEngine = getTaskSyncEngine(auth.user.workspace_id)
    
    await syncEngine.updateExecution({
      taskId: task_id,
      status: 'executing',
      details: `Task claimed by agent ${agent_id}`
    })

    logger.info(`Agent ${agent_id} claimed task ${task_id}`)

    return NextResponse.json({ 
      success: true, 
      message: `Task ${task_id} claimed by ${agent_id}` 
    })
  } catch (error) {
    logger.error({ err: error }, 'POST /api/agents/tasks/claim error')
    return NextResponse.json({ error: 'Failed to claim task' }, { status: 500 })
  }
}