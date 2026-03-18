import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const STOCK_FILE = path.join(process.env.HOME || '/Users/steve', 'agent', 'data', 'stock', 'latest.json')

export async function GET(req: NextRequest) {
  try {
    if (!fs.existsSync(STOCK_FILE)) {
      return NextResponse.json({ error: 'No stock data. Run stock-pull.js first.' }, { status: 404 })
    }
    const data = JSON.parse(fs.readFileSync(STOCK_FILE, 'utf8'))
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
