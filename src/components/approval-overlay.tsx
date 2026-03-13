'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useSmartPoll } from '@/lib/use-smart-poll'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('ApprovalOverlay')

interface Approval {
  id: number
  agent_name: string
  command: string
  risk_level: string
  status: string
  comment: string | null
  decided_by: string | null
  created_at: number
  decided_at: number | null
}

const RISK_COLORS: Record<string, string> = {
  high: 'text-red-400 bg-red-500/10 border-red-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  low: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
}

export function ApprovalOverlay() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [processingId, setProcessingId] = useState<number | null>(null)

  const loadApprovals = useCallback(async () => {
    try {
      const res = await fetch('/api/approvals?status=pending')
      if (res.ok) {
        const data = await res.json()
        setApprovals(data.approvals || [])
        setPendingCount(data.pendingCount || 0)

        // Auto-open when new approvals arrive
        if (data.pendingCount > 0 && !isOpen) {
          setIsOpen(true)
        }
      }
    } catch (error) {
      // Silently fail — overlay is non-critical
    }
  }, [isOpen])

  useSmartPoll(loadApprovals, 10000)

  const handleAction = async (id: number, action: 'approve' | 'deny') => {
    setProcessingId(id)
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, comment: comment || undefined }),
      })
      if (res.ok) {
        setApprovals((prev) => prev.filter((a) => a.id !== id))
        setPendingCount((prev) => Math.max(0, prev - 1))
        setComment('')
      }
    } catch (error) {
      log.error('Approval action failed:', error)
    } finally {
      setProcessingId(null)
    }
  }

  if (pendingCount === 0 && !isOpen) return null

  return (
    <>
      {/* Badge button (always visible when there are pending approvals) */}
      {pendingCount > 0 && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-300 hover:bg-amber-500/30 transition-colors shadow-lg backdrop-blur-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 1L2 4v4c0 4 2.5 6 6 7 3.5-1 6-3 6-7V4L8 1z" />
          </svg>
          <span className="text-sm font-medium">{pendingCount} Pending</span>
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        </button>
      )}

      {/* Drawer */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col bg-zinc-900 border-l border-zinc-800 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M8 1L2 4v4c0 4 2.5 6 6 7 3.5-1 6-3 6-7V4L8 1z" />
              </svg>
              <h2 className="font-semibold text-zinc-100">
                Exec Approvals
                {pendingCount > 0 && (
                  <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* Approvals List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {approvals.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <p>No pending approvals</p>
              </div>
            ) : (
              approvals.map((approval) => {
                const riskClass = RISK_COLORS[approval.risk_level] || RISK_COLORS.medium
                return (
                  <div key={approval.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-200">{approval.agent_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${riskClass}`}>
                        {approval.risk_level}
                      </span>
                    </div>

                    <pre className="text-xs bg-zinc-900 border border-zinc-800 rounded p-2 overflow-x-auto text-zinc-300 whitespace-pre-wrap">
                      {approval.command}
                    </pre>

                    <div className="text-xs text-zinc-500">
                      {new Date(approval.created_at * 1000).toLocaleString()}
                    </div>

                    {/* Comment input */}
                    <input
                      type="text"
                      placeholder="Optional comment..."
                      value={processingId === approval.id ? comment : ''}
                      onChange={(e) => setComment(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(approval.id, 'approve')}
                        disabled={processingId === approval.id}
                        className="flex-1 px-3 py-1.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
                      >
                        {processingId === approval.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleAction(approval.id, 'deny')}
                        disabled={processingId === approval.id}
                        className="flex-1 px-3 py-1.5 text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                      >
                        {processingId === approval.id ? '...' : 'Deny'}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </>
  )
}
