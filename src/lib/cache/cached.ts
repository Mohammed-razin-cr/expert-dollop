import { getRedis } from './redis'

// Read-through cache: on a hit, skip `fn` (and the database) entirely; on a
// miss or any Redis failure, fall back to calling `fn` directly so a down or
// unconfigured Redis degrades to "no caching," never a broken page.
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const redis = getRedis()
  if (!redis) return fn()

  try {
    const hit = await redis.get(key)
    if (hit != null) return JSON.parse(hit) as T
  } catch (err) {
    console.error(`[redis] read failed for "${key}", falling back to source:`, (err as Error).message)
    return fn()
  }

  const value = await fn()
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch (err) {
    console.error(`[redis] write failed for "${key}":`, (err as Error).message)
  }
  return value
}
