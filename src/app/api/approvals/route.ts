import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { readLimiter, mutationLimiter } from '@/lib/rate-limit'
import { getDatabase } from '@/lib/db'
import { logger } from '@/lib/logger'

function ensureTable() {
  const db = getDatabase()
  db.exec(`
    CREATE TABLE IF NOT EXISTS exec_approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name TEXT NOT NULL,
      command TEXT NOT NULL,
      risk_level TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'pending',
      comment TEXT,
      decided_by TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      decided_at INTEGER
    )
  `)
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = readLimiter(request)
  if (rateCheck) return rateCheck

  try {
    ensureTable()
    const db = getDatabase()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

    let approvals
    if (status === 'all') {
      approvals = db.prepare('SELECT * FROM exec_approvals ORDER BY created_at DESC LIMIT 100').all()
    } else {
      approvals = db.prepare('SELECT * FROM exec_approvals WHERE status = ? ORDER BY created_at DESC LIMIT 50').all(status)
    }

    const pendingCount = (db.prepare('SELECT COUNT(*) as cnt FROM exec_approvals WHERE status = ?').get('pending') as { cnt: number }).cnt

    return NextResponse.json({ approvals, pendingCount })
  } catch (error) {
    logger.error({ err: error }, 'Approvals GET error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  try {
    ensureTable()
    const body = await request.json()
    const { id, action, comment } = body
    const db = getDatabase()

    if (action === 'approve' || action === 'deny') {
      const now = Math.floor(Date.now() / 1000)
      db.prepare(`
        UPDATE exec_approvals SET status = ?, comment = ?, decided_by = ?, decided_at = ?
        WHERE id = ? AND status = 'pending'
      `).run(action === 'approve' ? 'approved' : 'denied', comment || null, auth.user.username, now, id)

      return NextResponse.json({ success: true })
    }

    // Create new approval request
    if (body.agentName && body.command) {
      const result = db.prepare(`
        INSERT INTO exec_approvals (agent_name, command, risk_level)
        VALUES (?, ?, ?)
      `).run(body.agentName, body.command, body.riskLevel || 'medium')

      return NextResponse.json({ success: true, id: result.lastInsertRowid })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    logger.error({ err: error }, 'Approvals POST error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
