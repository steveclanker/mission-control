import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { mutationLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { execSync } from 'child_process'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  try {
    // Try npm update for openclaw
    let output = ''
    try {
      output = execSync('npm update -g openclaw 2>&1', { timeout: 60000, encoding: 'utf-8' })
    } catch (e: any) {
      output = e.stdout || e.message || 'Update command failed'
    }

    return NextResponse.json({
      success: true,
      message: 'Update initiated. You may need to restart the server.',
      output: output.substring(0, 2000),
    })
  } catch (error) {
    logger.error({ err: error }, 'Update API error')
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
