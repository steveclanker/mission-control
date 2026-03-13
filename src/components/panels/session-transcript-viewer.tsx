'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('TranscriptViewer')

interface TranscriptMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp?: number
  toolName?: string
  toolCallId?: string
}

const ROLE_STYLES: Record<string, { bg: string; label: string; icon: string }> = {
  user: { bg: 'bg-blue-500/10 border-blue-500/20', label: 'User', icon: '👤' },
  assistant: { bg: 'bg-violet-500/10 border-violet-500/20', label: 'Assistant', icon: '🤖' },
  system: { bg: 'bg-zinc-500/10 border-zinc-500/20', label: 'System', icon: '⚙️' },
  tool: { bg: 'bg-amber-500/10 border-amber-500/20', label: 'Tool', icon: '🔧' },
}

interface Props {
  sessionId: string
}

export function SessionTranscriptViewer({ sessionId }: Props) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedTools, setCollapsedTools] = useState<Set<number>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  const loadTranscript = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/transcript`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      log.error('Failed to load transcript:', error)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (sessionId) loadTranscript()
  }, [sessionId, loadTranscript])

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages, autoScroll])

  const toggleToolCollapse = (index: number) => {
    const next = new Set(collapsedTools)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setCollapsedTools(next)
  }

  const filteredMessages = searchQuery
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages

  const exportMarkdown = () => {
    const md = messages.map((m) => {
      const label = ROLE_STYLES[m.role]?.label || m.role
      return `### ${label}${m.toolName ? ` (${m.toolName})` : ''}\n\n${m.content}\n`
    }).join('\n---\n\n')

    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript-${sessionId}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderContent = (content: string) => {
    // Simple code block detection
    const parts = content.split(/(```[\s\S]*?```)/g)
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.split('\n')
        const lang = lines[0].replace('```', '').trim()
        const code = lines.slice(1, -1).join('\n')
        return (
          <pre key={i} className="bg-zinc-950 border border-zinc-800 rounded-md p-3 my-2 overflow-x-auto">
            {lang && <div className="text-xs text-zinc-600 mb-1">{lang}</div>}
            <code className="text-xs text-zinc-300">{code}</code>
          </pre>
        )
      }
      return <span key={i} className="whitespace-pre-wrap">{part}</span>
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <span className="ml-3 text-sm text-zinc-500">Loading transcript...</span>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        No transcript available for this session.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search transcript..."
          className="flex-1 px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-800 rounded text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button
          onClick={exportMarkdown}
          className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 rounded hover:bg-zinc-700 transition-colors"
        >
          Export MD
        </button>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`px-3 py-1.5 text-xs border rounded transition-colors ${
            autoScroll ? 'bg-primary/20 text-primary border-primary/30' : 'bg-zinc-800 text-zinc-500 border-zinc-700'
          }`}
        >
          Auto-scroll
        </button>
      </div>

      {searchQuery && (
        <div className="text-xs text-zinc-500">
          Showing {filteredMessages.length} of {messages.length} messages
        </div>
      )}

      {/* Messages */}
      <div ref={containerRef} className="max-h-[600px] overflow-y-auto space-y-2 pr-1">
        {filteredMessages.map((msg, i) => {
          const style = ROLE_STYLES[msg.role] || ROLE_STYLES.system
          const isToolMsg = msg.role === 'tool'
          const isCollapsed = isToolMsg && collapsedTools.has(i)

          return (
            <div key={i} className={`border rounded-lg ${style.bg}`}>
              <div
                className={`flex items-center gap-2 px-3 py-2 ${isToolMsg ? 'cursor-pointer' : ''}`}
                onClick={isToolMsg ? () => toggleToolCollapse(i) : undefined}
              >
                <span className="text-sm">{style.icon}</span>
                <span className="text-xs font-medium text-zinc-300">{style.label}</span>
                {msg.toolName && (
                  <span className="text-xs text-zinc-500 font-mono">({msg.toolName})</span>
                )}
                {msg.timestamp && (
                  <span className="text-xs text-zinc-600 ml-auto">
                    {new Date(msg.timestamp * 1000).toLocaleTimeString()}
                  </span>
                )}
                {isToolMsg && (
                  <span className="text-xs text-zinc-600 ml-1">
                    {isCollapsed ? '▶' : '▼'}
                  </span>
                )}
              </div>
              {(!isToolMsg || !isCollapsed) && (
                <div className="px-3 pb-3 text-sm text-zinc-300">
                  {renderContent(msg.content)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
