'use client'

const SW_PATH = '/sw.js'
const PERMISSION_KEY = 'mc.push.permission'

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

/** Check if browser supports notifications */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
}

/** Get current permission state from localStorage or browser */
export function getPermissionState(): PushPermissionState {
  if (!isPushSupported()) return 'unsupported'
  const stored = localStorage.getItem(PERMISSION_KEY)
  if (stored === 'granted' || stored === 'denied') return stored as PushPermissionState
  return Notification.permission as PushPermissionState
}

/** Request notification permission */
export async function requestPermission(): Promise<PushPermissionState> {
  if (!isPushSupported()) return 'unsupported'

  try {
    const result = await Notification.requestPermission()
    localStorage.setItem(PERMISSION_KEY, result)
    return result as PushPermissionState
  } catch {
    return 'denied'
  }
}

/** Register service worker */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH)
    return reg
  } catch (err) {
    console.warn('SW registration failed:', err)
    return null
  }
}

/** Show a browser notification (uses Notification API directly for local triggers) */
export function showNotification(title: string, body: string, tag?: string): void {
  if (getPermissionState() !== 'granted') return

  try {
    // Try using service worker first for persistence
    navigator.serviceWorker?.ready?.then(reg => {
      reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: tag || 'mc-' + Date.now(),
      })
    }).catch(() => {
      // Fallback to direct Notification
      new Notification(title, { body, icon: '/icon-192.png', tag: tag || 'mc-' + Date.now() })
    })
  } catch {
    // Silent fail
  }
}

/** Notification trigger helpers */
export const NotificationTriggers = {
  taskCompleted(taskTitle: string) {
    showNotification('✅ Task Completed', `Task '${taskTitle}' completed`, 'task-complete')
  },
  taskAssigned(taskTitle: string) {
    showNotification('📋 New Task', `New task: ${taskTitle}`, 'task-assign')
  },
  agentStatusChange(agentName: string, status: string) {
    const emoji = status === 'online' ? '🟢' : status === 'offline' ? '🔴' : '🤖'
    showNotification(`${emoji} Agent Status`, `${agentName} is now ${status}`, 'agent-status')
  },
  chatMessage(from: string, content: string) {
    showNotification(`💬 Message from ${from}`, content.substring(0, 100), 'chat-msg')
  },
  generic(title: string, message: string) {
    showNotification(title, message)
  },
}
