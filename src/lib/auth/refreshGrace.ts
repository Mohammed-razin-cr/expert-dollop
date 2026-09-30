import { getRedis } from '@/lib/cache/redis'

/**
 * A short reuse window for refresh tokens.
 *
 * `auth_consume_refresh_token` revokes the presented token and issues a new
 * one in the same statement, so a token works exactly once:
 *
 *   update auth.refresh_tokens set revoked = true
 *    where token = p_token and not revoked
 *
 * That is the right shape for a stolen token and the wrong shape for an
 * honest client, because refreshes are not serialised. A page that renders
 * eight server components builds eight Supabase clients; when the hour-old
 * access token expires they all present the same refresh token at once. One
 * update matches, the other seven match nothing, and the route turns that
 * into a 400 — which supabase-js reads as a dead session and signs the user
 * out mid-page. Two open tabs do the same thing.
 *
 * This is also why a BD occasionally saw a student sidebar: the layout reads
 * `profiles` with whichever token the request holds, and a request that lost
 * the race holds a revoked one, so the row comes back empty and every caller
 * of `profile?.role ?? 'student'` takes the fallback. One race, two symptoms.
 *
 * So the loser of the race is handed the same session the winner was issued,
 * for a few seconds after the fact. GoTrue does exactly this and calls it the
 * reuse interval; its default is ten seconds.
 *
 * The cost, stated plainly rather than rounded down: if a stolen token is
 * replayed within the window — and loses the race, because the legitimate
 * client's own request revoked it first — the thief does not get an error
 * as they would have before. They get the same live session the legitimate
 * client is now using, for whatever remains of the window. That is a real,
 * if narrow, increase in what a losing replay is worth: bounded to 30
 * seconds, and it is the legitimate client's existing session rather than
 * an independent credential of the thief's own — it dies the moment that
 * session's next rotation lands, same as before this file existed — but it
 * is not nothing. A stolen refresh token was already a live incident either
 * way; this changes what losing the race gets you, not whether winning it
 * does.
 */

const GRACE_SECONDS = 30
const KEY = (token: string) => `auth:refresh-grace:${token}`

/** What the RPC hands back, and all we need to rebuild a session. */
export type ConsumedToken = { user: { id: string; email?: string }; refresh_token: string }

// ---------------------------------------------------------------------------
// In-process single flight
// ---------------------------------------------------------------------------
// The common case is several requests inside one Node process, so catching it
// here costs nothing and needs no infrastructure: the first caller runs, the
// rest await the same promise.
const inFlight = new Map<string, Promise<ConsumedToken | null>>()

export function singleFlight(
  token: string,
  fn: () => Promise<ConsumedToken | null>,
): Promise<ConsumedToken | null> {
  const running = inFlight.get(token)
  if (running) return running

  const p = fn().finally(() => inFlight.delete(token))
  inFlight.set(token, p)
  return p
}

// ---------------------------------------------------------------------------
// Cross-process recall
// ---------------------------------------------------------------------------
// Redis when it is configured, so two Railway instances agree; a bounded local
// map when it is not, which still covers single-instance and local dev. Both
// are best effort — a failure here must fall through to the normal path and
// never take the login route down with it.
const local = new Map<string, { at: number; value: ConsumedToken }>()

// Redis is an optimisation here, never a dependency. This route is how every
// session in the app stays alive, so a slow or half-dead Redis must cost a
// refresh a few milliseconds and nothing more — ioredis' own commandTimeout is
// 2s and it retries, which on the auth path is far too long to wait for a
// cache that we are perfectly able to do without. Whatever has not answered by
// then is treated as a miss and the in-process map answers instead.
const REDIS_BUDGET_MS = 150

async function withBudget<T>(what: string, op: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      op,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), REDIS_BUDGET_MS)
      }),
    ])
  } catch (err) {
    console.error(`[auth/grace] ${what} failed:`, (err as Error).message)
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function pruneLocal() {
  const cutoff = Date.now() - GRACE_SECONDS * 1000
  for (const [k, v] of local) if (v.at < cutoff) local.delete(k)
  // A stampede of distinct bad tokens must not grow this without bound.
  if (local.size > 1000) local.clear()
}

export async function remember(token: string, value: ConsumedToken): Promise<void> {
  // Written to both, deliberately. The local map is what answers when Redis is
  // absent, unreachable, or simply slower than its budget, and it costs a map
  // entry that expires on its own.
  pruneLocal()
  local.set(token, { at: Date.now(), value })

  const redis = getRedis()
  if (!redis) return
  await withBudget('write', redis.set(KEY(token), JSON.stringify(value), 'EX', GRACE_SECONDS))
}

export async function recall(token: string): Promise<ConsumedToken | null> {
  // Local first: it is free, and on the instance that won the race it already
  // holds the answer, so the common case never waits on the network at all.
  const hit = local.get(token)
  if (hit) {
    if (Date.now() - hit.at <= GRACE_SECONDS * 1000) return hit.value
    local.delete(token)
  }

  const redis = getRedis()
  if (!redis) return null

  const raw = await withBudget('read', redis.get(KEY(token)))
  if (raw == null) return null
  try {
    return JSON.parse(raw) as ConsumedToken
  } catch {
    // A corrupt entry is a miss, not a crash on the login path.
    return null
  }
}

/** Exported for the route's comment to stay honest about the delay it waits. */
export const RECHECK_DELAY_MS = 250
