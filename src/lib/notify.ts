/**
 * Telegram push notification dispatcher for Mission Control.
 * Sends alerts via the OpenClaw gateway HTTP API.
 */

import { logger } from './logger'

// Rate limiting: track last notification time per event key
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_MS = 5 * 60 * 1000 // 5 minutes per event type

// In-memory settings (loaded from DB on first use)
let notificationSettings: NotificationSettings | null = null
let settingsLoadedAt = 0
const SETTINGS_CACHE_MS = 30_000 // reload settings every 30s

export interface NotificationSettings {
  enabled: boolean
  chatId: string
  events: {
    task_completed: boolean
    task_failed: boolean
    task_created: boolean
    agent_offline: boolean
    agent_online: boolean
    stale_task: boolean
  }
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  chatId: '5329452013',
  events: {
    task_completed: true,
    task_failed: true,
    task_created: true,
    agent_offline: true,
    agent_online: true,
    stale_task: true,
  },
}

type NotificationEventType = keyof NotificationSettings['events']

/** Load notification settings from the DB settings table */
function loadSettings(): NotificationSettings {
  const now = Date.now()
  if (notificationSettings && now - settingsLoadedAt < SETTINGS_CACHE_MS) {
    return notificationSettings
  }

  try {
    // Dynamic import to avoid circular dependency issues
    const { getDatabase } = require('./db')
    const db = getDatabase()

    const getVal = (key: string): string | undefined => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
      return row?.value
    }

    notificationSettings = {
      enabled: (getVal('notifications.push_enabled') ?? 'true') === 'true',
      chatId: getVal('notifications.telegram_chat_id') ?? DEFAULT_SETTINGS.chatId,
      events: {
        task_completed: (getVal('notifications.event_task_completed') ?? 'true') === 'true',
        task_failed: (getVal('notifications.event_task_failed') ?? 'true') === 'true',
        task_created: (getVal('notifications.event_task_created') ?? 'true') === 'true',
        agent_offline: (getVal('notifications.event_agent_offline') ?? 'true') === 'true',
        agent_online: (getVal('notifications.event_agent_online') ?? 'true') === 'true',
        stale_task: (getVal('notifications.event_stale_task') ?? 'true') === 'true',
      },
    }
    settingsLoadedAt = now
  } catch {
    notificationSettings = { ...DEFAULT_SETTINGS }
    settingsLoadedAt = now
  }

  return notificationSettings
}

/** Invalidate cached settings (call after settings update) */
export function invalidateNotificationSettings(): void {
  settingsLoadedAt = 0
  notificationSettings = null
}

/** Check rate limit for an event. Returns true if allowed. */
function checkRateLimit(eventKey: string): boolean {
  const now = Date.now()
  const lastSent = rateLimitMap.get(eventKey)
  if (lastSent && now - lastSent < RATE_LIMIT_MS) {
    return false
  }
  rateLimitMap.set(eventKey, now)
  return true
}

/** Send a message to Telegram via the OpenClaw gateway */
async function sendToTelegram(chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch('http://127.0.0.1:3031/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'telegram', chatId, text }),
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      logger.warn({ status: res.status }, 'Telegram notification send failed (gateway)')
      return false
    }
    return true
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Telegram notification send error')
    // Fallback: write to queue file
    try {
      const fs = require('fs')
      const queuePath = '/tmp/mc-notifications.json'
      let queue: any[] = []
      try {
        const existing = fs.readFileSync(queuePath, 'utf8')
        queue = JSON.parse(existing)
      } catch { /* file doesn't exist yet */ }
      queue.push({ chatId, text, timestamp: Date.now() })
      // Keep only last 50 entries
      if (queue.length > 50) queue = queue.slice(-50)
      fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2))
    } catch { /* best effort */ }
    return false
  }
}

/** Send a push notification for an MC event */
export async function pushNotification(
  eventType: NotificationEventType,
  message: string,
  rateLimitKey?: string,
): Promise<void> {
  const settings = loadSettings()

  if (!settings.enabled) return
  if (!settings.events[eventType]) return

  const key = rateLimitKey ?? eventType
  if (!checkRateLimit(key)) {
    logger.debug({ eventType, key }, 'Notification rate-limited')
    return
  }

  await sendToTelegram(settings.chatId, message)
}

// ── Convenience helpers ──────────────────────────────────────────────

export function notifyTaskCompleted(title: string): Promise<void> {
  return pushNotification('task_completed', `✅ Task completed: ${title}`, `task_completed:${title}`)
}

export function notifyTaskFailed(title: string, reason?: string): Promise<void> {
  const msg = reason ? `❌ Task failed: ${title} — ${reason}` : `❌ Task failed: ${title}`
  return pushNotification('task_failed', msg, `task_failed:${title}`)
}

export function notifyTaskCreated(title: string, priority: string): Promise<void> {
  return pushNotification('task_created', `📋 New task: ${title} (priority: ${priority})`, `task_created:${title}`)
}

export function notifyAgentOffline(name: string): Promise<void> {
  return pushNotification('agent_offline', `⚠️ Agent ${name} went offline`, `agent_offline:${name}`)
}

export function notifyAgentOnline(name: string): Promise<void> {
  return pushNotification('agent_online', `🟢 Agent ${name} is online`, `agent_online:${name}`)
}

export function notifyStaleTask(title: string): Promise<void> {
  return pushNotification('stale_task', `🔍 Task stuck for >4h: ${title}`, `stale_task:${title}`)
}
