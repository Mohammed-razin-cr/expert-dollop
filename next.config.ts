import type { NextConfig } from 'next'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * This directory, pinned as the file-tracing root.
 *
 * Without it Next walks up looking for a workspace root, and a stray
 * package.json in a developer's home directory is enough to convince it
 * the project lives there — `output: 'standalone'` then emits server.js
 * under .next/standalone/<the/whole/path//from/home>/ and the Dockerfile's
 * COPY finds an empty directory. Pinning it keeps the layout identical on
 * every machine and inside the image.
 */
const here = dirname(fileURLToPath(import.meta.url))

/**
 * Gateway for the self-hosted backend.
 *
 * There is no Supabase here. PostgreSQL and PostgREST run on Railway, and
 * auth and storage are route handlers in this app. @supabase/ssr remains
 * only as the HTTP client that speaks PostgREST's dialect; it reaches
 * nothing outside this deployment.
 *
 * The client derives every endpoint from NEXT_PUBLIC_API_URL:
 *   {url}/rest/v1/...     -> PostgREST      (proxied below)
 *   {url}/auth/v1/...     -> src/app/auth/v1/*      (route handlers)
 *   {url}/storage/v1/...  -> src/app/storage/v1/*   (route handlers)
 *
 * Only the data layer is a separate process. Pointing NEXT_PUBLIC_API_URL
 * at the app itself makes this deployment serve all three, so the client
 * needs no changes at all.
 *
 * Locally, start PostgREST with: Backend\postgrest\start.ps1
 */

/**
 * Deployed PostgREST. Only a fallback — POSTGREST_URL always wins.
 * Duplicated from src/lib/api/env.ts, which this file cannot import
 * because Node evaluates it before the `@/` alias exists.
 */
const RAILWAY_REST = 'https://omselectrob-production.up.railway.app'

/**
 * Where /rest/v1 is proxied to.
 *
 * The old default was 127.0.0.1:3010 everywhere, which is a quiet trap in
 * production: a forgotten variable does not fail the build, it just
 * proxies every query to a port that is not there. On Vercel, fall back to
 * the deployed PostgREST instead of to localhost.
 */
const REST =
  process.env.POSTGREST_URL ??
  process.env.SUPABASE_REST_URL ??
  (process.env.VERCEL ? RAILWAY_REST : 'http://127.0.0.1:3010')

/**
 * The app's own origin. Both hosts publish it, so a deployment should not
 * have to be told its own address: Railway as RAILWAY_PUBLIC_DOMAIN,
 * Vercel as VERCEL_PROJECT_PRODUCTION_URL. Setting NEXT_PUBLIC_API_URL
 * explicitly still overrides both — needed once a custom domain is
 * attached, since the browser must call the host it was served from.
 *
 * On Vercel the production domain is only right for the production
 * deployment. VERCEL_PROJECT_PRODUCTION_URL is set on previews too, so
 * taking it unconditionally would serve a preview from its own URL while
 * telling the browser to call production for /auth/v1 and /rest/v1 — a
 * cross-origin request, against live data, from a branch build. Previews
 * therefore use VERCEL_URL, which is that one deployment's own address.
 */
const vercelHost =
  process.env.VERCEL_ENV === 'production'
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : process.env.VERCEL_URL

const host = process.env.RAILWAY_PUBLIC_DOMAIN ?? vercelHost

const SELF =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  (host ? `https://${host}` : 'http://localhost:3000')

const nextConfig: NextConfig = {
  // Emits .next/standalone — server.js plus only the node_modules actually
  // reached — so the Railway runtime image carries no build toolchain.
  //
  // Railway only. Vercel assembles its own output from .next, and standalone
  // mode rearranges that directory underneath it — which is what produced
  // `ENOENT: lstat '/vercel/path0/.next/package.json'` on every preview
  // build. Frontend/Dockerfile is the only thing that reads
  // .next/standalone, and that image is what Railway runs.
  output: process.env.VERCEL ? undefined : 'standalone',
  outputFileTracingRoot: here,
  turbopack: { root: here },
  // Inlined at build time, which is what makes it reach the browser
  // bundle. Changing it therefore needs a redeploy, not a restart.
  env: {
    NEXT_PUBLIC_API_URL: SELF,
    // Kept populated so anything still reading the old name resolves to
    // the same origin. Remove with LEGACY_ALIASES in src/lib/api/env.ts.
    NEXT_PUBLIC_SUPABASE_URL: SELF,
  },
  async rewrites() {
    return [{ source: '/rest/v1/:path*', destination: `${REST}/:path*` }]
  },
}

export default nextConfig
