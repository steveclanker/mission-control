'use client'

import React, { useState, useCallback } from 'react'
import { useSmartPoll } from '@/lib/use-smart-poll'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('SecurityAudit')

interface Finding {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  description: string
  file?: string
  line?: number
  canAutofix: boolean
  autofixAction?: string
}

interface ScanResult {
  score: number
  findings: Finding[]
  summary: { total: number; critical: number; high: number; medium: number; low: number }
  scannedAt: number
}

interface ScanHistory {
  id: number
  score: number
  findings_count: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  created_at: number
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  low: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-yellow-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20'
  if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/20'
  if (score >= 40) return 'bg-orange-500/10 border-orange-500/20'
  return 'bg-red-500/10 border-red-500/20'
}

export function SecurityAuditPanel() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [history, setHistory] = useState<ScanHistory[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [activeTab, setActiveTab] = useState<'scan' | 'history'>('scan')
  const [fixingId, setFixingId] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/security/scan?action=history')
      if (res.ok) {
        const data = await res.json()
        setHistory(data.history || [])
      }
    } catch (error) {
      log.error('Failed to load scan history:', error)
    }
  }, [])

  useSmartPoll(loadHistory, 120000)

  const runScan = async () => {
    setIsScanning(true)
    try {
      const res = await fetch('/api/security/scan')
      if (res.ok) {
        const data = await res.json()
        setScanResult(data)
        loadHistory()
      }
    } catch (error) {
      log.error('Scan failed:', error)
    } finally {
      setIsScanning(false)
    }
  }

  const attemptFix = async (finding: Finding) => {
    setFixingId(finding.id)
    try {
      const res = await fetch('/api/security/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: finding.autofixAction, findingId: finding.id }),
      })
      const data = await res.json()
      alert(data.message || data.guidance || 'Fix attempted')
    } catch (error) {
      log.error('Fix failed:', error)
    } finally {
      setFixingId(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="border-b border-zinc-800 pb-4">
        <h1 className="text-3xl font-bold text-zinc-100">Security Audit</h1>
        <p className="text-zinc-400 mt-2">Scan your workspace for security vulnerabilities and misconfigurations</p>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setActiveTab('scan')}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === 'scan' ? 'bg-primary text-primary-foreground' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            Scan Results
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === 'history' ? 'bg-primary text-primary-foreground' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            History
          </button>
          <div className="flex-1" />
          <button
            onClick={runScan}
            disabled={isScanning}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isScanning ? 'Scanning...' : 'Run Scan'}
          </button>
        </div>
      </div>

      {activeTab === 'scan' && (
        <>
          {/* Score Card */}
          {scanResult && (
            <div className={`border rounded-lg p-6 ${getScoreBg(scanResult.score)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-zinc-400">Security Posture Score</div>
                  <div className={`text-5xl font-bold mt-1 ${getScoreColor(scanResult.score)}`}>
                    {scanResult.score}
                    <span className="text-lg text-zinc-500">/100</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-zinc-400">Critical: {scanResult.summary.critical}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    <span className="text-zinc-400">High: {scanResult.summary.high}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="text-zinc-400">Medium: {scanResult.summary.medium}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-zinc-400">Low: {scanResult.summary.low}</span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-zinc-500 mt-3">
                Scanned at {new Date(scanResult.scannedAt).toLocaleString()}
              </div>
            </div>
          )}

          {/* Findings */}
          {scanResult && scanResult.findings.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-100">
                Findings ({scanResult.findings.length})
              </h2>
              {scanResult.findings.map((finding) => {
                const colors = SEVERITY_COLORS[finding.severity]
                return (
                  <div
                    key={finding.id}
                    className={`${colors.bg} border ${colors.border} rounded-lg p-4`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${colors.bg} ${colors.text} border ${colors.border}`}>
                            {finding.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-zinc-500">{finding.category}</span>
                        </div>
                        <p className="text-sm text-zinc-200">{finding.description}</p>
                        {finding.file && (
                          <p className="text-xs text-zinc-500 mt-1 font-mono">
                            {finding.file}{finding.line ? `:${finding.line}` : ''}
                          </p>
                        )}
                      </div>
                      {finding.autofixAction && (
                        <button
                          onClick={() => attemptFix(finding)}
                          disabled={fixingId === finding.id}
                          className="shrink-0 ml-3 px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 rounded hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                        >
                          {fixingId === finding.id ? 'Fixing...' : 'Autofix'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : scanResult ? (
            <div className="text-center py-12 text-zinc-500">
              No security findings — your workspace looks clean! ✅
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-500">
              Click &quot;Run Scan&quot; to perform a security audit of your workspace.
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">Scan History</h2>
          {history.length === 0 ? (
            <p className="text-zinc-500 text-sm">No scan history yet. Run your first scan above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2 px-3">Score</th>
                    <th className="text-left py-2 px-3">Findings</th>
                    <th className="text-left py-2 px-3">Critical</th>
                    <th className="text-left py-2 px-3">High</th>
                    <th className="text-left py-2 px-3">Medium</th>
                    <th className="text-left py-2 px-3">Low</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((scan) => (
                    <tr key={scan.id} className="border-b border-zinc-800/50 text-zinc-300">
                      <td className="py-2 px-3">{new Date(scan.created_at * 1000).toLocaleString()}</td>
                      <td className={`py-2 px-3 font-bold ${getScoreColor(scan.score)}`}>{scan.score}</td>
                      <td className="py-2 px-3">{scan.findings_count}</td>
                      <td className="py-2 px-3 text-red-400">{scan.critical_count}</td>
                      <td className="py-2 px-3 text-orange-400">{scan.high_count}</td>
                      <td className="py-2 px-3 text-yellow-400">{scan.medium_count}</td>
                      <td className="py-2 px-3 text-blue-400">{scan.low_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
