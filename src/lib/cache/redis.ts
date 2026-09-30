import Redis from 'ioredis'

// One connection per server process, not per request — a Server Component
// re-creating a client on every render would open a new TCP connection each
// time. `REDIS_URL` is unset in most local dev setups; callers must treat a
// null client as "caching unavailable" rather than throwing.
//
// Connects eagerly (no `lazyConnect`) so the handshake happens once at
// server startup, off the critical path of a request. The offline queue
// stays on (its default) so a command issued before that handshake finishes
// waits for it instead of failing outright — `maxRetriesPerRequest` and
// `commandTimeout` still bound how long a request can be stuck waiting if
// Redis is genuinely unreachable.
let client: Redis | null | undefined

export function getRedis(): Redis | null {
  if (client !== undefined) return client

  const url = process.env.REDIS_URL
  if (!url) {
    client = null
    return client
  }

  client = new Redis(url, {
    connectTimeout: 3000,
    commandTimeout: 2000,
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
  })
  client.on('error', (err) => {
    console.error('[redis] connection error:', err.message)
  })

  return client
}
