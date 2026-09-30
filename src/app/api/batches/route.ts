import { NextResponse } from 'next/server'
import { createClient } from '@/lib/api/server'
import { createAdminClient } from '@/lib/api/admin'
import { isBD, isStaff, type Role } from '@/lib/rbac'

/**
 * Batch writes, and the roll that goes with them.
 *
 * Why this exists rather than the browser writing to PostgREST directly:
 * `batches_staff` and `enrollments_staff` are `for all using (is_staff())`,
 * so only super_admin and admin may write those two tables. A BD runs the
 * intake — they raise the students and sell the courses — but had no write
 * on either, and a refused UPDATE is invisible: it matches no row, changes
 * nothing, and PostgREST answers 200. Granting a BD the tables in the
 * database is the tidier fix (37_batch_enrolment_for_bd.sql, still worth
 * applying), but it needs a migration against production. This gets the
 * same result with what the app already has.
 *
 * The authorisation is therefore ours to enforce, and it is enforced here,
 * server side, from the session cookie — never from anything the caller
 * sends. Same shape as api/users/route.ts, which has the same job.
 *
 * Deliberately narrow: it writes `batches` and `enrollments` and nothing
 * else, only the columns named below, and it does not delete batches —
 * that stays with admin through the ordinary client, where RLS already
 * allows it.
 */

/** Who may run a batch: staff, plus BD and its counsellor equivalent. */
async function requireBatchWriter() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile as any)?.role as Role | undefined
  return isStaff(role) || isBD(role) ? user : null
}

type Body = {
  id?: unknown
  course_id?: unknown
  name?: unknown
  trainer_id?: unknown
  start_date?: unknown
  end_date?: unknown
  capacity?: unknown
  progress?: unknown
  status?: unknown
  students?: unknown
}

const BATCH_STATUS = ['planned', 'active', 'completed', 'cancelled']

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const uuids = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && !!x))] : null

/** The columns a caller may set, taken one at a time so nothing else rides along. */
function batchFields(body: Body) {
  const out: Record<string, unknown> = {}
  if ('course_id' in body) out.course_id = str(body.course_id)
  if ('name' in body) out.name = str(body.name)
  if ('trainer_id' in body) out.trainer_id = str(body.trainer_id)
  if ('start_date' in body) out.start_date = str(body.start_date)
  if ('end_date' in body) out.end_date = str(body.end_date)
  if ('capacity' in body) out.capacity = Math.max(0, Number(body.capacity) || 0)
  if ('progress' in body) out.progress = Math.max(0, Math.min(100, Number(body.progress) || 0))
  if ('status' in body && BATCH_STATUS.includes(String(body.status))) out.status = String(body.status)
  return out
}

/**
 * Make the batch's roll exactly `wanted`.
 *
 * The current roll is read here rather than taken from the caller, so two
 * people editing the same batch cannot talk each other into dropping
 * somebody. Removal is a soft delete, and re-adding upserts on the
 * (student_id, batch_id) unique key so the dead row is revived instead of
 * colliding with the new one.
 */
async function syncRoll(db: ReturnType<typeof createAdminClient>, batchId: string, wanted: string[]) {
  const { data: rows, error } = await db
    .from('enrollments')
    .select('student_id')
    .eq('batch_id', batchId)
    .is('deleted_at', null)
  if (error) return error.message

  const current = (rows ?? []).map((r: any) => r.student_id as string)
  const add = wanted.filter((id) => !current.includes(id))
  const drop = current.filter((id) => !wanted.includes(id))

  if (add.length) {
    const { error: e } = await db
      .from('enrollments')
      .upsert(
        add.map((student_id) => ({ student_id, batch_id: batchId, status: 'active', deleted_at: null })),
        { onConflict: 'student_id,batch_id' },
      )
    if (e) return e.message
  }
  if (drop.length) {
    const { error: e } = await db
      .from('enrollments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('batch_id', batchId)
      .in('student_id', drop)
    if (e) return e.message
  }
  return null
}

export async function POST(req: Request) {
  const user = await requireBatchWriter()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => null)) as Body | null
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const fields = batchFields(body)
  if (!fields.course_id || !fields.name) {
    return NextResponse.json({ error: 'Course and batch name are required' }, { status: 400 })
  }
  const roll = uuids(body.students) ?? []
  const cap = Number(fields.capacity ?? 0)
  if (cap && roll.length > cap) {
    return NextResponse.json(
      { error: `${roll.length} students selected but capacity is ${cap}.` },
      { status: 400 },
    )
  }

  const db = createAdminClient()
  const { data: created, error } = await db
    .from('batches')
    .insert({ status: 'active', ...fields })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const batchId = (created as any).id as string
  if (roll.length) {
    const rollErr = await syncRoll(db, batchId, roll)
    // The batch exists by now, so say which half failed rather than implying
    // nothing was written.
    if (rollErr) {
      return NextResponse.json(
        { error: `Batch created, but its students were not added: ${rollErr}`, id: batchId },
        { status: 400 },
      )
    }
  }
  return NextResponse.json({ ok: true, id: batchId })
}

export async function PATCH(req: Request) {
  const user = await requireBatchWriter()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => null)) as Body | null
  const id = str(body?.id)
  if (!body || !id) return NextResponse.json({ error: 'Batch id is required' }, { status: 400 })

  const fields = batchFields(body)
  const roll = uuids(body.students)

  const db = createAdminClient()

  // Capacity is checked against whichever of the two is being set, so
  // shrinking the capacity below the roll is refused the same as
  // overfilling it.
  if (roll) {
    let cap = fields.capacity as number | undefined
    if (cap === undefined) {
      const { data: b } = await db.from('batches').select('capacity').eq('id', id).maybeSingle()
      cap = (b as any)?.capacity ?? 0
    }
    if (cap && roll.length > cap) {
      return NextResponse.json(
        { error: `${roll.length} students selected but capacity is ${cap}.` },
        { status: 400 },
      )
    }
  }

  if (Object.keys(fields).length) {
    const { data: saved, error } = await db
      .from('batches')
      .update(fields)
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!saved?.length) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  if (roll) {
    const rollErr = await syncRoll(db, id, roll)
    if (rollErr) {
      return NextResponse.json({ error: `Batch saved, but its students were not: ${rollErr}` }, { status: 400 })
    }
  }
  return NextResponse.json({ ok: true })
}
