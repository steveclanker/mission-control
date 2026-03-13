'use client'

import { useState, useCallback } from 'react'
import { useSmartPoll } from '@/lib/use-smart-poll'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('AgentMonitor')

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

interface MonitorData {
  agents: AgentInfo[]
  pipelines: BraintrustPipeline[]
  allAgents: AgentInfo[]
  summary: {
    total: number
    running: number
    done: number
    failed: number
    pipelines: number
  }
  timestamp: number
}

export function AgentMonitorPanel() {
  const [data, setData] = useState<MonitorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'running' | 'done' | 'failed'>('all')
  const [lastRefresh, setLastRefresh] = useState<number>(0)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/agent-monitor')
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setData(json)
      setLastRefresh(Date.now())
    } catch (err) {
      log.error('Failed to fetch agent monitor data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll every 12 seconds, pause when SSE is delivering events
  const manualRefresh = useSmartPoll(fetchData, 12000)

  const filteredAgents = data?.agents.filter(a => {
    if (filter === 'all') return true
    return a.status === filter
  }) || []

  const summary = data?.summary || { total: 0, running: 0, done: 0, failed: 0, pipelines: 0 }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span className="text-lg">🔭</span>
            Agent Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time view of active and recent sub-agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Last refresh indicator */}
          <span className="text-xs text-muted-foreground">
            {lastRefresh > 0 && `Updated ${formatTimeSince(lastRefresh)}`}
          </span>
          <button
            onClick={() => manualRefresh()}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-smooth flex items-center gap-1.5"
          >
            <RefreshIcon />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Total Agents" value={summary.total} color="text-foreground" />
        <StatCard label="Running" value={summary.running} color="text-green-400" pulse={summary.running > 0} />
        <StatCard label="Completed" value={summary.done} color="text-muted-foreground" />
        <StatCard label="Failed" value={summary.failed} color="text-red-400" />
        <StatCard label="Pipelines" value={summary.pipelines} color="text-violet-400" />
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2">
        {(['all', 'running', 'done', 'failed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-smooth ${
              filter === f
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'border border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            {f === 'all' ? 'All' : f === 'running' ? '● Running' : f === 'done' ? '● Done' : '● Failed'}
          </button>
        ))}
      </div>

      {/* Braintrust Pipelines */}
      {data?.pipelines && data.pipelines.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="text-base">🧠</span>
            Braintrust Pipelines
          </h2>
          {data.pipelines.map(pipeline => (
            <BraintrustPipelineCard key={pipeline.id} pipeline={pipeline} />
          ))}
        </div>
      )}

      {/* Individual Agents */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="text-base">🤖</span>
          Sub-Agents
          <span className="text-xs text-muted-foreground font-normal">({filteredAgents.length})</span>
        </h2>

        {loading && !data ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading agents...</span>
            </div>
          </div>
        ) : filteredAgents.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredAgents.map(agent => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Agent Card ──────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: AgentInfo }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`rounded-xl border bg-card p-4 transition-smooth hover:border-primary/30 cursor-pointer ${
        agent.status === 'running'
          ? 'border-green-500/30 shadow-[0_0_12px_rgba(34,197,94,0.08)]'
          : agent.status === 'failed'
          ? 'border-red-500/30'
          : 'border-border'
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Top Row: Status + Label */}
      <div className="flex items-start gap-3">
        <StatusIndicator status={agent.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {agent.label}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {agent.agent}
          </div>
        </div>
        {/* Runtime */}
        <div className="text-right shrink-0">
          <div className={`text-sm font-mono font-medium ${
            agent.status === 'running' ? 'text-green-400' : 'text-muted-foreground'
          }`}>
            {agent.runtime}
          </div>
          {agent.status === 'running' && (
            <div className="text-[10px] text-green-500/70 mt-0.5 flex items-center justify-end gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              active
            </div>
          )}
        </div>
      </div>

      {/* Info Row: Model + Tokens */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <InfoPill icon="🏷️" label={shortModel(agent.model)} />
        <InfoPill icon="📊" label={`${agent.inputTokens} in / ${agent.outputTokens} out`} />
        {agent.channel && <InfoPill icon="📡" label={agent.channel} />}
      </div>

      {/* Expanded: Task description */}
      {expanded && agent.task && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {agent.task}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Braintrust Pipeline Card ────────────────────────────────────────────

function BraintrustPipelineCard({ pipeline }: { pipeline: BraintrustPipeline }) {
  const stages = [
    { key: 'builder' as const, label: 'Builder', icon: '🔨', data: pipeline.stages.builder },
    { key: 'critic' as const, label: 'Critic', icon: '🔍', data: pipeline.stages.critic },
    { key: 'revision' as const, label: 'Revision', icon: '✨', data: pipeline.stages.revision },
  ]

  return (
    <div className={`rounded-xl border bg-card p-4 transition-smooth ${
      pipeline.status === 'running'
        ? 'border-violet-500/30 shadow-[0_0_16px_rgba(139,92,246,0.1)]'
        : pipeline.status === 'failed'
        ? 'border-red-500/30'
        : 'border-border'
    }`}>
      {/* Pipeline Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">🧠</span>
          <span className="text-sm font-semibold text-foreground">{pipeline.label}</span>
          <StatusBadge status={pipeline.status} />
        </div>
        <span className={`text-sm font-mono ${
          pipeline.status === 'running' ? 'text-violet-400' : 'text-muted-foreground'
        }`}>
          {pipeline.runtime}
        </span>
      </div>

      {/* Pipeline Flow: Builder → Critic → Revision */}
      <div className="flex items-center gap-0">
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex items-center flex-1 min-w-0">
            {/* Stage Node */}
            <div className={`flex-1 rounded-lg border p-3 min-w-0 transition-smooth ${
              stage.data
                ? stage.data.status === 'running'
                  ? 'border-green-500/40 bg-green-500/5'
                  : stage.data.status === 'failed'
                  ? 'border-red-500/40 bg-red-500/5'
                  : 'border-border bg-secondary/30'
                : 'border-dashed border-border/50 bg-transparent opacity-40'
            }`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs">{stage.icon}</span>
                <span className="text-xs font-medium text-foreground">{stage.label}</span>
                {stage.data && (
                  <StatusDot status={stage.data.status} />
                )}
              </div>
              {stage.data ? (
                <div className="space-y-0.5">
                  <div className="text-[10px] text-muted-foreground truncate">
                    {shortModel(stage.data.model)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {stage.data.inputTokens}/{stage.data.outputTokens}
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground/50">Pending</div>
              )}
            </div>

            {/* Arrow between stages */}
            {i < stages.length - 1 && (
              <div className="flex items-center px-1 shrink-0">
                <svg width="20" height="12" viewBox="0 0 20 12" className="text-muted-foreground/40">
                  <path d="M0 6h16M12 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── UI Components ───────────────────────────────────────────────────────

function StatusIndicator({ status }: { status: 'running' | 'done' | 'failed' }) {
  const colors = {
    running: 'bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.4)]',
    done: 'bg-muted-foreground/40',
    failed: 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]',
  }

  return (
    <div className="pt-1.5 shrink-0">
      <div className={`w-2.5 h-2.5 rounded-full ${colors[status]} ${
        status === 'running' ? 'animate-pulse' : ''
      }`} />
    </div>
  )
}

function StatusDot({ status }: { status: 'running' | 'done' | 'failed' }) {
  const colors = {
    running: 'bg-green-400',
    done: 'bg-muted-foreground/40',
    failed: 'bg-red-400',
  }
  return <div className={`w-1.5 h-1.5 rounded-full ${colors[status]} ${status === 'running' ? 'animate-pulse' : ''}`} />
}

function StatusBadge({ status }: { status: 'running' | 'done' | 'failed' }) {
  const styles = {
    running: 'bg-green-500/15 text-green-400 border-green-500/30',
    done: 'bg-muted text-muted-foreground border-border',
    failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  }
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${styles[status]}`}>
      {status}
    </span>
  )
}

