import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { readLimiter, mutationLimiter } from '@/lib/rate-limit'
import { getDatabase } from '@/lib/db'
import { logger } from '@/lib/logger'

// Ensure cost tracking tables exist
function ensureTables() {
  const db = getDatabase()
  db.exec(`
    CREATE TABLE IF NOT EXISTS cost_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monthly_budget REAL NOT NULL DEFAULT 100.0,
      alert_threshold REAL NOT NULL DEFAULT 0.8,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS cost_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service TEXT NOT NULL,
      model TEXT,
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      cost_usd REAL NOT NULL,
      agent TEXT DEFAULT 'iris',
      description TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      workspace_id INTEGER NOT NULL DEFAULT 1
    )
  `)
  // Migration: add task_id column if missing
  try {
    db.exec('ALTER TABLE cost_entries ADD COLUMN task_id INTEGER REFERENCES tasks(id)')
  } catch { /* column already exists */ }
  // Seed default budget if empty
  const row = db.prepare('SELECT COUNT(*) as cnt FROM cost_budgets').get() as { cnt: number }
  if (row.cnt === 0) {
    db.prepare('INSERT INTO cost_budgets (monthly_budget, alert_threshold) VALUES (100.0, 0.8)').run()
  }
  // Seed sample cost data if empty
  const costCount = db.prepare('SELECT COUNT(*) as cnt FROM cost_entries').get() as { cnt: number }
  if (costCount.cnt === 0) {
    const seedStmt = db.prepare(`
      INSERT INTO cost_entries (service, model, tokens_in, tokens_out, cost_usd, agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, unixepoch() - ?)
    `)
    const seedData = [
      ['anthropic', 'claude-opus-4', 45000, 10000, 2.50, 'iris', 86400 * 6],
      ['anthropic', 'claude-sonnet-4', 30000, 8000, 0.45, 'iris', 86400 * 5],
      ['anthropic', 'claude-opus-4', 60000, 15000, 3.75, 'iris', 86400 * 4],
      ['openai', 'gpt-4', 20000, 5000, 1.20, 'iris', 86400 * 3],
      ['anthropic', 'claude-opus-4', 50000, 12000, 3.10, 'iris', 86400 * 2],
      ['elevenlabs', 'tts-v1', 0, 0, 0.30, 'iris', 86400 * 1],
      ['anthropic', 'claude-sonnet-4', 35000, 9000, 0.52, 'iris', 0],
    ]
    const tx = db.transaction(() => {
      for (const d of seedData) {
        seedStmt.run(...d)
      }
    })
    tx()
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = readLimiter(request)
  if (rateCheck) return rateCheck

  try {
    ensureTables()
    const db = getDatabase()
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || 'month'
    const workspaceId = auth.user.workspace_id ?? 1

    let daysBack = 30
    if (timeframe === 'week') daysBack = 7
    if (timeframe === 'day') daysBack = 1

    const cutoff = Math.floor(Date.now() / 1000) - daysBack * 86400

    // Query cost_entries table
    const entries = db.prepare(`
      SELECT * FROM cost_entries
      WHERE created_at > ? AND workspace_id = ?
      ORDER BY created_at DESC
    `).all(cutoff, workspaceId) as any[]

    // Aggregate daily costs
    const dailyCosts: Record<string, { date: string; cost: number; tokens: number }> = {}
    const modelCosts: Record<string, number> = {}
    const agentCosts: Record<string, number> = {}
    let totalCost = 0
    let totalTokens = 0

    for (const entry of entries) {
      const date = new Date(entry.created_at * 1000).toISOString().split('T')[0]
      if (!dailyCosts[date]) dailyCosts[date] = { date, cost: 0, tokens: 0 }
      const cost = entry.cost_usd || 0
      const tokens = (entry.tokens_in || 0) + (entry.tokens_out || 0)
      dailyCosts[date].cost += cost
      dailyCosts[date].tokens += tokens
      totalCost += cost
      totalTokens += tokens

      const model = entry.model || 'unknown'
      modelCosts[model] = (modelCosts[model] || 0) + cost

      const agent = entry.agent || 'unknown'
      agentCosts[agent] = (agentCosts[agent] || 0) + cost
    }

    // Get budget
    const budget = db.prepare('SELECT * FROM cost_budgets ORDER BY id DESC LIMIT 1').get() as { monthly_budget: number; alert_threshold: number } | undefined

    // Calculate projected monthly cost
    const daysWithData = Object.keys(dailyCosts).length || 1
    const avgDailyCost = totalCost / daysWithData
    const projectedMonthlyCost = avgDailyCost * 30

    // Check budget alert
    const monthlyBudget = budget?.monthly_budget || 100
    const alertThreshold = budget?.alert_threshold || 0.8
    const budgetUsedPercent = monthlyBudget > 0 ? totalCost / monthlyBudget : 0
    const budgetAlert = budgetUsedPercent >= alertThreshold

    const includeRaw = searchParams.get('raw') === 'true'
    const groupBy = searchParams.get('group_by')

    // Per-task cost breakdown
    let taskBreakdown: any[] | undefined
    if (groupBy === 'task') {
      try {
        taskBreakdown = db.prepare(`
          SELECT
            ce.task_id,
            t.title as task_title,
            t.status as task_status,
            SUM(ce.cost_usd) as total_cost,
            SUM(ce.tokens_in) as total_tokens_in,
            SUM(ce.tokens_out) as total_tokens_out,
            COUNT(*) as entry_count,
            GROUP_CONCAT(DISTINCT ce.model) as models
          FROM cost_entries ce
          LEFT JOIN tasks t ON ce.task_id = t.id
          WHERE ce.created_at > ? AND ce.workspace_id = ? AND ce.task_id IS NOT NULL
          GROUP BY ce.task_id
          ORDER BY total_cost DESC
        `).all(cutoff, workspaceId) as any[]
      } catch {
        taskBreakdown = []
      }
    }

    // Per-task cost for a specific task
    const taskId = searchParams.get('task_id')
    let taskCost: any | undefined
    if (taskId) {
      try {
        const taskEntries = db.prepare(`
          SELECT service, model, SUM(cost_usd) as cost, SUM(tokens_in) as tokens_in, SUM(tokens_out) as tokens_out, COUNT(*) as count
          FROM cost_entries
          WHERE task_id = ? AND workspace_id = ?
          GROUP BY service, model
          ORDER BY cost DESC
        `).all(parseInt(taskId), workspaceId) as any[]

        const totalTaskCost = db.prepare(`
          SELECT COALESCE(SUM(cost_usd), 0) as total FROM cost_entries WHERE task_id = ? AND workspace_id = ?
        `).get(parseInt(taskId), workspaceId) as { total: number }

        taskCost = {
          task_id: parseInt(taskId),
          total_cost: totalTaskCost.total,
          breakdown: taskEntries,
        }
      } catch {
        taskCost = { task_id: parseInt(taskId), total_cost: 0, breakdown: [] }
      }
    }

    return NextResponse.json({
      totalCost,
      totalTokens,
      projectedMonthlyCost,
      dailyCosts: Object.values(dailyCosts).sort((a, b) => a.date.localeCompare(b.date)),
      modelBreakdown: Object.entries(modelCosts).map(([model, cost]) => ({ model, cost })).sort((a, b) => b.cost - a.cost),
      agentBreakdown: Object.entries(agentCosts).map(([agent, cost]) => ({ agent, cost })).sort((a, b) => b.cost - a.cost),
      budget: {
        monthly: monthlyBudget,
        alertThreshold,
        used: totalCost,
        usedPercent: budgetUsedPercent,
        alert: budgetAlert,
      },
      timeframe,
      ...(includeRaw ? { entries } : {}),
      ...(taskBreakdown ? { taskBreakdown } : {}),
      ...(taskCost ? { taskCost } : {}),
    })
  } catch (error) {
    logger.error({ err: error }, 'Costs API error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  try {
    ensureTables()
    const body = await request.json()
    const db = getDatabase()
    const workspaceId = auth.user.workspace_id ?? 1

    // If it's a budget update (legacy)
    if (body.monthlyBudget !== undefined || body.alertThreshold !== undefined) {
      db.prepare(`
        UPDATE cost_budgets SET monthly_budget = ?, alert_threshold = ?, updated_at = strftime('%s','now')
        WHERE id = (SELECT id FROM cost_budgets ORDER BY id DESC LIMIT 1)
      `).run(body.monthlyBudget || 100, body.alertThreshold || 0.8)
      return NextResponse.json({ success: true })
    }

    // Log a new cost entry
    const { service, model, tokens_in, tokens_out, cost_usd, agent, description, task_id } = body
    if (!service || cost_usd === undefined) {
      return NextResponse.json({ error: 'service and cost_usd are required' }, { status: 400 })
    }

    // Ensure task_id column exists (migration-safe)
    try {
      db.exec('ALTER TABLE cost_entries ADD COLUMN task_id INTEGER REFERENCES tasks(id)')
    } catch { /* column already exists */ }

    const result = db.prepare(`
      INSERT INTO cost_entries (service, model, tokens_in, tokens_out, cost_usd, agent, description, workspace_id, task_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      service,
      model || null,
      tokens_in || 0,
      tokens_out || 0,
      cost_usd,
      agent || 'iris',
      description || null,
      workspaceId,
      task_id || null
    )

    return NextResponse.json({
      success: true,
      id: result.lastInsertRowid,
    })
  } catch (error) {
    logger.error({ err: error }, 'Costs POST error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
