import { NextRequest, NextResponse } from 'next/server'

// Public demo upload endpoint (no auth required)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Mock document processing for demo
    console.log('Demo processing document:', file.name, 'Size:', file.size)
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const mockResponse = {
      success: true,
      document: {
        id: `demo_doc_${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        processed_at: new Date().toISOString(),
        graph_id: "deploy-agent-graph",
        entities_extracted: 47,
        relationships_found: 89,
        processing_time: "2.3s"
      },
      knowledge_graph: {
        nodes: [
          { id: "deploy-your-agent", label: "Deploy Your Agent", type: "company" },
          { id: "ai-agents", label: "AI Agents", type: "technology" },
          { id: "enterprise", label: "Enterprise Market", type: "market" },
          { id: "pricing", label: "Pricing Strategy", type: "business" },
          { id: "competition", label: "Market Competition", type: "market" },
          { id: "cfo", label: "CFO Persona", type: "customer" },
          { id: "cto", label: "CTO Persona", type: "customer" }
        ],
        edges: [
          { from: "deploy-your-agent", to: "ai-agents", label: "provides", weight: 0.9 },
          { from: "ai-agents", to: "enterprise", label: "targets", weight: 0.8 },
          { from: "deploy-your-agent", to: "pricing", label: "implements", weight: 0.7 },
          { from: "enterprise", to: "competition", label: "faces", weight: 0.6 },
          { from: "pricing", to: "cfo", label: "evaluated_by", weight: 0.8 },
          { from: "ai-agents", to: "cto", label: "appeals_to", weight: 0.9 }
        ]
      }
    }

    return NextResponse.json(mockResponse)
  } catch (error) {
    console.error('Demo upload error:', error)
    return NextResponse.json({ 
      error: 'Failed to process document', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}