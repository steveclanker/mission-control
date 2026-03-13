import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { readLimiter, mutationLimiter } from '@/lib/rate-limit'
import { getDatabase } from '@/lib/db'
import { logger } from '@/lib/logger'

function ensureDependenciesTable() {
  const db = getDatabase()
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      depends_on_id INTEGER NOT NULL,
      workspace_id INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (depends_on_id) REFERENCES tasks(id) ON DELETE CASCADE,
      UNIQUE(task_id, depends_on_id)
    )
  `)
}

/**
 * GET /api/tasks/[id]/dependencies — list dependencies for a task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = readLimiter(request)
  if (rateCheck) return rateCheck

  try {
    ensureDependenciesTable()
    const db = getDatabase()
    const resolvedParams = await params
    const taskId = parseInt(resolvedParams.id)
    const workspaceId = auth.user.workspace_id ?? 1

    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    // Tasks this task depends on
    const dependsOn = db.prepare(`
      SELECT td.id as dependency_id, td.depends_on_id, t.title, t.status, t.priority
      FROM task_dependencies td
      JOIN tasks t ON t.id = td.depends_on_id
      WHERE td.task_id = ? AND td.workspace_id = ?
      ORDER BY t.title
    `).all(taskId, workspaceId) as any[]

    // Tasks that depend on this task (dependents)
    const dependents = db.prepare(`
      SELECT td.id as dependency_id, td.task_id, t.title, t.status, t.priority
      FROM task_dependencies td
      JOIN tasks t ON t.id = td.task_id
      WHERE td.depends_on_id = ? AND td.workspace_id = ?
      ORDER BY t.title
    `).all(taskId, workspaceId) as any[]

    const hasUnfinishedDeps = dependsOn.some((d: any) => d.status !== 'done')

    return NextResponse.json({ dependsOn, dependents, hasUnfinishedDeps })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/tasks/[id]/dependencies error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/tasks/[id]/dependencies — add a dependency { depends_on_id }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  try {
    ensureDependenciesTable()
    const db = getDatabase()
    const resolvedParams = await params
    const taskId = parseInt(resolvedParams.id)
    const workspaceId = auth.user.workspace_id ?? 1
    const { depends_on_id } = await request.json()

    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }
    if (!depends_on_id || isNaN(parseInt(depends_on_id))) {
      return NextResponse.json({ error: 'depends_on_id is required' }, { status: 400 })
    }
    if (taskId === parseInt(depends_on_id)) {
      return NextResponse.json({ error: 'A task cannot depend on itself' }, { status: 400 })
    }

    // Check both tasks exist
    const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND workspace_id = ?').get(taskId, workspaceId)
    const depTask = db.prepare('SELECT id FROM tasks WHERE id = ? AND workspace_id = ?').get(parseInt(depends_on_id), workspaceId)
    if (!task || !depTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check for circular dependency (simple: does depends_on_id already depend on taskId?)
    const circular = db.prepare(`
      SELECT id FROM task_dependencies
      WHERE task_id = ? AND depends_on_id = ? AND workspace_id = ?
    `).get(parseInt(depends_on_id), taskId, workspaceId)
    if (circular) {
      return NextResponse.json({ error: 'Circular dependency detected' }, { status: 400 })
    }

    const result = db.prepare(`
      INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id, workspace_id)
      VALUES (?, ?, ?)
    `).run(taskId, parseInt(depends_on_id), workspaceId)

    return NextResponse.json({ success: true, id: result.lastInsertRowid })
  } catch (error) {
    logger.error({ err: error }, 'POST /api/tasks/[id]/dependencies error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/tasks/[id]/dependencies — remove a dependency by { dependency_id }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  try {
    ensureDependenciesTable()
    const db = getDatabase()
    const resolvedParams = await params
    const taskId = parseInt(resolvedParams.id)
    const workspaceId = auth.user.workspace_id ?? 1
    const { searchParams } = new URL(request.url)
    const depId = parseInt(searchParams.get('dep_id') || '')

    if (isNaN(taskId) || isNaN(depId)) {
      return NextResponse.json({ error: 'Invalid task or dependency ID' }, { status: 400 })
    }

    db.prepare(`
      DELETE FROM task_dependencies
      WHERE id = ? AND task_id = ? AND workspace_id = ?
    `).run(depId, taskId, workspaceId)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ err: error }, 'DELETE /api/tasks/[id]/dependencies error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
