import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile, stat, lstat } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { config } from '@/lib/config'
import { requireRole } from '@/lib/auth'
import { readLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const MEMORY_PATH = config.memoryDir
const MEMORY_ALLOWED_PREFIXES = (config.memoryAllowedPrefixes || []).map((p) => p.replace(/\\/g, '/'))

interface GraphNode {
  id: string
  label: string
  type: 'daily' | 'knowledge' | 'json' | 'memory' | 'other'
  size: number
}

interface GraphEdge {
  source: string
  target: string
}

function classifyFile(path: string): GraphNode['type'] {
  const lower = path.toLowerCase()
  if (lower.includes('memory.md') || lower === 'memory.md') return 'memory'
  if (lower.endsWith('.json')) return 'json'
  if (/\d{4}-\d{2}-\d{2}/.test(lower) || lower.includes('daily/') || lower.includes('memory/')) return 'daily'
  if (lower.includes('knowledge') || lower.includes('reference') || lower.includes('templates')) return 'knowledge'
  return 'other'
}

async function collectFiles(dirPath: string, relativePath: string = ''): Promise<Array<{ path: string; name: string; size: number; content: string }>> {
  const files: Array<{ path: string; name: string; size: number; content: string }> = []
  try {
    const items = await readdir(dirPath, { withFileTypes: true })
    for (const item of items) {
      if (item.isSymbolicLink()) continue
      const itemPath = join(dirPath, item.name)
      const itemRelative = relativePath ? `${relativePath}/${item.name}` : item.name
      if (item.isDirectory()) {
        const children = await collectFiles(itemPath, itemRelative)
        files.push(...children)
      } else if (item.isFile()) {
        try {
          const stats = await stat(itemPath)
          if (stats.size > 500_000) continue // skip very large files
          const content = await readFile(itemPath, 'utf-8')
          files.push({ path: itemRelative, name: item.name, size: stats.size, content })
        } catch { /* skip unreadable */ }
      }
    }
  } catch (e) {
    logger.error({ err: e, path: dirPath }, 'Error collecting files for graph')
  }
  return files
}

function buildGraph(files: Array<{ path: string; name: string; size: number; content: string }>): { nodes: GraphNode[]; edges: GraphEdge[]; health: { totalFiles: number; lastUpdated: number; orphanedFiles: number } } {
  const fileMap = new Map<string, typeof files[number]>()
  for (const f of files) {
    fileMap.set(f.path, f)
    fileMap.set(f.name, f)
    // Also index without extension
    const noExt = f.name.replace(/\.\w+$/, '')
    if (!fileMap.has(noExt)) fileMap.set(noExt, f)
  }

  const nodes: GraphNode[] = files.map(f => ({
    id: f.path,
    label: f.name,
    type: classifyFile(f.path),
    size: f.size,
  }))

  const edges: GraphEdge[] = []
  const edgeSet = new Set<string>()

  for (const f of files) {
    // Find [[wiki-style]] links
    const wikiLinks = f.content.matchAll(/\[\[([^\]]+)\]\]/g)
    for (const match of wikiLinks) {
      const target = match[1].trim()
      // Find target file
      const targetFile = fileMap.get(target) || fileMap.get(`${target}.md`) || fileMap.get(`${target}.json`)
      if (targetFile && targetFile.path !== f.path) {
        const key = `${f.path}->${targetFile.path}`
        if (!edgeSet.has(key)) {
          edgeSet.add(key)
          edges.push({ source: f.path, target: targetFile.path })
        }
      }
    }

    // Find markdown links [text](path)
    const mdLinks = f.content.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)
    for (const match of mdLinks) {
      const linkPath = match[2].trim()
      if (linkPath.startsWith('http')) continue
      const targetFile = fileMap.get(linkPath) || fileMap.get(linkPath.replace(/^\.\//, ''))
      if (targetFile && targetFile.path !== f.path) {
        const key = `${f.path}->${targetFile.path}`
        if (!edgeSet.has(key)) {
          edgeSet.add(key)
          edges.push({ source: f.path, target: targetFile.path })
        }
      }
    }

    // Find file references (e.g., `memory/2024-01-01.md` or `MEMORY.md`)
    const fileRefs = f.content.matchAll(/(?:^|\s|`)((?:[\w.-]+\/)*[\w.-]+\.(?:md|json|txt))(?:\s|$|`|[,;)])/gm)
    for (const match of fileRefs) {
      const refPath = match[1].trim()
      const targetFile = fileMap.get(refPath)
      if (targetFile && targetFile.path !== f.path) {
        const key = `${f.path}->${targetFile.path}`
        if (!edgeSet.has(key)) {
          edgeSet.add(key)
          edges.push({ source: f.path, target: targetFile.path })
        }
      }
    }
  }

  // Calculate health
  const connectedNodes = new Set<string>()
  for (const e of edges) {
    connectedNodes.add(e.source)
    connectedNodes.add(e.target)
  }
  const orphanedFiles = nodes.filter(n => !connectedNodes.has(n.id)).length

  let lastUpdated = 0
  // We don't have timestamps in the collected files, but that's OK

  return {
    nodes,
    edges,
    health: {
      totalFiles: nodes.length,
      lastUpdated: Date.now(),
      orphanedFiles,
    },
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = readLimiter(request)
  if (rateCheck) return rateCheck

  try {
    if (!MEMORY_PATH || !existsSync(MEMORY_PATH)) {
      return NextResponse.json({ nodes: [], edges: [], health: { totalFiles: 0, lastUpdated: 0, orphanedFiles: 0 } })
    }

    let files: Array<{ path: string; name: string; size: number; content: string }> = []

    if (MEMORY_ALLOWED_PREFIXES.length) {
      for (const prefix of MEMORY_ALLOWED_PREFIXES) {
        const folder = prefix.replace(/\/$/, '')
        const fullPath = join(MEMORY_PATH, folder)
        if (!existsSync(fullPath)) continue
        const prefixFiles = await collectFiles(fullPath, folder)
        files.push(...prefixFiles)
      }
    } else {
      files = await collectFiles(MEMORY_PATH)
    }

    const graph = buildGraph(files)
    return NextResponse.json(graph)
  } catch (error) {
    logger.error({ err: error }, 'Memory graph API error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
