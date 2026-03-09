import { NextResponse } from 'next/server'

const LATE_API_BASE = 'https://getlate.dev/api/v1'

export async function GET() {
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
    // Late API already includes platformPostUrl, thumbnailUrl, mediaItems in analytics posts
    return NextResponse.json(data)
  } catch (error) {
    console.error('Late API analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
