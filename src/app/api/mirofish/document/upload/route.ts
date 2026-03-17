import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Skip auth for demo purposes
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Mock document processing
    console.log('Processing document:', file.name)
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const mockResponse = {
      success: true,
      document: {
        id: `doc_${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type,
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
          { id: "enterprise", label: "Enterprise", type: "market" },
          { id: "pricing", label: "Pricing Strategy", type: "business" },
          { id: "competition", label: "Competition", type: "market" }
        ],
        edges: [
          { from: "deploy-your-agent", to: "ai-agents", label: "provides" },
          { from: "ai-agents", to: "enterprise", label: "targets" },
          { from: "deploy-your-agent", to: "pricing", label: "implements" },
          { from: "enterprise", to: "competition", label: "faces" }
        ]
      }
    }

    return NextResponse.json(mockResponse)
  } catch (error) {
    console.error('Document upload error:', error)
    return NextResponse.json({ error: 'Failed to process document' }, { status: 500 })
  }
}