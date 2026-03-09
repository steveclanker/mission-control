import { NextResponse } from 'next/server'

const LATE_API_BASE = 'https://getlate.dev/api/v1'

export async function GET() {
  const apiKey = process.env.LATE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'LATE_API_KEY not configured' }, { status: 500 })
  }

  try {
    const response = await fetch(`${LATE_API_BASE}/accounts`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch accounts from Late API' },
        { status: response.status }
      )
    }

    const data = await response.json()
    const raw = data.data || data
    // Sanitize accounts — strip nested objects that could crash React
    const accounts = (raw.accounts || []).map((acc: Record<string, unknown>) => ({
      _id: acc._id,
      platform: acc.platform || 'instagram',
      displayName: acc.displayName || '',
      username: acc.username || '',
      followersCount: acc.followersCount || 0,
      externalPostCount: acc.externalPostCount || 0,
      isActive: acc.isActive ?? true,
      analyticsLastSyncedAt: acc.analyticsLastSyncedAt || null,
      profilePicture: acc.profilePicture || null,
      profileUrl: acc.profileUrl || null,
    }))
    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('Late API accounts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