function InfoPill({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-md">
      <span className="text-[10px]">{icon}</span>
      {label}
    </span>
  )
}

function StatCard({ label, value, color, pulse }: { label: string; value: number; color: string; pulse?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${color} flex items-center gap-2`}>
        {value}
        {pulse && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
      </div>
    </div>
  )
}

function EmptyState({ filter }: { filter: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
      <div className="text-3xl mb-2">🔭</div>
      <div className="text-sm text-muted-foreground">
        {filter === 'all'
          ? 'No sub-agents detected in the last 24 hours'
          : `No ${filter} agents found`}
      </div>
      <div className="text-xs text-muted-foreground/60 mt-1">
        Spawn agents from the Spawn panel or trigger braintrust workflows
      </div>
    </div>
  )
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 8a7 7 0 0113.5-2.5M15 8a7 7 0 01-13.5 2.5" />
      <path d="M14.5 1v4.5H10M1.5 15v-4.5H6" />
    </svg>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

function shortModel(model: string): string {
  if (!model || model === 'unknown') return 'unknown'
  // Shorten common model names
  const replacements: [RegExp, string][] = [
    [/anthropic\/claude-/i, 'claude-'],
    [/openai\/gpt-/i, 'gpt-'],
    [/google\/gemini-/i, 'gemini-'],
    [/-20\d{6}$/, ''], // Remove date suffixes
  ]
  let short = model
  for (const [re, rep] of replacements) {
    short = short.replace(re, rep)
  }
  return short.length > 25 ? short.slice(0, 22) + '...' : short
}

function formatTimeSince(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000)
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  return `${Math.floor(diff / 60)}m ago`
}
