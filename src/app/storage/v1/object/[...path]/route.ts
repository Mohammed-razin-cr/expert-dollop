import { NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { verifyJwt, signJwt } from '@/lib/auth/jwt'
import { restFetch } from '@/lib/auth/rpc'
import * as gridfs from '@/lib/storage/gridfs'
import { MAX_MATERIAL_BYTES, MAX_MATERIAL_MB } from '@/lib/uploads'

/**
 * Local replacement for Supabase Storage, covering the operations the app
 * uses on the single `oms-files` bucket:
 *
 *   POST   /storage/v1/object/:bucket/*        upload
 *   POST   /storage/v1/object/sign/:bucket/*   create a signed URL
 *   GET    /storage/v1/object/sign/:bucket/*   fetch via that signed URL
 *   DELETE /storage/v1/object/:bucket          remove (body: { prefixes })
 *
 * Study material is kept in MongoDB GridFS — lecture videos routinely pass
 * the ~3 MB a base64 row can safely hold. Everything else — the BD and
 * admin documents — lives in public.storage_objects
 * (Backend/postgres/09_*.sql), base64 in a service-role-only table: a
 * Vercel function's filesystem is read-only apart from /tmp, and /tmp does
 * not outlive the invocation. `usesGridFS` below is the only place that
 * split is decided, so the callers know nothing about it.
 *
 * Reads still go through the signature check below, whichever backend
 * holds the bytes.
 *
 * Every entry point that changes something, or that hands out the means to
 * read something, checks who is asking — see `caller` and `mayTouch`. GET
 * is the exception and stays signature-only, deliberately: see the note
 * above it.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'oms-files'

/**
 * Material moved to MongoDB so the files sit in a database rather than as
 * a loose folder. Documents were deliberately left on storage_objects: they
 * belong to BD and admin, and moving them would change how those roles
 * reach a file that already works.
 */
const usesGridFS = (key: string) => key.startsWith('materials/') || key.startsWith('marketing/')

function err(status: number, message: string) {
  return NextResponse.json({ statusCode: String(status), error: message, message }, { status })
}

/**
 * Who is asking, or null if that cannot be established.
 *
 * supabase-js puts the session's access token on every storage call, and
 * falls back to the anon key when nobody is signed in — so the presence of
 * a token proves nothing on its own. What counts is a token this
 * deployment would also accept at PostgREST: correctly signed, unexpired,
 * and carrying the `authenticated` role with a subject. The anon key is
 * signed with the same secret but claims `role: 'anon'` and no subject,
 * which is exactly what the second condition rejects.
 */
function caller(req: Request): string | null {
  const header = req.headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) return null
  const claims = verifyJwt(header.slice(7))
  if (!claims || claims.role !== 'authenticated' || !claims.sub) return null
  return claims.sub
}

/** The caller's app role. Read as service_role, since profiles is RLS'd. */
async function roleOf(uid: string): Promise<{ role: string; roleKey: string | null } | null> {
  try {
    const res = await restFetch(`/profiles?id=eq.${encodeURIComponent(uid)}&select=role,role_key&limit=1`)
    if (!res.ok) return null
    const rows = (await res.json()) as { role: string; role_key: string | null }[]
    const row = rows?.[0]
    return row ? { role: row.role, roleKey: row.role_key } : null
  } catch (e) {
    console.error('[storage roleOf]', e)
    return null
  }
}

/**
 * Whether a signed-in user may reach a given key.
 *
 * Reading is open to any signed-in user, which mirrors the tables these
 * files hang off: RLS lets an authenticated user select materials and
 * profiles, and it is a row that tells them a path exists at all.
 *
 * Writing is narrower. An avatar is named after the person it belongs to,
 * so the key itself settles who may replace or delete it and no lookup is
 * needed. Material is staff and trainer territory, which does need the
 * profile row.
 *
 * An unrecognised prefix is refused outright rather than guessed at: every
 * writer in the app uses one of the two below, so a third is a mistake or
 * an attempt.
 */
