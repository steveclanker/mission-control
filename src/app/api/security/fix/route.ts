import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { mutationLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  try {
    const { action, findingId } = await request.json()

    // For now, return guidance rather than auto-fixing
    // Auto-fixing file permissions and secrets is risky without proper review
    return NextResponse.json({
      success: false,
      message: `Autofix for "${action}" is not yet implemented. Please fix manually.`,
      findingId,
      guidance: action === 'move-to-env'
        ? 'Move the secret value to a .env file and reference it via process.env.VARIABLE_NAME'
        : 'Please review and fix this finding manually.',
    })
  } catch (error) {
    logger.error({ err: error }, 'Security fix error')
    return NextResponse.json({ error: 'Fix failed' }, { status: 500 })
  }
}
