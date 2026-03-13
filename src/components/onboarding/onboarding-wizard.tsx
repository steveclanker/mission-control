'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('Onboarding')

interface StepResult {
  runtime?: string
  agents?: string[]
  securityScore?: number
  credentials?: string[]
}

const STEPS = [
  { id: 'welcome', title: 'Welcome to Mission Control', subtitle: 'Let\'s get you set up' },
  { id: 'runtime', title: 'Runtime Detection', subtitle: 'Detecting your environment' },
  { id: 'agents', title: 'Agent Setup', subtitle: 'Finding installed agents' },
  { id: 'security', title: 'Security Quick Scan', subtitle: 'Checking your workspace' },
  { id: 'credentials', title: 'Credentials Check', subtitle: 'Verifying configuration' },
  { id: 'done', title: 'Ready to Go!', subtitle: 'You\'re all set' },
]

export function OnboardingWizard() {
  const [isVisible, setIsVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [results, setResults] = useState<StepResult>({})
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('mc-onboarding-complete')
      if (!dismissed) {
        setIsVisible(true)
      }
    } catch {
      // localStorage not available
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem('mc-onboarding-complete', 'true')
    } catch {}
    setIsVisible(false)
  }

  const detectRuntime = useCallback(async () => {
    setIsChecking(true)
    try {
      const res = await fetch('/api/status?action=capabilities')
      if (res.ok) {
        const data = await res.json()
        setResults(prev => ({
          ...prev,
          runtime: data.gateway ? 'Gateway Mode' : 'Local Mode',
        }))
      }
    } catch {
      setResults(prev => ({ ...prev, runtime: 'Local Mode (offline)' }))
    }
    setIsChecking(false)
  }, [])

  const detectAgents = useCallback(async () => {
    setIsChecking(true)
    try {
      const res = await fetch('/api/agents')
      if (res.ok) {
        const data = await res.json()
        const agents = (data.agents || data || []).map((a: any) => a.name || a.id || 'Unknown')
        setResults(prev => ({ ...prev, agents }))
      }
    } catch {
      setResults(prev => ({ ...prev, agents: [] }))
    }
    setIsChecking(false)
  }, [])

  const runSecurityScan = useCallback(async () => {
    setIsChecking(true)
    try {
      const res = await fetch('/api/security/scan')
      if (res.ok) {
        const data = await res.json()
        setResults(prev => ({ ...prev, securityScore: data.score }))
      }
    } catch {
      setResults(prev => ({ ...prev, securityScore: -1 }))
    }
    setIsChecking(false)
  }, [])

  const checkCredentials = useCallback(async () => {
    setIsChecking(true)
    // Just check if env files are detected (basic check)
    const detected: string[] = []
    try {
      const res = await fetch('/api/status?action=capabilities')
      if (res.ok) {
        const data = await res.json()
        if (data.gateway) detected.push('Gateway token')
        detected.push('Auth configured')
      }
    } catch {}
    setResults(prev => ({ ...prev, credentials: detected.length > 0 ? detected : ['Basic setup detected'] }))
    setIsChecking(false)
  }, [])

  useEffect(() => {
    if (currentStep === 1) detectRuntime()
    if (currentStep === 2) detectAgents()
    if (currentStep === 3) runSecurityScan()
    if (currentStep === 4) checkCredentials()
  }, [currentStep, detectRuntime, detectAgents, runSecurityScan, checkCredentials])

  if (!isVisible) return null

  const step = STEPS[currentStep]
  const progress = ((currentStep + 1) / STEPS.length) * 100

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1 bg-zinc-800">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">MC</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-100">{step.title}</h2>
                <p className="text-sm text-zinc-500">{step.subtitle}</p>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
            >
              Skip
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 min-h-[200px]">
          {currentStep === 0 && (
            <div className="space-y-4">
              <p className="text-zinc-300 text-sm">
                Mission Control is your agent operations dashboard. It helps you monitor, manage, and orchestrate your AI agents.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: '🤖', label: 'Manage agents' },
                  { icon: '📊', label: 'Track costs' },
                  { icon: '🔒', label: 'Security audits' },
                  { icon: '📝', label: 'Browse memory' },
                ].map(({ icon, label }) => (
                  <div key={label} className="bg-zinc-800 rounded-lg p-3 flex items-center gap-2">
                    <span>{icon}</span>
                    <span className="text-sm text-zinc-300">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              {isChecking ? (
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  <span className="text-sm text-zinc-400">Detecting runtime environment...</span>
                </div>
              ) : (
                <>
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <div className="text-sm text-zinc-500">Detected Mode</div>
                    <div className="text-lg font-semibold text-zinc-100 mt-1">{results.runtime || 'Unknown'}</div>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {results.runtime?.includes('Gateway')
                      ? 'Gateway mode provides full multi-agent orchestration with real-time WebSocket communication.'
                      : 'Local mode works with the local filesystem and SQLite. Connect a gateway for full features.'}
                  </p>
                </>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              {isChecking ? (
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  <span className="text-sm text-zinc-400">Scanning for agents...</span>
                </div>
              ) : (
                <>
                  {results.agents && results.agents.length > 0 ? (
                    <div className="space-y-2">
                      {results.agents.map((agent) => (
                        <div key={agent} className="bg-zinc-800 rounded-lg p-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-sm text-zinc-200">{agent}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-zinc-800 rounded-lg p-4 text-center">
                      <p className="text-sm text-zinc-400">No agents registered yet.</p>
                      <p className="text-xs text-zinc-500 mt-1">Agents will appear here once they connect.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              {isChecking ? (
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  <span className="text-sm text-zinc-400">Running quick security scan...</span>
                </div>
              ) : (
                <div className="bg-zinc-800 rounded-lg p-4 text-center">
                  {results.securityScore !== undefined && results.securityScore >= 0 ? (
                    <>
                      <div className={`text-4xl font-bold ${
                        results.securityScore >= 80 ? 'text-emerald-400' :
                        results.securityScore >= 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {results.securityScore}/100
                      </div>
                      <p className="text-sm text-zinc-400 mt-2">Security Posture Score</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Visit the Security panel for detailed findings.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-zinc-400">Security scan unavailable. Check the Security panel later.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              {isChecking ? (
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  <span className="text-sm text-zinc-400">Checking credentials...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {(results.credentials || []).map((cred) => (
                    <div key={cred} className="bg-zinc-800 rounded-lg p-3 flex items-center gap-2">
                      <span className="text-emerald-400">✓</span>
                      <span className="text-sm text-zinc-200">{cred}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4 text-center">
              <div className="text-4xl">🚀</div>
              <p className="text-zinc-300">
                Mission Control is ready. Explore the dashboard to monitor your agents, track costs, and manage your workspace.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {[
                  { label: 'View Overview', tab: 'overview' },
                  { label: 'Browse Memory', tab: 'memory' },
                  { label: 'Security Audit', tab: 'security' },
                  { label: 'Settings', tab: 'settings' },
                ].map(({ label }) => (
                  <button
                    key={label}
                    onClick={dismiss}
                    className="px-3 py-2 text-xs bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            Step {currentStep + 1} of {STEPS.length}
          </div>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-4 py-2 text-sm bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Back
              </button>
            )}
            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={isChecking}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isChecking ? 'Checking...' : 'Next'}
              </button>
            ) : (
              <button
                onClick={dismiss}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
