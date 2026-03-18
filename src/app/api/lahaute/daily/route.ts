import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.env.HOME || '/Users/steve', 'agent', 'data', 'daily-summaries')

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const range = searchParams.get('range') // e.g. "7" for last 7 days

  try {
    if (date) {
      // Single day
      const filePath = path.join(DATA_DIR, `${date}.json`)
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'No data for this date' }, { status: 404 })
      }
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      return NextResponse.json(data)
    }

    if (range) {
      // Last N days
      const days = parseInt(range) || 7
      const results: any[] = []
      for (let i = 0; i < days; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i - 1) // yesterday backwards
        const dateStr = d.toISOString().split('T')[0]
        const filePath = path.join(DATA_DIR, `${dateStr}.json`)
        if (fs.existsSync(filePath)) {
          results.push(JSON.parse(fs.readFileSync(filePath, 'utf8')))
        }
      }
      return NextResponse.json(results.reverse())
    }

    // Default: latest available
    const files = fs.readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
    
    if (files.length === 0) {
      return NextResponse.json({ error: 'No data available' }, { status: 404 })
    }

    const latest = JSON.parse(fs.readFileSync(path.join(DATA_DIR, files[0]), 'utf8'))
    return NextResponse.json(latest)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
