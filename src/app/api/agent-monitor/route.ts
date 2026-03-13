import { NextRequest, NextResponse } from 'next/server'
import { getAllGatewaySessions } from '@/lib/sessions'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * Agent Monitor API — returns enriched session data for the real-time
 * agent monitor panel, including braintrust pipeline detection.
 */

interface AgentInfo {
  id: string
  sessionKey: string
  label: string
  status: 'running' | 'done' | 'failed'
  model: string
  runtime: string
  runtimeMs: number
  inputTokens: string
  outputTokens: string
  channel: string
  agent: string
  type: 'individual' | 'braintrust-builder' | 'braintrust-critic' | 'braintrust-revision'
  pipelineId?: string
  startTime: number
  lastActivity: number
  task?: string
}

interface BraintrustPipeline {
  id: string
  label: string
  status: 'running' | 'done' | 'failed'
  stages: {
    builder?: AgentInfo
    critic?: AgentInfo
    revision?: AgentInfo
  }
  startTime: number
  runtime: string
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    // Get all sessions from the last 24 hours
    const sessions = getAllGatewaySessions(24 * 60 * 60 * 1000)
    const now = Date.now()

    // Filter to subagent and relevant sessions
    const agents: AgentInfo[] = []
    const braintrustGroups = new Map<string, AgentInfo[]>()

    for (const s of sessions) {
      const isSubagent = s.key.includes(':subagent:')
      const isCron = s.key.includes(':cron:')
      
      // Skip non-subagent, non-cron sessions for the monitor
      if (!isSubagent && !isCron) continue

      const age = now - s.updatedAt
      const isActive = s.active && age < 5 * 60 * 1000
      
      // Determine status
      let status: 'running' | 'done' | 'failed' = 'done'
      if (isActive) {
        status = 'running'
      } else if (age < 2 * 60 * 1000 && s.totalTokens === 0) {
        status = 'failed'
      }

      // Detect braintrust pipeline from session key or label patterns
      let type: AgentInfo['type'] = 'individual'
      let pipelineId: string | undefined

      const keyLower = s.key.toLowerCase()
      if (keyLower.includes('braintrust') || keyLower.includes('brain-trust')) {
        if (keyLower.includes('builder') || keyLower.includes('build')) {
          type = 'braintrust-builder'
        } else if (keyLower.includes('critic') || keyLower.includes('review')) {
          type = 'braintrust-critic'
        } else if (keyLower.includes('revis') || keyLower.includes('synth')) {
          type = 'braintrust-revision'
        }
        // Group by timestamp proximity (within 5 min = same pipeline)
        pipelineId = `bt-${s.agent}-${Math.floor(s.updatedAt / (5 * 60 * 1000))}`
      }

      const agent: AgentInfo = {
        id: s.sessionId || s.key,
        sessionKey: s.key,
        label: extractLabel(s.key),
        status,
        model: s.model || 'unknown',
        runtime: formatRuntime(age),
        runtimeMs: age,
        inputTokens: formatTokens(s.inputTokens || 0),
        outputTokens: formatTokens(s.outputTokens || 0),
        channel: s.channel,
        agent: s.agent,
        type,
        pipelineId,
        startTime: s.updatedAt,
        lastActivity: s.updatedAt,
        task: extractTask(s.key),
      }

      agents.push(agent)

      if (pipelineId) {
        if (!braintrustGroups.has(pipelineId)) {
          braintrustGroups.set(pipelineId, [])
        }
        braintrustGroups.get(pipelineId)!.push(agent)
      }
    }

    // Build braintrust pipelines
    const pipelines: BraintrustPipeline[] = []
    for (const [id, members] of braintrustGroups) {
      const builder = members.find(m => m.type === 'braintrust-builder')
      const critic = members.find(m => m.type === 'braintrust-critic')
      const revision = members.find(m => m.type === 'braintrust-revision')
      
      const allDone = members.every(m => m.status === 'done')
      const anyFailed = members.some(m => m.status === 'failed')
      const anyRunning = members.some(m => m.status === 'running')

      const earliest = Math.min(...members.map(m => m.startTime))
      const age = now - earliest

      pipelines.push({
        id,
        label: builder?.label || 'Braintrust Pipeline',
        status: anyFailed ? 'failed' : anyRunning ? 'running' : 'done',
        stages: { builder, critic, revision },
        startTime: earliest,
        runtime: formatRuntime(age),
      })
    }

    // Sort: running first, then by most recent
    agents.sort((a, b) => {
      if (a.status === 'running' && b.status !== 'running') return -1
      if (b.status === 'running' && a.status !== 'running') return 1
      return b.lastActivity - a.lastActivity
    })

    // Individual agents (not part of braintrust)
    const individualAgents = agents.filter(a => !a.pipelineId)

    // Summary stats
    const summary = {
      total: agents.length,
      running: agents.filter(a => a.status === 'running').length,
      done: agents.filter(a => a.status === 'done').length,
      failed: agents.filter(a => a.status === 'failed').length,
      pipelines: pipelines.length,
    }

    return NextResponse.json({
      agents: individualAgents,
      pipelines,
      allAgents: agents,
      summary,
      timestamp: now,
    })
  } catch (error) {
    logger.error({ err: error }, 'Agent monitor API error')
    return NextResponse.json({ agents: [], pipelines: [], allAgents: [], summary: { total: 0, running: 0, done: 0, failed: 0, pipelines: 0 }, timestamp: Date.now() })
  }
}

function extractLabel(key: string): string {
  // Extract meaningful label from session key
  // e.g., "agent:main:subagent:abc-123" → "subagent:abc-123"
  const parts = key.split(':')
  if (parts.length >= 3) {
    // Try to find a label-like segment
    const lastParts = parts.slice(2).join(':')
    return lastParts.length > 50 ? lastParts.slice(0, 47) + '...' : lastParts
  }
  return key.length > 50 ? key.slice(0, 47) + '...' : key
}

function extractTask(key: string): string | undefined {
  // Extract task description if encoded in the key
  const parts = key.split(':')
  const lastPart = parts[parts.length - 1]
  if (lastPart && lastPart.length > 10) {
    return lastPart.length > 80 ? lastPart.slice(0, 77) + '...' : lastPart
  }
  return undefined
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatRuntime(ms: number): string {
  if (ms < 0) ms = 0
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export const dynamic = 'force-dynamic'
