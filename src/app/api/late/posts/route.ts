import { NextRequest, NextResponse } from 'next/server'

const LATE_API_BASE = 'https://getlate.dev/api/v1'

export async function GET() {
  const apiKey = process.env.LATE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'LATE_API_KEY not configured' }, { status: 500 })
  }

  try {
    const response = await fetch(`${LATE_API_BASE}/posts`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch posts from Late API' },
        { status: response.status }
      )
    }

    const data = await response.json()
    // Late API wraps responses in { data: {...} }, so unwrap it
    return NextResponse.json(data.data || data)
  } catch (error) {
    console.error('Late API posts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.LATE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'LATE_API_KEY not configured' }, { status: 500 })
  }

  try {
    const body = await request.json()

    const response = await fetch(`${LATE_API_BASE}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: 'Failed to create post', details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()
    // Late API wraps responses in { data: {...} }, so unwrap it
    return NextResponse.json(data.data || data)
  } catch (error) {
    console.error('Late API create post error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