async function mayTouch(key: string, uid: string, access: 'read' | 'write'): Promise<boolean> {
  if (key.startsWith('avatars/')) {
    if (access === 'read') return true
    return key.slice('avatars/'.length).startsWith(`${uid}_`)
  }
  if (key.startsWith('marketing/')) {
    const [, taskId] = key.split('/')
    if (!taskId) return false
    const who = await roleOf(uid)
    if (who?.role === 'super_admin' || who?.role === 'admin') return true
    if (who?.roleKey !== 'digital_marketing') return false
    try {
      const res = await restFetch(`/tasks?id=eq.${encodeURIComponent(taskId)}&select=assigned_to&limit=1`)
      if (!res.ok) return false
      const rows = (await res.json()) as { assigned_to: string | null }[]
      return rows?.[0]?.assigned_to === uid
    } catch {
      return false
    }
  }
  if (usesGridFS(key)) {
    if (access === 'read') return true
    const who = await roleOf(uid)
    return who?.role === 'super_admin' || who?.role === 'admin' || who?.role === 'trainer'
  }
  return false
}

/**
 * Normalise an object key and refuse anything that is not a plain
 * relative path inside the one bucket we serve. Nothing touches the
 * filesystem, but keys still have to be canonical — otherwise the same
 * file could be stored under two different spellings.
 */
function cleanKey(bucket: string, key: string): string | null {
  if (bucket !== BUCKET) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(key)
  } catch {
    return null
  }
  const clean = decoded.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!clean) return null
  if (clean.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) return null
  return clean
}

/** Pull the uploaded bytes out of either a multipart form or a raw body. */
async function readUpload(req: Request): Promise<{ data: Buffer; mime: string } | null> {
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    for (const value of form.values()) {
      if (value instanceof File) {
        return {
          data: Buffer.from(await value.arrayBuffer()),
          mime: value.type || 'application/octet-stream',
        }
      }
    }
    return null
  }
  const buf = Buffer.from(await req.arrayBuffer())
  if (!buf.length) return null
  return { data: buf, mime: contentType || 'application/octet-stream' }
}

// ---------------------------------------------------------------------
// POST — upload, or mint a signed URL when the path starts with `sign`
// ---------------------------------------------------------------------
export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  if (!path?.length) return err(400, 'Missing object path')

  // Minting a signed URL is the same privilege as reading the file, so it
  // is gated exactly as a read would be. Leaving this open was what made
  // the signature check on GET decorative: anyone could ask for a token.
  const uid = caller(req)
  if (!uid) return err(401, 'Sign in to continue')

  if (path[0] === 'sign') {
    const [, bucket, ...rest] = path
    const key = cleanKey(bucket, rest.join('/'))
    if (!key) return err(400, 'Invalid bucket or key')
    if (!(await mayTouch(key, uid, 'read'))) return err(403, 'Not allowed to read this file')

    const body = await req.json().catch(() => ({}))
    const expiresIn = Number(body?.expiresIn ?? 3600)
    const token = signJwt({
      url: `${bucket}/${key}`,
      exp: Math.floor(Date.now() / 1000) + (Number.isFinite(expiresIn) ? expiresIn : 3600),
    })
    // supabase-js prefixes this with `${supabaseUrl}/storage/v1`.
    return NextResponse.json({
      signedURL: `/object/sign/${bucket}/${key}?token=${token}`,
    })
  }

  const [bucket, ...rest] = path
  const key = cleanKey(bucket, rest.join('/'))
  if (!key) return err(400, 'Invalid bucket or key')
  if (!(await mayTouch(key, uid, 'write'))) return err(403, 'Not allowed to upload here')

  if (usesGridFS(key)) {
    // The form checks this too, but a client-side guard is only a courtesy:
    // the cap is enforced here, where the bytes arrive. A request that
    // declares no length is let through rather than guessed at.
    const declared = Number(req.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > MAX_MATERIAL_BYTES) {
      return err(413, `File is too large. Please upload a material under ${MAX_MATERIAL_MB} MB.`)
    }

    // Streamed straight through where possible: a lecture video must not
    // have to fit in the Node heap on its way past.
    try {
      const raw = req.headers.get('content-type') ?? ''
      if (!raw.includes('multipart/form-data') && req.body) {
        await gridfs.putObject(key, Readable.fromWeb(req.body as any), raw || undefined)
      } else {
        const upload = await readUpload(req)
        if (!upload) return err(400, 'Empty upload')
        await gridfs.putObject(key, upload.data, upload.mime)
      }
    } catch (e) {
      console.error('[storage upload gridfs]', e)
      return err(500, 'Could not store file')
    }
    return NextResponse.json({ Id: key, Key: `${bucket}/${key}` })
  }

  const upload = await readUpload(req)
  if (!upload) return err(400, 'Empty upload')

  try {
    // merge-duplicates upserts, keeping the overwrite-on-reupload
    // behaviour the filesystem version had.
    const res = await restFetch('/storage_objects', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        bucket,
        key,
        mime: upload.mime,
        size: upload.data.length,
        data: upload.data.toString('base64'),
      }),
    })
    if (!res.ok) {
      console.error('[storage upload]', res.status, await res.text())
      return err(500, 'Could not store file')
    }
  } catch (e) {
    console.error('[storage upload]', e)
    return err(500, 'Could not store file')
  }

  // Shape supabase-js reads back as { path, id, fullPath }.
  return NextResponse.json({ Id: key, Key: `${bucket}/${key}` })
}

