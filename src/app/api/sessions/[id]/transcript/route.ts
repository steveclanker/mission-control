import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { readLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import os from 'os'

interface TranscriptMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp?: number
  toolName?: string
  toolCallId?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = readLimiter(request)
  if (rateCheck) return rateCheck

  const { id } = await params

  try {
    // Try to find transcript in OpenClaw state directory
    const openclawDir = process.env.OPENCLAW_STATE_DIR || join(os.homedir(), '.openclaw')
    const possiblePaths = [
      join(openclawDir, 'sessions', id, 'transcript.json'),
      join(openclawDir, 'sessions', id, 'messages.json'),
      join(openclawDir, 'transcripts', `${id}.json`),
    ]

    for (const transcriptPath of possiblePaths) {
      if (existsSync(transcriptPath)) {
        try {
          const raw = await readFile(transcriptPath, 'utf-8')
          const data = JSON.parse(raw)

          // Normalize to our format
          const messages: TranscriptMessage[] = Array.isArray(data)
            ? data.map((msg: any) => ({
                role: msg.role || 'user',
                content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || ''),
                timestamp: msg.timestamp || msg.created_at,
                toolName: msg.tool_name || msg.toolName,
                toolCallId: msg.tool_call_id || msg.toolCallId,
              }))
            : data.messages?.map((msg: any) => ({
                role: msg.role || 'user',
                content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || ''),
                timestamp: msg.timestamp || msg.created_at,
                toolName: msg.tool_name || msg.toolName,
                toolCallId: msg.tool_call_id || msg.toolCallId,
              })) || []

          return NextResponse.json({
            sessionId: id,
            messages,
            source: transcriptPath,
          })
        } catch {
          continue
        }
      }
    }

    // No transcript found — return empty
    return NextResponse.json({
      sessionId: id,
      messages: [],
      source: null,
      note: 'No transcript file found for this session',
    })
  } catch (error) {
    logger.error({ err: error, sessionId: id }, 'Transcript API error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
