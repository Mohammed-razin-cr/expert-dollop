import { envVar, postgrestUrl } from '@/lib/api/env'

/**
 * Server-side helper for calling the auth_* SECURITY DEFINER functions
 * through PostgREST as service_role.
 *
 * Going through PostgREST rather than a direct Postgres driver keeps the
 * app dependency-free — there is no `pg` in package.json — and reuses the
 * one database connection pool we already run.
 *
 * SERVER ONLY. The service-role key bypasses RLS; it must never be sent
 * to the browser.
 */

const REST_URL = postgrestUrl()

function serviceKey(): string {
  const k = envVar('SERVICE_ROLE_KEY')
  if (!k) throw new Error('SERVICE_ROLE_KEY is not set')
  return k
}

export class RpcError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
  }
}

/** Call a Postgres function and return its result, already JSON-parsed. */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const key = serviceKey()
  const res = await fetch(`${REST_URL}/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      // Scalar/json-returning functions: give us the bare value, not a
      // single-element array.
      Accept: 'application/vnd.pgrst.object+json, application/json',
    },
    body: JSON.stringify(args),
    cache: 'no-store',
  })

  const text = await res.text()

  if (!res.ok) {
    let message = text
    let code: string | undefined
    try {
      const parsed = JSON.parse(text)
      message = parsed.message ?? text
      code = parsed.code
    } catch {
      /* non-JSON error body — use it verbatim */
    }
    throw new RpcError(message, res.status, code)
  }

  if (!text) return null as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as T
  }
}

/**
 * Hit a PostgREST table endpoint as service_role and hand back the raw
 * Response, so the caller can read headers or stream the body itself.
 * `path` starts with a slash and is relative to the PostgREST root, e.g.
 * `/storage_objects?bucket=eq.oms-files`.
 */
export async function restFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const key = serviceKey()
  return fetch(`${REST_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
}
