import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * GET /api/chat/simple?channel=general&limit=50&since=<timestamp>
 * Simple chat messages for the agent chat panel
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const db = getDatabase()
    const workspaceId = auth.user.workspace_id ?? 1
    const { searchParams } = new URL(request.url)

    const channel = searchParams.get('channel') || 'general'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const since = searchParams.get('since')

    let query = 'SELECT * FROM chat_messages WHERE channel = ? AND workspace_id = ?'
    const params: any[] = [channel, workspaceId]

    if (since) {
      query += ' AND created_at > ?'
      params.push(parseInt(since))
    }

    query += ' ORDER BY created_at DESC LIMIT ?'
    params.push(limit)

    const messages = db.prepare(query).all(...params) as any[]

    // Return in chronological order
    const sorted = messages.reverse().map(m => ({
      ...m,
      metadata: m.metadata ? JSON.parse(m.metadata) : null,
    }))

    return NextResponse.json({ messages: sorted })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/chat/simple error')
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

/**
 * POST /api/chat/simple
 * Body: { sender, content, channel? }
 */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const db = getDatabase()
    const workspaceId = auth.user.workspace_id ?? 1
    const body = await request.json()

    const sender = (body.sender || '').trim()
    const content = (body.content || '').trim()
    const channel = (body.channel || 'general').trim()
    const metadata = body.metadata || null

    if (!sender || !content) {
      return NextResponse.json({ error: '"sender" and "content" are required' }, { status: 400 })
    }

    const result = db.prepare(`
      INSERT INTO chat_messages (sender, content, channel, metadata, workspace_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(sender, content, channel, metadata ? JSON.stringify(metadata) : null, workspaceId)

    const created = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(result.lastInsertRowid) as any

    return NextResponse.json({
      message: {
        ...created,
        metadata: created.metadata ? JSON.parse(created.metadata) : null,
      }
    }, { status: 201 })
  } catch (error) {
    logger.error({ err: error }, 'POST /api/chat/simple error')
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