/** supabase-js uses PUT when upsert is requested. */
export const PUT = POST

// ---------------------------------------------------------------------
// GET — serve a file, but only with a valid, unexpired signature
//
// This one is not gated on a session, and should not be. A signed URL is
// itself the permission: it is handed out only by the checks on POST /sign
// above, and it expires. The requests that arrive here are <img> loads and
// new tabs, which carry no Authorization header — insisting on a session
// would mean no picture in the topbar and no material preview, while
// adding nothing that the signature does not already establish.
// ---------------------------------------------------------------------
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  if (path?.[0] !== 'sign') return err(400, 'Only signed URLs are served')

  const [, bucket, ...rest] = path
  const key = cleanKey(bucket, rest.join('/'))
  const token = new URL(req.url).searchParams.get('token')
  if (!key) return err(400, 'Invalid bucket or key')
  if (!token) return err(400, 'Missing token')

  const claims = verifyJwt(token) as ({ url?: string } & Record<string, unknown>) | null
  // verifyJwt already rejects expired tokens; this confirms the signature
  // was issued for *this* object rather than some other one.
  if (!claims || claims.url !== `${bucket}/${key}`) return err(401, 'Invalid signature')

  const name = key.split('/').pop() ?? 'file'

  if (usesGridFS(key)) {
    try {
      const obj = await gridfs.getObject(key)
      if (!obj) return err(404, 'Object not found')
      return new NextResponse(Readable.toWeb(obj.stream) as unknown as ReadableStream, {
        headers: {
          'Content-Type': obj.contentType,
          'Content-Length': String(obj.length),
          'Content-Disposition': `inline; filename="${name}"`,
          'Cache-Control': 'private, max-age=60',
        },
      })
    } catch (e) {
      console.error('[storage get gridfs]', e)
      return err(500, 'Could not read file')
    }
  }

  try {
    const query =
      `/storage_objects?bucket=eq.${encodeURIComponent(bucket)}` +
      `&key=eq.${encodeURIComponent(key)}&select=data,mime&limit=1`
    const res = await restFetch(query)
    if (!res.ok) {
      console.error('[storage get]', res.status, await res.text())
      return err(500, 'Could not read file')
    }
    const rows = (await res.json()) as { data: string; mime: string }[]
    const row = rows?.[0]
    if (!row) return err(404, 'Object not found')

    const bytes = Buffer.from(row.data, 'base64')
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': row.mime || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${name}"`,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (e) {
    console.error('[storage get]', e)
    return err(500, 'Could not read file')
  }
}

// ---------------------------------------------------------------------
// DELETE — /object/:bucket with { prefixes: [...] }
// ---------------------------------------------------------------------
export async function DELETE(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const bucket = path?.[0]

  const uid = caller(req)
  if (!uid) return err(401, 'Sign in to continue')

  const body = await req.json().catch(() => ({}))
  const prefixes: string[] = Array.isArray(body?.prefixes) ? body.prefixes : []
  if (!prefixes.length) return err(400, 'No prefixes supplied')

  // Every key is authorised before any of them is removed, so a request
  // that is partly out of bounds takes nothing with it.
  const targets: { prefix: string; key: string }[] = []
  for (const prefix of prefixes) {
    const key = cleanKey(bucket, prefix)
    if (!key) continue
    if (!(await mayTouch(key, uid, 'write'))) return err(403, 'Not allowed to delete this file')
    targets.push({ prefix, key })
  }

  const removed: { name: string }[] = []
  for (const { prefix, key } of targets) {
    try {
      if (usesGridFS(key)) {
        await gridfs.deleteObject(key)
      } else {
        const query =
          `/storage_objects?bucket=eq.${encodeURIComponent(bucket)}` +
          `&key=eq.${encodeURIComponent(key)}`
        const res = await restFetch(query, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
        if (!res.ok) {
          console.error('[storage delete]', res.status, await res.text())
          continue
        }
      }
      removed.push({ name: prefix })
    } catch (e) {
      console.error('[storage delete]', e)
    }
  }
  return NextResponse.json(removed)
}
