import { NextResponse } from 'next/server'
import { getCached, setCache } from '../cache'

const LATE_API_BASE = 'https://getlate.dev/api/v1'
const CACHE_KEY = 'late:analytics'

export async function GET() {
  // Check cache first
  const cached = getCached<Record<string, unknown>>(CACHE_KEY)
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'X-Cache': 'HIT' },
    })
  }

  const apiKey = process.env.LATE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'LATE_API_KEY not configured' }, { status: 500 })
  }

  try {
    const response = await fetch(`${LATE_API_BASE}/analytics`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('Late API error:', response.status, text)
      return NextResponse.json(
        { error: `Late API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    setCache(CACHE_KEY, data)

    return NextResponse.json(data, {
      headers: { 'X-Cache': 'MISS' },
    })
  } catch (error) {
    console.error('Late API analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
