import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * GET /api/digest — Smart daily digest
 * Query params: date (YYYY-MM-DD, defaults to today)
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const db = getDatabase()
    const { searchParams } = new URL(request.url)
    const workspaceId = auth.user.workspace_id ?? 1

    // Date range for the digest
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const dayStart = Math.floor(new Date(dateStr + 'T00:00:00').getTime() / 1000)
    const dayEnd = dayStart + 86400

    // Yesterday for comparison
    const yesterdayStart = dayStart - 86400
    const yesterdayEnd = dayStart

    // --- Tasks Stats ---
    const tasksCompleted = (db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE status = 'done' AND updated_at >= ? AND updated_at < ? AND workspace_id = ?
    `).get(dayStart, dayEnd, workspaceId) as { count: number }).count

    const tasksCreated = (db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE created_at >= ? AND created_at < ? AND workspace_id = ?
    `).get(dayStart, dayEnd, workspaceId) as { count: number }).count

    const tasksStuck = (db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE status IN ('review', 'quality_review', 'in_progress')
        AND updated_at < ? AND workspace_id = ?
    `).get(dayStart - 86400, workspaceId) as { count: number }).count

    const tasksFailed = (db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE status = 'failed' AND updated_at >= ? AND updated_at < ? AND workspace_id = ?
    `).get(dayStart, dayEnd, workspaceId) as { count: number }).count

    // Yesterday comparison
    const yesterdayCompleted = (db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE status = 'done' AND updated_at >= ? AND updated_at < ? AND workspace_id = ?
    `).get(yesterdayStart, yesterdayEnd, workspaceId) as { count: number }).count

    // --- Cost Stats ---
    let costUsd = 0
    let topModel = 'N/A'
    let costBreakdown: { model: string; cost: number }[] = []
    try {
      const costResult = db.prepare(`
        SELECT COALESCE(SUM(cost_usd), 0) as total FROM cost_entries
        WHERE created_at >= ? AND created_at < ? AND workspace_id = ?
      `).get(dayStart, dayEnd, workspaceId) as { total: number }
      costUsd = Math.round(costResult.total * 100) / 100

      costBreakdown = db.prepare(`
        SELECT model, SUM(cost_usd) as cost FROM cost_entries
        WHERE created_at >= ? AND created_at < ? AND workspace_id = ?
        GROUP BY model ORDER BY cost DESC LIMIT 5
      `).all(dayStart, dayEnd, workspaceId) as { model: string; cost: number }[]

      if (costBreakdown.length > 0) {
        topModel = costBreakdown[0].model || 'unknown'
      }
    } catch { /* cost_entries might not have all columns */ }

    // --- Agent Stats ---
    let agentUptimeHours = 0
    let activeAgents: string[] = []
    try {
      const agents = db.prepare(`
        SELECT name, last_seen, status FROM agents WHERE workspace_id = ?
      `).all(workspaceId) as { name: string; last_seen: number; status: string }[]

      activeAgents = agents
        .filter(a => a.last_seen && a.last_seen >= dayStart)
        .map(a => a.name)

      // Estimate uptime: agents seen today, rough estimate based on heartbeat frequency
      const heartbeatCount = (db.prepare(`
        SELECT COUNT(*) as count FROM activities
        WHERE type = 'agent_heartbeat' AND created_at >= ? AND created_at < ? AND workspace_id = ?
      `).get(dayStart, dayEnd, workspaceId) as { count: number }).count

      // Assume ~2 heartbeats per hour per agent
      agentUptimeHours = Math.round(heartbeatCount / Math.max(activeAgents.length, 1) / 2)
    } catch { /* agents table might vary */ }

    // --- Activity Stats ---
    const totalActivities = (db.prepare(`
      SELECT COUNT(*) as count FROM activities
      WHERE created_at >= ? AND created_at < ? AND workspace_id = ?
    `).get(dayStart, dayEnd, workspaceId) as { count: number }).count

    const chatMessages = (db.prepare(`
      SELECT COUNT(*) as count FROM activities
      WHERE type = 'chat_message' AND created_at >= ? AND created_at < ? AND workspace_id = ?
    `).get(dayStart, dayEnd, workspaceId) as { count: number }).count

    // --- Build Natural Language Summary ---
    const highlights: string[] = []
    const concerns: string[] = []

    // Tasks highlights
    if (tasksCompleted > 0) {
      let taskHighlight = `Completed ${tasksCompleted} task${tasksCompleted !== 1 ? 's' : ''}`
      if (yesterdayCompleted > 0) {
        const changePercent = Math.round(((tasksCompleted - yesterdayCompleted) / yesterdayCompleted) * 100)
        if (changePercent > 0) taskHighlight += ` (up ${changePercent}% from yesterday)`
        else if (changePercent < 0) taskHighlight += ` (down ${Math.abs(changePercent)}% from yesterday)`
      }
      highlights.push(taskHighlight)
    }

    if (tasksCreated > 0) {
      highlights.push(`${tasksCreated} new task${tasksCreated !== 1 ? 's' : ''} created`)
    }

    // Cost highlights
    if (costUsd > 0) {
      let costMsg = `API spend: $${costUsd.toFixed(2)}`
      if (topModel !== 'N/A') costMsg += ` (mostly ${topModel})`
      if (costUsd < 5) costMsg += ' — under daily budget'
      highlights.push(costMsg)
    }

    // Agent highlights
    if (activeAgents.length > 0) {
      highlights.push(`${activeAgents.join(', ')} active${agentUptimeHours > 0 ? ` (~${agentUptimeHours}h uptime)` : ''}`)
    }

    // Concerns
    if (tasksStuck > 0) {
      concerns.push(`${tasksStuck} task${tasksStuck !== 1 ? 's' : ''} stuck for >24 hours`)
    }

    if (tasksFailed > 0) {
      concerns.push(`${tasksFailed} task${tasksFailed !== 1 ? 's' : ''} failed today`)
    }

    if (costUsd >= 5) {
      concerns.push(`API spend ($${costUsd.toFixed(2)}) exceeded $5 daily target`)
    }

    if (tasksCreated === 0 && tasksCompleted === 0) {
      concerns.push('No task activity today — quiet day or stuck?')
    }

    // Build conversational summary
    const parts: string[] = []
    if (totalActivities === 0) {
      parts.push('Quiet day — no activity recorded.')
    } else {
      if (totalActivities > 50) parts.push('Busy day!')
      else if (totalActivities > 20) parts.push('Active day.')
      else parts.push('Light day.')

      if (tasksCompleted > 0) {
        parts.push(`Completed ${tasksCompleted} task${tasksCompleted !== 1 ? 's' : ''}${tasksCreated > 0 ? `, ${tasksCreated} new` : ''}.`)
      } else if (tasksCreated > 0) {
        parts.push(`${tasksCreated} new task${tasksCreated !== 1 ? 's' : ''} created.`)
      }

      if (costUsd > 0) {
        parts.push(`Spent $${costUsd.toFixed(2)} on API calls${topModel !== 'N/A' ? ` (mostly ${topModel})` : ''}.`)
      }

      if (activeAgents.length > 0) {
        parts.push(`${activeAgents.join(' & ')} ${activeAgents.length === 1 ? 'was' : 'were'} online${agentUptimeHours > 0 ? ` for ~${agentUptimeHours}h` : ''}.`)
      }

      if (chatMessages > 0) {
        parts.push(`${chatMessages} chat message${chatMessages !== 1 ? 's' : ''}.`)
      }
    }

    const summary = parts.join(' ')

    return NextResponse.json({
      date: dateStr,
      summary,
      highlights,
      concerns,
      stats: {
        tasks_completed: tasksCompleted,
        tasks_created: tasksCreated,
        tasks_stuck: tasksStuck,
        tasks_failed: tasksFailed,
        cost_usd: costUsd,
        cost_breakdown: costBreakdown.map(c => ({ model: c.model || 'unknown', cost: Math.round(c.cost * 100) / 100 })),
        agent_uptime_hours: agentUptimeHours,
        active_agents: activeAgents,
        total_activities: totalActivities,
        chat_messages: chatMessages,
        yesterday_completed: yesterdayCompleted,
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Digest API error')
    return NextResponse.json({ error: 'Failed to generate digest' }, { status: 500 })
  }
}
