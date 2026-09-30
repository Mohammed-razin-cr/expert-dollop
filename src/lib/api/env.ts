/**
 * Reads the environment the data client needs, and says plainly what is
 * missing when something is.
 *
 * There is no Supabase in this system. The database is PostgreSQL on
 * Railway, the data API is PostgREST, and auth and storage are route
 * handlers in this app. `@supabase/ssr` survives only as the HTTP client
 * that speaks PostgREST's dialect — it contacts nothing outside our own
 * deployment. The variables are named for what they actually are.
 *
 * LEGACY_ALIASES map the previous SUPABASE_* names, so a machine with an
 * older .env.local, or a Vercel project configured before the rename,
 * keeps working. Delete the map once every environment has moved over.
 *
 * The `process.env.X!` non-null assertions this replaced were not free.
 * With the variables unset, the client threw from inside the session
 * middleware — and because that runs on every matched path, the whole site
 * answered `Internal Server Error` with no indication of which variable
 * was unset, or that configuration was the problem at all.
 */

const LEGACY_ALIASES: Record<string, string> = {
  NEXT_PUBLIC_API_URL: 'NEXT_PUBLIC_SUPABASE_URL',
  NEXT_PUBLIC_ANON_KEY: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_ROLE_KEY',
  JWT_SECRET: 'SUPABASE_JWT_SECRET',
}

/**
 * Current name first, old name second.
 *
 * NEXT_PUBLIC_* values are inlined by the bundler, which only substitutes
 * a literal `process.env.NAME`. Both spellings are therefore written out
 * in full at the call sites below rather than looked up through this
 * helper, and this handles the server-side names.
 */
export function envVar(name: string): string | undefined {
  const legacy = LEGACY_ALIASES[name]
  return process.env[name] ?? (legacy ? process.env[legacy] : undefined)
}

function require_(vars: Record<string, string | undefined>): string[] {
  const missing = Object.entries(vars)
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missing.length) {
    throw new Error(
      `API configuration missing: ${missing.join(', ')}. ` +
        'Set these in the Vercel project settings for Production, Preview and ' +
        'Development, then redeploy — NEXT_PUBLIC_* values are baked in at ' +
        'build time, so a restart alone will not pick them up. See DEPLOY.md step 3.',
    )
  }
  return Object.values(vars) as string[]
}

/** App origin and anon key — the pair the browser and session clients need. */
export function apiEnv(): { url: string; anonKey: string } {
  const [url, anonKey] = require_({
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_ANON_KEY:
      process.env.NEXT_PUBLIC_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
  return { url, anonKey }
}

/** App origin and service-role key. SERVER ONLY — this key bypasses RLS. */
export function apiAdminEnv(): { url: string; serviceKey: string } {
  const [url, serviceKey] = require_({
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    SERVICE_ROLE_KEY: envVar('SERVICE_ROLE_KEY'),
  })
  return { url, serviceKey }
}

/**
 * Deployed PostgREST. Duplicated as a literal in next.config.ts, which is
 * evaluated by Node before the `@/` path alias exists and so cannot import
 * this — keep the two in sync.
 */
const RAILWAY_REST = 'https://omselectrob-production.up.railway.app'

/**
 * Where PostgREST is.
 *
 * Falling back to localhost in production is a quiet trap: nothing fails
 * at build time, every query just goes to a port that is not listening. On
 * Vercel, fall back to the deployed instance instead.
 */
export function postgrestUrl(): string {
  return (
    process.env.POSTGREST_URL ??
    process.env.SUPABASE_REST_URL ??
    (process.env.VERCEL ? RAILWAY_REST : 'http://127.0.0.1:3010')
  )
}
