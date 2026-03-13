/**
 * POST /api/tasks/lifecycle - Periodic lifecycle sync
 * Scans all non-done tasks and auto-progresses based on state
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { eventBus } from '@/lib/event-bus'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

function ensureAegisApproval(
  db: ReturnType<typeof getDatabase>,
  taskId: number,
  workspaceId: number,
  notes: string
): void {
  const existing = db.prepare(`
    SELECT id FROM quality_reviews
    WHERE task_id = ? AND reviewer = 'aegis' AND status = 'approved' AND workspace_id = ?
  `).get(taskId, workspaceId) as { id: number } | undefined

  if (!existing) {
    db.prepare(`
      INSERT INTO quality_reviews (task_id, reviewer, status, notes, workspace_id)
      VALUES (?, 'aegis', 'approved', ?, ?)
    `).run(taskId, notes, workspaceId)
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const workspaceId = auth.user.workspace_id ?? 1
  const db = getDatabase()
  const now = Math.floor(Date.now() / 1000)
  const oneHourAgo = now - 3600

  const summary: {
    completed_to_done: { id: number; title: string }[]
    executing_to_in_progress: { id: number; title: string }[]
    assigned_auto: { id: number; title: string }[]
    review_auto_approved: { id: number; title: string }[]
  } = {
    completed_to_done: [],
    executing_to_in_progress: [],
    assigned_auto: [],
    review_auto_approved: [],
  }

  // 1. Tasks with execution_status='completed' but status != 'done'
  const completedNotDone = db.prepare(`
    SELECT id, title FROM tasks
    WHERE workspace_id = ? AND execution_status = 'completed' AND status != 'done'
  `).all(workspaceId) as { id: number; title: string }[]

  for (const task of completedNotDone) {
    ensureAegisApproval(db, task.id, workspaceId, 'Auto-approved by lifecycle sync')
    db.prepare(`
      UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ? AND workspace_id = ?
    `).run(now, now, task.id, workspaceId)
    summary.completed_to_done.push(task)
    eventBus.broadcast('task.updated', { id: task.id, status: 'done' })
  }

  // 2. Tasks with execution_status='executing' but status='assigned'
  const executingAssigned = db.prepare(`
    SELECT id, title FROM tasks
    WHERE workspace_id = ? AND execution_status = 'executing' AND status = 'assigned'
  `).all(workspaceId) as { id: number; title: string }[]

  for (const task of executingAssigned) {
    db.prepare(`
      UPDATE tasks SET status = 'in_progress', updated_at = ? WHERE id = ? AND workspace_id = ?
    `).run(now, task.id, workspaceId)
    summary.executing_to_in_progress.push(task)
    eventBus.broadcast('task.updated', { id: task.id, status: 'in_progress' })
  }

  // 3. Tasks with assigned_to set but status='inbox'
  const inboxAssigned = db.prepare(`
    SELECT id, title FROM tasks
    WHERE workspace_id = ? AND assigned_to IS NOT NULL AND assigned_to != '' AND status = 'inbox'
  `).all(workspaceId) as { id: number; title: string }[]

  for (const task of inboxAssigned) {
    db.prepare(`
      UPDATE tasks SET status = 'assigned', updated_at = ? WHERE id = ? AND workspace_id = ?
    `).run(now, task.id, workspaceId)
    summary.assigned_auto.push(task)
    eventBus.broadcast('task.updated', { id: task.id, status: 'assigned' })
  }

  // 4. Tasks stuck in 'review' for >1 hour
  const stuckInReview = db.prepare(`
    SELECT id, title FROM tasks
    WHERE workspace_id = ? AND status = 'review' AND updated_at < ?
  `).all(workspaceId, oneHourAgo) as { id: number; title: string }[]

  for (const task of stuckInReview) {
    ensureAegisApproval(db, task.id, workspaceId, 'Auto-approved: stuck in review >1 hour')
    db.prepare(`
      UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ? AND workspace_id = ?
    `).run(now, now, task.id, workspaceId)
    summary.review_auto_approved.push(task)
    eventBus.broadcast('task.updated', { id: task.id, status: 'done' })
  }

  const totalMoved =
    summary.completed_to_done.length +
    summary.executing_to_in_progress.length +
    summary.assigned_auto.length +
    summary.review_auto_approved.length

  logger.info({ summary, totalMoved }, 'Lifecycle sync completed')

  return NextResponse.json({
    success: true,
    total_moved: totalMoved,
    summary,
  })
}
