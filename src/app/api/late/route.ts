import { NextRequest, NextResponse } from 'next/server'

const LATE_API_BASE = 'https://getlate.dev/api/v1'

export async function GET(request: NextRequest) {
  const { searchParams, pathname } = new URL(request.url)
  const endpoint = searchParams.get('endpoint') || pathname.replace('/api/late', '')
  
  try {
    const response = await fetch(`${LATE_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${process.env.LATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Late API Error:', error)
    return NextResponse.json({ error: 'Late API unavailable' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  const { searchParams, pathname } = new URL(request.url)
  const endpoint = searchParams.get('endpoint') || pathname.replace('/api/late', '')
  
  try {
    const body = await request.text()
    
    const response = await fetch(`${LATE_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body,
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Late API Error:', error)
    return NextResponse.json({ error: 'Late API unavailable' }, { status: 503 })
  }
}