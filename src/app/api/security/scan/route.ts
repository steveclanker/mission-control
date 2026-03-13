import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { config } from '@/lib/config'
import { requireRole } from '@/lib/auth'
import { readLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { getDatabase } from '@/lib/db'
import net from 'net'

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

// Ensure security_scans table exists
function ensureTable() {
  const db = getDatabase()
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      score INTEGER NOT NULL,
      findings_count INTEGER NOT NULL,
      critical_count INTEGER NOT NULL,
      high_count INTEGER NOT NULL,
      medium_count INTEGER NOT NULL,
      low_count INTEGER NOT NULL,
      findings_json TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `)
}

const SECRET_PATTERNS = [
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{16,}/gi, label: 'API Key' },
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{8,}/gi, label: 'Password' },
  { pattern: /(?:secret|token)\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{16,}/gi, label: 'Secret/Token' },
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, label: 'OpenAI API Key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, label: 'GitHub Personal Token' },
  { pattern: /xoxb-[a-zA-Z0-9\-]+/g, label: 'Slack Bot Token' },
]

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.data'])
const SENSITIVE_EXTENSIONS = new Set(['.ts', '.js', '.tsx', '.jsx', '.yaml', '.yml', '.toml', '.cfg', '.conf', '.md'])

async function scanForSecrets(dir: string, maxDepth = 3, currentDepth = 0): Promise<Finding[]> {
  const findings: Finding[] = []
  if (currentDepth > maxDepth || !existsSync(dir)) return findings

  try {
    const items = await readdir(dir, { withFileTypes: true })
    for (const item of items) {
      if (SKIP_DIRS.has(item.name)) continue
      if (item.name.startsWith('.env')) continue // .env files are expected to have secrets

      const fullPath = join(dir, item.name)
      if (item.isDirectory()) {
        findings.push(...await scanForSecrets(fullPath, maxDepth, currentDepth + 1))
      } else if (item.isFile()) {
        const ext = item.name.substring(item.name.lastIndexOf('.'))
        if (!SENSITIVE_EXTENSIONS.has(ext)) continue

        try {
          const stats = await stat(fullPath)
          if (stats.size > 200_000) continue
          const content = await readFile(fullPath, 'utf-8')
          const lines = content.split('\n')

          for (const { pattern, label } of SECRET_PATTERNS) {
            pattern.lastIndex = 0
            let match
            while ((match = pattern.exec(content)) !== null) {
              const lineNum = content.substring(0, match.index).split('\n').length
              const relativePath = fullPath.replace(dir + '/', '')
              findings.push({
                id: `secret-${relativePath}-${lineNum}-${label}`,
                severity: label.includes('API Key') || label.includes('Token') ? 'critical' : 'high',
                category: 'Exposed Secrets',
                description: `${label} found in ${relativePath} at line ${lineNum}`,
                file: relativePath,
                line: lineNum,
                canAutofix: false,
                autofixAction: 'move-to-env',
              })
            }
          }
        } catch { /* skip unreadable files */ }
      }
    }
  } catch { /* skip unreadable dirs */ }
  return findings
}

async function checkOpenPorts(startPort: number, endPort: number): Promise<Finding[]> {
  const findings: Finding[] = []
  const knownPorts: Record<number, string> = {
    3000: 'Next.js Dev',
    5432: 'PostgreSQL',
    6379: 'Redis',
    8080: 'HTTP Proxy',
    9867: 'PinchTab',
    18789: 'OpenClaw Gateway',
  }

  const checkPort = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const socket = new net.Socket()
      socket.setTimeout(200)
      socket.on('connect', () => { socket.destroy(); resolve(true) })
      socket.on('timeout', () => { socket.destroy(); resolve(false) })
      socket.on('error', () => { socket.destroy(); resolve(false) })
      socket.connect(port, '127.0.0.1')
    })
  }

  // Check a subset of common ports to avoid slow scans
  const portsToCheck = [3000, 3001, 4000, 5000, 5432, 6379, 8080, 8443, 9867, 18789]
  for (const port of portsToCheck) {
    if (port < startPort || port > endPort) continue
    const isOpen = await checkPort(port)
    if (isOpen) {
      const service = knownPorts[port] || 'Unknown'
      findings.push({
        id: `port-${port}`,
        severity: 'low',
        category: 'Open Ports',
        description: `Port ${port} is open (${service})`,
        canAutofix: false,
      })
    }
  }
  return findings
}

function checkConfigSecurity(): Finding[] {
  const findings: Finding[] = []

  // Check if auth is properly configured
  const authUser = process.env.AUTH_USER
  const authPass = process.env.AUTH_PASS
  const skipAuth = process.env.MC_SKIP_PAGE_AUTH

  if (skipAuth && ['1', 'true', 'yes', 'on'].includes(String(skipAuth).toLowerCase())) {
    findings.push({
      id: 'config-skip-auth',
      severity: 'critical',
      category: 'Configuration',
      description: 'MC_SKIP_PAGE_AUTH is enabled — authentication is bypassed!',
      canAutofix: false,
    })
  }

  if (!authUser || !authPass) {
    findings.push({
      id: 'config-no-auth',
      severity: 'high',
      category: 'Configuration',
      description: 'AUTH_USER or AUTH_PASS not configured — using defaults',
      canAutofix: false,
    })
  }

  if (authPass && authPass.length < 12) {
    findings.push({
      id: 'config-weak-password',
      severity: 'high',
      category: 'Configuration',
      description: 'AUTH_PASS is less than 12 characters',
      canAutofix: false,
    })
  }

  return findings
}

function calculateScore(findings: Finding[]): number {
  let score = 100
  for (const f of findings) {
    switch (f.severity) {
      case 'critical': score -= 25; break
      case 'high': score -= 15; break
      case 'medium': score -= 5; break
      case 'low': score -= 2; break
    }
  }
  return Math.max(0, Math.min(100, score))
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = readLimiter(request)
  if (rateCheck) return rateCheck

  try {
    ensureTable()
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'history') {
      const db = getDatabase()
      const history = db.prepare('SELECT * FROM security_scans ORDER BY created_at DESC LIMIT 20').all()
      return NextResponse.json({ history })
    }

    // Run scan
    const findings: Finding[] = []

    // 1. Secret scanning
    const workspaceDir = config.memoryDir ? join(config.memoryDir, '..') : process.cwd()
    if (existsSync(workspaceDir)) {
      findings.push(...await scanForSecrets(workspaceDir))
    }

    // 2. Config security
    findings.push(...checkConfigSecurity())

    // 3. Open ports
    findings.push(...await checkOpenPorts(3000, 19000))

    // Calculate score
    const score = calculateScore(findings)
    const critical = findings.filter(f => f.severity === 'critical').length
    const high = findings.filter(f => f.severity === 'high').length
    const medium = findings.filter(f => f.severity === 'medium').length
    const low = findings.filter(f => f.severity === 'low').length

    // Store scan result
    const db = getDatabase()
    db.prepare(`
      INSERT INTO security_scans (score, findings_count, critical_count, high_count, medium_count, low_count, findings_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(score, findings.length, critical, high, medium, low, JSON.stringify(findings))

    return NextResponse.json({
      score,
      findings,
      summary: { total: findings.length, critical, high, medium, low },
      scannedAt: Date.now(),
    })
  } catch (error) {
    logger.error({ err: error }, 'Security scan error')
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}
