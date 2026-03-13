'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('MemoryGraph')

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

interface MemoryHealth {
  totalFiles: number
  lastUpdated: number
  orphanedFiles: number
}

const NODE_COLORS: Record<string, string> = {
  daily: '#3b82f6',
  knowledge: '#a855f7',
  json: '#f59e0b',
  memory: '#eab308',
  other: '#6b7280',
}

interface MemoryGraphViewProps {
  onSelectFile: (path: string) => void
}

export function MemoryGraphView({ onSelectFile }: MemoryGraphViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [health, setHealth] = useState<MemoryHealth | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const loadGraph = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/memory/graph')
      const data = await res.json()

      const graphNodes: GraphNode[] = data.nodes || []
      const graphEdges: GraphEdge[] = data.edges || []

      // Layout nodes in a force-directed-like pattern
      const angleStep = (2 * Math.PI) / Math.max(graphNodes.length, 1)
      const radius = Math.max(200, graphNodes.length * 20)

      const flowNodes: Node[] = graphNodes.map((n, i) => {
        const angle = i * angleStep
        const r = radius + (n.size > 1000 ? 50 : 0) + Math.random() * 60
        return {
          id: n.id,
          position: {
            x: 400 + r * Math.cos(angle),
            y: 400 + r * Math.sin(angle),
          },
          data: {
            label: n.label,
            type: n.type,
            size: n.size,
            fullPath: n.id,
          },
          style: {
            background: NODE_COLORS[n.type] || NODE_COLORS.other,
            color: '#fff',
            border: `2px solid ${NODE_COLORS[n.type] || NODE_COLORS.other}`,
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
            minWidth: '60px',
            textAlign: 'center' as const,
            boxShadow: `0 0 10px ${NODE_COLORS[n.type] || NODE_COLORS.other}40`,
          },
          type: 'default',
        }
      })

      const flowEdges: Edge[] = graphEdges.map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        animated: true,
        style: { stroke: '#525252', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#525252' },
      }))

      setNodes(flowNodes)
      setEdges(flowEdges)
      setHealth(data.health || null)
    } catch (error) {
      log.error('Failed to load graph:', error)
    } finally {
      setIsLoading(false)
    }
  }, [setNodes, setEdges])

  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeId(node.id)
    onSelectFile(node.data.fullPath as string)
  }, [onSelectFile])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="text-sm text-muted-foreground">Building knowledge graph...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Health Indicators */}
      {health && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-zinc-100">{health.totalFiles}</div>
            <div className="text-xs text-zinc-500">Total Files</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-zinc-100">
              {new Date(health.lastUpdated).toLocaleDateString()}
            </div>
            <div className="text-xs text-zinc-500">Last Scanned</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
            <div className={`text-xl font-bold ${health.orphanedFiles > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {health.orphanedFiles}
            </div>
            <div className="text-xs text-zinc-500">Orphaned Files</div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-zinc-500">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: color }} />
            <span className="capitalize">{type === 'memory' ? 'MEMORY.md' : type}</span>
          </div>
        ))}
      </div>

      {/* Graph */}
      <div className="h-[500px] bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500">
            No memory files found. Create some files to see the graph.
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            minZoom={0.1}
            maxZoom={3}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ animated: true }}
          >
            <Background color="#27272a" gap={20} />
            <Controls
              showInteractive={false}
              className="!bg-zinc-900 !border-zinc-800 !rounded-lg [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700 [&>button]:!text-zinc-300 [&>button:hover]:!bg-zinc-700"
            />
            <MiniMap
              style={{ background: '#18181b' }}
              nodeColor={(node) => NODE_COLORS[(node.data as any)?.type] || '#6b7280'}
              maskColor="rgba(0,0,0,0.7)"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}
