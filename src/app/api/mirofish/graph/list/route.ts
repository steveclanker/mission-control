import { NextResponse } from 'next/server'

export async function GET() {
  // Skip auth for demo MiroFish API
  // Mock MiroFish knowledge graphs for demo
  const mockGraphs = [
    {
      id: "deploy-agent-graph",
      name: "Deploy Your Agent Launch Strategy",
      description: "Knowledge graph for AI agent service launch analysis",
      created_at: "2024-03-15T10:30:00Z",
      nodes: 142,
      relationships: 289,
      status: "ready"
    },
    {
      id: "enterprise-market-graph", 
      name: "Enterprise Market Analysis",
      description: "Market research and competitive landscape",
      created_at: "2024-03-14T14:15:00Z",
      nodes: 87,
      relationships: 156,
      status: "ready"
    },
    {
      id: "customer-persona-graph",
      name: "Customer Persona Mapping", 
      description: "Target customer analysis and segmentation",
      created_at: "2024-03-13T16:45:00Z",
      nodes: 64,
      relationships: 134,
      status: "processing"
    }
  ]

  return NextResponse.json({ graphs: mockGraphs })
}