import { NextResponse } from 'next/server'

export async function GET() {
  // Mock MiroFish simulations for demo
  const mockSimulations = [
    {
      id: "deploy-agent-sim-1",
      name: "Deploy Your Agent - Pricing Strategy Test",
      description: "Testing customer response to different pricing tiers",
      status: "completed",
      created_at: "2024-03-15T10:30:00Z",
      agents: 1000,
      platforms: ["twitter", "linkedin"],
      results: {
        adoption_rate: 0.68,
        price_sensitivity: 0.43,
        optimal_price: "$50K",
        confidence: 0.89
      }
    },
    {
      id: "enterprise-market-sim-1",
      name: "Enterprise Market Response Analysis", 
      description: "Market reaction to AI agent services launch",
      status: "running",
      created_at: "2024-03-14T14:15:00Z",
      agents: 2500,
      platforms: ["twitter", "linkedin", "reddit"],
      progress: 0.67
    },
    {
      id: "competitor-response-sim-1",
      name: "Competitive Response Simulation",
      description: "Predicting competitor reactions to our launch",
      status: "queued", 
      created_at: "2024-03-13T16:45:00Z",
      agents: 500,
      platforms: ["twitter", "linkedin"]
    }
  ]

  return NextResponse.json({ simulations: mockSimulations })
}