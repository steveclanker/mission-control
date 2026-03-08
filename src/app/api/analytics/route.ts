/**
 * Analytics API - Dashboard Metrics & Reporting
 * 
 * GET /api/analytics - Get dashboard metrics
 * GET /api/analytics?type=trends - Get daily trends
 * GET /api/analytics?type=agents - Get agent performance
 * GET /api/analytics?type=tasks - Get task analytics
 * GET /api/analytics?type=export&format=csv - Export data
 */

import { NextRequest, NextResponse } from 'next/server'
import { getMetricsEngine } from '@/lib/metrics-engine'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'dashboard'
    const format = searchParams.get('format')
    const days = parseInt(searchParams.get('days') || '14')
    const limit = parseInt(searchParams.get('limit') || '50')

    const metricsEngine = getMetricsEngine(auth.user.workspace_id)

    switch (type) {
      case 'dashboard':
        return NextResponse.json({
          metrics: metricsEngine.getDashboardMetrics(),
          generated_at: new Date().toISOString()
        })

      case 'trends':
        return NextResponse.json({
          trends: metricsEngine.getDailyTrends(days),
          days,
          generated_at: new Date().toISOString()
        })

      case 'agents':
        return NextResponse.json({
          agents: metricsEngine.getAgentPerformance(),
          generated_at: new Date().toISOString()
        })

      case 'tasks':
        return NextResponse.json({
          tasks: metricsEngine.getTaskAnalytics(limit),
          limit,
          generated_at: new Date().toISOString()
        })

      case 'export':
        if (format === 'csv') {
          const csv = metricsEngine.exportTasksCSV()
          return new NextResponse(csv, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="tasks-export-${new Date().toISOString().split('T')[0]}.csv"`
            }
          })
        }
        return NextResponse.json({ error: 'Invalid export format' }, { status: 400 })

      default:
        return NextResponse.json({ error: 'Invalid analytics type' }, { status: 400 })
    }
  } catch (error) {
    logger.error({ err: error }, 'GET /api/analytics error')
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

/**
 * POST /api/analytics/heartbeat - Record agent heartbeat for uptime tracking
 */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { agent_id, status = 'online' } = body

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id required' }, { status: 400 })
    }

    const metricsEngine = getMetricsEngine(auth.user.workspace_id)
    metricsEngine.recordAgentHeartbeat(agent_id, status)

    return NextResponse.json({ success: true, message: 'Heartbeat recorded' })
  } catch (error) {
    logger.error({ err: error }, 'POST /api/analytics error')
    return NextResponse.json({ error: 'Failed to record heartbeat' }, { status: 500 })
  }
}