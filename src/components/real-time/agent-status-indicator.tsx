'use client'

import { useAgentStatus, AgentStatus } from '@/lib/real-time-hub'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Bot, Circle, Activity, Clock, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentStatusIndicatorProps {
  showDetails?: boolean
  compact?: boolean
  maxAgents?: number
}

const STATUS_CONFIG = {
  online: {
    color: 'bg-green-500',
    pulseColor: 'bg-green-400',
    label: 'Online',
    badgeVariant: 'default' as const
  },
  busy: {
    color: 'bg-amber-500',
    pulseColor: 'bg-amber-400',
    label: 'Busy',
    badgeVariant: 'secondary' as const
  },
  idle: {
    color: 'bg-yellow-500',
    pulseColor: 'bg-yellow-400',
    label: 'Idle',
    badgeVariant: 'outline' as const
  },
  offline: {
    color: 'bg-gray-400',
    pulseColor: 'bg-gray-300',
    label: 'Offline',
    badgeVariant: 'outline' as const
  }
}

function StatusDot({ status, pulse = true }: { status: AgentStatus['status']; pulse?: boolean }) {
  const config = STATUS_CONFIG[status]
  
  return (
    <span className="relative flex h-3 w-3">
      {pulse && status === 'online' && (
        <span className={cn(
          "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
          config.pulseColor
        )} />
      )}
      <span className={cn(
        "relative inline-flex rounded-full h-3 w-3",
        config.color
      )} />
    </span>
  )
}

function formatLastSeen(timestamp: number | null): string {
  if (!timestamp) return 'Never'
  
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp
  
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function AgentStatusIndicator({ 
  showDetails = false, 
  compact = false,
  maxAgents = 5 
}: AgentStatusIndicatorProps) {
  const { agents, loading, error, refresh } = useAgentStatus()

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Activity className="w-4 h-4 animate-pulse" />
        <span>Loading agents...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm">
        <Circle className="w-3 h-3" />
        <span>{error}</span>
      </div>
    )
  }

  const onlineCount = agents.filter(a => a.status === 'online').length
  const busyCount = agents.filter(a => a.status === 'busy').length
  const displayAgents = agents.slice(0, maxAgents)

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 cursor-pointer">
              <StatusDot status={onlineCount > 0 ? 'online' : 'offline'} />
              <span className="text-sm">
                {onlineCount} agent{onlineCount !== 1 ? 's' : ''} online
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="p-3">
            <div className="space-y-2">
              {agents.map(agent => (
                <div key={agent.id} className="flex items-center gap-2">
                  <StatusDot status={agent.status} pulse={false} />
                  <span className="font-medium">{agent.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatLastSeen(agent.last_seen)}
                  </span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (!showDetails) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {displayAgents.map(agent => (
            <TooltipProvider key={agent.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2 border-background",
                    agent.status === 'online' ? 'bg-primary' : 'bg-muted'
                  )}>
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {STATUS_CONFIG[agent.status].label} • {formatLastSeen(agent.last_seen)}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
        <div className="text-sm">
          <span className="font-medium">{onlineCount}</span>
          <span className="text-muted-foreground"> online</span>
          {busyCount > 0 && (
            <>
              <span className="text-muted-foreground"> • </span>
              <span className="font-medium">{busyCount}</span>
              <span className="text-muted-foreground"> busy</span>
            </>
          )}
        </div>
      </div>
    )
  }

  // Detailed view
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Agent Status
        </h4>
        <Badge variant="secondary" className="text-xs">
          {onlineCount} / {agents.length} online
        </Badge>
      </div>
      
      <div className="space-y-2">
        {agents.map(agent => (
          <Card key={agent.id} className="p-0">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusDot status={agent.status} />
                  <div>
                    <p className="font-medium text-sm">{agent.name}</p>
                    {agent.current_task && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        Working on: {agent.current_task}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatLastSeen(agent.last_seen)}
                    </div>
                    {agent.uptime_hours && (
                      <div>{agent.uptime_hours.toFixed(1)}h uptime</div>
                    )}
                  </div>
                  <Badge variant={STATUS_CONFIG[agent.status].badgeVariant} className="text-xs">
                    {STATUS_CONFIG[agent.status].label}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/**
 * Mini status bar for header
 */
export function AgentStatusBar() {
  const { agents } = useAgentStatus()
  const onlineAgents = agents.filter(a => a.status === 'online')
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 cursor-pointer hover:bg-muted transition-colors">
            <StatusDot status={onlineAgents.length > 0 ? 'online' : 'offline'} pulse={onlineAgents.length > 0} />
            <span className="text-xs font-medium">{onlineAgents.length}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          <div className="space-y-1.5 min-w-[150px]">
            <p className="font-medium text-sm">Agent Status</p>
            {agents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No agents registered</p>
            ) : (
              agents.map(agent => (
                <div key={agent.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <StatusDot status={agent.status} pulse={false} />
                    <span>{agent.name}</span>
                  </div>
                  <span className="text-muted-foreground">{formatLastSeen(agent.last_seen)}</span>
                </div>
              ))
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}