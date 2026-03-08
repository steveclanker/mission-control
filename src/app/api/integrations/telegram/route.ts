/**
 * Telegram Integration API
 * 
 * Handles incoming Telegram messages and converts them to tasks
 * Webhook endpoint: /api/integrations/telegram
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTaskSyncEngine } from '@/lib/task-sync'
import { logger } from '@/lib/logger'

interface TelegramMessage {
  message_id: number
  from: {
    id: number
    is_bot: boolean
    first_name: string
    last_name?: string
    username?: string
  }
  chat: {
    id: number
    type: string
  }
  date: number
  text: string
}

interface TelegramWebhookBody {
  update_id: number
  message: TelegramMessage
}

/**
 * POST /api/integrations/telegram - Handle Telegram webhook
 */
export async function POST(request: NextRequest) {
  try {
    const body: TelegramWebhookBody = await request.json()
    
    if (!body.message || !body.message.text) {
      return NextResponse.json({ status: 'ignored', reason: 'no_text_message' })
    }

    const message = body.message
    const text = message.text.trim()

    // Ignore messages from bots
    if (message.from.is_bot) {
      return NextResponse.json({ status: 'ignored', reason: 'from_bot' })
    }

    // Only process messages that look like task assignments
    if (!isTaskMessage(text)) {
      return NextResponse.json({ status: 'ignored', reason: 'not_task_message' })
    }

    const syncEngine = getTaskSyncEngine()

    const taskId = await syncEngine.syncFromTelegram({
      message_id: message.message_id,
      text: text,
      from_user: message.from.username || message.from.first_name,
      chat_id: String(message.chat.id)
    })

    if (taskId) {
      logger.info(`Created task ${taskId} from Telegram message ${message.message_id}`)
      
      // Optional: Send confirmation back to Telegram
      // await sendTelegramMessage(message.chat.id, `✅ Task created: ID ${taskId}`)
      
      return NextResponse.json({ 
        status: 'success', 
        task_id: taskId,
        message: 'Task created successfully' 
      })
    } else {
      return NextResponse.json({ 
        status: 'failed', 
        reason: 'task_parsing_failed' 
      })
    }

  } catch (error) {
    logger.error({ err: error }, 'Telegram webhook error')
    return NextResponse.json(
      { status: 'error', message: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

/**
 * GET /api/integrations/telegram - Health check
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    service: 'telegram-integration',
    timestamp: new Date().toISOString()
  })
}

// Helper functions

function isTaskMessage(text: string): boolean {
  const taskIndicators = [
    /^task:/i,
    /^todo:/i,
    /^do\s/i,
    /can you\s/i,
    /please\s/i,
    /build\s/i,
    /create\s/i,
    /fix\s/i,
    /add\s/i,
    /update\s/i,
    /implement\s/i,
    /\[!\]/,  // Priority markers
    /\[!!\]/,
    /\[!!!\]/,
    /\[urgent\]/i,
    /@\w+/,   // Assignment markers
  ]

  // Check if message contains task indicators
  for (const pattern of taskIndicators) {
    if (pattern.test(text)) return true
  }

  // Check for imperative sentences (likely tasks)
  const words = text.toLowerCase().split(/\s+/)
  const actionWords = [
    'build', 'create', 'make', 'add', 'update', 'fix', 'implement', 
    'deploy', 'setup', 'configure', 'install', 'remove', 'delete',
    'write', 'code', 'develop', 'design', 'test', 'debug',
    'optimize', 'refactor', 'migrate', 'upgrade', 'document'
  ]

  if (actionWords.includes(words[0])) return true

  // Check minimum length for meaningful tasks
  if (text.length < 10) return false

  return false
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    logger.warn('TELEGRAM_BOT_TOKEN not configured, cannot send confirmation')
    return
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    })

    if (!response.ok) {
      logger.error(`Failed to send Telegram message: ${response.status}`)
    }
  } catch (error) {
    logger.error({ err: error }, 'Error sending Telegram message')
  }
}