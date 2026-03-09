// Simple in-memory cache for Late API responses
const cache = new Map<string, { data: unknown; ts: number }>()
const TTL = 5 * 60 * 1000 // 5 minutes

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > TTL) { cache.delete(key); return null }
  return entry.data as T
}

export function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() })
}

export function bustCache(key?: string) {
  if (key) cache.delete(key)
  else cache.clear()
}
